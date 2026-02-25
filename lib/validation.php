<?php

declare(strict_types=1);

require_once __DIR__ . '/common.php';

/**
 * Validation and sanitization helpers.
 */

function sanitize_phone(string $phone): string
{
    return trim($phone);
}

function sanitize_xss(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES | ENT_HTML5, 'UTF-8');
}

function validate_email(string $email): bool
{
    return $email !== '' && filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
}

function validate_phone(string $phone): bool
{
    $digits = preg_replace('/\D/', '', $phone);
    return is_string($digits) && strlen($digits) >= 7 && strlen($digits) <= 15;
}

function parse_bool($value): bool
{
    if (is_bool($value)) {
        return $value;
    }
    if (is_string($value)) {
        return in_array(strtolower($value), ['1', 'true', 'yes', 'on'], true);
    }
    if (is_int($value)) {
        return $value === 1;
    }
    return false;
}

function text_length(string $value): int
{
    if (function_exists('mb_strlen')) {
        return (int) mb_strlen($value, 'UTF-8');
    }

    $chars = @preg_split('//u', $value, -1, PREG_SPLIT_NO_EMPTY);
    if (is_array($chars)) {
        return count($chars);
    }

    return strlen($value);
}

function text_substring(string $value, int $start, int $length): string
{
    if ($length <= 0) {
        return '';
    }

    if (function_exists('mb_substr')) {
        $slice = mb_substr($value, $start, $length, 'UTF-8');
        return is_string($slice) ? $slice : '';
    }

    $chars = @preg_split('//u', $value, -1, PREG_SPLIT_NO_EMPTY);
    if (is_array($chars)) {
        return implode('', array_slice($chars, $start, $length));
    }

    $slice = substr($value, $start, $length);
    return is_string($slice) ? $slice : '';
}

function truncate_field(string $value, int $maxLength): string
{
    if ($maxLength <= 0) {
        return '';
    }

    return text_length($value) > $maxLength
        ? text_substring($value, 0, $maxLength)
        : $value;
}

function normalize_string_list($value, int $maxItems = 5, int $maxLength = 300): array
{
    if (!is_array($value)) {
        return [];
    }

    $result = [];
    foreach ($value as $item) {
        if (!is_scalar($item)) {
            continue;
        }

        $text = truncate_field(trim((string) $item), $maxLength);
        if ($text === '') {
            continue;
        }

        $result[] = $text;
        if (count($result) >= $maxItems) {
            break;
        }
    }

    return $result;
}

function map_callback_status(string $status): string
{
    $normalized = strtolower(trim($status));
    if ($normalized === 'contacted') {
        return 'contactado';
    }
    if ($normalized === 'pending') {
        return 'pendiente';
    }
    return in_array($normalized, ['pendiente', 'contactado'], true) ? $normalized : 'pendiente';
}

function map_appointment_status(string $status): string
{
    $normalized = strtolower(trim($status));
    if ($normalized === 'noshow') {
        return 'no_show';
    }

    return in_array($normalized, ['confirmed', 'pending', 'cancelled', 'completed', 'no_show'], true)
        ? $normalized
        : 'confirmed';
}

/**
 * Validates date format (YYYY-MM-DD).
 */
function validate_date_format(string $date): bool
{
    return preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) === 1;
}

/**
 * Validates time format (HH:MM).
 */
function validate_time_format(string $time): bool
{
    return preg_match('/^\d{2}:\d{2}$/', $time) === 1;
}

/**
 * Validates if a date and time are in the future.
 * Handles the logic:
 * - Date must not be in the past.
 * - If date is today, time must be at least 1 hour in the future.
 *
 * @return array ['ok' => bool, 'error' => string|null]
 */
function validate_future_date(string $date, string $time, ?string $currentDate = null, ?string $currentTime = null): array
{
    if ($date === '' || $time === '') {
        return ['ok' => false, 'error' => 'Fecha y hora son obligatorias'];
    }

    if (!validate_date_format($date)) {
        return ['ok' => false, 'error' => 'Formato de fecha inválido (YYYY-MM-DD)'];
    }

    if (!validate_time_format($time)) {
        return ['ok' => false, 'error' => 'Formato de hora inválido (HH:MM)'];
    }

    $today = $currentDate ?? local_date('Y-m-d');
    if ($date < $today) {
        return ['ok' => false, 'error' => 'No se puede agendar en una fecha pasada'];
    }

    if ($date === $today) {
        if ($currentTime !== null) {
            $partsNow = explode(':', $currentTime);
            $nowMinutes = (int) ($partsNow[0] ?? 0) * 60 + (int) ($partsNow[1] ?? 0);
        } else {
            $nowMinutes = (int) local_date('H') * 60 + (int) local_date('i');
        }

        $parts = explode(':', $time);
        $slotMinutes = (int) ($parts[0] ?? 0) * 60 + (int) ($parts[1] ?? 0);
        // Allow booking only 1 hour ahead
        if ($slotMinutes <= $nowMinutes + 60) {
            return ['ok' => false, 'error' => 'Ese horario ya pasó o es muy pronto. Selecciona una hora con al menos 1 hora de anticipación, o elige otra fecha.'];
        }
    }

    return ['ok' => true, 'error' => null];
}

/**
 * Validates if a service is in the allowed list.
 */
function validate_service_exists(string $service, array $validServices): bool
{
    $normalized = strtolower(trim($service));
    if ($normalized === '') {
        return false;
    }
    return in_array($normalized, $validServices, true);
}

/**
 * Validates if a doctor is in the allowed list.
 */
function validate_doctor_exists(string $doctor, array $validDoctors): bool
{
    $normalized = strtolower(trim($doctor));
    if ($normalized === '') {
        return false;
    }
    return in_array($normalized, $validDoctors, true);
}

/**
 * Validates an appointment payload.
 *
 * @param array $payload The raw appointment data.
 * @param array $options Optional validation options:
 *                       - availability: array of slots by date
 *                       - validServices: array of allowed service IDs
 *                       - validDoctors: array of allowed doctor IDs
 * @return array ['ok' => bool, 'error' => string|null]
 */
function validate_appointment_payload(array $payload, array $options = []): array
{
    // Basic required fields
    $name = trim((string)($payload['name'] ?? ''));
    $email = trim((string)($payload['email'] ?? ''));
    $phone = trim((string)($payload['phone'] ?? ''));

    if ($name === '' || $email === '' || $phone === '') {
        return ['ok' => false, 'error' => 'Nombre, email y teléfono son obligatorios'];
    }

    if (!validate_email($email)) {
        return ['ok' => false, 'error' => 'El formato del email no es válido'];
    }

    if (!validate_phone($phone)) {
        return ['ok' => false, 'error' => 'El formato del teléfono no es válido'];
    }

    if (!isset($payload['privacyConsent']) || parse_bool($payload['privacyConsent']) !== true) {
        return ['ok' => false, 'error' => 'Debes aceptar el tratamiento de datos para reservar la cita'];
    }

    $date = (string)($payload['date'] ?? '');
    $time = (string)($payload['time'] ?? '');

    $dateCheck = validate_future_date($date, $time);
    if (!$dateCheck['ok']) {
        return $dateCheck;
    }

    if (isset($options['validServices']) && is_array($options['validServices'])) {
        $service = (string)($payload['service'] ?? '');
        if (!validate_service_exists($service, $options['validServices'])) {
            return ['ok' => false, 'error' => 'Servicio inválido'];
        }
    }

    if (isset($options['validDoctors']) && is_array($options['validDoctors'])) {
        $doctor = (string)($payload['doctor'] ?? '');
        // "indiferente" usually handled by caller, but if strictly checking list:
        if ($doctor !== '' && $doctor !== 'indiferente' && !validate_doctor_exists($doctor, $options['validDoctors'])) {
             return ['ok' => false, 'error' => 'Doctor inválido'];
        }
    }

    // Availability check if provided
    // Backward compatibility: check if $options is availability array (legacy second param)
    // Or if 'availability' key is present
    $availability = [];
    if (isset($options['availability']) && is_array($options['availability'])) {
        $availability = $options['availability'];
    } elseif (!empty($options) && !isset($options['validServices']) && !isset($options['validDoctors']) && isset($options[$date])) {
         // Heuristic: if options looks like availability map (key is date)
         $availability = $options;
    }

    if (!empty($availability)) {
        $availableSlots = isset($availability[$date]) && is_array($availability[$date])
            ? $availability[$date]
            : [];
        if (count($availableSlots) === 0) {
            return ['ok' => false, 'error' => 'No hay agenda disponible para la fecha seleccionada'];
        }

        if (!in_array($time, $availableSlots, true)) {
            return ['ok' => false, 'error' => 'Ese horario no está disponible para la fecha seleccionada'];
        }
    }

    return ['ok' => true, 'error' => null];
}

/**
 * Validates a reschedule payload.
 *
 * @param string $token
 * @param string $newDate
 * @param string $newTime
 * @return array ['ok' => bool, 'error' => string|null]
 */
function validate_reschedule_payload(string $token, string $newDate, string $newTime): array
{
    if ($token === '' || strlen($token) < 16) {
        return ['ok' => false, 'error' => 'Token inválido'];
    }

    return validate_future_date($newDate, $newTime);
}

<?php

declare(strict_types=1);

require_once __DIR__ . '/common.php';
require_once __DIR__ . '/validation.php';
require_once __DIR__ . '/business.php';
require_once __DIR__ . '/tenants.php';

/**
 * Business logic and data models.
 */

function get_service_label(string $service): string
{
    $labels = [
        'consulta' => 'Consulta Presencial',
        'telefono' => 'Consulta Telefonica',
        'video' => 'Video Consulta',
        'laser' => 'Tratamiento Laser',
        'rejuvenecimiento' => 'Rejuvenecimiento',
        'acne' => 'Tratamiento de Acne',
        'cancer' => 'Deteccion de Cancer de Piel'
    ];
    return $labels[$service] ?? $service;
}

function get_doctor_label(string $doctor): string
{
    $labels = [
        'rosero' => 'Dr. Javier Rosero',
        'narvaez' => 'Dra. Carolina Narvaez',
        'indiferente' => 'Cualquiera disponible'
    ];
    return $labels[$doctor] ?? $doctor;
}

function get_payment_method_label(string $method): string
{
    $labels = [
        'cash' => 'Efectivo (en consultorio)',
        'card' => 'Tarjeta de credito/debito',
        'transfer' => 'Transferencia bancaria',
        'unpaid' => 'Pendiente'
    ];
    return $labels[$method] ?? $method;
}

function get_payment_status_label(string $status): string
{
    $labels = [
        'paid' => 'Pagado',
        'pending_cash' => 'Pendiente - pago en consultorio',
        'pending_transfer_review' => 'Pendiente - verificando transferencia',
        'pending' => 'Pendiente'
    ];
    return $labels[$status] ?? $status;
}

function format_date_label(string $date): string
{
    $ts = strtotime($date);
    if ($ts === false) {
        return $date;
    }
    $dias = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
    $meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    $dow = (int) date('w', $ts);
    $day = (int) date('j', $ts);
    $month = (int) date('n', $ts) - 1;
    $year = date('Y', $ts);
    return ucfirst($dias[$dow]) . ' ' . $day . ' de ' . $meses[$month] . ' de ' . $year;
}

function normalize_review(array $review): array
{
    $rating = isset($review['rating']) ? (int) $review['rating'] : 0;
    if ($rating < 1) {
        $rating = 1;
    }
    if ($rating > 5) {
        $rating = 5;
    }
    return [
        'id' => isset($review['id']) ? (int) $review['id'] : (int) round(microtime(true) * 1000),
        'tenantId' => isset($review['tenantId']) && is_string($review['tenantId']) && trim($review['tenantId']) !== ''
            ? trim($review['tenantId'])
            : get_current_tenant_id(),
        'name' => truncate_field(sanitize_xss(isset($review['name']) ? trim((string) $review['name']) : ''), 100),
        'rating' => $rating,
        'text' => truncate_field(sanitize_xss(isset($review['text']) ? trim((string) $review['text']) : ''), 2000),
        'date' => isset($review['date']) ? (string) $review['date'] : local_date('c'),
        'verified' => isset($review['verified']) ? parse_bool($review['verified']) : true
    ];
}

function normalize_callback(array $callback): array
{
    return [
        'id' => isset($callback['id']) ? (int) $callback['id'] : (int) round(microtime(true) * 1000),
        'telefono' => truncate_field(sanitize_phone((string) ($callback['telefono'] ?? '')), 20),
        'preferencia' => truncate_field(sanitize_xss((string) ($callback['preferencia'] ?? '')), 200),
        'fecha' => isset($callback['fecha']) ? (string) $callback['fecha'] : local_date('c'),
        'status' => map_callback_status((string) ($callback['status'] ?? 'pendiente'))
    ];
}

function normalize_appointment(array $appointment): array
{
    $service = sanitize_xss((string) ($appointment['service'] ?? ''));
    $paymentMethod = strtolower(trim((string) ($appointment['paymentMethod'] ?? 'unpaid')));
    if (!in_array($paymentMethod, ['card', 'transfer', 'cash', 'unpaid'], true)) {
        $paymentMethod = 'unpaid';
    }

    $paymentStatus = trim((string) ($appointment['paymentStatus'] ?? 'pending'));
    if ($paymentStatus === '') {
        $paymentStatus = 'pending';
    }

    $privacyConsent = isset($appointment['privacyConsent']) ? parse_bool($appointment['privacyConsent']) : false;
    $privacyConsentAtDefault = $privacyConsent ? local_date('c') : '';
    $casePhotoNames = normalize_string_list($appointment['casePhotoNames'] ?? [], 3, 200);
    $casePhotoUrls = normalize_string_list($appointment['casePhotoUrls'] ?? [], 3, 500);
    $casePhotoPaths = normalize_string_list($appointment['casePhotoPaths'] ?? [], 3, 500);
    $casePhotoCount = isset($appointment['casePhotoCount']) ? (int) $appointment['casePhotoCount'] : count($casePhotoUrls);
    if ($casePhotoCount < 0) {
        $casePhotoCount = 0;
    }
    if ($casePhotoCount > 3) {
        $casePhotoCount = 3;
    }

    return [
        'id' => isset($appointment['id']) ? (int) $appointment['id'] : (int) round(microtime(true) * 1000),
        'tenantId' => isset($appointment['tenantId']) && is_string($appointment['tenantId']) && trim($appointment['tenantId']) !== ''
            ? trim($appointment['tenantId'])
            : get_current_tenant_id(),
        'service' => truncate_field($service, 50),
        'doctor' => truncate_field(sanitize_xss((string) ($appointment['doctor'] ?? '')), 100),
        'date' => truncate_field((string) ($appointment['date'] ?? ''), 20),
        'time' => truncate_field((string) ($appointment['time'] ?? ''), 10),
        'name' => truncate_field(sanitize_xss(trim((string) ($appointment['name'] ?? ''))), 150),
        'email' => truncate_field(trim((string) ($appointment['email'] ?? '')), 254),
        'phone' => truncate_field(sanitize_phone((string) ($appointment['phone'] ?? '')), 20),
        'reason' => truncate_field(sanitize_xss(trim((string) ($appointment['reason'] ?? ''))), 1000),
        'affectedArea' => truncate_field(sanitize_xss(trim((string) ($appointment['affectedArea'] ?? ''))), 100),
        'evolutionTime' => truncate_field(sanitize_xss(trim((string) ($appointment['evolutionTime'] ?? ''))), 100),
        'privacyConsent' => $privacyConsent,
        'privacyConsentAt' => truncate_field(trim((string) ($appointment['privacyConsentAt'] ?? $privacyConsentAtDefault)), 30),
        'casePhotoCount' => $casePhotoCount,
        'casePhotoNames' => $casePhotoNames,
        'casePhotoUrls' => $casePhotoUrls,
        'casePhotoPaths' => $casePhotoPaths,
        'price' => get_service_total_price($service),
        'status' => map_appointment_status((string) ($appointment['status'] ?? 'confirmed')),
        'paymentMethod' => $paymentMethod,
        'paymentStatus' => $paymentStatus,
        'paymentProvider' => truncate_field(trim((string) ($appointment['paymentProvider'] ?? '')), 50),
        'paymentIntentId' => truncate_field(trim((string) ($appointment['paymentIntentId'] ?? '')), 100),
        'paymentPaidAt' => truncate_field(trim((string) ($appointment['paymentPaidAt'] ?? '')), 30),
        'transferReference' => truncate_field(trim((string) ($appointment['transferReference'] ?? '')), 100),
        'transferProofPath' => truncate_field(trim((string) ($appointment['transferProofPath'] ?? '')), 300),
        'transferProofUrl' => truncate_field(trim((string) ($appointment['transferProofUrl'] ?? '')), 300),
        'transferProofName' => truncate_field(sanitize_xss(trim((string) ($appointment['transferProofName'] ?? ''))), 200),
        'transferProofMime' => truncate_field(trim((string) ($appointment['transferProofMime'] ?? '')), 50),
        'idempotencyKey' => truncate_field(trim((string) ($appointment['idempotencyKey'] ?? '')), 128),
        'idempotencyFingerprint' => truncate_field(strtolower(trim((string) ($appointment['idempotencyFingerprint'] ?? ''))), 128),
        'dateBooked' => isset($appointment['dateBooked']) ? (string) $appointment['dateBooked'] : local_date('c'),
        'rescheduleToken' => isset($appointment['rescheduleToken']) && $appointment['rescheduleToken'] !== ''
            ? (string) $appointment['rescheduleToken']
            : bin2hex(random_bytes(16)),
        'reminderSentAt' => truncate_field(trim((string) ($appointment['reminderSentAt'] ?? '')), 30)
    ];
}

function normalize_queue_ticket(array $ticket): array
{
    $queueType = strtolower(trim((string) ($ticket['queueType'] ?? 'walk_in')));
    if (!in_array($queueType, ['appointment', 'walk_in'], true)) {
        $queueType = 'walk_in';
    }

    $priorityClass = strtolower(trim((string) ($ticket['priorityClass'] ?? ($queueType === 'appointment' ? 'appt_current' : 'walk_in'))));
    if (!in_array($priorityClass, ['appt_overdue', 'appt_current', 'walk_in'], true)) {
        $priorityClass = $queueType === 'appointment' ? 'appt_current' : 'walk_in';
    }

    $status = strtolower(trim((string) ($ticket['status'] ?? 'waiting')));
    if (!in_array($status, ['waiting', 'called', 'completed', 'no_show', 'cancelled'], true)) {
        $status = 'waiting';
    }

    $initials = strtoupper(trim((string) ($ticket['patientInitials'] ?? '')));
    $initials = preg_replace('/[^A-Z]/', '', $initials);
    if (!is_string($initials)) {
        $initials = '';
    }
    $initials = substr($initials, 0, 4);

    $phoneLast4 = preg_replace('/\D+/', '', (string) ($ticket['phoneLast4'] ?? ''));
    if (!is_string($phoneLast4)) {
        $phoneLast4 = '';
    }
    if (strlen($phoneLast4) > 4) {
        $phoneLast4 = substr($phoneLast4, -4);
    }

    $ticketCode = strtoupper(trim((string) ($ticket['ticketCode'] ?? '')));
    if (!preg_match('/^[A-Z]-\d{3,4}$/', $ticketCode)) {
        $ticketCode = '';
    }

    $dailySeq = isset($ticket['dailySeq']) ? (int) $ticket['dailySeq'] : 0;
    if ($dailySeq < 0) {
        $dailySeq = 0;
    }

    $assignedConsultorioRaw = $ticket['assignedConsultorio'] ?? null;
    $assignedConsultorio = null;
    if ($assignedConsultorioRaw !== null && $assignedConsultorioRaw !== '') {
        $candidate = (int) $assignedConsultorioRaw;
        if (in_array($candidate, [1, 2], true)) {
            $assignedConsultorio = $candidate;
        }
    }

    $appointmentId = null;
    if (isset($ticket['appointmentId']) && $ticket['appointmentId'] !== '' && $ticket['appointmentId'] !== null) {
        $candidate = (int) $ticket['appointmentId'];
        if ($candidate > 0) {
            $appointmentId = $candidate;
        }
    }

    $createdSource = strtolower(trim((string) ($ticket['createdSource'] ?? 'kiosk')));
    if (!in_array($createdSource, ['kiosk', 'admin'], true)) {
        $createdSource = 'kiosk';
    }

    $createdAt = trim((string) ($ticket['createdAt'] ?? ''));
    if ($createdAt === '') {
        $createdAt = local_date('c');
    }

    return [
        'id' => isset($ticket['id']) ? (int) $ticket['id'] : (int) round(microtime(true) * 1000),
        'ticketCode' => $ticketCode,
        'dailySeq' => $dailySeq,
        'queueType' => $queueType,
        'appointmentId' => $appointmentId,
        'patientInitials' => $initials,
        'phoneLast4' => $phoneLast4,
        'priorityClass' => $priorityClass,
        'status' => $status,
        'assignedConsultorio' => $assignedConsultorio,
        'createdAt' => $createdAt,
        'calledAt' => truncate_field(trim((string) ($ticket['calledAt'] ?? '')), 40),
        'completedAt' => truncate_field(trim((string) ($ticket['completedAt'] ?? '')), 40),
        'createdSource' => $createdSource,
    ];
}

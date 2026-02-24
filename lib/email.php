<?php

declare(strict_types=1);

require_once __DIR__ . '/common.php';
require_once __DIR__ . '/models.php';
require_once __DIR__ . '/AppConfig.php';

/**
 * Email sending logic.
 */

/**
 * Reads SMTP configuration from environment variables.
 *
 * @return array{host:string,port:int,user:string,pass:string,from:string,from_name:string}
 */
function smtp_config(): array
{
    return AppConfig::getSmtpConfig();
}

/**
 * Returns true when SMTP credentials are configured.
 */
function smtp_enabled(): bool
{
    $cfg = smtp_config();
    return $cfg['user'] !== '' && $cfg['pass'] !== '';
}

/**
 * Envía email vía SMTP con autenticación STARTTLS.
 * Compatible con Gmail y cualquier servidor SMTP estándar.
 */
function smtp_send_mail(string $to, string $subject, string $body, bool $isHtml = false, array $attachments = []): bool
{
    $cfg = smtp_config();

    if ($cfg['user'] === '' || $cfg['pass'] === '') {
        error_log('Piel en Armonía: SMTP no configurado (PIELARMONIA_SMTP_USER / PIELARMONIA_SMTP_PASS)');
        return false;
    }

    // Verificar si PHPMailer está disponible
    if (!class_exists('PHPMailer\PHPMailer\PHPMailer')) {
        error_log('Piel en Armonía: PHPMailer no encontrado. Ejecuta "composer install".');
        return false;
    }

    $mail = new PHPMailer\PHPMailer\PHPMailer(true);

    try {
        // Configuración del servidor
        $mail->isSMTP();
        $mail->Host       = $cfg['host'];
        $mail->SMTPAuth   = true;
        $mail->Username   = $cfg['user'];
        $mail->Password   = $cfg['pass'];
        // STARTTLS explícito como en la implementación original (puerto 587)
        $mail->SMTPSecure = PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port       = $cfg['port'];
        $mail->CharSet    = 'UTF-8';

        // Remitente y destinatario
        $from = $cfg['from'] !== '' ? $cfg['from'] : $cfg['user'];
        $fromName = $cfg['from_name'];

        $mail->setFrom($from, $fromName);
        $mail->addAddress($to);

        // Contenido
        $mail->isHTML($isHtml);
        $mail->Subject = $subject;
        $mail->Body    = $body;
        if ($isHtml) {
            $mail->AltBody = trim(strip_tags($body));
        }

        foreach ($attachments as $attachment) {
            if (!is_array($attachment)) {
                continue;
            }
            $content = isset($attachment['content']) ? (string) $attachment['content'] : '';
            $name = isset($attachment['name']) ? (string) $attachment['name'] : '';
            if ($content === '' || $name === '') {
                continue;
            }
            $encoding = isset($attachment['encoding']) ? (string) $attachment['encoding'] : 'base64';
            $type = isset($attachment['type']) ? (string) $attachment['type'] : '';
            $mail->addStringAttachment($content, $name, $encoding, $type);
        }

        $mail->send();
        return true;

    } catch (PHPMailer\PHPMailer\Exception $e) {
        error_log("Piel en Armonía SMTP: Error al enviar - {$mail->ErrorInfo}");
        return false;
    } catch (Throwable $e) {
        error_log("Piel en Armonía SMTP: Excepción general - {$e->getMessage()}");
        return false;
    }
}

/**
 * Envía email usando SMTP si está configurado, o mail() como fallback.
 */
function send_mail(string $to, string $subject, string $body, bool $isHtml = false, array $attachments = []): bool
{
    if (smtp_enabled()) {
        return smtp_send_mail($to, $subject, $body, $isHtml, $attachments);
    }

    // Fallback a mail() nativo
    $from = AppConfig::getNoReplyEmail();
    $contentType = $isHtml ? 'text/html; charset=UTF-8' : 'text/plain; charset=UTF-8';
    $headers = "From: " . AppConfig::BRAND_NAME . " <{$from}>\r\nContent-Type: {$contentType}";

    $sent = @mail($to, $subject, $body, $headers);
    if (!$sent) {
        error_log('Piel en Armonia: fallo al enviar email (mail nativo) a ' . $to);
    }
    return $sent;
}

/**
 * Generates an ICS calendar payload for an appointment.
 *
 * @param array<string,mixed> $appointment
 */
function generate_ics_content(array $appointment): string
{
    $date = trim((string) ($appointment['date'] ?? ''));
    $time = trim((string) ($appointment['time'] ?? ''));
    if ($date === '' || $time === '') {
        return '';
    }

    $startTs = strtotime($date . ' ' . $time);
    if ($startTs === false) {
        return '';
    }

    $duration = isset($appointment['slotDurationMin']) ? (int) $appointment['slotDurationMin'] : 30;
    if ($duration <= 0) {
        $duration = 30;
    }

    $endTs = $startTs + ($duration * 60);
    $uid = 'pielarmonia-' . (string) ($appointment['id'] ?? bin2hex(random_bytes(8))) . '@pielarmonia.com';
    $serviceLabel = function_exists('get_service_label')
        ? get_service_label((string) ($appointment['service'] ?? 'consulta'))
        : (string) ($appointment['service'] ?? 'consulta');
    $doctorLabel = function_exists('get_doctor_label')
        ? get_doctor_label((string) ($appointment['doctor'] ?? ''))
        : (string) ($appointment['doctor'] ?? '');

    $summary = 'Cita ' . AppConfig::BRAND_NAME . ' - ' . $serviceLabel;
    $description = "Servicio: {$serviceLabel}\\nDoctor: {$doctorLabel}\\n";
    $location = AppConfig::ADDRESS;

    $lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Piel en Armonia//Citas//ES',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'BEGIN:VEVENT',
        'UID:' . $uid,
        'DTSTAMP:' . gmdate('Ymd\\THis\\Z'),
        'DTSTART;TZID=America/Guayaquil:' . date('Ymd\\THis', $startTs),
        'DTEND;TZID=America/Guayaquil:' . date('Ymd\\THis', $endTs),
        'SUMMARY:' . $summary,
        'DESCRIPTION:' . $description,
        'LOCATION:' . $location,
        'STATUS:CONFIRMED',
        'END:VEVENT',
        'END:VCALENDAR'
    ];

    return implode("\r\n", $lines) . "\r\n";
}

/**
 * Builds the HTML confirmation template for patient appointment emails.
 *
 * @param array<string,mixed> $appointment
 */
function build_appointment_email_html(array $appointment): string
{
    $name = htmlspecialchars((string) ($appointment['name'] ?? 'Paciente'), ENT_QUOTES, 'UTF-8');
    $serviceLabel = htmlspecialchars(
        function_exists('get_service_label') ? get_service_label((string) ($appointment['service'] ?? '')) : (string) ($appointment['service'] ?? ''),
        ENT_QUOTES,
        'UTF-8'
    );
    $doctorLabel = htmlspecialchars(
        function_exists('get_doctor_label') ? get_doctor_label((string) ($appointment['doctor'] ?? '')) : (string) ($appointment['doctor'] ?? ''),
        ENT_QUOTES,
        'UTF-8'
    );
    $dateLabel = htmlspecialchars(
        function_exists('format_date_label') ? format_date_label((string) ($appointment['date'] ?? '')) : (string) ($appointment['date'] ?? ''),
        ENT_QUOTES,
        'UTF-8'
    );
    $timeLabel = htmlspecialchars((string) ($appointment['time'] ?? ''), ENT_QUOTES, 'UTF-8');
    $token = trim((string) ($appointment['rescheduleToken'] ?? ''));
    $rescheduleUrl = $token !== ''
        ? AppConfig::BASE_URL . '/?reschedule=' . rawurlencode($token)
        : AppConfig::BASE_URL . '/#citas';

    $brandName = AppConfig::BRAND_NAME;
    $whatsapp = AppConfig::WHATSAPP_NUMBER;

    return '<!doctype html><html><body style="font-family:Arial,sans-serif;background:#f5f8fc;padding:24px;">'
        . '<div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #dde7f5;border-radius:12px;padding:24px;">'
        . '<h2 style="margin:0 0 12px;color:#0a84ff;">' . $brandName . ' - Cita confirmada</h2>'
        . '<p>Hola <strong>' . $name . '</strong>, tu cita fue registrada correctamente.</p>'
        . '<table style="width:100%;border-collapse:collapse;margin:16px 0;">'
        . '<tr><td style="padding:8px 0;color:#5a6d85;">Servicio</td><td style="padding:8px 0;"><strong>' . $serviceLabel . '</strong></td></tr>'
        . '<tr><td style="padding:8px 0;color:#5a6d85;">Doctor</td><td style="padding:8px 0;"><strong>' . $doctorLabel . '</strong></td></tr>'
        . '<tr><td style="padding:8px 0;color:#5a6d85;">Fecha</td><td style="padding:8px 0;"><strong>' . $dateLabel . '</strong></td></tr>'
        . '<tr><td style="padding:8px 0;color:#5a6d85;">Hora</td><td style="padding:8px 0;"><strong>' . $timeLabel . '</strong></td></tr>'
        . '</table>'
        . '<p>Adjuntamos un archivo de calendario (.ics) para agregar tu cita a Google Calendar, Apple Calendar u Outlook.</p>'
        . '<p><a href="' . htmlspecialchars($rescheduleUrl, ENT_QUOTES, 'UTF-8') . '" style="display:inline-block;background:#0a84ff;color:#fff;text-decoration:none;padding:10px 14px;border-radius:8px;">Reprogramar cita</a></p>'
        . '<p style="font-size:13px;color:#5a6d85;">Si tienes dudas, responde este correo o escribe por WhatsApp: ' . $whatsapp . '.</p>'
        . '</div></body></html>';
}

/**
 * Sends patient confirmation email and optional ICS attachment.
 *
 * @param array<string,mixed> $appointment
 */
function maybe_send_appointment_email(array $appointment): bool
{
    $to = trim((string) ($appointment['email'] ?? ''));
    if ($to === '' || !filter_var($to, FILTER_VALIDATE_EMAIL)) {
        return false;
    }

    $clinicName = AppConfig::BRAND_NAME;
    $subject = 'Confirmacion de cita - ' . $clinicName;
    $htmlBody = build_appointment_email_html($appointment);
    $icsContent = generate_ics_content($appointment);
    $attachments = [];
    if ($icsContent !== '') {
        $attachments[] = [
            'content' => $icsContent,
            'name' => 'cita-pielarmonia.ics',
            'type' => 'text/calendar; charset=utf-8; method=PUBLISH',
            'encoding' => 'base64'
        ];
    }

    return send_mail($to, $subject, $htmlBody, true, $attachments);
}

/**
 * Sends a plain-text admin notification when a new appointment is created.
 *
 * @param array<string,mixed> $appointment
 */
function maybe_send_admin_notification(array $appointment): bool
{
    $adminEmail = AppConfig::getAdminEmail();
    if (!filter_var($adminEmail, FILTER_VALIDATE_EMAIL)) {
        error_log('Piel en Armonía: PIELARMONIA_ADMIN_EMAIL invalido');
        return false;
    }

    $serviceLabel = function_exists('get_service_label') ? get_service_label((string)($appointment['service'] ?? '')) : ($appointment['service'] ?? '-');
    $doctorLabel = function_exists('get_doctor_label') ? get_doctor_label((string)($appointment['doctor'] ?? '')) : ($appointment['doctor'] ?? '-');

    $clinicName = AppConfig::BRAND_NAME;
    $subject = 'Nueva cita agendada - ' . $clinicName;
    $body = "Se ha agendado una nueva cita:\n\n";
    $body .= "Paciente: " . ($appointment['name'] ?? '-') . "\n";
    $body .= "Email: " . ($appointment['email'] ?? '-') . "\n";
    $body .= "Telefono: " . ($appointment['phone'] ?? '-') . "\n";
    $body .= "Motivo: " . ($appointment['reason'] ?? '-') . "\n";
    $body .= "Zona: " . ($appointment['affectedArea'] ?? '-') . "\n";
    $body .= "Evolucion: " . ($appointment['evolutionTime'] ?? '-') . "\n";
    $body .= "Consentimiento datos: " . ((isset($appointment['privacyConsent']) && $appointment['privacyConsent']) ? 'si' : 'no') . "\n";
    $body .= "Servicio: " . $serviceLabel . "\n";
    $body .= "Doctor: " . $doctorLabel . "\n";
    $body .= "Fecha: " . ($appointment['date'] ?? '-') . "\n";
    $body .= "Hora: " . ($appointment['time'] ?? '-') . "\n";
    $body .= "Precio: " . ($appointment['price'] ?? '-') . "\n";
    $body .= "Metodo de pago: " . ($appointment['paymentMethod'] ?? '-') . "\n";
    $body .= "Estado de pago: " . ($appointment['paymentStatus'] ?? '-') . "\n";
    $body .= "Fotos adjuntas: " . (int) ($appointment['casePhotoCount'] ?? 0) . "\n";
    if (isset($appointment['casePhotoUrls']) && is_array($appointment['casePhotoUrls']) && count($appointment['casePhotoUrls']) > 0) {
        $body .= "URLs de fotos:\n";
        foreach ($appointment['casePhotoUrls'] as $photoUrl) {
            $url = trim((string) $photoUrl);
            if ($url !== '') {
                $body .= "- " . $url . "\n";
            }
        }
    }
    $body .= "\nFecha de registro: " . local_date('d/m/Y H:i') . "\n";

    return send_mail($adminEmail, $subject, $body);
}

/**
 * Sends patient cancellation confirmation email.
 *
 * @param array<string,mixed> $appointment
 */
function maybe_send_cancellation_email(array $appointment): bool
{
    $to = trim((string) ($appointment['email'] ?? ''));
    if ($to === '' || !filter_var($to, FILTER_VALIDATE_EMAIL)) {
        return false;
    }

    $serviceLabel = function_exists('get_service_label') ? get_service_label((string)($appointment['service'] ?? '')) : ($appointment['service'] ?? '-');
    $doctorLabel = function_exists('get_doctor_label') ? get_doctor_label((string)($appointment['doctor'] ?? '')) : ($appointment['doctor'] ?? '-');
    $dateLabel = function_exists('format_date_label') ? format_date_label((string)($appointment['date'] ?? '')) : ($appointment['date'] ?? '-');

    $clinicName = AppConfig::BRAND_NAME;
    $subject = 'Cita cancelada - ' . $clinicName;
    $message = "Hola " . ($appointment['name'] ?? 'paciente') . ",\n\n";
    $message .= "Tu cita ha sido cancelada.\n\n";
    $message .= "Detalles de la cita cancelada:\n";
    $message .= "Servicio: " . $serviceLabel . "\n";
    $message .= "Doctor: " . $doctorLabel . "\n";
    $message .= "Fecha: " . $dateLabel . "\n";
    $message .= "Hora: " . ($appointment['time'] ?? '-') . "\n\n";
    $message .= "Si deseas reprogramar, visita " . AppConfig::BASE_URL . "/#citas o escribenos por WhatsApp: " . AppConfig::WHATSAPP_NUMBER . ".\n\n";
    $message .= "Gracias por confiar en nosotros.";

    return send_mail($to, $subject, $message);
}

/**
 * Sends callback-request notification to admin email.
 *
 * @param array<string,mixed> $callback
 */
function maybe_send_callback_admin_notification(array $callback): bool
{
    $adminEmail = AppConfig::getAdminEmail();
    if (!filter_var($adminEmail, FILTER_VALIDATE_EMAIL)) {
        return false;
    }

    $clinicName = AppConfig::BRAND_NAME;
    $subject = 'Nueva solicitud de llamada - ' . $clinicName;
    $body = "Un paciente solicita que le llamen:\n\n";
    $body .= "Teléfono: " . ($callback['telefono'] ?? '-') . "\n";
    $body .= "Preferencia: " . ($callback['preferencia'] ?? '-') . "\n";
    $body .= "Fecha de solicitud: " . local_date('d/m/Y H:i') . "\n\n";
    $body .= "Por favor contactar lo antes posible.";

    return send_mail($adminEmail, $subject, $body);
}

/**
 * Sends appointment reminder email to the patient.
 *
 * @param array<string,mixed> $appointment
 */
function maybe_send_reminder_email(array $appointment): bool
{
    $to = trim((string) ($appointment['email'] ?? ''));
    if ($to === '' || !filter_var($to, FILTER_VALIDATE_EMAIL)) {
        return false;
    }

    $serviceLabel = function_exists('get_service_label') ? get_service_label((string)($appointment['service'] ?? '')) : ($appointment['service'] ?? '-');
    $doctorLabel = function_exists('get_doctor_label') ? get_doctor_label((string)($appointment['doctor'] ?? '')) : ($appointment['doctor'] ?? '-');
    $dateLabel = function_exists('format_date_label') ? format_date_label((string)($appointment['date'] ?? '')) : ($appointment['date'] ?? '-');

    $clinicName = AppConfig::BRAND_NAME;
    $subject = 'Recordatorio de cita - ' . $clinicName;
    $body = "Hola " . ($appointment['name'] ?? 'paciente') . ",\n\n";
    $body .= "Te recordamos que tienes una cita programada para mañana.\n\n";
    $body .= "Servicio: " . $serviceLabel . "\n";
    $body .= "Doctor: " . $doctorLabel . "\n";
    $body .= "Fecha: " . $dateLabel . "\n";
    $body .= "Hora: " . ($appointment['time'] ?? '-') . "\n\n";

    $token = $appointment['rescheduleToken'] ?? '';
    if ($token !== '') {
        $body .= "Si necesitas reprogramar, usa este enlace:\n";
        $body .= AppConfig::BASE_URL . "/?reschedule=" . $token . "\n\n";
    }

    $body .= "Te esperamos. ¡Gracias por confiar en nosotros!\n";
    $body .= "- Equipo " . $clinicName . "\n";
    $body .= "WhatsApp: " . AppConfig::WHATSAPP_NUMBER;

    return send_mail($to, $subject, $body);
}

/**
 * Sends patient notification after an appointment is rescheduled.
 *
 * @param array<string,mixed> $appointment
 */
function maybe_send_reschedule_email(array $appointment): bool
{
    $to = trim((string) ($appointment['email'] ?? ''));
    if ($to === '' || !filter_var($to, FILTER_VALIDATE_EMAIL)) {
        return false;
    }

    $serviceLabel = function_exists('get_service_label') ? get_service_label((string)($appointment['service'] ?? '')) : ($appointment['service'] ?? '-');
    $doctorLabel = function_exists('get_doctor_label') ? get_doctor_label((string)($appointment['doctor'] ?? '')) : ($appointment['doctor'] ?? '-');
    $dateLabel = function_exists('format_date_label') ? format_date_label((string)($appointment['date'] ?? '')) : ($appointment['date'] ?? '-');

    $clinicName = AppConfig::BRAND_NAME;
    $subject = 'Cita reprogramada - ' . $clinicName;
    $body = "Hola " . ($appointment['name'] ?? 'paciente') . ",\n\n";
    $body .= "Tu cita ha sido reprogramada exitosamente.\n\n";
    $body .= "Servicio: " . $serviceLabel . "\n";
    $body .= "Doctor: " . $doctorLabel . "\n";
    $body .= "Nueva fecha: " . $dateLabel . "\n";
    $body .= "Nueva hora: " . ($appointment['time'] ?? '-') . "\n\n";

    $token = $appointment['rescheduleToken'] ?? '';
    if ($token !== '') {
        $body .= "Si necesitas reprogramar de nuevo:\n";
        $body .= AppConfig::BASE_URL . "/?reschedule=" . $token . "\n\n";
    }

    $body .= "Te esperamos. ¡Gracias por confiar en nosotros!\n";
    $body .= "- Equipo " . $clinicName;

    return send_mail($to, $subject, $body);
}

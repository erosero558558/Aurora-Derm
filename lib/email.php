<?php

declare(strict_types=1);

require_once __DIR__ . '/common.php';
require_once __DIR__ . '/models.php';

/**
 * Email sending logic.
 */

function smtp_config(): array
{
    return [
        'host' => (string) (getenv('PIELARMONIA_SMTP_HOST') ?: 'smtp.gmail.com'),
        'port' => (int) (getenv('PIELARMONIA_SMTP_PORT') ?: 587),
        'user' => (string) (getenv('PIELARMONIA_SMTP_USER') ?: ''),
        'pass' => (string) (getenv('PIELARMONIA_SMTP_PASS') ?: ''),
        'from' => (string) (getenv('PIELARMONIA_EMAIL_FROM') ?: ''),
        'from_name' => 'Piel en Armonía',
    ];
}

function smtp_enabled(): bool
{
    $cfg = smtp_config();
    return $cfg['user'] !== '' && $cfg['pass'] !== '';
}

/**
 * Envía email vía SMTP con autenticación STARTTLS.
 * Compatible con Gmail y cualquier servidor SMTP estándar.
 */
function smtp_send_mail(string $to, string $subject, string $body, bool $isHtml = false, array $attachments = [], string $altBody = ''): bool
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
            $mail->AltBody = $altBody !== '' ? $altBody : trim(strip_tags($body));
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
function send_mail(string $to, string $subject, string $body, bool $isHtml = false, array $attachments = [], string $altBody = ''): bool
{
    if (smtp_enabled()) {
        return smtp_send_mail($to, $subject, $body, $isHtml, $attachments, $altBody);
    }

    // Fallback a mail() nativo
    $from = getenv('PIELARMONIA_EMAIL_FROM');
    if (!is_string($from) || $from === '') {
        $from = 'no-reply@pielarmonia.com';
    }
    $contentType = $isHtml ? 'text/html; charset=UTF-8' : 'text/plain; charset=UTF-8';
    $headers = "From: Piel en Armonia <{$from}>\r\nContent-Type: {$contentType}";

    $sent = @mail($to, $subject, $body, $headers);
    if (!$sent) {
        error_log('Piel en Armonia: fallo al enviar email (mail nativo) a ' . $to);
    }
    return $sent;
}

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

    $summary = 'Cita Piel en Armonia - ' . $serviceLabel;
    $description = "Servicio: {$serviceLabel}\\nDoctor: {$doctorLabel}\\n";
    $location = 'Valparaiso 13-183 y Sodiro, Quito, Ecuador';

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

function get_email_template(string $title, string $content, string $preheader = ''): string
{
    $preheaderHtml = $preheader !== ''
        ? '<div style="display:none;font-size:1px;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;mso-hide:all;font-family: sans-serif;">' . $preheader . '</div>'
        : '';

    return '<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>' . $title . '</title>
    <style>
        @media screen and (max-width: 600px) {
            .container {
                width: 100% !important;
            }
            .content-padding {
                padding: 20px !important;
            }
        }
    </style>
</head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background-color:#f5f8fc;color:#333333;">
    ' . $preheaderHtml . '
    <table role="presentation" style="width:100%;border-collapse:collapse;background-color:#f5f8fc;">
        <tr>
            <td align="center" style="padding:40px 0;">
                <table class="container" role="presentation" style="width:100%;max-width:600px;border-collapse:collapse;text-align:left;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);margin:0 auto;">
                    <!-- Header -->
                    <tr>
                        <td style="padding:30px 40px;background-color:#0d1a2f;text-align:center;">
                            <h1 style="margin:0;font-size:24px;color:#ffffff;font-weight:bold;letter-spacing:1px;text-transform:uppercase;">Piel en Armonía</h1>
                        </td>
                    </tr>
                    <!-- Body -->
                    <tr>
                        <td class="content-padding" style="padding:40px;">
                            ' . $content . '
                        </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                        <td style="padding:30px 40px;background-color:#f0f4f8;border-top:1px solid #e1e8ed;text-align:center;">
                            <p style="margin:0 0 10px;font-size:14px;color:#5a6d85;">
                                <strong>Piel en Armonía</strong><br>
                                Valparaíso 13-183 y Sodiro, Quito, Ecuador
                            </p>
                            <p style="margin:0 0 10px;font-size:14px;color:#5a6d85;">
                                <a href="https://wa.me/593982453672" style="color:#0284c7;text-decoration:none;">WhatsApp: +593 98 245 3672</a>
                            </p>
                            <p style="margin:0;font-size:12px;color:#8b9bb4;">
                                &copy; ' . date('Y') . ' Piel en Armonía. Todos los derechos reservados.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>';
}

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
        ? 'https://pielarmonia.com/?reschedule=' . rawurlencode($token)
        : 'https://pielarmonia.com/#citas';

    $content = '<h2 style="margin:0 0 20px;color:#0d1a2f;font-size:20px;">Cita Confirmada</h2>'
        . '<p style="margin:0 0 15px;line-height:1.6;color:#555;">Hola <strong>' . $name . '</strong>,</p>'
        . '<p style="margin:0 0 20px;line-height:1.6;color:#555;">Tu cita ha sido registrada exitosamente. Aquí tienes los detalles:</p>'
        . '<table style="width:100%;border-collapse:separate;border-spacing:0;background-color:#f8fafc;border-radius:8px;padding:15px;margin-bottom:25px;">'
        . '<tr><td style="padding:8px 0;color:#64748b;font-weight:bold;width:120px;">Servicio:</td><td style="padding:8px 0;color:#334155;">' . $serviceLabel . '</td></tr>'
        . '<tr><td style="padding:8px 0;color:#64748b;font-weight:bold;">Doctor:</td><td style="padding:8px 0;color:#334155;">' . $doctorLabel . '</td></tr>'
        . '<tr><td style="padding:8px 0;color:#64748b;font-weight:bold;">Fecha:</td><td style="padding:8px 0;color:#334155;">' . $dateLabel . '</td></tr>'
        . '<tr><td style="padding:8px 0;color:#64748b;font-weight:bold;">Hora:</td><td style="padding:8px 0;color:#334155;">' . $timeLabel . '</td></tr>'
        . '</table>'
        . '<p style="margin:0 0 25px;line-height:1.6;color:#555;">Adjuntamos un archivo de calendario (.ics) para que puedas agregar esta cita a tu agenda.</p>'
        . '<div style="text-align:center;margin-bottom:30px;">'
        . '<a href="' . htmlspecialchars($rescheduleUrl, ENT_QUOTES, 'UTF-8') . '" style="display:inline-block;background-color:#0284c7;color:#ffffff;text-decoration:none;padding:12px 25px;border-radius:6px;font-weight:bold;transition:background-color 0.3s;">Reprogramar Cita</a>'
        . '</div>'
        . '<p style="margin:0;font-size:13px;color:#94a3b8;text-align:center;">Si necesitas ayuda, responde a este correo.</p>';

    return get_email_template('Confirmación de Cita', $content, 'Tu cita ha sido confirmada para el ' . $dateLabel);
}

function build_appointment_email_text(array $appointment): string
{
    $name = (string) ($appointment['name'] ?? 'Paciente');
    $serviceLabel = function_exists('get_service_label') ? get_service_label((string) ($appointment['service'] ?? '')) : (string) ($appointment['service'] ?? '');
    $doctorLabel = function_exists('get_doctor_label') ? get_doctor_label((string) ($appointment['doctor'] ?? '')) : (string) ($appointment['doctor'] ?? '');
    $dateLabel = function_exists('format_date_label') ? format_date_label((string) ($appointment['date'] ?? '')) : (string) ($appointment['date'] ?? '');
    $timeLabel = (string) ($appointment['time'] ?? '');
    $token = trim((string) ($appointment['rescheduleToken'] ?? ''));
    $rescheduleUrl = $token !== ''
        ? 'https://pielarmonia.com/?reschedule=' . rawurlencode($token)
        : 'https://pielarmonia.com/#citas';

    $body = "Hola " . $name . ",\n\n";
    $body .= "Tu cita ha sido registrada exitosamente.\n\n";
    $body .= "Detalles:\n";
    $body .= "Servicio: " . $serviceLabel . "\n";
    $body .= "Doctor: " . $doctorLabel . "\n";
    $body .= "Fecha: " . $dateLabel . "\n";
    $body .= "Hora: " . $timeLabel . "\n\n";
    $body .= "Adjuntamos un archivo de calendario (.ics) para que puedas agregar esta cita a tu agenda.\n\n";
    $body .= "Si deseas reprogramar, visita: " . $rescheduleUrl . "\n\n";
    $body .= "Si tienes dudas, responde este correo o escribe por WhatsApp: +593 98 245 3672.\n\n";
    $body .= "Piel en Armonía\nValparaíso 13-183 y Sodiro, Quito";

    return $body;
}

function build_reminder_email_html(array $appointment): string
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
        ? 'https://pielarmonia.com/?reschedule=' . rawurlencode($token)
        : 'https://pielarmonia.com/#citas';

    $content = '<h2 style="margin:0 0 20px;color:#0d1a2f;font-size:20px;">Recordatorio de Cita</h2>'
        . '<p style="margin:0 0 15px;line-height:1.6;color:#555;">Hola <strong>' . $name . '</strong>,</p>'
        . '<p style="margin:0 0 20px;line-height:1.6;color:#555;">Te recordamos que tienes una cita programada para mañana. ¡Te esperamos!</p>'
        . '<table style="width:100%;border-collapse:separate;border-spacing:0;background-color:#f8fafc;border-radius:8px;padding:15px;margin-bottom:25px;">'
        . '<tr><td style="padding:8px 0;color:#64748b;font-weight:bold;width:120px;">Servicio:</td><td style="padding:8px 0;color:#334155;">' . $serviceLabel . '</td></tr>'
        . '<tr><td style="padding:8px 0;color:#64748b;font-weight:bold;">Doctor:</td><td style="padding:8px 0;color:#334155;">' . $doctorLabel . '</td></tr>'
        . '<tr><td style="padding:8px 0;color:#64748b;font-weight:bold;">Fecha:</td><td style="padding:8px 0;color:#334155;">' . $dateLabel . '</td></tr>'
        . '<tr><td style="padding:8px 0;color:#64748b;font-weight:bold;">Hora:</td><td style="padding:8px 0;color:#334155;">' . $timeLabel . '</td></tr>'
        . '</table>'
        . '<div style="text-align:center;margin-bottom:30px;">'
        . '<a href="' . htmlspecialchars($rescheduleUrl, ENT_QUOTES, 'UTF-8') . '" style="display:inline-block;background-color:#0284c7;color:#ffffff;text-decoration:none;padding:12px 25px;border-radius:6px;font-weight:bold;transition:background-color 0.3s;">Reprogramar Cita</a>'
        . '</div>'
        . '<p style="margin:0;font-size:13px;color:#94a3b8;text-align:center;">Nos vemos pronto.</p>';

    return get_email_template('Recordatorio de Cita', $content, 'Tu cita es mañana a las ' . $timeLabel);
}

function build_reminder_email_text(array $appointment): string
{
    $name = (string) ($appointment['name'] ?? 'Paciente');
    $serviceLabel = function_exists('get_service_label') ? get_service_label((string) ($appointment['service'] ?? '')) : (string) ($appointment['service'] ?? '');
    $doctorLabel = function_exists('get_doctor_label') ? get_doctor_label((string) ($appointment['doctor'] ?? '')) : (string) ($appointment['doctor'] ?? '');
    $dateLabel = function_exists('format_date_label') ? format_date_label((string) ($appointment['date'] ?? '')) : (string) ($appointment['date'] ?? '');
    $timeLabel = (string) ($appointment['time'] ?? '');
    $token = trim((string) ($appointment['rescheduleToken'] ?? ''));
    $rescheduleUrl = $token !== ''
        ? 'https://pielarmonia.com/?reschedule=' . rawurlencode($token)
        : 'https://pielarmonia.com/#citas';

    $body = "Hola " . $name . ",\n\n";
    $body .= "Te recordamos que tienes una cita programada para mañana.\n\n";
    $body .= "Servicio: " . $serviceLabel . "\n";
    $body .= "Doctor: " . $doctorLabel . "\n";
    $body .= "Fecha: " . $dateLabel . "\n";
    $body .= "Hora: " . $timeLabel . "\n\n";
    if ($token !== '') {
        $body .= "Si necesitas reprogramar, usa este enlace:\n" . $rescheduleUrl . "\n\n";
    }
    $body .= "Te esperamos. ¡Gracias por confiar en nosotros!\n\n";
    $body .= "- Equipo Piel en Armonía\n";
    $body .= "WhatsApp: +593 98 245 3672";

    return $body;
}

function build_cancellation_email_html(array $appointment): string
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

    $content = '<h2 style="margin:0 0 20px;color:#ef4444;font-size:20px;">Cita Cancelada</h2>'
        . '<p style="margin:0 0 15px;line-height:1.6;color:#555;">Hola <strong>' . $name . '</strong>,</p>'
        . '<p style="margin:0 0 20px;line-height:1.6;color:#555;">Tu cita ha sido cancelada.</p>'
        . '<table style="width:100%;border-collapse:separate;border-spacing:0;background-color:#fef2f2;border-radius:8px;padding:15px;margin-bottom:25px;">'
        . '<tr><td style="padding:8px 0;color:#991b1b;font-weight:bold;width:120px;">Servicio:</td><td style="padding:8px 0;color:#7f1d1d;">' . $serviceLabel . '</td></tr>'
        . '<tr><td style="padding:8px 0;color:#991b1b;font-weight:bold;">Doctor:</td><td style="padding:8px 0;color:#7f1d1d;">' . $doctorLabel . '</td></tr>'
        . '<tr><td style="padding:8px 0;color:#991b1b;font-weight:bold;">Fecha:</td><td style="padding:8px 0;color:#7f1d1d;">' . $dateLabel . '</td></tr>'
        . '<tr><td style="padding:8px 0;color:#991b1b;font-weight:bold;">Hora:</td><td style="padding:8px 0;color:#7f1d1d;">' . $timeLabel . '</td></tr>'
        . '</table>'
        . '<p style="margin:0 0 25px;line-height:1.6;color:#555;">Si deseas agendar una nueva cita, puedes hacerlo en nuestro sitio web o contactarnos por WhatsApp.</p>'
        . '<div style="text-align:center;margin-bottom:30px;">'
        . '<a href="https://pielarmonia.com/#citas" style="display:inline-block;background-color:#0284c7;color:#ffffff;text-decoration:none;padding:12px 25px;border-radius:6px;font-weight:bold;transition:background-color 0.3s;">Agendar Nueva Cita</a>'
        . '</div>';

    return get_email_template('Cita Cancelada', $content, 'Tu cita ha sido cancelada');
}

function build_cancellation_email_text(array $appointment): string
{
    $name = (string) ($appointment['name'] ?? 'Paciente');
    $serviceLabel = function_exists('get_service_label') ? get_service_label((string) ($appointment['service'] ?? '')) : (string) ($appointment['service'] ?? '');
    $doctorLabel = function_exists('get_doctor_label') ? get_doctor_label((string) ($appointment['doctor'] ?? '')) : (string) ($appointment['doctor'] ?? '');
    $dateLabel = function_exists('format_date_label') ? format_date_label((string) ($appointment['date'] ?? '')) : (string) ($appointment['date'] ?? '');
    $timeLabel = (string) ($appointment['time'] ?? '');

    $body = "Hola " . $name . ",\n\n";
    $body .= "Tu cita ha sido cancelada.\n\n";
    $body .= "Detalles de la cita cancelada:\n";
    $body .= "Servicio: " . $serviceLabel . "\n";
    $body .= "Doctor: " . $doctorLabel . "\n";
    $body .= "Fecha: " . $dateLabel . "\n";
    $body .= "Hora: " . $timeLabel . "\n\n";
    $body .= "Si deseas reprogramar, visita https://pielarmonia.com/#citas o escríbenos por WhatsApp: +593 98 245 3672.\n\n";
    $body .= "Gracias por confiar en nosotros.\n\n";
    $body .= "- Equipo Piel en Armonía";

    return $body;
}

function maybe_send_appointment_email(array $appointment): bool
{
    $to = trim((string) ($appointment['email'] ?? ''));
    if ($to === '' || !filter_var($to, FILTER_VALIDATE_EMAIL)) {
        return false;
    }

    $clinicName = 'Piel en Armonia';
    $subject = 'Confirmacion de cita - ' . $clinicName;
    $htmlBody = build_appointment_email_html($appointment);
    $textBody = build_appointment_email_text($appointment);
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

    return send_mail($to, $subject, $htmlBody, true, $attachments, $textBody);
}

function maybe_send_admin_notification(array $appointment): bool
{
    $adminEmail = getenv('PIELARMONIA_ADMIN_EMAIL');
    if (!is_string($adminEmail) || trim($adminEmail) === '') {
        $adminEmail = 'javier.rosero94@gmail.com';
    }
    $adminEmail = trim((string) $adminEmail);
    if (!filter_var($adminEmail, FILTER_VALIDATE_EMAIL)) {
        error_log('Piel en Armonía: PIELARMONIA_ADMIN_EMAIL invalido');
        return false;
    }

    $serviceLabel = function_exists('get_service_label') ? get_service_label((string)($appointment['service'] ?? '')) : ($appointment['service'] ?? '-');
    $doctorLabel = function_exists('get_doctor_label') ? get_doctor_label((string)($appointment['doctor'] ?? '')) : ($appointment['doctor'] ?? '-');

    $clinicName = 'Piel en Armonía';
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

function maybe_send_cancellation_email(array $appointment): bool
{
    $to = trim((string) ($appointment['email'] ?? ''));
    if ($to === '' || !filter_var($to, FILTER_VALIDATE_EMAIL)) {
        return false;
    }

    $clinicName = 'Piel en Armonía';
    $subject = 'Cita cancelada - ' . $clinicName;
    $htmlBody = build_cancellation_email_html($appointment);
    $textBody = build_cancellation_email_text($appointment);

    return send_mail($to, $subject, $htmlBody, true, [], $textBody);
}

function maybe_send_callback_admin_notification(array $callback): bool
{
    $adminEmail = getenv('PIELARMONIA_ADMIN_EMAIL');
    if (!is_string($adminEmail) || $adminEmail === '') {
        return false;
    }
    if (!filter_var($adminEmail, FILTER_VALIDATE_EMAIL)) {
        return false;
    }

    $clinicName = 'Piel en Armonía';
    $subject = 'Nueva solicitud de llamada - ' . $clinicName;
    $body = "Un paciente solicita que le llamen:\n\n";
    $body .= "Teléfono: " . ($callback['telefono'] ?? '-') . "\n";
    $body .= "Preferencia: " . ($callback['preferencia'] ?? '-') . "\n";
    $body .= "Fecha de solicitud: " . local_date('d/m/Y H:i') . "\n\n";
    $body .= "Por favor contactar lo antes posible.";

    return send_mail($adminEmail, $subject, $body);
}

function maybe_send_reminder_email(array $appointment): bool
{
    $to = trim((string) ($appointment['email'] ?? ''));
    if ($to === '' || !filter_var($to, FILTER_VALIDATE_EMAIL)) {
        return false;
    }

    $clinicName = 'Piel en Armonía';
    $subject = 'Recordatorio de cita - ' . $clinicName;
    $htmlBody = build_reminder_email_html($appointment);
    $textBody = build_reminder_email_text($appointment);

    return send_mail($to, $subject, $htmlBody, true, [], $textBody);
}

function maybe_send_reschedule_email(array $appointment): bool
{
    $to = trim((string) ($appointment['email'] ?? ''));
    if ($to === '' || !filter_var($to, FILTER_VALIDATE_EMAIL)) {
        return false;
    }

    $serviceLabel = function_exists('get_service_label') ? get_service_label((string)($appointment['service'] ?? '')) : ($appointment['service'] ?? '-');
    $doctorLabel = function_exists('get_doctor_label') ? get_doctor_label((string)($appointment['doctor'] ?? '')) : ($appointment['doctor'] ?? '-');
    $dateLabel = function_exists('format_date_label') ? format_date_label((string)($appointment['date'] ?? '')) : ($appointment['date'] ?? '-');

    $clinicName = 'Piel en Armonía';
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
        $body .= "https://pielarmonia.com/?reschedule=" . $token . "\n\n";
    }

    $body .= "Te esperamos. ¡Gracias por confiar en nosotros!\n";
    $body .= "- Equipo Piel en Armonía";

    return send_mail($to, $subject, $body);
}


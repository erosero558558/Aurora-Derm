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

    if (defined('TESTING_ENV') && TESTING_ENV === true) {
        $GLOBALS['__TEST_EMAIL_OUTBOX'][] = [
            'to' => $to,
            'subject' => $subject,
            'isHtml' => $isHtml,
            'attachmentsCount' => count($attachments),
            'altBody' => $altBody,
        ];
        return false;
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

function get_email_template(string $title, string $content, string $preheader = ''): string
{
    $preheaderHtml = $preheader !== ''
        ? '<div style="display:none;font-size:1px;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;mso-hide:all;font-family: sans-serif;">' . $preheader . '</div>'
        : '';

    $brandName = AppConfig::BRAND_NAME;
    $address = AppConfig::ADDRESS;
    $whatsapp = AppConfig::WHATSAPP_NUMBER;

    return '<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>' . $title . '</title>
    <style>
        @media screen and (max-width: 600px) {
            .container { width: 100% !important; }
            .content-padding { padding: 20px !important; }
        }
    </style>
</head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background-color:#f5f8fc;color:#333333;">
    ' . $preheaderHtml . '
    <table role="presentation" style="width:100%;border-collapse:collapse;background-color:#f5f8fc;">
        <tr>
            <td align="center" style="padding:40px 0;">
                <table class="container" role="presentation" style="width:100%;max-width:600px;border-collapse:collapse;text-align:left;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);margin:0 auto;">
                    <tr>
                        <td style="padding:30px 40px;background-color:#0d1a2f;text-align:center;">
                            <h1 style="margin:0;font-size:24px;color:#ffffff;font-weight:bold;letter-spacing:1px;text-transform:uppercase;">' . htmlspecialchars($brandName, ENT_QUOTES, 'UTF-8') . '</h1>
                        </td>
                    </tr>
                    <tr>
                        <td class="content-padding" style="padding:40px;">
                            ' . $content . '
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:30px 40px;background-color:#f0f4f8;border-top:1px solid #e1e8ed;text-align:center;">
                            <p style="margin:0 0 10px;font-size:14px;color:#5a6d85;">
                                <strong>' . htmlspecialchars($brandName, ENT_QUOTES, 'UTF-8') . '</strong><br>
                                ' . htmlspecialchars($address, ENT_QUOTES, 'UTF-8') . '
                            </p>
                            <p style="margin:0 0 10px;font-size:14px;color:#5a6d85;">
                                <a href="https://wa.me/' . preg_replace('/[^0-9]/', '', $whatsapp) . '" style="color:#0284c7;text-decoration:none;">WhatsApp: ' . htmlspecialchars($whatsapp, ENT_QUOTES, 'UTF-8') . '</a>
                            </p>
                            <p style="margin:0;font-size:12px;color:#8b9bb4;">
                                &copy; ' . date('Y') . ' ' . htmlspecialchars($brandName, ENT_QUOTES, 'UTF-8') . '. Todos los derechos reservados.
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

/**
 * Normalizes a recipient email address and returns an empty string when invalid.
 */
function email_recipient_or_empty(string $email): string
{
    $recipient = trim($email);
    if ($recipient === '' || !filter_var($recipient, FILTER_VALIDATE_EMAIL)) {
        return '';
    }

    return $recipient;
}

/**
 * Builds a subject line that keeps the clinic branding consistent.
 */
function build_email_subject(string $subject): string
{
    return $subject . ' - ' . AppConfig::BRAND_NAME;
}

/**
 * Sends mail only when the recipient address is valid.
 */
function send_mail_to_recipient(string $recipient, string $subject, string $body, bool $isHtml = false, array $attachments = [], string $altBody = ''): bool
{
    $to = email_recipient_or_empty($recipient);
    if ($to === '') {
        return false;
    }

    return send_mail($to, $subject, $body, $isHtml, $attachments, $altBody);
}

/**
 * Builds shared appointment email context values.
 *
 * @param array<string,mixed> $appointment
 * @return array{name:string,serviceLabel:string,doctorLabel:string,dateLabel:string,timeLabel:string,rescheduleToken:string,rescheduleUrl:string}
 */
function build_appointment_email_context(array $appointment): array
{
    $serviceLabel = function_exists('get_service_label')
        ? get_service_label((string) ($appointment['service'] ?? ''))
        : (string) ($appointment['service'] ?? '');
    $doctorLabel = function_exists('get_doctor_label')
        ? get_doctor_label((string) ($appointment['doctor'] ?? ''))
        : (string) ($appointment['doctor'] ?? '');
    $dateLabel = function_exists('format_date_label')
        ? format_date_label((string) ($appointment['date'] ?? ''))
        : (string) ($appointment['date'] ?? '');
    $rescheduleToken = trim((string) ($appointment['rescheduleToken'] ?? ''));

    return [
        'name' => (string) ($appointment['name'] ?? 'Paciente'),
        'serviceLabel' => $serviceLabel,
        'doctorLabel' => $doctorLabel,
        'dateLabel' => $dateLabel,
        'timeLabel' => (string) ($appointment['time'] ?? ''),
        'rescheduleToken' => $rescheduleToken,
        'rescheduleUrl' => $rescheduleToken !== ''
            ? AppConfig::BASE_URL . '/?reschedule=' . rawurlencode($rescheduleToken)
            : AppConfig::BASE_URL . '/#citas',
    ];
}

/**
 * Builds table rows for appointment detail blocks.
 *
 * @param array<int,array{label:string,value:string}> $rows
 */
function build_email_detail_rows(array $rows, string $labelStyle, string $valueStyle): string
{
    $html = '';

    foreach ($rows as $row) {
        if (!is_array($row)) {
            continue;
        }

        $label = htmlspecialchars((string) ($row['label'] ?? ''), ENT_QUOTES, 'UTF-8');
        $value = htmlspecialchars((string) ($row['value'] ?? ''), ENT_QUOTES, 'UTF-8');
        if ($label === '' && $value === '') {
            continue;
        }

        $label = rtrim($label, ':') . ':';
        $html .= '<tr><td style="' . $labelStyle . '">' . $label . '</td><td style="' . $valueStyle . '">' . $value . '</td></tr>';
    }

    return $html;
}

/**
 * Builds the shared appointment detail rows.
 *
 * @param array{name:string,serviceLabel:string,doctorLabel:string,dateLabel:string,timeLabel:string,rescheduleToken:string,rescheduleUrl:string} $context
 * @return array<int,array{label:string,value:string}>
 */
function build_appointment_detail_rows(array $context): array
{
    return [
        ['label' => 'Servicio', 'value' => $context['serviceLabel']],
        ['label' => 'Doctor', 'value' => $context['doctorLabel']],
        ['label' => 'Fecha', 'value' => $context['dateLabel']],
        ['label' => 'Hora', 'value' => $context['timeLabel']],
    ];
}

/**
 * Builds the shared appointment detail table.
 *
 * @param array{name:string,serviceLabel:string,doctorLabel:string,dateLabel:string,timeLabel:string,rescheduleToken:string,rescheduleUrl:string} $context
 */
function build_appointment_detail_table(array $context, string $tableStyle, string $labelStyle, string $valueStyle): string
{
    return '<table style="' . $tableStyle . '">'
        . build_email_detail_rows(build_appointment_detail_rows($context), $labelStyle, $valueStyle)
        . '</table>';
}

/**
 * Builds a centered CTA button for email templates.
 */
function build_email_cta_button(string $href, string $label): string
{
    return '<div style="text-align:center;margin-bottom:30px;">'
        . '<a href="' . htmlspecialchars($href, ENT_QUOTES, 'UTF-8') . '" style="display:inline-block;background-color:#0284c7;color:#ffffff;text-decoration:none;padding:12px 25px;border-radius:6px;font-weight:bold;">'
        . htmlspecialchars($label, ENT_QUOTES, 'UTF-8')
        . '</a>'
        . '</div>';
}

/**
 * Builds the shared plain-text appointment detail block.
 *
 * @param array{name:string,serviceLabel:string,doctorLabel:string,dateLabel:string,timeLabel:string,rescheduleToken:string,rescheduleUrl:string} $context
 */
function build_appointment_detail_text(array $context, bool $includeRescheduleLink = false): string
{
    $body = build_text_rows(build_appointment_detail_rows($context));
    $body .= "\n";

    if ($includeRescheduleLink && $context['rescheduleToken'] !== '') {
        $body .= "Si necesitas reprogramar, usa este enlace:\n" . $context['rescheduleUrl'] . "\n\n";
    }

    return $body;
}

/**
 * Builds plain-text label/value rows.
 *
 * @param array<int,array{label:string,value:mixed}> $rows
 */
function build_text_rows(array $rows): string
{
    $body = '';

    foreach ($rows as $row) {
        if (!is_array($row)) {
            continue;
        }

        $label = trim((string) ($row['label'] ?? ''));
        if ($label === '') {
            continue;
        }

        $body .= $label . ': ' . (string) ($row['value'] ?? '') . "\n";
    }

    return $body;
}

/**
 * Builds a plain-text notification body from intro, rows and an optional footer.
 *
 * @param array<int,array{label:string,value:mixed}> $rows
 */
function build_notification_body(string $intro, array $rows, string $footer = ''): string
{
    $body = $intro;
    $body .= build_text_rows($rows);
    $body .= $footer;

    return $body;
}

/**
 * Builds the standard admin appointment notification rows.
 *
 * @param array<string,mixed> $appointment
 * @return array<int,array{label:string,value:mixed}>
 */
function build_admin_appointment_notification_rows(array $appointment): array
{
    $context = build_appointment_email_context($appointment);
    $rows = [
        ['label' => 'Paciente', 'value' => $appointment['name'] ?? '-'],
        ['label' => 'Email', 'value' => $appointment['email'] ?? '-'],
        ['label' => 'Telefono', 'value' => $appointment['phone'] ?? '-'],
        ['label' => 'Motivo', 'value' => $appointment['reason'] ?? '-'],
        ['label' => 'Zona', 'value' => $appointment['affectedArea'] ?? '-'],
        ['label' => 'Evolucion', 'value' => $appointment['evolutionTime'] ?? '-'],
        [
            'label' => 'Consentimiento datos',
            'value' => (isset($appointment['privacyConsent']) && $appointment['privacyConsent']) ? 'si' : 'no',
        ],
        ['label' => 'Servicio', 'value' => $context['serviceLabel']],
        ['label' => 'Doctor', 'value' => $context['doctorLabel']],
        ['label' => 'Fecha', 'value' => $appointment['date'] ?? '-'],
        ['label' => 'Hora', 'value' => $appointment['time'] ?? '-'],
        ['label' => 'Precio', 'value' => $appointment['price'] ?? '-'],
        ['label' => 'Metodo de pago', 'value' => $appointment['paymentMethod'] ?? '-'],
        ['label' => 'Estado de pago', 'value' => $appointment['paymentStatus'] ?? '-'],
        ['label' => 'Fotos adjuntas', 'value' => (int) ($appointment['casePhotoCount'] ?? 0)],
    ];

    if (!empty($appointment['telemedicineChannel'])) {
        $rows = array_merge(
            $rows,
            [
                ['label' => 'Canal telemedicina', 'value' => $appointment['telemedicineChannel'] ?? '-'],
                ['label' => 'Telemedicine intake id', 'value' => $appointment['telemedicineIntakeId'] ?? '-'],
                ['label' => 'Suitability', 'value' => $appointment['telemedicineSuitability'] ?? '-'],
                [
                    'label' => 'Revision humana',
                    'value' => (isset($appointment['telemedicineReviewRequired']) && $appointment['telemedicineReviewRequired']) ? 'si' : 'no',
                ],
                ['label' => 'Escalamiento', 'value' => $appointment['telemedicineEscalationRecommendation'] ?? '-'],
                [
                    'label' => 'Media clinica privada',
                    'value' => count(is_array($appointment['clinicalMediaIds'] ?? null) ? $appointment['clinicalMediaIds'] : []) . ' archivo(s)',
                ],
            ]
        );
    }

    return $rows;
}

/**
 * Builds the standard plain-text rows for a rescheduled appointment.
 *
 * @param array{name:string,serviceLabel:string,doctorLabel:string,dateLabel:string,timeLabel:string,rescheduleToken:string,rescheduleUrl:string} $context
 * @return array<int,array{label:string,value:mixed}>
 */
function build_reschedule_notification_rows(array $context): array
{
    return [
        ['label' => 'Servicio', 'value' => $context['serviceLabel']],
        ['label' => 'Doctor', 'value' => $context['doctorLabel']],
        ['label' => 'Nueva fecha', 'value' => $context['dateLabel']],
        ['label' => 'Nueva hora', 'value' => $context['timeLabel']],
    ];
}

/**
 * Builds the standard footer for reschedule notifications.
 *
 * @param array{name:string,serviceLabel:string,doctorLabel:string,dateLabel:string,timeLabel:string,rescheduleToken:string,rescheduleUrl:string} $context
 */
function build_reschedule_notification_footer(array $context): string
{
    $footer = "\n";

    if ($context['rescheduleToken'] !== '') {
        $footer .= "Si necesitas reprogramar de nuevo:\n";
        $footer .= $context['rescheduleUrl'] . "\n\n";
    }

    $footer .= "Te esperamos. ¡Gracias por confiar en nosotros!\n";
    $footer .= "- Equipo " . AppConfig::BRAND_NAME;

    return $footer;
}

/**
 * Builds the plain-text body for a rescheduled appointment email.
 *
 * @param array<string,mixed> $appointment
 */
function build_reschedule_email_text(array $appointment): string
{
    $context = build_appointment_email_context($appointment);

    return build_notification_body(
        "Hola " . $context['name'] . ",\n\n" . "Tu cita ha sido reprogramada exitosamente.\n\n",
        build_reschedule_notification_rows($context),
        build_reschedule_notification_footer($context)
    );
}

/**
 * Builds the standard callback notification rows.
 *
 * @param array<string,mixed> $callback
 * @return array<int,array{label:string,value:mixed}>
 */
function build_callback_notification_rows(array $callback): array
{
    return [
        ['label' => 'Teléfono', 'value' => $callback['telefono'] ?? '-'],
        ['label' => 'Preferencia', 'value' => $callback['preferencia'] ?? '-'],
        ['label' => 'Fecha de solicitud', 'value' => local_date('d/m/Y H:i')],
    ];
}

/**
 * Builds the responsive HTML confirmation email for patient appointments.
 *
 * @param array<string,mixed> $appointment
 */
function build_appointment_email_html(array $appointment): string
{
    $context = build_appointment_email_context($appointment);
    $name = htmlspecialchars($context['name'], ENT_QUOTES, 'UTF-8');
    $dateLabel = htmlspecialchars($context['dateLabel'], ENT_QUOTES, 'UTF-8');
    $timeLabel = htmlspecialchars($context['timeLabel'], ENT_QUOTES, 'UTF-8');

    $content = '<h2 style="margin:0 0 20px;color:#0d1a2f;font-size:20px;">Cita Confirmada</h2>'
        . '<p style="margin:0 0 15px;line-height:1.6;color:#555;">Hola <strong>' . $name . '</strong>,</p>'
        . '<p style="margin:0 0 20px;line-height:1.6;color:#555;">Tu cita ha sido registrada exitosamente. Aquí tienes los detalles:</p>'
        . build_appointment_detail_table(
            $context,
            'width:100%;border-collapse:separate;border-spacing:0;background-color:#f8fafc;border-radius:8px;padding:15px;margin-bottom:25px;',
            'padding:8px 0;color:#64748b;font-weight:bold;width:120px;',
            'padding:8px 0;color:#334155;'
        )
        . '<p style="margin:0 0 25px;line-height:1.6;color:#555;">Adjuntamos un archivo de calendario (.ics) para que puedas agregar esta cita a tu agenda.</p>'
        . build_email_cta_button($context['rescheduleUrl'], 'Reprogramar Cita')
        . '<p style="margin:0;font-size:13px;color:#94a3b8;text-align:center;">Si necesitas ayuda, responde a este correo.</p>';

    return get_email_template('Confirmación de Cita', $content, 'Tu cita ha sido confirmada para el ' . $dateLabel);
}

/**
 * @param array<string,mixed> $appointment
 */
function build_appointment_email_text(array $appointment): string
{
    $context = build_appointment_email_context($appointment);

    $body = "Hola " . $context['name'] . ",\n\n";
    $body .= "Tu cita ha sido registrada exitosamente.\n\n";
    $body .= "Detalles:\n";
    $body .= build_appointment_detail_text($context, false);
    $body .= "Adjuntamos un archivo de calendario (.ics) para que puedas agregar esta cita a tu agenda.\n\n";
    $body .= "Si deseas reprogramar, visita: " . $context['rescheduleUrl'] . "\n\n";
    $body .= "Si tienes dudas, responde este correo o escribe por WhatsApp: " . AppConfig::WHATSAPP_NUMBER . ".\n\n";
    $body .= AppConfig::BRAND_NAME . "\n" . AppConfig::ADDRESS;

    return $body;
}

/**
 * @param array<string,mixed> $appointment
 */
function build_reminder_email_html(array $appointment): string
{
    $context = build_appointment_email_context($appointment);
    $name = htmlspecialchars($context['name'], ENT_QUOTES, 'UTF-8');
    $dateLabel = htmlspecialchars($context['dateLabel'], ENT_QUOTES, 'UTF-8');
    $timeLabel = htmlspecialchars($context['timeLabel'], ENT_QUOTES, 'UTF-8');

    $content = '<h2 style="margin:0 0 20px;color:#0d1a2f;font-size:20px;">Recordatorio de Cita</h2>'
        . '<p style="margin:0 0 15px;line-height:1.6;color:#555;">Hola <strong>' . $name . '</strong>,</p>'
        . '<p style="margin:0 0 20px;line-height:1.6;color:#555;">Te recordamos que tienes una cita programada para mañana. ¡Te esperamos!</p>'
        . build_appointment_detail_table(
            $context,
            'width:100%;border-collapse:separate;border-spacing:0;background-color:#f8fafc;border-radius:8px;padding:15px;margin-bottom:25px;',
            'padding:8px 0;color:#64748b;font-weight:bold;width:120px;',
            'padding:8px 0;color:#334155;'
        )
        . build_email_cta_button($context['rescheduleUrl'], 'Reprogramar Cita')
        . '<p style="margin:0;font-size:13px;color:#94a3b8;text-align:center;">Nos vemos pronto.</p>';

    return get_email_template('Recordatorio de Cita', $content, 'Tu cita es mañana a las ' . $timeLabel);
}

/**
 * @param array<string,mixed> $appointment
 */
function build_reminder_email_text(array $appointment): string
{
    $context = build_appointment_email_context($appointment);

    $body = "Hola " . $context['name'] . ",\n\n";
    $body .= "Te recordamos que tienes una cita programada para mañana.\n\n";
    $body .= build_appointment_detail_text($context, true);
    $body .= "Te esperamos. ¡Gracias por confiar en nosotros!\n\n";
    $body .= "- Equipo " . AppConfig::BRAND_NAME . "\n";
    $body .= "WhatsApp: " . AppConfig::WHATSAPP_NUMBER;

    return $body;
}

/**
 * @param array<string,mixed> $appointment
 */
function build_cancellation_email_html(array $appointment): string
{
    $context = build_appointment_email_context($appointment);
    $name = htmlspecialchars($context['name'], ENT_QUOTES, 'UTF-8');
    $bookingUrl = AppConfig::BASE_URL . '/#citas';

    $content = '<h2 style="margin:0 0 20px;color:#ef4444;font-size:20px;">Cita Cancelada</h2>'
        . '<p style="margin:0 0 15px;line-height:1.6;color:#555;">Hola <strong>' . $name . '</strong>,</p>'
        . '<p style="margin:0 0 20px;line-height:1.6;color:#555;">Tu cita ha sido cancelada.</p>'
        . build_appointment_detail_table(
            $context,
            'width:100%;border-collapse:separate;border-spacing:0;background-color:#fef2f2;border-radius:8px;padding:15px;margin-bottom:25px;',
            'padding:8px 0;color:#991b1b;font-weight:bold;width:120px;',
            'padding:8px 0;color:#7f1d1d;'
        )
        . '<p style="margin:0 0 25px;line-height:1.6;color:#555;">Si deseas agendar una nueva cita, puedes hacerlo en nuestro sitio web o contactarnos por WhatsApp.</p>'
        . build_email_cta_button($bookingUrl, 'Agendar Nueva Cita');

    return get_email_template('Cita Cancelada', $content, 'Tu cita ha sido cancelada');
}

/**
 * @param array<string,mixed> $appointment
 */
function build_cancellation_email_text(array $appointment): string
{
    $context = build_appointment_email_context($appointment);

    $body = "Hola " . $context['name'] . ",\n\n";
    $body .= "Tu cita ha sido cancelada.\n\n";
    $body .= "Detalles de la cita cancelada:\n";
    $body .= build_appointment_detail_text($context, false);
    $body .= "Si deseas reprogramar, visita " . AppConfig::BASE_URL . "/#citas o escríbenos por WhatsApp: " . AppConfig::WHATSAPP_NUMBER . ".\n\n";
    $body .= "Gracias por confiar en nosotros.\n\n";
    $body .= "- Equipo " . AppConfig::BRAND_NAME;

    return $body;
}

/**
 * Sends patient confirmation email and optional ICS attachment.
 *
 * @param array<string,mixed> $appointment
 */
function maybe_send_appointment_email(array $appointment): bool
{
    $subject = build_email_subject('Confirmacion de cita');
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

    return send_mail_to_recipient(
        (string) ($appointment['email'] ?? ''),
        $subject,
        $htmlBody,
        true,
        $attachments,
        $textBody
    );
}

/**
 * Sends a plain-text admin notification when a new appointment is created.
 *
 * @param array<string,mixed> $appointment
 */
function maybe_send_admin_notification(array $appointment): bool
{
    $adminEmail = AppConfig::getAdminEmail();
    if (email_recipient_or_empty($adminEmail) === '') {
        error_log('Piel en Armonía: PIELARMONIA_ADMIN_EMAIL invalido');
        return false;
    }

    $subject = build_email_subject('Nueva cita agendada');
    $body = build_notification_body(
        "Se ha agendado una nueva cita:\n\n",
        build_admin_appointment_notification_rows($appointment),
        "\nFecha de registro: " . local_date('d/m/Y H:i') . "\n"
    );

    return send_mail_to_recipient($adminEmail, $subject, $body);
}

/**
 * Sends patient cancellation confirmation email.
 *
 * @param array<string,mixed> $appointment
 */
function maybe_send_cancellation_email(array $appointment): bool
{
    $subject = build_email_subject('Cita cancelada');
    $htmlBody = build_cancellation_email_html($appointment);
    $textBody = build_cancellation_email_text($appointment);

    return send_mail_to_recipient(
        (string) ($appointment['email'] ?? ''),
        $subject,
        $htmlBody,
        true,
        [],
        $textBody
    );
}

/**
 * Sends callback-request notification to admin email.
 *
 * @param array<string,mixed> $callback
 */
function maybe_send_callback_admin_notification(array $callback): bool
{
    $adminEmail = AppConfig::getAdminEmail();
    if (email_recipient_or_empty($adminEmail) === '') {
        return false;
    }

    $subject = build_email_subject('Nueva solicitud de llamada');
    $body = build_notification_body(
        "Un paciente solicita que le llamen:\n\n",
        build_callback_notification_rows($callback),
        "\nPor favor contactar lo antes posible."
    );

    return send_mail_to_recipient($adminEmail, $subject, $body);
}

/**
 * Sends appointment reminder email to the patient.
 *
 * @param array<string,mixed> $appointment
 */
function maybe_send_reminder_email(array $appointment): bool
{
    $subject = build_email_subject('Recordatorio de cita');
    $htmlBody = build_reminder_email_html($appointment);
    $textBody = build_reminder_email_text($appointment);

    return send_mail_to_recipient(
        (string) ($appointment['email'] ?? ''),
        $subject,
        $htmlBody,
        true,
        [],
        $textBody
    );
}

/**
 * Sends patient notification after an appointment is rescheduled.
 *
 * @param array<string,mixed> $appointment
 */
function maybe_send_reschedule_email(array $appointment): bool
{
    $subject = build_email_subject('Cita reprogramada');
    $body = build_reschedule_email_text($appointment);

    return send_mail_to_recipient(
        (string) ($appointment['email'] ?? ''),
        $subject,
        $body
    );
}

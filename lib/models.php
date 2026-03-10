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
    $normalized = [
        'id' => isset($callback['id']) ? (int) $callback['id'] : (int) round(microtime(true) * 1000),
        'telefono' => truncate_field(sanitize_phone((string) ($callback['telefono'] ?? '')), 20),
        'preferencia' => truncate_field(sanitize_xss((string) ($callback['preferencia'] ?? '')), 200),
        'fecha' => isset($callback['fecha']) ? (string) $callback['fecha'] : local_date('c'),
        'status' => map_callback_status((string) ($callback['status'] ?? 'pendiente'))
    ];

    if (isset($callback['leadOps']) && is_array($callback['leadOps'])) {
        $normalized['leadOps'] = LeadOpsService::normalizeLeadOps($callback['leadOps']);
    }

    return $normalized;
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
        'transferProofUploadId' => isset($appointment['transferProofUploadId']) ? (int) $appointment['transferProofUploadId'] : 0,
        'idempotencyKey' => truncate_field(trim((string) ($appointment['idempotencyKey'] ?? '')), 128),
        'idempotencyFingerprint' => truncate_field(strtolower(trim((string) ($appointment['idempotencyFingerprint'] ?? ''))), 128),
        'telemedicineIntakeId' => isset($appointment['telemedicineIntakeId']) ? (int) $appointment['telemedicineIntakeId'] : 0,
        'telemedicineChannel' => truncate_field(trim((string) ($appointment['telemedicineChannel'] ?? '')), 50),
        'telemedicineSuitability' => truncate_field(trim((string) ($appointment['telemedicineSuitability'] ?? '')), 50),
        'telemedicineSuitabilityReasons' => normalize_string_list($appointment['telemedicineSuitabilityReasons'] ?? [], 10, 120),
        'telemedicineReviewRequired' => isset($appointment['telemedicineReviewRequired']) ? parse_bool($appointment['telemedicineReviewRequired']) : false,
        'telemedicineEscalationRecommendation' => truncate_field(trim((string) ($appointment['telemedicineEscalationRecommendation'] ?? '')), 100),
        'telemedicineConsentSnapshot' => isset($appointment['telemedicineConsentSnapshot']) && is_array($appointment['telemedicineConsentSnapshot'])
            ? $appointment['telemedicineConsentSnapshot']
            : [],
        'telemedicineEncounterPlan' => isset($appointment['telemedicineEncounterPlan']) && is_array($appointment['telemedicineEncounterPlan'])
            ? $appointment['telemedicineEncounterPlan']
            : [],
        'clinicalMediaIds' => array_values(array_filter(array_map('intval', is_array($appointment['clinicalMediaIds'] ?? null) ? $appointment['clinicalMediaIds'] : []), static function (int $id): bool {
            return $id > 0;
        })),
        'doctorRequested' => truncate_field(sanitize_xss((string) ($appointment['doctorRequested'] ?? '')), 100),
        'doctorAssigned' => truncate_field(sanitize_xss((string) ($appointment['doctorAssigned'] ?? '')), 100),
        'visitMode' => truncate_field(trim((string) ($appointment['visitMode'] ?? '')), 50),
        'supportContactMethod' => truncate_field(trim((string) ($appointment['supportContactMethod'] ?? '')), 50),
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

    $needsAssistance = isset($ticket['needsAssistance'])
        ? parse_bool($ticket['needsAssistance'])
        : (isset($ticket['needs_assistance']) ? parse_bool($ticket['needs_assistance']) : false);
    $specialPriority = isset($ticket['specialPriority'])
        ? parse_bool($ticket['specialPriority'])
        : (isset($ticket['special_priority']) ? parse_bool($ticket['special_priority']) : false);
    $lateArrival = isset($ticket['lateArrival'])
        ? parse_bool($ticket['lateArrival'])
        : (isset($ticket['late_arrival']) ? parse_bool($ticket['late_arrival']) : false);

    $assistanceRequestStatus = strtolower(trim((string) (
        $ticket['assistanceRequestStatus']
        ?? ($ticket['assistance_request_status'] ?? '')
    )));
    if (!in_array($assistanceRequestStatus, ['pending', 'attending', 'resolved'], true)) {
        $assistanceRequestStatus = '';
    }

    $activeHelpRequestId = null;
    $activeHelpRequestRaw = $ticket['activeHelpRequestId'] ?? ($ticket['active_help_request_id'] ?? null);
    if ($activeHelpRequestRaw !== null && $activeHelpRequestRaw !== '') {
        $candidate = (int) $activeHelpRequestRaw;
        if ($candidate > 0) {
            $activeHelpRequestId = $candidate;
        }
    }

    $estimatedWaitMin = isset($ticket['estimatedWaitMin'])
        ? (int) $ticket['estimatedWaitMin']
        : (isset($ticket['estimated_wait_min']) ? (int) $ticket['estimated_wait_min'] : 0);
    if ($estimatedWaitMin < 0) {
        $estimatedWaitMin = 0;
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
        'needsAssistance' => $needsAssistance,
        'assistanceRequestStatus' => $assistanceRequestStatus,
        'activeHelpRequestId' => $activeHelpRequestId,
        'assistanceReason' => truncate_field(sanitize_xss(trim((string) (
            $ticket['assistanceReason']
            ?? ($ticket['assistance_reason'] ?? '')
        ))), 80),
        'specialPriority' => $specialPriority,
        'lateArrival' => $lateArrival,
        'reprintRequestedAt' => truncate_field(trim((string) (
            $ticket['reprintRequestedAt']
            ?? ($ticket['reprint_requested_at'] ?? '')
        )), 40),
        'estimatedWaitMin' => $estimatedWaitMin,
    ];
}

function queue_help_request_reason_label(string $reason): string
{
    $normalized = strtolower(trim($reason));
    $labels = [
        'human_help' => 'Ayuda humana',
        'lost_ticket' => 'Perdio su ticket',
        'printer_issue' => 'Problema de impresion',
        'appointment_not_found' => 'Cita no encontrada',
        'special_priority' => 'Prioridad especial',
        'accessibility' => 'Accesibilidad',
        'clinical_redirect' => 'Derivacion clinica',
        'late_arrival' => 'Llegada tarde',
        'offline_pending' => 'Pendiente offline',
        'reprint_requested' => 'Reimpresion solicitada',
        'general' => 'Apoyo general',
    ];

    return $labels[$normalized] ?? 'Apoyo general';
}

function normalize_queue_help_request(array $request): array
{
    $status = strtolower(trim((string) ($request['status'] ?? 'pending')));
    if (!in_array($status, ['pending', 'attending', 'resolved'], true)) {
        $status = 'pending';
    }

    $ticketId = null;
    $ticketIdRaw = $request['ticketId'] ?? ($request['ticket_id'] ?? null);
    if ($ticketIdRaw !== null && $ticketIdRaw !== '') {
        $candidate = (int) $ticketIdRaw;
        if ($candidate > 0) {
            $ticketId = $candidate;
        }
    }

    $reason = strtolower(trim((string) ($request['reason'] ?? 'general')));
    if ($reason === '') {
        $reason = 'general';
    }

    $createdAt = trim((string) ($request['createdAt'] ?? ($request['created_at'] ?? '')));
    if ($createdAt === '') {
        $createdAt = local_date('c');
    }

    $updatedAt = trim((string) ($request['updatedAt'] ?? ($request['updated_at'] ?? $createdAt)));
    if ($updatedAt === '') {
        $updatedAt = $createdAt;
    }

    return [
        'id' => isset($request['id']) ? (int) $request['id'] : (int) round(microtime(true) * 1000),
        'source' => truncate_field(sanitize_xss(trim((string) ($request['source'] ?? 'kiosk'))), 40),
        'reason' => truncate_field($reason, 60),
        'reasonLabel' => queue_help_request_reason_label($reason),
        'status' => $status,
        'message' => truncate_field(sanitize_xss(trim((string) ($request['message'] ?? ''))), 500),
        'intent' => truncate_field(sanitize_xss(trim((string) ($request['intent'] ?? ''))), 80),
        'sessionId' => truncate_field(trim((string) (
            $request['sessionId']
            ?? ($request['session_id'] ?? '')
        )), 120),
        'ticketId' => $ticketId,
        'ticketCode' => truncate_field(trim((string) (
            $request['ticketCode']
            ?? ($request['ticket_code'] ?? '')
        )), 20),
        'patientInitials' => truncate_field(strtoupper((string) (preg_replace(
            '/[^A-Z]/',
            '',
            strtoupper(trim((string) ($request['patientInitials'] ?? ($request['patient_initials'] ?? ''))))
        ) ?: '')), 4),
        'createdAt' => $createdAt,
        'updatedAt' => $updatedAt,
        'attendedAt' => truncate_field(trim((string) (
            $request['attendedAt']
            ?? ($request['attended_at'] ?? '')
        )), 40),
        'resolvedAt' => truncate_field(trim((string) (
            $request['resolvedAt']
            ?? ($request['resolved_at'] ?? '')
        )), 40),
        'context' => isset($request['context']) && is_array($request['context'])
            ? $request['context']
            : [],
    ];
}

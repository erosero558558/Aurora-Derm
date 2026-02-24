<?php

declare(strict_types=1);

require_once __DIR__ . '/business.php';
require_once __DIR__ . '/models.php';
require_once __DIR__ . '/validation.php';
require_once __DIR__ . '/common.php';
require_once __DIR__ . '/calendar/runtime.php';

class BookingService
{
    /**
     * @param array $store
     * @param array $payload
     * @return array
     */
    public function create(array $store, array $payload): array
    {
        $appointment = normalize_appointment($payload);

        $validation = validate_appointment_payload($appointment, [
            'validServices' => array_keys(get_services_config()),
            'validDoctors' => ['rosero', 'narvaez']
        ]);

        if (!$validation['ok']) {
            return ['ok' => false, 'error' => $validation['error'], 'code' => 400];
        }

        $service = strtolower(trim((string) ($appointment['service'] ?? '')));
        $appointment['service'] = $service;

        $calendarBooking = CalendarBookingService::fromEnv();
        $requestedDoctor = strtolower(trim((string) ($appointment['doctor'] ?? '')));
        if ($requestedDoctor === '') {
            $requestedDoctor = 'indiferente';
        }

        $googleRequirement = $calendarBooking->ensureGoogleRequirement($requestedDoctor, $appointment['service']);
        if (($googleRequirement['ok'] ?? false) !== true) {
            return [
                'ok' => false,
                'error' => (string) ($googleRequirement['error'] ?? 'La agenda real no esta disponible'),
                'code' => (int) ($googleRequirement['status'] ?? 503),
                'errorCode' => (string) ($googleRequirement['code'] ?? 'calendar_unreachable'),
            ];
        }

        $effectiveDoctor = $requestedDoctor;
        if ($requestedDoctor === 'indiferente') {
            $assigned = $calendarBooking->assignDoctorForIndiferente(
                $store,
                $appointment['date'],
                $appointment['time'],
                $appointment['service']
            );
            if (($assigned['ok'] ?? false) !== true) {
                return [
                    'ok' => false,
                    'error' => (string) ($assigned['error'] ?? 'No hay agenda disponible para la fecha seleccionada'),
                    'code' => (int) ($assigned['status'] ?? 409),
                    'errorCode' => (string) ($assigned['code'] ?? 'slot_unavailable'),
                ];
            }
            $effectiveDoctor = (string) ($assigned['doctor'] ?? '');
        } else {
            if ($calendarBooking->isGoogleActive()) {
                $slotCheck = $calendarBooking->ensureSlotAvailable(
                    $store,
                    $appointment['date'],
                    $appointment['time'],
                    $requestedDoctor,
                    $appointment['service']
                );
                if (($slotCheck['ok'] ?? false) !== true) {
                    return [
                        'ok' => false,
                        'error' => (string) ($slotCheck['error'] ?? 'No hay agenda disponible para la fecha seleccionada'),
                        'code' => (int) ($slotCheck['status'] ?? 409),
                        'errorCode' => (string) ($slotCheck['code'] ?? 'slot_unavailable'),
                    ];
                }
            }
        }

        if ($effectiveDoctor === '' || $effectiveDoctor === 'indiferente') {
            return ['ok' => false, 'error' => 'No se pudo resolver un doctor disponible', 'code' => 409, 'errorCode' => 'slot_unavailable'];
        }

        if (!$calendarBooking->isGoogleActive()) {
            $availableSlots = $this->getConfiguredSlotsForDate($store, $appointment['date']);
            if (count($availableSlots) === 0) {
                return ['ok' => false, 'error' => 'No hay agenda disponible para la fecha seleccionada', 'code' => 400];
            }
            if (!in_array($appointment['time'], $availableSlots, true)) {
                return ['ok' => false, 'error' => 'Ese horario no esta disponible para la fecha seleccionada', 'code' => 400, 'errorCode' => 'slot_unavailable'];
            }
        }

        if (appointment_slot_taken($store['appointments'], $appointment['date'], $appointment['time'], null, $effectiveDoctor)) {
            if ($requestedDoctor !== 'indiferente') {
                return ['ok' => false, 'error' => 'Ese horario ya fue reservado', 'code' => 409, 'errorCode' => 'slot_unavailable'];
            }

            $alternateDoctor = $effectiveDoctor === 'rosero' ? 'narvaez' : 'rosero';
            if (appointment_slot_taken($store['appointments'], $appointment['date'], $appointment['time'], null, $alternateDoctor)) {
                return ['ok' => false, 'error' => 'Ese horario ya fue reservado', 'code' => 409, 'errorCode' => 'slot_unavailable'];
            }

            if ($calendarBooking->isGoogleActive()) {
                $otherCheck = $calendarBooking->ensureSlotAvailable(
                    $store,
                    $appointment['date'],
                    $appointment['time'],
                    $alternateDoctor,
                    $appointment['service']
                );
                if (($otherCheck['ok'] ?? false) !== true) {
                    return ['ok' => false, 'error' => 'Ese horario ya fue reservado', 'code' => 409, 'errorCode' => 'slot_unavailable'];
                }
            }
            $effectiveDoctor = $alternateDoctor;
        }

        $paymentMethod = $appointment['paymentMethod'];
        if ($paymentMethod === 'card') {
            $paymentIntentId = trim((string) ($appointment['paymentIntentId'] ?? ''));
            if ($paymentIntentId === '') {
                return ['ok' => false, 'error' => 'Falta confirmar el pago con tarjeta', 'code' => 400];
            }

            foreach ($store['appointments'] as $existingAppointment) {
                $existingIntent = trim((string) ($existingAppointment['paymentIntentId'] ?? ''));
                if ($existingIntent !== '' && hash_equals($existingIntent, $paymentIntentId)) {
                    return ['ok' => false, 'error' => 'Este pago ya fue utilizado para otra reserva', 'code' => 409];
                }
            }

            if (!function_exists('payment_gateway_enabled') || !payment_gateway_enabled()) {
                return ['ok' => false, 'error' => 'La pasarela de pago no esta disponible', 'code' => 503];
            }

            try {
                $intent = stripe_get_payment_intent($paymentIntentId);
            } catch (RuntimeException $e) {
                return ['ok' => false, 'error' => 'No se pudo validar el pago en este momento', 'code' => 502];
            }

            $validation = $this->validatePaymentIntent($intent, $appointment);
            if (!$validation['ok']) {
                return $validation;
            }

            $appointment['paymentMethod'] = 'card';
            $appointment['paymentStatus'] = 'paid';
            $appointment['paymentProvider'] = 'stripe';
            $appointment['paymentPaidAt'] = local_date('c');
            $appointment['paymentIntentId'] = $paymentIntentId;
        } elseif ($paymentMethod === 'transfer') {
            $reference = trim((string) ($appointment['transferReference'] ?? ''));
            $proofPath = trim((string) ($appointment['transferProofPath'] ?? ''));
            $proofUrl = trim((string) ($appointment['transferProofUrl'] ?? ''));

            if ($reference === '') {
                return ['ok' => false, 'error' => 'Debes ingresar el numero de referencia de la transferencia', 'code' => 400];
            }
            if ($proofPath === '' || $proofUrl === '') {
                return ['ok' => false, 'error' => 'Debes adjuntar el comprobante de transferencia', 'code' => 400];
            }

            $appointment['paymentMethod'] = 'transfer';
            $appointment['paymentStatus'] = 'pending_transfer_review';
        } elseif ($paymentMethod === 'cash') {
            $appointment['paymentMethod'] = 'cash';
            $appointment['paymentStatus'] = 'pending_cash';
        } else {
            $appointment['paymentMethod'] = 'unpaid';
            $appointment['paymentStatus'] = 'pending';
        }

        $appointment['slotDurationMin'] = $calendarBooking->getDurationMin((string) ($appointment['service'] ?? 'consulta'));
        if ($requestedDoctor === 'indiferente') {
            $appointment['doctorRequested'] = 'indiferente';
            $appointment['doctorAssigned'] = $effectiveDoctor;
            $calendarBooking->advanceIndiferenteCursor($store, $effectiveDoctor);
        }
        $appointment['doctor'] = $effectiveDoctor;

        if ($calendarBooking->isGoogleActive()) {
            $calendarEvent = $calendarBooking->createCalendarEvent($appointment, $effectiveDoctor);
            if (($calendarEvent['ok'] ?? false) !== true) {
                return [
                    'ok' => false,
                    'error' => (string) ($calendarEvent['error'] ?? 'No se pudo crear la cita en Google Calendar'),
                    'code' => (int) ($calendarEvent['status'] ?? 503),
                    'errorCode' => (string) ($calendarEvent['code'] ?? 'calendar_unreachable'),
                ];
            }

            $appointment['calendarProvider'] = (string) ($calendarEvent['provider'] ?? 'google');
            $appointment['calendarId'] = (string) ($calendarEvent['calendarId'] ?? '');
            $appointment['calendarEventId'] = (string) ($calendarEvent['eventId'] ?? '');
            $appointment['calendarEventUrl'] = (string) ($calendarEvent['eventHtmlLink'] ?? '');
        } else {
            $appointment['calendarProvider'] = 'store';
        }

        $store['appointments'][] = $appointment;

        return [
            'ok' => true,
            'store' => $store,
            'data' => $appointment,
            'code' => 201,
        ];
    }

    public function cancel(array $store, int $id): array
    {
        if ($id <= 0) {
            return ['ok' => false, 'error' => 'Identificador invalido', 'code' => 400];
        }

        $found = false;
        $cancelledAppointment = null;
        foreach ($store['appointments'] as &$appt) {
            if ((int) ($appt['id'] ?? 0) !== $id) {
                continue;
            }
            $found = true;
            $appt['status'] = 'cancelled';
            $cancelledAppointment = $appt;
            break;
        }
        unset($appt);

        if (!$found) {
            return ['ok' => false, 'error' => 'Cita no encontrada', 'code' => 404];
        }

        return [
            'ok' => true,
            'store' => $store,
            'data' => $cancelledAppointment,
            'code' => 200,
        ];
    }

    public function reschedule(array $store, string $token, string $newDate, string $newTime): array
    {
        $validation = validate_reschedule_payload($token, $newDate, $newTime);
        if (!$validation['ok']) {
            return ['ok' => false, 'error' => $validation['error'], 'code' => 400];
        }

        $calendarBooking = CalendarBookingService::fromEnv();
        $found = false;
        $updatedAppointment = null;
        $previousCalendarState = null;

        foreach ($store['appointments'] as &$appt) {
            if (($appt['rescheduleToken'] ?? '') !== $token) {
                continue;
            }
            if (($appt['status'] ?? '') === 'cancelled') {
                return ['ok' => false, 'error' => 'Esta cita fue cancelada', 'code' => 400];
            }

            $service = (string) ($appt['service'] ?? 'consulta');
            if ($service === '' || get_service_config($service) === null) {
                return ['ok' => false, 'error' => 'Servicio invalido para reprogramacion', 'code' => 400];
            }
            $doctor = strtolower(trim((string) ($appt['doctor'] ?? '')));
            if ($doctor === '') {
                $doctor = strtolower(trim((string) ($appt['doctorAssigned'] ?? '')));
            }
            if ($doctor === '') {
                $doctor = 'indiferente';
            }

            $googleRequirement = $calendarBooking->ensureGoogleRequirement($doctor, $service);
            if (($googleRequirement['ok'] ?? false) !== true) {
                return [
                    'ok' => false,
                    'error' => (string) ($googleRequirement['error'] ?? 'La agenda real no esta disponible'),
                    'code' => (int) ($googleRequirement['status'] ?? 503),
                    'errorCode' => (string) ($googleRequirement['code'] ?? 'calendar_unreachable'),
                ];
            }

            if ($doctor === 'indiferente') {
                $assigned = $calendarBooking->assignDoctorForIndiferente($store, $newDate, $newTime, $service);
                if (($assigned['ok'] ?? false) !== true) {
                    return [
                        'ok' => false,
                        'error' => (string) ($assigned['error'] ?? 'No hay agenda disponible para la fecha seleccionada'),
                        'code' => (int) ($assigned['status'] ?? 409),
                        'errorCode' => (string) ($assigned['code'] ?? 'slot_unavailable'),
                    ];
                }
                $doctor = (string) ($assigned['doctor'] ?? 'indiferente');
            } elseif ($calendarBooking->isGoogleActive()) {
                $slotCheck = $calendarBooking->ensureSlotAvailable($store, $newDate, $newTime, $doctor, $service);
                if (($slotCheck['ok'] ?? false) !== true) {
                    return [
                        'ok' => false,
                        'error' => (string) ($slotCheck['error'] ?? 'No hay agenda disponible para la fecha seleccionada'),
                        'code' => (int) ($slotCheck['status'] ?? 409),
                        'errorCode' => (string) ($slotCheck['code'] ?? 'slot_unavailable'),
                    ];
                }
            }

            if (!$calendarBooking->isGoogleActive()) {
                $availableSlots = $this->getConfiguredSlotsForDate($store, $newDate);
                if (count($availableSlots) === 0) {
                    return ['ok' => false, 'error' => 'No hay agenda disponible para la fecha seleccionada', 'code' => 400];
                }
                if (!in_array($newTime, $availableSlots, true)) {
                    return ['ok' => false, 'error' => 'Ese horario no esta disponible para la fecha seleccionada', 'code' => 400, 'errorCode' => 'slot_unavailable'];
                }
            }

            $excludeId = (int) ($appt['id'] ?? 0);
            if (appointment_slot_taken($store['appointments'], $newDate, $newTime, $excludeId, $doctor)) {
                return ['ok' => false, 'error' => 'El horario seleccionado ya no esta disponible', 'code' => 409, 'errorCode' => 'slot_unavailable'];
            }

            $previousCalendarState = [
                'date' => (string) ($appt['date'] ?? ''),
                'time' => (string) ($appt['time'] ?? ''),
                'doctor' => (string) ($appt['doctor'] ?? ''),
                'calendarId' => (string) ($appt['calendarId'] ?? ''),
                'calendarEventId' => (string) ($appt['calendarEventId'] ?? ''),
            ];

            if ($calendarBooking->isGoogleActive()) {
                $calendarPatch = $calendarBooking->patchCalendarEvent($appt, $newDate, $newTime, $doctor);
                if (($calendarPatch['ok'] ?? false) !== true) {
                    return [
                        'ok' => false,
                        'error' => (string) ($calendarPatch['error'] ?? 'No se pudo actualizar la cita en Google Calendar'),
                        'code' => (int) ($calendarPatch['status'] ?? 503),
                        'errorCode' => (string) ($calendarPatch['code'] ?? 'calendar_unreachable'),
                    ];
                }
            }

            $appt['date'] = $newDate;
            $appt['time'] = $newTime;
            $appt['doctor'] = $doctor;
            $appt['slotDurationMin'] = $calendarBooking->getDurationMin($service);
            if (($appt['doctorRequested'] ?? '') === 'indiferente') {
                $appt['doctorAssigned'] = $doctor;
            }
            $appt['reminderSentAt'] = '';

            $found = true;
            $updatedAppointment = $appt;
            break;
        }
        unset($appt);

        if (!$found) {
            return ['ok' => false, 'error' => 'Cita no encontrada', 'code' => 404];
        }

        return [
            'ok' => true,
            'store' => $store,
            'data' => $updatedAppointment,
            'code' => 200,
            'meta' => [
                'previousCalendarState' => $previousCalendarState,
            ],
        ];
    }

    private function validatePaymentIntent(array $intent, array $appointment): array
    {
        $intentStatus = (string) ($intent['status'] ?? '');
        $tenantId = (string) ($appointment['tenantId'] ?? get_current_tenant_id());
        $expectedAmount = payment_expected_amount_cents(
            (string) ($appointment['service'] ?? ''),
            (string) ($appointment['date'] ?? ''),
            (string) ($appointment['time'] ?? ''),
            $tenantId
        );
        $intentAmount = isset($intent['amount']) ? (int) $intent['amount'] : 0;
        $amountReceived = isset($intent['amount_received']) ? (int) $intent['amount_received'] : 0;
        $intentCurrency = strtoupper((string) ($intent['currency'] ?? payment_currency()));
        $expectedCurrency = strtoupper(payment_currency());
        $intentMetadata = isset($intent['metadata']) && is_array($intent['metadata']) ? $intent['metadata'] : [];
        $metadataSite = trim((string) ($intentMetadata['site'] ?? ''));
        $metadataService = trim((string) ($intentMetadata['service'] ?? ''));
        $metadataDate = trim((string) ($intentMetadata['date'] ?? ''));
        $metadataTime = trim((string) ($intentMetadata['time'] ?? ''));
        $metadataDoctor = trim((string) ($intentMetadata['doctor'] ?? ''));
        $appointmentDoctor = trim((string) ($appointment['doctor'] ?? ''));

        if ($intentStatus !== 'succeeded') {
            return ['ok' => false, 'error' => 'El pago aun no esta completado', 'code' => 400];
        }
        if ($intentAmount !== $expectedAmount || $amountReceived < $expectedAmount) {
            return ['ok' => false, 'error' => 'El monto pagado no coincide con la reserva', 'code' => 400];
        }
        if ($intentCurrency !== $expectedCurrency) {
            return ['ok' => false, 'error' => 'La moneda del pago no coincide con la configuracion', 'code' => 400];
        }
        if ($metadataSite !== '' && strcasecmp($metadataSite, 'pielarmonia.com') !== 0) {
            return ['ok' => false, 'error' => 'El pago no pertenece a este sitio', 'code' => 400];
        }
        if ($metadataService !== '' && $metadataService !== (string) $appointment['service']) {
            return ['ok' => false, 'error' => 'El pago no coincide con el servicio seleccionado', 'code' => 400];
        }
        if ($metadataDate !== '' && $metadataDate !== (string) $appointment['date']) {
            return ['ok' => false, 'error' => 'El pago no coincide con la fecha seleccionada', 'code' => 400];
        }
        if ($metadataTime !== '' && $metadataTime !== (string) $appointment['time']) {
            return ['ok' => false, 'error' => 'El pago no coincide con la hora seleccionada', 'code' => 400];
        }
        if ($metadataDoctor !== '' && $appointmentDoctor !== '' && $metadataDoctor !== $appointmentDoctor) {
            return ['ok' => false, 'error' => 'El pago no coincide con el doctor seleccionado', 'code' => 400];
        }

        return ['ok' => true];
    }

    private function getConfiguredSlotsForDate(array $store, string $date): array
    {
        $slots = [];
        if (isset($store['availability'][$date]) && is_array($store['availability'][$date])) {
            $slots = $store['availability'][$date];
        }

        if (
            count($slots) === 0 &&
            function_exists('default_availability_enabled') &&
            default_availability_enabled() &&
            function_exists('get_default_availability')
        ) {
            $fallback = get_default_availability();
            if (isset($fallback[$date]) && is_array($fallback[$date])) {
                $slots = $fallback[$date];
            }
        }

        $normalized = [];
        foreach ($slots as $slot) {
            $time = trim((string) $slot);
            if (!preg_match('/^\d{2}:\d{2}$/', $time)) {
                continue;
            }
            $normalized[$time] = true;
        }

        $result = array_keys($normalized);
        sort($result, SORT_STRING);
        return $result;
    }
}

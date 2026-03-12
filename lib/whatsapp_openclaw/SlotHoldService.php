<?php

declare(strict_types=1);

final class WhatsappOpenclawSlotHoldService
{
    private WhatsappOpenclawRepository $repository;
    private CalendarBookingService $calendarBooking;

    public function __construct(WhatsappOpenclawRepository $repository, CalendarBookingService $calendarBooking)
    {
        $this->repository = $repository;
        $this->calendarBooking = $calendarBooking;
    }

    public function createOrRefresh(array $store, array $draft): array
    {
        $conversationId = (string) ($draft['conversationId'] ?? '');
        $phone = whatsapp_openclaw_normalize_phone((string) ($draft['phone'] ?? ''));
        $service = strtolower(trim((string) ($draft['service'] ?? '')));
        $date = trim((string) ($draft['date'] ?? ''));
        $time = trim((string) ($draft['time'] ?? ''));
        $requestedDoctor = strtolower(trim((string) ($draft['doctor'] ?? 'indiferente')));
        $paymentMethod = strtolower(trim((string) ($draft['paymentMethod'] ?? 'cash')));

        if ($conversationId === '' || $phone === '' || $service === '' || $date === '' || $time === '') {
            return ['ok' => false, 'error' => 'Draft incompleto para crear hold', 'code' => 400];
        }
        if ($requestedDoctor === '') {
            $requestedDoctor = 'indiferente';
        }

        $effectiveDoctor = $requestedDoctor;
        if ($requestedDoctor === 'indiferente') {
            $assigned = $this->calendarBooking->assignDoctorForIndiferente($store, $date, $time, $service);
            if (($assigned['ok'] ?? false) !== true) {
                return [
                    'ok' => false,
                    'error' => (string) ($assigned['error'] ?? 'No hay agenda disponible'),
                    'code' => (int) ($assigned['status'] ?? 409),
                    'errorCode' => (string) ($assigned['code'] ?? 'slot_unavailable'),
                ];
            }
            $effectiveDoctor = (string) ($assigned['doctor'] ?? 'indiferente');
        } else {
            $slotCheck = $this->calendarBooking->ensureSlotAvailable($store, $date, $time, $requestedDoctor, $service);
            if (($slotCheck['ok'] ?? false) !== true) {
                return [
                    'ok' => false,
                    'error' => (string) ($slotCheck['error'] ?? 'No hay agenda disponible'),
                    'code' => (int) ($slotCheck['status'] ?? 409),
                    'errorCode' => (string) ($slotCheck['code'] ?? 'slot_unavailable'),
                ];
            }
        }

        $idx = $store['idx_appointments_date'] ?? null;
        if (appointment_slot_taken($store['appointments'] ?? [], $date, $time, null, $effectiveDoctor, $idx)) {
            return ['ok' => false, 'error' => 'Ese horario ya fue reservado', 'code' => 409, 'errorCode' => 'slot_unavailable'];
        }

        foreach ($this->repository->listSlotHolds(['status' => 'active', 'date' => $date, 'doctor' => $effectiveDoctor]) as $hold) {
            if (($hold['conversationId'] ?? '') === $conversationId) {
                continue;
            }
            if (($hold['time'] ?? '') !== $time) {
                continue;
            }
            return ['ok' => false, 'error' => 'Ese horario ya esta retenido temporalmente', 'code' => 409, 'errorCode' => 'slot_held'];
        }

        $existingHoldId = trim((string) ($draft['holdId'] ?? ''));
        $existingHold = $existingHoldId !== '' ? $this->repository->getSlotHold($existingHoldId) : [];
        if (
            is_array($existingHold)
            && $existingHold !== []
            && ($existingHold['status'] ?? '') === 'active'
            && ($existingHold['date'] ?? '') === $date
            && ($existingHold['time'] ?? '') === $time
            && ($existingHold['doctor'] ?? '') === $effectiveDoctor
        ) {
            $existingHold['expiresAt'] = date('c', time() + WhatsappOpenclawConfig::slotHoldTtlForPaymentMethod($paymentMethod));
            $existingHold['paymentMethod'] = $paymentMethod;
            return ['ok' => true, 'data' => $this->repository->saveSlotHold($existingHold)];
        }

        if (is_array($existingHold) && $existingHold !== [] && ($existingHold['status'] ?? '') === 'active') {
            $this->release((string) ($existingHold['id'] ?? ''), 'replaced');
        }

        $hold = [
            'conversationId' => $conversationId,
            'draftId' => (string) ($draft['id'] ?? $conversationId),
            'phone' => $phone,
            'doctor' => $effectiveDoctor,
            'doctorRequested' => $requestedDoctor,
            'service' => $service,
            'date' => $date,
            'time' => $time,
            'paymentMethod' => $paymentMethod,
            'ttlSeconds' => WhatsappOpenclawConfig::slotHoldTtlForPaymentMethod($paymentMethod),
            'status' => 'active',
            'expiresAt' => date('c', time() + WhatsappOpenclawConfig::slotHoldTtlForPaymentMethod($paymentMethod)),
        ];

        return ['ok' => true, 'data' => $this->repository->saveSlotHold($hold)];
    }

    public function release(string $holdId, string $reason = 'released'): array
    {
        $hold = $this->repository->getSlotHold($holdId);
        if ($hold === []) {
            return ['ok' => false, 'error' => 'Hold no encontrado', 'code' => 404];
        }

        if (($hold['status'] ?? '') !== 'active') {
            return ['ok' => true, 'data' => $hold];
        }

        $hold['status'] = 'released';
        $hold['releaseReason'] = $reason;
        $hold['releasedAt'] = local_date('c');
        return ['ok' => true, 'data' => $this->repository->saveSlotHold($hold)];
    }

    public function consume(string $holdId, int $appointmentId = 0): array
    {
        $hold = $this->repository->getSlotHold($holdId);
        if ($hold === []) {
            return ['ok' => false, 'error' => 'Hold no encontrado', 'code' => 404];
        }

        $hold['status'] = 'consumed';
        $hold['appointmentId'] = $appointmentId;
        $hold['consumedAt'] = local_date('c');
        return ['ok' => true, 'data' => $this->repository->saveSlotHold($hold)];
    }

    public function isActiveForDraft(array $draft): bool
    {
        $holdId = trim((string) ($draft['holdId'] ?? ''));
        if ($holdId === '') {
            return false;
        }

        $hold = $this->repository->getSlotHold($holdId);
        return $hold !== [] && ($hold['status'] ?? '') === 'active';
    }

    public function activeForDate(string $date, string $doctor = ''): array
    {
        $filters = ['status' => 'active', 'date' => $date];
        if ($doctor !== '') {
            $filters['doctor'] = $doctor;
        }
        return $this->repository->listSlotHolds($filters);
    }
}

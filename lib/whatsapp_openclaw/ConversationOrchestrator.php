<?php

declare(strict_types=1);

require_once __DIR__ . '/../BookingService.php';

final class WhatsappOpenclawConversationOrchestrator
{
    private WhatsappOpenclawRepository $repository;
    private WhatsappOpenclawPlannerClient $planner;
    private WhatsappOpenclawSlotHoldService $slotHoldService;
    private BookingService $bookingService;
    private CalendarAvailabilityService $availabilityService;
    private CalendarBookingService $calendarBooking;

    public function __construct(
        WhatsappOpenclawRepository $repository,
        WhatsappOpenclawPlannerClient $planner,
        WhatsappOpenclawSlotHoldService $slotHoldService,
        ?BookingService $bookingService = null,
        ?CalendarAvailabilityService $availabilityService = null,
        ?CalendarBookingService $calendarBooking = null
    ) {
        $this->repository = $repository;
        $this->planner = $planner;
        $this->slotHoldService = $slotHoldService;
        $this->bookingService = $bookingService ?: new BookingService();
        $this->availabilityService = $availabilityService ?: CalendarAvailabilityService::fromEnv();
        $this->calendarBooking = $calendarBooking ?: CalendarBookingService::fromEnv();
    }

    public function handleInbound(array $store, array $event): array
    {
        $phone = whatsapp_openclaw_normalize_phone((string) ($event['phone'] ?? ''));
        $conversationId = trim((string) ($event['conversationId'] ?? ''));
        if ($conversationId === '') {
            $conversationId = $phone !== '' ? 'wa:' . $phone : 'wa:unknown';
        }

        $eventId = trim((string) ($event['eventId'] ?? ''));
        $providerMessageId = trim((string) ($event['providerMessageId'] ?? ''));

        $this->repository->expireSlotHolds();
        $this->repository->touchBridgeStatus('inbound');

        if ($this->repository->hasProcessedInbound($eventId, $providerMessageId)) {
            return [
                'ok' => true,
                'status' => 'duplicate',
                'store' => $store,
                'storeDirty' => false,
                'conversation' => $this->repository->getConversation($conversationId, $phone),
                'draft' => $this->repository->getBookingDraft($conversationId, $phone),
                'actions' => [],
                'reply' => '',
            ];
        }

        $conversation = $this->repository->getConversation($conversationId, $phone);
        $draft = $this->repository->getBookingDraft($conversationId, $phone);
        $conversation['phone'] = $phone;
        $conversation['lastInboundAt'] = local_date('c');
        $conversation['lastMessageAt'] = $conversation['lastInboundAt'];
        $conversation['lastProviderMessageId'] = $providerMessageId;
        $conversation['messageCount'] = max(0, (int) ($conversation['messageCount'] ?? 0)) + 1;

        if (trim((string) ($event['profileName'] ?? '')) !== '') {
            $meta = isset($conversation['meta']) && is_array($conversation['meta']) ? $conversation['meta'] : [];
            $meta['profileName'] = trim((string) $event['profileName']);
            $conversation['meta'] = $meta;
        }

        $inboundMessage = $this->repository->rememberInboundMessage([
            'eventId' => $eventId,
            'providerMessageId' => $providerMessageId,
            'conversationId' => $conversationId,
            'phone' => $phone,
            'text' => trim((string) ($event['text'] ?? '')),
            'media' => is_array($event['media'] ?? null) ? $event['media'] : [],
            'profileName' => trim((string) ($event['profileName'] ?? '')),
            'createdAt' => trim((string) ($event['receivedAt'] ?? local_date('c'))),
        ]);

        $plan = $this->planner->plan($conversation, $draft, $event);
        $draft = $this->applyDraftPatch($draft, is_array($plan['draftPatch'] ?? null) ? $plan['draftPatch'] : [], $event);
        $draft['conversationId'] = $conversationId;
        $draft['phone'] = $phone;

        $action = $this->applyIntent($store, $conversation, $draft, $plan);
        $draft = is_array($action['draft'] ?? null) ? $action['draft'] : $draft;
        $conversation = is_array($action['conversation'] ?? null) ? $action['conversation'] : $conversation;
        $store = is_array($action['store'] ?? null) ? $action['store'] : $store;
        $conversation['lastIntent'] = trim((string) ($plan['intent'] ?? ''));

        $reply = trim((string) ($action['reply'] ?? ($plan['reply'] ?? '')));
        $queued = [];
        if ($reply !== '') {
            $queuedRecord = $this->enqueueTextReply($conversation, $draft, $reply, [
                'intent' => (string) ($plan['intent'] ?? ''),
                'source' => (string) ($plan['source'] ?? ''),
                'inboundMessageId' => (string) ($inboundMessage['id'] ?? ''),
                'mutationMode' => (string) ($action['mutationMode'] ?? WhatsappOpenclawConfig::resolveMutationMode($phone)),
            ]);
            $queued[] = $queuedRecord;
            $conversation['outboundPending'] = max(0, (int) ($conversation['outboundPending'] ?? 0)) + 1;
        }

        $this->repository->saveBookingDraft($draft);
        $conversation = $this->repository->saveConversation($conversation);

        return [
            'ok' => true,
            'status' => 'processed',
            'store' => $store,
            'storeDirty' => (bool) ($action['storeDirty'] ?? false),
            'conversation' => $conversation,
            'draft' => $draft,
            'plan' => $plan,
            'actions' => is_array($action['actions'] ?? null) ? $action['actions'] : [],
            'reply' => $reply,
            'queuedOutbox' => $queued,
        ];
    }

    private function applyIntent(array $store, array $conversation, array $draft, array $plan): array
    {
        $intent = strtolower(trim((string) ($plan['intent'] ?? 'booking_collect')));
        $mutationMode = WhatsappOpenclawConfig::resolveMutationMode((string) ($draft['phone'] ?? ($conversation['phone'] ?? '')));
        $result = [
            'ok' => true,
            'store' => $store,
            'storeDirty' => false,
            'conversation' => $conversation,
            'draft' => $draft,
            'reply' => trim((string) ($plan['reply'] ?? '')),
            'actions' => [],
            'mutationMode' => $mutationMode,
        ];

        if (!WhatsappOpenclawConfig::isEnabled()) {
            $result['reply'] = 'La automatizacion de WhatsApp esta temporalmente deshabilitada.';
            return $result;
        }

        if ($intent === 'availability') {
            $result['reply'] = $this->buildAvailabilityReply($store, $draft, (string) ($plan['reply'] ?? ''));
            $result['actions'][] = 'availability_lookup';
            return $result;
        }

        if ($intent === 'faq') {
            $result['actions'][] = 'faq_reply';
            return $result;
        }

        if ($intent === 'cancel') {
            return $this->cancelAppointment($store, $conversation, $draft, $mutationMode);
        }

        if ($intent === 'reschedule') {
            return $this->rescheduleAppointment($store, $conversation, $draft, $mutationMode);
        }

        if ($intent === 'booking_cash') {
            return $this->bookCashAppointment($store, $conversation, $draft, $mutationMode);
        }

        if ($intent === 'booking_transfer') {
            return $this->bookTransferAppointment($store, $conversation, $draft, $mutationMode);
        }

        if ($intent === 'booking_card') {
            return $this->prepareCardCheckout($store, $conversation, $draft, $mutationMode);
        }

        if ($intent === 'booking_collect') {
            $result['reply'] = $this->enhanceCollectReply($store, $draft, (string) ($plan['reply'] ?? ''));
            $result['actions'][] = 'booking_collect';
        }

        return $result;
    }

    private function bookCashAppointment(array $store, array $conversation, array $draft, string $mutationMode): array
    {
        $hold = $this->slotHoldService->createOrRefresh($store, $draft);
        if (($hold['ok'] ?? false) !== true) {
            return $this->buildErrorResult(
                $store,
                $conversation,
                $draft,
                $mutationMode,
                (string) ($hold['error'] ?? 'No pude apartar ese horario'),
                'hold_failed'
            );
        }

        $holdData = is_array($hold['data'] ?? null) ? $hold['data'] : [];
        $draft['holdId'] = (string) ($holdData['id'] ?? ($draft['holdId'] ?? ''));
        $draft['doctor'] = (string) ($holdData['doctor'] ?? ($draft['doctor'] ?? ''));
        $draft['paymentMethod'] = 'cash';

        if ($mutationMode !== 'live') {
            return [
                'ok' => true,
                'store' => $store,
                'storeDirty' => false,
                'conversation' => $conversation,
                'draft' => $draft,
                'reply' => '[SIMULACION] Apartaria tu horario y registraria la cita para pago en consultorio.',
                'actions' => ['hold_created', 'booking_cash_dry_run'],
                'mutationMode' => $mutationMode,
            ];
        }

        $payload = $this->buildAppointmentPayload($draft, 'cash');
        $created = $this->bookingService->create($store, $payload);
        if (($created['ok'] ?? false) !== true) {
            return $this->buildErrorResult(
                $store,
                $conversation,
                $draft,
                $mutationMode,
                (string) ($created['error'] ?? 'No pude crear la cita en este momento'),
                'booking_cash_failed'
            );
        }

        $store = is_array($created['store'] ?? null) ? $created['store'] : $store;
        $appointment = is_array($created['data'] ?? null) ? $created['data'] : [];
        if (trim((string) ($draft['holdId'] ?? '')) !== '') {
            $this->slotHoldService->consume((string) $draft['holdId'], (int) ($appointment['id'] ?? 0));
        }

        $draft['appointmentId'] = (int) ($appointment['id'] ?? 0);
        $draft['status'] = 'booked';
        $draft['paymentStatus'] = (string) ($appointment['paymentStatus'] ?? 'pending_cash');
        $draft['doctor'] = (string) ($appointment['doctor'] ?? ($draft['doctor'] ?? ''));
        $conversation['status'] = 'booked';

        return [
            'ok' => true,
            'store' => $store,
            'storeDirty' => true,
            'conversation' => $conversation,
            'draft' => $draft,
            'reply' => $this->buildBookedReply($appointment, 'Tu cita quedo reservada para pago en consultorio.'),
            'actions' => ['hold_created', 'booking_cash_created'],
            'mutationMode' => $mutationMode,
        ];
    }

    private function bookTransferAppointment(array $store, array $conversation, array $draft, string $mutationMode): array
    {
        $reference = trim((string) ($draft['transferReference'] ?? ''));
        $proof = $this->resolveTransferProof($draft);
        if ($reference === '') {
            return [
                'ok' => true,
                'store' => $store,
                'storeDirty' => false,
                'conversation' => $conversation,
                'draft' => $draft,
                'reply' => 'Para cerrar por transferencia me falta el numero de referencia del comprobante.',
                'actions' => ['booking_transfer_missing_reference'],
                'mutationMode' => $mutationMode,
            ];
        }
        if (($proof['transferProofUrl'] ?? '') === '') {
            return [
                'ok' => true,
                'store' => $store,
                'storeDirty' => false,
                'conversation' => $conversation,
                'draft' => $draft,
                'reply' => 'Para cerrar por transferencia necesito que me envies el comprobante por este chat.',
                'actions' => ['booking_transfer_missing_proof'],
                'mutationMode' => $mutationMode,
            ];
        }

        $hold = $this->slotHoldService->createOrRefresh($store, $draft);
        if (($hold['ok'] ?? false) !== true) {
            return $this->buildErrorResult(
                $store,
                $conversation,
                $draft,
                $mutationMode,
                (string) ($hold['error'] ?? 'No pude apartar ese horario'),
                'hold_failed'
            );
        }

        $holdData = is_array($hold['data'] ?? null) ? $hold['data'] : [];
        $draft['holdId'] = (string) ($holdData['id'] ?? ($draft['holdId'] ?? ''));
        $draft['doctor'] = (string) ($holdData['doctor'] ?? ($draft['doctor'] ?? ''));
        $draft['paymentMethod'] = 'transfer';

        if ($mutationMode !== 'live') {
            return [
                'ok' => true,
                'store' => $store,
                'storeDirty' => false,
                'conversation' => $conversation,
                'draft' => $draft,
                'reply' => '[SIMULACION] Registraria tu cita con transferencia pendiente de revision.',
                'actions' => ['hold_created', 'booking_transfer_dry_run'],
                'mutationMode' => $mutationMode,
            ];
        }

        $payload = array_merge($this->buildAppointmentPayload($draft, 'transfer'), $proof);
        $created = $this->bookingService->create($store, $payload);
        if (($created['ok'] ?? false) !== true) {
            return $this->buildErrorResult(
                $store,
                $conversation,
                $draft,
                $mutationMode,
                (string) ($created['error'] ?? 'No pude registrar la cita con transferencia'),
                'booking_transfer_failed'
            );
        }

        $store = is_array($created['store'] ?? null) ? $created['store'] : $store;
        $appointment = is_array($created['data'] ?? null) ? $created['data'] : [];
        if (trim((string) ($draft['holdId'] ?? '')) !== '') {
            $this->slotHoldService->consume((string) $draft['holdId'], (int) ($appointment['id'] ?? 0));
        }

        $draft['appointmentId'] = (int) ($appointment['id'] ?? 0);
        $draft['status'] = 'booked';
        $draft['paymentStatus'] = (string) ($appointment['paymentStatus'] ?? 'pending_transfer_review');
        $draft['doctor'] = (string) ($appointment['doctor'] ?? ($draft['doctor'] ?? ''));
        $conversation['status'] = 'booked';

        return [
            'ok' => true,
            'store' => $store,
            'storeDirty' => true,
            'conversation' => $conversation,
            'draft' => $draft,
            'reply' => $this->buildBookedReply($appointment, 'Recibi tu comprobante y la cita queda pendiente de verificacion.'),
            'actions' => ['hold_created', 'booking_transfer_created'],
            'mutationMode' => $mutationMode,
        ];
    }

    private function prepareCardCheckout(array $store, array $conversation, array $draft, string $mutationMode): array
    {
        $hold = $this->slotHoldService->createOrRefresh($store, $draft);
        if (($hold['ok'] ?? false) !== true) {
            return $this->buildErrorResult(
                $store,
                $conversation,
                $draft,
                $mutationMode,
                (string) ($hold['error'] ?? 'No pude apartar ese horario'),
                'hold_failed'
            );
        }

        $holdData = is_array($hold['data'] ?? null) ? $hold['data'] : [];
        $draft['holdId'] = (string) ($holdData['id'] ?? ($draft['holdId'] ?? ''));
        $draft['doctor'] = (string) ($holdData['doctor'] ?? ($draft['doctor'] ?? ''));
        $draft['paymentMethod'] = 'card';

        if ($mutationMode !== 'live') {
            return [
                'ok' => true,
                'store' => $store,
                'storeDirty' => false,
                'conversation' => $conversation,
                'draft' => $draft,
                'reply' => '[SIMULACION] Apartaria el horario y te enviaria el checkout seguro para terminar el pago.',
                'actions' => ['hold_created', 'booking_card_dry_run'],
                'mutationMode' => $mutationMode,
            ];
        }

        if (!function_exists('stripe_create_checkout_session') || !payment_gateway_enabled()) {
            return $this->buildErrorResult(
                $store,
                $conversation,
                $draft,
                $mutationMode,
                'No tengo disponible el checkout con tarjeta en este momento.',
                'booking_card_unavailable'
            );
        }

        $seed = implode('|', [
            (string) ($draft['conversationId'] ?? ''),
            (string) ($draft['phone'] ?? ''),
            (string) ($draft['service'] ?? ''),
            (string) ($draft['date'] ?? ''),
            (string) ($draft['time'] ?? ''),
            (string) ($draft['doctor'] ?? ''),
        ]);

        try {
            $checkoutSession = stripe_create_checkout_session(
                $this->buildAppointmentPayload($draft, 'card'),
                WhatsappOpenclawConfig::checkoutSuccessUrl(),
                WhatsappOpenclawConfig::checkoutCancelUrl(),
                [
                    'source' => 'whatsapp_openclaw',
                    'wa_conversation_id' => (string) ($draft['conversationId'] ?? ''),
                    'wa_draft_id' => (string) ($draft['id'] ?? $draft['conversationId'] ?? ''),
                    'wa_hold_id' => (string) ($draft['holdId'] ?? ''),
                    'wa_phone' => (string) ($draft['phone'] ?? ''),
                ],
                payment_build_idempotency_key('wa-checkout', $seed)
            );
        } catch (RuntimeException $e) {
            return $this->buildErrorResult(
                $store,
                $conversation,
                $draft,
                $mutationMode,
                'No pude generar el enlace de pago seguro en este momento.',
                'booking_card_checkout_failed'
            );
        }

        $draft['paymentSessionId'] = (string) ($checkoutSession['id'] ?? '');
        $draft['paymentSessionUrl'] = (string) ($checkoutSession['url'] ?? '');
        $draft['paymentIntentId'] = trim((string) ($checkoutSession['payment_intent'] ?? ($draft['paymentIntentId'] ?? '')));
        $draft['paymentStatus'] = 'checkout_pending';
        $draft['status'] = 'awaiting_payment';
        $conversation['status'] = 'awaiting_payment';

        $reply = 'Tengo ese horario apartado por unos minutos. Completa el pago seguro aqui: '
            . (string) ($draft['paymentSessionUrl'] ?? '')
            . ' Cuando Stripe confirme el pago, te respondere por este mismo chat con la cita cerrada.';

        return [
            'ok' => true,
            'store' => $store,
            'storeDirty' => false,
            'conversation' => $conversation,
            'draft' => $draft,
            'reply' => $reply,
            'actions' => ['hold_created', 'booking_card_checkout_ready'],
            'mutationMode' => $mutationMode,
        ];
    }

    public function finalizeCardCheckout(array $store, array $session): array
    {
        $context = $this->resolveCheckoutContext($session);
        if (($context['ok'] ?? false) !== true) {
            return [
                'ok' => true,
                'ignored' => true,
                'store' => $store,
                'storeDirty' => false,
                'status' => 'ignored',
            ];
        }

        $conversation = is_array($context['conversation'] ?? null) ? $context['conversation'] : [];
        $draft = is_array($context['draft'] ?? null) ? $context['draft'] : [];
        $sessionId = trim((string) ($session['id'] ?? ''));
        $paymentIntentId = trim((string) ($session['payment_intent'] ?? ''));
        $paymentStatus = strtolower(trim((string) ($session['payment_status'] ?? 'paid')));

        $draft['paymentSessionId'] = $sessionId !== '' ? $sessionId : (string) ($draft['paymentSessionId'] ?? '');
        $draft['paymentSessionUrl'] = trim((string) ($draft['paymentSessionUrl'] ?? ''));
        $draft['paymentIntentId'] = $paymentIntentId !== '' ? $paymentIntentId : (string) ($draft['paymentIntentId'] ?? '');

        if ((int) ($draft['appointmentId'] ?? 0) > 0 || ($draft['status'] ?? '') === 'booked') {
            $draft['paymentStatus'] = $paymentStatus === 'paid' ? 'paid' : (string) ($draft['paymentStatus'] ?? 'paid');
            $this->repository->saveBookingDraft($draft);
            return [
                'ok' => true,
                'ignored' => false,
                'store' => $store,
                'storeDirty' => false,
                'status' => 'already_booked',
                'appointmentId' => (int) ($draft['appointmentId'] ?? 0),
            ];
        }

        if ($paymentStatus !== 'paid' || trim((string) ($draft['paymentIntentId'] ?? '')) === '') {
            $draft['status'] = 'awaiting_payment';
            $draft['paymentStatus'] = 'checkout_pending';
            $this->repository->saveBookingDraft($draft);
            return [
                'ok' => true,
                'ignored' => false,
                'store' => $store,
                'storeDirty' => false,
                'status' => 'awaiting_payment',
            ];
        }

        $payload = $this->buildAppointmentPayload($draft, 'card');
        $payload['paymentIntentId'] = (string) $draft['paymentIntentId'];
        $payload['paymentProvider'] = 'stripe';
        $payload['paymentStatus'] = 'paid';

        $created = $this->bookingService->create($store, $payload);
        if (($created['ok'] ?? false) !== true) {
            if (trim((string) ($draft['holdId'] ?? '')) !== '') {
                $this->slotHoldService->release((string) $draft['holdId'], 'checkout_paid_booking_failed');
            }

            $draft['status'] = 'payment_review';
            $draft['paymentStatus'] = 'paid_needs_review';
            $draft = $this->appendDraftNote(
                $draft,
                'booking_card_finalize_failed',
                (string) ($created['error'] ?? 'No se pudo cerrar la cita despues del pago')
            );
            $conversation['status'] = 'payment_review';

            $queued = $this->enqueueTextReply(
                $conversation,
                $draft,
                'Recibi tu pago, pero no pude cerrar la reserva automaticamente. Te escribiremos enseguida para confirmarla.',
                [
                    'intent' => 'booking_card',
                    'source' => 'stripe_webhook',
                    'paymentIntentId' => (string) $draft['paymentIntentId'],
                ]
            );
            $conversation['outboundPending'] = max(0, (int) ($conversation['outboundPending'] ?? 0)) + 1;
            $this->repository->saveBookingDraft($draft);
            $this->repository->saveConversation($conversation);

            return [
                'ok' => true,
                'ignored' => false,
                'store' => $store,
                'storeDirty' => false,
                'status' => 'manual_review',
                'error' => (string) ($created['error'] ?? ''),
                'queuedOutbox' => [$queued],
            ];
        }

        $store = is_array($created['store'] ?? null) ? $created['store'] : $store;
        $appointment = is_array($created['data'] ?? null) ? $created['data'] : [];
        if (trim((string) ($draft['holdId'] ?? '')) !== '') {
            $this->slotHoldService->consume((string) $draft['holdId'], (int) ($appointment['id'] ?? 0));
        }

        $draft['appointmentId'] = (int) ($appointment['id'] ?? 0);
        $draft['status'] = 'booked';
        $draft['paymentStatus'] = 'paid';
        $draft['doctor'] = (string) ($appointment['doctor'] ?? ($draft['doctor'] ?? ''));
        $conversation['status'] = 'booked';

        $queued = $this->enqueueTextReply(
            $conversation,
            $draft,
            $this->buildBookedReply($appointment, 'Pago confirmado con tarjeta.'),
            [
                'intent' => 'booking_card',
                'source' => 'stripe_webhook',
                'paymentIntentId' => (string) ($draft['paymentIntentId'] ?? ''),
            ]
        );
        $conversation['outboundPending'] = max(0, (int) ($conversation['outboundPending'] ?? 0)) + 1;

        $this->repository->saveBookingDraft($draft);
        $this->repository->saveConversation($conversation);

        return [
            'ok' => true,
            'ignored' => false,
            'store' => $store,
            'storeDirty' => true,
            'status' => 'booked',
            'appointmentId' => (int) ($appointment['id'] ?? 0),
            'queuedOutbox' => [$queued],
        ];
    }

    public function expireCardCheckout(array $store, array $session): array
    {
        $context = $this->resolveCheckoutContext($session);
        if (($context['ok'] ?? false) !== true) {
            return [
                'ok' => true,
                'ignored' => true,
                'store' => $store,
                'storeDirty' => false,
                'status' => 'ignored',
            ];
        }

        $conversation = is_array($context['conversation'] ?? null) ? $context['conversation'] : [];
        $draft = is_array($context['draft'] ?? null) ? $context['draft'] : [];
        if ((int) ($draft['appointmentId'] ?? 0) > 0 || in_array((string) ($draft['paymentStatus'] ?? ''), ['paid', 'paid_needs_review'], true)) {
            return [
                'ok' => true,
                'ignored' => false,
                'store' => $store,
                'storeDirty' => false,
                'status' => 'already_paid',
            ];
        }

        if (($draft['status'] ?? '') === 'checkout_expired') {
            return [
                'ok' => true,
                'ignored' => false,
                'store' => $store,
                'storeDirty' => false,
                'status' => 'already_expired',
            ];
        }

        if (trim((string) ($draft['holdId'] ?? '')) !== '') {
            $this->slotHoldService->release((string) $draft['holdId'], 'checkout_expired');
        }

        $draft['status'] = 'checkout_expired';
        $draft['paymentStatus'] = 'checkout_expired';
        $conversation['status'] = 'payment_expired';

        $queued = $this->enqueueTextReply(
            $conversation,
            $draft,
            'El enlace de pago expiro y libere el horario. Si quieres, te genero uno nuevo por este chat.',
            [
                'intent' => 'booking_card',
                'source' => 'stripe_webhook',
                'sessionStatus' => 'expired',
            ]
        );
        $conversation['outboundPending'] = max(0, (int) ($conversation['outboundPending'] ?? 0)) + 1;

        $this->repository->saveBookingDraft($draft);
        $this->repository->saveConversation($conversation);

        return [
            'ok' => true,
            'ignored' => false,
            'store' => $store,
            'storeDirty' => false,
            'status' => 'expired',
            'queuedOutbox' => [$queued],
        ];
    }

    public function expireCheckoutForOps(array $store, array $draft): array
    {
        if (!$this->isPendingCardCheckout($draft) && ($draft['status'] ?? '') !== 'checkout_expired') {
            if ((int) ($draft['appointmentId'] ?? 0) > 0 || in_array((string) ($draft['paymentStatus'] ?? ''), ['paid', 'paid_needs_review'], true)) {
                return [
                    'ok' => true,
                    'ignored' => false,
                    'store' => $store,
                    'storeDirty' => false,
                    'status' => 'already_paid',
                    'conversation' => $this->repository->getConversation(
                        (string) ($draft['conversationId'] ?? ''),
                        (string) ($draft['phone'] ?? '')
                    ),
                    'draft' => $draft,
                ];
            }

            return [
                'ok' => false,
                'error' => 'El draft no tiene un checkout de tarjeta pendiente',
                'code' => 409,
            ];
        }

        $result = $this->expireCardCheckout($store, $this->buildOpsCheckoutSession($draft));
        if (($result['ok'] ?? false) === true) {
            $conversationId = (string) ($draft['conversationId'] ?? '');
            $phone = (string) ($draft['phone'] ?? '');
            $result['conversation'] = $this->repository->getConversation($conversationId, $phone);
            $result['draft'] = $this->repository->getBookingDraft($conversationId, $phone);
        }

        return $result;
    }

    public function expireStaleCheckouts(array $store, int $limit = 25): array
    {
        $limit = max(1, min(100, $limit));
        $expired = [];

        foreach ($this->repository->listBookingDrafts([], 200) as $draft) {
            if (count($expired) >= $limit) {
                break;
            }
            if (!$this->isPendingCardCheckout($draft)) {
                continue;
            }

            $holdId = trim((string) ($draft['holdId'] ?? ''));
            $hold = $holdId !== '' ? $this->repository->getSlotHold($holdId) : [];
            $holdStatus = (string) ($hold['status'] ?? '');
            if ($holdStatus === 'active') {
                continue;
            }

            $result = $this->expireCheckoutForOps($store, $draft);
            if (($result['ok'] ?? false) !== true) {
                continue;
            }

            $store = is_array($result['store'] ?? null) ? $result['store'] : $store;
            $expired[] = [
                'status' => (string) ($result['status'] ?? ''),
                'holdStatus' => $holdStatus !== '' ? $holdStatus : 'missing',
                'conversation' => is_array($result['conversation'] ?? null) ? $result['conversation'] : [],
                'draft' => is_array($result['draft'] ?? null) ? $result['draft'] : [],
                'queuedOutbox' => is_array($result['queuedOutbox'] ?? null) ? $result['queuedOutbox'] : [],
            ];
        }

        return [
            'ok' => true,
            'store' => $store,
            'storeDirty' => false,
            'status' => 'swept',
            'expiredCount' => count($expired),
            'items' => $expired,
        ];
    }

    public function releaseHoldForOps(array $store, string $holdId, string $reason = 'admin_release', bool $notify = false): array
    {
        $hold = $this->repository->getSlotHold($holdId);
        if ($hold === []) {
            return ['ok' => false, 'error' => 'Hold no encontrado', 'code' => 404];
        }

        $conversationId = (string) ($hold['conversationId'] ?? '');
        $phone = (string) ($hold['phone'] ?? '');
        $conversation = $this->repository->getConversation($conversationId, $phone);
        $draft = $this->repository->getBookingDraft($conversationId, $phone);

        if ((int) ($draft['appointmentId'] ?? 0) > 0 || in_array((string) ($draft['paymentStatus'] ?? ''), ['paid', 'paid_needs_review'], true)) {
            return [
                'ok' => false,
                'error' => 'El hold ya esta asociado a una reserva cerrada y no se puede liberar manualmente',
                'code' => 409,
            ];
        }

        $paymentMethod = strtolower(trim((string) ($draft['paymentMethod'] ?? ($hold['paymentMethod'] ?? ''))));
        if ($paymentMethod === 'card' || trim((string) ($draft['paymentSessionId'] ?? '')) !== '') {
            return [
                'ok' => false,
                'error' => 'Usa expire_checkout para liberar reservas con checkout de tarjeta activo',
                'code' => 409,
            ];
        }

        $holdStatus = (string) ($hold['status'] ?? '');
        if ($holdStatus !== 'active') {
            return [
                'ok' => true,
                'store' => $store,
                'storeDirty' => false,
                'status' => $holdStatus !== '' ? 'already_' . $holdStatus : 'already_released',
                'hold' => $hold,
                'draft' => $draft,
                'conversation' => $conversation,
                'queuedOutbox' => [],
            ];
        }

        $released = $this->slotHoldService->release($holdId, $reason);
        if (($released['ok'] ?? false) !== true) {
            return $released;
        }

        $hold = is_array($released['data'] ?? null) ? $released['data'] : $hold;
        if ((string) ($draft['holdId'] ?? '') === $holdId && (int) ($draft['appointmentId'] ?? 0) <= 0) {
            $draft['status'] = 'collecting';
            $draft = $this->appendDraftNote($draft, 'hold_released', 'Operaciones libero manualmente el horario retenido.');
            if (($conversation['status'] ?? '') !== 'cancelled') {
                $conversation['status'] = 'active';
            }
        }

        $queued = [];
        if ($notify) {
            $queued[] = $this->enqueueTextReply(
                $conversation,
                $draft,
                'Liberé el horario temporal que tenías apartado. Si quieres, te propongo otro por este mismo chat.',
                [
                    'intent' => 'ops_release_hold',
                    'source' => 'ops',
                    'holdId' => $holdId,
                ]
            );
            $conversation['outboundPending'] = max(0, (int) ($conversation['outboundPending'] ?? 0)) + 1;
        }

        $draft = $this->repository->saveBookingDraft($draft);
        $conversation = $this->repository->saveConversation($conversation);

        return [
            'ok' => true,
            'store' => $store,
            'storeDirty' => false,
            'status' => 'released',
            'hold' => $hold,
            'draft' => $draft,
            'conversation' => $conversation,
            'queuedOutbox' => $queued,
        ];
    }

    private function cancelAppointment(array $store, array $conversation, array $draft, string $mutationMode): array
    {
        $appointments = $this->repository->findAppointmentsByPhone($store, (string) ($draft['phone'] ?? ''), true);
        if ($appointments === []) {
            return [
                'ok' => true,
                'store' => $store,
                'storeDirty' => false,
                'conversation' => $conversation,
                'draft' => $draft,
                'reply' => 'No encontre una cita futura asociada a este numero para cancelar.',
                'actions' => ['cancel_not_found'],
                'mutationMode' => $mutationMode,
            ];
        }

        $target = $appointments[0];
        if ($mutationMode !== 'live') {
            return [
                'ok' => true,
                'store' => $store,
                'storeDirty' => false,
                'conversation' => $conversation,
                'draft' => $draft,
                'reply' => '[SIMULACION] Cancelaria tu cita del ' . format_date_label((string) ($target['date'] ?? '')) . ' a las ' . (string) ($target['time'] ?? '') . '.',
                'actions' => ['cancel_dry_run'],
                'mutationMode' => $mutationMode,
            ];
        }

        $cancelled = $this->bookingService->cancel($store, (int) ($target['id'] ?? 0));
        if (($cancelled['ok'] ?? false) !== true) {
            return $this->buildErrorResult(
                $store,
                $conversation,
                $draft,
                $mutationMode,
                (string) ($cancelled['error'] ?? 'No pude cancelar la cita'),
                'cancel_failed'
            );
        }

        $store = is_array($cancelled['store'] ?? null) ? $cancelled['store'] : $store;
        $appointment = is_array($cancelled['data'] ?? null) ? $cancelled['data'] : $target;
        if ($this->calendarBooking->isGoogleActive()) {
            $this->calendarBooking->cancelCalendarEvent($appointment);
        }
        if (trim((string) ($draft['holdId'] ?? '')) !== '') {
            $this->slotHoldService->release((string) $draft['holdId'], 'appointment_cancelled');
        }

        $draft['status'] = 'cancelled';
        $conversation['status'] = 'cancelled';

        return [
            'ok' => true,
            'store' => $store,
            'storeDirty' => true,
            'conversation' => $conversation,
            'draft' => $draft,
            'reply' => 'Listo, cancele tu cita del ' . format_date_label((string) ($appointment['date'] ?? '')) . ' a las ' . (string) ($appointment['time'] ?? '') . '.',
            'actions' => ['appointment_cancelled'],
            'mutationMode' => $mutationMode,
        ];
    }

    private function rescheduleAppointment(array $store, array $conversation, array $draft, string $mutationMode): array
    {
        $appointments = $this->repository->findAppointmentsByPhone($store, (string) ($draft['phone'] ?? ''), true);
        if ($appointments === []) {
            return [
                'ok' => true,
                'store' => $store,
                'storeDirty' => false,
                'conversation' => $conversation,
                'draft' => $draft,
                'reply' => 'No encontre una cita futura asociada a este numero para reprogramar.',
                'actions' => ['reschedule_not_found'],
                'mutationMode' => $mutationMode,
            ];
        }
        if (trim((string) ($draft['date'] ?? '')) === '' || trim((string) ($draft['time'] ?? '')) === '') {
            return [
                'ok' => true,
                'store' => $store,
                'storeDirty' => false,
                'conversation' => $conversation,
                'draft' => $draft,
                'reply' => 'Para reprogramar necesito que me envies la nueva fecha y hora en formato YYYY-MM-DD y HH:MM.',
                'actions' => ['reschedule_missing_slot'],
                'mutationMode' => $mutationMode,
            ];
        }

        $target = $appointments[0];
        if ($mutationMode !== 'live') {
            return [
                'ok' => true,
                'store' => $store,
                'storeDirty' => false,
                'conversation' => $conversation,
                'draft' => $draft,
                'reply' => '[SIMULACION] Reprogramaria tu cita para ' . format_date_label((string) ($draft['date'] ?? '')) . ' a las ' . (string) ($draft['time'] ?? '') . '.',
                'actions' => ['reschedule_dry_run'],
                'mutationMode' => $mutationMode,
            ];
        }

        $token = trim((string) ($target['rescheduleToken'] ?? ''));
        if ($token === '') {
            return $this->buildErrorResult(
                $store,
                $conversation,
                $draft,
                $mutationMode,
                'La cita no tiene token de reprogramacion disponible.',
                'reschedule_missing_token'
            );
        }

        $rescheduled = $this->bookingService->reschedule($store, $token, (string) ($draft['date'] ?? ''), (string) ($draft['time'] ?? ''));
        if (($rescheduled['ok'] ?? false) !== true) {
            return $this->buildErrorResult(
                $store,
                $conversation,
                $draft,
                $mutationMode,
                (string) ($rescheduled['error'] ?? 'No pude reprogramar la cita'),
                'reschedule_failed'
            );
        }

        $store = is_array($rescheduled['store'] ?? null) ? $rescheduled['store'] : $store;
        $appointment = is_array($rescheduled['data'] ?? null) ? $rescheduled['data'] : $target;
        $draft['doctor'] = (string) ($appointment['doctor'] ?? ($draft['doctor'] ?? ''));
        $draft['status'] = 'rescheduled';
        $conversation['status'] = 'rescheduled';

        return [
            'ok' => true,
            'store' => $store,
            'storeDirty' => true,
            'conversation' => $conversation,
            'draft' => $draft,
            'reply' => 'Listo, reprogramé tu cita para ' . format_date_label((string) ($appointment['date'] ?? '')) . ' a las ' . (string) ($appointment['time'] ?? '') . '.',
            'actions' => ['appointment_rescheduled'],
            'mutationMode' => $mutationMode,
        ];
    }

    private function buildErrorResult(
        array $store,
        array $conversation,
        array $draft,
        string $mutationMode,
        string $message,
        string $action
    ): array {
        return [
            'ok' => true,
            'store' => $store,
            'storeDirty' => false,
            'conversation' => $conversation,
            'draft' => $draft,
            'reply' => $message,
            'actions' => [$action],
            'mutationMode' => $mutationMode,
        ];
    }

    private function applyDraftPatch(array $draft, array $patch, array $event): array
    {
        foreach ([
            'service',
            'doctor',
            'date',
            'time',
            'name',
            'email',
            'paymentMethod',
            'privacyConsent',
            'privacyConsentAt',
        ] as $field) {
            if (!array_key_exists($field, $patch)) {
                continue;
            }
            $draft[$field] = $patch[$field];
        }

        if (isset($patch['mediaProofRefs']) && is_array($patch['mediaProofRefs'])) {
            $draft['mediaProofRefs'] = $this->mergeMediaProofRefs(
                is_array($draft['mediaProofRefs'] ?? null) ? $draft['mediaProofRefs'] : [],
                $patch['mediaProofRefs']
            );
        }

        if (trim((string) ($draft['transferReference'] ?? '')) === '') {
            $draft['transferReference'] = $this->extractTransferReference((string) ($event['text'] ?? ''));
        }

        if (($draft['privacyConsent'] ?? false) === true && trim((string) ($draft['privacyConsentAt'] ?? '')) === '') {
            $draft['privacyConsentAt'] = local_date('c');
        }

        return $draft;
    }

    private function mergeMediaProofRefs(array $current, array $incoming): array
    {
        $seen = [];
        $merged = [];
        foreach (array_merge($current, $incoming) as $item) {
            if (!is_array($item)) {
                continue;
            }
            $url = trim((string) ($item['url'] ?? ''));
            $providerMediaId = trim((string) ($item['providerMediaId'] ?? ($item['id'] ?? '')));
            $key = $providerMediaId !== '' ? 'id:' . $providerMediaId : 'url:' . $url;
            if ($key === 'url:' || isset($seen[$key])) {
                continue;
            }
            $seen[$key] = true;
            $merged[] = [
                'url' => $url,
                'mime' => trim((string) ($item['mime'] ?? '')),
                'name' => trim((string) ($item['name'] ?? '')),
                'providerMediaId' => $providerMediaId,
            ];
        }
        return $merged;
    }

    private function extractTransferReference(string $text): string
    {
        if (preg_match('/(?:referencia|ref|comprobante)[^A-Za-z0-9]{0,4}([A-Za-z0-9\-]{4,32})/iu', $text, $matches) === 1) {
            return trim((string) ($matches[1] ?? ''));
        }
        return '';
    }

    private function buildAppointmentPayload(array $draft, string $paymentMethod): array
    {
        return [
            'service' => (string) ($draft['service'] ?? ''),
            'doctor' => trim((string) ($draft['doctor'] ?? '')) !== '' ? (string) $draft['doctor'] : 'indiferente',
            'date' => (string) ($draft['date'] ?? ''),
            'time' => (string) ($draft['time'] ?? ''),
            'name' => (string) ($draft['name'] ?? ''),
            'email' => (string) ($draft['email'] ?? ''),
            'phone' => (string) ($draft['phone'] ?? ''),
            'privacyConsent' => (bool) ($draft['privacyConsent'] ?? false),
            'privacyConsentAt' => (string) ($draft['privacyConsentAt'] ?? ''),
            'paymentMethod' => $paymentMethod,
            'transferReference' => (string) ($draft['transferReference'] ?? ''),
            'reason' => 'WhatsApp OpenClaw',
        ];
    }

    private function resolveTransferProof(array $draft): array
    {
        $refs = is_array($draft['mediaProofRefs'] ?? null) ? $draft['mediaProofRefs'] : [];
        $first = isset($refs[0]) && is_array($refs[0]) ? $refs[0] : [];
        $url = trim((string) ($first['url'] ?? ''));
        return [
            'transferReference' => trim((string) ($draft['transferReference'] ?? '')),
            'transferProofPath' => $url,
            'transferProofUrl' => $url,
            'transferProofName' => trim((string) ($first['name'] ?? 'whatsapp-proof')),
            'transferProofMime' => trim((string) ($first['mime'] ?? 'application/octet-stream')),
        ];
    }

    private function buildOpsCheckoutSession(array $draft): array
    {
        $conversationId = (string) ($draft['conversationId'] ?? ($draft['id'] ?? ''));
        return [
            'id' => (string) ($draft['paymentSessionId'] ?? ''),
            'payment_status' => 'unpaid',
            'payment_intent' => (string) ($draft['paymentIntentId'] ?? ''),
            'client_reference_id' => $conversationId,
            'metadata' => [
                'source' => 'whatsapp_openclaw',
                'wa_conversation_id' => $conversationId,
                'wa_draft_id' => (string) ($draft['id'] ?? $conversationId),
                'wa_hold_id' => (string) ($draft['holdId'] ?? ''),
                'wa_phone' => (string) ($draft['phone'] ?? ''),
            ],
        ];
    }

    private function resolveCheckoutContext(array $session): array
    {
        $metadata = isset($session['metadata']) && is_array($session['metadata']) ? $session['metadata'] : [];
        if (strtolower(trim((string) ($metadata['source'] ?? ''))) !== 'whatsapp_openclaw') {
            return ['ok' => false];
        }

        $conversationId = trim((string) ($metadata['wa_conversation_id'] ?? ($session['client_reference_id'] ?? '')));
        $phone = trim((string) ($metadata['wa_phone'] ?? ''));
        if ($conversationId === '' && $phone === '') {
            return ['ok' => false];
        }

        return [
            'ok' => true,
            'conversation' => $this->repository->getConversation($conversationId, $phone),
            'draft' => $this->repository->getBookingDraft($conversationId, $phone),
        ];
    }

    private function appendDraftNote(array $draft, string $type, string $message): array
    {
        $notes = is_array($draft['notes'] ?? null) ? $draft['notes'] : [];
        $notes[] = [
            'type' => $type,
            'message' => truncate_field($message, 240),
            'createdAt' => local_date('c'),
        ];
        $draft['notes'] = array_slice($notes, -10);
        return $draft;
    }

    private function buildBookedReply(array $appointment, string $tail): string
    {
        $service = get_service_label((string) ($appointment['service'] ?? 'consulta'));
        $doctor = get_doctor_label((string) ($appointment['doctor'] ?? ''));
        $date = format_date_label((string) ($appointment['date'] ?? ''));
        $time = (string) ($appointment['time'] ?? '');
        return 'Listo. ' . $service . ' con ' . $doctor . ' para ' . $date . ' a las ' . $time . '. ' . $tail;
    }

    private function buildAvailabilityReply(array $store, array $draft, string $fallback): string
    {
        $service = trim((string) ($draft['service'] ?? 'consulta'));
        if ($service === '') {
            $service = 'consulta';
        }
        $doctor = trim((string) ($draft['doctor'] ?? 'indiferente'));
        if ($doctor === '') {
            $doctor = 'indiferente';
        }

        $dateFrom = trim((string) ($draft['date'] ?? ''));
        if ($dateFrom === '') {
            $dateFrom = local_date('Y-m-d');
        }

        $availability = $this->availabilityService->getAvailability($store, [
            'service' => $service,
            'doctor' => $doctor,
            'dateFrom' => $dateFrom,
            'days' => 4,
        ]);
        if (($availability['ok'] ?? false) !== true) {
            return $fallback !== '' ? $fallback : (string) ($availability['error'] ?? 'No pude consultar disponibilidad en este momento.');
        }

        $data = isset($availability['data']) && is_array($availability['data']) ? $availability['data'] : [];
        $requestedDate = trim((string) ($draft['date'] ?? ''));
        $requestedTime = trim((string) ($draft['time'] ?? ''));

        if ($requestedDate !== '' && $requestedTime !== '') {
            $requestedSlots = isset($data[$requestedDate]) && is_array($data[$requestedDate]) ? $data[$requestedDate] : [];
            if (in_array($requestedTime, $requestedSlots, true)) {
                return 'Ese horario sigue disponible. ' . $this->buildMissingFieldsReply($draft);
            }

            $alternatives = array_slice($requestedSlots, 0, 4);
            if ($alternatives !== []) {
                return 'Ese horario ya no esta libre. Te puedo ofrecer el ' . format_date_label($requestedDate) . ' a las ' . implode(', ', $alternatives) . '.';
            }
        }

        $parts = [];
        foreach ($data as $date => $slots) {
            if (!is_array($slots) || $slots === []) {
                continue;
            }
            $parts[] = format_date_label((string) $date) . ': ' . implode(', ', array_slice($slots, 0, 3));
            if (count($parts) >= 3) {
                break;
            }
        }

        if ($parts === []) {
            return 'No veo horarios libres cercanos para ese servicio. Si quieres, te propongo otra fecha.';
        }

        return 'Estos son los horarios mas cercanos que veo: ' . implode(' | ', $parts) . '.';
    }

    private function enhanceCollectReply(array $store, array $draft, string $fallback): string
    {
        if (trim((string) ($draft['service'] ?? '')) !== '' && trim((string) ($draft['date'] ?? '')) !== '' && trim((string) ($draft['time'] ?? '')) !== '') {
            return $this->buildAvailabilityReply($store, $draft, $fallback);
        }

        return $fallback !== '' ? $fallback : $this->buildMissingFieldsReply($draft);
    }

    private function buildMissingFieldsReply(array $draft): string
    {
        $missing = [];
        foreach (
            [
                'service' => 'servicio',
                'date' => 'fecha',
                'time' => 'hora',
                'name' => 'nombre completo',
                'email' => 'email',
                'paymentMethod' => 'metodo de pago',
            ] as $field => $label
        ) {
            if (trim((string) ($draft[$field] ?? '')) === '') {
                $missing[] = $label;
            }
        }
        if (($draft['privacyConsent'] ?? false) !== true) {
            $missing[] = 'consentimiento de datos';
        }
        if ($missing === []) {
            return 'Ya tengo los datos base para continuar.';
        }
        return 'Para avanzar me falta: ' . implode(', ', $missing) . '.';
    }

    private function isPendingCardCheckout(array $draft): bool
    {
        if ((int) ($draft['appointmentId'] ?? 0) > 0) {
            return false;
        }
        if (in_array((string) ($draft['paymentStatus'] ?? ''), ['paid', 'paid_needs_review'], true)) {
            return false;
        }

        $paymentMethod = strtolower(trim((string) ($draft['paymentMethod'] ?? '')));
        if ($paymentMethod !== 'card' && trim((string) ($draft['paymentSessionId'] ?? '')) === '') {
            return false;
        }

        return in_array((string) ($draft['status'] ?? ''), ['awaiting_payment', 'payment_review'], true)
            || in_array((string) ($draft['paymentStatus'] ?? ''), ['checkout_pending', 'paid_needs_review'], true);
    }

    private function enqueueTextReply(array $conversation, array $draft, string $text, array $meta = []): array
    {
        return $this->repository->enqueueOutbox([
            'conversationId' => (string) ($conversation['id'] ?? $draft['conversationId'] ?? ''),
            'phone' => (string) ($draft['phone'] ?? ($conversation['phone'] ?? '')),
            'type' => 'text',
            'text' => truncate_field($text, 1600),
            'meta' => $meta,
        ]);
    }
}

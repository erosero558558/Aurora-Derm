<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/whatsapp_openclaw/bootstrap.php';

class WhatsappOpenclawController
{
    public static function inbound(array $context): void
    {
        self::ensureEnabled();
        WhatsappOpenclawConfig::assertMachineToken();

        $payload = require_json_body();
        $event = self::normalizeInboundPayload($payload);
        if (($event['ok'] ?? false) !== true) {
            json_response([
                'ok' => false,
                'error' => (string) ($event['error'] ?? 'Payload inbound invalido'),
                'code' => 'whatsapp_openclaw_bad_request',
            ], (int) ($event['status'] ?? 400));
        }

        $lock = with_store_lock(static function () use ($event): array {
            $store = read_store();
            $result = whatsapp_openclaw_orchestrator()->handleInbound($store, $event['data']);
            if (($result['ok'] ?? false) !== true) {
                return $result;
            }

            if (($result['storeDirty'] ?? false) === true) {
                if (!write_store(is_array($result['store'] ?? null) ? $result['store'] : $store, false)) {
                    return [
                        'ok' => false,
                        'error' => 'No se pudo persistir el estado de WhatsApp OpenClaw',
                        'code' => 503,
                    ];
                }
            }

            return $result;
        });

        if (($lock['ok'] ?? false) !== true || !is_array($lock['result'] ?? null)) {
            json_response([
                'ok' => false,
                'error' => (string) ($lock['error'] ?? 'No se pudo bloquear el store'),
            ], (int) ($lock['code'] ?? 503));
        }

        $result = $lock['result'];
        if (($result['ok'] ?? false) !== true) {
            json_response([
                'ok' => false,
                'error' => (string) ($result['error'] ?? 'No se pudo procesar el inbound'),
            ], (int) ($result['code'] ?? 500));
        }

        $status = (string) ($result['status'] ?? 'processed');
        json_response([
            'ok' => true,
            'status' => $status,
            'data' => [
                'conversation' => self::sanitizeConversation(is_array($result['conversation'] ?? null) ? $result['conversation'] : []),
                'draft' => self::sanitizeDraft(is_array($result['draft'] ?? null) ? $result['draft'] : []),
                'plan' => self::sanitizePlan(is_array($result['plan'] ?? null) ? $result['plan'] : []),
                'actions' => array_values(array_filter(is_array($result['actions'] ?? null) ? $result['actions'] : [])),
                'queuedOutbox' => array_map([self::class, 'sanitizeOutboxRecord'], is_array($result['queuedOutbox'] ?? null) ? $result['queuedOutbox'] : []),
            ],
        ], $status === 'duplicate' ? 200 : 202);
    }

    public static function outbox(array $context): void
    {
        self::ensureEnabled();
        WhatsappOpenclawConfig::assertMachineToken();

        $limit = isset($_GET['limit']) ? (int) $_GET['limit'] : 20;
        if ($limit < 1) {
            $limit = 1;
        }
        if ($limit > 100) {
            $limit = 100;
        }

        $repository = whatsapp_openclaw_repository();
        $repository->touchBridgeStatus('outbox_poll');
        $items = $repository->listPendingOutbox($limit);

        json_response([
            'ok' => true,
            'data' => [
                'items' => array_map([self::class, 'sanitizeOutboxRecord'], $items),
                'count' => count($items),
            ],
        ]);
    }

    public static function ack(array $context): void
    {
        self::ensureEnabled();
        WhatsappOpenclawConfig::assertMachineToken();

        $payload = require_json_body();
        $result = whatsapp_openclaw_repository()->acknowledgeOutbox($payload);
        if (($result['ok'] ?? false) !== true) {
            json_response([
                'ok' => false,
                'error' => (string) ($result['error'] ?? 'No se pudo registrar el ack'),
            ], (int) ($result['code'] ?? 400));
        }

        $record = is_array($result['data'] ?? null) ? $result['data'] : [];
        self::syncConversationAfterAck($record);
        if (($record['status'] ?? '') === 'failed') {
            whatsapp_openclaw_repository()->touchBridgeStatus('error', [
                'message' => (string) ($record['error'] ?? 'delivery_failed'),
            ]);
        } else {
            whatsapp_openclaw_repository()->touchBridgeStatus('ack');
        }

        json_response([
            'ok' => true,
            'data' => self::sanitizeOutboxRecord($record),
        ]);
    }

    public static function ops(array $context): void
    {
        self::ensureEnabled();
        if (($context['isAdmin'] ?? false) !== true) {
            json_response([
                'ok' => false,
                'error' => 'No autorizado',
            ], 401);
        }

        $method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? ($context['method'] ?? 'GET')));
        if ($method === 'GET') {
            json_response([
                'ok' => true,
                'data' => self::buildOpsPayload(
                    isset($context['store']) && is_array($context['store']) ? $context['store'] : read_store()
                ),
            ]);
        }

        if ($method !== 'POST') {
            json_response([
                'ok' => false,
                'error' => 'Metodo no permitido',
            ], 405);
        }

        require_csrf();
        $payload = require_json_body();
        $action = strtolower(trim((string) ($payload['action'] ?? '')));
        if ($action === '') {
            json_response([
                'ok' => false,
                'error' => 'action es obligatorio',
            ], 400);
        }

        $lock = with_store_lock(static function () use ($payload): array {
            $store = read_store();
            return self::handleOpsAction($store, $payload);
        });

        if (($lock['ok'] ?? false) !== true || !is_array($lock['result'] ?? null)) {
            json_response([
                'ok' => false,
                'error' => (string) ($lock['error'] ?? 'No se pudo bloquear el store'),
            ], (int) ($lock['code'] ?? 503));
        }

        $result = $lock['result'];
        if (($result['ok'] ?? false) !== true) {
            json_response([
                'ok' => false,
                'error' => (string) ($result['error'] ?? 'No se pudo ejecutar la accion operativa'),
            ], (int) ($result['code'] ?? 500));
        }

        if (($result['storeDirty'] ?? false) === true) {
            $store = is_array($result['store'] ?? null) ? $result['store'] : read_store();
            if (!write_store($store, false)) {
                json_response([
                    'ok' => false,
                    'error' => 'No se pudo persistir el store despues de la operacion',
                ], 503);
            }
        }

        if (function_exists('audit_log_event')) {
            audit_log_event('whatsapp_openclaw.ops_action', [
                'action' => $action,
                'status' => (string) ($result['status'] ?? ''),
                'conversationId' => trim((string) ($payload['conversationId'] ?? '')),
                'holdId' => trim((string) ($payload['holdId'] ?? '')),
                'outboxId' => trim((string) ($payload['id'] ?? '')),
            ]);
        }

        whatsapp_openclaw_repository()->touchBridgeStatus('ops');
        json_response([
            'ok' => true,
            'action' => $action,
            'data' => self::sanitizeOpsActionResult($result),
        ]);
    }

    private static function buildOpsPayload(array $store): array
    {
        $snapshot = whatsapp_openclaw_repository()->buildOpsSnapshot($store);
        $snapshot['conversations'] = array_map(
            [self::class, 'sanitizeConversation'],
            is_array($snapshot['conversations'] ?? null) ? $snapshot['conversations'] : []
        );
        $snapshot['pendingOutboxItems'] = array_map(
            [self::class, 'sanitizeOutboxRecord'],
            is_array($snapshot['pendingOutboxItems'] ?? null) ? $snapshot['pendingOutboxItems'] : []
        );
        $snapshot['failedOutboxItems'] = array_map(
            [self::class, 'sanitizeOutboxRecord'],
            is_array($snapshot['failedOutboxItems'] ?? null) ? $snapshot['failedOutboxItems'] : []
        );
        $snapshot['activeHolds'] = array_map(
            [self::class, 'sanitizeHold'],
            is_array($snapshot['activeHolds'] ?? null) ? $snapshot['activeHolds'] : []
        );
        $snapshot['pendingCheckouts'] = array_map(
            [self::class, 'sanitizeDraft'],
            is_array($snapshot['pendingCheckouts'] ?? null) ? $snapshot['pendingCheckouts'] : []
        );
        return $snapshot;
    }

    private static function handleOpsAction(array $store, array $payload): array
    {
        $action = strtolower(trim((string) ($payload['action'] ?? '')));
        if ($action === 'requeue_outbox') {
            return self::handleRequeueOutboxAction($store, $payload);
        }
        if ($action === 'expire_checkout') {
            return self::handleExpireCheckoutAction($store, $payload);
        }
        if ($action === 'release_hold') {
            return self::handleReleaseHoldAction($store, $payload);
        }
        if ($action === 'sweep_stale') {
            return self::handleSweepStaleAction($store, $payload);
        }

        return [
            'ok' => false,
            'error' => 'Accion ops no soportada',
            'code' => 400,
        ];
    }

    private static function handleRequeueOutboxAction(array $store, array $payload): array
    {
        $id = trim((string) ($payload['id'] ?? ''));
        if ($id === '') {
            return ['ok' => false, 'error' => 'id es obligatorio', 'code' => 400];
        }

        $result = whatsapp_openclaw_repository()->requeueOutbox($id);
        if (($result['ok'] ?? false) !== true) {
            return $result;
        }

        return [
            'ok' => true,
            'store' => $store,
            'storeDirty' => false,
            'status' => (string) ($result['status'] ?? 'requeued'),
            'outbox' => is_array($result['data'] ?? null) ? $result['data'] : [],
        ];
    }

    private static function handleExpireCheckoutAction(array $store, array $payload): array
    {
        $draft = self::resolveOpsDraft($payload);
        if ($draft === []) {
            return ['ok' => false, 'error' => 'Draft no encontrado', 'code' => 404];
        }

        return whatsapp_openclaw_orchestrator()->expireCheckoutForOps($store, $draft);
    }

    private static function handleReleaseHoldAction(array $store, array $payload): array
    {
        $holdId = trim((string) ($payload['holdId'] ?? ''));
        if ($holdId === '') {
            return ['ok' => false, 'error' => 'holdId es obligatorio', 'code' => 400];
        }

        $reason = trim((string) ($payload['reason'] ?? ''));
        if ($reason === '') {
            $reason = 'admin_release';
        }

        return whatsapp_openclaw_orchestrator()->releaseHoldForOps(
            $store,
            $holdId,
            $reason,
            self::parseBoolish($payload['notify'] ?? false)
        );
    }

    private static function handleSweepStaleAction(array $store, array $payload): array
    {
        $limit = isset($payload['limit']) ? (int) $payload['limit'] : 25;
        $limit = max(1, min(100, $limit));

        $expiredHolds = whatsapp_openclaw_repository()->expireSlotHolds();
        $result = whatsapp_openclaw_orchestrator()->expireStaleCheckouts($store, $limit);
        if (($result['ok'] ?? false) !== true) {
            return $result;
        }

        $result['expiredHolds'] = $expiredHolds;
        return $result;
    }

    private static function resolveOpsDraft(array $payload): array
    {
        $repository = whatsapp_openclaw_repository();

        $paymentSessionId = trim((string) ($payload['paymentSessionId'] ?? ''));
        if ($paymentSessionId !== '') {
            $draft = $repository->findBookingDraftByPaymentSessionId($paymentSessionId);
            if ($draft !== []) {
                return $draft;
            }
        }

        $holdId = trim((string) ($payload['holdId'] ?? ''));
        if ($holdId !== '') {
            $hold = $repository->getSlotHold($holdId);
            if ($hold !== []) {
                $matches = $repository->listBookingDrafts([
                    'conversationId' => (string) ($hold['conversationId'] ?? ''),
                ], 1);
                if ($matches !== []) {
                    return $matches[0];
                }
            }
        }

        $conversationId = trim((string) ($payload['conversationId'] ?? ''));
        if ($conversationId !== '') {
            $matches = $repository->listBookingDrafts(['conversationId' => $conversationId], 1);
            if ($matches !== []) {
                return $matches[0];
            }
        }

        $phone = whatsapp_openclaw_normalize_phone((string) ($payload['phone'] ?? ''));
        if ($phone !== '') {
            $matches = $repository->listBookingDrafts(['phone' => $phone], 1);
            if ($matches !== []) {
                return $matches[0];
            }
        }

        return [];
    }

    private static function sanitizeOpsActionResult(array $result): array
    {
        return [
            'status' => (string) ($result['status'] ?? ''),
            'expiredCount' => (int) ($result['expiredCount'] ?? 0),
            'expiredHolds' => (int) ($result['expiredHolds'] ?? 0),
            'conversation' => is_array($result['conversation'] ?? null) ? self::sanitizeConversation($result['conversation']) : [],
            'draft' => is_array($result['draft'] ?? null) ? self::sanitizeDraft($result['draft']) : [],
            'hold' => is_array($result['hold'] ?? null) ? self::sanitizeHold($result['hold']) : [],
            'outbox' => is_array($result['outbox'] ?? null) ? self::sanitizeOutboxRecord($result['outbox']) : [],
            'queuedOutbox' => array_map(
                [self::class, 'sanitizeOutboxRecord'],
                is_array($result['queuedOutbox'] ?? null) ? $result['queuedOutbox'] : []
            ),
            'items' => array_map(
                [self::class, 'sanitizeOpsSweepItem'],
                is_array($result['items'] ?? null) ? $result['items'] : []
            ),
        ];
    }

    private static function sanitizeOpsSweepItem(array $item): array
    {
        return [
            'status' => (string) ($item['status'] ?? ''),
            'holdStatus' => (string) ($item['holdStatus'] ?? ''),
            'conversation' => self::sanitizeConversation(is_array($item['conversation'] ?? null) ? $item['conversation'] : []),
            'draft' => self::sanitizeDraft(is_array($item['draft'] ?? null) ? $item['draft'] : []),
            'queuedOutbox' => array_map(
                [self::class, 'sanitizeOutboxRecord'],
                is_array($item['queuedOutbox'] ?? null) ? $item['queuedOutbox'] : []
            ),
        ];
    }

    private static function parseBoolish($value): bool
    {
        if (is_bool($value)) {
            return $value;
        }
        if (is_int($value) || is_float($value)) {
            return (int) $value !== 0;
        }
        if (is_string($value)) {
            return in_array(strtolower(trim($value)), ['1', 'true', 'yes', 'on'], true);
        }
        return false;
    }

    private static function ensureEnabled(): void
    {
        if (!WhatsappOpenclawConfig::isEnabled()) {
            json_response([
                'ok' => false,
                'error' => 'WhatsApp OpenClaw no esta habilitado',
            ], 503);
        }
    }

    /**
     * @param array<string,mixed> $payload
     * @return array{ok:bool,data?:array<string,mixed>,error?:string,status?:int}
     */
    private static function normalizeInboundPayload(array $payload): array
    {
        $phoneCandidates = [
            $payload['phone'] ?? null,
            $payload['from'] ?? null,
            $payload['senderPhone'] ?? null,
            is_array($payload['sender'] ?? null) ? ($payload['sender']['phone'] ?? null) : null,
            is_array($payload['contact'] ?? null) ? ($payload['contact']['phone'] ?? null) : null,
        ];
        $phone = '';
        foreach ($phoneCandidates as $candidate) {
            $normalized = whatsapp_openclaw_normalize_phone((string) $candidate);
            if ($normalized !== '') {
                $phone = $normalized;
                break;
            }
        }

        $textCandidates = [
            $payload['text'] ?? null,
            $payload['body'] ?? null,
            $payload['messageText'] ?? null,
            is_array($payload['message'] ?? null) ? ($payload['message']['text'] ?? $payload['message']['body'] ?? null) : null,
        ];
        $text = '';
        foreach ($textCandidates as $candidate) {
            $candidateText = trim((string) $candidate);
            if ($candidateText !== '') {
                $text = $candidateText;
                break;
            }
        }

        $media = [];
        $rawMedia = $payload['media'] ?? $payload['attachments'] ?? [];
        if (is_array($rawMedia)) {
            foreach ($rawMedia as $item) {
                if (!is_array($item)) {
                    continue;
                }
                $media[] = [
                    'id' => trim((string) ($item['id'] ?? $item['providerMediaId'] ?? '')),
                    'url' => trim((string) ($item['url'] ?? $item['href'] ?? '')),
                    'mime' => trim((string) ($item['mime'] ?? $item['contentType'] ?? '')),
                    'name' => trim((string) ($item['name'] ?? $item['filename'] ?? '')),
                ];
            }
        }

        if ($phone === '') {
            return ['ok' => false, 'error' => 'phone es obligatorio', 'status' => 400];
        }
        if ($text === '' && $media === []) {
            return ['ok' => false, 'error' => 'Debes enviar texto o adjuntos', 'status' => 400];
        }

        $conversationId = trim((string) ($payload['conversationId'] ?? $payload['chatId'] ?? $payload['threadId'] ?? ''));
        if ($conversationId === '') {
            $conversationId = 'wa:' . $phone;
        }

        return [
            'ok' => true,
            'data' => [
                'eventId' => trim((string) ($payload['eventId'] ?? $payload['id'] ?? '')),
                'providerMessageId' => trim((string) ($payload['providerMessageId'] ?? $payload['messageId'] ?? $payload['wamid'] ?? (is_array($payload['message'] ?? null) ? ($payload['message']['id'] ?? '') : ''))),
                'conversationId' => $conversationId,
                'phone' => $phone,
                'text' => $text,
                'profileName' => trim((string) ($payload['profileName'] ?? $payload['senderName'] ?? $payload['name'] ?? '')),
                'receivedAt' => trim((string) ($payload['receivedAt'] ?? $payload['timestamp'] ?? local_date('c'))),
                'media' => $media,
            ],
        ];
    }

    private static function syncConversationAfterAck(array $record): void
    {
        $conversationId = trim((string) ($record['conversationId'] ?? ''));
        $phone = whatsapp_openclaw_normalize_phone((string) ($record['phone'] ?? ''));
        if ($conversationId === '' && $phone === '') {
            return;
        }

        $repository = whatsapp_openclaw_repository();
        $conversation = $repository->getConversation($conversationId, $phone);
        $conversation['outboundPending'] = max(0, (int) ($conversation['outboundPending'] ?? 0) - 1);
        if (($record['status'] ?? '') === 'acked') {
            $conversation['lastOutboundAt'] = local_date('c');
            $conversation['lastMessageAt'] = $conversation['lastOutboundAt'];
        }
        $repository->saveConversation($conversation);
    }

    private static function sanitizeConversation(array $conversation): array
    {
        return [
            'id' => (string) ($conversation['id'] ?? ''),
            'phone' => (string) ($conversation['phone'] ?? ''),
            'status' => (string) ($conversation['status'] ?? 'active'),
            'lastIntent' => (string) ($conversation['lastIntent'] ?? ''),
            'updatedAt' => (string) ($conversation['updatedAt'] ?? ''),
            'outboundPending' => (int) ($conversation['outboundPending'] ?? 0),
            'messageCount' => (int) ($conversation['messageCount'] ?? 0),
        ];
    }

    private static function sanitizeDraft(array $draft): array
    {
        return [
            'id' => (string) ($draft['id'] ?? ''),
            'conversationId' => (string) ($draft['conversationId'] ?? ''),
            'phone' => (string) ($draft['phone'] ?? ''),
            'service' => (string) ($draft['service'] ?? ''),
            'doctor' => (string) ($draft['doctor'] ?? ''),
            'date' => (string) ($draft['date'] ?? ''),
            'time' => (string) ($draft['time'] ?? ''),
            'name' => (string) ($draft['name'] ?? ''),
            'email' => (string) ($draft['email'] ?? ''),
            'status' => (string) ($draft['status'] ?? ''),
            'createdAt' => (string) ($draft['createdAt'] ?? ''),
            'updatedAt' => (string) ($draft['updatedAt'] ?? ''),
            'holdId' => (string) ($draft['holdId'] ?? ''),
            'holdStatus' => (string) ($draft['holdStatus'] ?? ''),
            'holdExpiresAt' => (string) ($draft['holdExpiresAt'] ?? ''),
            'appointmentId' => (int) ($draft['appointmentId'] ?? 0),
            'paymentMethod' => (string) ($draft['paymentMethod'] ?? ''),
            'paymentStatus' => (string) ($draft['paymentStatus'] ?? ''),
            'paymentSessionId' => (string) ($draft['paymentSessionId'] ?? ''),
            'paymentSessionUrl' => (string) ($draft['paymentSessionUrl'] ?? ''),
            'paymentIntentId' => (string) ($draft['paymentIntentId'] ?? ''),
        ];
    }

    private static function sanitizeHold(array $hold): array
    {
        return [
            'id' => (string) ($hold['id'] ?? ''),
            'conversationId' => (string) ($hold['conversationId'] ?? ''),
            'phone' => (string) ($hold['phone'] ?? ''),
            'service' => (string) ($hold['service'] ?? ''),
            'doctor' => (string) ($hold['doctor'] ?? ''),
            'doctorRequested' => (string) ($hold['doctorRequested'] ?? ''),
            'date' => (string) ($hold['date'] ?? ''),
            'time' => (string) ($hold['time'] ?? ''),
            'paymentMethod' => (string) ($hold['paymentMethod'] ?? ''),
            'status' => (string) ($hold['status'] ?? ''),
            'appointmentId' => (int) ($hold['appointmentId'] ?? 0),
            'ttlSeconds' => (int) ($hold['ttlSeconds'] ?? 0),
            'expiresAt' => (string) ($hold['expiresAt'] ?? ''),
            'createdAt' => (string) ($hold['createdAt'] ?? ''),
            'updatedAt' => (string) ($hold['updatedAt'] ?? ''),
            'releasedAt' => (string) ($hold['releasedAt'] ?? ''),
            'releaseReason' => (string) ($hold['releaseReason'] ?? ''),
            'consumedAt' => (string) ($hold['consumedAt'] ?? ''),
            'expiredAt' => (string) ($hold['expiredAt'] ?? ''),
        ];
    }

    private static function sanitizePlan(array $plan): array
    {
        return [
            'intent' => (string) ($plan['intent'] ?? ''),
            'source' => (string) ($plan['source'] ?? ''),
            'reply' => (string) ($plan['reply'] ?? ''),
        ];
    }

    private static function sanitizeOutboxRecord(array $record): array
    {
        return [
            'id' => (string) ($record['id'] ?? ''),
            'conversationId' => (string) ($record['conversationId'] ?? ''),
            'phone' => (string) ($record['phone'] ?? ''),
            'type' => (string) ($record['type'] ?? 'text'),
            'text' => (string) ($record['text'] ?? ''),
            'status' => (string) ($record['status'] ?? 'pending'),
            'createdAt' => (string) ($record['createdAt'] ?? ''),
            'updatedAt' => (string) ($record['updatedAt'] ?? ''),
            'providerMessageId' => (string) ($record['providerMessageId'] ?? ''),
            'error' => (string) ($record['error'] ?? ''),
            'requeueCount' => (int) ($record['requeueCount'] ?? 0),
            'requeuedAt' => (string) ($record['requeuedAt'] ?? ''),
            'meta' => isset($record['meta']) && is_array($record['meta']) ? $record['meta'] : [],
        ];
    }
}

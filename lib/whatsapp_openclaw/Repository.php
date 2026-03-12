<?php

declare(strict_types=1);

final class WhatsappOpenclawRepository
{
    private string $baseDir;

    public function __construct(?string $baseDir = null)
    {
        $this->baseDir = rtrim($baseDir ?: (data_dir_path() . DIRECTORY_SEPARATOR . 'whatsapp-openclaw'), '\\/');
        $this->ensureDirectories();
    }

    public function getConversation(string $conversationId, string $phone = ''): array
    {
        $conversationId = $this->normalizeConversationId($conversationId, $phone);
        $existing = $this->readJsonFile($this->recordPath('conversations', $conversationId));
        if (is_array($existing)) {
            return $existing;
        }

        $now = local_date('c');
        return [
            'id' => $conversationId,
            'phone' => whatsapp_openclaw_normalize_phone($phone),
            'channel' => 'whatsapp',
            'status' => 'active',
            'createdAt' => $now,
            'updatedAt' => $now,
            'lastInboundAt' => '',
            'lastOutboundAt' => '',
            'lastMessageAt' => '',
            'lastIntent' => '',
            'lastProviderMessageId' => '',
            'messageCount' => 0,
            'bookingDraftId' => $conversationId,
            'outboundPending' => 0,
            'meta' => [],
        ];
    }

    public function saveConversation(array $conversation): array
    {
        $current = $this->getConversation(
            (string) ($conversation['id'] ?? ''),
            (string) ($conversation['phone'] ?? '')
        );
        $merged = array_merge($current, $conversation);
        $merged['id'] = $this->normalizeConversationId((string) ($merged['id'] ?? ''), (string) ($merged['phone'] ?? ''));
        $merged['phone'] = whatsapp_openclaw_normalize_phone((string) ($merged['phone'] ?? ''));
        $merged['updatedAt'] = local_date('c');
        if (trim((string) ($merged['createdAt'] ?? '')) === '') {
            $merged['createdAt'] = $merged['updatedAt'];
        }

        $this->writeJsonFile($this->recordPath('conversations', (string) $merged['id']), $merged);
        return $merged;
    }

    public function listConversations(int $limit = 50, string $phone = ''): array
    {
        $records = $this->readSection('conversations');
        $normalizedPhone = whatsapp_openclaw_normalize_phone($phone);
        $filtered = [];
        foreach ($records as $record) {
            if ($normalizedPhone !== '' && whatsapp_openclaw_normalize_phone((string) ($record['phone'] ?? '')) !== $normalizedPhone) {
                continue;
            }
            $filtered[] = $record;
        }

        usort($filtered, static function (array $left, array $right): int {
            return strtotime((string) ($right['updatedAt'] ?? '')) <=> strtotime((string) ($left['updatedAt'] ?? ''));
        });

        return array_slice($filtered, 0, max(1, $limit));
    }

    public function getBookingDraft(string $conversationId, string $phone = ''): array
    {
        $conversationId = $this->normalizeConversationId($conversationId, $phone);
        $existing = $this->readJsonFile($this->recordPath('drafts', $conversationId));
        if (is_array($existing)) {
            return $existing;
        }

        $now = local_date('c');
        return [
            'id' => $conversationId,
            'conversationId' => $conversationId,
            'phone' => whatsapp_openclaw_normalize_phone($phone),
            'service' => '',
            'doctor' => '',
            'date' => '',
            'time' => '',
            'name' => '',
            'email' => '',
            'privacyConsent' => false,
            'privacyConsentAt' => '',
            'paymentMethod' => '',
            'mediaProofRefs' => [],
            'transferReference' => '',
            'status' => 'collecting',
            'holdId' => '',
            'appointmentId' => 0,
            'paymentSessionId' => '',
            'paymentSessionUrl' => '',
            'paymentIntentId' => '',
            'paymentStatus' => '',
            'targetAppointmentId' => 0,
            'updatedAt' => $now,
            'createdAt' => $now,
            'notes' => [],
        ];
    }

    public function saveBookingDraft(array $draft): array
    {
        $current = $this->getBookingDraft(
            (string) ($draft['conversationId'] ?? $draft['id'] ?? ''),
            (string) ($draft['phone'] ?? '')
        );
        $merged = array_merge($current, $draft);
        $merged['conversationId'] = $this->normalizeConversationId(
            (string) ($merged['conversationId'] ?? $merged['id'] ?? ''),
            (string) ($merged['phone'] ?? '')
        );
        $merged['id'] = (string) $merged['conversationId'];
        $merged['phone'] = whatsapp_openclaw_normalize_phone((string) ($merged['phone'] ?? ''));
        $merged['mediaProofRefs'] = array_values(array_filter(is_array($merged['mediaProofRefs'] ?? null) ? $merged['mediaProofRefs'] : []));
        $merged['updatedAt'] = local_date('c');
        if (trim((string) ($merged['createdAt'] ?? '')) === '') {
            $merged['createdAt'] = $merged['updatedAt'];
        }

        $this->writeJsonFile($this->recordPath('drafts', (string) $merged['conversationId']), $merged);
        return $merged;
    }

    public function rememberInboundMessage(array $message): array
    {
        $now = local_date('c');
        $message['id'] = trim((string) ($message['id'] ?? ''));
        if ($message['id'] === '') {
            $message['id'] = 'wam_in_' . bin2hex(random_bytes(8));
        }
        $message['direction'] = 'inbound';
        $message['createdAt'] = trim((string) ($message['createdAt'] ?? $now));
        $message['status'] = trim((string) ($message['status'] ?? 'received'));
        $message['conversationId'] = $this->normalizeConversationId(
            (string) ($message['conversationId'] ?? ''),
            (string) ($message['phone'] ?? '')
        );
        $message['phone'] = whatsapp_openclaw_normalize_phone((string) ($message['phone'] ?? ''));

        $this->writeJsonFile($this->recordPath('messages', (string) $message['id']), $message);
        $this->writeDedupeKey((string) ($message['eventId'] ?? ''), (string) $message['id']);
        $this->writeDedupeKey((string) ($message['providerMessageId'] ?? ''), (string) $message['id']);
        return $message;
    }

    public function rememberOutboundMessage(array $message): array
    {
        $message['direction'] = 'outbound';
        $message['createdAt'] = trim((string) ($message['createdAt'] ?? local_date('c')));
        $message['status'] = trim((string) ($message['status'] ?? 'queued'));
        if (trim((string) ($message['id'] ?? '')) === '') {
            $message['id'] = 'wam_out_' . bin2hex(random_bytes(8));
        }
        $this->writeJsonFile($this->recordPath('messages', (string) $message['id']), $message);
        return $message;
    }

    public function hasProcessedInbound(string $eventId, string $providerMessageId): bool
    {
        return $this->readDedupeKey($eventId) !== '' || $this->readDedupeKey($providerMessageId) !== '';
    }

    public function enqueueOutbox(array $message): array
    {
        $now = local_date('c');
        if (trim((string) ($message['id'] ?? '')) === '') {
            $message['id'] = 'wao_' . bin2hex(random_bytes(8));
        }
        $message['conversationId'] = $this->normalizeConversationId(
            (string) ($message['conversationId'] ?? ''),
            (string) ($message['phone'] ?? '')
        );
        $message['phone'] = whatsapp_openclaw_normalize_phone((string) ($message['phone'] ?? ''));
        $message['status'] = trim((string) ($message['status'] ?? 'pending'));
        $message['createdAt'] = trim((string) ($message['createdAt'] ?? $now));
        $message['updatedAt'] = $now;
        $message['attempts'] = isset($message['attempts']) ? max(0, (int) $message['attempts']) : 0;
        $this->writeJsonFile($this->recordPath('outbox', (string) $message['id']), $message);
        $this->rememberOutboundMessage($message);
        return $message;
    }

    public function listPendingOutbox(int $limit = 20): array
    {
        $records = [];
        foreach ($this->readSection('outbox') as $record) {
            if (($record['status'] ?? '') !== 'pending') {
                continue;
            }
            $records[] = $record;
        }

        usort($records, static function (array $left, array $right): int {
            return strtotime((string) ($left['createdAt'] ?? '')) <=> strtotime((string) ($right['createdAt'] ?? ''));
        });

        return array_slice($records, 0, max(1, $limit));
    }

    public function getOutboxRecord(string $id): array
    {
        $id = trim($id);
        if ($id === '') {
            return [];
        }

        $record = $this->readJsonFile($this->recordPath('outbox', $id));
        return is_array($record) ? $record : [];
    }

    public function listOutbox(array $filters = [], int $limit = 50): array
    {
        $normalizedPhone = array_key_exists('phone', $filters)
            ? whatsapp_openclaw_normalize_phone((string) $filters['phone'])
            : '';
        $records = [];

        foreach ($this->readSection('outbox') as $record) {
            if (isset($filters['status']) && (string) $filters['status'] !== (string) ($record['status'] ?? '')) {
                continue;
            }
            if (isset($filters['conversationId']) && (string) $filters['conversationId'] !== (string) ($record['conversationId'] ?? '')) {
                continue;
            }
            if (
                $normalizedPhone !== ''
                && whatsapp_openclaw_normalize_phone((string) ($record['phone'] ?? '')) !== $normalizedPhone
            ) {
                continue;
            }
            $records[] = $record;
        }

        usort($records, static function (array $left, array $right): int {
            return strtotime((string) ($right['updatedAt'] ?? $right['createdAt'] ?? ''))
                <=> strtotime((string) ($left['updatedAt'] ?? $left['createdAt'] ?? ''));
        });

        return array_slice($records, 0, max(1, $limit));
    }

    public function requeueOutbox(string $id): array
    {
        $record = $this->getOutboxRecord($id);
        if ($record === []) {
            return ['ok' => false, 'error' => 'Mensaje no encontrado', 'code' => 404];
        }

        $status = (string) ($record['status'] ?? '');
        if ($status === 'acked') {
            return [
                'ok' => false,
                'error' => 'El mensaje ya fue confirmado por el bridge y no se puede reencolar',
                'code' => 409,
            ];
        }
        if ($status === 'pending') {
            return ['ok' => true, 'status' => 'already_pending', 'data' => $record];
        }

        $record['status'] = 'pending';
        $record['updatedAt'] = local_date('c');
        $record['error'] = '';
        $record['providerMessageId'] = '';
        $record['requeuedAt'] = $record['updatedAt'];
        $record['requeueCount'] = max(0, (int) ($record['requeueCount'] ?? 0)) + 1;
        unset($record['ackedAt'], $record['failedAt']);

        $this->writeJsonFile($this->recordPath('outbox', (string) ($record['id'] ?? '')), $record);
        return ['ok' => true, 'status' => 'requeued', 'data' => $record];
    }

    public function acknowledgeOutbox(array $payload): array
    {
        $id = trim((string) ($payload['id'] ?? ''));
        if ($id === '') {
            return ['ok' => false, 'error' => 'id es obligatorio', 'code' => 400];
        }

        $record = $this->readJsonFile($this->recordPath('outbox', $id));
        if (!is_array($record)) {
            return ['ok' => false, 'error' => 'Mensaje no encontrado', 'code' => 404];
        }

        $status = strtolower(trim((string) ($payload['status'] ?? 'acked')));
        if (!in_array($status, ['acked', 'failed'], true)) {
            $status = 'acked';
        }

        $record['status'] = $status;
        $record['updatedAt'] = local_date('c');
        $record['providerMessageId'] = trim((string) ($payload['providerMessageId'] ?? ($record['providerMessageId'] ?? '')));
        $record['error'] = truncate_field((string) ($payload['error'] ?? ''), 240);
        $record['attempts'] = max((int) ($record['attempts'] ?? 0), (int) ($payload['attempts'] ?? 0));
        if ($status === 'acked') {
            $record['ackedAt'] = $record['updatedAt'];
        } else {
            $record['failedAt'] = $record['updatedAt'];
        }

        $this->writeJsonFile($this->recordPath('outbox', $id), $record);
        return ['ok' => true, 'data' => $record];
    }

    public function getBridgeStatus(): array
    {
        $status = $this->readJsonFile($this->baseDir . DIRECTORY_SEPARATOR . 'bridge-status.json');
        if (!is_array($status)) {
            $status = [];
        }

        return array_merge([
            'configured' => WhatsappOpenclawConfig::bridgeToken() !== '',
            'configuredMode' => WhatsappOpenclawConfig::isEnabled() ? WhatsappOpenclawConfig::mode() : 'disabled',
            'lastSeenAt' => '',
            'lastInboundAt' => '',
            'lastOutboundAt' => '',
            'lastOutboxPollAt' => '',
            'lastAckAt' => '',
            'lastSuccessAt' => '',
            'lastErrorAt' => '',
            'lastErrorMessage' => '',
        ], $status);
    }

    public function touchBridgeStatus(string $event, array $meta = []): array
    {
        $status = $this->getBridgeStatus();
        $now = local_date('c');
        $status['configured'] = WhatsappOpenclawConfig::bridgeToken() !== '';
        $status['configuredMode'] = WhatsappOpenclawConfig::isEnabled() ? WhatsappOpenclawConfig::mode() : 'disabled';
        $status['lastSeenAt'] = $now;

        if ($event === 'inbound') {
            $status['lastInboundAt'] = $now;
            $status['lastSuccessAt'] = $now;
        } elseif ($event === 'outbox_poll') {
            $status['lastOutboxPollAt'] = $now;
            $status['lastSuccessAt'] = $now;
        } elseif ($event === 'ack') {
            $status['lastAckAt'] = $now;
            $status['lastOutboundAt'] = $now;
            $status['lastSuccessAt'] = $now;
        } elseif ($event === 'error') {
            $status['lastErrorAt'] = $now;
            $status['lastErrorMessage'] = truncate_field((string) ($meta['message'] ?? ''), 240);
        } else {
            $status['lastSuccessAt'] = $now;
        }

        $this->writeJsonFile($this->baseDir . DIRECTORY_SEPARATOR . 'bridge-status.json', $status);
        return $status;
    }

    public function getSlotHold(string $holdId): array
    {
        $record = $this->readJsonFile($this->recordPath('holds', $holdId));
        if (!is_array($record)) {
            return [];
        }

        if (($record['status'] ?? '') === 'active' && $this->isExpired((string) ($record['expiresAt'] ?? ''))) {
            $record['status'] = 'expired';
            $record['expiredAt'] = local_date('c');
            $this->writeJsonFile($this->recordPath('holds', $holdId), $record);
        }

        return $record;
    }

    public function saveSlotHold(array $hold): array
    {
        if (trim((string) ($hold['id'] ?? '')) === '') {
            $hold['id'] = 'wah_' . bin2hex(random_bytes(8));
        }
        $hold['phone'] = whatsapp_openclaw_normalize_phone((string) ($hold['phone'] ?? ''));
        $hold['conversationId'] = $this->normalizeConversationId(
            (string) ($hold['conversationId'] ?? ''),
            (string) ($hold['phone'] ?? '')
        );
        $hold['status'] = trim((string) ($hold['status'] ?? 'active'));
        $hold['updatedAt'] = local_date('c');
        if (trim((string) ($hold['createdAt'] ?? '')) === '') {
            $hold['createdAt'] = $hold['updatedAt'];
        }
        $this->writeJsonFile($this->recordPath('holds', (string) $hold['id']), $hold);
        return $hold;
    }

    public function listSlotHolds(array $filters = []): array
    {
        $records = [];
        foreach ($this->readSection('holds') as $record) {
            if (($record['status'] ?? '') === 'active' && $this->isExpired((string) ($record['expiresAt'] ?? ''))) {
                $record['status'] = 'expired';
                $record['expiredAt'] = local_date('c');
                $this->writeJsonFile($this->recordPath('holds', (string) ($record['id'] ?? '')), $record);
            }

            if (isset($filters['status']) && (string) $filters['status'] !== (string) ($record['status'] ?? '')) {
                continue;
            }
            if (isset($filters['date']) && (string) $filters['date'] !== (string) ($record['date'] ?? '')) {
                continue;
            }
            if (isset($filters['doctor']) && (string) $filters['doctor'] !== (string) ($record['doctor'] ?? '')) {
                continue;
            }
            if (isset($filters['conversationId']) && (string) $filters['conversationId'] !== (string) ($record['conversationId'] ?? '')) {
                continue;
            }
            $records[] = $record;
        }

        usort($records, static function (array $left, array $right): int {
            return strtotime((string) ($right['updatedAt'] ?? '')) <=> strtotime((string) ($left['updatedAt'] ?? ''));
        });

        return $records;
    }

    public function expireSlotHolds(): int
    {
        $expired = 0;
        foreach ($this->readSection('holds') as $record) {
            if (($record['status'] ?? '') !== 'active') {
                continue;
            }
            if (!$this->isExpired((string) ($record['expiresAt'] ?? ''))) {
                continue;
            }
            $record['status'] = 'expired';
            $record['expiredAt'] = local_date('c');
            $this->writeJsonFile($this->recordPath('holds', (string) ($record['id'] ?? '')), $record);
            $expired++;
        }
        return $expired;
    }

    public function listBookingDrafts(array $filters = [], int $limit = 50): array
    {
        $normalizedPhone = array_key_exists('phone', $filters)
            ? whatsapp_openclaw_normalize_phone((string) $filters['phone'])
            : '';
        $records = [];

        foreach ($this->readSection('drafts') as $record) {
            if (isset($filters['status']) && (string) $filters['status'] !== (string) ($record['status'] ?? '')) {
                continue;
            }
            if (isset($filters['paymentMethod']) && (string) $filters['paymentMethod'] !== (string) ($record['paymentMethod'] ?? '')) {
                continue;
            }
            if (isset($filters['paymentStatus']) && (string) $filters['paymentStatus'] !== (string) ($record['paymentStatus'] ?? '')) {
                continue;
            }
            if (isset($filters['conversationId']) && (string) $filters['conversationId'] !== (string) ($record['conversationId'] ?? '')) {
                continue;
            }
            if (
                $normalizedPhone !== ''
                && whatsapp_openclaw_normalize_phone((string) ($record['phone'] ?? '')) !== $normalizedPhone
            ) {
                continue;
            }
            $records[] = $record;
        }

        usort($records, static function (array $left, array $right): int {
            return strtotime((string) ($right['updatedAt'] ?? $right['createdAt'] ?? ''))
                <=> strtotime((string) ($left['updatedAt'] ?? $left['createdAt'] ?? ''));
        });

        return array_slice($records, 0, max(1, $limit));
    }

    public function findBookingDraftByPaymentSessionId(string $sessionId): array
    {
        $sessionId = trim($sessionId);
        if ($sessionId === '') {
            return [];
        }

        foreach ($this->readSection('drafts') as $record) {
            if (trim((string) ($record['paymentSessionId'] ?? '')) === $sessionId) {
                return $record;
            }
        }

        return [];
    }

    public function findAppointmentsByPhone(array $store, string $phone, bool $futureOnly = true): array
    {
        $normalizedPhone = whatsapp_openclaw_normalize_phone($phone);
        if ($normalizedPhone === '') {
            return [];
        }

        $today = local_date('Y-m-d');
        $appointments = isset($store['appointments']) && is_array($store['appointments']) ? $store['appointments'] : [];
        $matches = [];
        foreach ($appointments as $appointment) {
            if (!is_array($appointment)) {
                continue;
            }
            if (map_appointment_status((string) ($appointment['status'] ?? 'confirmed')) === 'cancelled') {
                continue;
            }
            if (whatsapp_openclaw_normalize_phone((string) ($appointment['phone'] ?? '')) !== $normalizedPhone) {
                continue;
            }
            $date = (string) ($appointment['date'] ?? '');
            if ($futureOnly && $date !== '' && $date < $today) {
                continue;
            }
            $matches[] = $appointment;
        }

        usort($matches, static function (array $left, array $right): int {
            return strcmp((string) ($left['date'] ?? ''), (string) ($right['date'] ?? ''))
                ?: strcmp((string) ($left['time'] ?? ''), (string) ($right['time'] ?? ''));
        });

        return $matches;
    }

    public function buildOpsSnapshot(array $store = []): array
    {
        $bridge = $this->getBridgeStatus();
        $drafts = $this->readSection('drafts');
        $activeHolds = $this->listSlotHolds(['status' => 'active']);
        $pendingOutbox = $this->listPendingOutbox(200);
        $failedOutbox = $this->listOutbox(['status' => 'failed'], 50);
        $messages = $this->readSection('messages');

        $inboundCount = 0;
        foreach ($messages as $message) {
            if (($message['direction'] ?? '') === 'inbound') {
                $inboundCount++;
            }
        }

        $activeConversations = 0;
        foreach ($this->readSection('conversations') as $conversation) {
            $updatedAt = strtotime((string) ($conversation['updatedAt'] ?? ''));
            if ($updatedAt !== false && $updatedAt >= (time() - 86400)) {
                $activeConversations++;
            }
        }

        $bookingsClosed = 0;
        $paymentsStarted = 0;
        $paymentsCompleted = 0;
        foreach ($drafts as $draft) {
            if ((int) ($draft['appointmentId'] ?? 0) > 0 || ($draft['status'] ?? '') === 'booked') {
                $bookingsClosed++;
            }
            if (trim((string) ($draft['paymentSessionId'] ?? '')) !== '') {
                $paymentsStarted++;
            }
            if (($draft['paymentStatus'] ?? '') === 'paid') {
                $paymentsCompleted++;
            }
        }

        $deliveryFailures = 0;
        foreach ($this->readSection('outbox') as $record) {
            if (($record['status'] ?? '') === 'failed') {
                $deliveryFailures++;
            }
        }

        $automationSuccessRate = $inboundCount > 0
            ? round($bookingsClosed / $inboundCount, 4)
            : 0.0;

        $pendingCheckouts = [];
        foreach ($this->listBookingDrafts([], 200) as $draft) {
            $status = (string) ($draft['status'] ?? '');
            $paymentStatus = (string) ($draft['paymentStatus'] ?? '');
            $paymentMethod = strtolower(trim((string) ($draft['paymentMethod'] ?? '')));

            if ((int) ($draft['appointmentId'] ?? 0) > 0) {
                continue;
            }
            if ($paymentMethod !== 'card' && trim((string) ($draft['paymentSessionId'] ?? '')) === '') {
                continue;
            }
            if (
                !in_array($status, ['awaiting_payment', 'payment_review'], true)
                && !in_array($paymentStatus, ['checkout_pending', 'paid_needs_review'], true)
            ) {
                continue;
            }

            $hold = trim((string) ($draft['holdId'] ?? '')) !== ''
                ? $this->getSlotHold((string) $draft['holdId'])
                : [];
            $draft['holdStatus'] = (string) ($hold['status'] ?? '');
            $draft['holdExpiresAt'] = (string) ($hold['expiresAt'] ?? '');
            $pendingCheckouts[] = $draft;
            if (count($pendingCheckouts) >= 50) {
                break;
            }
        }

        return [
            'configured' => WhatsappOpenclawConfig::isEnabled(),
            'configuredMode' => WhatsappOpenclawConfig::isEnabled() ? WhatsappOpenclawConfig::mode() : 'disabled',
            'bridgeConfigured' => (bool) ($bridge['configured'] ?? false),
            'bridgeMode' => $this->resolveBridgeMode($bridge),
            'bridgeStatus' => $bridge,
            'pendingOutbox' => count($pendingOutbox),
            'activeConversations' => $activeConversations,
            'aliveHolds' => count($activeHolds),
            'bookingsClosed' => $bookingsClosed,
            'paymentsStarted' => $paymentsStarted,
            'paymentsCompleted' => $paymentsCompleted,
            'deliveryFailures' => $deliveryFailures,
            'automationSuccessRate' => $automationSuccessRate,
            'lastInboundAt' => (string) ($bridge['lastInboundAt'] ?? ''),
            'lastOutboundAt' => (string) ($bridge['lastOutboundAt'] ?? ''),
            'pendingOutboxItems' => array_slice($pendingOutbox, 0, 25),
            'failedOutboxItems' => array_slice($failedOutbox, 0, 25),
            'activeHolds' => array_slice($activeHolds, 0, 25),
            'pendingCheckouts' => $pendingCheckouts,
            'conversations' => $this->listConversations(50),
        ];
    }

    public function buildHealthSnapshot(array $store = []): array
    {
        $ops = $this->buildOpsSnapshot($store);
        return array_merge($ops, [
            'workerStaleAfterSeconds' => WhatsappOpenclawConfig::bridgeStaleAfterSeconds(),
            'stale' => ($ops['bridgeMode'] ?? '') === 'offline',
            'degraded' => in_array((string) ($ops['bridgeMode'] ?? ''), ['offline', 'degraded'], true),
        ]);
    }

    private function ensureDirectories(): void
    {
        foreach (['', 'conversations', 'messages', 'outbox', 'drafts', 'holds', 'dedupe'] as $section) {
            $path = $section === '' ? $this->baseDir : $this->baseDir . DIRECTORY_SEPARATOR . $section;
            if (!is_dir($path)) {
                @mkdir($path, 0775, true);
            }
        }
    }

    private function normalizeConversationId(string $conversationId, string $phone = ''): string
    {
        $conversationId = trim($conversationId);
        if ($conversationId !== '') {
            return $conversationId;
        }

        $normalizedPhone = whatsapp_openclaw_normalize_phone($phone);
        return $normalizedPhone !== '' ? 'wa:' . $normalizedPhone : 'wa:unknown';
    }

    private function recordPath(string $section, string $id): string
    {
        return $this->baseDir
            . DIRECTORY_SEPARATOR
            . $section
            . DIRECTORY_SEPARATOR
            . sha1($id)
            . '.json';
    }

    private function dedupePath(string $key): string
    {
        return $this->baseDir . DIRECTORY_SEPARATOR . 'dedupe' . DIRECTORY_SEPARATOR . sha1($key) . '.json';
    }

    private function readDedupeKey(string $key): string
    {
        $key = trim($key);
        if ($key === '') {
            return '';
        }
        $record = $this->readJsonFile($this->dedupePath($key));
        return is_array($record) ? trim((string) ($record['messageId'] ?? '')) : '';
    }

    private function writeDedupeKey(string $key, string $messageId): void
    {
        $key = trim($key);
        if ($key === '') {
            return;
        }

        $this->writeJsonFile($this->dedupePath($key), [
            'key' => $key,
            'messageId' => $messageId,
            'updatedAt' => local_date('c'),
        ]);
    }

    private function readSection(string $section): array
    {
        $dir = $this->baseDir . DIRECTORY_SEPARATOR . $section;
        if (!is_dir($dir)) {
            return [];
        }

        $records = [];
        foreach (glob($dir . DIRECTORY_SEPARATOR . '*.json') ?: [] as $file) {
            $decoded = $this->readJsonFile($file);
            if (is_array($decoded)) {
                $records[] = $decoded;
            }
        }
        return $records;
    }

    private function readJsonFile(string $path): ?array
    {
        if (!is_file($path)) {
            return null;
        }

        $handle = @fopen($path, 'rb');
        if (!$handle) {
            return null;
        }

        $contents = null;
        if (flock($handle, LOCK_SH)) {
            $contents = stream_get_contents($handle);
            flock($handle, LOCK_UN);
        }
        fclose($handle);

        if (!is_string($contents) || trim($contents) === '') {
            return null;
        }

        $decoded = json_decode($contents, true);
        return is_array($decoded) ? $decoded : null;
    }

    private function writeJsonFile(string $path, array $payload): void
    {
        $handle = @fopen($path, 'c+');
        if (!$handle) {
            throw new RuntimeException('No se pudo abrir storage de WhatsApp OpenClaw');
        }

        if (!flock($handle, LOCK_EX)) {
            fclose($handle);
            throw new RuntimeException('No se pudo bloquear storage de WhatsApp OpenClaw');
        }

        ftruncate($handle, 0);
        rewind($handle);
        fwrite($handle, json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
        fflush($handle);
        flock($handle, LOCK_UN);
        fclose($handle);
    }

    private function isExpired(string $expiresAt): bool
    {
        $expiresTs = strtotime($expiresAt);
        return $expiresTs !== false && $expiresTs <= time();
    }

    private function resolveBridgeMode(array $bridge): string
    {
        if (!WhatsappOpenclawConfig::isEnabled()) {
            return 'disabled';
        }
        if (!(bool) ($bridge['configured'] ?? false)) {
            return 'pending';
        }

        $lastSeenAt = strtotime((string) ($bridge['lastSeenAt'] ?? ''));
        if ($lastSeenAt === false) {
            return 'pending';
        }
        if ((time() - $lastSeenAt) > WhatsappOpenclawConfig::bridgeStaleAfterSeconds()) {
            return 'offline';
        }

        $lastSuccessAt = strtotime((string) ($bridge['lastSuccessAt'] ?? ''));
        $lastErrorAt = strtotime((string) ($bridge['lastErrorAt'] ?? ''));
        if ($lastErrorAt !== false && ($lastSuccessAt === false || $lastErrorAt > $lastSuccessAt)) {
            return 'degraded';
        }

        return 'online';
    }
}

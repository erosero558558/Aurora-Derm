<?php

declare(strict_types=1);

require_once __DIR__ . '/../audit.php';
require_once __DIR__ . '/../telemedicine/ClinicalMediaService.php';

final class ClinicalHistoryService
{
    private ClinicalHistoryAIService $ai;

    public function __construct(?ClinicalHistoryAIService $ai = null)
    {
        $this->ai = $ai ?? new ClinicalHistoryAIService();
    }

    public function createOrResumeSession(array $store, array $payload): array
    {
        [$store, $session, $draft, $created] = $this->resolveSessionContext($store, $payload, true);
        $reconciled = $this->reconcilePendingAi($store, $session, $draft);
        $store = $reconciled['store'];
        $session = $reconciled['session'];
        $draft = $reconciled['draft'];

        $attachmentResult = $this->attachUploads($store, $session, $draft, $payload);
        $store = $attachmentResult['store'];
        $session = $attachmentResult['session'];
        $draft = $attachmentResult['draft'];

        $sessionSave = ClinicalHistoryRepository::upsertSession($store, $session);
        $store = $sessionSave['store'];
        $session = $sessionSave['session'];

        $draftSave = ClinicalHistoryRepository::upsertDraft($store, $draft);
        $store = $draftSave['store'];
        $draft = $draftSave['draft'];

        audit_log_event($created ? 'clinical_history.session_created' : 'clinical_history.session_resumed', [
            'sessionId' => (string) ($session['sessionId'] ?? ''),
            'caseId' => (string) ($session['caseId'] ?? ''),
            'appointmentId' => (int) ($session['appointmentId'] ?? 0),
            'surface' => (string) ($session['surface'] ?? ''),
        ]);

        return [
            'ok' => true,
            'statusCode' => $created ? 201 : 200,
            'store' => $store,
            'session' => $session,
            'draft' => $draft,
            'created' => $created,
            'data' => $this->buildPublicPayload($session, $draft),
        ];
    }

    public function handlePatientMessage(array $store, array $payload): array
    {
        $messageText = $this->extractPatientMessage($payload);
        if ($messageText === '') {
            return [
                'ok' => false,
                'statusCode' => 400,
                'error' => 'message es obligatorio',
                'errorCode' => 'clinical_history_message_required',
            ];
        }

        [$store, $session, $draft] = $this->resolveSessionContext($store, $payload, true);
        $reconciled = $this->reconcilePendingAi($store, $session, $draft);
        $store = $reconciled['store'];
        $session = $reconciled['session'];
        $draft = $reconciled['draft'];
        if (($reconciled['mutated'] ?? false) === true) {
            $sessionSave = ClinicalHistoryRepository::upsertSession($store, $session);
            $store = $sessionSave['store'];
            $session = $sessionSave['session'];

            $draftSave = ClinicalHistoryRepository::upsertDraft($store, $draft);
            $store = $draftSave['store'];
            $draft = $draftSave['draft'];
        }

        $clientMessageId = ClinicalHistoryRepository::trimString(
            $payload['clientMessageId'] ?? $payload['messageId'] ?? ''
        );
        $messageHash = hash('sha256', strtolower(trim($messageText)));

        if ($this->isReplay($session, $clientMessageId, $messageHash)) {
            $response = is_array($session['lastTurn']['response'] ?? null) ? $session['lastTurn']['response'] : [];
            $ai = is_array($session['lastTurn']['ai'] ?? null) ? $session['lastTurn']['ai'] : [];

            return [
                'ok' => true,
                'statusCode' => 200,
                'store' => $store,
                'session' => $session,
                'draft' => $draft,
                'replay' => true,
                'response' => $response,
                'ai' => $ai,
                'data' => $this->buildPublicPayload($session, $draft, $response, $ai),
            ];
        }

        [$session, $draft] = $this->clearPendingAi($session, $draft, 'superseded_by_new_patient_turn');

        $session['surface'] = ClinicalHistoryRepository::trimString($payload['surface'] ?? $session['surface'] ?? 'web_chat');
        $session['surfaces'] = ClinicalHistoryRepository::normalizeStringList(array_merge(
            $session['surfaces'] ?? [],
            [$session['surface']]
        ));
        $session['patient'] = ClinicalHistoryRepository::normalizePatient(array_merge(
            $session['patient'] ?? [],
            isset($payload['patient']) && is_array($payload['patient']) ? $payload['patient'] : []
        ));

        $session = ClinicalHistoryRepository::appendTranscriptMessage($session, [
            'role' => 'user',
            'actor' => 'patient',
            'content' => $messageText,
            'surface' => $session['surface'],
            'clientMessageId' => $clientMessageId,
            'meta' => [
                'caseId' => (string) ($session['caseId'] ?? ''),
            ],
        ]);

        $attachmentResult = $this->attachUploads($store, $session, $draft, $payload);
        $store = $attachmentResult['store'];
        $session = $attachmentResult['session'];
        $draft = $attachmentResult['draft'];

        $aiResult = $this->ai->requestEnvelope($session, $draft, $messageText, $payload);
        $guarded = ClinicalHistoryGuardrails::applyEnvelope($session, $draft, $aiResult['envelope'] ?? [], $aiResult);
        $draft = $guarded['draft'];
        $publicResponse = isset($guarded['publicResponse']) && is_array($guarded['publicResponse']) ? $guarded['publicResponse'] : [];
        $questionFieldKey = (string) ($guarded['questionFieldKey'] ?? '');

        $assistantContent = $this->assistantContentFromResponse($publicResponse);
        $assistantMessageId = '';
        if ($assistantContent !== '') {
            $session = ClinicalHistoryRepository::appendTranscriptMessage($session, [
                'role' => 'assistant',
                'actor' => 'clinical_intake',
                'content' => $assistantContent,
                'surface' => $session['surface'],
                'fieldKey' => $questionFieldKey,
                'meta' => [
                    'aiMode' => (string) ($aiResult['mode'] ?? 'fallback'),
                    'provider' => (string) ($aiResult['provider'] ?? 'local_fallback'),
                ],
            ]);
            $transcript = is_array($session['transcript'] ?? null) ? $session['transcript'] : [];
            $assistantMessageId = (string) (($transcript[count($transcript) - 1]['id'] ?? ''));
        }

        if ($questionFieldKey !== '') {
            $session['questionHistory'] = ClinicalHistoryRepository::normalizeStringList(array_merge(
                $session['questionHistory'] ?? [],
                [$questionFieldKey]
            ));
        }

        $session['status'] = (bool) ($draft['requiresHumanReview'] ?? true) ? 'review_required' : 'active';
        $session['updatedAt'] = local_date('c');
        $session['lastTurn'] = [
            'clientMessageId' => $clientMessageId,
            'messageHash' => $messageHash,
            'assistantMessageId' => $assistantMessageId,
            'questionFieldKey' => $questionFieldKey,
            'response' => $publicResponse,
            'ai' => $this->publicAiPayload($aiResult),
        ];

        if (($aiResult['mode'] ?? '') === 'queued' && ClinicalHistoryRepository::trimString($aiResult['jobId'] ?? '') !== '') {
            $pendingAi = $this->buildPendingAi($aiResult, $messageHash, $clientMessageId, $assistantMessageId, $questionFieldKey);
            $session['pendingAi'] = $pendingAi;
            $draft['pendingAi'] = $pendingAi;
        } else {
            $session['pendingAi'] = [];
            $draft['pendingAi'] = [];
        }

        $sessionSave = ClinicalHistoryRepository::upsertSession($store, $session);
        $store = $sessionSave['store'];
        $session = $sessionSave['session'];

        $draftSave = ClinicalHistoryRepository::upsertDraft($store, $draft);
        $store = $draftSave['store'];
        $draft = $draftSave['draft'];

        audit_log_event('clinical_history.turn_recorded', [
            'sessionId' => (string) ($session['sessionId'] ?? ''),
            'caseId' => (string) ($session['caseId'] ?? ''),
            'mode' => (string) ($aiResult['mode'] ?? 'fallback'),
            'provider' => (string) ($aiResult['provider'] ?? 'local_fallback'),
            'requiresHumanReview' => (bool) ($draft['requiresHumanReview'] ?? true),
        ]);

        return [
            'ok' => true,
            'statusCode' => 200,
            'store' => $store,
            'session' => $session,
            'draft' => $draft,
            'replay' => false,
            'response' => $publicResponse,
            'ai' => $this->publicAiPayload($aiResult),
            'data' => $this->buildPublicPayload($session, $draft, $publicResponse, $this->publicAiPayload($aiResult)),
        ];
    }

    public function getSession(array $store, array $query, bool $admin = false): array
    {
        [$session, $draft] = $this->findContext($store, $query);
        if ($session === null || $draft === null) {
            return [
                'ok' => false,
                'statusCode' => 404,
                'error' => 'Sesion clinica no encontrada',
                'errorCode' => 'clinical_history_not_found',
            ];
        }

        $reconciled = $this->reconcilePendingAi($store, $session, $draft);
        $store = $reconciled['store'];
        $session = $reconciled['session'];
        $draft = $reconciled['draft'];

        if (($reconciled['mutated'] ?? false) === true) {
            $sessionSave = ClinicalHistoryRepository::upsertSession($store, $session);
            $store = $sessionSave['store'];
            $session = $sessionSave['session'];

            $draftSave = ClinicalHistoryRepository::upsertDraft($store, $draft);
            $store = $draftSave['store'];
            $draft = $draftSave['draft'];
        }

        return [
            'ok' => true,
            'statusCode' => 200,
            'store' => $store,
            'session' => $session,
            'draft' => $draft,
            'mutated' => (bool) ($reconciled['mutated'] ?? false),
            'data' => $admin
                ? $this->buildAdminPayload($store, $session, $draft)
                : $this->buildPublicPayload($session, $draft),
        ];
    }

    public function reconcilePendingSessions(array $store, array $options = []): array
    {
        $sessions = isset($store['clinical_history_sessions']) && is_array($store['clinical_history_sessions'])
            ? array_values($store['clinical_history_sessions'])
            : [];
        $maxSessions = isset($options['maxSessions']) && is_numeric($options['maxSessions'])
            ? max(0, (int) $options['maxSessions'])
            : 50;

        $scanned = 0;
        $mutated = 0;
        $completed = 0;
        $failed = 0;
        $superseded = 0;
        $closed = 0;
        $remaining = 0;
        $processedSessionIds = [];

        foreach ($sessions as $sessionRecord) {
            $pending = ClinicalHistoryRepository::normalizePendingAi(
                isset($sessionRecord['pendingAi']) && is_array($sessionRecord['pendingAi']) ? $sessionRecord['pendingAi'] : []
            );
            if ($pending === []) {
                continue;
            }

            if ($maxSessions > 0 && $scanned >= $maxSessions) {
                break;
            }
            $scanned++;

            $session = ClinicalHistoryRepository::adminSession($sessionRecord);
            $draft = ClinicalHistoryRepository::findDraftBySessionId($store, (string) ($session['sessionId'] ?? ''));
            if ($draft === null) {
                $draft = ClinicalHistoryRepository::defaultDraft($session);
            } else {
                $draft = ClinicalHistoryRepository::adminDraft($draft);
            }

            $reconciled = $this->reconcilePendingAi($store, $session, $draft);
            $store = $reconciled['store'];
            $session = $reconciled['session'];
            $draft = $reconciled['draft'];

            if (($reconciled['mutated'] ?? false) === true) {
                $sessionSave = ClinicalHistoryRepository::upsertSession($store, $session);
                $store = $sessionSave['store'];
                $session = $sessionSave['session'];

                $draftSave = ClinicalHistoryRepository::upsertDraft($store, $draft);
                $store = $draftSave['store'];
                $draft = $draftSave['draft'];
                $mutated++;
            }

            $processedSessionIds[] = (string) ($session['sessionId'] ?? '');
            $pendingAfter = ClinicalHistoryRepository::normalizePendingAi(
                isset($session['pendingAi']) && is_array($session['pendingAi'])
                    ? $session['pendingAi']
                    : (isset($draft['pendingAi']) && is_array($draft['pendingAi']) ? $draft['pendingAi'] : [])
            );
            if ($pendingAfter !== []) {
                $remaining++;
                continue;
            }

            $lastPending = ClinicalHistoryRepository::normalizePendingAi(
                isset($session['metadata']['lastPendingAi']) && is_array($session['metadata']['lastPendingAi'])
                    ? $session['metadata']['lastPendingAi']
                    : []
            );
            $lastStatus = ClinicalHistoryRepository::trimString($lastPending['status'] ?? '');
            if ($lastStatus === 'completed') {
                $completed++;
            } elseif (in_array($lastStatus, ['failed', 'expired'], true)) {
                $failed++;
            } elseif ($lastStatus === 'superseded') {
                $superseded++;
            } elseif ($lastStatus !== '') {
                $closed++;
            }
        }

        return [
            'ok' => true,
            'store' => $store,
            'scanned' => $scanned,
            'mutated' => $mutated,
            'completed' => $completed,
            'failed' => $failed,
            'superseded' => $superseded,
            'closed' => $closed,
            'remaining' => $remaining,
            'processedSessionIds' => array_values(array_filter($processedSessionIds, static function ($sessionId): bool {
                return is_string($sessionId) && trim($sessionId) !== '';
            })),
        ];
    }

    public function applyReview(array $store, array $payload): array
    {
        [$session, $draft] = $this->findContext($store, $payload);
        if ($session === null || $draft === null) {
            return [
                'ok' => false,
                'statusCode' => 404,
                'error' => 'Sesion clinica no encontrada',
                'errorCode' => 'clinical_history_not_found',
            ];
        }

        $reconciled = $this->reconcilePendingAi($store, $session, $draft);
        $store = $reconciled['store'];
        $session = $reconciled['session'];
        $draft = $reconciled['draft'];

        [$session, $draft] = $this->clearPendingAi($session, $draft, 'closed_by_clinician_review');

        $draftPatch = isset($payload['draft']) && is_array($payload['draft'])
            ? $payload['draft']
            : [];
        if (isset($payload['intakePatch']) && is_array($payload['intakePatch'])) {
            $draftPatch['intake'] = array_merge(
                isset($draftPatch['intake']) && is_array($draftPatch['intake']) ? $draftPatch['intake'] : [],
                $payload['intakePatch']
            );
        }
        if (isset($draftPatch['intake']) && is_array($draftPatch['intake'])) {
            $draft = ClinicalHistoryGuardrails::applyPatchToDraft($draft, $draftPatch['intake']);
        }

        if (isset($draftPatch['clinicianDraft']) && is_array($draftPatch['clinicianDraft'])) {
            $draft['clinicianDraft'] = ClinicalHistoryRepository::normalizeClinicianDraft(array_merge(
                $draft['clinicianDraft'] ?? [],
                $draftPatch['clinicianDraft']
            ));
        }

        $reviewStatus = ClinicalHistoryRepository::trimString($payload['reviewStatus'] ?? $draftPatch['reviewStatus'] ?? '');
        $approve = ($payload['approve'] ?? false) === true;
        if ($approve) {
            $reviewStatus = 'approved';
        }

        if ($reviewStatus !== '') {
            $draft['reviewStatus'] = $reviewStatus;
            $draft['status'] = $reviewStatus;
            if ($reviewStatus === 'approved') {
                $draft['requiresHumanReview'] = false;
                $session['status'] = 'approved';
            } elseif ($reviewStatus === 'review_required') {
                $draft['requiresHumanReview'] = true;
                $session['status'] = 'review_required';
            }
        }

        if (array_key_exists('requiresHumanReview', $payload)) {
            $draft['requiresHumanReview'] = (bool) $payload['requiresHumanReview'];
            if ($draft['requiresHumanReview']) {
                $session['status'] = 'review_required';
            } elseif (ClinicalHistoryRepository::trimString($session['status'] ?? '') !== 'approved') {
                $session['status'] = 'active';
            }
        }

        $question = ClinicalHistoryRepository::trimString($payload['requestAdditionalQuestion'] ?? $payload['followUpQuestion'] ?? '');
        if ($question !== '') {
            $session = ClinicalHistoryRepository::appendTranscriptMessage($session, [
                'role' => 'assistant',
                'actor' => 'clinician_review',
                'content' => ClinicalHistoryGuardrails::sanitizePatientText($question),
                'surface' => 'clinician_review',
                'meta' => [
                    'requestedBy' => 'clinician',
                ],
            ]);
        }

        $draft['updatedAt'] = local_date('c');
        $draft['version'] = max(1, (int) ($draft['version'] ?? 1)) + 1;
        $session['updatedAt'] = local_date('c');

        $resolveEvents = ($approve === true)
            || ($reviewStatus !== '' && $reviewStatus !== 'review_required')
            || ((bool) ($draft['requiresHumanReview'] ?? true) === false);
        $store = $this->touchSessionEventsForReview($store, $session, $resolveEvents);

        $sessionSave = ClinicalHistoryRepository::upsertSession($store, $session);
        $store = $sessionSave['store'];
        $session = $sessionSave['session'];

        $draftSave = ClinicalHistoryRepository::upsertDraft($store, $draft);
        $store = $draftSave['store'];
        $draft = $draftSave['draft'];

        audit_log_event('clinical_history.review_updated', [
            'sessionId' => (string) ($session['sessionId'] ?? ''),
            'reviewStatus' => (string) ($draft['reviewStatus'] ?? ''),
            'requiresHumanReview' => (bool) ($draft['requiresHumanReview'] ?? true),
        ]);

        return [
            'ok' => true,
            'statusCode' => 200,
            'store' => $store,
            'session' => $session,
            'draft' => $draft,
            'data' => $this->buildAdminPayload($store, $session, $draft),
        ];
    }

    public function buildChatCompletionPayload(array $result): array
    {
        $payload = isset($result['data']) && is_array($result['data']) ? $result['data'] : [];
        $response = isset($payload['response']) && is_array($payload['response']) ? $payload['response'] : [];
        $reply = ClinicalHistoryRepository::trimString($response['reply'] ?? '');
        $nextQuestion = ClinicalHistoryRepository::trimString($response['nextQuestion'] ?? '');
        $content = trim(implode("\n\n", array_filter([$reply, $nextQuestion])));
        if ($content === '') {
            $content = 'Gracias, ya registre esta informacion en tu historia clinica.';
        }

        try {
            $id = 'clinical-chat-' . bin2hex(random_bytes(8));
        } catch (Throwable $e) {
            $id = 'clinical-chat-' . substr(sha1((string) microtime(true)), 0, 16);
        }

        return [
            'id' => $id,
            'object' => 'chat.completion',
            'created' => time(),
            'model' => 'clinical-intake',
            'choices' => [[
                'index' => 0,
                'message' => [
                    'role' => 'assistant',
                    'content' => $content,
                ],
                'finish_reason' => 'stop',
            ]],
            'mode' => (string) (($result['ai']['mode'] ?? 'fallback')),
            'source' => (string) (($result['ai']['provider'] ?? 'clinical_intake')),
            'clinicalIntake' => $payload,
        ];
    }

    private function buildPublicPayload(array $session, array $draft, array $response = [], array $ai = []): array
    {
        if ($response === []) {
            $response = isset($session['lastTurn']['response']) && is_array($session['lastTurn']['response'])
                ? $session['lastTurn']['response']
                : [];
        }
        if ($ai === []) {
            $ai = isset($session['lastTurn']['ai']) && is_array($session['lastTurn']['ai'])
                ? $session['lastTurn']['ai']
                : [];
        }

        return [
            'session' => ClinicalHistoryRepository::patientSafeSession($session),
            'draft' => ClinicalHistoryRepository::patientSafeDraft($draft),
            'response' => $response,
            'ai' => $ai,
        ];
    }

    private function buildAdminPayload(array $store, array $session, array $draft): array
    {
        return [
            'session' => ClinicalHistoryRepository::adminSession($session),
            'draft' => ClinicalHistoryRepository::adminDraft($draft),
            'events' => ClinicalHistoryRepository::findEventsBySessionId(
                $store,
                (string) ($session['sessionId'] ?? '')
            ),
        ];
    }

    private function resolveSessionContext(array $store, array $payload, bool $createIfMissing): array
    {
        $sessionId = ClinicalHistoryRepository::trimString($payload['sessionId'] ?? '');
        $caseId = ClinicalHistoryRepository::trimString($payload['caseId'] ?? '');

        $session = $sessionId !== ''
            ? ClinicalHistoryRepository::findSessionBySessionId($store, $sessionId)
            : null;
        if ($session === null && $caseId !== '') {
            $session = ClinicalHistoryRepository::findSessionByCaseId($store, $caseId);
        }

        $created = false;
        if ($session === null) {
            if (!$createIfMissing) {
                return [$store, ClinicalHistoryRepository::defaultSession(), ClinicalHistoryRepository::defaultDraft([], []), false];
            }

            $session = ClinicalHistoryRepository::defaultSession([
                'sessionId' => $sessionId,
                'caseId' => $caseId,
                'appointmentId' => $payload['appointmentId'] ?? null,
                'surface' => $payload['surface'] ?? 'web_chat',
                'patient' => isset($payload['patient']) && is_array($payload['patient']) ? $payload['patient'] : [],
                'metadata' => [
                    'source' => ClinicalHistoryRepository::trimString($payload['source'] ?? 'clinical_intake'),
                ],
            ]);
            $created = true;
        } else {
            $session = ClinicalHistoryRepository::adminSession($session);
            $session['surface'] = ClinicalHistoryRepository::trimString($payload['surface'] ?? $session['surface'] ?? 'web_chat');
            $session['surfaces'] = ClinicalHistoryRepository::normalizeStringList(array_merge(
                $session['surfaces'] ?? [],
                [$session['surface']]
            ));
            $appointmentId = ClinicalHistoryRepository::nullablePositiveInt($payload['appointmentId'] ?? null);
            if ($appointmentId !== null) {
                $session['appointmentId'] = $appointmentId;
            }
            if ($caseId !== '') {
                $session['caseId'] = $caseId;
            }
            if ($sessionId !== '') {
                $session['sessionId'] = $sessionId;
            }
            if (isset($payload['patient']) && is_array($payload['patient'])) {
                $session['patient'] = ClinicalHistoryRepository::normalizePatient(array_merge(
                    $session['patient'] ?? [],
                    $payload['patient']
                ));
            }
        }

        $draft = ClinicalHistoryRepository::findDraftBySessionId($store, (string) ($session['sessionId'] ?? ''));
        if ($draft === null) {
            $draft = ClinicalHistoryRepository::defaultDraft($session);
        } else {
            $draft = ClinicalHistoryRepository::adminDraft($draft);
        }

        $draft['sessionId'] = (string) ($session['sessionId'] ?? '');
        $draft['caseId'] = (string) ($session['caseId'] ?? '');
        $draft['appointmentId'] = $session['appointmentId'] ?? null;

        return [$store, $session, $draft, $created];
    }

    private function findContext(array $store, array $payload): array
    {
        $sessionId = ClinicalHistoryRepository::trimString($payload['sessionId'] ?? ($_GET['sessionId'] ?? ''));
        $caseId = ClinicalHistoryRepository::trimString($payload['caseId'] ?? ($_GET['caseId'] ?? ''));

        $session = $sessionId !== ''
            ? ClinicalHistoryRepository::findSessionBySessionId($store, $sessionId)
            : null;
        if ($session === null && $caseId !== '') {
            $session = ClinicalHistoryRepository::findSessionByCaseId($store, $caseId);
        }
        if ($session === null) {
            return [null, null];
        }

        $draft = ClinicalHistoryRepository::findDraftBySessionId($store, (string) ($session['sessionId'] ?? ''));
        if ($draft === null) {
            return [$session, ClinicalHistoryRepository::defaultDraft($session)];
        }

        return [$session, $draft];
    }

    private function extractPatientMessage(array $payload): string
    {
        $message = ClinicalHistoryRepository::trimString($payload['message'] ?? '');
        if ($message !== '') {
            return $message;
        }

        $messages = isset($payload['messages']) && is_array($payload['messages']) ? $payload['messages'] : [];
        for ($index = count($messages) - 1; $index >= 0; $index--) {
            $item = $messages[$index] ?? null;
            if (!is_array($item)) {
                continue;
            }
            $role = strtolower(trim((string) ($item['role'] ?? '')));
            $content = ClinicalHistoryRepository::trimString($item['content'] ?? '');
            if ($role === 'user' && $content !== '') {
                return $content;
            }
        }

        return '';
    }

    private function isReplay(array $session, string $clientMessageId, string $messageHash): bool
    {
        $lastTurn = isset($session['lastTurn']) && is_array($session['lastTurn']) ? $session['lastTurn'] : [];
        if ($lastTurn === []) {
            return false;
        }

        $lastClientMessageId = ClinicalHistoryRepository::trimString($lastTurn['clientMessageId'] ?? '');
        $lastMessageHash = ClinicalHistoryRepository::trimString($lastTurn['messageHash'] ?? '');
        if ($clientMessageId !== '' && $lastClientMessageId !== '' && $clientMessageId === $lastClientMessageId) {
            return true;
        }

        return $lastMessageHash !== '' && $lastMessageHash === $messageHash;
    }

    private function attachUploads(array $store, array $session, array $draft, array $payload): array
    {
        $attachmentIds = [];
        if (isset($payload['attachmentIds']) && is_array($payload['attachmentIds'])) {
            foreach ($payload['attachmentIds'] as $attachmentId) {
                $id = (int) $attachmentId;
                if ($id > 0) {
                    $attachmentIds[] = $id;
                }
            }
        }

        if (isset($payload['legacyUploads']) && is_array($payload['legacyUploads'])) {
            foreach ($payload['legacyUploads'] as $legacyUpload) {
                if (!is_array($legacyUpload)) {
                    continue;
                }
                $staged = ClinicalMediaService::stageLegacyUpload($store, $legacyUpload, [
                    'source' => 'clinical_history',
                ]);
                $store = $staged['store'];
                $upload = isset($staged['upload']) && is_array($staged['upload']) ? $staged['upload'] : [];
                $uploadId = (int) ($upload['id'] ?? 0);
                if ($uploadId > 0) {
                    $attachmentIds[] = $uploadId;
                }
            }
        }

        $attachmentSnapshots = $draft['intake']['adjuntos'] ?? [];
        foreach (array_values(array_unique($attachmentIds)) as $uploadId) {
            $upload = ClinicalHistoryRepository::findClinicalUploadById($store, $uploadId);
            if (!is_array($upload)) {
                continue;
            }

            $upload['clinicalHistorySessionId'] = (string) ($session['sessionId'] ?? '');
            $upload['clinicalHistoryCaseId'] = (string) ($session['caseId'] ?? '');
            $upload['appointmentId'] = $upload['appointmentId'] ?? ($session['appointmentId'] ?? null);
            $upload['linkedAt'] = local_date('c');

            $uploadSave = ClinicalHistoryRepository::upsertClinicalUpload($store, $upload);
            $store = $uploadSave['store'];
            $savedUpload = $uploadSave['upload'];

            $attachmentSnapshots[] = [
                'id' => (int) ($savedUpload['id'] ?? 0),
                'kind' => (string) ($savedUpload['kind'] ?? ''),
                'originalName' => (string) ($savedUpload['originalName'] ?? ''),
                'mime' => (string) ($savedUpload['mime'] ?? ''),
                'size' => (int) ($savedUpload['size'] ?? 0),
                'privatePath' => (string) ($savedUpload['privatePath'] ?? ''),
                'appointmentId' => $savedUpload['appointmentId'] ?? null,
            ];
        }

        $draft['intake']['adjuntos'] = ClinicalHistoryRepository::normalizeAttachmentList($attachmentSnapshots);
        return [
            'store' => $store,
            'session' => $session,
            'draft' => $draft,
        ];
    }

    private function reconcilePendingAi(array $store, array $session, array $draft): array
    {
        $session = ClinicalHistoryRepository::adminSession($session);
        $draft = ClinicalHistoryRepository::adminDraft($draft);
        $pending = ClinicalHistoryRepository::normalizePendingAi(
            isset($session['pendingAi']) && is_array($session['pendingAi'])
                ? $session['pendingAi']
                : (isset($draft['pendingAi']) && is_array($draft['pendingAi']) ? $draft['pendingAi'] : [])
        );

        if ($pending === []) {
            return [
                'store' => $store,
                'session' => $session,
                'draft' => $draft,
                'mutated' => false,
            ];
        }

        $reviewStatus = ClinicalHistoryRepository::trimString($draft['reviewStatus'] ?? '');
        $sessionStatus = ClinicalHistoryRepository::trimString($session['status'] ?? '');
        if ($reviewStatus === 'approved' || $sessionStatus === 'approved') {
            [$session, $draft] = $this->closePendingAi($session, $draft, $pending, 'closed', 'approved_before_reconcile');
            return [
                'store' => $store,
                'session' => $session,
                'draft' => $draft,
                'mutated' => true,
            ];
        }

        $lastTurn = isset($session['lastTurn']) && is_array($session['lastTurn']) ? $session['lastTurn'] : [];
        $lastMessageHash = ClinicalHistoryRepository::trimString($lastTurn['messageHash'] ?? '');
        if ($pending['messageHash'] !== '' && $lastMessageHash !== '' && $pending['messageHash'] !== $lastMessageHash) {
            [$session, $draft] = $this->closePendingAi($session, $draft, $pending, 'superseded', 'superseded_by_newer_turn');
            return [
                'store' => $store,
                'session' => $session,
                'draft' => $draft,
                'mutated' => true,
            ];
        }

        if (!figo_queue_enabled() || !figo_queue_job_id_is_valid($pending['jobId'])) {
            $session['lastTurn']['ai'] = array_merge(
                isset($session['lastTurn']['ai']) && is_array($session['lastTurn']['ai']) ? $session['lastTurn']['ai'] : [],
                [
                    'mode' => 'fallback',
                    'status' => 'failed',
                    'reason' => 'pending_job_invalid',
                    'jobId' => $pending['jobId'],
                    'pollAfterMs' => 0,
                ]
            );
            [$session, $draft] = $this->closePendingAi($session, $draft, $pending, 'failed', 'pending_job_invalid');
            $store = $this->recordPendingAiLifecycleEvent($store, $session, $draft, $pending, 'failed', 'pending_job_invalid');
            return [
                'store' => $store,
                'session' => $session,
                'draft' => $draft,
                'mutated' => true,
            ];
        }

        figo_queue_process_job($pending['jobId'], figo_queue_poll_process_timeout_seconds());
        $status = figo_queue_status_payload_for_job($pending['jobId']);
        $jobStatus = ClinicalHistoryRepository::trimString($status['status'] ?? 'queued');

        if ($jobStatus === 'completed') {
            $completion = isset($status['completion']) && is_array($status['completion']) ? $status['completion'] : null;
            $envelope = is_array($completion) ? $this->ai->envelopeFromCompletion($completion) : null;
            if (!is_array($envelope)) {
                $session['lastTurn']['ai'] = array_merge(
                    isset($session['lastTurn']['ai']) && is_array($session['lastTurn']['ai']) ? $session['lastTurn']['ai'] : [],
                    [
                        'mode' => 'fallback',
                        'status' => 'failed',
                        'reason' => 'queued_completion_invalid',
                        'jobId' => $pending['jobId'],
                        'pollAfterMs' => 0,
                    ]
                );
                [$session, $draft] = $this->closePendingAi($session, $draft, $pending, 'failed', 'queued_completion_invalid');
                $store = $this->recordPendingAiLifecycleEvent($store, $session, $draft, $pending, 'failed', 'queued_completion_invalid');
                return [
                    'store' => $store,
                    'session' => $session,
                    'draft' => $draft,
                    'mutated' => true,
                ];
            }

            $guardrailSession = $session;
            $guardrailSession['questionHistory'] = $this->removeQuestionFieldFromHistory(
                is_array($guardrailSession['questionHistory'] ?? null) ? $guardrailSession['questionHistory'] : [],
                $pending['questionFieldKey']
            );

            $aiResult = [
                'mode' => 'live',
                'status' => 'completed',
                'provider' => 'openclaw_queue',
                'reason' => 'queued_completion_reconciled',
                'jobId' => $pending['jobId'],
                'pollAfterMs' => 0,
            ];
            $guarded = ClinicalHistoryGuardrails::applyEnvelope($guardrailSession, $draft, $envelope, $aiResult);
            $draft = $guarded['draft'];
            $publicResponse = isset($guarded['publicResponse']) && is_array($guarded['publicResponse']) ? $guarded['publicResponse'] : [];
            $questionFieldKey = (string) ($guarded['questionFieldKey'] ?? '');

            $assistantContent = $this->assistantContentFromResponse($publicResponse);
            [$session, $assistantUpdated] = $this->replaceAssistantTranscriptMessage(
                $session,
                $pending['assistantMessageId'],
                $assistantContent,
                [
                    'aiMode' => 'live',
                    'provider' => 'openclaw_queue',
                    'reconciled' => true,
                    'jobId' => $pending['jobId'],
                ],
                $questionFieldKey
            );
            if (!$assistantUpdated && $assistantContent !== '') {
                $session = ClinicalHistoryRepository::appendTranscriptMessage($session, [
                    'role' => 'assistant',
                    'actor' => 'clinical_intake',
                    'content' => $assistantContent,
                    'surface' => (string) ($session['surface'] ?? 'web_chat'),
                    'fieldKey' => $questionFieldKey,
                    'meta' => [
                        'aiMode' => 'live',
                        'provider' => 'openclaw_queue',
                        'reconciled' => true,
                        'jobId' => $pending['jobId'],
                    ],
                ]);

                $transcript = is_array($session['transcript'] ?? null) ? $session['transcript'] : [];
                $pending['assistantMessageId'] = (string) (($transcript[count($transcript) - 1]['id'] ?? ''));
            }

            $session['questionHistory'] = $this->removeQuestionFieldFromHistory(
                is_array($session['questionHistory'] ?? null) ? $session['questionHistory'] : [],
                $pending['questionFieldKey']
            );
            if ($questionFieldKey !== '') {
                $session['questionHistory'] = ClinicalHistoryRepository::normalizeStringList(array_merge(
                    $session['questionHistory'],
                    [$questionFieldKey]
                ));
            }

            $publicAi = $this->publicAiPayload($aiResult);
            $session['status'] = (bool) ($draft['requiresHumanReview'] ?? true) ? 'review_required' : 'active';
            $session['lastTurn'] = [
                'clientMessageId' => ClinicalHistoryRepository::trimString($lastTurn['clientMessageId'] ?? $pending['clientMessageId']),
                'messageHash' => ClinicalHistoryRepository::trimString($lastTurn['messageHash'] ?? $pending['messageHash']),
                'assistantMessageId' => $pending['assistantMessageId'],
                'questionFieldKey' => $questionFieldKey,
                'response' => $publicResponse,
                'ai' => $publicAi,
            ];
            $session = $this->touchSession($session);
            [$session, $draft] = $this->closePendingAi(
                $session,
                $draft,
                $pending,
                'completed',
                'queued_completion_reconciled',
                ['skipTouch' => true]
            );
            $store = $this->recordPendingAiLifecycleEvent(
                $store,
                $session,
                $draft,
                $pending,
                'completed',
                'queued_completion_reconciled'
            );

            audit_log_event('clinical_history.pending_ai_reconciled', [
                'sessionId' => (string) ($session['sessionId'] ?? ''),
                'caseId' => (string) ($session['caseId'] ?? ''),
                'jobId' => $pending['jobId'],
            ]);

            return [
                'store' => $store,
                'session' => $session,
                'draft' => $draft,
                'mutated' => true,
            ];
        }

        if (in_array($jobStatus, ['queued', 'processing'], true)) {
            $nextPending = $pending;
            $nextPending['status'] = $jobStatus;
            $nextPending['pollAfterMs'] = figo_queue_poll_after_ms();
            if ($nextPending !== $pending) {
                $session['pendingAi'] = $nextPending;
                $draft['pendingAi'] = $nextPending;
                $session = $this->touchSession($session);
                $draft = $this->touchDraft($draft);
                return [
                    'store' => $store,
                    'session' => $session,
                    'draft' => $draft,
                    'mutated' => true,
                ];
            }

            return [
                'store' => $store,
                'session' => $session,
                'draft' => $draft,
                'mutated' => false,
            ];
        }

        $terminalReason = ClinicalHistoryRepository::trimString($status['errorCode'] ?? $jobStatus);
        $session['lastTurn']['ai'] = array_merge(
            isset($session['lastTurn']['ai']) && is_array($session['lastTurn']['ai']) ? $session['lastTurn']['ai'] : [],
            [
                'mode' => 'fallback',
                'status' => $jobStatus !== '' ? $jobStatus : 'failed',
                'reason' => $terminalReason !== '' ? $terminalReason : 'queue_failed',
                'jobId' => $pending['jobId'],
                'pollAfterMs' => 0,
            ]
        );
        [$session, $draft] = $this->closePendingAi(
            $session,
            $draft,
            array_merge($pending, [
                'errorCode' => ClinicalHistoryRepository::trimString($status['errorCode'] ?? ''),
                'errorMessage' => ClinicalHistoryRepository::trimString($status['errorMessage'] ?? ''),
            ]),
            $jobStatus !== '' ? $jobStatus : 'failed',
            $terminalReason !== '' ? $terminalReason : 'queue_failed'
        );
        $store = $this->recordPendingAiLifecycleEvent(
            $store,
            $session,
            $draft,
            array_merge($pending, [
                'errorCode' => ClinicalHistoryRepository::trimString($status['errorCode'] ?? ''),
                'errorMessage' => ClinicalHistoryRepository::trimString($status['errorMessage'] ?? ''),
            ]),
            $jobStatus !== '' ? $jobStatus : 'failed',
            $terminalReason !== '' ? $terminalReason : 'queue_failed'
        );

        return [
            'store' => $store,
            'session' => $session,
            'draft' => $draft,
            'mutated' => true,
        ];
    }

    private function buildPendingAi(
        array $aiResult,
        string $messageHash,
        string $clientMessageId,
        string $assistantMessageId,
        string $questionFieldKey
    ): array {
        return ClinicalHistoryRepository::normalizePendingAi([
            'jobId' => (string) ($aiResult['jobId'] ?? ''),
            'status' => (string) ($aiResult['status'] ?? $aiResult['mode'] ?? 'queued'),
            'messageHash' => $messageHash,
            'clientMessageId' => $clientMessageId,
            'assistantMessageId' => $assistantMessageId,
            'questionFieldKey' => $questionFieldKey,
            'requestedAt' => local_date('c'),
            'reason' => (string) ($aiResult['reason'] ?? ''),
            'pollAfterMs' => isset($aiResult['pollAfterMs']) && is_numeric($aiResult['pollAfterMs'])
                ? (int) $aiResult['pollAfterMs']
                : figo_queue_poll_after_ms(),
        ]);
    }

    private function clearPendingAi(array $session, array $draft, string $reason): array
    {
        $pending = ClinicalHistoryRepository::normalizePendingAi(
            isset($session['pendingAi']) && is_array($session['pendingAi'])
                ? $session['pendingAi']
                : (isset($draft['pendingAi']) && is_array($draft['pendingAi']) ? $draft['pendingAi'] : [])
        );
        if ($pending === []) {
            return [$session, $draft];
        }

        return $this->closePendingAi($session, $draft, $pending, 'closed', $reason);
    }

    private function closePendingAi(array $session, array $draft, array $pending, string $status, string $reason, array $options = []): array
    {
        $skipTouch = ($options['skipTouch'] ?? false) === true;
        $session = ClinicalHistoryRepository::adminSession($session);
        $draft = ClinicalHistoryRepository::adminDraft($draft);

        $snapshot = ClinicalHistoryRepository::normalizePendingAi($pending);
        if ($snapshot !== []) {
            $snapshot['status'] = $status;
            $snapshot['reason'] = $reason;
            $snapshot['updatedAt'] = local_date('c');
            if ($status === 'completed') {
                $snapshot['completedAt'] = $snapshot['updatedAt'];
            }
            $session['metadata']['lastPendingAi'] = $snapshot;
        }

        $session['pendingAi'] = [];
        $draft['pendingAi'] = [];

        if (!$skipTouch) {
            $session = $this->touchSession($session);
            $draft = $this->touchDraft($draft);
        }

        return [$session, $draft];
    }

    private function assistantContentFromResponse(array $response): string
    {
        return trim(implode("\n\n", array_filter([
            ClinicalHistoryRepository::trimString($response['reply'] ?? ''),
            ClinicalHistoryRepository::trimString($response['nextQuestion'] ?? ''),
        ])));
    }

    private function replaceAssistantTranscriptMessage(
        array $session,
        string $assistantMessageId,
        string $assistantContent,
        array $meta,
        string $questionFieldKey
    ): array {
        $assistantMessageId = ClinicalHistoryRepository::trimString($assistantMessageId);
        if ($assistantMessageId === '') {
            return [$session, false];
        }

        $session = ClinicalHistoryRepository::adminSession($session);
        $transcript = is_array($session['transcript'] ?? null) ? $session['transcript'] : [];
        foreach ($transcript as $index => $message) {
            if (!is_array($message)) {
                continue;
            }
            if (ClinicalHistoryRepository::trimString($message['id'] ?? '') !== $assistantMessageId) {
                continue;
            }

            $transcript[$index] = ClinicalHistoryRepository::normalizeTranscriptMessage(array_merge(
                $message,
                [
                    'content' => $assistantContent !== ''
                        ? $assistantContent
                        : ClinicalHistoryRepository::trimString($message['content'] ?? ''),
                    'fieldKey' => $questionFieldKey !== ''
                        ? $questionFieldKey
                        : ClinicalHistoryRepository::trimString($message['fieldKey'] ?? ''),
                    'meta' => array_merge(
                        isset($message['meta']) && is_array($message['meta']) ? $message['meta'] : [],
                        $meta
                    ),
                ]
            ));
            $session['transcript'] = array_values($transcript);
            $session = $this->touchSession($session);
            return [$session, true];
        }

        return [$session, false];
    }

    private function removeQuestionFieldFromHistory(array $history, string $fieldKey): array
    {
        $fieldKey = ClinicalHistoryRepository::trimString($fieldKey);
        if ($fieldKey === '') {
            return ClinicalHistoryRepository::normalizeStringList($history);
        }

        return ClinicalHistoryRepository::normalizeStringList(array_values(array_filter(
            ClinicalHistoryRepository::normalizeStringList($history),
            static function (string $item) use ($fieldKey): bool {
                return $item !== $fieldKey;
            }
        )));
    }

    private function touchSession(array $session): array
    {
        $session['updatedAt'] = local_date('c');
        $session['version'] = max(1, (int) ($session['version'] ?? 1)) + 1;
        return $session;
    }

    private function touchDraft(array $draft): array
    {
        $draft['updatedAt'] = local_date('c');
        $draft['version'] = max(1, (int) ($draft['version'] ?? 1)) + 1;
        return $draft;
    }

    private function recordPendingAiLifecycleEvent(
        array $store,
        array $session,
        array $draft,
        array $pending,
        string $status,
        string $reason
    ): array {
        $session = ClinicalHistoryRepository::adminSession($session);
        $draft = ClinicalHistoryRepository::adminDraft($draft);
        $pending = ClinicalHistoryRepository::normalizePendingAi($pending);
        if ($pending === []) {
            return $store;
        }

        $eventType = '';
        $severity = 'info';
        $requiresAction = false;
        $title = '';
        $message = '';
        if ($status === 'completed') {
            $eventType = 'draft_reconciled';
            $requiresAction = (bool) ($draft['requiresHumanReview'] ?? true);
            $severity = $requiresAction ? 'warning' : 'info';
            $title = $requiresAction
                ? 'Historia clinica reconciliada y lista para revision'
                : 'Historia clinica reconciliada automaticamente';
            $message = $requiresAction
                ? 'El borrador clinico se completo y requiere validacion del medico.'
                : 'El borrador clinico se completo sin bloqueos adicionales.';
        } elseif (in_array($status, ['failed', 'expired'], true)) {
            $eventType = 'draft_reconcile_failed';
            $severity = 'warning';
            $requiresAction = true;
            $title = $status === 'expired'
                ? 'OpenClaw no completo la historia clinica a tiempo'
                : 'OpenClaw no pudo reconciliar la historia clinica';
            $message = $pending['errorMessage'] !== ''
                ? $pending['errorMessage']
                : 'Se requiere seguimiento manual para completar la historia clinica.';
        }

        if ($eventType === '') {
            return $store;
        }

        $dedupeKey = implode('|', array_filter([
            'clinical_history',
            $eventType,
            (string) ($session['sessionId'] ?? ''),
            (string) ($pending['jobId'] ?? ''),
        ]));
        $existingEvents = ClinicalHistoryRepository::findEventsBySessionId($store, (string) ($session['sessionId'] ?? ''));
        $acknowledgedAt = '';
        $resolvedAt = '';
        foreach ($existingEvents as $existingEvent) {
            if (ClinicalHistoryRepository::trimString($existingEvent['dedupeKey'] ?? '') !== $dedupeKey) {
                continue;
            }
            $acknowledgedAt = ClinicalHistoryRepository::trimString($existingEvent['acknowledgedAt'] ?? '');
            $resolvedAt = ClinicalHistoryRepository::trimString($existingEvent['resolvedAt'] ?? '');
            break;
        }

        $event = [
            'sessionId' => (string) ($session['sessionId'] ?? ''),
            'caseId' => (string) ($session['caseId'] ?? ''),
            'appointmentId' => $session['appointmentId'] ?? null,
            'type' => $eventType,
            'severity' => $severity,
            'status' => $requiresAction ? 'open' : 'resolved',
            'title' => $title,
            'message' => $message,
            'requiresAction' => $requiresAction,
            'jobId' => (string) ($pending['jobId'] ?? ''),
            'dedupeKey' => $dedupeKey,
            'patient' => isset($session['patient']) && is_array($session['patient']) ? $session['patient'] : [],
            'metadata' => [
                'reason' => $reason,
                'reviewStatus' => (string) ($draft['reviewStatus'] ?? ''),
                'requiresHumanReview' => (bool) ($draft['requiresHumanReview'] ?? true),
                'confidence' => (float) ($draft['confidence'] ?? 0),
                'reviewReasons' => array_values(is_array($draft['reviewReasons'] ?? null) ? $draft['reviewReasons'] : []),
            ],
            'occurredAt' => local_date('c'),
            'acknowledgedAt' => $acknowledgedAt,
            'resolvedAt' => $requiresAction ? $resolvedAt : ($resolvedAt !== '' ? $resolvedAt : local_date('c')),
        ];

        $eventSave = ClinicalHistoryRepository::upsertEvent($store, $event);
        return $eventSave['store'];
    }

    private function touchSessionEventsForReview(array $store, array $session, bool $resolve): array
    {
        $sessionId = ClinicalHistoryRepository::trimString($session['sessionId'] ?? '');
        if ($sessionId === '') {
            return $store;
        }

        $events = isset($store['clinical_history_events']) && is_array($store['clinical_history_events'])
            ? $store['clinical_history_events']
            : [];
        $changed = false;
        foreach ($events as $index => $eventRecord) {
            $event = ClinicalHistoryRepository::defaultEvent($eventRecord);
            if (ClinicalHistoryRepository::trimString($event['sessionId'] ?? '') !== $sessionId) {
                continue;
            }
            if ((bool) ($event['requiresAction'] ?? false) !== true) {
                continue;
            }

            $now = local_date('c');
            if (ClinicalHistoryRepository::trimString($event['acknowledgedAt'] ?? '') === '') {
                $event['acknowledgedAt'] = $now;
            }
            if ($resolve) {
                $event['status'] = 'resolved';
                if (ClinicalHistoryRepository::trimString($event['resolvedAt'] ?? '') === '') {
                    $event['resolvedAt'] = $now;
                }
            } else {
                $event['status'] = 'acknowledged';
            }
            $event['updatedAt'] = $now;
            $events[$index] = ClinicalHistoryRepository::defaultEvent($event);
            $changed = true;
        }

        if ($changed) {
            $store['clinical_history_events'] = array_values($events);
        }

        return $store;
    }

    private function publicAiPayload(array $aiResult): array
    {
        return [
            'mode' => (string) ($aiResult['mode'] ?? 'fallback'),
            'provider' => (string) ($aiResult['provider'] ?? 'local_fallback'),
            'status' => (string) ($aiResult['status'] ?? $aiResult['mode'] ?? 'fallback'),
            'reason' => (string) ($aiResult['reason'] ?? ''),
            'jobId' => (string) ($aiResult['jobId'] ?? ''),
            'pollAfterMs' => isset($aiResult['pollAfterMs']) && is_numeric($aiResult['pollAfterMs'])
                ? (int) $aiResult['pollAfterMs']
                : 0,
        ];
    }
}

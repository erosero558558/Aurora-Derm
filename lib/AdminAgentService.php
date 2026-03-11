<?php

declare(strict_types=1);

final class AdminAgentService
{
    private const APPROVAL_TTL_SECONDS = 1800;
    private const RELAY_STALE_AFTER_SECONDS = 300;
    private const DEFAULT_RISK_MODE = 'autopilot_partial';

    /**
     * @param array<string,mixed> $store
     * @param array<string,mixed> $payload
     * @return array<string,mixed>
     */
    public static function startSession(array $store, array $payload): array
    {
        self::ensureStorage();

        $operator = self::resolveOperator();
        $context = self::normalizeContext($payload['context'] ?? []);
        $createdAt = local_date('c');
        $sessionId = self::generateId('ags');
        $session = [
            'sessionId' => $sessionId,
            'operator' => $operator,
            'activeSection' => (string) ($context['section'] ?? 'dashboard'),
            'entityRef' => self::entityRefFromContext($context),
            'status' => 'active',
            'riskMode' => self::normalizeRiskMode((string) ($payload['riskMode'] ?? '')),
            'createdAt' => $createdAt,
            'updatedAt' => $createdAt,
            'context' => $context,
            'messages' => [],
            'turns' => [],
            'toolCalls' => [],
            'approvals' => [],
            'events' => [],
        ];

        self::appendEvent($session, 'agent.session_started', [
            'activeSection' => $session['activeSection'],
            'entityRef' => $session['entityRef'],
            'operator' => $operator,
            'relay' => self::relayStatus(),
            'storeCounts' => self::buildStoreCounts($store),
        ]);
        self::writeSession($session);

        audit_log_event('agent.session_started', [
            'sessionId' => $sessionId,
            'activeSection' => $session['activeSection'],
            'entityRef' => $session['entityRef'],
            'riskMode' => $session['riskMode'],
            'operator' => $operator,
        ]);

        return self::buildSessionPayload($session);
    }

    /**
     * @param array<string,mixed> $payload
     * @return array<string,mixed>
     */
    public static function status(array $payload = []): array
    {
        self::ensureStorage();
        $sessionId = trim((string) ($payload['sessionId'] ?? ($_GET['sessionId'] ?? '')));
        $session = $sessionId !== ''
            ? self::readSession($sessionId)
            : self::findLatestSessionForOperator(self::resolveOperator());

        if ($session === null) {
            $outbox = self::recentOutboxEntries();
            return [
                'session' => null,
                'outbox' => $outbox,
                'health' => [
                    'relay' => self::relayStatus(),
                    'allowlists' => [
                        'externalChannels' => self::externalChannelAllowlist(),
                        'externalTemplates' => self::externalTemplateAllowlist(),
                    ],
                    'counts' => [
                        'messages' => 0,
                        'turns' => 0,
                        'toolCalls' => 0,
                        'pendingApprovals' => 0,
                        'outboxQueued' => count(array_filter($outbox, static function (array $entry): bool {
                            return (string) ($entry['status'] ?? '') === 'queued';
                        })),
                        'outboxTotal' => count($outbox),
                    ],
                ],
                'tools' => self::publicToolRegistry(),
            ];
        }

        return self::buildSessionPayload($session);
    }

    /**
     * @param array<string,mixed> $payload
     * @return array<string,mixed>
     */
    public static function events(array $payload = []): array
    {
        self::ensureStorage();
        $sessionId = trim((string) ($payload['sessionId'] ?? ($_GET['sessionId'] ?? '')));
        if ($sessionId === '') {
            throw new RuntimeException('sessionId requerido', 400);
        }

        $session = self::requireSession($sessionId);

        $snapshot = self::buildSessionPayload($session);
        $snapshot['events'] = array_values(array_reverse(array_slice(array_reverse(self::sessionEvents($session)), 0, 120)));
        $snapshot['syncAt'] = local_date('c');

        return $snapshot;
    }

    /**
     * @param array<string,mixed> $store
     * @param array<string,mixed> $payload
     * @return array<string,mixed>
     */
    public static function processTurn(array $store, array $payload): array
    {
        self::ensureStorage();

        $sessionId = trim((string) ($payload['sessionId'] ?? ''));
        if ($sessionId === '') {
            throw new RuntimeException('sessionId requerido', 400);
        }

        $message = trim((string) ($payload['message'] ?? ''));
        if ($message === '') {
            throw new RuntimeException('Mensaje requerido', 400);
        }

        $session = self::requireSession($sessionId);
        if ((string) ($session['status'] ?? '') === 'cancelled') {
            throw new RuntimeException('La sesion fue cancelada', 409);
        }

        $context = self::normalizeContext($payload['context'] ?? ($session['context'] ?? []));
        $session['context'] = $context;
        $session['activeSection'] = (string) ($context['section'] ?? $session['activeSection'] ?? 'dashboard');
        $session['entityRef'] = self::entityRefFromContext($context);
        $session['status'] = 'active';
        $session['updatedAt'] = local_date('c');

        $turnId = self::generateId('agt');
        $session['messages'][] = [
            'messageId' => self::generateId('agm'),
            'role' => 'user',
            'content' => $message,
            'createdAt' => local_date('c'),
            'context' => $context,
        ];

        $planned = self::planTurn($session, $message, $context, $store);
        $toolPlan = self::normalizeToolPlan($planned['toolPlan'] ?? [], $context, $message);

        $workingStore = $store;
        $toolCallsByTurn = [];
        $clientActions = [];
        $refreshRecommended = false;
        $requiresApproval = false;
        $hasBlockedTools = false;

        foreach ($toolPlan as $planItem) {
            $toolName = (string) ($planItem['tool'] ?? '');
            $toolSpec = self::toolRegistry()[$toolName] ?? null;
            $toolCall = [
                'toolCallId' => self::generateId('atc'),
                'turnId' => $turnId,
                'tool' => $toolName,
                'args' => is_array($planItem['args'] ?? null) ? $planItem['args'] : [],
                'risk' => is_array($toolSpec) ? (string) ($toolSpec['risk'] ?? 'medium') : 'unknown',
                'status' => 'planned',
                'idempotencyKey' => self::toolCallIdempotencyKey($sessionId, $turnId, $toolName, $planItem['args'] ?? []),
                'result' => null,
                'error' => '',
                'reason' => trim((string) ($planItem['reason'] ?? '')),
                'createdAt' => local_date('c'),
                'updatedAt' => local_date('c'),
                'category' => is_array($toolSpec) ? (string) ($toolSpec['category'] ?? 'read') : 'unknown',
                'domain' => is_array($toolSpec) ? (string) ($toolSpec['domain'] ?? '') : '',
            ];

            if (!is_array($toolSpec)) {
                $toolCall['status'] = 'blocked';
                $toolCall['error'] = 'Tool no registrada en la allowlist';
                $toolCall['result'] = [
                    'policy' => 'blocked',
                    'reason' => 'tool_not_registered',
                ];
                $hasBlockedTools = true;
                self::appendEvent($session, 'agent.tool_blocked', [
                    'sessionId' => $sessionId,
                    'turnId' => $turnId,
                    'toolCallId' => $toolCall['toolCallId'],
                    'tool' => $toolName,
                    'reason' => 'tool_not_registered',
                ], 'blocked');
                audit_log_event('agent.tool_blocked', [
                    'sessionId' => $sessionId,
                    'turnId' => $turnId,
                    'toolCallId' => $toolCall['toolCallId'],
                    'tool' => $toolName,
                    'reason' => 'tool_not_registered',
                ]);
                $session['toolCalls'][] = $toolCall;
                $toolCallsByTurn[] = $toolCall;
                continue;
            }

            $policy = self::policyDecision($toolSpec, $toolCall['args']);
            if ($policy['decision'] === 'blocked') {
                $toolCall['status'] = 'blocked';
                $toolCall['error'] = (string) ($policy['reason'] ?? 'Accion fuera de policy');
                $toolCall['result'] = [
                    'policy' => 'blocked',
                    'reason' => (string) ($policy['code'] ?? 'blocked'),
                ];
                $hasBlockedTools = true;
                self::appendEvent($session, 'agent.tool_blocked', [
                    'sessionId' => $sessionId,
                    'turnId' => $turnId,
                    'toolCallId' => $toolCall['toolCallId'],
                    'tool' => $toolName,
                    'reason' => (string) ($policy['code'] ?? 'blocked'),
                ], 'blocked');
                audit_log_event('agent.tool_blocked', [
                    'sessionId' => $sessionId,
                    'turnId' => $turnId,
                    'toolCallId' => $toolCall['toolCallId'],
                    'tool' => $toolName,
                    'reason' => (string) ($policy['code'] ?? 'blocked'),
                ]);
                $session['toolCalls'][] = $toolCall;
                $toolCallsByTurn[] = $toolCall;
                continue;
            }

            if ($policy['decision'] === 'approval_required') {
                $requiresApproval = true;
                $toolCall['status'] = 'waiting_approval';
                $approval = self::buildApproval($sessionId, $turnId, $toolCall, (string) ($policy['reason'] ?? 'Aprobacion requerida'));
                $session['approvals'][] = $approval;
                $toolCall['result'] = [
                    'policy' => 'approval_required',
                    'approvalId' => $approval['approvalId'],
                    'reason' => $approval['reason'],
                ];
                self::appendEvent($session, 'agent.approval_requested', [
                    'sessionId' => $sessionId,
                    'turnId' => $turnId,
                    'toolCallId' => $toolCall['toolCallId'],
                    'approvalId' => $approval['approvalId'],
                    'tool' => $toolName,
                    'reason' => $approval['reason'],
                ], 'waiting_approval');
                audit_log_event('agent.approval_requested', [
                    'sessionId' => $sessionId,
                    'turnId' => $turnId,
                    'toolCallId' => $toolCall['toolCallId'],
                    'approvalId' => $approval['approvalId'],
                    'tool' => $toolName,
                    'reason' => $approval['reason'],
                ]);
                $session['toolCalls'][] = $toolCall;
                $toolCallsByTurn[] = $toolCall;
                continue;
            }

            $toolCall['status'] = 'running';
            $toolCall['updatedAt'] = local_date('c');
            $execution = self::executeTool($toolSpec, $toolCall['args'], $workingStore, $context, $session);

            if (($execution['ok'] ?? false) === true) {
                if (isset($execution['store']) && is_array($execution['store'])) {
                    $workingStore = $execution['store'];
                }
                $toolCall['status'] = 'completed';
                $toolCall['result'] = is_array($execution['result'] ?? null) ? $execution['result'] : ['ok' => true];
                $toolCall['updatedAt'] = local_date('c');

                if (!empty($execution['mutated'])) {
                    $refreshRecommended = true;
                }

                if (!empty($execution['clientAction']) && is_array($execution['clientAction'])) {
                    $clientActions[] = $execution['clientAction'];
                }

                self::appendEvent($session, 'agent.tool_called', [
                    'sessionId' => $sessionId,
                    'turnId' => $turnId,
                    'toolCallId' => $toolCall['toolCallId'],
                    'tool' => $toolName,
                    'status' => 'completed',
                    'resultSummary' => self::summarizeToolResult($toolCall['result']),
                ]);
                audit_log_event('agent.tool_called', [
                    'sessionId' => $sessionId,
                    'turnId' => $turnId,
                    'toolCallId' => $toolCall['toolCallId'],
                    'tool' => $toolName,
                    'status' => 'completed',
                ]);
            } else {
                $toolCall['status'] = 'blocked';
                $toolCall['error'] = (string) ($execution['error'] ?? 'No se pudo ejecutar la accion');
                $toolCall['result'] = [
                    'policy' => 'blocked',
                    'reason' => (string) ($execution['code'] ?? 'execution_failed'),
                ];
                $toolCall['updatedAt'] = local_date('c');
                $hasBlockedTools = true;
                self::appendEvent($session, 'agent.tool_blocked', [
                    'sessionId' => $sessionId,
                    'turnId' => $turnId,
                    'toolCallId' => $toolCall['toolCallId'],
                    'tool' => $toolName,
                    'reason' => (string) ($execution['code'] ?? 'execution_failed'),
                ], 'blocked');
                audit_log_event('agent.tool_blocked', [
                    'sessionId' => $sessionId,
                    'turnId' => $turnId,
                    'toolCallId' => $toolCall['toolCallId'],
                    'tool' => $toolName,
                    'reason' => (string) ($execution['code'] ?? 'execution_failed'),
                ]);
            }

            $session['toolCalls'][] = $toolCall;
            $toolCallsByTurn[] = $toolCall;
        }

        if ($refreshRecommended) {
            write_store($workingStore);
        }

        $finalAnswer = self::composeFinalAnswer(
            (string) ($planned['finalAnswer'] ?? ''),
            $toolCallsByTurn,
            [
                'requiresApproval' => $requiresApproval,
                'hasBlockedTools' => $hasBlockedTools,
                'relayMode' => (string) ($planned['relay']['mode'] ?? 'disabled'),
                'activeSection' => (string) ($session['activeSection'] ?? 'dashboard'),
            ]
        );

        $turnStatus = $requiresApproval
            ? 'waiting_approval'
            : ($hasBlockedTools ? 'blocked' : 'completed');

        $turn = [
            'turnId' => $turnId,
            'message' => $message,
            'context' => $context,
            'toolPlan' => array_values(array_map(static function (array $toolCall): array {
                return [
                    'toolCallId' => (string) ($toolCall['toolCallId'] ?? ''),
                    'tool' => (string) ($toolCall['tool'] ?? ''),
                    'status' => (string) ($toolCall['status'] ?? 'planned'),
                    'risk' => (string) ($toolCall['risk'] ?? 'medium'),
                    'reason' => (string) ($toolCall['reason'] ?? ''),
                    'args' => is_array($toolCall['args'] ?? null) ? $toolCall['args'] : [],
                ];
            }, $toolCallsByTurn)),
            'finalAnswer' => $finalAnswer,
            'requiresApproval' => $requiresApproval,
            'status' => $turnStatus,
            'createdAt' => local_date('c'),
            'relay' => $planned['relay'] ?? self::relayStatus(),
        ];

        $session['turns'][] = $turn;
        $session['messages'][] = [
            'messageId' => self::generateId('agm'),
            'role' => 'assistant',
            'content' => $finalAnswer,
            'createdAt' => local_date('c'),
        ];
        $session['status'] = $turnStatus;
        $session['updatedAt'] = local_date('c');
        self::appendEvent($session, 'agent.turn_processed', [
            'sessionId' => $sessionId,
            'turnId' => $turnId,
            'status' => $turnStatus,
            'requiresApproval' => $requiresApproval,
            'toolCalls' => count($toolCallsByTurn),
            'relayMode' => (string) (($planned['relay']['mode'] ?? self::relayStatus()['mode'] ?? 'disabled')),
        ], $turnStatus);
        self::writeSession($session);

        audit_log_event('agent.turn_processed', [
            'sessionId' => $sessionId,
            'turnId' => $turnId,
            'status' => $turnStatus,
            'requiresApproval' => $requiresApproval,
            'toolCalls' => count($toolCallsByTurn),
            'refreshRecommended' => $refreshRecommended,
        ]);

        return [
            'session' => self::buildSessionPayload($session),
            'turn' => $turn,
            'clientActions' => $clientActions,
            'refreshRecommended' => $refreshRecommended,
        ];
    }

    /**
     * @param array<string,mixed> $store
     * @param array<string,mixed> $payload
     * @return array<string,mixed>
     */
    public static function approve(array $store, array $payload): array
    {
        self::ensureStorage();

        $sessionId = trim((string) ($payload['sessionId'] ?? ''));
        $approvalId = trim((string) ($payload['approvalId'] ?? ''));
        if ($sessionId === '' || $approvalId === '') {
            throw new RuntimeException('sessionId y approvalId son requeridos', 400);
        }

        $session = self::requireSession($sessionId);
        $approvalIndex = self::findApprovalIndex($session, $approvalId);
        if ($approvalIndex < 0) {
            throw new RuntimeException('Approval no encontrada', 404);
        }

        $approval = $session['approvals'][$approvalIndex];
        if ((string) ($approval['status'] ?? '') !== 'pending') {
            throw new RuntimeException('Approval ya procesada', 409);
        }

        $expiresAt = strtotime((string) ($approval['expiresAt'] ?? ''));
        if ($expiresAt !== false && $expiresAt < time()) {
            $session['approvals'][$approvalIndex]['status'] = 'expired';
            $session['approvals'][$approvalIndex]['updatedAt'] = local_date('c');
            self::writeSession($session);
            throw new RuntimeException('Approval expirada', 410);
        }

        $toolCallIndex = self::findToolCallIndex($session, (string) ($approval['toolCallId'] ?? ''));
        if ($toolCallIndex < 0) {
            throw new RuntimeException('Tool call no encontrada', 404);
        }

        $toolCall = $session['toolCalls'][$toolCallIndex];
        $toolName = (string) ($toolCall['tool'] ?? '');
        $toolSpec = self::toolRegistry()[$toolName] ?? null;
        if (!is_array($toolSpec)) {
            throw new RuntimeException('Tool no registrada', 404);
        }

        $execution = self::executeTool(
            $toolSpec,
            is_array($toolCall['args'] ?? null) ? $toolCall['args'] : [],
            $store,
            is_array($session['context'] ?? null) ? $session['context'] : [],
            $session,
            true
        );

        if (($execution['ok'] ?? false) !== true) {
            $session['toolCalls'][$toolCallIndex]['status'] = 'blocked';
            $session['toolCalls'][$toolCallIndex]['error'] = (string) ($execution['error'] ?? 'No se pudo ejecutar la accion');
            $session['toolCalls'][$toolCallIndex]['updatedAt'] = local_date('c');
            $session['approvals'][$approvalIndex]['status'] = 'rejected';
            $session['approvals'][$approvalIndex]['updatedAt'] = local_date('c');
            self::writeSession($session);
            throw new RuntimeException((string) ($execution['error'] ?? 'No se pudo ejecutar la accion'), 409);
        }

        $workingStore = isset($execution['store']) && is_array($execution['store']) ? $execution['store'] : $store;
        if (!empty($execution['mutated'])) {
            write_store($workingStore);
        }

        $operator = self::resolveOperator();
        $session['approvals'][$approvalIndex]['status'] = 'approved';
        $session['approvals'][$approvalIndex]['approvedBy'] = (string) ($operator['email'] ?? 'admin');
        $session['approvals'][$approvalIndex]['updatedAt'] = local_date('c');
        $session['toolCalls'][$toolCallIndex]['status'] = 'completed';
        $session['toolCalls'][$toolCallIndex]['error'] = '';
        $session['toolCalls'][$toolCallIndex]['result'] = is_array($execution['result'] ?? null)
            ? $execution['result']
            : ['ok' => true];
        $session['toolCalls'][$toolCallIndex]['updatedAt'] = local_date('c');
        $session['status'] = 'completed';
        $session['updatedAt'] = local_date('c');

        self::appendEvent($session, 'agent.approval_granted', [
            'sessionId' => $sessionId,
            'approvalId' => $approvalId,
            'toolCallId' => (string) ($approval['toolCallId'] ?? ''),
            'tool' => $toolName,
            'approvedBy' => (string) ($operator['email'] ?? 'admin'),
        ]);
        audit_log_event('agent.approval_granted', [
            'sessionId' => $sessionId,
            'approvalId' => $approvalId,
            'toolCallId' => (string) ($approval['toolCallId'] ?? ''),
            'tool' => $toolName,
            'approvedBy' => (string) ($operator['email'] ?? 'admin'),
        ]);

        if (str_starts_with($toolName, 'external.')) {
            self::appendEvent($session, 'agent.external_dispatched', [
                'sessionId' => $sessionId,
                'approvalId' => $approvalId,
                'toolCallId' => (string) ($approval['toolCallId'] ?? ''),
                'tool' => $toolName,
                'resultSummary' => self::summarizeToolResult(is_array($execution['result'] ?? null) ? $execution['result'] : []),
            ]);
            audit_log_event('agent.external_dispatched', [
                'sessionId' => $sessionId,
                'approvalId' => $approvalId,
                'toolCallId' => (string) ($approval['toolCallId'] ?? ''),
                'tool' => $toolName,
            ]);
        }

        self::writeSession($session);

        return [
            'session' => self::buildSessionPayload($session),
            'toolCall' => $session['toolCalls'][$toolCallIndex],
            'approval' => $session['approvals'][$approvalIndex],
            'refreshRecommended' => !empty($execution['mutated']),
        ];
    }

    /**
     * @param array<string,mixed> $payload
     * @return array<string,mixed>
     */
    public static function cancel(array $payload): array
    {
        self::ensureStorage();
        $sessionId = trim((string) ($payload['sessionId'] ?? ''));
        if ($sessionId === '') {
            throw new RuntimeException('sessionId requerido', 400);
        }

        $session = self::requireSession($sessionId);
        $session['status'] = 'cancelled';
        $session['updatedAt'] = local_date('c');

        foreach (self::sessionApprovals($session) as $index => $approval) {
            if ((string) ($approval['status'] ?? '') !== 'pending') {
                continue;
            }
            $session['approvals'][$index]['status'] = 'cancelled';
            $session['approvals'][$index]['updatedAt'] = local_date('c');
        }

        self::appendEvent($session, 'agent.session_cancelled', [
            'sessionId' => $sessionId,
        ], 'cancelled');
        self::writeSession($session);

        audit_log_event('agent.session_cancelled', [
            'sessionId' => $sessionId,
        ]);

        return self::buildSessionPayload($session);
    }

    /**
     * @param array<string,mixed> $session
     * @param array<string,mixed> $store
     * @return array<string,mixed>
     */
    private static function planTurn(array $session, string $message, array $context, array $store): array
    {
        $relayPlan = self::planTurnWithRelay($session, $message, $context);
        if (($relayPlan['ok'] ?? false) === true) {
            return [
                'toolPlan' => $relayPlan['toolPlan'] ?? [],
                'finalAnswer' => (string) ($relayPlan['finalAnswer'] ?? ''),
                'relay' => $relayPlan['relay'] ?? self::relayStatus(),
            ];
        }

        $heuristicPlan = self::planTurnHeuristically($message, $context, $store);
        return [
            'toolPlan' => $heuristicPlan['toolPlan'] ?? [],
            'finalAnswer' => (string) ($heuristicPlan['finalAnswer'] ?? ''),
            'relay' => $relayPlan['relay'] ?? self::relayStatus(),
        ];
    }

    /**
     * @param array<string,mixed> $session
     * @param array<string,mixed> $context
     * @return array<string,mixed>
     */
    private static function planTurnWithRelay(array $session, string $message, array $context): array
    {
        $status = self::relayStatus();
        if (($status['configured'] ?? false) !== true) {
            return [
                'ok' => false,
                'relay' => $status,
            ];
        }

        $mock = trim((string) getenv('PIELARMONIA_ADMIN_AGENT_RELAY_MOCK_RESPONSE'));
        if ($mock !== '') {
            $decoded = json_decode($mock, true);
            if (is_array($decoded)) {
                self::touchRelayHeartbeat('success');
                return [
                    'ok' => true,
                    'toolPlan' => is_array($decoded['toolPlan'] ?? null) ? $decoded['toolPlan'] : [],
                    'finalAnswer' => (string) ($decoded['finalAnswer'] ?? ''),
                    'relay' => self::relayStatus(),
                ];
            }
            self::touchRelayHeartbeat('error', 'mock_response_invalid');
            return [
                'ok' => false,
                'relay' => self::relayStatus(),
            ];
        }

        $endpoint = self::relayEndpoint();
        if (!function_exists('curl_init')) {
            self::touchRelayHeartbeat('error', 'curl_unavailable');
            return [
                'ok' => false,
                'relay' => self::relayStatus(),
            ];
        }

        $systemPrompt = implode("\n", [
            'Eres un copiloto operativo para un admin medico-comercial.',
            'Devuelve JSON estricto con dos claves: finalAnswer(string) y toolPlan(array).',
            'Cada item de toolPlan debe tener tool, args y reason.',
            'No propongas pagos, auth, deploy, secretos ni acciones clinicas.',
            'Tools disponibles: ' . json_encode(self::publicToolRegistry(), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            'Contexto actual: ' . json_encode($context, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            'Sesion actual: ' . json_encode([
                'activeSection' => (string) ($session['activeSection'] ?? 'dashboard'),
                'riskMode' => (string) ($session['riskMode'] ?? self::DEFAULT_RISK_MODE),
            ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        ]);

        $payload = [
            'model' => self::relayModel(),
            'messages' => [
                [
                    'role' => 'system',
                    'content' => $systemPrompt,
                ],
                [
                    'role' => 'user',
                    'content' => $message,
                ],
            ],
            'temperature' => 0.2,
            'max_tokens' => 900,
        ];

        $encoded = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if (!is_string($encoded)) {
            self::touchRelayHeartbeat('error', 'payload_encode_failed');
            return [
                'ok' => false,
                'relay' => self::relayStatus(),
            ];
        }

        $headers = ['Content-Type: application/json', 'Accept: application/json'];
        $apiKey = self::relayApiKey();
        if ($apiKey !== '') {
            $prefix = self::relayApiKeyPrefix();
            $value = $prefix !== '' ? ($prefix . ' ' . $apiKey) : $apiKey;
            $headers[] = self::relayApiKeyHeader() . ': ' . trim($value);
        }

        $timeout = self::relayTimeoutSeconds();
        $ch = curl_init($endpoint);
        if ($ch === false) {
            self::touchRelayHeartbeat('error', 'curl_init_failed');
            return [
                'ok' => false,
                'relay' => self::relayStatus(),
            ];
        }

        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_POSTFIELDS => $encoded,
            CURLOPT_TIMEOUT => $timeout,
            CURLOPT_CONNECTTIMEOUT => min(4, $timeout),
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
        ]);

        $raw = curl_exec($ch);
        $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = (string) curl_error($ch);
        curl_close($ch);

        if (!is_string($raw) || $httpCode >= 400) {
            self::touchRelayHeartbeat('error', $curlError !== '' ? $curlError : ('http_' . $httpCode));
            return [
                'ok' => false,
                'relay' => self::relayStatus(),
            ];
        }

        $decoded = json_decode($raw, true);
        if (!is_array($decoded)) {
            self::touchRelayHeartbeat('error', 'invalid_json');
            return [
                'ok' => false,
                'relay' => self::relayStatus(),
            ];
        }

        $content = '';
        if (isset($decoded['choices'][0]['message']['content']) && is_string($decoded['choices'][0]['message']['content'])) {
            $content = trim((string) $decoded['choices'][0]['message']['content']);
        } elseif (isset($decoded['response']) && is_string($decoded['response'])) {
            $content = trim((string) $decoded['response']);
        }

        if ($content === '') {
            self::touchRelayHeartbeat('error', 'empty_completion');
            return [
                'ok' => false,
                'relay' => self::relayStatus(),
            ];
        }

        $content = preg_replace('/^```(?:json)?\s*|\s*```$/i', '', $content) ?? $content;
        $plan = json_decode($content, true);
        if (!is_array($plan)) {
            self::touchRelayHeartbeat('error', 'completion_not_json');
            return [
                'ok' => false,
                'relay' => self::relayStatus(),
            ];
        }

        self::touchRelayHeartbeat('success');

        return [
            'ok' => true,
            'toolPlan' => is_array($plan['toolPlan'] ?? null) ? $plan['toolPlan'] : [],
            'finalAnswer' => (string) ($plan['finalAnswer'] ?? ''),
            'relay' => self::relayStatus(),
        ];
    }

    /**
     * @param array<string,mixed> $context
     * @param array<string,mixed> $store
     * @return array<string,mixed>
     */
    private static function planTurnHeuristically(string $message, array $context, array $store): array
    {
        $normalized = self::normalizeText($message);
        $toolPlan = [];
        $section = self::detectSectionFromText($normalized, (string) ($context['section'] ?? 'dashboard'));
        $selectedEntity = is_array($context['selectedEntity'] ?? null) ? $context['selectedEntity'] : [];

        if (preg_match('/\b(ir|abre|navega|muestra|cambia)\b/', $normalized) === 1) {
            $toolPlan[] = [
                'tool' => 'ui.navigate',
                'args' => ['section' => $section],
                'reason' => 'Abrir la seccion operativa correcta',
            ];
        }

        if (preg_match('/\b(pago|payment|cobrar|cobra|stripe|tarjeta|transferencia bancaria)\b/', $normalized) === 1) {
            $toolPlan[] = [
                'tool' => 'restricted.payments.update',
                'args' => ['intent' => 'payment_sensitive'],
                'reason' => 'El operador pidio una accion sobre pagos',
            ];
            return [
                'toolPlan' => $toolPlan,
                'finalAnswer' => 'Identifique una accion sensible sobre pagos. La bloquee porque v1 no permite mutaciones de cobro ni pagos desde el copiloto.',
            ];
        }

        if (preg_match('/\b(clave|password|secret|token|deploy|despliegue|produccion|login|autenticacion)\b/', $normalized) === 1) {
            $toolPlan[] = [
                'tool' => 'restricted.auth.reset',
                'args' => ['intent' => 'security_sensitive'],
                'reason' => 'La solicitud cae en auth, secretos o despliegue',
            ];
            return [
                'toolPlan' => $toolPlan,
                'finalAnswer' => 'La solicitud cae en un dominio restringido. Mantengo el bloqueo porque este copiloto no puede tocar autenticacion, secretos ni despliegues.',
            ];
        }

        if (preg_match('/\b(enviar|manda|manda un|redacta y envia|send)\b.*\b(whatsapp|correo|email)\b/', $normalized) === 1) {
            $channel = str_contains($normalized, 'email') || str_contains($normalized, 'correo') ? 'email' : 'whatsapp';
            $toolPlan[] = [
                'tool' => $channel === 'email' ? 'external.email.send' : 'external.whatsapp.send_template',
                'args' => [
                    'channel' => $channel,
                    'targetEntityId' => self::selectedEntityId($selectedEntity),
                    'template' => $channel === 'email' ? 'seguimiento_operativo' : 'seguimiento_callback',
                    'message' => trim($message),
                ],
                'reason' => 'La solicitud pide una salida externa',
            ];
            return [
                'toolPlan' => $toolPlan,
                'finalAnswer' => 'Prepare una accion externa y la deje en cola de aprobacion para no disparar mensajes sin confirmacion.',
            ];
        }

        if ($section === 'callbacks') {
            $callbackId = self::extractNumericReference($message);
            if ($callbackId <= 0) {
                $callbackId = self::selectedEntityId($selectedEntity);
            }

            if (preg_match('/\b(siguiente|next|proximo pendiente)\b/', $normalized) === 1) {
                $toolPlan[] = [
                    'tool' => 'ui.focus_next_pending_callback',
                    'args' => [],
                    'reason' => 'Mover el foco al siguiente callback pendiente',
                ];
                return [
                    'toolPlan' => $toolPlan,
                    'finalAnswer' => 'Movi el foco al siguiente pendiente para acelerar el triage comercial.',
                ];
            }

            if (preg_match('/\b(borrador|whatsapp|mensaje|texto)\b/', $normalized) === 1) {
                $toolPlan[] = [
                    'tool' => 'callbacks.request_ai_draft',
                    'args' => [
                        'callbackId' => $callbackId,
                        'objective' => 'whatsapp_draft',
                    ],
                    'reason' => 'Preparar un borrador comercial para el callback activo',
                ];
                return [
                    'toolPlan' => $toolPlan,
                    'finalAnswer' => 'Voy a preparar un borrador comercial para el lead seleccionado y dejarlo auditado en la sesion.',
                ];
            }

            $outcome = '';
            if (preg_match('/\b(sin respuesta|no respondio|no contesta|no responde)\b/', $normalized) === 1) {
                $outcome = 'sin_respuesta';
            } elseif (preg_match('/\b(descarta|descartalo|descartada|descartado)\b/', $normalized) === 1) {
                $outcome = 'descartado';
            } elseif (preg_match('/\b(cita cerrada|cerrado|agendado|agendada|ganado)\b/', $normalized) === 1) {
                $outcome = 'cita_cerrada';
            } elseif (preg_match('/\b(contactado|contactada|ya llame|ya le escribi|ya lo contacte)\b/', $normalized) === 1) {
                $outcome = 'contactado';
            }

            if ($callbackId > 0 && $outcome !== '') {
                $toolPlan[] = [
                    'tool' => $outcome === 'contactado' ? 'callbacks.mark_contacted' : 'callbacks.set_outcome',
                    'args' => $outcome === 'contactado'
                        ? ['callbackId' => $callbackId]
                        : ['callbackId' => $callbackId, 'outcome' => $outcome],
                    'reason' => 'Actualizar el estado operativo del callback',
                ];
                return [
                    'toolPlan' => $toolPlan,
                    'finalAnswer' => 'Actualizare el callback y dejare trazabilidad del resultado operativo.',
                ];
            }

            $toolPlan[] = [
                'tool' => 'callbacks.list',
                'args' => [
                    'filter' => str_contains($normalized, 'contactado') ? 'contacted' : 'pending',
                    'limit' => 5,
                ],
                'reason' => 'Leer los callbacks relevantes para responder',
            ];
            return [
                'toolPlan' => $toolPlan,
                'finalAnswer' => 'Te resumo los callbacks relevantes de la seccion activa para decidir el siguiente paso.',
            ];
        }

        if ($section === 'appointments') {
            $filter = 'all';
            if (preg_match('/\b(transferencia|transfer)\b/', $normalized) === 1) {
                $filter = 'pending_transfer';
            } elseif (preg_match('/\b(no show)\b/', $normalized) === 1) {
                $filter = 'no_show';
            } elseif (preg_match('/\b(48h|proximas|proximas citas|hoy)\b/', $normalized) === 1) {
                $filter = 'upcoming_48h';
            }

            $toolPlan[] = [
                'tool' => 'appointments.list',
                'args' => [
                    'filter' => $filter,
                    'limit' => 6,
                ],
                'reason' => 'Leer la agenda operativa relevante',
            ];
            return [
                'toolPlan' => $toolPlan,
                'finalAnswer' => 'Voy a resumir la agenda y señalar los casos que requieren atencion inmediata.',
            ];
        }

        if ($section === 'reviews') {
            $toolPlan[] = [
                'tool' => 'reviews.summary',
                'args' => [],
                'reason' => 'Construir un resumen de reputacion y sentimiento',
            ];

            if (preg_match('/\b(recientes|ultimas)\b/', $normalized) === 1) {
                $toolPlan[] = [
                    'tool' => 'reviews.list',
                    'args' => [
                        'filter' => 'recent',
                        'limit' => 4,
                    ],
                    'reason' => 'Listar reseñas recientes',
                ];
            } elseif (preg_match('/\b(bajas|negativas|malas|criticas)\b/', $normalized) === 1) {
                $toolPlan[] = [
                    'tool' => 'reviews.list',
                    'args' => [
                        'filter' => 'low_rated',
                        'limit' => 4,
                    ],
                    'reason' => 'Listar reseñas con atencion requerida',
                ];
            }

            return [
                'toolPlan' => $toolPlan,
                'finalAnswer' => 'Voy a resumir la señal de reseñas y destacar comentarios que requieran seguimiento.',
            ];
        }

        if ($section === 'availability') {
            $date = self::extractDateReference($message);
            if ($date === '') {
                $candidateLabel = trim((string) ($selectedEntity['label'] ?? ''));
                if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $candidateLabel) === 1) {
                    $date = $candidateLabel;
                }
                $filters = is_array($context['filters'] ?? null) ? $context['filters'] : [];
                $selectedDate = trim((string) ($filters['selectedDate'] ?? ''));
                if ($date === '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $selectedDate) === 1) {
                    $date = $selectedDate;
                }
            }

            if ($date !== '' || preg_match('/\b(dia|slots|huecos|horarios)\b/', $normalized) === 1) {
                if ($date !== '') {
                    $toolPlan[] = [
                        'tool' => 'ui.select_availability_date',
                        'args' => ['date' => $date],
                        'reason' => 'Sincronizar la fecha consultada en la UI',
                    ];
                }
                $toolPlan[] = [
                    'tool' => 'availability.day_summary',
                    'args' => $date !== '' ? ['date' => $date] : [],
                    'reason' => 'Leer la disponibilidad del dia activo',
                ];
                return [
                    'toolPlan' => $toolPlan,
                    'finalAnswer' => 'Voy a revisar la disponibilidad del dia consultado y resumir cuántos slots hay publicados.',
                ];
            }

            $toolPlan[] = [
                'tool' => 'availability.list_days',
                'args' => [
                    'filter' => 'with_slots',
                    'limit' => 6,
                ],
                'reason' => 'Listar proximos dias con horarios publicados',
            ];
            return [
                'toolPlan' => $toolPlan,
                'finalAnswer' => 'Voy a listar los proximos dias con horarios publicados para evaluar el siguiente ajuste.',
            ];
        }

        if ($section === 'queue') {
            if (preg_match('/\b(llama|call next|siguiente ticket|siguiente turno)\b/', $normalized) === 1) {
                $consultorio = (str_contains($normalized, 'c2') || preg_match('/\b2\b/', $normalized) === 1) ? 2 : 1;
                $toolPlan[] = [
                    'tool' => 'queue.call_next',
                    'args' => [
                        'consultorio' => $consultorio,
                    ],
                    'reason' => 'Preparar el llamado del siguiente turno en sala',
                ];
                return [
                    'toolPlan' => $toolPlan,
                    'finalAnswer' => 'Prepare el llamado del siguiente turno y lo dejaré pasar por confirmación antes de mutar el turnero.',
                ];
            }

            if (preg_match('/\b(sla|riesgo)\b/', $normalized) === 1) {
                $toolPlan[] = [
                    'tool' => 'ui.set_section_filter',
                    'args' => [
                        'section' => 'queue',
                        'filter' => 'sla_risk',
                    ],
                    'reason' => 'Enfocar el turnero en tickets con riesgo SLA',
                ];
                $toolPlan[] = [
                    'tool' => 'queue.list_tickets',
                    'args' => [
                        'filter' => 'sla_risk',
                        'limit' => 6,
                    ],
                    'reason' => 'Leer tickets con mayor urgencia operativa',
                ];
                return [
                    'toolPlan' => $toolPlan,
                    'finalAnswer' => 'Voy a filtrar el turnero por riesgo SLA y resumir los tickets más urgentes.',
                ];
            }

            $toolPlan[] = [
                'tool' => 'queue.summary',
                'args' => [],
                'reason' => 'Construir un resumen operativo del turnero',
            ];
            return [
                'toolPlan' => $toolPlan,
                'finalAnswer' => 'Voy a resumir el estado del turnero, con espera, llamados y ayudas activas.',
            ];
        }

        $fallbackTool = match ($section) {
            'availability' => 'ui.navigate',
            'reviews' => 'ui.navigate',
            'queue' => 'ui.navigate',
            default => 'ui.navigate',
        };

        $toolPlan[] = [
            'tool' => $fallbackTool,
            'args' => ['section' => $section],
            'reason' => 'Mantener el contexto alineado con la solicitud',
        ];

        return [
            'toolPlan' => $toolPlan,
            'finalAnswer' => 'Alinee el copiloto con la seccion operativa pedida. Si quieres, ahora puedo leer o actuar dentro de ese flujo.',
        ];
    }

    /**
     * @param array<int,array<string,mixed>> $plan
     * @param array<string,mixed> $context
     * @return array<int,array<string,mixed>>
     */
    private static function normalizeToolPlan(array $plan, array $context, string $message): array
    {
        $normalized = [];
        foreach ($plan as $item) {
            if (!is_array($item)) {
                continue;
            }

            $tool = trim((string) ($item['tool'] ?? ''));
            if ($tool === '') {
                continue;
            }

            $args = is_array($item['args'] ?? null) ? $item['args'] : [];
            if ($tool === 'ui.navigate' && !isset($args['section'])) {
                $args['section'] = (string) ($context['section'] ?? self::detectSectionFromText(self::normalizeText($message), 'dashboard'));
            }

            $normalized[] = [
                'tool' => $tool,
                'args' => $args,
                'reason' => trim((string) ($item['reason'] ?? '')),
            ];
        }

        if ($normalized !== []) {
            return $normalized;
        }

        return [[
            'tool' => 'ui.navigate',
            'args' => ['section' => (string) ($context['section'] ?? 'dashboard')],
            'reason' => 'Mantener el panel sincronizado con el contexto actual',
        ]];
    }

    /**
     * @param array<string,mixed> $toolSpec
     * @param array<string,mixed> $args
     * @param array<string,mixed> $store
     * @param array<string,mixed> $context
     * @param array<string,mixed> $session
     * @return array<string,mixed>
     */
    private static function executeTool(
        array $toolSpec,
        array $args,
        array $store,
        array $context,
        array $session,
        bool $approved = false
    ): array {
        $tool = (string) ($toolSpec['tool'] ?? '');

        return match ($tool) {
            'callbacks.list' => self::executeCallbacksList($store, $args),
            'appointments.list' => self::executeAppointmentsList($store, $args),
            'reviews.list' => self::executeReviewsList($store, $args),
            'reviews.summary' => self::executeReviewsSummary($store),
            'availability.list_days' => self::executeAvailabilityListDays($store, $args),
            'availability.day_summary' => self::executeAvailabilityDaySummary($store, $args),
            'queue.summary' => self::executeQueueSummary($store),
            'queue.list_tickets' => self::executeQueueListTickets($store, $args),
            'callbacks.mark_contacted' => self::executeMarkCallbackContacted($store, $args),
            'callbacks.set_outcome' => self::executeSetCallbackOutcome($store, $args),
            'callbacks.request_ai_draft' => self::executeRequestCallbackAiDraft($store, $args),
            'queue.call_next' => self::executeQueueCallNext($store, $args),
            'ui.navigate' => [
                'ok' => true,
                'result' => [
                    'section' => self::normalizeSection((string) ($args['section'] ?? $context['section'] ?? 'dashboard')),
                    'summary' => 'Navegacion preparada para el panel',
                ],
                'clientAction' => [
                    'tool' => 'ui.navigate',
                    'args' => [
                        'section' => self::normalizeSection((string) ($args['section'] ?? $context['section'] ?? 'dashboard')),
                    ],
                ],
                'mutated' => false,
                'store' => $store,
            ],
            'ui.set_section_filter' => [
                'ok' => true,
                'result' => [
                    'section' => self::normalizeSection((string) ($args['section'] ?? $context['section'] ?? 'dashboard')),
                    'filter' => trim((string) ($args['filter'] ?? 'all')),
                    'summary' => 'Filtro operativo preparado para la seccion',
                ],
                'clientAction' => [
                    'tool' => 'ui.set_section_filter',
                    'args' => [
                        'section' => self::normalizeSection((string) ($args['section'] ?? $context['section'] ?? 'dashboard')),
                        'filter' => trim((string) ($args['filter'] ?? 'all')),
                    ],
                ],
                'mutated' => false,
                'store' => $store,
            ],
            'ui.select_availability_date' => [
                'ok' => true,
                'result' => [
                    'date' => trim((string) ($args['date'] ?? '')),
                    'summary' => 'Fecha de disponibilidad preparada para revision',
                ],
                'clientAction' => [
                    'tool' => 'ui.select_availability_date',
                    'args' => [
                        'date' => trim((string) ($args['date'] ?? '')),
                    ],
                ],
                'mutated' => false,
                'store' => $store,
            ],
            'ui.focus_next_pending_callback' => [
                'ok' => true,
                'result' => [
                    'summary' => 'Foco operativo movido al siguiente pendiente',
                ],
                'clientAction' => [
                    'tool' => 'ui.focus_next_pending_callback',
                    'args' => [],
                ],
                'mutated' => false,
                'store' => $store,
            ],
            'external.whatsapp.send_template',
            'external.email.send' => self::executeExternalOutbox($store, $tool, $args, $session, $approved),
            default => [
                'ok' => false,
                'error' => 'Tool sin executor',
                'code' => 'tool_executor_missing',
            ],
        };
    }

    /**
     * @param array<string,mixed> $toolSpec
     * @param array<string,mixed> $args
     * @return array<string,string>
     */
    private static function policyDecision(array $toolSpec, array $args): array
    {
        $category = (string) ($toolSpec['category'] ?? 'read');
        $tool = (string) ($toolSpec['tool'] ?? '');

        if ($category === 'restricted') {
            return [
                'decision' => 'blocked',
                'reason' => 'Tool restringida en v1',
                'code' => 'restricted_tool',
            ];
        }

        if ($category === 'external') {
            $channel = trim((string) ($args['channel'] ?? ($tool === 'external.email.send' ? 'email' : 'whatsapp')));
            if (!in_array($channel, self::externalChannelAllowlist(), true)) {
                return [
                    'decision' => 'blocked',
                    'reason' => 'Canal externo fuera de allowlist',
                    'code' => 'external_channel_not_allowlisted',
                ];
            }

            $template = self::normalizeText((string) ($args['template'] ?? ''));
            if ($template === '' || !in_array($template, self::externalTemplateAllowlist(), true)) {
                return [
                    'decision' => 'blocked',
                    'reason' => 'Template externo fuera de allowlist',
                    'code' => 'external_template_not_allowlisted',
                ];
            }

            return [
                'decision' => 'approval_required',
                'reason' => 'Accion externa en cola de aprobacion',
                'code' => 'approval_required',
            ];
        }

        if ($category === 'write-internal') {
            $requiresApproval = (bool) ($toolSpec['requiresApproval'] ?? false);
            if ($requiresApproval) {
                return [
                    'decision' => 'approval_required',
                    'reason' => 'Mutacion interna requiere confirmacion',
                    'code' => 'approval_required',
                ];
            }

            $autoExecutable = (bool) ($toolSpec['autoExecutable'] ?? false);
            $reversible = (bool) ($toolSpec['reversible'] ?? false);
            if (!$autoExecutable || !$reversible) {
                return [
                    'decision' => 'blocked',
                    'reason' => 'Mutacion interna no reversible',
                    'code' => 'write_internal_blocked',
                ];
            }
        }

        return [
            'decision' => 'auto',
            'reason' => 'Tool permitida',
            'code' => 'auto',
        ];
    }

    /**
     * @param array<string,mixed> $store
     * @param array<string,mixed> $args
     * @return array<string,mixed>
     */
    private static function executeCallbacksList(array $store, array $args): array
    {
        $items = LeadOpsService::enrichCallbacks(
            isset($store['callbacks']) && is_array($store['callbacks']) ? $store['callbacks'] : [],
            $store
        );
        $filter = self::normalizeText((string) ($args['filter'] ?? 'all'));
        if ($filter === 'pending') {
            $items = array_values(array_filter($items, static function (array $callback): bool {
                return map_callback_status((string) ($callback['status'] ?? 'pendiente')) !== 'contactado';
            }));
        } elseif ($filter === 'contacted') {
            $items = array_values(array_filter($items, static function (array $callback): bool {
                return map_callback_status((string) ($callback['status'] ?? 'pendiente')) === 'contactado';
            }));
        }

        $limit = max(1, min(12, (int) ($args['limit'] ?? 5)));
        $items = array_slice($items, 0, $limit);

        return [
            'ok' => true,
            'store' => $store,
            'mutated' => false,
            'result' => [
                'items' => $items,
                'summary' => 'Callbacks consultados: ' . count($items),
            ],
        ];
    }

    /**
     * @param array<string,mixed> $store
     * @param array<string,mixed> $args
     * @return array<string,mixed>
     */
    private static function executeAppointmentsList(array $store, array $args): array
    {
        $items = isset($store['appointments']) && is_array($store['appointments']) ? $store['appointments'] : [];
        $filter = self::normalizeText((string) ($args['filter'] ?? 'all'));
        if ($filter === 'pending_transfer') {
            $items = array_values(array_filter($items, static function (array $appointment): bool {
                $payment = self::normalizeText((string) ($appointment['paymentStatus'] ?? ($appointment['payment_status'] ?? '')));
                return in_array($payment, ['pending_transfer', 'pending_transfer_review'], true);
            }));
        } elseif ($filter === 'no_show') {
            $items = array_values(array_filter($items, static function (array $appointment): bool {
                return self::normalizeText((string) ($appointment['status'] ?? '')) === 'no_show';
            }));
        } elseif ($filter === 'upcoming_48h') {
            $items = array_values(array_filter($items, static function (array $appointment): bool {
                $stamp = strtotime(trim((string) (($appointment['date'] ?? '') . ' ' . ($appointment['time'] ?? ''))));
                if ($stamp === false) {
                    return false;
                }
                $delta = $stamp - time();
                return $delta >= 0 && $delta <= (48 * 3600);
            }));
        }

        usort($items, static function (array $left, array $right): int {
            $leftStamp = strtotime(trim((string) (($left['date'] ?? '') . ' ' . ($left['time'] ?? '')))) ?: 0;
            $rightStamp = strtotime(trim((string) (($right['date'] ?? '') . ' ' . ($right['time'] ?? '')))) ?: 0;
            return $leftStamp <=> $rightStamp;
        });

        $limit = max(1, min(12, (int) ($args['limit'] ?? 6)));
        $items = array_slice($items, 0, $limit);

        return [
            'ok' => true,
            'store' => $store,
            'mutated' => false,
            'result' => [
                'items' => $items,
                'summary' => 'Citas consultadas: ' . count($items),
            ],
        ];
    }

    /**
     * @param array<string,mixed> $store
     * @param array<string,mixed> $args
     * @return array<string,mixed>
     */
    private static function executeReviewsList(array $store, array $args): array
    {
        $reviews = isset($store['reviews']) && is_array($store['reviews']) ? $store['reviews'] : [];
        usort($reviews, static function (array $left, array $right): int {
            $leftTs = strtotime((string) ($left['createdAt'] ?? ($left['date'] ?? ''))) ?: 0;
            $rightTs = strtotime((string) ($right['createdAt'] ?? ($right['date'] ?? ''))) ?: 0;
            return $rightTs <=> $leftTs;
        });

        $filter = self::normalizeText((string) ($args['filter'] ?? 'all'));
        if ($filter === 'recent') {
            $threshold = time() - (30 * 86400);
            $reviews = array_values(array_filter($reviews, static function (array $review) use ($threshold): bool {
                $stamp = strtotime((string) ($review['createdAt'] ?? ($review['date'] ?? ''))) ?: 0;
                return $stamp >= $threshold;
            }));
        } elseif ($filter === 'low_rated') {
            $reviews = array_values(array_filter($reviews, static function (array $review): bool {
                return (int) ($review['rating'] ?? 0) <= 3;
            }));
        } elseif ($filter === 'five_star') {
            $reviews = array_values(array_filter($reviews, static function (array $review): bool {
                return (int) ($review['rating'] ?? 0) >= 5;
            }));
        }

        $limit = max(1, min(10, (int) ($args['limit'] ?? 5)));
        $reviews = array_slice($reviews, 0, $limit);

        return [
            'ok' => true,
            'store' => $store,
            'mutated' => false,
            'result' => [
                'items' => $reviews,
                'summary' => 'Reseñas consultadas: ' . count($reviews),
            ],
        ];
    }

    /**
     * @param array<string,mixed> $store
     * @return array<string,mixed>
     */
    private static function executeReviewsSummary(array $store): array
    {
        $reviews = isset($store['reviews']) && is_array($store['reviews']) ? $store['reviews'] : [];
        $total = count($reviews);
        $average = 0.0;
        $recentCount = 0;
        $lowRatedCount = 0;
        $threshold = time() - (30 * 86400);

        foreach ($reviews as $review) {
            $rating = (float) ($review['rating'] ?? 0);
            $average += $rating;
            if ($rating <= 3.0) {
                $lowRatedCount++;
            }
            $stamp = strtotime((string) ($review['createdAt'] ?? ($review['date'] ?? ''))) ?: 0;
            if ($stamp >= $threshold) {
                $recentCount++;
            }
        }

        if ($total > 0) {
            $average /= $total;
        }

        return [
            'ok' => true,
            'store' => $store,
            'mutated' => false,
            'result' => [
                'metrics' => [
                    'total' => $total,
                    'averageRating' => round($average, 1),
                    'recentCount' => $recentCount,
                    'lowRatedCount' => $lowRatedCount,
                ],
                'summary' => sprintf(
                    'Reseñas: %d totales, promedio %.1f, %d recientes, %d con atención requerida',
                    $total,
                    $average,
                    $recentCount,
                    $lowRatedCount
                ),
            ],
        ];
    }

    /**
     * @param array<string,mixed> $store
     * @param array<string,mixed> $args
     * @return array<string,mixed>
     */
    private static function executeAvailabilityListDays(array $store, array $args): array
    {
        $availability = isset($store['availability']) && is_array($store['availability']) ? $store['availability'] : [];
        $days = [];
        foreach ($availability as $date => $slots) {
            if (!is_array($slots)) {
                continue;
            }
            $normalizedSlots = array_values(array_filter(array_map('strval', $slots), static function (string $slot): bool {
                return trim($slot) !== '';
            }));
            sort($normalizedSlots);
            $days[] = [
                'date' => (string) $date,
                'slotCount' => count($normalizedSlots),
                'slots' => $normalizedSlots,
                'firstSlot' => $normalizedSlots[0] ?? '',
                'lastSlot' => $normalizedSlots !== [] ? $normalizedSlots[count($normalizedSlots) - 1] : '',
            ];
        }

        usort($days, static function (array $left, array $right): int {
            return strcmp((string) ($left['date'] ?? ''), (string) ($right['date'] ?? ''));
        });

        $filter = self::normalizeText((string) ($args['filter'] ?? 'with_slots'));
        if ($filter === 'with_slots') {
            $days = array_values(array_filter($days, static function (array $day): bool {
                return (int) ($day['slotCount'] ?? 0) > 0;
            }));
        }

        $limit = max(1, min(12, (int) ($args['limit'] ?? 6)));
        $days = array_slice($days, 0, $limit);

        return [
            'ok' => true,
            'store' => $store,
            'mutated' => false,
            'result' => [
                'items' => $days,
                'summary' => 'Días con horarios: ' . count($days),
            ],
        ];
    }

    /**
     * @param array<string,mixed> $store
     * @param array<string,mixed> $args
     * @return array<string,mixed>
     */
    private static function executeAvailabilityDaySummary(array $store, array $args): array
    {
        $availability = isset($store['availability']) && is_array($store['availability']) ? $store['availability'] : [];
        $date = trim((string) ($args['date'] ?? ''));
        if ($date === '' || !isset($availability[$date])) {
            $keys = array_keys($availability);
            sort($keys);
            $date = (string) ($keys[0] ?? '');
        }

        $slots = isset($availability[$date]) && is_array($availability[$date]) ? array_values($availability[$date]) : [];
        sort($slots);

        return [
            'ok' => true,
            'store' => $store,
            'mutated' => false,
            'result' => [
                'date' => $date,
                'slots' => $slots,
                'slotCount' => count($slots),
                'summary' => $date !== ''
                    ? sprintf('Disponibilidad %s: %d slot(s)', $date, count($slots))
                    : 'No hay días de disponibilidad cargados',
            ],
        ];
    }

    /**
     * @param array<string,mixed> $store
     * @return array<string,mixed>
     */
    private static function executeQueueSummary(array $store): array
    {
        $service = new QueueService();
        $state = $service->getQueueState($store);
        $data = is_array($state['data'] ?? null) ? $state['data'] : [];

        return [
            'ok' => true,
            'store' => $store,
            'mutated' => false,
            'result' => [
                'queueState' => $data,
                'summary' => sprintf(
                    'Turnero: %d en espera, %d llamados, %d solicitudes de apoyo',
                    (int) ($data['waitingCount'] ?? 0),
                    (int) ($data['calledCount'] ?? 0),
                    (int) ($data['assistancePendingCount'] ?? 0)
                ),
            ],
        ];
    }

    /**
     * @param array<string,mixed> $store
     * @param array<string,mixed> $args
     * @return array<string,mixed>
     */
    private static function executeQueueListTickets(array $store, array $args): array
    {
        $service = new QueueService();
        $state = $service->getQueueState($store);
        $data = is_array($state['data'] ?? null) ? $state['data'] : [];
        $items = isset($data['nextTickets']) && is_array($data['nextTickets']) ? $data['nextTickets'] : [];
        $filter = self::normalizeText((string) ($args['filter'] ?? 'all'));
        if ($filter === 'sla_risk') {
            $items = array_values(array_filter($items, static function (array $ticket): bool {
                $priority = self::normalizeText((string) ($ticket['priorityClass'] ?? ''));
                $estimatedWait = (int) ($ticket['estimatedWaitMin'] ?? 0);
                return $estimatedWait >= 20 || $priority === 'appt_overdue';
            }));
        }

        $limit = max(1, min(10, (int) ($args['limit'] ?? 6)));
        $items = array_slice($items, 0, $limit);

        return [
            'ok' => true,
            'store' => $store,
            'mutated' => false,
            'result' => [
                'items' => $items,
                'summary' => 'Tickets visibles: ' . count($items),
            ],
        ];
    }

    /**
     * @param array<string,mixed> $store
     * @param array<string,mixed> $args
     * @return array<string,mixed>
     */
    private static function executeQueueCallNext(array $store, array $args): array
    {
        $consultorio = (int) ($args['consultorio'] ?? 1);
        $service = new QueueService();
        $result = $service->callNext($store, $consultorio === 2 ? 2 : 1);

        if (($result['ok'] ?? false) !== true) {
            return [
                'ok' => false,
                'error' => (string) ($result['error'] ?? 'No se pudo llamar el siguiente ticket'),
                'code' => (string) ($result['errorCode'] ?? 'queue_call_next_failed'),
            ];
        }

        return [
            'ok' => true,
            'store' => is_array($result['store'] ?? null) ? $result['store'] : $store,
            'mutated' => true,
            'result' => [
                'ticket' => $result['ticket'] ?? null,
                'summary' => 'Llamado ejecutado para consultorio ' . ($consultorio === 2 ? '2' : '1'),
            ],
        ];
    }

    /**
     * @param array<string,mixed> $store
     * @param array<string,mixed> $args
     * @return array<string,mixed>
     */
    private static function executeMarkCallbackContacted(array $store, array $args): array
    {
        $callbackId = (int) ($args['callbackId'] ?? 0);
        if ($callbackId <= 0) {
            return [
                'ok' => false,
                'error' => 'callbackId invalido',
                'code' => 'invalid_callback_id',
            ];
        }

        $index = self::findCallbackIndex($store, $callbackId);
        if ($index < 0) {
            return [
                'ok' => false,
                'error' => 'Callback no encontrada',
                'code' => 'callback_not_found',
            ];
        }

        $callback = $store['callbacks'][$index];
        $callback['status'] = 'contactado';
        $callback['leadOps'] = LeadOpsService::mergeLeadOps($callback, [
            'outcome' => 'contactado',
            'contactedAt' => local_date('c'),
        ], $store);
        $store['callbacks'][$index] = LeadOpsService::enrichCallback($callback, $store);

        return [
            'ok' => true,
            'store' => $store,
            'mutated' => true,
            'result' => [
                'callback' => $store['callbacks'][$index],
                'summary' => 'Callback marcada como contactada',
            ],
        ];
    }

    /**
     * @param array<string,mixed> $store
     * @param array<string,mixed> $args
     * @return array<string,mixed>
     */
    private static function executeSetCallbackOutcome(array $store, array $args): array
    {
        $callbackId = (int) ($args['callbackId'] ?? 0);
        $outcome = self::normalizeText((string) ($args['outcome'] ?? ''));
        if ($callbackId <= 0 || $outcome === '') {
            return [
                'ok' => false,
                'error' => 'callbackId y outcome son requeridos',
                'code' => 'invalid_outcome_args',
            ];
        }

        $allowedOutcomes = LeadOpsService::allowedOutcomes();
        if (!in_array($outcome, $allowedOutcomes, true)) {
            return [
                'ok' => false,
                'error' => 'Outcome fuera de allowlist',
                'code' => 'invalid_outcome',
            ];
        }

        $index = self::findCallbackIndex($store, $callbackId);
        if ($index < 0) {
            return [
                'ok' => false,
                'error' => 'Callback no encontrada',
                'code' => 'callback_not_found',
            ];
        }

        $callback = $store['callbacks'][$index];
        $callback['status'] = 'contactado';
        $callback['leadOps'] = LeadOpsService::mergeLeadOps($callback, [
            'outcome' => $outcome,
            'contactedAt' => local_date('c'),
        ], $store);
        $store['callbacks'][$index] = LeadOpsService::enrichCallback($callback, $store);

        return [
            'ok' => true,
            'store' => $store,
            'mutated' => true,
            'result' => [
                'callback' => $store['callbacks'][$index],
                'summary' => 'Outcome actualizada a ' . $outcome,
            ],
        ];
    }

    /**
     * @param array<string,mixed> $store
     * @param array<string,mixed> $args
     * @return array<string,mixed>
     */
    private static function executeRequestCallbackAiDraft(array $store, array $args): array
    {
        $callbackId = (int) ($args['callbackId'] ?? 0);
        $objective = self::normalizeText((string) ($args['objective'] ?? 'whatsapp_draft'));
        if ($callbackId <= 0) {
            return [
                'ok' => false,
                'error' => 'callbackId invalido',
                'code' => 'invalid_callback_id',
            ];
        }

        if (!in_array($objective, LeadOpsService::allowedObjectives(), true)) {
            return [
                'ok' => false,
                'error' => 'Objetivo IA fuera de allowlist',
                'code' => 'invalid_ai_objective',
            ];
        }

        $index = self::findCallbackIndex($store, $callbackId);
        if ($index < 0) {
            return [
                'ok' => false,
                'error' => 'Callback no encontrada',
                'code' => 'callback_not_found',
            ];
        }

        $callback = $store['callbacks'][$index];
        $callback['leadOps'] = LeadOpsService::requestLeadAi($callback, $objective, $store);
        $store['callbacks'][$index] = LeadOpsService::enrichCallback($callback, $store);

        return [
            'ok' => true,
            'store' => $store,
            'mutated' => true,
            'result' => [
                'callback' => $store['callbacks'][$index],
                'summary' => 'Solicitud IA registrada para el callback',
            ],
        ];
    }

    /**
     * @param array<string,mixed> $store
     * @param array<string,mixed> $args
     * @param array<string,mixed> $session
     * @return array<string,mixed>
     */
    private static function executeExternalOutbox(
        array $store,
        string $tool,
        array $args,
        array $session,
        bool $approved
    ): array {
        if (!$approved) {
            return [
                'ok' => false,
                'error' => 'Approval requerida antes de despachar',
                'code' => 'approval_required',
            ];
        }

        $channel = trim((string) ($args['channel'] ?? ($tool === 'external.email.send' ? 'email' : 'whatsapp')));
        if (!in_array($channel, self::externalChannelAllowlist(), true)) {
            return [
                'ok' => false,
                'error' => 'Canal externo fuera de allowlist',
                'code' => 'external_channel_not_allowlisted',
            ];
        }

        $template = self::normalizeText((string) ($args['template'] ?? 'operational_followup'));
        if (!in_array($template, self::externalTemplateAllowlist(), true)) {
            return [
                'ok' => false,
                'error' => 'Template externo fuera de allowlist',
                'code' => 'external_template_not_allowlisted',
            ];
        }

        $outboxEntry = [
            'outboxId' => self::generateId('aox'),
            'tool' => $tool,
            'channel' => $channel,
            'targetEntityId' => (int) ($args['targetEntityId'] ?? 0),
            'template' => $template,
            'message' => truncate_field(sanitize_xss((string) ($args['message'] ?? '')), 600),
            'sessionId' => (string) ($session['sessionId'] ?? ''),
            'createdAt' => local_date('c'),
            'status' => 'queued',
        ];
        self::appendOutboxEntry($outboxEntry);

        return [
            'ok' => true,
            'store' => $store,
            'mutated' => false,
            'result' => [
                'outbox' => $outboxEntry,
                'summary' => 'Accion externa encolada para ' . $channel,
            ],
        ];
    }

    /**
     * @param array<string,mixed> $session
     * @return array<string,mixed>
     */
    private static function buildSessionPayload(array $session): array
    {
        $outbox = self::sessionOutboxEntries($session);
        $pendingApprovals = count(array_filter(self::sessionApprovals($session), static function (array $approval): bool {
            return (string) ($approval['status'] ?? '') === 'pending';
        }));
        $queuedOutbox = count(array_filter($outbox, static function (array $entry): bool {
            return (string) ($entry['status'] ?? '') === 'queued';
        }));

        return [
            'session' => [
                'sessionId' => (string) ($session['sessionId'] ?? ''),
                'operator' => is_array($session['operator'] ?? null) ? $session['operator'] : [],
                'activeSection' => (string) ($session['activeSection'] ?? 'dashboard'),
                'entityRef' => (string) ($session['entityRef'] ?? ''),
                'status' => (string) ($session['status'] ?? 'active'),
                'riskMode' => (string) ($session['riskMode'] ?? self::DEFAULT_RISK_MODE),
                'createdAt' => (string) ($session['createdAt'] ?? ''),
                'updatedAt' => (string) ($session['updatedAt'] ?? ''),
            ],
            'context' => is_array($session['context'] ?? null) ? $session['context'] : [],
            'messages' => self::sessionMessages($session),
            'turns' => self::sessionTurns($session),
            'toolCalls' => self::sessionToolCalls($session),
            'approvals' => self::sessionApprovals($session),
            'events' => self::sessionEvents($session),
            'outbox' => $outbox,
            'health' => [
                'relay' => self::relayStatus(),
                'allowlists' => [
                    'externalChannels' => self::externalChannelAllowlist(),
                    'externalTemplates' => self::externalTemplateAllowlist(),
                ],
                'counts' => [
                    'messages' => count(self::sessionMessages($session)),
                    'turns' => count(self::sessionTurns($session)),
                    'toolCalls' => count(self::sessionToolCalls($session)),
                    'pendingApprovals' => $pendingApprovals,
                    'outboxQueued' => $queuedOutbox,
                    'outboxTotal' => count($outbox),
                ],
            ],
            'tools' => self::publicToolRegistry(),
        ];
    }

    /**
     * @param array<string,mixed> $toolCalls
     * @param array<string,mixed> $meta
     */
    private static function composeFinalAnswer(string $base, array $toolCalls, array $meta): string
    {
        $parts = [];
        $relayMode = (string) ($meta['relayMode'] ?? 'disabled');
        if ($relayMode !== 'online') {
            $parts[] = 'Operando en modo degradado del relay.';
        }

        $completed = array_values(array_filter($toolCalls, static function (array $toolCall): bool {
            return (string) ($toolCall['status'] ?? '') === 'completed';
        }));
        $waiting = array_values(array_filter($toolCalls, static function (array $toolCall): bool {
            return (string) ($toolCall['status'] ?? '') === 'waiting_approval';
        }));
        $blocked = array_values(array_filter($toolCalls, static function (array $toolCall): bool {
            return (string) ($toolCall['status'] ?? '') === 'blocked';
        }));

        if ($base !== '') {
            $parts[] = trim($base);
        }

        foreach ($completed as $toolCall) {
            $summary = self::summarizeToolResult(is_array($toolCall['result'] ?? null) ? $toolCall['result'] : []);
            if ($summary !== '') {
                $parts[] = $summary . '.';
            }
        }

        if ($waiting !== []) {
            $parts[] = 'Hay ' . count($waiting) . ' accion(es) esperando aprobacion.';
        }

        if ($blocked !== []) {
            $parts[] = 'Bloquee ' . count($blocked) . ' accion(es) fuera de policy.';
        }

        if ($parts === []) {
            $parts[] = 'Sesion actualizada sin acciones adicionales.';
        }

        return trim(implode(' ', $parts));
    }

    /**
     * @param array<string,mixed> $result
     */
    private static function summarizeToolResult(array $result): string
    {
        $summary = trim((string) ($result['summary'] ?? ''));
        if ($summary !== '') {
            return $summary;
        }

        if (isset($result['items']) && is_array($result['items'])) {
            return 'Items consultados: ' . count($result['items']);
        }

        return '';
    }

    /**
     * @param array<string,mixed> $payload
     */
    private static function normalizeContext($payload): array
    {
        $context = is_array($payload) ? $payload : [];
        $selectedEntity = is_array($context['selectedEntity'] ?? null) ? $context['selectedEntity'] : [];
        $filters = is_array($context['filters'] ?? null) ? $context['filters'] : [];
        $visibleIds = isset($context['visibleIds']) && is_array($context['visibleIds'])
            ? array_values(array_map(static fn ($value): int => (int) $value, $context['visibleIds']))
            : [];
        $capabilities = is_array($context['operatorCapabilities'] ?? null) ? $context['operatorCapabilities'] : [];
        $adminHealth = is_array($context['adminHealth'] ?? null) ? $context['adminHealth'] : [];

        return [
            'section' => self::normalizeSection((string) ($context['section'] ?? 'dashboard')),
            'selectedEntity' => [
                'type' => trim((string) ($selectedEntity['type'] ?? '')),
                'id' => (int) ($selectedEntity['id'] ?? 0),
                'label' => truncate_field(sanitize_xss((string) ($selectedEntity['label'] ?? '')), 160),
            ],
            'filters' => $filters,
            'visibleIds' => $visibleIds,
            'operatorCapabilities' => [
                'read' => (bool) ($capabilities['read'] ?? true),
                'ui' => (bool) ($capabilities['ui'] ?? true),
                'writeInternal' => (bool) ($capabilities['writeInternal'] ?? true),
                'external' => (bool) ($capabilities['external'] ?? false),
            ],
            'adminHealth' => $adminHealth,
        ];
    }

    private static function entityRefFromContext(array $context): string
    {
        $selectedEntity = is_array($context['selectedEntity'] ?? null) ? $context['selectedEntity'] : [];
        $type = trim((string) ($selectedEntity['type'] ?? ''));
        $id = (int) ($selectedEntity['id'] ?? 0);
        if ($type !== '' && $id > 0) {
            return $type . ':' . $id;
        }
        return '';
    }

    private static function normalizeSection(string $section): string
    {
        $normalized = self::normalizeText($section);
        return in_array($normalized, self::knownSections(), true) ? $normalized : 'dashboard';
    }

    /**
     * @return array<int,string>
     */
    private static function knownSections(): array
    {
        return ['dashboard', 'callbacks', 'appointments', 'availability', 'reviews', 'queue'];
    }

    private static function normalizeRiskMode(string $riskMode): string
    {
        $normalized = self::normalizeText($riskMode);
        return in_array($normalized, ['autopilot_partial', 'manual_only', 'assisted'], true)
            ? $normalized
            : self::DEFAULT_RISK_MODE;
    }

    /**
     * @param array<string,mixed> $session
     */
    private static function appendEvent(array &$session, string $event, array $details = [], string $status = 'completed'): void
    {
        $session['events'][] = [
            'eventId' => self::generateId('aev'),
            'event' => $event,
            'status' => $status,
            'createdAt' => local_date('c'),
            'details' => $details,
        ];
    }

    /**
     * @param array<string,mixed> $toolCall
     * @return array<string,mixed>
     */
    private static function buildApproval(string $sessionId, string $turnId, array $toolCall, string $reason): array
    {
        $args = is_array($toolCall['args'] ?? null) ? $toolCall['args'] : [];
        return [
            'approvalId' => self::generateId('aap'),
            'sessionId' => $sessionId,
            'turnId' => $turnId,
            'toolCallId' => (string) ($toolCall['toolCallId'] ?? ''),
            'tool' => (string) ($toolCall['tool'] ?? ''),
            'channel' => trim((string) ($args['channel'] ?? '')),
            'template' => trim((string) ($args['template'] ?? '')),
            'risk' => (string) ($toolCall['risk'] ?? 'medium'),
            'reason' => $reason,
            'expiresAt' => gmdate('c', time() + self::APPROVAL_TTL_SECONDS),
            'approvedBy' => '',
            'status' => 'pending',
            'createdAt' => local_date('c'),
            'updatedAt' => local_date('c'),
        ];
    }

    /**
     * @param array<string,mixed> $session
     */
    private static function findToolCallIndex(array $session, string $toolCallId): int
    {
        foreach (self::sessionToolCalls($session) as $index => $toolCall) {
            if ((string) ($toolCall['toolCallId'] ?? '') === $toolCallId) {
                return (int) $index;
            }
        }
        return -1;
    }

    /**
     * @param array<string,mixed> $session
     */
    private static function findApprovalIndex(array $session, string $approvalId): int
    {
        foreach (self::sessionApprovals($session) as $index => $approval) {
            if ((string) ($approval['approvalId'] ?? '') === $approvalId) {
                return (int) $index;
            }
        }
        return -1;
    }

    /**
     * @param array<string,mixed> $store
     */
    private static function findCallbackIndex(array $store, int $callbackId): int
    {
        $callbacks = isset($store['callbacks']) && is_array($store['callbacks']) ? $store['callbacks'] : [];
        foreach ($callbacks as $index => $callback) {
            if ((int) ($callback['id'] ?? 0) === $callbackId) {
                return (int) $index;
            }
        }
        return -1;
    }

    /**
     * @param array<string,mixed> $session
     * @return array<int,array<string,mixed>>
     */
    private static function sessionMessages(array $session): array
    {
        return isset($session['messages']) && is_array($session['messages']) ? array_values($session['messages']) : [];
    }

    /**
     * @param array<string,mixed> $session
     * @return array<int,array<string,mixed>>
     */
    private static function sessionTurns(array $session): array
    {
        return isset($session['turns']) && is_array($session['turns']) ? array_values($session['turns']) : [];
    }

    /**
     * @param array<string,mixed> $session
     * @return array<int,array<string,mixed>>
     */
    private static function sessionToolCalls(array $session): array
    {
        return isset($session['toolCalls']) && is_array($session['toolCalls']) ? array_values($session['toolCalls']) : [];
    }

    /**
     * @param array<string,mixed> $session
     * @return array<int,array<string,mixed>>
     */
    private static function sessionApprovals(array $session): array
    {
        return isset($session['approvals']) && is_array($session['approvals']) ? array_values($session['approvals']) : [];
    }

    /**
     * @param array<string,mixed> $session
     * @return array<int,array<string,mixed>>
     */
    private static function sessionEvents(array $session): array
    {
        return isset($session['events']) && is_array($session['events']) ? array_values($session['events']) : [];
    }

    /**
     * @param array<string,mixed> $session
     */
    private static function requireSession(string $sessionId): array
    {
        $session = self::readSession($sessionId);
        if ($session === null) {
            throw new RuntimeException('Sesion del agente no encontrada', 404);
        }
        return $session;
    }

    /**
     * @param array<string,mixed> $operator
     */
    private static function findLatestSessionForOperator(array $operator): ?array
    {
        $dir = self::sessionsDir();
        if (!is_dir($dir)) {
            return null;
        }

        $candidates = [];
        foreach ((array) glob($dir . DIRECTORY_SEPARATOR . '*.json') as $path) {
            $raw = @file_get_contents($path);
            $decoded = json_decode(is_string($raw) ? $raw : '', true);
            if (!is_array($decoded)) {
                continue;
            }

            $sessionOperator = is_array($decoded['operator'] ?? null) ? $decoded['operator'] : [];
            if (
                trim((string) ($sessionOperator['email'] ?? '')) !== trim((string) ($operator['email'] ?? '')) ||
                trim((string) ($operator['email'] ?? '')) === ''
            ) {
                continue;
            }

            $candidates[] = $decoded;
        }

        usort($candidates, static function (array $left, array $right): int {
            return strtotime((string) ($right['updatedAt'] ?? '')) <=> strtotime((string) ($left['updatedAt'] ?? ''));
        });

        return $candidates[0] ?? null;
    }

    /**
     * @return array<string,mixed>|null
     */
    private static function readSession(string $sessionId): ?array
    {
        if (!preg_match('/^[a-z]{3}_[a-f0-9]{16,}$/', $sessionId)) {
            return null;
        }

        $path = self::sessionPath($sessionId);
        if (!is_file($path)) {
            return null;
        }

        $raw = @file_get_contents($path);
        $decoded = json_decode(is_string($raw) ? $raw : '', true);
        return is_array($decoded) ? $decoded : null;
    }

    /**
     * @param array<string,mixed> $session
     */
    private static function writeSession(array $session): void
    {
        $path = self::sessionPath((string) ($session['sessionId'] ?? ''));
        self::writeJsonFile($path, $session);
    }

    /**
     * @param array<string,mixed> $payload
     */
    private static function appendOutboxEntry(array $payload): void
    {
        $path = self::outboxPath();
        $entries = self::readOutboxEntries();
        $entries[] = $payload;
        self::writeJsonFile($path, $entries);
    }

    /**
     * @return array<int,array<string,mixed>>
     */
    private static function recentOutboxEntries(int $limit = 10): array
    {
        $entries = self::readOutboxEntries();
        usort($entries, static function (array $left, array $right): int {
            return strtotime((string) ($right['createdAt'] ?? '')) <=> strtotime((string) ($left['createdAt'] ?? ''));
        });
        return array_values(array_slice($entries, 0, max(1, $limit)));
    }

    /**
     * @param array<string,mixed> $session
     * @return array<int,array<string,mixed>>
     */
    private static function sessionOutboxEntries(array $session, int $limit = 12): array
    {
        $sessionId = trim((string) ($session['sessionId'] ?? ''));
        if ($sessionId === '') {
            return [];
        }

        $entries = array_values(array_filter(self::readOutboxEntries(), static function (array $entry) use ($sessionId): bool {
            return (string) ($entry['sessionId'] ?? '') === $sessionId;
        }));

        usort($entries, static function (array $left, array $right): int {
            return strtotime((string) ($right['createdAt'] ?? '')) <=> strtotime((string) ($left['createdAt'] ?? ''));
        });

        return array_values(array_slice($entries, 0, max(1, $limit)));
    }

    /**
     * @return array<int,array<string,mixed>>
     */
    private static function readOutboxEntries(): array
    {
        $path = self::outboxPath();
        if (!is_file($path)) {
            return [];
        }

        $raw = @file_get_contents($path);
        $decoded = json_decode(is_string($raw) ? $raw : '', true);
        if (!is_array($decoded)) {
            return [];
        }

        return array_values(array_filter($decoded, static function ($entry): bool {
            return is_array($entry);
        }));
    }

    /**
     * @param array<string,mixed> $payload
     */
    private static function writeJsonFile(string $path, array $payload): void
    {
        $encoded = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
        if (!is_string($encoded)) {
            throw new RuntimeException('No se pudo serializar el payload', 500);
        }

        $dir = dirname($path);
        if (!is_dir($dir) && !@mkdir($dir, 0775, true) && !is_dir($dir)) {
            throw new RuntimeException('No se pudo crear el directorio del agente', 500);
        }

        ensure_data_htaccess(data_dir_path());
        ensure_data_htaccess($dir);

        $tmp = $path . '.' . substr(hash('sha256', uniqid('admin-agent', true)), 0, 8) . '.tmp';
        $bytes = @file_put_contents($tmp, $encoded . PHP_EOL, LOCK_EX);
        if (!is_int($bytes)) {
            @unlink($tmp);
            throw new RuntimeException('No se pudo escribir el archivo del agente', 500);
        }
        if (!@rename($tmp, $path)) {
            @copy($tmp, $path);
            @unlink($tmp);
        }
    }

    private static function ensureStorage(): void
    {
        foreach ([self::baseDir(), self::sessionsDir()] as $dir) {
            if (!is_dir($dir) && !@mkdir($dir, 0775, true) && !is_dir($dir)) {
                throw new RuntimeException('No se pudo preparar el storage del agente', 500);
            }
            ensure_data_htaccess($dir);
        }
    }

    private static function baseDir(): string
    {
        return data_dir_path() . DIRECTORY_SEPARATOR . 'admin-agent';
    }

    private static function sessionsDir(): string
    {
        return self::baseDir() . DIRECTORY_SEPARATOR . 'sessions';
    }

    private static function sessionPath(string $sessionId): string
    {
        return self::sessionsDir() . DIRECTORY_SEPARATOR . $sessionId . '.json';
    }

    private static function relayStatusPath(): string
    {
        return self::baseDir() . DIRECTORY_SEPARATOR . 'relay-status.json';
    }

    private static function outboxPath(): string
    {
        return self::baseDir() . DIRECTORY_SEPARATOR . 'outbox.json';
    }

    private static function generateId(string $prefix): string
    {
        try {
            return $prefix . '_' . bin2hex(random_bytes(10));
        } catch (Throwable $e) {
            return $prefix . '_' . substr(hash('sha256', uniqid($prefix, true)), 0, 20);
        }
    }

    /**
     * @param array<string,mixed> $payload
     */
    private static function toolCallIdempotencyKey(string $sessionId, string $turnId, string $tool, $payload): string
    {
        $encoded = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        return hash('sha256', $sessionId . '|' . $turnId . '|' . $tool . '|' . (is_string($encoded) ? $encoded : ''));
    }

    /**
     * @return array<string,mixed>
     */
    private static function relayStatus(): array
    {
        $configured = self::relayEndpoint() !== '';
        $snapshot = [];
        $path = self::relayStatusPath();
        if (is_file($path)) {
            $raw = @file_get_contents($path);
            $decoded = json_decode(is_string($raw) ? $raw : '', true);
            if (is_array($decoded)) {
                $snapshot = $decoded;
            }
        }

        $lastSeenAt = trim((string) ($snapshot['lastSeenAt'] ?? ''));
        $lastSuccessAt = trim((string) ($snapshot['lastSuccessAt'] ?? ''));
        $lastErrorAt = trim((string) ($snapshot['lastErrorAt'] ?? ''));
        $lastSeenTs = $lastSeenAt !== '' ? strtotime($lastSeenAt) : false;
        $lastSuccessTs = $lastSuccessAt !== '' ? strtotime($lastSuccessAt) : false;
        $lastErrorTs = $lastErrorAt !== '' ? strtotime($lastErrorAt) : false;

        $mode = 'pending';
        if (!$configured) {
            $mode = 'disabled';
        } elseif ($lastSeenAt === '') {
            $mode = 'pending';
        } elseif ($lastSeenTs !== false && (time() - $lastSeenTs) > self::RELAY_STALE_AFTER_SECONDS) {
            $mode = 'offline';
        } elseif ($lastErrorTs !== false && (($lastSuccessTs === false) || $lastErrorTs > $lastSuccessTs)) {
            $mode = 'degraded';
        } else {
            $mode = 'online';
        }

        return [
            'configured' => $configured,
            'mode' => $mode,
            'endpoint' => $configured ? self::relayEndpoint() : '',
            'model' => self::relayModel(),
            'lastSeenAt' => $lastSeenAt,
            'lastSuccessAt' => $lastSuccessAt,
            'lastErrorAt' => $lastErrorAt,
            'lastErrorMessage' => truncate_field(sanitize_xss((string) ($snapshot['lastErrorMessage'] ?? '')), 240),
            'staleAfterSeconds' => self::RELAY_STALE_AFTER_SECONDS,
        ];
    }

    private static function touchRelayHeartbeat(string $event, string $message = ''): void
    {
        $current = self::relayStatus();
        $now = local_date('c');
        $snapshot = array_merge($current, [
            'lastSeenAt' => $now,
        ]);

        if ($event === 'success') {
            $snapshot['lastSuccessAt'] = $now;
            $snapshot['lastErrorAt'] = '';
            $snapshot['lastErrorMessage'] = '';
        } elseif ($event === 'error') {
            $snapshot['lastErrorAt'] = $now;
            $snapshot['lastErrorMessage'] = truncate_field(sanitize_xss($message), 240);
        }

        self::writeJsonFile(self::relayStatusPath(), $snapshot);
    }

    private static function relayEndpoint(): string
    {
        $raw = getenv('PIELARMONIA_ADMIN_AGENT_RELAY_URL');
        if (!is_string($raw) || trim($raw) === '') {
            return '';
        }
        return rtrim(trim($raw), '/') . '/chat/completions';
    }

    private static function relayApiKey(): string
    {
        $raw = getenv('PIELARMONIA_ADMIN_AGENT_API_KEY');
        return is_string($raw) ? trim($raw) : '';
    }

    private static function relayApiKeyHeader(): string
    {
        $raw = getenv('PIELARMONIA_ADMIN_AGENT_API_KEY_HEADER');
        return is_string($raw) && trim($raw) !== '' ? trim($raw) : 'Authorization';
    }

    private static function relayApiKeyPrefix(): string
    {
        $raw = getenv('PIELARMONIA_ADMIN_AGENT_API_KEY_PREFIX');
        return is_string($raw) && trim($raw) !== '' ? trim($raw) : 'Bearer';
    }

    private static function relayModel(): string
    {
        $raw = getenv('PIELARMONIA_ADMIN_AGENT_MODEL');
        return is_string($raw) && trim($raw) !== '' ? trim($raw) : 'gpt-4.1-mini';
    }

    private static function relayTimeoutSeconds(): int
    {
        $raw = getenv('PIELARMONIA_ADMIN_AGENT_TIMEOUT_SECONDS');
        $value = is_string($raw) && trim($raw) !== '' ? (int) trim($raw) : 12;
        return max(3, min(45, $value));
    }

    /**
     * @return array<int,string>
     */
    private static function externalChannelAllowlist(): array
    {
        $raw = getenv('PIELARMONIA_ADMIN_AGENT_EXTERNAL_ALLOWLIST');
        if (!is_string($raw) || trim($raw) === '') {
            return [];
        }

        $channels = [];
        foreach (explode(',', $raw) as $item) {
            $channel = self::normalizeText($item);
            if ($channel !== '') {
                $channels[] = $channel;
            }
        }

        return array_values(array_unique($channels));
    }

    /**
     * @return array<int,string>
     */
    private static function externalTemplateAllowlist(): array
    {
        $raw = getenv('PIELARMONIA_ADMIN_AGENT_EXTERNAL_TEMPLATE_ALLOWLIST');
        if (!is_string($raw) || trim($raw) === '') {
            return ['seguimiento_callback', 'seguimiento_operativo'];
        }

        $templates = [];
        foreach (preg_split('/[\s,;]+/', $raw) ?: [] as $item) {
            $template = self::normalizeText($item);
            if ($template !== '') {
                $templates[] = $template;
            }
        }

        $templates = array_values(array_unique($templates));
        return $templates !== [] ? $templates : ['seguimiento_callback', 'seguimiento_operativo'];
    }

    /**
     * @return array<string,mixed>
     */
    private static function resolveOperator(): array
    {
        if (function_exists('operator_auth_current_identity')) {
            $operator = operator_auth_current_identity(false);
            if (is_array($operator)) {
                return [
                    'email' => trim((string) ($operator['email'] ?? '')),
                    'profileId' => trim((string) ($operator['profileId'] ?? '')),
                    'accountId' => trim((string) ($operator['accountId'] ?? '')),
                    'source' => trim((string) ($operator['source'] ?? OPERATOR_AUTH_SOURCE)),
                ];
            }
        }

        return [
            'email' => legacy_admin_is_authenticated() ? 'admin@local' : 'public',
            'profileId' => '',
            'accountId' => '',
            'source' => legacy_admin_is_authenticated() ? 'legacy_admin' : 'public',
        ];
    }

    /**
     * @param array<string,mixed> $store
     * @return array<string,int>
     */
    private static function buildStoreCounts(array $store): array
    {
        return [
            'callbacks' => isset($store['callbacks']) && is_array($store['callbacks']) ? count($store['callbacks']) : 0,
            'appointments' => isset($store['appointments']) && is_array($store['appointments']) ? count($store['appointments']) : 0,
            'reviews' => isset($store['reviews']) && is_array($store['reviews']) ? count($store['reviews']) : 0,
            'availabilityDays' => isset($store['availability']) && is_array($store['availability']) ? count($store['availability']) : 0,
            'queueTickets' => isset($store['queue_tickets']) && is_array($store['queue_tickets']) ? count($store['queue_tickets']) : 0,
            'queueHelpRequests' => isset($store['queue_help_requests']) && is_array($store['queue_help_requests']) ? count($store['queue_help_requests']) : 0,
        ];
    }

    /**
     * @param array<string,mixed> $selectedEntity
     */
    private static function selectedEntityId(array $selectedEntity): int
    {
        return (int) ($selectedEntity['id'] ?? 0);
    }

    private static function extractNumericReference(string $message): int
    {
        if (preg_match('/\b(\d{2,8})\b/', $message, $matches) === 1) {
            return (int) ($matches[1] ?? 0);
        }
        return 0;
    }

    private static function extractDateReference(string $message): string
    {
        $trimmed = trim($message);
        if ($trimmed === '') {
            return '';
        }

        if (preg_match('/\b(\d{4}-\d{2}-\d{2})\b/', $trimmed, $matches) === 1) {
            return (string) ($matches[1] ?? '');
        }

        if (preg_match('/\b(\d{2})\/(\d{2})\/(\d{4})\b/', $trimmed, $matches) === 1) {
            return sprintf(
                '%04d-%02d-%02d',
                (int) ($matches[3] ?? 0),
                (int) ($matches[2] ?? 0),
                (int) ($matches[1] ?? 0)
            );
        }

        $normalized = self::normalizeText($trimmed);
        if (preg_match('/\b(pasado manana|day after tomorrow)\b/', $normalized) === 1) {
            return date('Y-m-d', strtotime('+2 day'));
        }
        if (preg_match('/\b(manana|tomorrow)\b/', $normalized) === 1) {
            return date('Y-m-d', strtotime('+1 day'));
        }
        if (preg_match('/\b(hoy|today)\b/', $normalized) === 1) {
            return local_date('Y-m-d');
        }

        return '';
    }

    private static function detectSectionFromText(string $normalizedText, string $fallback): string
    {
        if (str_contains($normalizedText, 'callback') || str_contains($normalizedText, 'pendiente') || str_contains($normalizedText, 'lead')) {
            return 'callbacks';
        }
        if (str_contains($normalizedText, 'cita') || str_contains($normalizedText, 'agenda') || str_contains($normalizedText, 'appointment')) {
            return 'appointments';
        }
        if (str_contains($normalizedText, 'horario') || str_contains($normalizedText, 'availability') || str_contains($normalizedText, 'disponibilidad')) {
            return 'availability';
        }
        if (str_contains($normalizedText, 'resena') || str_contains($normalizedText, 'review')) {
            return 'reviews';
        }
        if (str_contains($normalizedText, 'queue') || str_contains($normalizedText, 'turnero')) {
            return 'queue';
        }
        if (str_contains($normalizedText, 'inicio') || str_contains($normalizedText, 'dashboard')) {
            return 'dashboard';
        }
        return self::normalizeSection($fallback);
    }

    private static function normalizeText(string $value): string
    {
        $normalized = strtolower(trim($value));
        $replacements = [
            'á' => 'a',
            'é' => 'e',
            'í' => 'i',
            'ó' => 'o',
            'ú' => 'u',
            'ñ' => 'n',
        ];
        return strtr($normalized, $replacements);
    }

    /**
     * @return array<string,array<string,mixed>>
     */
    private static function toolRegistry(): array
    {
        static $registry = null;
        if (is_array($registry)) {
            return $registry;
        }

        $registry = [
            'callbacks.list' => [
                'tool' => 'callbacks.list',
                'description' => 'Lee callbacks priorizados desde LeadOps.',
                'domain' => 'callbacks',
                'category' => 'read',
                'risk' => 'low',
                'autoExecutable' => true,
                'requiresApproval' => false,
                'reversible' => true,
                'inputSchema' => [
                    'filter' => 'enum: all|pending|contacted',
                    'limit' => 'integer:1..12',
                ],
                'outputSchema' => [
                    'items' => 'array<callback>',
                    'summary' => 'string',
                ],
            ],
            'appointments.list' => [
                'tool' => 'appointments.list',
                'description' => 'Lee citas operativas y filtros de agenda.',
                'domain' => 'appointments',
                'category' => 'read',
                'risk' => 'low',
                'autoExecutable' => true,
                'requiresApproval' => false,
                'reversible' => true,
                'inputSchema' => [
                    'filter' => 'enum: all|pending_transfer|no_show|upcoming_48h',
                    'limit' => 'integer:1..12',
                ],
                'outputSchema' => [
                    'items' => 'array<appointment>',
                    'summary' => 'string',
                ],
            ],
            'reviews.list' => [
                'tool' => 'reviews.list',
                'description' => 'Lista reseñas operativas con filtros de reputacion.',
                'domain' => 'reviews',
                'category' => 'read',
                'risk' => 'low',
                'autoExecutable' => true,
                'requiresApproval' => false,
                'reversible' => true,
                'inputSchema' => [
                    'filter' => 'enum: all|recent|low_rated|five_star',
                    'limit' => 'integer:1..10',
                ],
                'outputSchema' => [
                    'items' => 'array<review>',
                    'summary' => 'string',
                ],
            ],
            'reviews.summary' => [
                'tool' => 'reviews.summary',
                'description' => 'Resume volumen, promedio y reseñas con atencion requerida.',
                'domain' => 'reviews',
                'category' => 'read',
                'risk' => 'low',
                'autoExecutable' => true,
                'requiresApproval' => false,
                'reversible' => true,
                'inputSchema' => [],
                'outputSchema' => [
                    'metrics' => 'review_metrics',
                    'summary' => 'string',
                ],
            ],
            'availability.list_days' => [
                'tool' => 'availability.list_days',
                'description' => 'Lista dias con horarios publicados.',
                'domain' => 'availability',
                'category' => 'read',
                'risk' => 'low',
                'autoExecutable' => true,
                'requiresApproval' => false,
                'reversible' => true,
                'inputSchema' => [
                    'filter' => 'enum: all|with_slots',
                    'limit' => 'integer:1..12',
                ],
                'outputSchema' => [
                    'items' => 'array<availability_day>',
                    'summary' => 'string',
                ],
            ],
            'availability.day_summary' => [
                'tool' => 'availability.day_summary',
                'description' => 'Resume slots disponibles para un dia especifico.',
                'domain' => 'availability',
                'category' => 'read',
                'risk' => 'low',
                'autoExecutable' => true,
                'requiresApproval' => false,
                'reversible' => true,
                'inputSchema' => [
                    'date' => 'date:YYYY-MM-DD',
                ],
                'outputSchema' => [
                    'date' => 'string',
                    'slots' => 'array<string>',
                    'slotCount' => 'integer',
                    'summary' => 'string',
                ],
            ],
            'queue.summary' => [
                'tool' => 'queue.summary',
                'description' => 'Resume el estado operativo del turnero.',
                'domain' => 'queue',
                'category' => 'read',
                'risk' => 'low',
                'autoExecutable' => true,
                'requiresApproval' => false,
                'reversible' => true,
                'inputSchema' => [],
                'outputSchema' => [
                    'queueState' => 'queue_state',
                    'summary' => 'string',
                ],
            ],
            'queue.list_tickets' => [
                'tool' => 'queue.list_tickets',
                'description' => 'Lista tickets visibles del turnero por foco operativo.',
                'domain' => 'queue',
                'category' => 'read',
                'risk' => 'low',
                'autoExecutable' => true,
                'requiresApproval' => false,
                'reversible' => true,
                'inputSchema' => [
                    'filter' => 'enum: all|sla_risk',
                    'limit' => 'integer:1..10',
                ],
                'outputSchema' => [
                    'items' => 'array<queue_ticket>',
                    'summary' => 'string',
                ],
            ],
            'queue.call_next' => [
                'tool' => 'queue.call_next',
                'description' => 'Llama el siguiente ticket del turnero para un consultorio.',
                'domain' => 'queue',
                'category' => 'write-internal',
                'risk' => 'high',
                'autoExecutable' => false,
                'requiresApproval' => true,
                'reversible' => false,
                'inputSchema' => [
                    'consultorio' => 'enum: 1|2',
                ],
                'outputSchema' => [
                    'ticket' => 'queue_ticket',
                    'summary' => 'string',
                ],
            ],
            'ui.navigate' => [
                'tool' => 'ui.navigate',
                'description' => 'Navega el admin a una seccion conocida.',
                'domain' => 'ui',
                'category' => 'ui',
                'risk' => 'low',
                'autoExecutable' => true,
                'requiresApproval' => false,
                'reversible' => true,
                'inputSchema' => [
                    'section' => 'enum: dashboard|callbacks|appointments|availability|reviews|queue',
                ],
                'outputSchema' => [
                    'section' => 'string',
                    'summary' => 'string',
                ],
            ],
            'ui.set_section_filter' => [
                'tool' => 'ui.set_section_filter',
                'description' => 'Aplica un filtro de UI tipado en la seccion activa.',
                'domain' => 'ui',
                'category' => 'ui',
                'risk' => 'low',
                'autoExecutable' => true,
                'requiresApproval' => false,
                'reversible' => true,
                'inputSchema' => [
                    'section' => 'enum: callbacks|appointments|queue',
                    'filter' => 'string',
                ],
                'outputSchema' => [
                    'section' => 'string',
                    'filter' => 'string',
                    'summary' => 'string',
                ],
            ],
            'ui.select_availability_date' => [
                'tool' => 'ui.select_availability_date',
                'description' => 'Selecciona una fecha publicada en la vista de horarios.',
                'domain' => 'ui',
                'category' => 'ui',
                'risk' => 'low',
                'autoExecutable' => true,
                'requiresApproval' => false,
                'reversible' => true,
                'inputSchema' => [
                    'date' => 'date:YYYY-MM-DD',
                ],
                'outputSchema' => [
                    'date' => 'string',
                    'summary' => 'string',
                ],
            ],
            'ui.focus_next_pending_callback' => [
                'tool' => 'ui.focus_next_pending_callback',
                'description' => 'Mueve el foco al siguiente callback pendiente visible.',
                'domain' => 'ui',
                'category' => 'ui',
                'risk' => 'low',
                'autoExecutable' => true,
                'requiresApproval' => false,
                'reversible' => true,
                'inputSchema' => [],
                'outputSchema' => [
                    'summary' => 'string',
                ],
            ],
            'callbacks.mark_contacted' => [
                'tool' => 'callbacks.mark_contacted',
                'description' => 'Marca un callback como contactado.',
                'domain' => 'callbacks',
                'category' => 'write-internal',
                'risk' => 'medium',
                'autoExecutable' => true,
                'requiresApproval' => false,
                'reversible' => true,
                'inputSchema' => [
                    'callbackId' => 'integer',
                ],
                'outputSchema' => [
                    'callback' => 'callback',
                    'summary' => 'string',
                ],
            ],
            'callbacks.set_outcome' => [
                'tool' => 'callbacks.set_outcome',
                'description' => 'Actualiza el outcome comercial de un callback.',
                'domain' => 'callbacks',
                'category' => 'write-internal',
                'risk' => 'medium',
                'autoExecutable' => true,
                'requiresApproval' => false,
                'reversible' => true,
                'inputSchema' => [
                    'callbackId' => 'integer',
                    'outcome' => 'enum: contactado|cita_cerrada|sin_respuesta|descartado',
                ],
                'outputSchema' => [
                    'callback' => 'callback',
                    'summary' => 'string',
                ],
            ],
            'callbacks.request_ai_draft' => [
                'tool' => 'callbacks.request_ai_draft',
                'description' => 'Pide un borrador IA para un callback.',
                'domain' => 'callbacks',
                'category' => 'write-internal',
                'risk' => 'medium',
                'autoExecutable' => true,
                'requiresApproval' => false,
                'reversible' => true,
                'inputSchema' => [
                    'callbackId' => 'integer',
                    'objective' => 'enum: service_match|call_opening|whatsapp_draft',
                ],
                'outputSchema' => [
                    'callback' => 'callback',
                    'summary' => 'string',
                ],
            ],
            'external.whatsapp.send_template' => [
                'tool' => 'external.whatsapp.send_template',
                'description' => 'Encola un WhatsApp operativo tras aprobacion.',
                'domain' => 'external',
                'category' => 'external',
                'risk' => 'high',
                'autoExecutable' => false,
                'requiresApproval' => true,
                'reversible' => false,
                'inputSchema' => [
                    'channel' => 'string',
                    'targetEntityId' => 'integer',
                    'template' => 'string',
                    'message' => 'string',
                ],
                'outputSchema' => [
                    'outbox' => 'queued_message',
                    'summary' => 'string',
                ],
            ],
            'external.email.send' => [
                'tool' => 'external.email.send',
                'description' => 'Encola un email operativo tras aprobacion.',
                'domain' => 'external',
                'category' => 'external',
                'risk' => 'high',
                'autoExecutable' => false,
                'requiresApproval' => true,
                'reversible' => false,
                'inputSchema' => [
                    'channel' => 'string',
                    'targetEntityId' => 'integer',
                    'template' => 'string',
                    'message' => 'string',
                ],
                'outputSchema' => [
                    'outbox' => 'queued_message',
                    'summary' => 'string',
                ],
            ],
            'restricted.payments.update' => [
                'tool' => 'restricted.payments.update',
                'description' => 'Operacion restringida sobre pagos.',
                'domain' => 'restricted',
                'category' => 'restricted',
                'risk' => 'critical',
                'autoExecutable' => false,
                'requiresApproval' => false,
                'reversible' => false,
                'inputSchema' => [
                    'intent' => 'string',
                ],
                'outputSchema' => [],
            ],
            'restricted.auth.reset' => [
                'tool' => 'restricted.auth.reset',
                'description' => 'Operacion restringida sobre auth, deploy o secretos.',
                'domain' => 'restricted',
                'category' => 'restricted',
                'risk' => 'critical',
                'autoExecutable' => false,
                'requiresApproval' => false,
                'reversible' => false,
                'inputSchema' => [
                    'intent' => 'string',
                ],
                'outputSchema' => [],
            ],
        ];

        return $registry;
    }

    /**
     * @return array<int,array<string,mixed>>
     */
    private static function publicToolRegistry(): array
    {
        return array_values(self::toolRegistry());
    }
}

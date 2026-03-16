<?php

declare(strict_types=1);

final class ClinicalHistoryOpsSnapshot
{
    private const SESSION_STATUS_KEYS = [
        'active',
        'review_required',
        'approved',
        'draft_ready',
    ];

    private const REVIEW_STATUS_KEYS = [
        'pending_review',
        'review_required',
        'ready_for_review',
        'approved',
    ];

    private const EVENT_STATUS_KEYS = [
        'open',
        'acknowledged',
        'resolved',
    ];

    private const EVENT_SEVERITY_KEYS = [
        'info',
        'warning',
        'critical',
    ];

    public static function build(array $store): array
    {
        $sessions = isset($store['clinical_history_sessions']) && is_array($store['clinical_history_sessions'])
            ? array_values($store['clinical_history_sessions'])
            : [];
        $drafts = isset($store['clinical_history_drafts']) && is_array($store['clinical_history_drafts'])
            ? array_values($store['clinical_history_drafts'])
            : [];
        $events = isset($store['clinical_history_events']) && is_array($store['clinical_history_events'])
            ? array_values($store['clinical_history_events'])
            : [];

        $draftsBySessionId = [];
        foreach ($drafts as $draftRecord) {
            $draft = ClinicalHistoryRepository::adminDraft($draftRecord);
            $sessionId = ClinicalHistoryRepository::trimString($draft['sessionId'] ?? '');
            if ($sessionId !== '') {
                $draftsBySessionId[$sessionId] = $draft;
            }
        }

        $openEventStatsBySessionId = self::buildOpenEventStatsBySession($events);

        $sessionStatusCounts = self::initializeCounters(self::SESSION_STATUS_KEYS);
        $reviewStatusCounts = self::initializeCounters(self::REVIEW_STATUS_KEYS);
        $reviewQueue = [];
        $pendingAiCount = 0;
        $latestActivityAt = '';

        foreach ($sessions as $sessionRecord) {
            $session = ClinicalHistoryRepository::adminSession($sessionRecord);
            $sessionId = ClinicalHistoryRepository::trimString($session['sessionId'] ?? '');
            $draft = isset($draftsBySessionId[$sessionId])
                ? $draftsBySessionId[$sessionId]
                : ClinicalHistoryRepository::defaultDraft($session);

            $sessionStatus = ClinicalHistoryRepository::trimString($session['status'] ?? 'active');
            if ($sessionStatus === '') {
                $sessionStatus = 'active';
            }
            $sessionStatusCounts[$sessionStatus] = ($sessionStatusCounts[$sessionStatus] ?? 0) + 1;

            $reviewStatus = ClinicalHistoryRepository::trimString($draft['reviewStatus'] ?? 'pending_review');
            if ($reviewStatus === '') {
                $reviewStatus = 'pending_review';
            }
            $reviewStatusCounts[$reviewStatus] = ($reviewStatusCounts[$reviewStatus] ?? 0) + 1;

            $pendingAi = ClinicalHistoryRepository::normalizePendingAi(
                isset($session['pendingAi']) && is_array($session['pendingAi']) ? $session['pendingAi'] : []
            );
            if ($pendingAi !== []) {
                $pendingAiCount++;
            }

            $latestActivityAt = self::maxTimestamp(
                $latestActivityAt,
                (string) ($session['updatedAt'] ?? $draft['updatedAt'] ?? '')
            );

            if (self::needsReviewQueue($session, $draft, $pendingAi)) {
                $reviewQueue[] = self::buildReviewQueueRow(
                    $session,
                    $draft,
                    $pendingAi,
                    $openEventStatsBySessionId[$sessionId] ?? []
                );
            }
        }

        usort($reviewQueue, static function (array $left, array $right): int {
            $priorityLeft = self::reviewPriority($left);
            $priorityRight = self::reviewPriority($right);
            if ($priorityLeft !== $priorityRight) {
                return $priorityLeft <=> $priorityRight;
            }
            return strcmp((string) ($right['updatedAt'] ?? ''), (string) ($left['updatedAt'] ?? ''));
        });

        $eventStatusCounts = self::initializeCounters(self::EVENT_STATUS_KEYS);
        $eventSeverityCounts = self::initializeCounters(self::EVENT_SEVERITY_KEYS);
        $eventTypeCounts = [];
        $unreadEventsCount = 0;
        $openEventsCount = 0;
        $openSeverityCounts = self::initializeCounters(self::EVENT_SEVERITY_KEYS);
        $eventFeed = [];

        foreach ($events as $eventRecord) {
            $event = ClinicalHistoryRepository::defaultEvent($eventRecord);
            $status = ClinicalHistoryRepository::trimString($event['status'] ?? 'open');
            if ($status === '') {
                $status = 'open';
            }
            $severity = ClinicalHistoryRepository::trimString($event['severity'] ?? 'info');
            if ($severity === '') {
                $severity = 'info';
            }
            $type = ClinicalHistoryRepository::trimString($event['type'] ?? 'unknown');
            if ($type === '') {
                $type = 'unknown';
            }

            $eventStatusCounts[$status] = ($eventStatusCounts[$status] ?? 0) + 1;
            $eventSeverityCounts[$severity] = ($eventSeverityCounts[$severity] ?? 0) + 1;
            $eventTypeCounts[$type] = ($eventTypeCounts[$type] ?? 0) + 1;

            if ($status === 'open') {
                $openEventsCount++;
                $openSeverityCounts[$severity] = ($openSeverityCounts[$severity] ?? 0) + 1;
                if (ClinicalHistoryRepository::trimString($event['acknowledgedAt'] ?? '') === '') {
                    $unreadEventsCount++;
                }
            }

            $sessionId = ClinicalHistoryRepository::trimString($event['sessionId'] ?? '');
            $draft = isset($draftsBySessionId[$sessionId])
                ? $draftsBySessionId[$sessionId]
                : ClinicalHistoryRepository::defaultDraft(['sessionId' => $sessionId, 'caseId' => $event['caseId'] ?? '']);
            $eventFeed[] = self::buildEventRow($event, $draft);
            $latestActivityAt = self::maxTimestamp(
                $latestActivityAt,
                (string) ($event['occurredAt'] ?? $event['createdAt'] ?? '')
            );
        }

        usort($eventFeed, static function (array $left, array $right): int {
            return strcmp((string) ($right['occurredAt'] ?? ''), (string) ($left['occurredAt'] ?? ''));
        });

        $snapshot = [
            'configured' => true,
            'sessions' => [
                'total' => count($sessions),
                'byStatus' => $sessionStatusCounts,
            ],
            'drafts' => [
                'total' => count($drafts),
                'byReviewStatus' => $reviewStatusCounts,
                'pendingAiCount' => $pendingAiCount,
                'reviewQueueCount' => count($reviewQueue),
            ],
            'events' => [
                'total' => count($eventFeed),
                'openCount' => $openEventsCount,
                'unreadCount' => $unreadEventsCount,
                'byStatus' => $eventStatusCounts,
                'bySeverity' => $eventSeverityCounts,
                'openBySeverity' => $openSeverityCounts,
                'byType' => $eventTypeCounts,
                'items' => array_values($eventFeed),
            ],
            'reviewQueue' => [
                'count' => count($reviewQueue),
                'items' => array_values($reviewQueue),
            ],
            'latestActivityAt' => $latestActivityAt,
        ];

        $snapshot['diagnostics'] = self::buildDiagnostics($snapshot);
        return $snapshot;
    }

    public static function forAdmin(array $snapshot): array
    {
        return [
            'summary' => [
                'configured' => (bool) ($snapshot['configured'] ?? false),
                'sessions' => $snapshot['sessions'] ?? [],
                'drafts' => $snapshot['drafts'] ?? [],
                'events' => [
                    'total' => (int) ($snapshot['events']['total'] ?? 0),
                    'openCount' => (int) ($snapshot['events']['openCount'] ?? 0),
                    'unreadCount' => (int) ($snapshot['events']['unreadCount'] ?? 0),
                    'byStatus' => $snapshot['events']['byStatus'] ?? [],
                    'bySeverity' => $snapshot['events']['bySeverity'] ?? [],
                    'openBySeverity' => $snapshot['events']['openBySeverity'] ?? [],
                    'byType' => $snapshot['events']['byType'] ?? [],
                ],
                'reviewQueueCount' => (int) ($snapshot['reviewQueue']['count'] ?? 0),
                'latestActivityAt' => (string) ($snapshot['latestActivityAt'] ?? ''),
                'diagnostics' => isset($snapshot['diagnostics']) && is_array($snapshot['diagnostics'])
                    ? [
                        'status' => (string) ($snapshot['diagnostics']['status'] ?? 'unknown'),
                        'healthy' => (bool) ($snapshot['diagnostics']['healthy'] ?? false),
                        'summary' => isset($snapshot['diagnostics']['summary']) && is_array($snapshot['diagnostics']['summary'])
                            ? $snapshot['diagnostics']['summary']
                            : [],
                    ]
                    : [],
            ],
            'reviewQueue' => $snapshot['reviewQueue']['items'] ?? [],
            'events' => $snapshot['events']['items'] ?? [],
            'diagnostics' => isset($snapshot['diagnostics']) && is_array($snapshot['diagnostics'])
                ? $snapshot['diagnostics']
                : [],
        ];
    }

    private static function buildReviewQueueRow(
        array $session,
        array $draft,
        array $pendingAi,
        array $eventStats
    ): array {
        $patient = isset($session['patient']) && is_array($session['patient']) ? $session['patient'] : [];
        $intake = isset($draft['intake']) && is_array($draft['intake']) ? $draft['intake'] : [];
        $lastEnvelope = isset($draft['lastAiEnvelope']) && is_array($draft['lastAiEnvelope']) ? $draft['lastAiEnvelope'] : [];

        return [
            'sessionId' => (string) ($session['sessionId'] ?? ''),
            'caseId' => (string) ($session['caseId'] ?? ''),
            'appointmentId' => $session['appointmentId'] ?? null,
            'surface' => (string) ($session['surface'] ?? ''),
            'sessionStatus' => (string) ($session['status'] ?? ''),
            'reviewStatus' => (string) ($draft['reviewStatus'] ?? ''),
            'requiresHumanReview' => (bool) ($draft['requiresHumanReview'] ?? true),
            'confidence' => (float) ($draft['confidence'] ?? 0),
            'reviewReasons' => array_values(is_array($draft['reviewReasons'] ?? null) ? $draft['reviewReasons'] : []),
            'missingFields' => array_values(is_array($intake['preguntasFaltantes'] ?? null) ? $intake['preguntasFaltantes'] : []),
            'redFlags' => array_values(is_array($lastEnvelope['redFlags'] ?? null) ? $lastEnvelope['redFlags'] : []),
            'pendingAiStatus' => (string) ($pendingAi['status'] ?? ''),
            'pendingAiJobId' => (string) ($pendingAi['jobId'] ?? ''),
            'patientName' => (string) ($patient['name'] ?? ''),
            'patientEmail' => (string) ($patient['email'] ?? ''),
            'patientPhone' => (string) ($patient['phone'] ?? ''),
            'attachmentCount' => count(is_array($intake['adjuntos'] ?? null) ? $intake['adjuntos'] : []),
            'openEventCount' => (int) ($eventStats['openEventCount'] ?? 0),
            'highestOpenSeverity' => (string) ($eventStats['highestOpenSeverity'] ?? ''),
            'latestOpenEventTitle' => (string) ($eventStats['latestOpenEventTitle'] ?? ''),
            'summary' => (string) (($draft['clinicianDraft']['resumen'] ?? '') ?: ($intake['resumenClinico'] ?? '')),
            'createdAt' => (string) ($draft['createdAt'] ?? $session['createdAt'] ?? ''),
            'updatedAt' => (string) ($draft['updatedAt'] ?? $session['updatedAt'] ?? ''),
        ];
    }

    private static function buildEventRow(array $event, array $draft): array
    {
        $patient = isset($event['patient']) && is_array($event['patient']) ? $event['patient'] : [];
        return [
            'eventId' => (string) ($event['eventId'] ?? ''),
            'sessionId' => (string) ($event['sessionId'] ?? ''),
            'caseId' => (string) ($event['caseId'] ?? ''),
            'appointmentId' => $event['appointmentId'] ?? null,
            'type' => (string) ($event['type'] ?? ''),
            'severity' => (string) ($event['severity'] ?? ''),
            'status' => (string) ($event['status'] ?? ''),
            'title' => (string) ($event['title'] ?? ''),
            'message' => (string) ($event['message'] ?? ''),
            'requiresAction' => (bool) ($event['requiresAction'] ?? false),
            'jobId' => (string) ($event['jobId'] ?? ''),
            'patientName' => (string) ($patient['name'] ?? ''),
            'patientEmail' => (string) ($patient['email'] ?? ''),
            'patientPhone' => (string) ($patient['phone'] ?? ''),
            'reviewStatus' => (string) ($draft['reviewStatus'] ?? ''),
            'requiresHumanReview' => (bool) ($draft['requiresHumanReview'] ?? true),
            'confidence' => (float) ($draft['confidence'] ?? 0),
            'reviewReasons' => array_values(is_array($draft['reviewReasons'] ?? null) ? $draft['reviewReasons'] : []),
            'createdAt' => (string) ($event['createdAt'] ?? ''),
            'occurredAt' => (string) ($event['occurredAt'] ?? ''),
            'acknowledgedAt' => (string) ($event['acknowledgedAt'] ?? ''),
            'resolvedAt' => (string) ($event['resolvedAt'] ?? ''),
        ];
    }

    private static function needsReviewQueue(array $session, array $draft, array $pendingAi): bool
    {
        if ($pendingAi !== []) {
            return true;
        }

        $reviewStatus = ClinicalHistoryRepository::trimString($draft['reviewStatus'] ?? '');
        if (in_array($reviewStatus, ['review_required', 'pending_review', 'ready_for_review'], true)) {
            return true;
        }

        return (bool) ($draft['requiresHumanReview'] ?? false)
            || ClinicalHistoryRepository::trimString($session['status'] ?? '') === 'review_required';
    }

    private static function buildDiagnostics(array $snapshot): array
    {
        $issues = [];
        $summary = [
            'critical' => 0,
            'warning' => 0,
            'info' => 0,
            'totalChecks' => 3,
            'totalIssues' => 0,
        ];

        $openCritical = (int) (($snapshot['events']['openBySeverity']['critical'] ?? 0));
        $openWarning = (int) (($snapshot['events']['openBySeverity']['warning'] ?? 0));
        $reviewQueueCount = (int) ($snapshot['reviewQueue']['count'] ?? 0);
        $pendingAiCount = (int) ($snapshot['drafts']['pendingAiCount'] ?? 0);
        $unreadEvents = (int) ($snapshot['events']['unreadCount'] ?? 0);

        if ($openCritical > 0) {
            $issues[] = [
                'severity' => 'critical',
                'code' => 'clinical_history_critical_events_open',
                'message' => 'Hay eventos clinicos criticos abiertos para revision del staff.',
            ];
            $summary['critical']++;
        }
        if ($reviewQueueCount > 0) {
            $issues[] = [
                'severity' => 'warning',
                'code' => 'clinical_history_review_queue_pending',
                'message' => 'Existen historias clinicas pendientes de revision humana.',
            ];
            $summary['warning']++;
        }
        if ($pendingAiCount > 0 || $unreadEvents > 0 || $openWarning > 0) {
            $issues[] = [
                'severity' => 'info',
                'code' => 'clinical_history_operational_attention',
                'message' => 'Hay actividad clinica reciente que requiere seguimiento operativo.',
            ];
            $summary['info']++;
        }

        $summary['totalIssues'] = count($issues);
        $status = 'healthy';
        if ($summary['critical'] > 0) {
            $status = 'critical';
        } elseif ($summary['warning'] > 0 || $summary['info'] > 0) {
            $status = 'degraded';
        }

        return [
            'status' => $status,
            'healthy' => $status === 'healthy',
            'summary' => $summary,
            'checks' => [
                [
                    'code' => 'clinical_history_events',
                    'status' => $openCritical > 0 ? 'fail' : 'pass',
                ],
                [
                    'code' => 'clinical_history_review_queue',
                    'status' => $reviewQueueCount > 0 ? 'warn' : 'pass',
                ],
                [
                    'code' => 'clinical_history_background_flow',
                    'status' => ($pendingAiCount > 0 || $unreadEvents > 0) ? 'warn' : 'pass',
                ],
            ],
            'issues' => $issues,
        ];
    }

    private static function initializeCounters(array $keys): array
    {
        $counters = [];
        foreach ($keys as $key) {
            $counters[$key] = 0;
        }

        return $counters;
    }

    private static function maxTimestamp(string $left, string $right): string
    {
        if ($left === '') {
            return $right;
        }
        if ($right === '') {
            return $left;
        }

        $leftTs = strtotime($left);
        $rightTs = strtotime($right);
        if ($leftTs === false) {
            return $right;
        }
        if ($rightTs === false) {
            return $left;
        }

        return $rightTs > $leftTs ? $right : $left;
    }

    private static function reviewPriority(array $row): int
    {
        $severity = (string) ($row['highestOpenSeverity'] ?? '');
        if ($severity === 'critical') {
            return -1;
        }
        if ($severity === 'warning') {
            return 0;
        }
        if ((string) ($row['pendingAiStatus'] ?? '') !== '') {
            return 1;
        }
        if ((int) ($row['openEventCount'] ?? 0) > 0) {
            return 2;
        }
        if ((bool) ($row['requiresHumanReview'] ?? false)) {
            return 3;
        }
        if ((string) ($row['reviewStatus'] ?? '') === 'ready_for_review') {
            return 4;
        }

        return 5;
    }

    private static function buildOpenEventStatsBySession(array $events): array
    {
        $statsBySessionId = [];

        foreach ($events as $eventRecord) {
            $event = ClinicalHistoryRepository::defaultEvent($eventRecord);
            $sessionId = ClinicalHistoryRepository::trimString($event['sessionId'] ?? '');
            $status = ClinicalHistoryRepository::trimString($event['status'] ?? 'open');
            if ($sessionId === '' || $status !== 'open') {
                continue;
            }

            $severity = ClinicalHistoryRepository::trimString($event['severity'] ?? 'info');
            if ($severity === '') {
                $severity = 'info';
            }
            $occurredAt = (string) ($event['occurredAt'] ?? $event['createdAt'] ?? '');
            $title = (string) ($event['title'] ?? '');

            $stats = $statsBySessionId[$sessionId] ?? [
                'openEventCount' => 0,
                'highestOpenSeverity' => '',
                'latestOpenEventTitle' => '',
                'latestOpenOccurredAt' => '',
            ];

            $stats['openEventCount'] = (int) ($stats['openEventCount'] ?? 0) + 1;
            $stats['highestOpenSeverity'] = self::preferHigherSeverity(
                (string) ($stats['highestOpenSeverity'] ?? ''),
                $severity
            );

            if (
                (string) ($stats['latestOpenOccurredAt'] ?? '') === ''
                || self::timestampGreater($occurredAt, (string) ($stats['latestOpenOccurredAt'] ?? ''))
            ) {
                $stats['latestOpenOccurredAt'] = $occurredAt;
                $stats['latestOpenEventTitle'] = $title;
            }

            $statsBySessionId[$sessionId] = $stats;
        }

        return $statsBySessionId;
    }

    private static function preferHigherSeverity(string $current, string $candidate): string
    {
        if (self::severityRank($candidate) > self::severityRank($current)) {
            return $candidate;
        }

        return $current;
    }

    private static function severityRank(string $severity): int
    {
        switch ($severity) {
            case 'critical':
                return 3;
            case 'warning':
                return 2;
            case 'info':
                return 1;
            default:
                return 0;
        }
    }

    private static function timestampGreater(string $left, string $right): bool
    {
        $leftTs = strtotime($left);
        $rightTs = strtotime($right);

        if ($leftTs === false) {
            return false;
        }

        if ($rightTs === false) {
            return true;
        }

        return $leftTs > $rightTs;
    }
}

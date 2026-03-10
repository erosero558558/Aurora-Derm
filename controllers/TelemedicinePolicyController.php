<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/telemedicine/TelemedicineOpsSnapshot.php';

final class TelemedicinePolicyController
{
    public static function diagnostics(array $context): void
    {
        if (($context['isAdmin'] ?? false) !== true) {
            json_response(['ok' => false, 'error' => 'No autorizado'], 401);
        }

        $snapshot = TelemedicineOpsSnapshot::build($context['store'] ?? []);
        $diagnostics = isset($snapshot['diagnostics']) && is_array($snapshot['diagnostics'])
            ? $snapshot['diagnostics']
            : [
                'status' => 'unknown',
                'healthy' => false,
                'summary' => [
                    'critical' => 0,
                    'warning' => 0,
                    'info' => 0,
                    'totalChecks' => 0,
                    'totalIssues' => 0,
                ],
                'checks' => [],
                'issues' => [],
            ];

        json_response([
            'ok' => true,
            'data' => $diagnostics,
        ]);
    }

    public static function readiness(array $context): void
    {
        if (($context['isAdmin'] ?? false) !== true) {
            json_response(['ok' => false, 'error' => 'No autorizado'], 401);
        }

        $summary = TelemedicineOpsSnapshot::forHealth(
            TelemedicineOpsSnapshot::build($context['store'] ?? [])
        );

        json_response([
            'ok' => true,
            'data' => [
                'ready' => (bool) ($summary['configured'] ?? false),
                'policy' => $summary['policy'] ?? [],
                'integrity' => $summary['integrity'] ?? [],
                'reviewQueueCount' => (int) ($summary['reviewQueueCount'] ?? 0),
                'diagnostics' => $summary['diagnostics'] ?? [],
            ],
        ]);
    }

    public static function simulate(array $context): void
    {
        if (($context['isAdmin'] ?? false) !== true) {
            json_response(['ok' => false, 'error' => 'No autorizado'], 401);
        }

        require_csrf();

        $payload = require_json_body();
        $intake = isset($payload['intake']) && is_array($payload['intake']) ? $payload['intake'] : null;
        $appointment = isset($payload['appointment']) && is_array($payload['appointment'])
            ? $payload['appointment']
            : [];

        $result = class_exists('TelemedicineEnforcementPolicy')
            ? TelemedicineEnforcementPolicy::evaluateBooking($intake, $appointment)
            : [
                'allowed' => true,
                'status' => 200,
                'error' => '',
                'errorCode' => '',
                'reason' => '',
                'suitability' => is_array($intake) ? (string) ($intake['suitability'] ?? '') : '',
                'reviewDecision' => is_array($intake) ? (string) ($intake['reviewDecision'] ?? 'none') : 'none',
                'policy' => [
                    'shadowModeEnabled' => true,
                    'enforceUnsuitable' => false,
                    'enforceReviewRequired' => false,
                    'allowDecisionOverride' => true,
                ],
            ];

        json_response([
            'ok' => true,
            'data' => $result,
        ]);
    }
}

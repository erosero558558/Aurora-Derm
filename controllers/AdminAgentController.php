<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/AdminAgentService.php';
require_once __DIR__ . '/../lib/InternalConsoleReadiness.php';

class AdminAgentController
{
    public static function start(array $context): void
    {
        self::requireAgentAccess($context);
        $payload = require_json_body();
        self::requireClinicalStorageReadyForPayload($payload);

        json_response([
            'ok' => true,
            'data' => AdminAgentService::startSession(
                isset($context['store']) && is_array($context['store']) ? $context['store'] : read_store(),
                $payload
            ),
        ], 201);
    }

    public static function turn(array $context): void
    {
        self::requireAgentAccess($context);
        $payload = require_json_body();
        self::requireClinicalStorageReadyForPayload($payload);

        json_response([
            'ok' => true,
            'data' => AdminAgentService::processTurn(
                isset($context['store']) && is_array($context['store']) ? $context['store'] : read_store(),
                $payload
            ),
        ]);
    }

    public static function status(array $context): void
    {
        self::requireAgentAccess($context);
        self::requireClinicalStorageReadyForPayload($_GET);

        json_response([
            'ok' => true,
            'data' => AdminAgentService::status($_GET),
        ]);
    }

    public static function events(array $context): void
    {
        self::requireAgentAccess($context);
        self::requireClinicalStorageReadyForPayload($_GET);

        json_response([
            'ok' => true,
            'data' => AdminAgentService::events($_GET),
        ]);
    }

    public static function approve(array $context): void
    {
        self::requireAgentAccess($context);
        $payload = require_json_body();
        self::requireClinicalStorageReadyForPayload($payload);

        json_response([
            'ok' => true,
            'data' => AdminAgentService::approve(
                isset($context['store']) && is_array($context['store']) ? $context['store'] : read_store(),
                $payload
            ),
        ]);
    }

    public static function cancel(array $context): void
    {
        self::requireAgentAccess($context);
        $payload = require_json_body();
        self::requireClinicalStorageReadyForPayload($payload);

        json_response([
            'ok' => true,
            'data' => AdminAgentService::cancel($payload),
        ]);
    }

    private static function requireAgentAccess(array $context): void
    {
        if (!($context['isAdmin'] ?? false)) {
            json_response([
                'ok' => false,
                'error' => 'No autorizado',
            ], 401);
        }

        $hasAccess = array_key_exists('agentAccess', $context)
            ? (bool) $context['agentAccess']
            : ((defined('TESTING_ENV') && TESTING_ENV === true)
                ? true
                : admin_agent_has_editorial_access());

        if (!$hasAccess) {
            json_response([
                'ok' => false,
                'error' => 'OpenClaw disponible solo para admin/editorial',
            ], 403);
        }
    }

    /**
     * @param array<string,mixed> $payload
     */
    private static function requireClinicalStorageReadyForPayload(array $payload): void
    {
        if (!AdminAgentService::requiresClinicalStorage($payload)) {
            return;
        }

        $readiness = function_exists('internal_console_readiness_snapshot')
            ? internal_console_readiness_snapshot()
            : null;
        $clinicalReady = function_exists('internal_console_clinical_data_ready')
            ? internal_console_clinical_data_ready($readiness)
            : (bool) ($readiness['clinicalData']['ready'] ?? true);

        if ($clinicalReady) {
            return;
        }

        $response = function_exists('internal_console_clinical_guard_payload')
            ? internal_console_clinical_guard_payload([
                'surface' => 'admin_agent',
                'data' => [
                    'session' => null,
                    'turn' => null,
                    'clientActions' => [],
                ],
            ])
            : [
                'ok' => false,
                'code' => 'clinical_storage_not_ready',
                'error' => 'Historias clinicas bloqueadas hasta habilitar almacenamiento cifrado.',
                'readiness' => $readiness,
                'surface' => 'admin_agent',
                'data' => [
                    'session' => null,
                    'turn' => null,
                    'clientActions' => [],
                ],
            ];

        json_response($response, 409);
    }
}

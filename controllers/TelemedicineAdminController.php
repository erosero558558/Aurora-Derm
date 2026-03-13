<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/telemedicine/TelemedicineIntakeService.php';
require_once __DIR__ . '/../lib/InternalConsoleReadiness.php';

final class TelemedicineAdminController
{
    public static function index(array $context): void
    {
        if (($context['isAdmin'] ?? false) !== true) {
            json_response(['ok' => false, 'error' => 'No autorizado'], 401);
        }

        if (function_exists('internal_console_clinical_data_ready') && !internal_console_clinical_data_ready()) {
            $payload = function_exists('internal_console_clinical_guard_payload')
                ? internal_console_clinical_guard_payload([
                    'data' => [
                        'items' => [],
                        'count' => 0,
                    ],
                ])
                : [
                    'ok' => false,
                    'code' => 'clinical_storage_not_ready',
                    'error' => 'Historias clinicas bloqueadas hasta habilitar almacenamiento cifrado.',
                    'data' => [
                        'items' => [],
                        'count' => 0,
                    ],
                ];
            json_response($payload, 409);
        }

        $filters = isset($context['query']) && is_array($context['query'])
            ? $context['query']
            : $_GET;

        $service = new TelemedicineIntakeService();
        $items = $service->listIntakes($context['store'] ?? [], $filters);

        json_response([
            'ok' => true,
            'data' => [
                'items' => $items,
                'count' => count($items),
            ],
        ]);
    }

    public static function patch(array $context): void
    {
        if (($context['isAdmin'] ?? false) !== true) {
            json_response(['ok' => false, 'error' => 'No autorizado'], 401);
        }

        require_csrf();

        if (function_exists('internal_console_clinical_data_ready') && !internal_console_clinical_data_ready()) {
            $payload = function_exists('internal_console_clinical_guard_payload')
                ? internal_console_clinical_guard_payload([
                    'data' => [
                        'intake' => null,
                        'appointment' => null,
                    ],
                ])
                : [
                    'ok' => false,
                    'code' => 'clinical_storage_not_ready',
                    'error' => 'Historias clinicas bloqueadas hasta habilitar almacenamiento cifrado.',
                    'data' => [
                        'intake' => null,
                        'appointment' => null,
                    ],
                ];
            json_response($payload, 409);
        }

        $payload = require_json_body();
        $intakeId = (int) ($payload['intakeId'] ?? $payload['id'] ?? 0);

        $service = new TelemedicineIntakeService();
        $result = $service->applyAdminDecision($context['store'] ?? [], $intakeId, $payload);
        if (($result['ok'] ?? false) !== true) {
            json_response(
                [
                    'ok' => false,
                    'error' => (string) ($result['error'] ?? 'No se pudo actualizar el intake de telemedicina'),
                ],
                (int) ($result['code'] ?? 400)
            );
        }

        write_store($result['store'] ?? [], false);

        json_response(
            [
                'ok' => true,
                'data' => [
                    'intake' => $result['intake'] ?? null,
                    'appointment' => $result['appointment'] ?? null,
                ],
            ],
            (int) ($result['code'] ?? 200)
        );
    }
}

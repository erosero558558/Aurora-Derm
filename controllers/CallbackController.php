<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/PatientCaseService.php';

class CallbackController
{
    public static function index(array $context): void
    {
        // GET /callbacks (Admin)
        $patientCaseService = new PatientCaseService();
        $store = $patientCaseService->hydrateStore($context['store']);
        json_response([
            'ok' => true,
            'data' => LeadOpsService::enrichCallbacks($store['callbacks'] ?? [], $store)
        ]);
    }

    public static function store(array $context): void
    {
        // POST /callbacks
        $store = $context['store'];
        $patientCaseService = new PatientCaseService();
        require_rate_limit('callbacks', 5, 60);
        $payload = require_json_body();
        // Security: ensure we generate a new ID for new callbacks
        unset($payload['id']);
        $callback = normalize_callback($payload);

        if ($callback['telefono'] === '') {
            json_response([
                'ok' => false,
                'error' => 'Teléfono obligatorio'
            ], 400);
        }

        if (!validate_phone($callback['telefono'])) {
            json_response([
                'ok' => false,
                'error' => 'El formato del teléfono no es válido'
            ], 400);
        }

        $callback = LeadOpsService::enrichCallback($callback, $store);
        $store['callbacks'][] = $callback;
        $store = $patientCaseService->hydrateStore($store);
        $callback = self::findCallbackById($store, (int) ($callback['id'] ?? 0)) ?? $callback;
        write_store($store);
        maybe_send_callback_admin_notification($callback);
        json_response([
            'ok' => true,
            'data' => $callback
        ], 201);
    }

    public static function update(array $context): void
    {
        // PATCH /callbacks (Admin)
        $store = $context['store'];
        $payload = require_json_body();
        $id = isset($payload['id']) ? (int) $payload['id'] : 0;
        if ($id <= 0) {
            json_response([
                'ok' => false,
                'error' => 'Identificador inválido'
            ], 400);
        }
        $found = false;
        $updated = null;
        foreach ($store['callbacks'] as &$callback) {
            if ((int) ($callback['id'] ?? 0) !== $id) {
                continue;
            }
            $found = true;
            if (isset($payload['status'])) {
                $callback['status'] = map_callback_status((string) $payload['status']);
            }
            if (isset($payload['fecha']) && trim((string) $payload['fecha']) !== '') {
                $callback['fecha'] = (string) $payload['fecha'];
            }

            $leadOpsPayload = isset($payload['leadOps']) && is_array($payload['leadOps'])
                ? $payload['leadOps']
                : [];

            if (!empty($leadOpsPayload) || isset($payload['status'])) {
                $callback['leadOps'] = LeadOpsService::mergeLeadOps($callback, $leadOpsPayload, $store);
            }

            if (isset($leadOpsPayload['outcome']) && trim((string) $leadOpsPayload['outcome']) !== '') {
                $callback['status'] = 'contactado';
            }

            $updated = LeadOpsService::enrichCallback($callback, $store);
        }
        unset($callback);
        if (!$found) {
            json_response([
                'ok' => false,
                'error' => 'Callback no encontrado'
            ], 404);
        }
        $patientCaseService = new PatientCaseService();
        $store = $patientCaseService->hydrateStore($store);
        $updated = self::findCallbackById($store, $id) ?? $updated;
        write_store($store);
        json_response([
            'ok' => true,
            'data' => $updated
        ]);
    }

    private static function findCallbackById(array $store, int $callbackId): ?array
    {
        if ($callbackId <= 0) {
            return null;
        }

        $callbacks = isset($store['callbacks']) && is_array($store['callbacks']) ? $store['callbacks'] : [];
        foreach ($callbacks as $callback) {
            if (!is_array($callback)) {
                continue;
            }
            if ((int) ($callback['id'] ?? 0) === $callbackId) {
                return $callback;
            }
        }

        return null;
    }
}

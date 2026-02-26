<?php

declare(strict_types=1);

class CallbackController
{
    public static function index(array $context): void
    {
        // GET /callbacks (Admin)
        $store = $context['store'];
        json_response([
            'ok' => true,
            'data' => $store['callbacks']
        ]);
    }

    public static function store(array $context): void
    {
        // POST /callbacks
        $store = $context['store'];
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

        $store['callbacks'][] = $callback;
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
        foreach ($store['callbacks'] as &$callback) {
            if ((int) ($callback['id'] ?? 0) !== $id) {
                continue;
            }
            $found = true;
            if (isset($payload['status'])) {
                $callback['status'] = map_callback_status((string) $payload['status']);
            }
        }
        unset($callback);
        if (!$found) {
            json_response([
                'ok' => false,
                'error' => 'Callback no encontrado'
            ], 404);
        }
        write_store($store);
        json_response([
            'ok' => true
        ]);
    }
}

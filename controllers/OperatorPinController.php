<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/TurneroOperatorAccess.php';

class OperatorPinController
{
    public static function status(array $context = []): void
    {
        start_secure_session();
        json_response(turnero_operator_pin_status_payload());
    }

    public static function sessionStatus(array $context = []): void
    {
        start_secure_session();
        json_response(turnero_operator_session_status_payload());
    }

    public static function login(array $context = []): void
    {
        start_secure_session();
        $payload = require_json_body();
        $pin = (string) ($payload['pin'] ?? $payload['password'] ?? '');

        try {
            json_response(turnero_operator_login_payload($pin));
        } catch (\RuntimeException $th) {
            json_response([
                'ok' => false,
                'error' => $th->getMessage(),
                'status' => $th->getCode() === 503 ? 'operator_pin_not_configured' : 'invalid_pin',
                'mode' => TURNERO_OPERATOR_MODE,
                'recommendedMode' => TURNERO_OPERATOR_MODE,
                'configured' => turnero_operator_access_is_configured(),
                'turneroOperatorAccessMeta' => turnero_operator_access_meta(),
            ], $th->getCode() >= 400 ? $th->getCode() : 400);
        }
    }

    public static function logout(array $context = []): void
    {
        start_secure_session();
        json_response(turnero_operator_logout_payload());
    }

    public static function rotate(array $context = []): void
    {
        start_secure_session();
        if (($context['isAdmin'] ?? false) !== true) {
            json_response([
                'ok' => false,
                'error' => 'No autorizado',
            ], 401);
        }
        require_csrf();

        $payload = require_json_body();
        try {
            json_response(turnero_operator_access_rotate(is_array($payload) ? $payload : []));
        } catch (\RuntimeException $th) {
            json_response([
                'ok' => false,
                'error' => $th->getMessage(),
            ], $th->getCode() >= 400 ? $th->getCode() : 400);
        }
    }
}

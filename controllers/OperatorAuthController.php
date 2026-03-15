<?php

declare(strict_types=1);

class OperatorAuthController
{
    public static function start(array $context = []): void
    {
        start_secure_session();

        if (operator_auth_is_authenticated()) {
            json_response(operator_auth_authenticated_payload(operator_auth_current_identity(false) ?: []));
        }

        $payload = operator_auth_create_challenge();
        $status = match ((string) ($payload['status'] ?? '')) {
            'pending' => 202,
            'operator_auth_not_configured' => 200,
            'operator_auth_storage_error' => 500,
            default => 400,
        };

        json_response($payload, $status);
    }

    public static function status(array $context = []): void
    {
        start_secure_session();

        $payload = operator_auth_status_payload();
        json_response($payload);
    }

    public static function complete(array $context = []): void
    {
        operator_auth_require_bridge_token();
        $result = operator_auth_complete_from_bridge(require_json_body());
        $payload = is_array($result['payload'] ?? null) ? $result['payload'] : ['ok' => false, 'error' => 'Payload invalido'];
        $status = (int) ($result['status'] ?? 500);
        json_response($payload, $status);
    }

    public static function logout(array $context = []): void
    {
        start_secure_session();
        json_response(operator_auth_logout_payload());
    }

    public static function callback(array $context = []): void
    {
        start_secure_session();

        $result = operator_auth_handle_broker_callback($_GET);
        $location = operator_auth_sanitize_return_to(
            (string) ($result['redirectTo'] ?? '/admin.html'),
            '/admin.html'
        );

        if (defined('TESTING_ENV')) {
            $GLOBALS['__TEST_REDIRECT'] = [
                'location' => $location,
                'status' => 302,
                'result' => $result,
            ];
            return;
        }

        header('Location: ' . $location, true, 302);
        exit();
    }
}

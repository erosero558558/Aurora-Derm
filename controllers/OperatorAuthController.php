<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/calendar/CalendarOAuthReauth.php';

class OperatorAuthController
{
    public static function start(array $context = []): void
    {
        start_secure_session();
        require_csrf();

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
        require_csrf();
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

    public static function oauthCallback(array $context = []): void
    {
        $result = CalendarOAuthReauth::completeCallback($_GET);
        if (!is_array($result)) {
            http_response_code(400);
            header('Content-Type: text/html; charset=utf-8');
            echo operator_auth_google_callback_document(
                'Callback invalido',
                'No se encontro un challenge activo para esta reautorizacion.',
                'warning',
                rtrim(operator_auth_server_base_url(), '/') . '/admin.html?calendarReauth=missing'
            );
            exit();
        }

        $status = (int) ($result['status'] ?? 500);
        $title = (string) ($result['title'] ?? 'Autenticacion del administrador');
        $message = (string) ($result['message'] ?? 'No se pudo completar la autenticacion.');
        $tone = (string) ($result['tone'] ?? 'info');
        $redirectUrl = (string) ($result['redirectUrl'] ?? (rtrim(operator_auth_server_base_url(), '/') . '/admin.html'));

        http_response_code($status);
        header('Content-Type: text/html; charset=utf-8');
        echo operator_auth_google_callback_document($title, $message, $tone, $redirectUrl);
        exit();
    }

    public static function calendarTokenStart(array $context = []): void
    {
        $payload = CalendarOAuthReauth::create();
        $status = (($payload['ok'] ?? false) === true) ? 202 : 503;
        json_response($payload, $status);
    }

    public static function calendarTokenStatus(array $context = []): void
    {
        $challengeId = trim((string) ($_GET['challengeId'] ?? ''));
        $payload = CalendarOAuthReauth::statusPayload($challengeId);
        $status = (($payload['ok'] ?? false) === true)
            ? 200
            : (($payload['status'] ?? '') === 'calendar_oauth_reauth_not_found' ? 404 : 400);
        json_response($payload, $status);
    }
}

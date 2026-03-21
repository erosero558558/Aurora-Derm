<?php

declare(strict_types=1);

require_once __DIR__ . '/api-lib.php';
require_once __DIR__ . '/controllers/OperatorAuthController.php';
require_once __DIR__ . '/lib/InternalConsoleReadiness.php';

apply_security_headers(false);
api_apply_cors(['GET', 'POST', 'OPTIONS'], ['Content-Type', 'X-CSRF-Token'], true);

start_secure_session();

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
$action = strtolower(trim((string) ($_GET['action'] ?? 'status')));
const ADMIN_LOGIN_ACTION = 'admin-login';
const ADMIN_LOGIN_FAIL_ACTION = 'admin-login-failed';

function admin_auth_is_loopback_request(): bool
{
    $remoteAddr = trim((string) ($_SERVER['REMOTE_ADDR'] ?? ''));
    if (in_array($remoteAddr, ['127.0.0.1', '::1'], true)) {
        return true;
    }

    $host = strtolower(trim((string) ($_SERVER['HTTP_HOST'] ?? '')));
    return str_starts_with($host, '127.0.0.1') || str_starts_with($host, '[::1]');
}

function admin_auth_require_loopback_request(string $action): void
{
    if (admin_auth_is_loopback_request()) {
        return;
    }

    audit_log_event('admin.local_only_denied', [
        'action' => $action,
        'remoteAddr' => (string) ($_SERVER['REMOTE_ADDR'] ?? ''),
        'host' => (string) ($_SERVER['HTTP_HOST'] ?? ''),
    ]);

    json_response([
        'ok' => false,
        'error' => 'Esta operacion solo puede iniciarse desde el mismo host.',
        'code' => 'loopback_required',
    ], 403);
}

function admin_auth_fallbacks_payload(): array
{
    if (function_exists('internal_console_auth_fallbacks_payload')) {
        return internal_console_auth_fallbacks_payload();
    }

    return [
        'legacy_password' => [
            'enabled' => false,
            'configured' => false,
            'requires2FA' => true,
            'available' => false,
            'reason' => 'fallback_disabled',
        ],
    ];
}

function admin_auth_legacy_disabled_response(): array
{
    $fallback = admin_auth_fallbacks_payload()['legacy_password'] ?? [];
    $reason = (string) ($fallback['reason'] ?? 'fallback_disabled');
    $error = 'El acceso por clave esta deshabilitado en este entorno.';

    if ($reason === 'admin_password_not_configured') {
        $error = 'El acceso por clave de contingencia requiere AURORADERM_ADMIN_PASSWORD o AURORADERM_ADMIN_PASSWORD_HASH. Los aliases PIELARMONIA_* siguen disponibles de forma transitoria.';
    } elseif ($reason === 'admin_2fa_not_configured') {
        $error = 'El acceso por clave de contingencia requiere AURORADERM_ADMIN_2FA_SECRET. El alias PIELARMONIA_ADMIN_2FA_SECRET sigue disponible de forma transitoria.';
    } else {
        $error = 'El acceso por clave de contingencia requiere AURORADERM_INTERNAL_CONSOLE_AUTH_ALLOW_LEGACY_FALLBACK=true y 2FA configurado en este entorno. Los aliases PIELARMONIA_* siguen disponibles de forma transitoria.';
    }

    return [
        'ok' => false,
        'code' => 'legacy_auth_disabled',
        'error' => $error,
        'fallbacks' => admin_auth_fallbacks_payload(),
    ];
}

function admin_auth_legacy_status_payload(bool $authenticated, array $overrides = []): array
{
    $legacyConfigured = admin_password_is_configured();
    $twoFactorEnabled = admin_two_factor_is_configured();
    $recommendedMode = internal_console_primary_auth_mode();
    $payload = [
        'ok' => true,
        'authenticated' => $authenticated,
        'status' => $authenticated
            ? 'authenticated'
            : ($legacyConfigured ? 'anonymous' : 'legacy_auth_not_configured'),
        'mode' => 'legacy_password',
        'configured' => $legacyConfigured,
        'twoFactorEnabled' => $twoFactorEnabled,
        'recommendedMode' => $recommendedMode,
        'capabilities' => $authenticated
            ? admin_agent_capabilities_payload()
            : [
                'adminAgent' => false,
            ],
        'fallbacks' => admin_auth_fallbacks_payload(),
    ];

    if ($authenticated) {
        $payload['csrfToken'] = generate_csrf_token();
    }

    return array_merge($payload, $overrides);
}

$prefersOpenClawAuth = function_exists('internal_console_prefers_openclaw_auth')
    ? internal_console_prefers_openclaw_auth()
    : operator_auth_is_enabled();
$legacyPasswordEnabled = function_exists('internal_console_allows_legacy_password_auth')
    ? internal_console_allows_legacy_password_auth()
    : !$prefersOpenClawAuth;

if ($method === 'GET' && $action === 'callback') {
    OperatorAuthController::callback();
}

if ($method === 'GET' && $action === 'oauth-callback') {
    OperatorAuthController::oauthCallback();
}

if ($method === 'GET' && $action === 'status') {
    if ($prefersOpenClawAuth && operator_auth_is_enabled()) {
        if (legacy_admin_is_authenticated()) {
            audit_log_event('admin.status', [
                'authenticated' => true,
                'mode' => 'legacy_password',
                'configured' => admin_password_is_configured(),
                'preferred' => true,
                'fallback' => true,
            ]);
            json_response(admin_auth_legacy_status_payload(true));
        }

        $isAuth = operator_auth_is_authenticated();
        audit_log_event('admin.status', [
            'authenticated' => $isAuth,
            'mode' => operator_auth_mode(),
        ]);
        OperatorAuthController::status();
    }

    $isAuth = legacy_admin_is_authenticated();
    if (!$isAuth && $prefersOpenClawAuth) {
        $payload = operator_auth_config_error_payload();
        audit_log_event('admin.status', [
            'authenticated' => false,
            'mode' => OPERATOR_AUTH_SOURCE,
            'configured' => false,
            'preferred' => true,
        ]);
        json_response($payload);
    }

    audit_log_event('admin.status', [
        'authenticated' => $isAuth,
        'mode' => 'legacy_password',
        'configured' => admin_password_is_configured(),
    ]);
    json_response(admin_auth_legacy_status_payload($isAuth));
}

if ($method === 'POST' && $action === 'start') {
    require_rate_limit('operator-auth-start', 12, 300);
    OperatorAuthController::start();
}

if ($method === 'POST' && $action === 'calendar-token-start') {
    admin_auth_require_loopback_request($action);
    require_rate_limit('calendar-oauth-reauth-start', 4, 600);
    OperatorAuthController::calendarTokenStart();
}

if ($method === 'GET' && $action === 'calendar-token-status') {
    admin_auth_require_loopback_request($action);
    OperatorAuthController::calendarTokenStatus();
}

if ($method === 'POST' && $action === 'login') {
    if (!$legacyPasswordEnabled) {
        audit_log_event('admin.login_legacy_disabled', [
            'action' => $action,
            'mode' => internal_console_primary_auth_mode(),
        ]);
        json_response(admin_auth_legacy_disabled_response(), 401);
    }

    // Limite de intentos globales por IP para el endpoint de login.
    require_rate_limit(ADMIN_LOGIN_ACTION, 12, 300);

    if (!admin_password_is_configured()) {
        audit_log_event('admin.login_misconfigured', [
            'reason' => 'missing_admin_password',
        ]);
        json_response([
            'ok' => false,
            'error' => 'Acceso admin no configurado en este entorno.',
            'fallbacks' => admin_auth_fallbacks_payload(),
        ], 503);
    }

    // Bloqueo temporal por credenciales fallidas repetidas.
    if (is_rate_limited(ADMIN_LOGIN_FAIL_ACTION, 5, 900)) {
        audit_log_event('admin.login_blocked', [
            'reason' => 'too_many_failed_attempts'
        ]);
        header('Retry-After: 900');
        json_response([
            'ok' => false,
            'error' => 'Demasiados intentos fallidos. Intenta nuevamente en 15 minutos.',
            'fallbacks' => admin_auth_fallbacks_payload(),
        ], 429);
    }

    $payload = require_json_body();
    $password = isset($payload['password']) ? (string) $payload['password'] : '';
    if ($password === '') {
        json_response([
            'ok' => false,
            'error' => 'Contrasena requerida',
            'fallbacks' => admin_auth_fallbacks_payload(),
        ], 400);
    }

    if (!verify_admin_password($password)) {
        check_rate_limit(ADMIN_LOGIN_FAIL_ACTION, 5, 900);
        audit_log_event('admin.login_failed', [
            'reason' => 'invalid_credentials'
        ]);
        json_response([
            'ok' => false,
            'error' => 'Credenciales invalidas',
            'fallbacks' => admin_auth_fallbacks_payload(),
        ], 401);
    }

    $totpSecret = app_env('AURORADERM_ADMIN_2FA_SECRET');
    if (is_string($totpSecret) && trim($totpSecret) !== '') {
        $_SESSION['admin_partial_login'] = true;
        $_SESSION['admin_partial_login_expires'] = time() + 300; // 5 minutos para ingresar codigo

        audit_log_event('admin.login_2fa_required', [
            'step' => 'password_verified'
        ]);

        json_response([
            'ok' => true,
            'twoFactorRequired' => true,
            'authenticated' => false,
            'status' => 'two_factor_required',
            'mode' => 'legacy_password',
            'configured' => true,
            'recommendedMode' => internal_console_primary_auth_mode(),
            'capabilities' => [
                'adminAgent' => false,
            ],
            'fallbacks' => admin_auth_fallbacks_payload(),
        ]);
    }

    session_regenerate_id(true);
    $_SESSION['admin_logged_in'] = true;
    reset_rate_limit(ADMIN_LOGIN_FAIL_ACTION);
    audit_log_event('admin.login_success', [
        'authenticated' => true
    ]);

    json_response([
        'ok' => true,
        'authenticated' => true,
        'status' => 'authenticated',
        'mode' => 'legacy_password',
        'configured' => true,
        'recommendedMode' => internal_console_primary_auth_mode(),
        'csrfToken' => generate_csrf_token(),
        'capabilities' => admin_agent_capabilities_payload(),
        'fallbacks' => admin_auth_fallbacks_payload(),
    ]);
}

if ($method === 'POST' && $action === 'login-2fa') {
    if (!$legacyPasswordEnabled) {
        audit_log_event('admin.login_legacy_disabled', [
            'action' => $action,
            'mode' => internal_console_primary_auth_mode(),
        ]);
        json_response(admin_auth_legacy_disabled_response(), 401);
    }

    require_rate_limit('admin-login-2fa', 6, 300);

    if (!isset($_SESSION['admin_partial_login']) || ($_SESSION['admin_partial_login'] !== true)) {
        json_response([
            'ok' => false,
            'error' => 'Sesion expirada',
            'fallbacks' => admin_auth_fallbacks_payload(),
        ], 401);
    }

    if (time() > ($_SESSION['admin_partial_login_expires'] ?? 0)) {
        unset($_SESSION['admin_partial_login']);
        json_response([
            'ok' => false,
            'error' => 'Tiempo expirado, vuelve a ingresar',
            'fallbacks' => admin_auth_fallbacks_payload(),
        ], 401);
    }

    $payload = require_json_body();
    $code = isset($payload['code']) ? trim((string) $payload['code']) : '';

    if ($code === '') {
        json_response([
            'ok' => false,
            'error' => 'Codigo requerido',
            'fallbacks' => admin_auth_fallbacks_payload(),
        ], 400);
    }

    if (!verify_2fa_code($code)) {
        audit_log_event('admin.login_2fa_failed', [
            'reason' => 'invalid_code'
        ]);
        json_response([
            'ok' => false,
            'error' => 'Codigo invalido',
            'fallbacks' => admin_auth_fallbacks_payload(),
        ], 401);
    }

    // Success
    unset($_SESSION['admin_partial_login']);
    unset($_SESSION['admin_partial_login_expires']);

    session_regenerate_id(true);
    $_SESSION['admin_logged_in'] = true;
    reset_rate_limit(ADMIN_LOGIN_FAIL_ACTION);

    audit_log_event('admin.login_success', [
        'authenticated' => true,
        'method' => '2fa'
    ]);

    json_response([
        'ok' => true,
        'authenticated' => true,
        'status' => 'authenticated',
        'mode' => 'legacy_password',
        'configured' => true,
        'recommendedMode' => internal_console_primary_auth_mode(),
        'csrfToken' => generate_csrf_token(),
        'capabilities' => admin_agent_capabilities_payload(),
        'fallbacks' => admin_auth_fallbacks_payload(),
    ]);
}

if ($method === 'POST' && $action === 'logout') {
    if ($prefersOpenClawAuth && operator_auth_is_enabled()) {
        OperatorAuthController::logout();
    }

    audit_log_event('admin.logout', [
        'authenticated' => false
    ]);
    destroy_secure_session();

    json_response([
        'ok' => true,
        'authenticated' => false,
        'status' => 'logout',
        'mode' => internal_console_primary_auth_mode(),
        'configured' => admin_password_is_configured(),
        'recommendedMode' => internal_console_primary_auth_mode(),
        'capabilities' => [
            'adminAgent' => false,
        ],
        'fallbacks' => admin_auth_fallbacks_payload(),
    ]);
}

json_response([
    'ok' => false,
    'error' => 'Acción no válida'
], 404);

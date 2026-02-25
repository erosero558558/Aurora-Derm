<?php

declare(strict_types=1);

/**
 * HTTP helper functions.
 */

if (defined('PIELARMONIA_HTTP_HELPERS_LOADED')) {
    return;
}
define('PIELARMONIA_HTTP_HELPERS_LOADED', true);

if (!class_exists('TestingExitException', false)) {
    class TestingExitException extends Exception
    {
        public $payload;
        public $status;
        public function __construct($payload, $status)
        {
            $this->payload = $payload;
            $this->status = $status;
            parent::__construct("JSON Response: $status");
        }
    }
}

function json_response(array $payload, int $status = 200): void
{
    if (defined('TESTING_ENV')) {
        $GLOBALS['__TEST_RESPONSE'] = ['payload' => $payload, 'status' => $status];
        if (!defined('TESTING_FORCE_EXIT')) {
            throw new TestingExitException($payload, $status);
        }
    }

    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit();
}

function is_https_request(): bool
{
    if (isset($_SERVER['HTTPS'])) {
        $https = strtolower((string) $_SERVER['HTTPS']);
        if ($https === 'on' || $https === '1') {
            return true;
        }
    }

    if (isset($_SERVER['SERVER_PORT']) && (string) $_SERVER['SERVER_PORT'] === '443') {
        return true;
    }

    if (isset($_SERVER['HTTP_X_FORWARDED_PROTO'])) {
        return strtolower((string) $_SERVER['HTTP_X_FORWARDED_PROTO']) === 'https';
    }

    return false;
}

function require_json_body(): array
{
    if (isset($GLOBALS['__TEST_JSON_BODY'])) {
        $data = json_decode($GLOBALS['__TEST_JSON_BODY'], true);
        if (is_array($data)) {
            return $data;
        }
    }

    $raw = file_get_contents('php://input');
    $data = json_decode($raw ?? '', true);
    if (!is_array($data)) {
        json_response([
            'ok' => false,
            'error' => 'El JSON enviado no es válido'
        ], 400);
    }
    return $data;
}

function generate_csrf_token(): string
{
    if (!isset($_SESSION['csrf_token']) || $_SESSION['csrf_token'] === '') {
        try {
            $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
        } catch (Throwable $e) {
            $_SESSION['csrf_token'] = bin2hex((string) microtime(true) . (string) mt_rand());
        }
    }
    return $_SESSION['csrf_token'];
}

function verify_csrf_token(): bool
{
    $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if ($token === '' || !isset($_SESSION['csrf_token']) || $_SESSION['csrf_token'] === '') {
        return false;
    }
    return hash_equals($_SESSION['csrf_token'], (string) $token);
}

function require_csrf(): void
{
    if (!verify_csrf_token()) {
        json_response([
            'ok' => false,
            'error' => 'Token CSRF inválido o ausente'
        ], 403);
    }
}

/**
 * Applies CORS headers based on environment configuration and request origin.
 */
function api_apply_cors(array $methods = ['GET', 'POST', 'OPTIONS'], array $headers = ['Content-Type', 'Authorization', 'X-CSRF-Token'], bool $credentials = true): void
{
    // Ensure methods are unique and uppercase
    $methods = array_unique(array_map('strtoupper', $methods));

    // Ensure headers are unique
    $headers = array_unique($headers);

    // Default headers for preflight requests
    header('Access-Control-Allow-Methods: ' . implode(', ', $methods));
    header('Access-Control-Allow-Headers: ' . implode(', ', $headers));

    $origin = isset($_SERVER['HTTP_ORIGIN']) ? trim((string) $_SERVER['HTTP_ORIGIN']) : '';
    if ($origin === '') {
        return;
    }

    $allowed = [];

    // 1. From PIELARMONIA_ALLOWED_ORIGIN (singular)
    $envOrigin = getenv('PIELARMONIA_ALLOWED_ORIGIN');
    if (is_string($envOrigin) && trim($envOrigin) !== '') {
        foreach (explode(',', $envOrigin) as $item) {
            $item = trim($item);
            if ($item !== '') {
                $allowed[] = rtrim($item, '/');
            }
        }
    }

    // 2. From PIELARMONIA_ALLOWED_ORIGINS (plural)
    $envOrigins = getenv('PIELARMONIA_ALLOWED_ORIGINS');
    if (is_string($envOrigins) && trim($envOrigins) !== '') {
        foreach (explode(',', $envOrigins) as $item) {
            $item = trim($item);
            if ($item !== '') {
                $allowed[] = rtrim($item, '/');
            }
        }
    }

    // 3. Hardcoded defaults
    $allowed[] = 'https://pielarmonia.com';
    $allowed[] = 'https://www.pielarmonia.com';

    // 4. Current Host (dynamic)
    $host = isset($_SERVER['HTTP_HOST']) ? trim((string) $_SERVER['HTTP_HOST']) : '';
    if ($host !== '') {
        $scheme = is_https_request() ? 'https' : 'http';
        $allowed[] = $scheme . '://' . $host;
    }

    $allowed = array_values(array_unique($allowed));
    $normalizedOrigin = rtrim($origin, '/');

    $matched = false;
    foreach ($allowed as $allowedOrigin) {
        if (strcasecmp($normalizedOrigin, $allowedOrigin) === 0) {
            $matched = true;
            break;
        }
    }

    if ($matched) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Vary: Origin');
        header('Cross-Origin-Resource-Policy: cross-origin');
        if ($credentials) {
            header('Access-Control-Allow-Credentials: true');
        }
    }

    // Handle OPTIONS request
    if (isset($_SERVER['REQUEST_METHOD']) && strtoupper($_SERVER['REQUEST_METHOD']) === 'OPTIONS') {
        http_response_code(204);
        exit();
    }
}

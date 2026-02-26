<?php

declare(strict_types=1);

require_once __DIR__ . '/routes.php';
require_once __DIR__ . '/metrics.php';
require_once __DIR__ . '/http.php';
require_once __DIR__ . '/api_helpers.php';
require_once __DIR__ . '/ApiConfig.php';

class ApiKernel
{
    public function handleRequest(): void
    {
        init_monitoring();

        apply_security_headers(false);

        $requestStartedAt = microtime(true);

        set_exception_handler(static function (Throwable $e): void {
            $code = ($e->getCode() >= 400 && $e->getCode() < 600) ? (int) $e->getCode() : 500;
            if (!headers_sent()) {
                http_response_code($code);
                header('Content-Type: application/json; charset=utf-8');
            }
            if (function_exists('get_logger')) {
                get_logger()->error('Piel en Armonía API uncaught: ' . $e->getMessage(), [
                    'file' => $e->getFile(),
                    'line' => $e->getLine(),
                    'trace' => $e->getTraceAsString()
                ]);
            } else {
                error_log('Piel en Armonía API uncaught: ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());
            }

            if (function_exists('\Sentry\captureException')) {
                \Sentry\captureException($e);
            }

            $clientMessage = api_error_message_for_client($e, $code);
            echo json_encode([
                'ok' => false,
                'error' => $clientMessage
            ], JSON_UNESCAPED_UNICODE);
            exit(1);
        });

        // CORS
        api_apply_cors(['GET', 'POST', 'PUT', 'PATCH', 'OPTIONS'], ['Content-Type', 'Authorization', 'X-CSRF-Token']);

        $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
        $resource = isset($_GET['resource']) ? (string) $_GET['resource'] : '';
        $action = isset($_GET['action']) ? (string) $_GET['action'] : '';

        if ($resource === '' && $action !== '') {
            $resource = $action;
        }

        // Rate Limiting
        $limitKey = $resource . ':' . $method;
        $rateLimits = ApiConfig::getRateLimits();

        if (isset($rateLimits[$limitKey])) {
            [$limitMax, $limitWindow] = $rateLimits[$limitKey];
            $clientIp = rate_limit_client_ip();
            // Bypass for localhost (IPv4 and IPv6) to allow local testing
            if ($clientIp !== '127.0.0.1' && $clientIp !== '::1') {
                require_rate_limit($limitKey, $limitMax, $limitWindow);
            }
        }

        register_shutdown_function(static function () use ($requestStartedAt, $method, $resource): void {
            $elapsed = api_elapsed_ms($requestStartedAt);

            if (class_exists('Metrics')) {
                Metrics::observe('http_request_duration_seconds', $elapsed / 1000, [
                    'method' => $method,
                    'resource' => $resource,
                    'status' => (string)http_response_code()
                ]);

                $status = http_response_code();
                $isSuccess = $status >= 200 && $status < 400;

                if ($isSuccess) {
                    if ($resource === 'monitoring-config') {
                        Metrics::increment('conversion_funnel_events_total', ['step' => 'page_view']);
                    } elseif ($resource === 'availability' || $resource === 'booked-slots') {
                        Metrics::increment('conversion_funnel_events_total', ['step' => 'view_availability']);
                    } elseif ($resource === 'payment-intent' && $method === 'POST') {
                        Metrics::increment('conversion_funnel_events_total', ['step' => 'initiate_checkout']);
                    } elseif ($resource === 'appointments' && $method === 'POST') {
                        Metrics::increment('conversion_funnel_events_total', ['step' => 'complete_booking']);
                    }
                }
            }

            if (class_exists('Metrics')) {
                // Track memory usage in bytes with custom buckets (256KB to 128MB)
                Metrics::observe('php_memory_usage_bytes', (float)memory_get_peak_usage(true), [], [
                    262144, 524288, 1048576, 2097152, 4194304, 8388608, 16777216, 33554432, 67108864, 134217728
                ]);
            }

            if ($elapsed < 2000) {
                return;
            }
            audit_log_event('api.slow', [
                'method' => $method,
                'resource' => $resource,
                'timingMs' => $elapsed
            ]);
        });

        // Load Store
        $storeReadStart = microtime(true);
        $store = read_store();
        $storeReadDuration = microtime(true) - $storeReadStart;

        if (class_exists('Metrics')) {
            Metrics::observe('store_read_duration_seconds', $storeReadDuration, [], [
                0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1.0
            ]);
        }

        $publicEndpoints = ApiConfig::getPublicEndpoints();

        $isPublic = false;
        foreach ($publicEndpoints as $endpoint) {
            if ($endpoint['method'] === $method && $endpoint['resource'] === $resource) {
                $isPublic = true;
                break;
            }
        }

        $isAdmin = false;
        if (!$isPublic) {
            start_secure_session();
            $isAdmin = isset($_SESSION['admin_logged_in']) && $_SESSION['admin_logged_in'] === true;
            if (!$isAdmin) {
                audit_log_event('api.unauthorized', [
                    'method' => $method,
                    'resource' => $resource,
                    'reason' => 'admin_required'
                ]);
                json_response([
                    'ok' => false,
                    'error' => 'No autorizado'
                ], 401);
            }
        }

        $shouldAuditAccess = true;
        if (!$isAdmin && $method === 'GET' && !api_should_audit_public_get($resource)) {
            $shouldAuditAccess = false;
        }

        if ($shouldAuditAccess) {
            audit_log_event('api.access', [
                'method' => $method,
                'resource' => $resource,
                'scope' => $isAdmin ? 'admin' : 'public'
            ]);
        }

        // CSRF: validar token en mutaciones autenticadas (no publicas)
        if (in_array($method, ['POST', 'PUT', 'PATCH'], true) && $isAdmin) {
            require_csrf();
        }

        // Prepare Context for Controllers
        $context = [
            'store' => $store,
            'isAdmin' => $isAdmin,
            'requestStartedAt' => $requestStartedAt,
            'method' => $method,
            'resource' => $resource
        ];

        // Determine Version
        $version = 'v1';
        if (isset($_SERVER['HTTP_X_API_VERSION'])) {
            $version = trim((string) $_SERVER['HTTP_X_API_VERSION']);
        } elseif (isset($_GET['v'])) {
            $version = trim((string) $_GET['v']);
        }
        if (ctype_digit($version)) {
            $version = 'v' . $version;
        }
        // Basic validation for version format 'v1', 'v2', etc.
        if (!preg_match('/^v\d+$/', $version)) {
            $version = 'v1';
        }

        // Initialize Router and Dispatch
        $router = new Router();
        register_api_routes($router);
        $router->dispatch($method, $resource, $version, $context);
    }
}

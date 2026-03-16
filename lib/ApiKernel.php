<?php

declare(strict_types=1);

require_once __DIR__ . '/routes.php';
require_once __DIR__ . '/metrics.php';
require_once __DIR__ . '/http.php';
require_once __DIR__ . '/api_helpers.php';
require_once __DIR__ . '/ApiConfig.php';
require_once __DIR__ . '/TurneroOperatorAccess.php';

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
        $diagnosticsEndpoints = ApiConfig::getDiagnosticsEndpoints();

        $isPublic = false;
        foreach ($publicEndpoints as $endpoint) {
            if ($endpoint['method'] === $method && $endpoint['resource'] === $resource) {
                $isPublic = true;
                break;
            }
        }

        $isDiagnostics = false;
        foreach ($diagnosticsEndpoints as $endpoint) {
            if ($endpoint['method'] === $method && $endpoint['resource'] === $resource) {
                $isDiagnostics = true;
                break;
            }
        }

        $isAdmin = false;
        $isQueueOperator = false;
        $queueOperatorSession = null;
        $diagnosticsAuthorized = false;
        $queueOperatorAllowedEndpoints = [
            'GET:data',
            'POST:operator-pin-logout',
            'POST:queue-call-next',
            'PATCH:queue-ticket',
            'PATCH:queue-help-request',
            'POST:queue-reprint',
        ];
        $queueOperatorScope = $method . ':' . $resource;
        if ($isDiagnostics) {
            $diagnosticsAuthorized = diagnostics_request_authorized([
                'method' => $method,
                'resource' => $resource,
            ]);
            if (!$diagnosticsAuthorized) {
                start_secure_session();
                $isAdmin = legacy_admin_is_authenticated() || operator_auth_is_authenticated();
                $diagnosticsAuthorized = $isAdmin;
            }
            if (!$diagnosticsAuthorized) {
                audit_log_event('api.unauthorized', [
                    'method' => $method,
                    'resource' => $resource,
                    'reason' => 'diagnostics_required'
                ]);
                json_response([
                    'ok' => false,
                    'error' => 'No autorizado'
                ], 403);
            }
        } elseif (!$isPublic) {
            start_secure_session();
            $isAdmin = legacy_admin_is_authenticated() || operator_auth_is_authenticated();
            $queueOperatorSession = turnero_operator_session_current();
            $isQueueOperator = is_array($queueOperatorSession);
            $queueOperatorAllowed = $isQueueOperator && in_array($queueOperatorScope, $queueOperatorAllowedEndpoints, true);
            if (!$isAdmin && !$queueOperatorAllowed) {
                audit_log_event('api.unauthorized', [
                    'method' => $method,
                    'resource' => $resource,
                    'reason' => $isQueueOperator ? 'queue_operator_scope_denied' : 'admin_required'
                ]);
                json_response([
                    'ok' => false,
                    'error' => 'No autorizado'
                ], 401);
            }
        }

        $shouldAuditAccess = true;
        if (
            !$isAdmin &&
            !$isQueueOperator &&
            !$diagnosticsAuthorized &&
            $method === 'GET' &&
            !api_should_audit_public_get($resource)
        ) {
            $shouldAuditAccess = false;
        }

        if ($shouldAuditAccess) {
            audit_log_event('api.access', [
                'method' => $method,
                'resource' => $resource,
                'scope' => $isAdmin
                    ? 'admin'
                    : ($isQueueOperator
                        ? 'queue_operator'
                        : ($diagnosticsAuthorized ? 'diagnostics' : 'public'))
            ]);
        }

        // CSRF: validar token en mutaciones autenticadas (no publicas)
        if (in_array($method, ['POST', 'PUT', 'PATCH'], true) && ($isAdmin || $isQueueOperator)) {
            require_csrf();
        }

        // Prepare Context for Controllers
        $context = [
            'store' => $store,
            'isAdmin' => $isAdmin,
            'isQueueOperator' => $isQueueOperator,
            'queueOperatorSession' => $queueOperatorSession,
            'agentAccess' => $isAdmin ? admin_agent_has_editorial_access() : false,
            'diagnosticsAuthorized' => $diagnosticsAuthorized,
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

<?php

declare(strict_types=1);

require_once __DIR__ . '/test_framework.php';

// Config
$port = 8090; // Different port to avoid conflict
$host = "localhost:$port";
$baseUrl = "http://$host/api.php";
$dataDir = sys_get_temp_dir() . '/pielarmonia-test-security-' . uniqid();

// Setup
if (!is_dir($dataDir)) {
    mkdir($dataDir, 0777, true);
}
putenv("PIELARMONIA_DATA_DIR=$dataDir");

echo "Starting server on port $port for security tests...\n";
$cmd = "PIELARMONIA_DATA_DIR=$dataDir php -S $host -t " . __DIR__ . "/../ > /dev/null 2>&1 & echo $!";
$pid = exec($cmd);

// Wait for server
$attempts = 0;
while ($attempts < 10) {
    $conn = @fsockopen('localhost', $port);
    if ($conn) {
        fclose($conn);
        break;
    }
    usleep(200000); // 200ms
    $attempts++;
}

if ($attempts === 10) {
    echo "Failed to start server.\n";
    exit(1);
}

// Helper for requests (with header inspection)
function api_request_headers($method, $resource, $data = null)
{
    global $baseUrl;
    $url = "$baseUrl?resource=$resource";
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
    curl_setopt($ch, CURLOPT_HEADER, true); // Include headers in output
    if ($data) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    }
    $response = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    curl_close($ch);

    $headersRaw = substr($response, 0, $headerSize);
    $bodyRaw = substr($response, $headerSize);

    $headers = [];
    foreach (explode("\r\n", $headersRaw) as $line) {
        if (strpos($line, ':') !== false) {
            [$k, $v] = explode(':', $line, 2);
            $headers[trim($k)] = trim($v);
        }
    }

    return ['code' => $code, 'headers' => $headers, 'body' => json_decode($bodyRaw, true)];
}

try {
    // 1. Security Headers on JSON Response
    run_test('Security: JSON Headers', function () {
        $res = api_request_headers('GET', 'health');
        assert_equals(200, $res['code']);

        $headers = $res['headers'];
        // Case-insensitive check helper needed? Usually curl headers are mixed case.
        // PHP built-in server might return specific casing.
        // Let's normalize keys to lowercase for checking.
        $headersLower = array_change_key_case($headers, CASE_LOWER);

        if (!isset($headersLower['x-frame-options'])) {
            throw new Exception("X-Frame-Options missing");
        }
        assert_equals('SAMEORIGIN', $headersLower['x-frame-options']);

        if (!isset($headersLower['x-content-type-options'])) {
            throw new Exception("X-Content-Type-Options missing");
        }
        assert_equals('nosniff', $headersLower['x-content-type-options']);

        if (!isset($headersLower['content-security-policy'])) {
            throw new Exception("CSP missing");
        }
        assert_contains("default-src 'none'", $headersLower['content-security-policy']);
    });

    // 2. Admin Auth Protection
    run_test('Security: Admin Auth Required', function () {
        // GET /appointments is protected
        $res = api_request_headers('GET', 'appointments');
        assert_equals(401, $res['code']);
        assert_equals('No autorizado', $res['body']['error']);
    });

    // 3. Rate Limiting
    run_test('Security: Rate Limiting', function () {
        // resource=payment-verify limit is 12 per minute
        // We will make 15 requests quickly.
        // Note: The rate limiter uses IP. Localhost might be ::1 or 127.0.0.1.

        $limitHit = false;
        for ($i = 0; $i < 15; $i++) {
            // We use payment-verify mock payload
            $payload = ['paymentIntentId' => 'pi_test_ratelimit_' . $i];
            $res = api_request_headers('POST', 'payment-verify', $payload);

            if ($res['code'] === 429) {
                $limitHit = true;
                break;
            }
            // If mock fails with 503 (gateway not configured) or 502, that's fine, it counts towards rate limit?
            // require_rate_limit is called BEFORE mock checks.
            // But payment-verify checks gateway enabled BEFORE returning?
            // api.php:
            // require_rate_limit('payment-verify', 12, 60);
            // if (!payment_gateway_enabled()) ...

            // So rate limit check is first.
        }

        assert_true($limitHit, "Should hit rate limit 429 after 15 requests");
    });

} catch (Throwable $e) {
    echo "Security Test Failed: " . $e->getMessage() . "\n";
    $test_failed++;
} finally {
    // Cleanup
    echo "Stopping server (PID $pid)...\n";
    exec("kill $pid");
    if (is_dir($dataDir)) {
        delete_path_recursive($dataDir);
    }
}

print_test_summary();

<?php

$serverBaseUrl = rtrim(getenv('TEST_BASE_URL') ?: 'http://127.0.0.1:8011', '/');
$baseUrl = $serverBaseUrl . '/api.php';
$authUrl = $serverBaseUrl . '/admin-auth.php';
$adminPassword = trim((string) (getenv('PIELARMONIA_ADMIN_PASSWORD') ?: ''));

function request($url, $method = 'GET', $data = [], $headers = [], $cookies = [])
{
    $ch = curl_init();
    $queryParams = '';
    if ($method === 'GET' && !empty($data)) {
        $queryParams = '?' . http_build_query($data);
    }

    curl_setopt($ch, CURLOPT_URL, $url . $queryParams);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HEADER, true); // We need headers for cookies

    if ($method === 'POST') {
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        $headers[] = 'Content-Type: application/json';
    }

    if (!empty($headers)) {
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    }

    if (!empty($cookies)) {
        $cookieStr = '';
        foreach ($cookies as $k => $v) {
            $cookieStr .= "$k=$v; ";
        }
        curl_setopt($ch, CURLOPT_COOKIE, $cookieStr);
    }

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    $responseHeader = substr($response, 0, $headerSize);
    $responseBody = substr($response, $headerSize);

    curl_close($ch);

    // Extract cookies from response headers
    $newCookies = [];
    if (preg_match_all('/^Set-Cookie:\s*([^;]*)/mi', $responseHeader, $matches)) {
        foreach ($matches[1] as $item) {
            parse_str($item, $cookie);
            $newCookies = array_merge($newCookies, $cookie);
        }
    }

    return [
        'code' => $httpCode,
        'body' => $responseBody,
        'cookies' => $newCookies
    ];
}

function fetch_admin_auth_status(string $authUrl): array
{
    $response = request($authUrl, 'GET', ['action' => 'status']);
    $decoded = json_decode((string) ($response['body'] ?? ''), true);

    return is_array($decoded) ? $decoded : [];
}

echo "Starting Penetration Test...\n";
echo "[INFO] Base URL: {$serverBaseUrl}\n";

// 1. Health Check
echo "[INFO] Checking Health...\n";
$res = request($baseUrl, 'GET', ['resource' => 'health']);
if ($res['code'] !== 200 && $res['code'] !== 503) {
    echo "[FAIL] Health check failed with code {$res['code']}\n";
    exit(1);
}
echo "[PASS] Health check OK.\n";

// 2. SQL Injection
echo "[INFO] Testing SQL Injection...\n";
// Try to inject in 'doctor' parameter
$res = request($baseUrl, 'GET', ['resource' => 'booked-slots', 'date' => '2024-01-01', 'doctor' => "' OR '1'='1"]);
// Since it's file based, this should return 200 (empty slots) or 400.
// A SQL injection vulnerability would likely cause 500 or SQL syntax error in body.
if ($res['code'] === 500 && stripos($res['body'], 'SQL syntax') !== false) {
    echo "[FAIL] Possible SQL Injection vulnerability detected!\n";
} else {
    echo "[PASS] No SQL Injection vulnerability detected (Response: {$res['code']}).\n";
}

// 3. XSS
echo "[INFO] Testing XSS...\n";
$xssPayload = "<script>alert('XSS')</script>";
$apptData = [
    'service' => 'consulta',
    'doctor' => 'rosero',
    'date' => date('Y-m-d', strtotime('+1 day')),
    'time' => '10:00',
    'name' => 'XSS Tester ' . $xssPayload,
    'email' => 'test@example.com',
    'phone' => '0991234567',
    'privacyConsent' => true
];

$res = request($baseUrl, 'POST', $apptData, [], [], ['resource' => 'appointments']); // Oops resource is in query param usually
// But api.php handles resource via GET param.
// Wait, api.php: $resource = isset($_GET['resource']) ...
// So POST must include ?resource=appointments
$res = request($baseUrl . '?resource=appointments', 'POST', $apptData);

if ($res['code'] === 201) {
    $body = json_decode($res['body'], true);
    if (isset($body['data']['name']) && strpos($body['data']['name'], $xssPayload) !== false) {
        echo "[WARN] XSS Payload was stored successfully! (This is expected behavior for backend storage, verifies need for output encoding).\n";
    } else {
        echo "[PASS] XSS Payload was sanitized or rejected.\n";
    }
} else {
    echo "[INFO] Appointment creation failed with {$res['code']} (Rate limit might be hit or validation error).\n";
    echo "Body: " . $res['body'] . "\n";
}

// 4. Rate Limiting
echo "[INFO] Testing Rate Limiting...\n";
// We already made 1 POST request. Limit is 5/60s for appointments.
// Let's make 5 more.
for ($i = 0; $i < 6; $i++) {
    $res = request($baseUrl . '?resource=appointments', 'POST', $apptData);
    if ($res['code'] === 429) {
        echo "[PASS] Rate limiting triggered at request " . ($i + 2) . "\n";
        break;
    }
    if ($i === 5) {
        echo "[FAIL] Rate limiting NOT triggered after 7 requests.\n";
    }
}

// 5. Auth Bypass & CSRF
echo "[INFO] Testing Auth Bypass & CSRF...\n";
// Try to access protected resource 'import' without auth
$res = request($baseUrl . '?resource=import', 'POST', ['appointments' => []]);
if ($res['code'] === 401) {
    echo "[PASS] Auth Bypass prevented (401 Unauthorized).\n";
} else {
    echo "[FAIL] Auth Bypass succeeded! Code: {$res['code']}\n";
}

if ($adminPassword === '') {
    echo "[WARN] PIELARMONIA_ADMIN_PASSWORD no definido. Skipping CSRF test.\n";
} else {
    $authStatus = fetch_admin_auth_status($authUrl);
    if (($authStatus['mode'] ?? '') !== 'legacy_password') {
        echo "[WARN] Este entorno usa " . ($authStatus['mode'] ?? 'openclaw_chatgpt') . " como acceso primario. Skipping CSRF legacy test.\n";
    } elseif (($authStatus['configured'] ?? true) === false || ($authStatus['status'] ?? '') === 'legacy_auth_not_configured') {
        echo "[WARN] Login legacy no configurado en este entorno. Skipping CSRF test.\n";
    } else {
        // Login to get session
        $loginRes = request($authUrl . '?action=login', 'POST', ['password' => $adminPassword]);
        $cookies = $loginRes['cookies'];
        $csrfToken = '';
        $body = json_decode($loginRes['body'], true);
        if (isset($body['csrfToken'])) {
            $csrfToken = $body['csrfToken'];
        }
        if (empty($cookies)) {
            echo "[WARN] Could not log in. Skipping CSRF test.\n";
        } else {
            // Try protected resource WITH auth but WITHOUT CSRF token
            $res = request(
                $baseUrl . '?resource=import',
                'POST',
                ['appointments' => []],
                [],
                $cookies
            );
            if ($res['code'] === 403) {
                echo "[PASS] CSRF protection working (403 Forbidden without token).\n";
            } else {
                echo "[FAIL] CSRF protection failed! Code: {$res['code']}\n";
            }

            // Try WITH CSRF token
            $headers = ['X-CSRF-Token: ' . $csrfToken];
            $res = request(
                $baseUrl . '?resource=import',
                'POST',
                ['appointments' => []],
                $headers,
                $cookies
            );
            if ($res['code'] === 200) {
                echo "[PASS] Authenticated request with CSRF token succeeded.\n";
            } else {
                echo "[WARN] Authenticated request failed with code {$res['code']}. Body: {$res['body']}\n";
            }
        }
    }
}

echo "Penetration Test Complete.\n";

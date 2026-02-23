<?php

declare(strict_types=1);

require_once __DIR__ . '/test_framework.php';

// Config
$port = 8090; // Different port to avoid conflict
$host = "localhost:$port";
$baseUrl = "http://$host/api.php";
$adminUrl = "http://$host/admin-auth.php";
$dataDir = sys_get_temp_dir() . '/pielarmonia-test-critical-' . uniqid();
$cookieFile = sys_get_temp_dir() . '/cookie-' . uniqid() . '.txt';

// Setup
if (!is_dir($dataDir)) {
    mkdir($dataDir, 0777, true);
}
// We need to pass env vars to the server process
$envVars = "PIELARMONIA_DATA_DIR=$dataDir PIELARMONIA_ADMIN_PASSWORD=secret PIELARMONIA_DEFAULT_AVAILABILITY_ENABLED=true";

echo "Starting server on port $port with data dir $dataDir...\n";
// Start server relative to project root
$rootDir = realpath(__DIR__ . '/../');
$cmd = "$envVars php -S $host -t " . escapeshellarg($rootDir) . " > /dev/null 2>&1 & echo $!";
$pid = exec($cmd);

// Wait for server
$attempts = 0;
while ($attempts < 20) {
    $conn = @fsockopen('localhost', $port);
    if ($conn) {
        fclose($conn);
        break;
    }
    usleep(200000); // 200ms
    $attempts++;
}

if ($attempts === 20) {
    echo "Failed to start server.\n";
    exit(1);
}

// Helper for requests with cookies
function http_request($method, $url, $data = null, $cookies = null, $headers = [])
{
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);

    $reqHeaders = ['Content-Type: application/json'];
    if (!empty($headers)) {
        $reqHeaders = array_merge($reqHeaders, $headers);
    }

    if ($data) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    }
    curl_setopt($ch, CURLOPT_HTTPHEADER, $reqHeaders);

    if ($cookies) {
        curl_setopt($ch, CURLOPT_COOKIEJAR, $cookies);
        curl_setopt($ch, CURLOPT_COOKIEFILE, $cookies);
    }
    $response = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return ['code' => $code, 'body' => json_decode($response, true)];
}

try {
    // 1. Conflict Handling (Waitlist)
    run_test('E2E: Conflict Handling', function () use ($baseUrl) {
        $date = date('Y-m-d', strtotime('+3 days')); // Ensure future date
        $time = '10:00';

        // Create first appointment
        $payload1 = [
            'name' => 'User A',
            'email' => 'a@example.com',
            'phone' => '0990000001',
            'date' => $date,
            'time' => $time,
            'service' => 'consulta',
            'doctor' => 'rosero',
            'privacyConsent' => true,
            'paymentMethod' => 'cash'
        ];
        $res1 = http_request('POST', "$baseUrl?resource=appointments", $payload1);

        if ($res1['code'] !== 201) {
             echo "Create 1 Failed: " . json_encode($res1['body']) . "\n";
        }
        assert_equals(201, $res1['code'], 'First booking failed');

        // Create second appointment (same slot)
        $payload2 = [
            'name' => 'User B',
            'email' => 'b@example.com',
            'phone' => '0990000002',
            'date' => $date,
            'time' => $time,
            'service' => 'consulta',
            'doctor' => 'rosero', // Same doctor
            'privacyConsent' => true,
            'paymentMethod' => 'cash'
        ];
        $res2 = http_request('POST', "$baseUrl?resource=appointments", $payload2);
        assert_equals(409, $res2['code'], 'Expected Conflict (409) for double booking');
    });

    // 2. Reschedule Flow
    run_test('E2E: Reschedule Flow', function () use ($baseUrl) {
        $date = date('Y-m-d', strtotime('+4 days'));
        $time1 = '10:00';
        $time2 = '11:00';

        // Create appointment
        $payload = [
            'name' => 'Reschedule User',
            'email' => 'reschedule@example.com',
            'phone' => '0990000003',
            'date' => $date,
            'time' => $time1,
            'service' => 'consulta',
            'doctor' => 'rosero',
            'privacyConsent' => true,
            'paymentMethod' => 'cash'
        ];
        $res = http_request('POST', "$baseUrl?resource=appointments", $payload);
        assert_equals(201, $res['code']);

        $appt = $res['body']['data'];
        $token = $appt['rescheduleToken'] ?? null;
        assert_true(!empty($token), 'Reschedule token missing');

        // Check availability of old slot (should be taken)
        $resSlot = http_request('GET', "$baseUrl?resource=booked-slots&date=$date");
        assert_contains($time1, json_encode($resSlot['body']['data']), 'Old slot should be taken');

        // Reschedule
        $reschedulePayload = [
            'token' => $token,
            'date' => $date,
            'time' => $time2
        ];
        $resReschedule = http_request('PATCH', "$baseUrl?resource=reschedule", $reschedulePayload);

        if ($resReschedule['code'] !== 200) {
            echo "Reschedule Failed: " . json_encode($resReschedule['body']) . "\n";
        }
        assert_equals(200, $resReschedule['code'], 'Reschedule failed');

        // Verify old slot free, new slot taken
        $resSlot2 = http_request('GET', "$baseUrl?resource=booked-slots&date=$date");
        $slots = $resSlot2['body']['data'];
        assert_false(in_array($time1, $slots), 'Old slot should be free');
        assert_true(in_array($time2, $slots), 'New slot should be taken');
    });

    // 3. Admin Cancellation
    run_test('E2E: Admin Cancellation', function () use ($baseUrl, $adminUrl, $cookieFile) {
        $date = date('Y-m-d', strtotime('+5 days'));
        $time = '10:00';

        // Create appointment
        $payload = [
            'name' => 'Cancel User',
            'email' => 'cancel@example.com',
            'phone' => '0990000004',
            'date' => $date,
            'time' => $time,
            'service' => 'consulta',
            'doctor' => 'rosero',
            'privacyConsent' => true,
            'paymentMethod' => 'cash'
        ];
        $res = http_request('POST', "$baseUrl?resource=appointments", $payload);
        assert_equals(201, $res['code']);
        $apptId = $res['body']['data']['id'];

        // Verify taken
        $resSlot = http_request('GET', "$baseUrl?resource=booked-slots&date=$date");
        assert_contains($time, json_encode($resSlot['body']['data']));

        // Login Admin
        $loginPayload = ['password' => 'secret'];
        $resLogin = http_request('POST', "$adminUrl?action=login", $loginPayload, $cookieFile);

        if ($resLogin['code'] !== 200) {
             echo "Login Failed: " . json_encode($resLogin['body']) . "\n";
        }
        assert_equals(200, $resLogin['code'], 'Admin login failed');
        assert_true($resLogin['body']['ok'], 'Admin login not ok');

        $csrfToken = $resLogin['body']['csrfToken'] ?? '';
        assert_true(!empty($csrfToken), 'CSRF token missing');

        // Cancel Appointment (Admin)
        $cancelPayload = ['id' => $apptId, 'status' => 'cancelled'];
        // Use cookieFile AND CSRF Header
        $resCancel = http_request('PATCH', "$baseUrl?resource=appointments", $cancelPayload, $cookieFile, ['X-CSRF-Token: ' . $csrfToken]);

        if ($resCancel['code'] !== 200) {
             echo "Cancel Failed: " . json_encode($resCancel['body']) . "\n";
        }
        assert_equals(200, $resCancel['code'], 'Admin cancel failed');

        // Verify free
        $resSlot2 = http_request('GET', "$baseUrl?resource=booked-slots&date=$date");
        $slots = $resSlot2['body']['data'];
        assert_false(in_array($time, $slots), 'Cancelled slot should be free');
    });

} catch (Throwable $e) {
    echo "Test Failed: " . $e->getMessage() . "\n";
    $test_failed++;
} finally {
    // Cleanup
    echo "Stopping server (PID $pid)...\n";
    exec("kill $pid");

    if (file_exists($cookieFile)) unlink($cookieFile);

    // Recursive delete data dir
    if (is_dir($dataDir)) {
        exec("rm -rf " . escapeshellarg($dataDir));
    }
}

print_test_summary();

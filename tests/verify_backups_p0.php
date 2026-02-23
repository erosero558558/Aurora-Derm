<?php

declare(strict_types=1);

// Self-contained Backup Verification Test
// Similar to BookingFlowTest.php but specifically checks backup creation.

// Pick a random port to avoid collisions
$port = rand(8100, 8999);
$host = "localhost:$port";
$baseUrl = "http://$host/api.php";
$tempDir = sys_get_temp_dir() . '/pielarmonia-test-backup-' . uniqid();

// Setup temp data dir
if (!is_dir($tempDir)) {
    mkdir($tempDir, 0777, true);
}
$backupDir = $tempDir . '/backups';

// Initialize empty store to prevent migration from other directories
$tomorrow = date('Y-m-d', strtotime('+1 day'));
$initialStore = [
    'appointments' => [],
    'availability' => [
        $tomorrow => ['09:00', '10:00', '11:00']
    ],
    'reviews' => [],
    'callbacks' => [],
    'updatedAt' => date('c'),
    'createdAt' => date('c')
];
file_put_contents($tempDir . '/store.json', json_encode($initialStore));

echo "Starting Backup Verification Server on port $port with data dir $tempDir...\n";

// Start server
$cmd = "PIELARMONIA_DATA_DIR=" . escapeshellarg($tempDir) . " php -S $host -t " . escapeshellarg(__DIR__ . "/../") . " > /dev/null 2>&1 & echo $!";
$pid = trim(shell_exec($cmd));

// Wait for server
$attempts = 0;
while ($attempts < 20) {
    $conn = @fsockopen('localhost', $port);
    if ($conn) {
        fclose($conn);
        break;
    }
    usleep(100000); // 100ms
    $attempts++;
}

if ($attempts === 20) {
    echo "FAILED: Server failed to start on port $port.\n";
    if ($pid) {
        exec("kill $pid");
    }
    exec("rm -rf " . escapeshellarg($tempDir));
    exit(1);
}

// Initial state: 0 backups?
// Actually, when the server starts and reads/initializes the store, it creates `store.json` (already created).
// It might trigger a backup on first write.
// Let's count backups before our explicit write.
$filesBefore = glob($backupDir . '/store-*.sqlite');
$countBefore = is_array($filesBefore) ? count($filesBefore) : 0;
echo "Backups before write: $countBefore\n";

// Prepare payload
$tomorrow = date('Y-m-d', strtotime('+1 day'));
$payload = [
    'name' => 'Backup Test User',
    'email' => 'backup@test.com',
    'phone' => '0991234567',
    'date' => $tomorrow,
    'time' => '10:00',
    'service' => 'consulta',
    'doctor' => 'indiferente',
    'privacyConsent' => true,
    'paymentMethod' => 'cash'
];

// Send POST request
$ch = curl_init($baseUrl . '?resource=appointments');
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

echo "Sending booking request to $baseUrl...\n";
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

echo "Response Code: $httpCode\n";

if ($httpCode !== 201) {
    echo "FAILED: Booking creation failed. Response: $response\n";
    // Cleanup
    exec("kill $pid");
    exec("rm -rf " . escapeshellarg($tempDir));
    exit(1);
}

// Allow filesystem sync
sleep(1);

// Check backups again
$filesAfter = glob($backupDir . '/store-*.sqlite');
$countAfter = is_array($filesAfter) ? count($filesAfter) : 0;
echo "Backups after write: $countAfter\n";

// Cleanup
echo "Stopping server (PID $pid)...\n";
exec("kill $pid");
exec("rm -rf " . escapeshellarg($tempDir));

if ($countAfter > $countBefore) {
    echo "SUCCESS: Backup created successfully.\n";
    exit(0);
} else {
    echo "FAILED: Backup count did not increase.\n";
    exit(1);
}

<?php

declare(strict_types=1);

// Self-contained Backup Verification Test
// Similar to BookingFlowTest.php but specifically checks backup creation.

require_once __DIR__ . '/test_filesystem.php';
require_once __DIR__ . '/test_server.php';

$tempDir = sys_get_temp_dir() . '/pielarmonia-test-backup-' . uniqid();
$server = [];

// Setup temp data dir
ensure_clean_directory($tempDir);
$backupDir = $tempDir . '/backups';

function count_store_backups(string $backupDir): int
{
    $patterns = [
        $backupDir . '/store-*.sqlite',
        $backupDir . '/store-*.json',
    ];

    $files = [];
    foreach ($patterns as $pattern) {
        $matches = glob($pattern);
        if (is_array($matches)) {
            $files = array_merge($files, $matches);
        }
    }

    return count($files);
}

// Initialize a JSON store so the test stays backend-agnostic.
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

$server = start_test_php_server([
    'docroot' => __DIR__ . '/..',
    'env' => [
        'PIELARMONIA_DATA_DIR' => $tempDir,
    ],
    'startup_timeout_ms' => 12000,
]);
$baseUrl = $server['base_url'] . '/api.php';

echo "Starting Backup Verification Server on {$server['base_url']} with data dir $tempDir...\n";

// Initial state: 0 backups?
// Actually, when the server starts and reads/initializes the store, it creates `store.json` (already created).
// It might trigger a backup on first write.
// Let's count backups before our explicit write.
$countBefore = count_store_backups($backupDir);
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
    stop_test_php_server($server);
    delete_path_recursive($tempDir);
    exit(1);
}

// Allow filesystem sync
sleep(1);

// Check backups again
$countAfter = count_store_backups($backupDir);
echo "Backups after write: $countAfter\n";

// Cleanup
echo "Stopping server...\n";
stop_test_php_server($server);
delete_path_recursive($tempDir);

if ($countAfter > $countBefore) {
    echo "SUCCESS: Backup created successfully.\n";
    exit(0);
} else {
    echo "FAILED: Backup count did not increase.\n";
    exit(1);
}

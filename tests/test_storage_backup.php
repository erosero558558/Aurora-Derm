<?php

declare(strict_types=1);

require_once __DIR__ . '/test_framework.php';

// Set up temporary environment for testing
$tmpDataDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'pielarmonia-test-storage-' . uniqid();
putenv("PIELARMONIA_DATA_DIR=$tmpDataDir");

ensure_clean_directory($tmpDataDir);

// Include dependencies
require_once __DIR__ . '/../lib/storage.php';
require_once __DIR__ . '/../lib/db.php';

echo "Testing Storage Backup Logic (SQLite)...\n";
echo "Using temp data dir: $tmpDataDir\n";

run_test('Writing to store should create a backup of the previous state', function () use ($tmpDataDir) {
    // 1. Create initial state
    $initialStore = read_store();
    $appt1 = ['id' => 1, 'name' => 'Backup Test 1', 'date' => '2023-01-01'];
    $initialStore['appointments'][] = $appt1;

    // First write. This creates backup of seed (empty).
    write_store($initialStore);

    // Verify file exists
    $storeFile = $tmpDataDir . '/store.sqlite';
    assert_true(file_exists($storeFile), 'store.sqlite should exist');

    // 2. Modify state (this triggers backup of step 1)
    $modifiedStore = read_store(); // Read back to get correct structure
    $modifiedStore['appointments'][0]['name'] = 'Backup Test Modified';

    // Wait at least 1 second
    sleep(1);

    write_store($modifiedStore);

    // 3. Check for backup file
    $backupDir = $tmpDataDir . '/backups';
    assert_true(is_dir($backupDir), 'Backup directory should exist');

    $files = glob($backupDir . '/store-*.sqlite');
    assert_greater_than(0, count($files), 'There should be at least one backup file');

    // Sort to get the latest
    sort($files);
    $latestBackup = end($files);

    // 4. Verify content of backup
    // The backup should contain 'Backup Test 1'
    try {
        // Need to close connection to main DB? No, reading backup is different file.
        $pdoBackup = new PDO("sqlite:$latestBackup");
        $stmt = $pdoBackup->query("SELECT json_data FROM appointments WHERE id = 1");
        $json = $stmt->fetchColumn();
        $data = json_decode($json, true);
        assert_equals('Backup Test 1', $data['name'] ?? null, 'Backup should contain the previous state value');
    } catch (Exception $e) {
        assert_true(false, 'Failed to read backup: ' . $e->getMessage());
    }

    // Verify current store has new value
    // We need to ensure read_store reads from the main file.
    // If we used get_db_connection() inside write_store, it's cached.
    // read_store also uses it.
    // So it should be fine.
    $currentStore = read_store();
    assert_equals('Backup Test Modified', $currentStore['appointments'][0]['name'] ?? null, 'Current store should have the new value');

    // Close connection for cleanup
    close_db_connection();
});

run_test('Backup rotation (max backups)', function () use ($tmpDataDir) {
    // Clear backups from previous test
    $backupDir = $tmpDataDir . '/backups';
    $files = glob($backupDir . '/*');
    foreach ($files as $f) {
        unlink($f);
    }

    if (!is_dir($backupDir)) {
        mkdir($backupDir, 0777, true);
    }

    // Create 35 dummy files
    for ($i = 0; $i < 35; $i++) {
        $name = sprintf('store-20230101-%06d-dummy.sqlite', $i);
        touch($backupDir . '/' . $name); // Just create empty files
    }

    // Now trigger one write_store which will create one more real backup and then prune
    $store = read_store();
    write_store($store);

    // Now count files
    $files = glob($backupDir . '/store-*.sqlite');

    // Should be exactly 30 (MAX_STORE_BACKUPS)
    assert_equals(30, count($files), 'Should have exactly 30 backup files after rotation');

    close_db_connection();
});

// Cleanup
delete_path_recursive($tmpDataDir);

print_test_summary();

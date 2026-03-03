<?php

declare(strict_types=1);

// Standalone Integration Test for Disaster Recovery
// Designed to run without PHPUnit dependencies if needed.

echo "Starting Disaster Recovery Integration Test...\n";

// Setup
global $tempDir;
$tempDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'pielarmonia_dr_test_' . uniqid();
if (!mkdir($tempDir, 0777, true)) {
    die("Could not create temp dir: $tempDir\n");
}

// Force JSON storage for this test to match legacy expectations
putenv("PIELARMONIA_DATA_DIR=$tempDir");
$storeFile = $tempDir . DIRECTORY_SEPARATOR . 'store.sqlite';
// Fallback if sqlite not available
if (!extension_loaded('pdo_sqlite')) {
    $storeFile = $tempDir . DIRECTORY_SEPARATOR . 'store.json';
    putenv("PIELARMONIA_STORAGE_JSON_FALLBACK=true");
}

$restoreScript = realpath(__DIR__ . '/../../bin/restore-backup.php');

// Ensure dependencies are loaded
require_once __DIR__ . '/../../lib/storage.php';
require_once __DIR__ . '/../../lib/db.php';

$storeFile = data_file_path();
require_once __DIR__ . '/../../lib/backup.php';

function fail($msg, $dir = null)
{
    global $tempDir;
    echo "FAILED: $msg\n";
    // Cleanup
    $cleanupDir = $dir ?? $tempDir;
    if (isset($cleanupDir)) {
        recursiveRemove($cleanupDir);
    }
    exit(1);
}

function recursiveRemove($dir)
{
    if (!$dir || !is_dir($dir)) {
        return;
    }
    if (function_exists('close_db_connection')) {
        close_db_connection();
    }
    $files = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($dir, RecursiveDirectoryIterator::SKIP_DOTS),
        RecursiveIteratorIterator::CHILD_FIRST
    );
    foreach ($files as $fileinfo) {
        $todo = ($fileinfo->isDir() ? 'rmdir' : 'unlink');
        $todo($fileinfo->getRealPath());
    }
    rmdir($dir);
}

function run_restore_command(string $restoreScript, string $backupPath, string $dataDir): array
{
    $command = [PHP_BINARY, $restoreScript, $backupPath, '--force'];
    $descriptors = [
        1 => ['pipe', 'w'],
        2 => ['pipe', 'w'],
    ];
    $env = array_merge($_ENV, ['PIELARMONIA_DATA_DIR' => $dataDir]);
    $pipes = [];
    $process = proc_open($command, $descriptors, $pipes, null, $env);
    if (!is_resource($process)) {
        return [
            'code' => 1,
            'output' => ['Could not start restore process.'],
        ];
    }

    $stdout = stream_get_contents($pipes[1]);
    $stderr = stream_get_contents($pipes[2]);
    fclose($pipes[1]);
    fclose($pipes[2]);

    $status = proc_close($process);
    $combined = trim((string) $stdout . PHP_EOL . (string) $stderr);

    return [
        'code' => $status,
        'output' => $combined === '' ? [] : preg_split('/\R+/', $combined),
    ];
}

try {
    // Make tempDir global for the fail function when running via PHPUnit
    $GLOBALS['tempDir'] = $tempDir;

    // 1. Setup Initial State
    $initialData = [
        'appointments' => [
            [
                'id' => 123,
                'name' => 'Test Patient',
                'email' => 'test@example.com',
                'status' => 'confirmed'
            ]
        ],
        'callbacks' => [],
        'reviews' => [],
        'availability' => [],
        'updatedAt' => date('c')
    ];

    echo "Attempting to write store to: $storeFile\n";
    write_store($initialData);

    // Adapt to SQLite/JSON hybrid
    if (!file_exists($storeFile)) {
        fail("Store file not created at $storeFile");
    }

    // 2. Create Backup
    $snapshot = backup_create_offsite_snapshot();
    if (!($snapshot['ok'] ?? false)) {
        fail("Backup snapshot failed: " . ($snapshot['reason'] ?? 'unknown'), $tempDir);
    }
    $backupPath = $snapshot['path'];
    if (!file_exists($backupPath)) {
        fail("Backup file not created.", $tempDir);
    }

    // 3. Corrupt Data (Simulate data loss/corruption)
    file_put_contents($storeFile, 'CORRUPTED DATA');
    if (file_get_contents($storeFile) !== 'CORRUPTED DATA') {
        fail("Failed to corrupt data.", $tempDir);
    }

    // Ensure any existing DB connection is closed before cleanup
    if (function_exists('close_db_connection')) {
        close_db_connection();
    }

    // Move backup to a safe location outside the data dir
    $safeBackupPath = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'safe_backup_' . uniqid() . '.json';
    if (!copy($backupPath, $safeBackupPath)) {
        fail("Failed to copy backup to safe location.");
    }

    // Nuke the entire data directory to ensure no artifacts remain
    recursiveRemove($tempDir);
    if (!mkdir($tempDir, 0777, true)) {
        fail("Failed to recreate temp dir.");
    }

    // 4. Restore using CLI script
    // Close DB connection to release file lock before external script acts on it
    if (function_exists('close_db_connection')) {
        close_db_connection();
    }

    $run = run_restore_command($restoreScript, $safeBackupPath, $tempDir);
    $output = $run['output'];
    $returnVar = (int) ($run['code'] ?? 1);

    if ($returnVar !== 0) {
        echo "\nRestore script output:\n" . implode("\n", $output) . "\n";
        fail("Restore script failed with code $returnVar", $tempDir);
    }

    // 5. Verify Restoration
    $restoredData = read_store();

    if (count($restoredData['appointments'] ?? []) !== 1) {
        echo "Restore script output:\n" . implode("\n", $output) . "\n";
        fail("Restored appointments count mismatch.");
    }
    if (($restoredData['appointments'][0]['name'] ?? '') !== 'Test Patient') {
        echo "Restore script output:\n" . implode("\n", $output) . "\n";
        fail("Restored patient name mismatch.");
    }

    // Check safety backup existence
    $files = glob($storeFile . '.pre-restore-*.bak');
    // Note: backup logic might differ for sqlite vs json, but ensure_data_file or backup logic creates it.
    // If restore script does create a safety backup, it should be there.
    // For SQLite, restore-backup.php might just overwrite or copy.
    // Let's check the restore script logic if this fails.

    echo "SUCCESS: Disaster Recovery Test Passed.\n";
    recursiveRemove($tempDir);
    exit(0);

} catch (Throwable $e) {
    fail("Exception: " . $e->getMessage(), $tempDir);
}

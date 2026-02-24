<?php

declare(strict_types=1);

require_once __DIR__ . '/test_framework.php';

$tempDataDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'pielarmonia-test-backup-receiver-' . uniqid('', true);
putenv('PIELARMONIA_DATA_DIR=' . $tempDataDir);
putenv('PIELARMONIA_BACKUP_RECEIVER_ENCRYPTION_KEY=backup-receiver-test-key');
putenv('PIELARMONIA_BACKUP_RECEIVER_RETENTION_DAYS=1');
putenv('PIELARMONIA_BACKUP_RECEIVER_CLEANUP_MAX_FILES=1000');

if (!is_dir($tempDataDir) && !@mkdir($tempDataDir, 0777, true) && !is_dir($tempDataDir)) {
    fwrite(STDERR, "No se pudo crear directorio temporal de pruebas.\n");
    exit(1);
}

require_once __DIR__ . '/../lib/storage.php';
require_once __DIR__ . '/../lib/backup.php';

run_test('normalize sha256 extracts hash from valid input', function (): void {
    $raw = 'SHA256=6F0f5D6a2094f13f0f6708a159a7ec8f2ec6cb5cb64909053c7c2907f24f2f5c';
    $normalized = backup_receiver_normalize_sha256($raw);
    assert_equals('6f0f5d6a2094f13f0f6708a159a7ec8f2ec6cb5cb64909053c7c2907f24f2f5c', $normalized);
});

run_test('checksum comparison validates equivalent hashes', function (): void {
    $left = '6f0f5d6a2094f13f0f6708a159a7ec8f2ec6cb5cb64909053c7c2907f24f2f5c';
    $right = '6F0F5D6A2094F13F0F6708A159A7EC8F2EC6CB5CB64909053C7C2907F24F2F5C';
    assert_true(backup_receiver_checksum_matches($left, $right));
    assert_false(backup_receiver_checksum_matches($left, 'bad-hash'));
});

run_test('backup receiver encryption roundtrip keeps payload and hash', function (): void {
    $plain = random_bytes(64) . "\0" . "pielarmonia";
    $encrypted = backup_receiver_encrypt_payload($plain);
    assert_true((bool) ($encrypted['ok'] ?? false));
    assert_true(strpos((string) ($encrypted['ciphertext'] ?? ''), BACKUP_RECEIVER_ENVELOPE_PREFIX) === 0);

    $decoded = backup_receiver_decrypt_payload((string) $encrypted['ciphertext']);
    assert_true((bool) ($decoded['ok'] ?? false));
    assert_equals($plain, (string) ($decoded['plain'] ?? ''));
    assert_equals((string) ($encrypted['sha256'] ?? ''), (string) ($decoded['sha256'] ?? ''));
});

run_test('backup receiver detects tampered encrypted payload', function (): void {
    $encrypted = backup_receiver_encrypt_payload('payload-seguro');
    assert_true((bool) ($encrypted['ok'] ?? false));
    $ciphertext = (string) ($encrypted['ciphertext'] ?? '');
    $tampered = substr($ciphertext, 0, -2) . 'AA';

    $decoded = backup_receiver_decrypt_payload($tampered);
    assert_false((bool) ($decoded['ok'] ?? true));
});

run_test('verify stored file validates checksum metadata', function (): void {
    $root = backup_receiver_storage_root();
    if (!is_dir($root)) {
        @mkdir($root, 0777, true);
    }

    $encrypted = backup_receiver_encrypt_payload('contenido-clinico');
    assert_true((bool) ($encrypted['ok'] ?? false));

    $filePath = $root . DIRECTORY_SEPARATOR . 'test-backup.enc';
    @file_put_contents($filePath, (string) ($encrypted['ciphertext'] ?? ''), LOCK_EX);
    @file_put_contents(
        $filePath . '.meta.json',
        json_encode(['sha256' => (string) ($encrypted['sha256'] ?? '')], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        LOCK_EX
    );

    $okResult = backup_receiver_verify_stored_file($filePath);
    assert_true((bool) ($okResult['ok'] ?? false));
    assert_true((bool) ($okResult['metaMatch'] ?? false));

    @file_put_contents(
        $filePath . '.meta.json',
        json_encode(['sha256' => str_repeat('a', 64)], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        LOCK_EX
    );
    $badResult = backup_receiver_verify_stored_file($filePath);
    assert_false((bool) ($badResult['ok'] ?? true));
    assert_equals('metadata_checksum_mismatch', (string) ($badResult['reason'] ?? ''));
});

run_test('cleanup retention removes old encrypted files', function (): void {
    $root = backup_receiver_storage_root();
    if (!is_dir($root)) {
        @mkdir($root, 0777, true);
    }

    $oldFile = $root . DIRECTORY_SEPARATOR . 'old-file.enc';
    $newFile = $root . DIRECTORY_SEPARATOR . 'new-file.enc';
    @file_put_contents($oldFile, 'old', LOCK_EX);
    @file_put_contents($newFile, 'new', LOCK_EX);

    $oldTimestamp = time() - (3 * 86400);
    @touch($oldFile, $oldTimestamp);
    @touch($newFile, time());

    $cleanup = backup_receiver_cleanup_retention($root);
    assert_true((bool) ($cleanup['ok'] ?? false));
    assert_false(file_exists($oldFile));
    assert_true(file_exists($newFile));
});

function delete_tree(string $path): void
{
    if (!is_dir($path)) {
        return;
    }

    $items = scandir($path);
    if (!is_array($items)) {
        return;
    }

    foreach ($items as $item) {
        if ($item === '.' || $item === '..') {
            continue;
        }
        $target = $path . DIRECTORY_SEPARATOR . $item;
        if (is_dir($target)) {
            delete_tree($target);
            @rmdir($target);
            continue;
        }
        @unlink($target);
    }
}

delete_tree($tempDataDir);
@rmdir($tempDataDir);

print_test_summary();

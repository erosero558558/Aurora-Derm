<?php

require_once __DIR__ . '/test_framework.php';

// Set up temporary environment for testing
$tmpDataDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'pielarmonia-test-encryption-' . uniqid();
putenv("PIELARMONIA_DATA_DIR=$tmpDataDir");

// We set the key to verify encryption works
$testKey = 'test_key_123456789012345678901234'; // 32 chars
putenv("PIELARMONIA_DATA_ENCRYPTION_KEY=$testKey");
putenv("PIELARMONIA_STORAGE_JSON_FALLBACK=true");

ensure_clean_directory($tmpDataDir);

require_once __DIR__ . '/../lib/storage.php';

echo "Testing Storage Encryption Logic...\n";
echo "Using temp data dir: $tmpDataDir\n";

run_test('data_encrypt_payload should return encrypted string when key is present', function () {
    $plain = 'Sensitive Data';
    $encrypted = data_encrypt_payload($plain);

    assert_true($encrypted !== $plain, 'Encrypted string should not match plaintext');
    assert_true(strpos($encrypted, 'ENCv1:') === 0, 'Encrypted string should start with ENCv1:');

    // Verify length logic (ENCv1: + base64(12+16+len))
    assert_greater_than(20, strlen($encrypted), 'Encrypted string should have substantial length');
});

run_test('data_decrypt_payload should decrypt correctly', function () {
    $plain = 'Another Secret';
    $encrypted = data_encrypt_payload($plain);
    $decrypted = data_decrypt_payload($encrypted);

    assert_equals($plain, $decrypted, 'Decrypted string should match original plaintext');
});

run_test('write_store_json_fallback should write encrypted file', function () use ($tmpDataDir) {
    $store = ['appointments' => [['id' => 1, 'name' => 'Secret Patient']]];

    // Ensure file doesn't exist
    $jsonPath = $tmpDataDir . '/store.json';
    if (file_exists($jsonPath)) unlink($jsonPath);

    $result = write_store_json_fallback($store);
    assert_true($result, 'write_store_json_fallback should return true');

    assert_true(file_exists($jsonPath), 'store.json should be created');

    $content = file_get_contents($jsonPath);
    assert_true(strpos($content, 'ENCv1:') === 0, 'store.json content should start with ENCv1:');
    assert_false(strpos($content, 'Secret Patient'), 'store.json should not contain plaintext data');

    // Verify we can read it back
    // We need to clear static cache or ensure environment is correct?
    // read_store_json_fallback uses data_decrypt_payload which uses data_encryption_key().
    // Since we are in same process, data_encryption_key() is already resolved with our key.
    $readStore = read_store_json_fallback();
    assert_equals('Secret Patient', $readStore['appointments'][0]['name'] ?? null, 'Should be able to read back decrypted data');
});

// Cleanup
delete_path_recursive($tmpDataDir);

print_test_summary();

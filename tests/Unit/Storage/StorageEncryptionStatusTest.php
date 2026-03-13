<?php

declare(strict_types=1);

namespace Tests\Unit\Storage;

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../../lib/storage.php';

final class StorageEncryptionStatusTest extends TestCase
{
    private array $envKeys = [
        'PIELARMONIA_DATA_DIR',
        'PIELARMONIA_FORCE_SQLITE_UNAVAILABLE',
        'PIELARMONIA_STORAGE_JSON_FALLBACK',
        'PIELARMONIA_DATA_ENCRYPTION_KEY',
        'PIELARMONIA_REQUIRE_DATA_ENCRYPTION',
        'PIELARMONIA_APP_ENV',
        'PIELARMONIA_ENV',
        'APP_ENV',
        'PIELARMONIA_SENTRY_ENV',
    ];

    /**
     * @runInSeparateProcess
     */
    public function testEncryptedJsonFallbackReportsCompliantStatus(): void
    {
        $tempDir = $this->createTempDataDir('encrypted-json');

        putenv('PIELARMONIA_DATA_DIR=' . $tempDir);
        putenv('PIELARMONIA_FORCE_SQLITE_UNAVAILABLE=true');
        putenv('PIELARMONIA_STORAGE_JSON_FALLBACK=true');
        putenv('PIELARMONIA_DATA_ENCRYPTION_KEY=test_key_123456789012345678901234');
        putenv('PIELARMONIA_REQUIRE_DATA_ENCRYPTION=true');

        $this->assertTrue(write_store_json_fallback([
            'appointments' => [['id' => 1, 'name' => 'Paciente Seguro']],
        ]));
        $this->assertTrue(store_file_is_encrypted());
        $this->assertTrue(storage_encryption_configured());
        $this->assertTrue(storage_encryption_required());
        $this->assertSame('encrypted', storage_encryption_status());
        $this->assertTrue(storage_encryption_compliant());
    }

    /**
     * @runInSeparateProcess
     */
    public function testPlaintextJsonFallbackReportsNonCompliantStatusWhenRequired(): void
    {
        $tempDir = $this->createTempDataDir('plaintext-json');

        putenv('PIELARMONIA_DATA_DIR=' . $tempDir);
        putenv('PIELARMONIA_FORCE_SQLITE_UNAVAILABLE=true');
        putenv('PIELARMONIA_STORAGE_JSON_FALLBACK=true');
        putenv('PIELARMONIA_REQUIRE_DATA_ENCRYPTION=true');

        $this->assertTrue(write_store_json_fallback([
            'appointments' => [['id' => 1, 'name' => 'Paciente Plano']],
        ]));
        $this->assertFalse(store_file_is_encrypted());
        $this->assertFalse(storage_encryption_configured());
        $this->assertTrue(storage_encryption_required());
        $this->assertSame('plaintext', storage_encryption_status());
        $this->assertFalse(storage_encryption_compliant());
    }

    protected function tearDown(): void
    {
        foreach ($this->envKeys as $key) {
            putenv($key);
        }
        get_db_connection(null, true);
    }

    private function createTempDataDir(string $suffix): string
    {
        $base = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'pielarmonia-tests';
        $dir = $base . DIRECTORY_SEPARATOR . $suffix . '-' . uniqid('', true);
        if (!is_dir($dir) && !mkdir($dir, 0777, true) && !is_dir($dir)) {
            $this->fail('Unable to create temp directory for test.');
        }
        return $dir;
    }
}

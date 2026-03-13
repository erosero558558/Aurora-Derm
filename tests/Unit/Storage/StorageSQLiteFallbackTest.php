<?php

declare(strict_types=1);

namespace Tests\Unit\Storage;

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../../lib/storage.php';

final class StorageSQLiteFallbackTest extends TestCase
{
    private array $envKeys = [
        'PIELARMONIA_DATA_DIR',
        'PIELARMONIA_FORCE_SQLITE_UNAVAILABLE',
        'PIELARMONIA_STORAGE_JSON_FALLBACK',
    ];

    /**
     * @runInSeparateProcess
     */
    public function testEnsureDataFileUsesJsonFallbackWhenSQLiteUnavailable(): void
    {
        $tempDir = $this->createTempDataDir('sqlite-fallback-enabled');
        $errorLog = $tempDir . DIRECTORY_SEPARATOR . 'php-error.log';

        putenv('PIELARMONIA_DATA_DIR=' . $tempDir);
        putenv('PIELARMONIA_FORCE_SQLITE_UNAVAILABLE=true');
        putenv('PIELARMONIA_STORAGE_JSON_FALLBACK=true');
        ini_set('log_errors', '1');
        ini_set('error_log', $errorLog);

        $this->assertTrue(ensure_data_file());
        $this->assertTrue(ensure_data_file(), 'Second call should stay healthy and not spam logs');
        $this->assertSame('json_fallback', storage_backend_mode());
        $this->assertFileExists($tempDir . DIRECTORY_SEPARATOR . 'store.json');
        $this->assertFileDoesNotExist($tempDir . DIRECTORY_SEPARATOR . 'store.sqlite');

        $logRaw = (string) @file_get_contents($errorLog);
        $message = 'Piel en Armonia storage: SQLite unavailable, using JSON fallback store.';
        $this->assertSame(1, substr_count($logRaw, $message));
    }

    /**
     * @runInSeparateProcess
     */
    public function testEnsureDataFileFailsWhenSQLiteUnavailableAndFallbackDisabled(): void
    {
        $tempDir = $this->createTempDataDir('sqlite-fallback-disabled');
        $errorLog = $tempDir . DIRECTORY_SEPARATOR . 'php-error.log';

        putenv('PIELARMONIA_DATA_DIR=' . $tempDir);
        putenv('PIELARMONIA_FORCE_SQLITE_UNAVAILABLE=true');
        putenv('PIELARMONIA_STORAGE_JSON_FALLBACK=false');
        ini_set('log_errors', '1');
        ini_set('error_log', $errorLog);

        $this->assertFalse(ensure_data_file());
        $this->assertFalse(ensure_data_file(), 'Second call should keep failing without duplicate logs');
        $this->assertSame('unavailable', storage_backend_mode());
        $this->assertFileDoesNotExist($tempDir . DIRECTORY_SEPARATOR . 'store.json');

        $logRaw = (string) @file_get_contents($errorLog);
        $message = 'Piel en Armonia storage: SQLite unavailable and JSON fallback disabled.';
        $this->assertSame(1, substr_count($logRaw, $message));
    }

    /**
     * @runInSeparateProcess
     */
    public function testDbConnectionReturnsNullWhenSqliteDriverForcedUnavailable(): void
    {
        $tempDir = $this->createTempDataDir('sqlite-db-null');
        $errorLog = $tempDir . DIRECTORY_SEPARATOR . 'php-error.log';
        $dbPath = $tempDir . DIRECTORY_SEPARATOR . 'store.sqlite';

        putenv('PIELARMONIA_FORCE_SQLITE_UNAVAILABLE=true');
        ini_set('log_errors', '1');
        ini_set('error_log', $errorLog);

        get_db_connection(null, true);
        $this->assertNull(get_db_connection($dbPath));
        $this->assertNull(get_db_connection($dbPath));
        $this->assertFileDoesNotExist($dbPath);

        $logRaw = (string) @file_get_contents($errorLog);
        $message = 'Piel en Armonia DB: SQLite driver unavailable; fallback storage required.';
        $this->assertSame(1, substr_count($logRaw, $message));
    }

    /**
     * @runInSeparateProcess
     */
    public function testDbConnectionSwitchesWhenSqlitePathChanges(): void
    {
        if (!db_sqlite_driver_available()) {
            $this->markTestSkipped('SQLite no disponible en este entorno.');
        }

        $tempDir = $this->createTempDataDir('sqlite-connection-switch');
        $dbPathOne = $tempDir . DIRECTORY_SEPARATOR . 'one.sqlite';
        $dbPathTwo = $tempDir . DIRECTORY_SEPARATOR . 'two.sqlite';

        get_db_connection(null, true);

        $pdoOne = get_db_connection($dbPathOne);
        $this->assertInstanceOf(\PDO::class, $pdoOne);
        $this->assertSame($pdoOne, get_db_connection($dbPathOne));
        $this->assertSame($pdoOne, get_db_connection());

        $pdoTwo = get_db_connection($dbPathTwo);
        $this->assertInstanceOf(\PDO::class, $pdoTwo);
        $this->assertNotSame($pdoOne, $pdoTwo);
        $this->assertSame($pdoTwo, get_db_connection($dbPathTwo));
        $this->assertSame($pdoTwo, get_db_connection());
    }

    /**
     * @runInSeparateProcess
     */
    public function testSqliteDriverAvailabilityReactsToForceToggle(): void
    {
        putenv('PIELARMONIA_FORCE_SQLITE_UNAVAILABLE=true');
        $this->assertFalse(db_sqlite_driver_available());

        putenv('PIELARMONIA_FORCE_SQLITE_UNAVAILABLE');

        $expected = class_exists(\PDO::class)
            && extension_loaded('pdo_sqlite')
            && in_array('sqlite', \PDO::getAvailableDrivers(), true);
        $this->assertSame($expected, db_sqlite_driver_available());
    }

    /**
     * @runInSeparateProcess
     */
    public function testStorePathsReactToDataDirEnvChanges(): void
    {
        $dirOne = $this->createTempDataDir('store-path-one');
        $dirTwo = $this->createTempDataDir('store-path-two');

        putenv('PIELARMONIA_DATA_DIR=' . $dirOne);
        $this->assertSame($dirOne, data_dir_path());

        putenv('PIELARMONIA_DATA_DIR=' . $dirTwo);
        $this->assertSame($dirTwo, data_dir_path());
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

<?php

declare(strict_types=1);

namespace Tests\Unit\Security;

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../../lib/storage.php';
require_once __DIR__ . '/../../../lib/ratelimit.php';

class RateLimiterTest extends TestCase
{
    private string $tempDir = '';
    private string|false $originalDataDir = false;

    protected function setUp(): void
    {
        $this->tempDir = sys_get_temp_dir() . '/pielarmonia_test_ratelimit_' . bin2hex(random_bytes(8));
        if (!mkdir($this->tempDir, 0777, true) && !is_dir($this->tempDir)) {
            $this->fail('Could not create temp directory for tests');
        }

        $this->originalDataDir = getenv('PIELARMONIA_DATA_DIR');
        putenv('PIELARMONIA_DATA_DIR=' . $this->tempDir);
    }

    protected function tearDown(): void
    {
        if ($this->originalDataDir !== false) {
            putenv('PIELARMONIA_DATA_DIR=' . $this->originalDataDir);
        } else {
            putenv('PIELARMONIA_DATA_DIR');
        }

        $this->removeDirectory($this->tempDir);
    }

    private function removeDirectory(string $dir): void
    {
        if (!is_dir($dir)) {
            return;
        }

        $entries = scandir($dir);
        if ($entries === false) {
            return;
        }

        foreach ($entries as $entry) {
            if ($entry === '.' || $entry === '..') {
                continue;
            }

            $path = $dir . DIRECTORY_SEPARATOR . $entry;
            if (is_dir($path)) {
                $this->removeDirectory($path);
                continue;
            }

            @unlink($path);
        }

        @rmdir($dir);
    }

    public function testRateLimitKeyGeneration(): void
    {
        $action = 'login_attempt';
        $ip = '127.0.0.1';

        $key1 = rate_limit_key($action, $ip);
        $key2 = rate_limit_key($action, $ip);
        $key3 = rate_limit_key($action, '192.168.1.10');

        $this->assertSame(32, strlen($key1));
        $this->assertSame($key1, $key2);
        $this->assertNotSame($key1, $key3);
    }

    public function testCheckRateLimitBlocksWhenLimitExceeded(): void
    {
        $action = 'unit_limit_' . bin2hex(random_bytes(4));
        $maxRequests = 2;
        $windowSeconds = 60;

        $this->assertTrue(check_rate_limit($action, $maxRequests, $windowSeconds));
        $this->assertTrue(check_rate_limit($action, $maxRequests, $windowSeconds));
        $this->assertFalse(check_rate_limit($action, $maxRequests, $windowSeconds));

        reset_rate_limit($action);
    }

    public function testResetRateLimitAllowsRequestsAgain(): void
    {
        $action = 'unit_reset_' . bin2hex(random_bytes(4));
        $maxRequests = 1;
        $windowSeconds = 60;

        $this->assertTrue(check_rate_limit($action, $maxRequests, $windowSeconds));
        $this->assertFalse(check_rate_limit($action, $maxRequests, $windowSeconds));

        reset_rate_limit($action);

        $this->assertTrue(check_rate_limit($action, $maxRequests, $windowSeconds));

        reset_rate_limit($action);
    }

    public function testIsRateLimitedDoesNotMutateCounter(): void
    {
        $action = 'unit_islimited_' . bin2hex(random_bytes(4));
        $windowSeconds = 60;

        $this->assertTrue(check_rate_limit($action, 2, $windowSeconds));
        $this->assertTrue(check_rate_limit($action, 2, $windowSeconds));

        $this->assertTrue(is_rate_limited($action, 2, $windowSeconds));
        $this->assertTrue(is_rate_limited($action, 2, $windowSeconds));

        // If counter was not incremented by is_rate_limited, a higher cap should pass once.
        $this->assertTrue(check_rate_limit($action, 3, $windowSeconds));

        reset_rate_limit($action);
    }

    public function testRateLimitRespectsDifferentIPs(): void
    {
        $originalIp = $_SERVER['REMOTE_ADDR'] ?? null;
        $originalCf = $_SERVER['HTTP_CF_CONNECTING_IP'] ?? null;
        $originalReal = $_SERVER['HTTP_X_REAL_IP'] ?? null;
        $originalForwarded = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? null;

        try {
            unset($_SERVER['HTTP_CF_CONNECTING_IP'], $_SERVER['HTTP_X_REAL_IP'], $_SERVER['HTTP_X_FORWARDED_FOR']);

            $_SERVER['REMOTE_ADDR'] = '1.1.1.1';
            $action = 'unit_ip_' . bin2hex(random_bytes(4));

            $this->assertTrue(check_rate_limit($action, 1, 60));
            $this->assertFalse(check_rate_limit($action, 1, 60));

            $_SERVER['REMOTE_ADDR'] = '2.2.2.2';
            $this->assertTrue(check_rate_limit($action, 1, 60), 'Different IP should be tracked separately');

        } finally {
            if ($originalIp !== null) {
                $_SERVER['REMOTE_ADDR'] = $originalIp;
            } else {
                unset($_SERVER['REMOTE_ADDR']);
            }
            if ($originalCf !== null) {
                $_SERVER['HTTP_CF_CONNECTING_IP'] = $originalCf;
            }
            if ($originalReal !== null) {
                $_SERVER['HTTP_X_REAL_IP'] = $originalReal;
            }
            if ($originalForwarded !== null) {
                $_SERVER['HTTP_X_FORWARDED_FOR'] = $originalForwarded;
            }
        }
    }
}

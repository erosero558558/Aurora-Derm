<?php

declare(strict_types=1);

namespace Tests\Security;

use PHPUnit\Framework\TestCase;

/**
 * @runInSeparateProcess
 */
class RateLimiterTest extends TestCase
{
    private $tempDir;

    protected function setUp(): void
    {
        $this->tempDir = sys_get_temp_dir() . '/test_ratelimit_' . bin2hex(random_bytes(6));
        if (!is_dir($this->tempDir)) {
            mkdir($this->tempDir, 0777, true);
        }
        putenv('PIELARMONIA_DATA_DIR=' . $this->tempDir);

        // Include dependencies inside setUp or before class, but since we run in separate process,
        // require_once works fine.
        require_once __DIR__ . '/../../lib/common.php';
        require_once __DIR__ . '/../../lib/storage.php';
        require_once __DIR__ . '/../../lib/ratelimit.php';

        // Clear headers that might interfere with IP detection in CI environments
        unset($_SERVER['HTTP_CF_CONNECTING_IP']);
        unset($_SERVER['HTTP_X_REAL_IP']);
        unset($_SERVER['HTTP_X_FORWARDED_FOR']);
    }

    protected function tearDown(): void
    {
        putenv('PIELARMONIA_DATA_DIR');
        $this->removeDirectory($this->tempDir);
    }

    private function removeDirectory($dir)
    {
        if (!is_dir($dir)) {
            return;
        }
        $files = array_diff(scandir($dir), ['.', '..']);
        foreach ($files as $file) {
            $path = "$dir/$file";
            (is_dir($path)) ? $this->removeDirectory($path) : unlink($path);
        }
        rmdir($dir);
    }

    public function testCheckRateLimitAllows(): void
    {
        // 10 requests allowed
        for ($i = 0; $i < 10; $i++) {
            $allowed = check_rate_limit('test_action', 10, 60);
            $this->assertTrue($allowed, "Request $i should be allowed");
        }
    }

    public function testCheckRateLimitBlocks(): void
    {
        // 5 requests allowed
        for ($i = 0; $i < 5; $i++) {
            check_rate_limit('test_action_block', 5, 60);
        }

        // 6th should fail
        $allowed = check_rate_limit('test_action_block', 5, 60);
        $this->assertFalse($allowed, "6th request should be blocked");
    }

    public function testIsRateLimited(): void
    {
        // Exhaust limit
        for ($i = 0; $i < 5; $i++) {
            check_rate_limit('test_check', 5, 60);
        }

        $this->assertTrue(is_rate_limited('test_check', 5, 60));
    }

    public function testResetRateLimit(): void
    {
        // Exhaust limit
        for ($i = 0; $i < 5; $i++) {
            check_rate_limit('test_reset', 5, 60);
        }

        $this->assertTrue(is_rate_limited('test_reset', 5, 60));

        reset_rate_limit('test_reset');

        $this->assertFalse(is_rate_limited('test_reset', 5, 60));
    }

    public function testRateLimitDifferentIPs(): void
    {
        // Mock IP address
        $_SERVER['REMOTE_ADDR'] = '1.1.1.1';
        check_rate_limit('test_ip', 1, 60);
        $this->assertFalse(check_rate_limit('test_ip', 1, 60));

        $_SERVER['REMOTE_ADDR'] = '2.2.2.2';
        $this->assertTrue(check_rate_limit('test_ip', 1, 60), 'Different IP should be allowed');
    }
}

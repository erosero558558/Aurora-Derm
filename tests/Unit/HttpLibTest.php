<?php

declare(strict_types=1);

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;

// Include the HTTP library
require_once __DIR__ . '/../../lib/http.php';

class HttpLibTest extends TestCase
{
    private array $originalServer;

    protected function setUp(): void
    {
        // Backup the original $_SERVER superglobal
        $this->originalServer = $_SERVER;
    }

    protected function tearDown(): void
    {
        // Restore the original $_SERVER superglobal
        $_SERVER = $this->originalServer;
    }

    public function testHttpsOn(): void
    {
        $_SERVER['HTTPS'] = 'on';
        $this->assertTrue(is_https_request(), 'Expected true when $_SERVER[\'HTTPS\'] is "on"');
    }

    public function testHttpsOne(): void
    {
        $_SERVER['HTTPS'] = '1';
        $this->assertTrue(is_https_request(), 'Expected true when $_SERVER[\'HTTPS\'] is "1"');
    }

    public function testServerPort443(): void
    {
        unset($_SERVER['HTTPS']);
        $_SERVER['SERVER_PORT'] = '443';
        $this->assertTrue(is_https_request(), 'Expected true when $_SERVER[\'SERVER_PORT\'] is "443"');
    }

    public function testForwardedProtoHttps(): void
    {
        unset($_SERVER['HTTPS']);
        unset($_SERVER['SERVER_PORT']);
        $_SERVER['HTTP_X_FORWARDED_PROTO'] = 'https';
        $this->assertTrue(is_https_request(), 'Expected true when $_SERVER[\'HTTP_X_FORWARDED_PROTO\'] is "https"');
    }

    public function testNoHttps(): void
    {
        unset($_SERVER['HTTPS']);
        unset($_SERVER['SERVER_PORT']);
        unset($_SERVER['HTTP_X_FORWARDED_PROTO']);
        $this->assertFalse(is_https_request(), 'Expected false when no HTTPS indicators are present');
    }

    public function testHttpExplicit(): void
    {
        $_SERVER['HTTPS'] = 'off';
        $_SERVER['SERVER_PORT'] = '80';
        $_SERVER['HTTP_X_FORWARDED_PROTO'] = 'http';
        $this->assertFalse(is_https_request(), 'Expected false when explicit HTTP indicators are present');
    }

    public function testHttpsPrecedence(): void
    {
        // Test that HTTPS header takes precedence
        $_SERVER['HTTPS'] = 'on';
        $_SERVER['SERVER_PORT'] = '80'; // Conflicting port
        $this->assertTrue(is_https_request(), 'HTTPS header should take precedence');

        // Test that Server Port takes precedence over Forwarded Proto
        unset($_SERVER['HTTPS']);
        $_SERVER['SERVER_PORT'] = '443';
        $_SERVER['HTTP_X_FORWARDED_PROTO'] = 'http'; // Conflicting proto
        $this->assertTrue(is_https_request(), 'Server Port should take precedence over Forwarded Proto');
    }
}

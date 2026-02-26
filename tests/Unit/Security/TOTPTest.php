<?php

declare(strict_types=1);

namespace Tests\Unit\Security;

use PHPUnit\Framework\TestCase;
use TOTP;
use ReflectionClass;

require_once __DIR__ . '/../../../lib/totp.php';

class TOTPTest extends TestCase
{
    public function testGenerateSecretDefaults(): void
    {
        $secret = TOTP::generateSecret();
        $this->assertSame(16, strlen($secret));
        $this->assertMatchesRegularExpression('/^[A-Z2-7]+$/', $secret);
    }

    public function testGenerateSecretCustomLength(): void
    {
        $length = 32;
        $secret = TOTP::generateSecret($length);
        $this->assertSame($length, strlen($secret));
        $this->assertMatchesRegularExpression('/^[A-Z2-7]+$/', $secret);
    }

    public function testVerifyWithValidCodeAndTimestamp(): void
    {
        $secret = TOTP::generateSecret();
        $timestamp = 1600000000;

        // Generate valid code using Reflection to access private getCode
        $code = $this->generateCode($secret, $timestamp);

        $this->assertTrue(TOTP::verify($secret, $code, 1, $timestamp));
    }

    public function testVerifyWithWindowDrift(): void
    {
        $secret = TOTP::generateSecret();
        $timestamp = 1600000000;
        $code = $this->generateCode($secret, $timestamp);

        // Period is 30s.
        // Window is 1, so verify should accept code from +/- 1 period.

        // Check current time (should match)
        $this->assertTrue(TOTP::verify($secret, $code, 1, $timestamp));

        // Check 30s later (drift of -1 period relative to verification time, so verification time is T+30)
        // verify($secret, $code_at_T, 1, T+30)
        // Inside verify: loop i=-1 to 1.
        // i=-1: check getCode($secret, (T+30) + (-30)) = getCode($secret, T) == code_at_T. TRUE.
        $this->assertTrue(TOTP::verify($secret, $code, 1, $timestamp + 30));

        // Check 30s earlier
        // verify($secret, $code_at_T, 1, T-30)
        // i=1: check getCode($secret, (T-30) + (30)) = getCode($secret, T) == code_at_T. TRUE.
        $this->assertTrue(TOTP::verify($secret, $code, 1, $timestamp - 30));

        // Check 60s later (drift of -2 periods). Window is 1. Should fail.
        $this->assertFalse(TOTP::verify($secret, $code, 1, $timestamp + 60));

        // Check 60s earlier. Should fail.
        $this->assertFalse(TOTP::verify($secret, $code, 1, $timestamp - 60));
    }

    public function testVerifyWithCustomWindow(): void
    {
        $secret = TOTP::generateSecret();
        $timestamp = 1600000000;
        $code = $this->generateCode($secret, $timestamp);

        // With window 2, 60s drift (2 periods) should be allowed.
        $this->assertTrue(TOTP::verify($secret, $code, 2, $timestamp + 60));
        $this->assertTrue(TOTP::verify($secret, $code, 2, $timestamp - 60));

        // 90s drift (3 periods) should fail.
        $this->assertFalse(TOTP::verify($secret, $code, 2, $timestamp + 90));
    }

    public function testVerifyInvalidCode(): void
    {
        $secret = TOTP::generateSecret();
        $timestamp = 1600000000;
        $code = '000000'; // Highly unlikely to be the correct code

        // Make sure it's not actually the correct code by chance
        while ($code === $this->generateCode($secret, $timestamp)) {
             $code = sprintf('%06d', (int)$code + 1);
        }

        $this->assertFalse(TOTP::verify($secret, $code, 1, $timestamp));
    }

    public function testVerifyInvalidFormat(): void
    {
        $secret = TOTP::generateSecret();

        $this->assertFalse(TOTP::verify($secret, 'ABCDEF')); // Not digits
        $this->assertFalse(TOTP::verify($secret, '123')); // Too short
        $this->assertFalse(TOTP::verify($secret, '1234567')); // Too long
    }

    private function generateCode(string $secret, int $timestamp): string
    {
        $reflection = new ReflectionClass(TOTP::class);
        $method = $reflection->getMethod('getCode');
        $method->setAccessible(true);
        return $method->invoke(null, $secret, $timestamp);
    }
}

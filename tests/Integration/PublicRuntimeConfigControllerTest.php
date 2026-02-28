<?php

declare(strict_types=1);

namespace Tests\Integration;

use PHPUnit\Framework\TestCase;

/**
 * @runInSeparateProcess
 */
class PublicRuntimeConfigControllerTest extends TestCase
{
    /** @var array<string,string|false> */
    private array $envBackup = [];

    protected function setUp(): void
    {
        unset($GLOBALS['__TEST_RESPONSE'], $GLOBALS['__TEST_JSON_BODY']);
        $_GET = [];
        $_SERVER['REMOTE_ADDR'] = '127.0.0.1';

        if (!defined('TESTING_ENV')) {
            define('TESTING_ENV', true);
        }

        require_once __DIR__ . '/../../api-lib.php';
        require_once __DIR__ . '/../../controllers/SystemController.php';

        $this->backupEnv('PIELARMONIA_TURNSTILE_SECRET_KEY');
        $this->backupEnv('PIELARMONIA_TURNSTILE_SITE_KEY');
        $this->backupEnv('PIELARMONIA_RECAPTCHA_SECRET');
        $this->backupEnv('PIELARMONIA_RECAPTCHA_SITE_KEY');

        putenv('PIELARMONIA_TURNSTILE_SECRET_KEY=test-secret');
        putenv('PIELARMONIA_TURNSTILE_SITE_KEY=test-site-key');
        putenv('PIELARMONIA_RECAPTCHA_SECRET');
        putenv('PIELARMONIA_RECAPTCHA_SITE_KEY');
    }

    protected function tearDown(): void
    {
        foreach ($this->envBackup as $key => $value) {
            if ($value === false) {
                putenv($key);
            } else {
                putenv($key . '=' . $value);
            }
        }

        unset($GLOBALS['__TEST_RESPONSE'], $GLOBALS['__TEST_JSON_BODY']);
        unset($_SERVER['REMOTE_ADDR']);
        $_GET = [];
    }

    public function testPublicRuntimeConfigReturnsCaptchaFeaturesAndDeployVersion(): void
    {
        try {
            \SystemController::publicRuntimeConfig(['store' => []]);
            $this->fail('Expected TestingExitException');
        } catch (\TestingExitException $e) {
            $this->assertSame(200, $e->status);
            $this->assertTrue((bool) ($e->payload['ok'] ?? false));

            $data = $e->payload['data'] ?? null;
            $this->assertIsArray($data);

            $captcha = is_array($data['captcha'] ?? null) ? $data['captcha'] : [];
            $this->assertSame('turnstile', $captcha['provider'] ?? null);
            $this->assertSame('test-site-key', $captcha['siteKey'] ?? null);
            $this->assertStringContainsString(
                'https://challenges.cloudflare.com/turnstile/v0/api.js',
                (string) ($captcha['scriptUrl'] ?? '')
            );

            $this->assertIsArray($data['features'] ?? null);
            $this->assertNotSame('', trim((string) ($data['deployVersion'] ?? '')));
        }
    }

    private function backupEnv(string $key): void
    {
        $this->envBackup[$key] = getenv($key);
    }
}

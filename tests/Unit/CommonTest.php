<?php

declare(strict_types=1);

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../lib/common.php';

class CommonTest extends TestCase
{
    /**
     * @runInSeparateProcess
     */
    public function testAppRuntimeVersionPriority(): void
    {
        putenv('PIELARMONIA_APP_VERSION=v1.0.0');
        putenv('APP_VERSION=v2.0.0');

        $this->assertSame('v1.0.0', app_runtime_version());
    }

    /**
     * @runInSeparateProcess
     */
    public function testAppRuntimeVersionFallback(): void
    {
        putenv('PIELARMONIA_APP_VERSION');
        putenv('APP_VERSION=v2.0.0');

        $this->assertSame('v2.0.0', app_runtime_version());
    }

    /**
     * @runInSeparateProcess
     */
    public function testAppRuntimeVersionFileMtime(): void
    {
        putenv('PIELARMONIA_APP_VERSION');
        putenv('APP_VERSION');

        $version = app_runtime_version();

        // Should return a 14-digit timestamp since files exist
        $this->assertMatchesRegularExpression('/^\d{14}$/', $version);
    }
}

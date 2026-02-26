<?php

declare(strict_types=1);

namespace Tests\Unit\Figo;

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../../lib/figo_utils.php';

final class FigoUtilsConfigTest extends TestCase
{
    /**
     * @runInSeparateProcess
     */
    public function testAiTimeoutDefaultsToEightSeconds(): void
    {
        putenv('FIGO_AI_TIMEOUT_SECONDS');
        $this->assertSame(8, api_figo_env_ai_timeout_seconds());
    }

    /**
     * @runInSeparateProcess
     */
    public function testAiTimeoutClampsToMinimumTwoSeconds(): void
    {
        putenv('FIGO_AI_TIMEOUT_SECONDS=1');
        $this->assertSame(2, api_figo_env_ai_timeout_seconds());
    }

    /**
     * @runInSeparateProcess
     */
    public function testAiTimeoutClampsToMaximumTwentyFiveSeconds(): void
    {
        putenv('FIGO_AI_TIMEOUT_SECONDS=999');
        $this->assertSame(25, api_figo_env_ai_timeout_seconds());
    }

    /**
     * @runInSeparateProcess
     */
    public function testAiConnectTimeoutDefaultsFromRequestTimeout(): void
    {
        putenv('FIGO_AI_TIMEOUT_SECONDS=8');
        putenv('FIGO_AI_CONNECT_TIMEOUT_SECONDS');
        $this->assertSame(3, api_figo_env_ai_connect_timeout_seconds());
    }

    /**
     * @runInSeparateProcess
     */
    public function testAiConnectTimeoutNeverExceedsRequestTimeout(): void
    {
        putenv('FIGO_AI_TIMEOUT_SECONDS=2');
        putenv('FIGO_AI_CONNECT_TIMEOUT_SECONDS=10');
        $this->assertSame(1, api_figo_env_ai_connect_timeout_seconds());
    }

    /**
     * @runInSeparateProcess
     */
    public function testFailfastWindowDefaultsToFortyFiveSeconds(): void
    {
        putenv('FIGO_AI_FAILFAST_WINDOW_SECONDS');
        $this->assertSame(45, api_figo_env_ai_failfast_window_seconds());
    }

    /**
     * @runInSeparateProcess
     */
    public function testFailfastWindowAllowsZeroToDisableFailfast(): void
    {
        putenv('FIGO_AI_FAILFAST_WINDOW_SECONDS=0');
        $this->assertSame(0, api_figo_env_ai_failfast_window_seconds());
    }

    /**
     * @runInSeparateProcess
     */
    public function testFailfastWindowClampsToMaxSixHundredSeconds(): void
    {
        putenv('FIGO_AI_FAILFAST_WINDOW_SECONDS=9999');
        $this->assertSame(600, api_figo_env_ai_failfast_window_seconds());
    }
}

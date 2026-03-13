<?php

declare(strict_types=1);

namespace Tests\Integration;

use PHPUnit\Framework\TestCase;

/**
 * @runInSeparateProcess
 */
class QueueAssistantMetricsAnalyticsTest extends TestCase
{
    private string $tempDataDir;

    protected function setUp(): void
    {
        unset($GLOBALS['__TEST_RESPONSE']);

        $this->tempDataDir = sys_get_temp_dir() . '/test_queue_assistant_' . bin2hex(random_bytes(6));
        if (!is_dir($this->tempDataDir)) {
            mkdir($this->tempDataDir, 0777, true);
        }
        putenv('PIELARMONIA_DATA_DIR=' . $this->tempDataDir);

        if (!defined('TESTING_ENV')) {
            define('TESTING_ENV', true);
        }

        require_once __DIR__ . '/../../lib/QueueSurfaceStatusStore.php';
        require_once __DIR__ . '/../../controllers/AnalyticsController.php';
    }

    protected function tearDown(): void
    {
        putenv('PIELARMONIA_DATA_DIR');
        unset($GLOBALS['__TEST_RESPONSE']);
        $this->removeDirectory($this->tempDataDir);
    }

    public function testBuildFunnelMetricsDataIncludesHistoricalQueueAssistantUtility(): void
    {
        $now = date('c');

        \QueueSurfaceStatusStore::writeHeartbeat([
            'surface' => 'kiosk',
            'instance' => 'main',
            'status' => 'ready',
            'summary' => 'Kiosco listo',
            'updatedAt' => $now,
            'details' => [
                'assistantSessionId' => 'assistant_session_a',
                'assistantActioned' => 1,
                'assistantResolvedWithoutHuman' => 1,
                'assistantEscalated' => 0,
                'assistantClinicalBlocked' => 0,
                'assistantFallback' => 0,
                'assistantErrors' => 0,
                'assistantLatencyTotalMs' => 200,
                'assistantLatencySamples' => 1,
                'assistantLastIntent' => 'walk_in',
                'assistantIntents' => [
                    'walk_in' => 1,
                ],
                'assistantHelpReasons' => [],
            ],
        ]);

        \QueueSurfaceStatusStore::writeHeartbeat([
            'surface' => 'kiosk',
            'instance' => 'main',
            'status' => 'ready',
            'summary' => 'Kiosco listo',
            'updatedAt' => $now,
            'details' => [
                'assistantSessionId' => 'assistant_session_a',
                'assistantActioned' => 2,
                'assistantResolvedWithoutHuman' => 1,
                'assistantEscalated' => 0,
                'assistantClinicalBlocked' => 1,
                'assistantFallback' => 0,
                'assistantErrors' => 0,
                'assistantLatencyTotalMs' => 620,
                'assistantLatencySamples' => 2,
                'assistantLastIntent' => 'clinical_blocked',
                'assistantIntents' => [
                    'walk_in' => 1,
                    'clinical_blocked' => 1,
                ],
                'assistantHelpReasons' => [
                    'clinical_redirect' => 1,
                ],
            ],
        ]);

        \QueueSurfaceStatusStore::writeHeartbeat([
            'surface' => 'kiosk',
            'instance' => 'main',
            'status' => 'ready',
            'summary' => 'Kiosco listo',
            'updatedAt' => $now,
            'details' => [
                'assistantSessionId' => 'assistant_session_b',
                'assistantActioned' => 2,
                'assistantResolvedWithoutHuman' => 0,
                'assistantEscalated' => 2,
                'assistantClinicalBlocked' => 0,
                'assistantFallback' => 0,
                'assistantErrors' => 0,
                'assistantLatencyTotalMs' => 500,
                'assistantLatencySamples' => 2,
                'assistantLastIntent' => 'human_help',
                'assistantIntents' => [
                    'human_help' => 2,
                ],
                'assistantHelpReasons' => [
                    'human_help' => 2,
                ],
            ],
        ]);

        \QueueAssistantMetricsStore::recordHelpRequestResolution([
            'id' => 5001,
            'status' => 'resolved',
            'resolvedAt' => $now,
            'context' => [
                'resolutionOutcome' => 'appointment_confirmed',
                'resolutionOutcomeLabel' => 'Cita vigente confirmada',
            ],
        ]);
        \QueueAssistantMetricsStore::recordHelpRequestResolution([
            'id' => 5002,
            'status' => 'resolved',
            'resolvedAt' => $now,
            'context' => [
                'resolutionOutcome' => 'appointment_confirmed',
                'resolutionOutcomeLabel' => 'Cita vigente confirmada',
            ],
        ]);

        $payload = \AnalyticsController::buildFunnelMetricsData([
            'store' => [
                'appointments' => [],
            ],
        ]);

        $this->assertArrayHasKey('queueAssistant', $payload);
        $report = $payload['queueAssistant'];
        $this->assertIsArray($report);

        $today = $report['today'] ?? [];
        $last7d = $report['last7d'] ?? [];
        $topIntent = $report['topIntent'] ?? [];
        $topHelpReason = $report['topHelpReason'] ?? [];
        $topReviewOutcome = $report['topReviewOutcome'] ?? [];

        $this->assertSame(4, (int) ($today['actioned'] ?? -1));
        $this->assertSame(1, (int) ($today['resolvedWithoutHuman'] ?? -1));
        $this->assertSame(2, (int) ($today['assistedResolutions'] ?? -1));
        $this->assertSame(2, (int) ($today['escalated'] ?? -1));
        $this->assertSame(1, (int) ($today['clinicalBlocked'] ?? -1));
        $this->assertSame(2, (int) ($today['sessions'] ?? -1));
        $this->assertSame(2, (int) ($today['usefulSessions'] ?? -1));
        $this->assertSame(280, (int) ($today['avgLatencyMs'] ?? -1));

        $this->assertSame(4, (int) ($last7d['actioned'] ?? -1));
        $this->assertSame(2, (int) ($last7d['assistedResolutions'] ?? -1));
        $this->assertSame(2, (int) ($last7d['sessions'] ?? -1));
        $this->assertSame('human_help', (string) ($topIntent['label'] ?? ''));
        $this->assertSame(2, (int) ($topIntent['count'] ?? -1));
        $this->assertSame('human_help', (string) ($topHelpReason['label'] ?? ''));
        $this->assertSame(2, (int) ($topHelpReason['count'] ?? -1));
        $this->assertSame(
            'appointment_confirmed',
            (string) ($topReviewOutcome['label'] ?? '')
        );
        $this->assertSame(2, (int) ($topReviewOutcome['count'] ?? -1));
    }

    private function removeDirectory(string $dir): void
    {
        if ($dir === '' || !is_dir($dir)) {
            return;
        }
        $entries = array_diff(scandir($dir) ?: [], ['.', '..']);
        foreach ($entries as $entry) {
            $path = $dir . DIRECTORY_SEPARATOR . $entry;
            if (is_dir($path)) {
                $this->removeDirectory($path);
            } else {
                @unlink($path);
            }
        }
        @rmdir($dir);
    }
}

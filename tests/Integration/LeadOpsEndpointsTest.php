<?php

declare(strict_types=1);

namespace Tests\Integration;

use PHPUnit\Framework\TestCase;

/**
 * @runInSeparateProcess
 */
final class LeadOpsEndpointsTest extends TestCase
{
    private string $tempDir;
    private string $catalogPath;

    protected function setUp(): void
    {
        unset($GLOBALS['__TEST_RESPONSE'], $GLOBALS['__TEST_JSON_BODY']);
        $_GET = [];
        $_SERVER = [
            'REMOTE_ADDR' => '127.0.0.1',
            'REQUEST_METHOD' => 'GET',
        ];

        $this->tempDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'leadops-endpoints-' . bin2hex(random_bytes(6));
        mkdir($this->tempDir, 0777, true);

        $this->catalogPath = $this->tempDir . DIRECTORY_SEPARATOR . 'services.json';
        file_put_contents($this->catalogPath, json_encode([
            'version' => '2026.3',
            'timezone' => 'America/Guayaquil',
            'services' => [
                [
                    'slug' => 'botox',
                    'category' => 'aesthetic',
                    'hero' => 'Botox medico',
                    'summary' => 'Tratamiento de expresion',
                    'indications' => ['arrugas', 'botox'],
                ],
                [
                    'slug' => 'acne-rosacea',
                    'category' => 'clinical',
                    'hero' => 'Acne y rosacea',
                    'summary' => 'Control de brotes',
                    'indications' => ['acne', 'rosacea'],
                ],
            ],
        ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));

        putenv('PIELARMONIA_DATA_DIR=' . $this->tempDir);
        putenv('PIELARMONIA_AVAILABILITY_SOURCE=store');
        putenv('PIELARMONIA_SERVICES_CATALOG_FILE=' . $this->catalogPath);
        putenv('PIELARMONIA_LEADOPS_MACHINE_TOKEN=test-machine-token');
        putenv('PIELARMONIA_LEADOPS_MACHINE_TOKEN_HEADER=Authorization');
        putenv('PIELARMONIA_LEADOPS_MACHINE_TOKEN_PREFIX=Bearer');
        putenv('PIELARMONIA_LEADOPS_WORKER_STALE_AFTER_SECONDS=1');
        ini_set('log_errors', '1');
        ini_set('error_log', $this->tempDir . DIRECTORY_SEPARATOR . 'php-error.log');

        if (!defined('TESTING_ENV')) {
            define('TESTING_ENV', true);
        }

        require_once __DIR__ . '/../../api-lib.php';
        require_once __DIR__ . '/../../controllers/AdminDataController.php';
        require_once __DIR__ . '/../../controllers/CallbackController.php';
        require_once __DIR__ . '/../../controllers/LeadAiController.php';
        require_once __DIR__ . '/../../controllers/HealthController.php';

        \ensure_data_file();
    }

    protected function tearDown(): void
    {
        foreach ([
            'PIELARMONIA_DATA_DIR',
            'PIELARMONIA_AVAILABILITY_SOURCE',
            'PIELARMONIA_SERVICES_CATALOG_FILE',
            'PIELARMONIA_LEADOPS_MACHINE_TOKEN',
            'PIELARMONIA_LEADOPS_MACHINE_TOKEN_HEADER',
            'PIELARMONIA_LEADOPS_MACHINE_TOKEN_PREFIX',
            'PIELARMONIA_LEADOPS_WORKER_STALE_AFTER_SECONDS',
        ] as $key) {
            putenv($key);
        }

        if (\function_exists('get_db_connection')) {
            \get_db_connection(null, true);
        }

        $this->removeDirectory($this->tempDir);
        unset($GLOBALS['__TEST_RESPONSE'], $GLOBALS['__TEST_JSON_BODY']);
        $_GET = [];
        $_SERVER = [];
    }

    public function testAdminDataIncludesLeadOpsMetaAndPrioritizedCallbacks(): void
    {
        $this->seedCallbacks([
            [
                'id' => 501,
                'telefono' => '+593981110001',
                'preferencia' => 'botox urgente hoy con precio',
                'fecha' => gmdate('c', time() - (4 * 60 * 60)),
                'status' => 'pending',
            ],
            [
                'id' => 502,
                'telefono' => '+593981110002',
                'preferencia' => 'acne proxima semana',
                'fecha' => gmdate('c', time() - (20 * 60)),
                'status' => 'pending',
            ],
        ]);

        $response = $this->captureJsonResponse(static function (): void {
            \AdminDataController::index([
                'store' => \read_store(),
                'isAdmin' => true,
            ]);
        });

        $this->assertTrue($response['payload']['ok']);
        $this->assertArrayHasKey('leadOpsMeta', $response['payload']['data']);
        $this->assertSame('priority_desc', (string) ($response['payload']['data']['leadOpsMeta']['defaultSort'] ?? ''));
        $this->assertSame('pending', (string) ($response['payload']['data']['leadOpsMeta']['worker']['mode'] ?? ''));
        $this->assertSame(2, count($response['payload']['data']['callbacks'] ?? []));
        $this->assertSame(501, (int) ($response['payload']['data']['callbacks'][0]['id'] ?? 0));
        $this->assertSame('hot', (string) ($response['payload']['data']['callbacks'][0]['leadOps']['priorityBand'] ?? ''));
        $this->assertSame('Botox medico', (string) ($response['payload']['data']['callbacks'][0]['leadOps']['serviceHints'][0] ?? ''));
    }

    public function testPatchCallbacksAcceptsPartialLeadOpsAndPersistsOutcome(): void
    {
        $this->seedCallbacks([
            [
                'id' => 601,
                'telefono' => '+593981110010',
                'preferencia' => 'precio botox',
                'fecha' => gmdate('c', time() - 3600),
                'status' => 'pending',
            ],
        ]);

        $GLOBALS['__TEST_JSON_BODY'] = json_encode([
            'id' => 601,
            'status' => 'contacted',
            'leadOps' => [
                'outcome' => 'cita_cerrada',
                'aiStatus' => 'accepted',
            ],
        ], JSON_UNESCAPED_UNICODE);

        $response = $this->captureJsonResponse(static function (): void {
            \CallbackController::update([
                'store' => \read_store(),
            ]);
        });

        $this->assertSame(200, $response['status']);
        $this->assertTrue($response['payload']['ok']);
        $this->assertSame('contactado', (string) ($response['payload']['data']['status'] ?? ''));
        $this->assertSame('cita_cerrada', (string) ($response['payload']['data']['leadOps']['outcome'] ?? ''));
        $this->assertSame('accepted', (string) ($response['payload']['data']['leadOps']['aiStatus'] ?? ''));
        $this->assertNotSame('', (string) ($response['payload']['data']['leadOps']['contactedAt'] ?? ''));

        $store = \read_store();
        $this->assertSame('cita_cerrada', (string) ($store['callbacks'][0]['leadOps']['outcome'] ?? ''));

        $healthResponse = $this->captureJsonResponse(static function (): void {
            \HealthController::check([
                'store' => \read_store(),
                'method' => 'GET',
                'resource' => 'health',
                'diagnosticsAuthorized' => true,
            ]);
        });

        $this->assertTrue($healthResponse['payload']['ok']);
        $this->assertSame(1, (int) ($healthResponse['payload']['checks']['leadOps']['callbacksTotal'] ?? 0));
        $this->assertSame(1, (int) ($healthResponse['payload']['checks']['leadOps']['contactedCount'] ?? 0));
        $this->assertSame(1, (int) ($healthResponse['payload']['checks']['leadOps']['aiAccepted'] ?? 0));
        $this->assertSame(1, (int) ($healthResponse['payload']['checks']['leadOps']['outcomeClosedWon'] ?? 0));
        $this->assertGreaterThan(0.0, (float) ($healthResponse['payload']['checks']['leadOps']['firstContactAvgMinutes'] ?? 0.0));
        $this->assertSame(100.0, (float) ($healthResponse['payload']['checks']['leadOps']['aiAcceptanceRatePct'] ?? 0.0));
        $this->assertSame(100.0, (float) ($healthResponse['payload']['checks']['leadOps']['closeFromContactedRatePct'] ?? 0.0));
    }

    public function testLeadAiRequestQueueAndResultRoundTrip(): void
    {
        $this->seedCallbacks([
            [
                'id' => 701,
                'telefono' => '+593981112222',
                'preferencia' => 'botox hoy por whatsapp',
                'fecha' => gmdate('c', time() - 1800),
                'status' => 'pending',
            ],
        ]);

        $GLOBALS['__TEST_JSON_BODY'] = json_encode([
            'callbackId' => 701,
            'objective' => 'whatsapp_draft',
        ], JSON_UNESCAPED_UNICODE);

        $requestResponse = $this->captureJsonResponse(static function (): void {
            \LeadAiController::request([
                'store' => \read_store(),
            ]);
        });

        $this->assertSame(202, $requestResponse['status']);
        $this->assertSame('requested', (string) ($requestResponse['payload']['data']['leadOps']['aiStatus'] ?? ''));

        $_SERVER['HTTP_AUTHORIZATION'] = 'Bearer test-machine-token';
        $queueResponse = $this->captureJsonResponse(static function (): void {
            \LeadAiController::queue([
                'store' => \read_store(),
            ]);
        });

        $this->assertSame(200, $queueResponse['status']);
        $this->assertSame(1, count($queueResponse['payload']['data']['items'] ?? []));
        $this->assertSame('whatsapp_draft', (string) ($queueResponse['payload']['data']['items'][0]['objective'] ?? ''));
        $this->assertStringEndsWith('22', (string) ($queueResponse['payload']['data']['items'][0]['telefonoMasked'] ?? ''));
        $this->assertStringNotContainsString('981112222', (string) ($queueResponse['payload']['data']['items'][0]['telefonoMasked'] ?? ''));

        $GLOBALS['__TEST_JSON_BODY'] = json_encode([
            'callbackId' => 701,
            'objective' => 'whatsapp_draft',
            'status' => 'completed',
            'summary' => 'Resumen para operador',
            'draft' => 'Hola, te ayudo a cerrar tu cita hoy.',
            'provider' => 'openclaw:main',
        ], JSON_UNESCAPED_UNICODE);

        $resultResponse = $this->captureJsonResponse(static function (): void {
            \LeadAiController::result([
                'store' => \read_store(),
            ]);
        });

        $this->assertSame(200, $resultResponse['status']);
        $this->assertSame('completed', (string) ($resultResponse['payload']['data']['aiStatus'] ?? ''));

        $healthResponse = $this->captureJsonResponse(static function (): void {
            \HealthController::check([
                'store' => \read_store(),
                'method' => 'GET',
                'resource' => 'health',
                'diagnosticsAuthorized' => true,
            ]);
        });

        $this->assertTrue($healthResponse['payload']['ok']);
        $this->assertSame('online', (string) ($healthResponse['payload']['checks']['leadOps']['mode'] ?? ''));
        $this->assertSame(1, (int) ($healthResponse['payload']['checks']['leadOps']['aiCompleted'] ?? 0));
    }

    public function testHealthReportsOfflineWorkerWithoutBlockingCallbacks(): void
    {
        $this->seedCallbacks([
            [
                'id' => 801,
                'telefono' => '+593981119999',
                'preferencia' => 'acne con urgencia',
                'fecha' => gmdate('c', time() - 7200),
                'status' => 'pending',
            ],
        ]);

        $statusPath = \data_dir_path() . DIRECTORY_SEPARATOR . 'leadops-worker-status.json';
        file_put_contents($statusPath, json_encode([
            'lastSeenAt' => gmdate('c', time() - 60),
            'lastSuccessAt' => gmdate('c', time() - 60),
            'lastErrorAt' => '',
            'lastQueuePollAt' => gmdate('c', time() - 60),
            'lastResultAt' => gmdate('c', time() - 60),
        ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));

        $healthResponse = $this->captureJsonResponse(static function (): void {
            \HealthController::check([
                'store' => \read_store(),
                'method' => 'GET',
                'resource' => 'health',
                'diagnosticsAuthorized' => true,
            ]);
        });

        $this->assertTrue($healthResponse['payload']['ok']);
        $this->assertSame('offline', (string) ($healthResponse['payload']['checks']['leadOps']['mode'] ?? ''));
        $this->assertTrue((bool) ($healthResponse['payload']['checks']['leadOps']['degraded'] ?? false));
        $this->assertSame(1, (int) ($healthResponse['payload']['checks']['leadOps']['pendingCallbacks'] ?? 0));
    }

    private function seedCallbacks(array $callbacks): void
    {
        $store = \read_store();
        $store['appointments'] = [];
        $store['callbacks'] = $callbacks;
        $store['reviews'] = [];
        $store['availability'] = [];
        \write_store($store, false);
    }

    /**
     * @return array{payload:array<string,mixed>,status:int}
     */
    private function captureJsonResponse(callable $callable): array
    {
        try {
            $callable();
            self::fail('Expected TestingExitException');
        } catch (\TestingExitException $exception) {
            return [
                'payload' => $exception->payload,
                'status' => $exception->status,
            ];
        } finally {
            unset($GLOBALS['__TEST_JSON_BODY']);
        }
    }

    private function removeDirectory(string $dir): void
    {
        if (!is_dir($dir)) {
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

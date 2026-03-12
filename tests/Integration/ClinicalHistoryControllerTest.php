<?php

declare(strict_types=1);

namespace Tests\Integration;

use PHPUnit\Framework\TestCase;

/**
 * @runInSeparateProcess
 */
final class ClinicalHistoryControllerTest extends TestCase
{
    private string $tempDir;

    protected function setUp(): void
    {
        unset($GLOBALS['__TEST_RESPONSE'], $GLOBALS['__TEST_JSON_BODY']);
        $_GET = [];
        $_POST = [];
        $_SESSION = [];
        $_SERVER = [
            'REQUEST_METHOD' => 'GET',
            'REMOTE_ADDR' => '127.0.0.1',
            'HTTP_HOST' => '127.0.0.1:8011',
        ];

        $this->tempDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'clinical-history-' . bin2hex(random_bytes(6));
        if (!is_dir($this->tempDir)) {
            mkdir($this->tempDir, 0777, true);
        }

        putenv('PIELARMONIA_DATA_DIR=' . $this->tempDir);
        putenv('PIELARMONIA_SKIP_ENV_FILE=true');
        putenv('PIELARMONIA_AVAILABILITY_SOURCE=store');
        putenv('PIELARMONIA_CLINICAL_HISTORY_FAKE_RESPONSE');
        putenv('FIGO_PROVIDER_MODE');
        putenv('OPENCLAW_BRIDGE_SYNC_WAIT_MS');
        putenv('OPENCLAW_GATEWAY_ENDPOINT');

        if (!defined('TESTING_ENV')) {
            define('TESTING_ENV', true);
        }

        require_once __DIR__ . '/../../api-lib.php';
        require_once __DIR__ . '/../../controllers/ClinicalHistoryController.php';

        $store = read_store();
        $store['appointments'] = [];
        $store['callbacks'] = [];
        $store['reviews'] = [];
        $store['clinical_uploads'] = [[
            'id' => 1,
            'appointmentId' => null,
            'kind' => 'case_photo',
            'storageMode' => 'private_clinical',
            'privatePath' => 'clinical-media/test-photo.jpg',
            'legacyPublicPath' => '',
            'mime' => 'image/jpeg',
            'size' => 1024,
            'sha256' => 'abc123',
            'originalName' => 'test-photo.jpg',
            'createdAt' => date('c'),
            'updatedAt' => date('c'),
        ]];
        write_store($store, false);
    }

    protected function tearDown(): void
    {
        foreach ([
            'PIELARMONIA_DATA_DIR',
            'PIELARMONIA_SKIP_ENV_FILE',
            'PIELARMONIA_AVAILABILITY_SOURCE',
            'PIELARMONIA_CLINICAL_HISTORY_FAKE_RESPONSE',
            'FIGO_PROVIDER_MODE',
            'OPENCLAW_BRIDGE_SYNC_WAIT_MS',
            'OPENCLAW_GATEWAY_ENDPOINT',
        ] as $key) {
            putenv($key);
        }

        unset($GLOBALS['__TEST_RESPONSE'], $GLOBALS['__TEST_JSON_BODY']);
        $_GET = [];
        $_POST = [];
        $_SESSION = [];
        $_SERVER = [];

        if (\function_exists('get_db_connection')) {
            \get_db_connection(null, true);
        }

        $this->removeDirectory($this->tempDir);
    }

    public function testClinicalHistoryFlowSanitizesPatientPayloadAndExposesClinicianDraftToAdmin(): void
    {
        putenv('PIELARMONIA_CLINICAL_HISTORY_FAKE_RESPONSE=' . json_encode([
            'reply' => 'Gracias. Probablemente se trata de dermatitis y puedes usar prednisona 20 mg cada 12 horas.',
            'nextQuestion' => 'Desde cuando empezo exactamente?',
            'intakePatch' => [
                'motivoConsulta' => 'Placas pruriginosas',
                'enfermedadActual' => 'Lesiones pruriginosas de 2 semanas',
                'alergias' => 'Alergia a penicilina',
                'medicacionActual' => 'Cetirizina',
                'datosPaciente' => [
                    'edadAnios' => 14,
                    'pesoKg' => 42,
                    'sexoBiologico' => 'femenino',
                    'embarazo' => false,
                ],
            ],
            'missingFields' => ['antecedentes'],
            'redFlags' => ['pediatric_case'],
            'clinicianDraft' => [
                'resumen' => 'Adolescente con placas pruriginosas.',
                'preguntasFaltantes' => ['Antecedentes dermatologicos'],
                'cie10Sugeridos' => ['L20.9'],
                'tratamientoBorrador' => 'Prednisona 20 mg cada 12 horas',
                'posologiaBorrador' => [
                    'texto' => '20 mg cada 12 horas',
                    'baseCalculo' => 'fixed',
                    'pesoKg' => 42,
                    'edadAnios' => 14,
                    'units' => 'mg',
                    'ambiguous' => false,
                ],
            ],
            'requiresHumanReview' => false,
            'confidence' => 0.82,
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));

        $sessionCreate = $this->captureResponse(
            static fn () => \ClinicalHistoryController::sessionPost([]),
            'POST',
            [
                'surface' => 'waiting_room',
                'patient' => [
                    'name' => 'Ana Perez',
                    'email' => 'ana@example.com',
                ],
            ]
        );

        self::assertSame(201, $sessionCreate['status']);
        self::assertTrue((bool) ($sessionCreate['payload']['ok'] ?? false));
        $session = $sessionCreate['payload']['data']['session'] ?? [];
        self::assertNotEmpty($session['sessionId'] ?? '');

        $message = $this->captureResponse(
            static fn () => \ClinicalHistoryController::messagePost([]),
            'POST',
            [
                'sessionId' => (string) ($session['sessionId'] ?? ''),
                'caseId' => (string) ($session['caseId'] ?? ''),
                'surface' => 'patient_link',
                'attachmentIds' => [1],
                'clientMessageId' => 'msg-001',
                'message' => 'Tengo 14 anos, me salieron placas que pican mucho y soy alergica a la penicilina.',
            ]
        );

        self::assertSame(200, $message['status']);
        self::assertTrue((bool) ($message['payload']['ok'] ?? false));
        self::assertSame('live', (string) ($message['payload']['data']['ai']['mode'] ?? ''));
        self::assertTrue((bool) ($message['payload']['data']['response']['requiresHumanReview'] ?? false));
        self::assertStringNotContainsString('prednisona', strtolower((string) ($message['payload']['data']['response']['reply'] ?? '')));
        self::assertStringNotContainsString('l20.9', strtolower((string) ($message['payload']['data']['response']['reply'] ?? '')));
        self::assertSame(1, count($message['payload']['data']['draft']['intake']['adjuntos'] ?? []));

        $_GET = ['sessionId' => (string) ($session['sessionId'] ?? '')];
        $review = $this->captureResponse(
            static fn () => \ClinicalHistoryController::reviewGet([
                'isAdmin' => true,
                'store' => \read_store(),
            ])
        );

        self::assertSame(200, $review['status']);
        self::assertSame(['L20.9'], $review['payload']['data']['draft']['clinicianDraft']['cie10Sugeridos'] ?? []);
        self::assertSame('Prednisona 20 mg cada 12 horas', (string) ($review['payload']['data']['draft']['clinicianDraft']['tratamientoBorrador'] ?? ''));

        $_SESSION['csrf_token'] = 'csrf-test';
        $_SERVER['HTTP_X_CSRF_TOKEN'] = 'csrf-test';
        $reviewPatch = $this->captureResponse(
            static fn () => \ClinicalHistoryController::reviewPatch([
                'isAdmin' => true,
            ]),
            'PATCH',
            [
                'sessionId' => (string) ($session['sessionId'] ?? ''),
                'approve' => true,
                'draft' => [
                    'clinicianDraft' => [
                        'resumen' => 'Resumen aprobado por medico.',
                    ],
                ],
            ]
        );

        self::assertSame(200, $reviewPatch['status']);
        self::assertSame('approved', (string) ($reviewPatch['payload']['data']['draft']['reviewStatus'] ?? ''));
        self::assertSame('Resumen aprobado por medico.', (string) ($reviewPatch['payload']['data']['draft']['clinicianDraft']['resumen'] ?? ''));
    }

    public function testClinicalHistoryFallbackKeepsTranscriptAndMarksReviewRequired(): void
    {
        putenv('FIGO_PROVIDER_MODE=openclaw_queue');
        putenv('OPENCLAW_BRIDGE_SYNC_WAIT_MS=0');
        putenv('OPENCLAW_GATEWAY_ENDPOINT=');

        $sessionCreate = $this->captureResponse(
            static fn () => \ClinicalHistoryController::sessionPost([]),
            'POST',
            [
                'surface' => 'waiting_room',
            ]
        );

        $session = $sessionCreate['payload']['data']['session'] ?? [];
        $message = $this->captureResponse(
            static fn () => \ClinicalHistoryController::messagePost([]),
            'POST',
            [
                'sessionId' => (string) ($session['sessionId'] ?? ''),
                'caseId' => (string) ($session['caseId'] ?? ''),
                'message' => 'Mi hija tiene 12 anos, pesa 42 kg y es alergica a la penicilina.',
                'clientMessageId' => 'msg-fallback-001',
            ]
        );

        self::assertSame(200, $message['status']);
        self::assertNotSame('live', (string) ($message['payload']['data']['ai']['mode'] ?? ''));
        self::assertTrue((bool) ($message['payload']['data']['response']['requiresHumanReview'] ?? false));

        $_GET = ['sessionId' => (string) ($session['sessionId'] ?? '')];
        $sessionView = $this->captureResponse(
            static fn () => \ClinicalHistoryController::sessionGet([
                'store' => \read_store(),
            ])
        );

        self::assertSame(200, $sessionView['status']);
        self::assertGreaterThanOrEqual(2, count($sessionView['payload']['data']['session']['transcript'] ?? []));
        self::assertSame('review_required', (string) ($sessionView['payload']['data']['draft']['reviewStatus'] ?? ''));
    }

    public function testClinicalHistoryQueuedJobReconcilesIntoSameSessionWithoutDuplicatingTranscript(): void
    {
        putenv('FIGO_PROVIDER_MODE=openclaw_queue');
        putenv('OPENCLAW_BRIDGE_SYNC_WAIT_MS=0');
        putenv('OPENCLAW_GATEWAY_ENDPOINT=http://127.0.0.1:9/openclaw');

        $sessionCreate = $this->captureResponse(
            static fn () => \ClinicalHistoryController::sessionPost([]),
            'POST',
            [
                'surface' => 'waiting_room',
                'patient' => [
                    'name' => 'Luis Andrade',
                ],
            ]
        );

        $session = $sessionCreate['payload']['data']['session'] ?? [];
        $message = $this->captureResponse(
            static fn () => \ClinicalHistoryController::messagePost([]),
            'POST',
            [
                'sessionId' => (string) ($session['sessionId'] ?? ''),
                'caseId' => (string) ($session['caseId'] ?? ''),
                'surface' => 'patient_link',
                'message' => 'Tengo acne inflamatorio desde hace 3 meses y peso 70 kg.',
                'clientMessageId' => 'msg-queued-001',
            ]
        );

        self::assertSame(200, $message['status']);
        self::assertSame('queued', (string) ($message['payload']['data']['ai']['mode'] ?? ''));
        $jobId = (string) ($message['payload']['data']['ai']['jobId'] ?? '');
        self::assertNotSame('', $jobId);
        self::assertGreaterThanOrEqual(2, count($message['payload']['data']['session']['transcript'] ?? []));

        $this->completeQueuedClinicalJob($jobId, [
            'reply' => 'Gracias, ya registre tu motivo de consulta.',
            'nextQuestion' => 'Desde cuando notas los brotes y si han empeorado recientemente?',
            'intakePatch' => [
                'motivoConsulta' => 'Acne inflamatorio',
                'enfermedadActual' => 'Brotes inflamatorios faciales de 3 meses',
                'medicacionActual' => 'Sin tratamiento actual',
                'datosPaciente' => [
                    'pesoKg' => 70,
                ],
            ],
            'missingFields' => ['alergias', 'antecedentes'],
            'redFlags' => [],
            'clinicianDraft' => [
                'resumen' => 'Acne inflamatorio facial de 3 meses.',
                'preguntasFaltantes' => ['Alergias', 'Antecedentes dermatologicos'],
                'cie10Sugeridos' => ['L70.0'],
                'tratamientoBorrador' => 'Considerar retinoide topico nocturno',
                'posologiaBorrador' => [
                    'texto' => 'Aplicacion nocturna',
                    'baseCalculo' => 'standard',
                    'pesoKg' => 70,
                    'edadAnios' => null,
                    'units' => '',
                    'ambiguous' => true,
                ],
            ],
            'requiresHumanReview' => false,
            'confidence' => 0.78,
        ]);

        $_GET = ['sessionId' => (string) ($session['sessionId'] ?? '')];
        $sessionView = $this->captureResponse(
            static fn () => \ClinicalHistoryController::sessionGet([])
        );

        self::assertSame(200, $sessionView['status']);
        self::assertSame('live', (string) ($sessionView['payload']['data']['ai']['mode'] ?? ''));
        self::assertSame($jobId, (string) ($sessionView['payload']['data']['ai']['jobId'] ?? ''));
        self::assertSame(2, count($sessionView['payload']['data']['session']['transcript'] ?? []));
        self::assertSame(
            'Gracias, ya registre tu motivo de consulta.',
            (string) ($sessionView['payload']['data']['response']['reply'] ?? '')
        );
        self::assertNotSame('', (string) ($sessionView['payload']['data']['response']['nextQuestion'] ?? ''));
        self::assertStringContainsString(
            'Gracias, ya registre tu motivo de consulta.',
            (string) ($sessionView['payload']['data']['session']['transcript'][1]['content'] ?? '')
        );
        self::assertStringContainsString(
            'Acne inflamatorio',
            (string) ($sessionView['payload']['data']['draft']['intake']['motivoConsulta'] ?? '')
        );

        $_GET = ['sessionId' => (string) ($session['sessionId'] ?? '')];
        $review = $this->captureResponse(
            static fn () => \ClinicalHistoryController::reviewGet([
                'isAdmin' => true,
            ])
        );

        self::assertSame(200, $review['status']);
        self::assertSame(['L70.0'], $review['payload']['data']['draft']['clinicianDraft']['cie10Sugeridos'] ?? []);
        self::assertSame('', (string) ($review['payload']['data']['draft']['pendingAi']['jobId'] ?? ''));
        self::assertSame($jobId, (string) ($review['payload']['data']['session']['metadata']['lastPendingAi']['jobId'] ?? ''));
        self::assertSame('completed', (string) ($review['payload']['data']['session']['metadata']['lastPendingAi']['status'] ?? ''));
        self::assertCount(1, $review['payload']['data']['events'] ?? []);
        self::assertSame('draft_reconciled', (string) ($review['payload']['data']['events'][0]['type'] ?? ''));
        self::assertSame('open', (string) ($review['payload']['data']['events'][0]['status'] ?? ''));

        $_SESSION['csrf_token'] = 'csrf-queued';
        $_SERVER['HTTP_X_CSRF_TOKEN'] = 'csrf-queued';
        $reviewPatch = $this->captureResponse(
            static fn () => \ClinicalHistoryController::reviewPatch([
                'isAdmin' => true,
            ]),
            'PATCH',
            [
                'sessionId' => (string) ($session['sessionId'] ?? ''),
                'approve' => true,
            ]
        );

        self::assertSame(200, $reviewPatch['status']);
        self::assertCount(1, $reviewPatch['payload']['data']['events'] ?? []);
        self::assertSame('resolved', (string) ($reviewPatch['payload']['data']['events'][0]['status'] ?? ''));
        self::assertNotSame('', (string) ($reviewPatch['payload']['data']['events'][0]['acknowledgedAt'] ?? ''));
        self::assertNotSame('', (string) ($reviewPatch['payload']['data']['events'][0]['resolvedAt'] ?? ''));
    }

    public function testClinicalHistoryBackgroundReconcilerProcessesPendingSessionsWithoutReopeningSession(): void
    {
        putenv('FIGO_PROVIDER_MODE=openclaw_queue');
        putenv('OPENCLAW_BRIDGE_SYNC_WAIT_MS=0');
        putenv('OPENCLAW_GATEWAY_ENDPOINT=http://127.0.0.1:9/openclaw');

        $sessionCreate = $this->captureResponse(
            static fn () => \ClinicalHistoryController::sessionPost([]),
            'POST',
            [
                'surface' => 'waiting_room',
            ]
        );

        $session = $sessionCreate['payload']['data']['session'] ?? [];
        $message = $this->captureResponse(
            static fn () => \ClinicalHistoryController::messagePost([]),
            'POST',
            [
                'sessionId' => (string) ($session['sessionId'] ?? ''),
                'caseId' => (string) ($session['caseId'] ?? ''),
                'message' => 'Tengo rosacea facial desde hace 6 meses y peso 63 kg.',
                'clientMessageId' => 'msg-background-001',
            ]
        );

        self::assertSame('queued', (string) ($message['payload']['data']['ai']['mode'] ?? ''));
        $jobId = (string) ($message['payload']['data']['ai']['jobId'] ?? '');
        self::assertNotSame('', $jobId);

        $this->completeQueuedClinicalJob($jobId, [
            'reply' => 'Gracias, ya registre esta evolucion en tu historia clinica.',
            'nextQuestion' => 'Has notado ardor, desencadenantes o empeoramiento con calor o sol?',
            'intakePatch' => [
                'motivoConsulta' => 'Rosacea facial',
                'enfermedadActual' => 'Eritema y brotes faciales de 6 meses',
                'datosPaciente' => [
                    'pesoKg' => 63,
                ],
            ],
            'missingFields' => ['alergias', 'antecedentes', 'medicacionActual'],
            'redFlags' => [],
            'clinicianDraft' => [
                'resumen' => 'Rosacea facial de 6 meses de evolucion.',
                'preguntasFaltantes' => ['Desencadenantes', 'Alergias'],
                'cie10Sugeridos' => ['L71.9'],
                'tratamientoBorrador' => 'Considerar tratamiento topico antiinflamatorio',
                'posologiaBorrador' => [
                    'texto' => 'Aplicacion topica diaria',
                    'baseCalculo' => 'standard',
                    'pesoKg' => 63,
                    'edadAnios' => null,
                    'units' => '',
                    'ambiguous' => true,
                ],
            ],
            'requiresHumanReview' => false,
            'confidence' => 0.8,
        ]);

        $service = new \ClinicalHistoryService();
        $result = $service->reconcilePendingSessions(\read_store(), [
            'maxSessions' => 10,
        ]);

        self::assertTrue((bool) ($result['ok'] ?? false));
        self::assertSame(1, (int) ($result['scanned'] ?? 0));
        self::assertSame(1, (int) ($result['mutated'] ?? 0));
        self::assertSame(1, (int) ($result['completed'] ?? 0));
        self::assertSame(0, (int) ($result['remaining'] ?? 0));

        $reconciledStore = is_array($result['store'] ?? null) ? $result['store'] : [];
        $sessionRecord = \ClinicalHistoryRepository::findSessionBySessionId(
            $reconciledStore,
            (string) ($session['sessionId'] ?? '')
        );
        $draftRecord = \ClinicalHistoryRepository::findDraftBySessionId(
            $reconciledStore,
            (string) ($session['sessionId'] ?? '')
        );

        self::assertIsArray($sessionRecord);
        self::assertIsArray($draftRecord);
        self::assertSame([], $sessionRecord['pendingAi'] ?? null);
        self::assertSame('live', (string) ($sessionRecord['lastTurn']['ai']['mode'] ?? ''));
        self::assertSame('completed', (string) ($sessionRecord['metadata']['lastPendingAi']['status'] ?? ''));
        self::assertSame(2, count($sessionRecord['transcript'] ?? []));
        self::assertSame(['L71.9'], $draftRecord['clinicianDraft']['cie10Sugeridos'] ?? []);
        self::assertSame('Rosacea facial', (string) ($draftRecord['intake']['motivoConsulta'] ?? ''));
    }

    private function completeQueuedClinicalJob(string $jobId, array $envelope): void
    {
        $job = \figo_queue_read_job($jobId);
        self::assertIsArray($job);

        $job['status'] = 'completed';
        $job['updatedAt'] = date('c');
        $job['completedAt'] = date('c');
        $job['response'] = \figo_queue_build_completion(
            'clinical-intake',
            json_encode($envelope, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
        );
        unset($job['errorCode'], $job['errorMessage'], $job['failedAt'], $job['expiredAt']);

        self::assertTrue(\figo_queue_write_job($job));
    }

    private function captureResponse(callable $callable, string $method = 'GET', ?array $body = null): array
    {
        $_SERVER['REQUEST_METHOD'] = strtoupper($method);

        if ($body !== null) {
            $GLOBALS['__TEST_JSON_BODY'] = json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        } else {
            unset($GLOBALS['__TEST_JSON_BODY']);
        }

        try {
            $callable();
            self::fail('Expected TestingExitException');
        } catch (\TestingExitException $exception) {
            return [
                'payload' => is_array($exception->payload) ? $exception->payload : [],
                'status' => (int) $exception->status,
            ];
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

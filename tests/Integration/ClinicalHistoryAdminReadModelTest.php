<?php

declare(strict_types=1);

namespace Tests\Integration;

use PHPUnit\Framework\TestCase;

/**
 * @runInSeparateProcess
 */
final class ClinicalHistoryAdminReadModelTest extends TestCase
{
    private string $tempDir;

    protected function setUp(): void
    {
        unset($GLOBALS['__TEST_RESPONSE']);

        $this->tempDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'clinical-history-admin-' . bin2hex(random_bytes(6));
        mkdir($this->tempDir, 0777, true);

        putenv('PIELARMONIA_DATA_DIR=' . $this->tempDir);
        putenv('PIELARMONIA_AVAILABILITY_SOURCE=store');

        if (!defined('TESTING_ENV')) {
            define('TESTING_ENV', true);
        }

        require_once __DIR__ . '/../../api-lib.php';
        require_once __DIR__ . '/../../controllers/AdminDataController.php';

        \ensure_data_file();
    }

    protected function tearDown(): void
    {
        foreach ([
            'PIELARMONIA_DATA_DIR',
            'PIELARMONIA_AVAILABILITY_SOURCE',
        ] as $key) {
            putenv($key);
        }

        if (function_exists('get_db_connection')) {
            \get_db_connection(null, true);
        }

        $this->removeDirectory($this->tempDir);
        unset($GLOBALS['__TEST_RESPONSE']);
    }

    public function testAdminDataIncludesClinicalHistorySummaryQueueAndEvents(): void
    {
        $store = \read_store();
        $store['appointments'] = [];
        $store['clinical_history_sessions'] = [[
            'id' => 901,
            'sessionId' => 'chs-admin-001',
            'caseId' => 'case-admin-001',
            'appointmentId' => 451,
            'surface' => 'waiting_room',
            'status' => 'review_required',
            'patient' => [
                'name' => 'Paciente Clinico',
                'email' => 'clinico@example.com',
                'phone' => '0990001111',
            ],
            'transcript' => [],
            'questionHistory' => [],
            'surfaces' => ['waiting_room'],
            'lastTurn' => [],
            'pendingAi' => [],
            'metadata' => [],
            'version' => 3,
            'createdAt' => '2026-03-11T10:00:00-05:00',
            'updatedAt' => '2026-03-11T10:15:00-05:00',
            'lastMessageAt' => '2026-03-11T10:12:00-05:00',
        ]];
        $store['clinical_history_drafts'] = [[
            'id' => 902,
            'draftId' => 'chd-admin-001',
            'sessionId' => 'chs-admin-001',
            'caseId' => 'case-admin-001',
            'appointmentId' => 451,
            'status' => 'review_required',
            'reviewStatus' => 'review_required',
            'requiresHumanReview' => true,
            'confidence' => 0.61,
            'reviewReasons' => ['dose_ambiguous', 'low_confidence'],
            'intake' => [
                'motivoConsulta' => 'Brotes faciales',
                'enfermedadActual' => 'Rosacea de varios meses',
                'antecedentes' => '',
                'alergias' => '',
                'medicacionActual' => '',
                'rosRedFlags' => [],
                'adjuntos' => [],
                'resumenClinico' => 'Cuadro cutaneo cronico.',
                'cie10Sugeridos' => [],
                'tratamientoBorrador' => '',
                'posologiaBorrador' => [
                    'texto' => '',
                    'baseCalculo' => '',
                    'pesoKg' => null,
                    'edadAnios' => null,
                    'units' => '',
                    'ambiguous' => true,
                ],
                'preguntasFaltantes' => ['alergias', 'antecedentes'],
                'datosPaciente' => [
                    'edadAnios' => 34,
                    'pesoKg' => 63,
                    'sexoBiologico' => 'femenino',
                    'embarazo' => false,
                ],
            ],
            'clinicianDraft' => [
                'resumen' => 'Rosacea facial en revision.',
                'preguntasFaltantes' => ['Alergias'],
                'cie10Sugeridos' => ['L71.9'],
                'tratamientoBorrador' => 'Considerar metronidazol topico',
                'posologiaBorrador' => [
                    'texto' => 'Aplicacion topica diaria',
                    'baseCalculo' => 'standard',
                    'pesoKg' => 63,
                    'edadAnios' => 34,
                    'units' => '',
                    'ambiguous' => true,
                ],
            ],
            'lastAiEnvelope' => [
                'redFlags' => ['rosacea_flare'],
            ],
            'pendingAi' => [],
            'version' => 2,
            'createdAt' => '2026-03-11T10:00:00-05:00',
            'updatedAt' => '2026-03-11T10:16:00-05:00',
        ]];
        $store['clinical_history_events'] = [[
            'id' => 903,
            'eventId' => 'che-admin-001',
            'sessionId' => 'chs-admin-001',
            'caseId' => 'case-admin-001',
            'appointmentId' => 451,
            'type' => 'draft_reconciled',
            'severity' => 'warning',
            'status' => 'open',
            'title' => 'Historia clinica reconciliada y lista para revision',
            'message' => 'El borrador clinico se completo y requiere validacion del medico.',
            'requiresAction' => true,
            'jobId' => 'job-admin-001',
            'dedupeKey' => 'clinical_history|draft_reconciled|chs-admin-001|job-admin-001',
            'patient' => [
                'name' => 'Paciente Clinico',
                'email' => 'clinico@example.com',
                'phone' => '0990001111',
            ],
            'metadata' => [
                'reason' => 'queued_completion_reconciled',
            ],
            'createdAt' => '2026-03-11T10:16:00-05:00',
            'updatedAt' => '2026-03-11T10:16:00-05:00',
            'occurredAt' => '2026-03-11T10:16:00-05:00',
            'acknowledgedAt' => '',
            'resolvedAt' => '',
        ], [
            'id' => 904,
            'eventId' => 'che-admin-002',
            'sessionId' => 'chs-admin-001',
            'caseId' => 'case-admin-001',
            'appointmentId' => 451,
            'type' => 'clinical_alert',
            'severity' => 'critical',
            'status' => 'open',
            'title' => 'Alerta clinica abierta',
            'message' => 'Persisten hallazgos que requieren triage prioritario.',
            'requiresAction' => true,
            'jobId' => 'job-admin-002',
            'dedupeKey' => 'clinical_history|clinical_alert|chs-admin-001|job-admin-002',
            'patient' => [
                'name' => 'Paciente Clinico',
                'email' => 'clinico@example.com',
                'phone' => '0990001111',
            ],
            'metadata' => [
                'reason' => 'critical_follow_up_required',
            ],
            'createdAt' => '2026-03-11T10:18:00-05:00',
            'updatedAt' => '2026-03-11T10:18:00-05:00',
            'occurredAt' => '2026-03-11T10:18:00-05:00',
            'acknowledgedAt' => '',
            'resolvedAt' => '',
        ]];
        \write_store($store, false);

        try {
            \AdminDataController::index([
                'store' => \read_store(),
                'isAdmin' => true,
            ]);
            self::fail('Se esperaba TestingExitException');
        } catch (\TestingExitException $e) {
            $payload = $e->payload;
        }

        self::assertTrue((bool) ($payload['ok'] ?? false));
        self::assertArrayHasKey('clinicalHistoryMeta', $payload['data']);

        $meta = $payload['data']['clinicalHistoryMeta'];
        self::assertSame(1, (int) ($meta['summary']['drafts']['reviewQueueCount'] ?? -1));
        self::assertSame(2, (int) ($meta['summary']['events']['openCount'] ?? -1));
        self::assertSame(2, (int) ($meta['summary']['events']['unreadCount'] ?? -1));
        self::assertSame('critical', (string) ($meta['summary']['diagnostics']['status'] ?? ''));
        self::assertCount(1, $meta['reviewQueue'] ?? []);
        self::assertSame('Paciente Clinico', (string) ($meta['reviewQueue'][0]['patientName'] ?? ''));
        self::assertSame(['dose_ambiguous', 'low_confidence'], $meta['reviewQueue'][0]['reviewReasons'] ?? []);
        self::assertSame(2, (int) ($meta['reviewQueue'][0]['openEventCount'] ?? -1));
        self::assertSame('critical', (string) ($meta['reviewQueue'][0]['highestOpenSeverity'] ?? ''));
        self::assertSame('Alerta clinica abierta', (string) ($meta['reviewQueue'][0]['latestOpenEventTitle'] ?? ''));
        self::assertCount(2, $meta['events'] ?? []);
        self::assertSame(
            ['clinical_alert', 'draft_reconciled'],
            array_values(array_map(
                static fn (array $event): string => (string) ($event['type'] ?? ''),
                $meta['events'] ?? []
            ))
        );
        self::assertSame(
            ['critical', 'warning'],
            array_values(array_map(
                static fn (array $event): string => (string) ($event['severity'] ?? ''),
                $meta['events'] ?? []
            ))
        );
        self::assertSame(
            ['open', 'open'],
            array_values(array_map(
                static fn (array $event): string => (string) ($event['status'] ?? ''),
                $meta['events'] ?? []
            ))
        );
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

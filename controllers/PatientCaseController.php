<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/PatientCaseService.php';
require_once __DIR__ . '/../lib/InternalConsoleReadiness.php';

class PatientCaseController
{
    public static function index(array $context): void
    {
        $service = new PatientCaseService();
        $caseId = trim((string) ($_GET['caseId'] ?? ($_GET['case_id'] ?? '')));
        $readiness = function_exists('internal_console_readiness_snapshot')
            ? internal_console_readiness_snapshot()
            : null;
        $clinicalReady = function_exists('internal_console_clinical_data_ready')
            ? internal_console_clinical_data_ready($readiness)
            : (bool) ($readiness['clinicalData']['ready'] ?? true);

        if (!$clinicalReady) {
            $payload = function_exists('internal_console_clinical_guard_payload')
                ? internal_console_clinical_guard_payload([
                    'data' => [
                        'cases' => [],
                        'timeline' => [],
                        'selectedCaseId' => $caseId !== '' ? $caseId : null,
                    ],
                ])
                : [
                    'ok' => false,
                    'code' => 'clinical_storage_not_ready',
                    'error' => 'Historias clinicas bloqueadas hasta habilitar almacenamiento cifrado.',
                    'readiness' => $readiness,
                    'data' => [
                        'cases' => [],
                        'timeline' => [],
                        'selectedCaseId' => $caseId !== '' ? $caseId : null,
                    ],
                ];

            json_response($payload, 409);
        }

        json_response([
            'ok' => true,
            'data' => $service->buildReadModel(
                is_array($context['store'] ?? null) ? $context['store'] : [],
                $caseId !== '' ? $caseId : null
            ),
        ]);
    }
}

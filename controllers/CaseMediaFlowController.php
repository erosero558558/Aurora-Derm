<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/CaseMediaFlowService.php';
require_once __DIR__ . '/../lib/InternalConsoleReadiness.php';

final class CaseMediaFlowController
{
    public static function queue(array $context): void
    {
        self::requireAdmin($context);
        self::requireClinicalStorageReady([
            'summary' => [
                'totalCases' => 0,
                'eligibleCases' => 0,
                'blockedCases' => 0,
                'publishedCases' => 0,
                'needsReviewCases' => 0,
                'latestActivityAt' => '',
            ],
            'queue' => [],
            'recentEvents' => [],
        ]);
        json_response([
            'ok' => true,
            'data' => CaseMediaFlowService::queue(
                isset($context['store']) && is_array($context['store']) ? $context['store'] : read_store()
            ),
        ]);
    }

    public static function caseGet(array $context): void
    {
        self::requireAdmin($context);
        self::requireClinicalStorageReady([
            'case' => null,
        ]);
        $caseId = trim((string) ($_GET['caseId'] ?? ''));
        json_response([
            'ok' => true,
            'data' => CaseMediaFlowService::getCase(
                isset($context['store']) && is_array($context['store']) ? $context['store'] : read_store(),
                $caseId
            ),
        ]);
    }

    public static function proposalGenerate(array $context): void
    {
        self::requireAdmin($context);
        self::requireClinicalStorageReady([
            'case' => null,
            'proposal' => null,
            'event' => null,
        ]);
        $payload = require_json_body();

        json_response([
            'ok' => true,
            'data' => CaseMediaFlowService::generateProposal(
                isset($context['store']) && is_array($context['store']) ? $context['store'] : read_store(),
                $payload
            ),
        ], 201);
    }

    public static function proposalReview(array $context): void
    {
        self::requireAdmin($context);
        self::requireClinicalStorageReady([
            'case' => null,
            'proposal' => null,
            'publication' => null,
            'event' => null,
        ]);
        $payload = require_json_body();

        json_response([
            'ok' => true,
            'data' => CaseMediaFlowService::reviewProposal(
                isset($context['store']) && is_array($context['store']) ? $context['store'] : read_store(),
                $payload
            ),
        ]);
    }

    public static function publicationState(array $context): void
    {
        self::requireAdmin($context);
        self::requireClinicalStorageReady([
            'case' => null,
            'publication' => null,
            'event' => null,
        ]);
        $payload = require_json_body();

        json_response([
            'ok' => true,
            'data' => CaseMediaFlowService::publicationState(
                isset($context['store']) && is_array($context['store']) ? $context['store'] : read_store(),
                $payload
            ),
        ]);
    }

    public static function privateAsset(array $context): void
    {
        self::requireAdmin($context);
        self::requireClinicalStorageReady([
            'asset' => null,
        ]);
        $asset = CaseMediaFlowService::resolvePrivateAsset(
            isset($context['store']) && is_array($context['store']) ? $context['store'] : read_store(),
            $_GET
        );
        self::streamFile($asset);
    }

    public static function publicStories(array $context): void
    {
        $locale = trim((string) ($_GET['locale'] ?? 'es'));
        json_response([
            'ok' => true,
            'data' => CaseMediaFlowService::publicStories(
                isset($context['store']) && is_array($context['store']) ? $context['store'] : read_store(),
                $locale
            ),
        ]);
    }

    public static function publicMediaFile(array $context): void
    {
        $asset = CaseMediaFlowService::resolvePublicMediaFile($_GET);
        self::streamFile($asset);
    }

    /**
     * @param array<string,mixed> $asset
     */
    private static function streamFile(array $asset): void
    {
        $path = (string) ($asset['path'] ?? '');
        if ($path === '' || !is_file($path)) {
            json_response(['ok' => false, 'error' => 'Archivo no encontrado'], 404);
        }

        if (!headers_sent()) {
            header('Content-Type: ' . (string) ($asset['mime'] ?? 'application/octet-stream'));
            header('Content-Length: ' . (string) filesize($path));
            header('Cache-Control: public, max-age=300');
            header('Content-Disposition: inline; filename="' . basename((string) ($asset['filename'] ?? basename($path))) . '"');
        }

        readfile($path);
    }

    private static function requireAdmin(array $context): void
    {
        if (!($context['isAdmin'] ?? false)) {
            json_response(['ok' => false, 'error' => 'No autorizado'], 401);
        }
    }

    /**
     * @param array<string,mixed> $data
     */
    private static function requireClinicalStorageReady(array $data): void
    {
        $readiness = function_exists('internal_console_readiness_snapshot')
            ? internal_console_readiness_snapshot()
            : null;
        $clinicalReady = function_exists('internal_console_clinical_data_ready')
            ? internal_console_clinical_data_ready($readiness)
            : (bool) ($readiness['clinicalData']['ready'] ?? true);

        if ($clinicalReady) {
            return;
        }

        $payload = function_exists('internal_console_clinical_guard_payload')
            ? internal_console_clinical_guard_payload([
                'surface' => 'case_media_flow',
                'data' => $data,
            ])
            : [
                'ok' => false,
                'code' => 'clinical_storage_not_ready',
                'error' => 'Historias clinicas bloqueadas hasta habilitar almacenamiento cifrado.',
                'readiness' => $readiness,
                'surface' => 'case_media_flow',
                'data' => $data,
            ];

        json_response($payload, 409);
    }
}

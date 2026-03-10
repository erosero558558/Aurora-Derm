<?php

declare(strict_types=1);

final class TelemedicineOpsDiagnostics
{
    public static function buildFromSnapshot(array $snapshot): array
    {
        $integrity = isset($snapshot['integrity']) && is_array($snapshot['integrity'])
            ? $snapshot['integrity']
            : [];

        $checks = [];
        $issues = [];

        self::appendCheck(
            $checks,
            $issues,
            'linked_appointments',
            'critical',
            (int) ($integrity['danglingAppointmentLinksCount'] ?? 0) === 0,
            (int) ($integrity['danglingAppointmentLinksCount'] ?? 0),
            'Hay intakes con appointment enlazado que ya no existe.'
        );
        self::appendCheck(
            $checks,
            $issues,
            'clinical_uploads_linked',
            'critical',
            (int) ($integrity['orphanedClinicalUploadsCount'] ?? 0) === 0,
            (int) ($integrity['orphanedClinicalUploadsCount'] ?? 0),
            'Hay uploads clinicos huerfanos.'
        );
        self::appendCheck(
            $checks,
            $issues,
            'case_photos_private_path',
            'critical',
            (int) ($integrity['casePhotosWithoutPrivatePathCount'] ?? 0) === 0,
            (int) ($integrity['casePhotosWithoutPrivatePathCount'] ?? 0),
            'Hay fotos clinicas sin ruta privada final.'
        );
        self::appendCheck(
            $checks,
            $issues,
            'unlinked_intakes',
            'warning',
            (int) ($integrity['unlinkedIntakesCount'] ?? 0) === 0,
            (int) ($integrity['unlinkedIntakesCount'] ?? 0),
            'Hay intakes aun no vinculados a una cita.'
        );
        self::appendCheck(
            $checks,
            $issues,
            'legacy_staging_uploads',
            'info',
            (int) ($integrity['stagedLegacyUploadsCount'] ?? 0) === 0,
            (int) ($integrity['stagedLegacyUploadsCount'] ?? 0),
            'Persisten uploads legacy en staging.'
        );

        $critical = self::countIssues($issues, 'critical');
        $warning = self::countIssues($issues, 'warning');
        $info = self::countIssues($issues, 'info');

        return [
            'status' => $critical > 0 ? 'critical' : ($warning > 0 ? 'degraded' : 'healthy'),
            'healthy' => $critical === 0,
            'summary' => [
                'critical' => $critical,
                'warning' => $warning,
                'info' => $info,
                'totalChecks' => count($checks),
                'totalIssues' => count($issues),
            ],
            'checks' => $checks,
            'issues' => $issues,
        ];
    }

    private static function appendCheck(
        array &$checks,
        array &$issues,
        string $key,
        string $severity,
        bool $ok,
        int $value,
        string $message
    ): void {
        $checks[] = [
            'key' => $key,
            'severity' => $severity,
            'ok' => $ok,
            'value' => $value,
            'message' => $ok ? '' : $message,
        ];

        if ($ok) {
            return;
        }

        $issues[] = [
            'key' => $key,
            'severity' => $severity,
            'message' => $message,
            'value' => $value,
        ];
    }

    private static function countIssues(array $issues, string $severity): int
    {
        $count = 0;
        foreach ($issues as $issue) {
            if ((string) ($issue['severity'] ?? '') === $severity) {
                $count++;
            }
        }

        return $count;
    }
}

<?php

declare(strict_types=1);

final class RetentionCsvExporter
{
    public static function build(array $data): string
    {
        $rows = [];
        $rows[] = implode(',', [
            'date',
            'appointments_total',
            'appointments_non_cancelled',
            'status_confirmed',
            'status_completed',
            'status_no_show',
            'status_cancelled',
            'no_show_rate_pct',
            'completion_rate_pct',
            'unique_patients',
        ]);

        $series = isset($data['series']) && is_array($data['series']) ? $data['series'] : [];
        foreach ($series as $row) {
            if (!is_array($row)) {
                continue;
            }

            $statusCounts = isset($row['statusCounts']) && is_array($row['statusCounts']) ? $row['statusCounts'] : [];
            $rows[] = implode(',', [
                self::csvValue((string) ($row['date'] ?? '')),
                (string) ((int) ($row['appointmentsTotal'] ?? 0)),
                (string) ((int) ($row['appointmentsNonCancelled'] ?? 0)),
                (string) ((int) ($statusCounts['confirmed'] ?? 0)),
                (string) ((int) ($statusCounts['completed'] ?? 0)),
                (string) ((int) ($statusCounts['noShow'] ?? 0)),
                (string) ((int) ($statusCounts['cancelled'] ?? 0)),
                (string) ((float) ($row['noShowRatePct'] ?? 0)),
                (string) ((float) ($row['completionRatePct'] ?? 0)),
                (string) ((int) ($row['uniquePatients'] ?? 0)),
            ]);
        }

        $summary = isset($data['summary']) && is_array($data['summary']) ? $data['summary'] : [];
        $summaryStatus = isset($summary['statusCounts']) && is_array($summary['statusCounts']) ? $summary['statusCounts'] : [];
        $rows[] = implode(',', [
            'TOTAL',
            (string) ((int) ($summary['appointmentsTotal'] ?? 0)),
            (string) ((int) ($summary['appointmentsNonCancelled'] ?? 0)),
            (string) ((int) ($summaryStatus['confirmed'] ?? 0)),
            (string) ((int) ($summaryStatus['completed'] ?? 0)),
            (string) ((int) ($summaryStatus['noShow'] ?? 0)),
            (string) ((int) ($summaryStatus['cancelled'] ?? 0)),
            (string) ((float) ($summary['noShowRatePct'] ?? 0)),
            (string) ((float) ($summary['completionRatePct'] ?? 0)),
            (string) ((int) ($summary['uniquePatients'] ?? 0)),
        ]);

        return implode("\n", $rows) . "\n";
    }

    private static function csvValue(string $value): string
    {
        $escaped = str_replace('"', '""', $value);
        return '"' . $escaped . '"';
    }
}

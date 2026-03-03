<?php

declare(strict_types=1);

final class TelemedicineOpsSnapshot
{
    private const STATUS_KEYS = [
        'draft',
        'awaiting_payment',
        'ready_for_booking',
        'booked',
        'review_required',
        'unsuitable',
        'cancelled',
        'completed',
        'legacy_migrated',
    ];

    private const SUITABILITY_KEYS = [
        'fit',
        'review_required',
        'unsuitable',
    ];

    private const CHANNEL_KEYS = [
        'phone',
        'secure_video',
    ];

    private const MEDIA_KIND_KEYS = [
        'case_photo',
        'supporting_document',
        'legacy_unclassified',
        'payment_proof',
    ];

    private const STORAGE_MODE_KEYS = [
        'private_clinical',
        'public_payment',
        'staging_legacy',
    ];

    public static function build(array $store): array
    {
        $appointments = isset($store['appointments']) && is_array($store['appointments'])
            ? array_values($store['appointments'])
            : [];
        $intakes = isset($store['telemedicine_intakes']) && is_array($store['telemedicine_intakes'])
            ? array_values($store['telemedicine_intakes'])
            : [];
        $uploads = isset($store['clinical_uploads']) && is_array($store['clinical_uploads'])
            ? array_values($store['clinical_uploads'])
            : [];

        $appointmentIds = [];
        $appointmentsWithIntakeLink = 0;
        $telemedAppointmentsWithoutIntake = 0;
        foreach ($appointments as $appointment) {
            $appointmentId = (int) ($appointment['id'] ?? 0);
            if ($appointmentId > 0) {
                $appointmentIds[$appointmentId] = true;
            }
            $service = trim((string) ($appointment['service'] ?? ''));
            $isTelemedService = in_array($service, ['telefono', 'video'], true);
            $telemedicineIntakeId = (int) ($appointment['telemedicineIntakeId'] ?? 0);
            if ($telemedicineIntakeId > 0) {
                $appointmentsWithIntakeLink++;
            } elseif ($isTelemedService) {
                $telemedAppointmentsWithoutIntake++;
            }
        }

        $statusCounts = self::initializeCounters(self::STATUS_KEYS);
        $suitabilityCounts = self::initializeCounters(self::SUITABILITY_KEYS);
        $channelCounts = self::initializeCounters(self::CHANNEL_KEYS);
        $kindCounts = self::initializeCounters(self::MEDIA_KIND_KEYS);
        $storageCounts = self::initializeCounters(self::STORAGE_MODE_KEYS);

        $reviewQueue = [];
        $linkedAppointmentsCount = 0;
        $danglingAppointmentLinksCount = 0;
        $unlinkedIntakesCount = 0;
        $latestActivityAt = '';

        foreach ($intakes as $intake) {
            $status = trim((string) ($intake['status'] ?? 'draft'));
            if ($status === '') {
                $status = 'draft';
            }
            $statusCounts[$status] = ($statusCounts[$status] ?? 0) + 1;

            $suitability = trim((string) ($intake['suitability'] ?? 'review_required'));
            if ($suitability === '') {
                $suitability = 'review_required';
            }
            $suitabilityCounts[$suitability] = ($suitabilityCounts[$suitability] ?? 0) + 1;

            $channel = trim((string) ($intake['channel'] ?? ''));
            if ($channel !== '') {
                $channelCounts[$channel] = ($channelCounts[$channel] ?? 0) + 1;
            }

            $linkedAppointmentId = (int) ($intake['linkedAppointmentId'] ?? 0);
            if ($linkedAppointmentId > 0) {
                if (isset($appointmentIds[$linkedAppointmentId])) {
                    $linkedAppointmentsCount++;
                } else {
                    $danglingAppointmentLinksCount++;
                }
            } else {
                $unlinkedIntakesCount++;
            }

            $updatedAt = (string) ($intake['updatedAt'] ?? $intake['createdAt'] ?? '');
            $latestActivityAt = self::maxTimestamp($latestActivityAt, $updatedAt);

            $needsReview = (bool) ($intake['reviewRequired'] ?? false)
                || $suitability === 'review_required'
                || $suitability === 'unsuitable'
                || $status === 'review_required'
                || $status === 'unsuitable';
            if ($needsReview) {
                $reviewQueue[] = self::buildReviewQueueRow($intake);
            }
        }

        $orphanedClinicalUploadsCount = 0;
        $casePhotosWithoutPrivatePathCount = 0;
        foreach ($uploads as $upload) {
            $kind = trim((string) ($upload['kind'] ?? 'legacy_unclassified'));
            if ($kind === '') {
                $kind = 'legacy_unclassified';
            }
            $kindCounts[$kind] = ($kindCounts[$kind] ?? 0) + 1;

            $storageMode = trim((string) ($upload['storageMode'] ?? 'staging_legacy'));
            if ($storageMode === '') {
                $storageMode = 'staging_legacy';
            }
            $storageCounts[$storageMode] = ($storageCounts[$storageMode] ?? 0) + 1;

            $updatedAt = (string) ($upload['updatedAt'] ?? $upload['createdAt'] ?? '');
            $latestActivityAt = self::maxTimestamp($latestActivityAt, $updatedAt);

            $intakeId = (int) ($upload['intakeId'] ?? 0);
            $appointmentId = (int) ($upload['appointmentId'] ?? 0);
            if ($intakeId <= 0 && $appointmentId <= 0) {
                $orphanedClinicalUploadsCount++;
            }
            if ($kind === 'case_photo' && trim((string) ($upload['privatePath'] ?? '')) === '') {
                $casePhotosWithoutPrivatePathCount++;
            }
        }

        usort($reviewQueue, static function (array $left, array $right): int {
            $priorityLeft = self::reviewPriority($left['suitability'] ?? '');
            $priorityRight = self::reviewPriority($right['suitability'] ?? '');
            if ($priorityLeft !== $priorityRight) {
                return $priorityLeft <=> $priorityRight;
            }

            return strcmp((string) ($left['updatedAt'] ?? ''), (string) ($right['updatedAt'] ?? ''));
        });

        return [
            'configured' => true,
            'intakes' => [
                'total' => count($intakes),
                'byStatus' => $statusCounts,
                'bySuitability' => $suitabilityCounts,
                'byChannel' => $channelCounts,
            ],
            'media' => [
                'total' => count($uploads),
                'byKind' => $kindCounts,
                'byStorageMode' => $storageCounts,
            ],
            'integrity' => [
                'linkedAppointmentsCount' => $linkedAppointmentsCount,
                'danglingAppointmentLinksCount' => $danglingAppointmentLinksCount,
                'unlinkedIntakesCount' => $unlinkedIntakesCount,
                'appointmentsWithIntakeLinkCount' => $appointmentsWithIntakeLink,
                'telemedAppointmentsWithoutIntakeCount' => $telemedAppointmentsWithoutIntake,
                'orphanedClinicalUploadsCount' => $orphanedClinicalUploadsCount,
                'casePhotosWithoutPrivatePathCount' => $casePhotosWithoutPrivatePathCount,
                'stagedLegacyUploadsCount' => (int) ($storageCounts['staging_legacy'] ?? 0),
            ],
            'reviewQueue' => [
                'count' => count($reviewQueue),
                'items' => array_values($reviewQueue),
            ],
            'latestActivityAt' => $latestActivityAt,
        ];
    }

    public static function forHealth(array $snapshot): array
    {
        return [
            'configured' => (bool) ($snapshot['configured'] ?? false),
            'intakes' => $snapshot['intakes'] ?? [],
            'media' => $snapshot['media'] ?? [],
            'integrity' => $snapshot['integrity'] ?? [],
            'reviewQueueCount' => (int) ($snapshot['reviewQueue']['count'] ?? 0),
            'latestActivityAt' => (string) ($snapshot['latestActivityAt'] ?? ''),
        ];
    }

    public static function forAdmin(array $snapshot): array
    {
        return [
            'summary' => self::forHealth($snapshot),
            'reviewQueue' => $snapshot['reviewQueue']['items'] ?? [],
        ];
    }

    public static function renderPrometheusMetrics(array $snapshot): string
    {
        $lines = [];
        $intakes = is_array($snapshot['intakes'] ?? null) ? $snapshot['intakes'] : [];
        $media = is_array($snapshot['media'] ?? null) ? $snapshot['media'] : [];
        $integrity = is_array($snapshot['integrity'] ?? null) ? $snapshot['integrity'] : [];

        $lines[] = '# TYPE pielarmonia_telemedicine_intakes_total gauge';
        $lines[] = 'pielarmonia_telemedicine_intakes_total ' . (int) ($intakes['total'] ?? 0);

        foreach ((array) ($intakes['byStatus'] ?? []) as $status => $count) {
            $lines[] = '# TYPE pielarmonia_telemedicine_intakes_by_status_total gauge';
            $lines[] = 'pielarmonia_telemedicine_intakes_by_status_total{status="' . self::escapeLabel((string) $status) . '"} ' . (int) $count;
        }
        foreach ((array) ($intakes['bySuitability'] ?? []) as $suitability => $count) {
            $lines[] = '# TYPE pielarmonia_telemedicine_intakes_by_suitability_total gauge';
            $lines[] = 'pielarmonia_telemedicine_intakes_by_suitability_total{suitability="' . self::escapeLabel((string) $suitability) . '"} ' . (int) $count;
        }
        foreach ((array) ($intakes['byChannel'] ?? []) as $channel => $count) {
            $lines[] = '# TYPE pielarmonia_telemedicine_intakes_by_channel_total gauge';
            $lines[] = 'pielarmonia_telemedicine_intakes_by_channel_total{channel="' . self::escapeLabel((string) $channel) . '"} ' . (int) $count;
        }
        foreach ((array) ($media['byKind'] ?? []) as $kind => $count) {
            $lines[] = '# TYPE pielarmonia_telemedicine_media_by_kind_total gauge';
            $lines[] = 'pielarmonia_telemedicine_media_by_kind_total{kind="' . self::escapeLabel((string) $kind) . '"} ' . (int) $count;
        }
        foreach ((array) ($media['byStorageMode'] ?? []) as $storageMode => $count) {
            $lines[] = '# TYPE pielarmonia_telemedicine_media_by_storage_total gauge';
            $lines[] = 'pielarmonia_telemedicine_media_by_storage_total{storage_mode="' . self::escapeLabel((string) $storageMode) . '"} ' . (int) $count;
        }

        $lines[] = '# TYPE pielarmonia_telemedicine_review_queue_total gauge';
        $lines[] = 'pielarmonia_telemedicine_review_queue_total ' . (int) ($snapshot['reviewQueue']['count'] ?? 0);
        $lines[] = '# TYPE pielarmonia_telemedicine_unlinked_intakes_total gauge';
        $lines[] = 'pielarmonia_telemedicine_unlinked_intakes_total ' . (int) ($integrity['unlinkedIntakesCount'] ?? 0);
        $lines[] = '# TYPE pielarmonia_telemedicine_dangling_appointment_links_total gauge';
        $lines[] = 'pielarmonia_telemedicine_dangling_appointment_links_total ' . (int) ($integrity['danglingAppointmentLinksCount'] ?? 0);
        $lines[] = '# TYPE pielarmonia_telemedicine_orphaned_clinical_uploads_total gauge';
        $lines[] = 'pielarmonia_telemedicine_orphaned_clinical_uploads_total ' . (int) ($integrity['orphanedClinicalUploadsCount'] ?? 0);
        $lines[] = '# TYPE pielarmonia_telemedicine_case_photos_missing_private_path_total gauge';
        $lines[] = 'pielarmonia_telemedicine_case_photos_missing_private_path_total ' . (int) ($integrity['casePhotosWithoutPrivatePathCount'] ?? 0);
        $lines[] = '# TYPE pielarmonia_telemedicine_staged_legacy_uploads_total gauge';
        $lines[] = 'pielarmonia_telemedicine_staged_legacy_uploads_total ' . (int) ($integrity['stagedLegacyUploadsCount'] ?? 0);

        return "\n" . implode("\n", $lines);
    }

    private static function buildReviewQueueRow(array $intake): array
    {
        $patient = isset($intake['patient']) && is_array($intake['patient'])
            ? $intake['patient']
            : [];

        return [
            'intakeId' => (int) ($intake['id'] ?? 0),
            'appointmentId' => (int) ($intake['linkedAppointmentId'] ?? 0),
            'channel' => (string) ($intake['channel'] ?? ''),
            'status' => (string) ($intake['status'] ?? ''),
            'suitability' => (string) ($intake['suitability'] ?? 'review_required'),
            'reasons' => array_values(is_array($intake['suitabilityReasons'] ?? null) ? $intake['suitabilityReasons'] : []),
            'escalationRecommendation' => (string) ($intake['escalationRecommendation'] ?? 'manual_review'),
            'requestedDate' => (string) ($intake['requestedDate'] ?? ''),
            'requestedTime' => (string) ($intake['requestedTime'] ?? ''),
            'requestedDoctor' => (string) ($intake['requestedDoctor'] ?? ''),
            'patientName' => (string) ($patient['name'] ?? ''),
            'patientEmail' => (string) ($patient['email'] ?? ''),
            'patientPhone' => (string) ($patient['phone'] ?? ''),
            'clinicalMediaCount' => count(is_array($intake['clinicalMediaIds'] ?? null) ? $intake['clinicalMediaIds'] : []),
            'createdAt' => (string) ($intake['createdAt'] ?? ''),
            'updatedAt' => (string) ($intake['updatedAt'] ?? ''),
        ];
    }

    private static function initializeCounters(array $keys): array
    {
        $counters = [];
        foreach ($keys as $key) {
            $counters[$key] = 0;
        }

        return $counters;
    }

    private static function maxTimestamp(string $left, string $right): string
    {
        if ($left === '') {
            return $right;
        }
        if ($right === '') {
            return $left;
        }

        $leftTs = strtotime($left);
        $rightTs = strtotime($right);
        if ($leftTs === false) {
            return $right;
        }
        if ($rightTs === false) {
            return $left;
        }

        return $rightTs > $leftTs ? $right : $left;
    }

    private static function reviewPriority(string $suitability): int
    {
        if ($suitability === 'unsuitable') {
            return 0;
        }
        if ($suitability === 'review_required') {
            return 1;
        }

        return 2;
    }

    private static function escapeLabel(string $value): string
    {
        return str_replace(['\\', '"', "\n"], ['\\\\', '\"', '\n'], $value);
    }
}

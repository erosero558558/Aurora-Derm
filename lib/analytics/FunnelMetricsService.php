<?php

declare(strict_types=1);

require_once __DIR__ . '/AnalyticsLabelNormalizer.php';
require_once __DIR__ . '/PrometheusCounterParser.php';
require_once __DIR__ . '/../QueueAssistantMetricsStore.php';
require_once __DIR__ . '/RetentionReportService.php';

final class FunnelMetricsService
{
    private const ALLOWED_EVENTS = [
        'view_booking',
        'view_service_category',
        'view_service_detail',
        'start_booking_from_service',
        'start_checkout',
        'payment_method_selected',
        'payment_success',
        'booking_confirmed',
        'checkout_abandon',
        'booking_step_completed',
        'booking_error',
        'checkout_error',
        'chat_started',
        'chat_handoff_whatsapp',
        'whatsapp_click',
    ];

    public static function normalizeEventName($value): string
    {
        return AnalyticsLabelNormalizer::normalize($value, '');
    }

    public static function isAllowedEvent(string $event): bool
    {
        return $event !== '' && in_array($event, self::ALLOWED_EVENTS, true);
    }

    /**
     * @return array<string,string>
     */
    public static function buildEventLabels($payload, string $event): array
    {
        $params = [];
        if (is_array($payload) && isset($payload['params']) && is_array($payload['params'])) {
            $params = $payload['params'];
        }

        $labels = [
            'event' => $event,
            'source' => AnalyticsLabelNormalizer::normalize(
                $params['source'] ?? (is_array($payload) ? ($payload['source'] ?? 'unknown') : 'unknown')
            ),
        ];

        return self::extractEventLabels($event, $params, $labels);
    }

    /**
     * @return array<string,mixed>
     */
    public static function buildData(array $context): array
    {
        $rawMetrics = class_exists('Metrics') ? Metrics::export() : '';
        $series = PrometheusCounterParser::parseCounterSeries($rawMetrics, 'conversion_funnel_events_total');

        $eventTotals = [];
        foreach (self::ALLOWED_EVENTS as $eventName) {
            $eventTotals[$eventName] = 0;
        }

        $checkoutAbandonByStep = [];
        $checkoutAbandonByReason = [];
        $checkoutEntryBreakdown = [];
        $eventSourceBreakdown = [];
        $paymentMethodBreakdown = [];
        $bookingStepBreakdown = [];
        $errorCodeBreakdown = [];
        $entrySurfaceBreakdown = [];
        $localeBreakdown = [];
        $intentBreakdown = [];
        $publicSurfaceBreakdown = [];
        $surfaceFunnelBreakdown = [];
        $serviceCategoryBreakdown = [];
        $serviceDetailBreakdown = [];
        $serviceBookingIntentBreakdown = [];
        $serviceCheckoutBreakdown = [];
        $serviceConfirmedBreakdown = [];

        foreach ($series as $row) {
            $labels = is_array($row['labels'] ?? null) ? $row['labels'] : [];
            $value = (int) round((float) ($row['value'] ?? 0));
            if ($value <= 0) {
                continue;
            }

            $eventName = AnalyticsLabelNormalizer::normalize($labels['event'] ?? '', '');
            if ($eventName === '') {
                continue;
            }
            if (!isset($eventTotals[$eventName])) {
                $eventTotals[$eventName] = 0;
            }
            $eventTotals[$eventName] += $value;

            $source = AnalyticsLabelNormalizer::normalize($labels['source'] ?? 'unknown');
            if (!isset($eventSourceBreakdown[$source])) {
                $eventSourceBreakdown[$source] = 0;
            }
            $eventSourceBreakdown[$source] += $value;

            $entrySurface = AnalyticsLabelNormalizer::normalize($labels['entry_surface'] ?? '', '');
            if ($entrySurface !== '') {
                if (!isset($entrySurfaceBreakdown[$entrySurface])) {
                    $entrySurfaceBreakdown[$entrySurface] = 0;
                }
                $entrySurfaceBreakdown[$entrySurface] += $value;
            }

            $locale = AnalyticsLabelNormalizer::normalize($labels['locale'] ?? '', '');
            if ($locale !== '') {
                if (!isset($localeBreakdown[$locale])) {
                    $localeBreakdown[$locale] = 0;
                }
                $localeBreakdown[$locale] += $value;
            }

            $intent = AnalyticsLabelNormalizer::normalize($labels['intent'] ?? '', '');
            if ($intent !== '') {
                if (!isset($intentBreakdown[$intent])) {
                    $intentBreakdown[$intent] = 0;
                }
                $intentBreakdown[$intent] += $value;
            }

            $publicSurface = AnalyticsLabelNormalizer::normalize($labels['public_surface'] ?? '', '');
            if ($publicSurface !== '') {
                if (!isset($publicSurfaceBreakdown[$publicSurface])) {
                    $publicSurfaceBreakdown[$publicSurface] = 0;
                }
                $publicSurfaceBreakdown[$publicSurface] += $value;

                if (!isset($surfaceFunnelBreakdown[$publicSurface])) {
                    $surfaceFunnelBreakdown[$publicSurface] = [
                        'viewBooking' => 0,
                        'startCheckout' => 0,
                        'bookingConfirmed' => 0,
                    ];
                }
                if ($eventName === 'view_booking') {
                    $surfaceFunnelBreakdown[$publicSurface]['viewBooking'] += $value;
                } elseif ($eventName === 'start_checkout') {
                    $surfaceFunnelBreakdown[$publicSurface]['startCheckout'] += $value;
                } elseif ($eventName === 'booking_confirmed') {
                    $surfaceFunnelBreakdown[$publicSurface]['bookingConfirmed'] += $value;
                }
            }

            $serviceCategory = AnalyticsLabelNormalizer::normalize($labels['service_category'] ?? '', '');
            if ($serviceCategory !== '') {
                if (!isset($serviceCategoryBreakdown[$serviceCategory])) {
                    $serviceCategoryBreakdown[$serviceCategory] = 0;
                }
                $serviceCategoryBreakdown[$serviceCategory] += $value;
            }

            $serviceSlug = AnalyticsLabelNormalizer::normalize($labels['service_slug'] ?? ($labels['service'] ?? ''), '');
            if ($serviceSlug !== '') {
                if ($eventName === 'view_service_detail') {
                    if (!isset($serviceDetailBreakdown[$serviceSlug])) {
                        $serviceDetailBreakdown[$serviceSlug] = 0;
                    }
                    $serviceDetailBreakdown[$serviceSlug] += $value;
                }

                if ($eventName === 'start_booking_from_service') {
                    if (!isset($serviceBookingIntentBreakdown[$serviceSlug])) {
                        $serviceBookingIntentBreakdown[$serviceSlug] = 0;
                    }
                    $serviceBookingIntentBreakdown[$serviceSlug] += $value;
                }

                if ($eventName === 'start_checkout') {
                    if (!isset($serviceCheckoutBreakdown[$serviceSlug])) {
                        $serviceCheckoutBreakdown[$serviceSlug] = 0;
                    }
                    $serviceCheckoutBreakdown[$serviceSlug] += $value;
                }

                if ($eventName === 'booking_confirmed') {
                    if (!isset($serviceConfirmedBreakdown[$serviceSlug])) {
                        $serviceConfirmedBreakdown[$serviceSlug] = 0;
                    }
                    $serviceConfirmedBreakdown[$serviceSlug] += $value;
                }
            }

            if ($eventName === 'checkout_abandon') {
                $step = AnalyticsLabelNormalizer::normalize($labels['checkout_step'] ?? 'unknown');
                if (!isset($checkoutAbandonByStep[$step])) {
                    $checkoutAbandonByStep[$step] = 0;
                }
                $checkoutAbandonByStep[$step] += $value;

                $reason = AnalyticsLabelNormalizer::normalize($labels['reason'] ?? 'unknown');
                if (!isset($checkoutAbandonByReason[$reason])) {
                    $checkoutAbandonByReason[$reason] = 0;
                }
                $checkoutAbandonByReason[$reason] += $value;
            }

            if ($eventName === 'start_checkout') {
                $entry = AnalyticsLabelNormalizer::normalize($labels['checkout_entry'] ?? 'unknown');
                if (!isset($checkoutEntryBreakdown[$entry])) {
                    $checkoutEntryBreakdown[$entry] = 0;
                }
                $checkoutEntryBreakdown[$entry] += $value;
            }

            if ($eventName === 'payment_method_selected') {
                $method = AnalyticsLabelNormalizer::normalize($labels['payment_method'] ?? 'unknown');
                if (!isset($paymentMethodBreakdown[$method])) {
                    $paymentMethodBreakdown[$method] = 0;
                }
                $paymentMethodBreakdown[$method] += $value;
            }

            if ($eventName === 'booking_step_completed') {
                $step = AnalyticsLabelNormalizer::normalize($labels['step'] ?? 'unknown');
                if (!isset($bookingStepBreakdown[$step])) {
                    $bookingStepBreakdown[$step] = 0;
                }
                $bookingStepBreakdown[$step] += $value;
            }

            if ($eventName === 'booking_error' || $eventName === 'checkout_error') {
                $errorCode = AnalyticsLabelNormalizer::normalize($labels['error_code'] ?? 'unknown');
                if (!isset($errorCodeBreakdown[$errorCode])) {
                    $errorCodeBreakdown[$errorCode] = 0;
                }
                $errorCodeBreakdown[$errorCode] += $value;
            }
        }

        arsort($checkoutAbandonByStep);
        arsort($checkoutAbandonByReason);
        arsort($checkoutEntryBreakdown);
        arsort($eventSourceBreakdown);
        arsort($entrySurfaceBreakdown);
        arsort($localeBreakdown);
        arsort($intentBreakdown);
        arsort($publicSurfaceBreakdown);
        arsort($paymentMethodBreakdown);
        arsort($bookingStepBreakdown);
        arsort($errorCodeBreakdown);
        arsort($serviceCategoryBreakdown);
        arsort($serviceDetailBreakdown);
        arsort($serviceBookingIntentBreakdown);
        arsort($serviceCheckoutBreakdown);
        arsort($serviceConfirmedBreakdown);

        $viewBooking = (int) ($eventTotals['view_booking'] ?? 0);
        $startCheckout = (int) ($eventTotals['start_checkout'] ?? 0);
        $bookingConfirmed = (int) ($eventTotals['booking_confirmed'] ?? 0);
        $checkoutAbandon = (int) ($eventTotals['checkout_abandon'] ?? 0);
        $store = isset($context['store']) && is_array($context['store']) ? $context['store'] : [];

        return [
            'summary' => [
                'viewBooking' => $viewBooking,
                'startCheckout' => $startCheckout,
                'bookingConfirmed' => $bookingConfirmed,
                'checkoutAbandon' => $checkoutAbandon,
                'startRatePct' => $viewBooking > 0 ? round(($startCheckout / $viewBooking) * 100, 1) : 0.0,
                'confirmedRatePct' => $startCheckout > 0 ? round(($bookingConfirmed / $startCheckout) * 100, 1) : 0.0,
                'abandonRatePct' => $startCheckout > 0 ? round(($checkoutAbandon / $startCheckout) * 100, 1) : 0.0,
            ],
            'events' => $eventTotals,
            'checkoutAbandonByStep' => self::toList($checkoutAbandonByStep),
            'checkoutAbandonByReason' => self::toList($checkoutAbandonByReason),
            'checkoutEntryBreakdown' => self::toList($checkoutEntryBreakdown),
            'eventSourceBreakdown' => self::toList($eventSourceBreakdown),
            'entrySurfaceBreakdown' => self::toList($entrySurfaceBreakdown),
            'localeBreakdown' => self::toList($localeBreakdown),
            'intentBreakdown' => self::toList($intentBreakdown),
            'publicSurfaceBreakdown' => self::toList($publicSurfaceBreakdown),
            'paymentMethodBreakdown' => self::toList($paymentMethodBreakdown),
            'bookingStepBreakdown' => self::toList($bookingStepBreakdown),
            'errorCodeBreakdown' => self::toList($errorCodeBreakdown),
            'serviceCategoryBreakdown' => self::toList($serviceCategoryBreakdown),
            'serviceDetailBreakdown' => self::toList($serviceDetailBreakdown),
            'serviceBookingIntentBreakdown' => self::toList($serviceBookingIntentBreakdown),
            'serviceCheckoutBreakdown' => self::toList($serviceCheckoutBreakdown),
            'serviceConfirmedBreakdown' => self::toList($serviceConfirmedBreakdown),
            'serviceFunnel' => self::buildServiceFunnelBreakdown(
                $serviceDetailBreakdown,
                $serviceBookingIntentBreakdown,
                $serviceCheckoutBreakdown,
                $serviceConfirmedBreakdown
            ),
            'surfaceFunnel' => self::buildSurfaceFunnelBreakdown($surfaceFunnelBreakdown),
            'retention' => RetentionReportService::buildSnapshot($store),
            'idempotency' => self::buildIdempotencySnapshot($rawMetrics),
            'queueAssistant' => QueueAssistantMetricsStore::buildReport(),
            'generatedAt' => gmdate('c'),
        ];
    }

    public static function recordDerivedMetrics(string $event, array $labels): void
    {
        if (!class_exists('Metrics')) {
            return;
        }

        if ($event === 'checkout_abandon') {
            Metrics::increment('booking_funnel_dropoff_total', [
                'step' => AnalyticsLabelNormalizer::normalize($labels['checkout_step'] ?? 'unknown'),
                'reason' => AnalyticsLabelNormalizer::normalize($labels['reason'] ?? 'unknown'),
            ]);
        }
    }

    /**
     * @param array<string,string> $labels
     * @return array<string,string>
     */
    private static function extractEventLabels(string $event, array $params, array $labels): array
    {
        $serviceSlug = AnalyticsLabelNormalizer::normalize($params['service_slug'] ?? ($params['service'] ?? ''), '');
        if ($serviceSlug !== '') {
            $labels['service_slug'] = $serviceSlug;
        }

        $serviceCategory = AnalyticsLabelNormalizer::normalize($params['service_category'] ?? '', '');
        if ($serviceCategory !== '') {
            $labels['service_category'] = $serviceCategory;
        }

        $serviceAudience = AnalyticsLabelNormalizer::normalize($params['service_audience'] ?? '', '');
        if ($serviceAudience !== '') {
            $labels['service_audience'] = $serviceAudience;
        }

        $serviceIntent = AnalyticsLabelNormalizer::normalize($params['service_intent'] ?? ($params['catalog_intent'] ?? ''), '');
        if ($serviceIntent !== '') {
            $labels['service_intent'] = $serviceIntent;
        }

        $entryPoint = AnalyticsLabelNormalizer::normalize($params['entry_point'] ?? '', '');
        if ($entryPoint !== '') {
            $labels['entry_point'] = $entryPoint;
        }

        $entrySurface = AnalyticsLabelNormalizer::normalize(
            $params['entry_surface'] ?? ($params['entry_point'] ?? ''),
            ''
        );
        if ($entrySurface !== '') {
            $labels['entry_surface'] = $entrySurface;
        }

        $locale = AnalyticsLabelNormalizer::normalize($params['locale'] ?? '', '');
        if ($locale !== '') {
            $labels['locale'] = $locale;
        }

        $funnelStep = AnalyticsLabelNormalizer::normalize($params['funnel_step'] ?? '', '');
        if ($funnelStep !== '') {
            $labels['funnel_step'] = $funnelStep;
        }

        $intent = AnalyticsLabelNormalizer::normalize(
            $params['intent'] ?? ($params['service_intent'] ?? ($params['catalog_intent'] ?? '')),
            ''
        );
        if ($intent !== '') {
            $labels['intent'] = $intent;
        }

        $publicSurface = AnalyticsLabelNormalizer::normalize($params['public_surface'] ?? '', '');
        if ($publicSurface !== '') {
            $labels['public_surface'] = $publicSurface;
        }

        switch ($event) {
            case 'start_checkout':
                $labels['checkout_entry'] = AnalyticsLabelNormalizer::normalize($params['checkout_entry'] ?? 'unknown');
                break;
            case 'payment_method_selected':
            case 'booking_confirmed':
                $labels['payment_method'] = AnalyticsLabelNormalizer::normalize($params['payment_method'] ?? 'unknown');
                break;
            case 'checkout_abandon':
                $labels['checkout_step'] = AnalyticsLabelNormalizer::normalize($params['checkout_step'] ?? 'unknown');
                $labels['reason'] = AnalyticsLabelNormalizer::normalize($params['reason'] ?? 'unknown');
                break;
            case 'booking_step_completed':
                $labels['step'] = AnalyticsLabelNormalizer::normalize($params['step'] ?? 'unknown');
                break;
            case 'booking_error':
            case 'checkout_error':
                $labels['error_code'] = AnalyticsLabelNormalizer::normalize($params['error_code'] ?? 'unknown');
                break;
        }

        return $labels;
    }

    /**
     * @param array<string,int> $assoc
     * @return array<int,array{label:string,count:int}>
     */
    private static function toList(array $assoc): array
    {
        $rows = [];
        foreach ($assoc as $label => $value) {
            $rows[] = [
                'label' => (string) $label,
                'count' => (int) $value,
            ];
        }
        return $rows;
    }

    /**
     * @param array<string,array{viewBooking:int,startCheckout:int,bookingConfirmed:int}> $surfaceFunnelBreakdown
     * @return array<int,array<string,int|float|string>>
     */
    private static function buildSurfaceFunnelBreakdown(array $surfaceFunnelBreakdown): array
    {
        $rows = [];
        foreach ($surfaceFunnelBreakdown as $surface => $totals) {
            $viewBooking = (int) ($totals['viewBooking'] ?? 0);
            $startCheckout = (int) ($totals['startCheckout'] ?? 0);
            $bookingConfirmed = (int) ($totals['bookingConfirmed'] ?? 0);

            $rows[] = [
                'surface' => (string) $surface,
                'viewBooking' => $viewBooking,
                'startCheckout' => $startCheckout,
                'bookingConfirmed' => $bookingConfirmed,
                'startRatePct' => $viewBooking > 0 ? round(($startCheckout / $viewBooking) * 100, 1) : 0.0,
                'confirmedRatePct' => $startCheckout > 0 ? round(($bookingConfirmed / $startCheckout) * 100, 1) : 0.0,
            ];
        }

        usort($rows, static function (array $a, array $b): int {
            $confirmedA = (int) ($a['bookingConfirmed'] ?? 0);
            $confirmedB = (int) ($b['bookingConfirmed'] ?? 0);
            if ($confirmedA !== $confirmedB) {
                return $confirmedB <=> $confirmedA;
            }

            $startA = (int) ($a['startCheckout'] ?? 0);
            $startB = (int) ($b['startCheckout'] ?? 0);
            if ($startA !== $startB) {
                return $startB <=> $startA;
            }

            return strcmp((string) ($a['surface'] ?? ''), (string) ($b['surface'] ?? ''));
        });

        return $rows;
    }

    /**
     * @param array<string,int> $serviceDetailBreakdown
     * @param array<string,int> $serviceBookingIntentBreakdown
     * @param array<string,int> $serviceCheckoutBreakdown
     * @param array<string,int> $serviceConfirmedBreakdown
     * @return array<int,array<string,int|float|string>>
     */
    private static function buildServiceFunnelBreakdown(
        array $serviceDetailBreakdown,
        array $serviceBookingIntentBreakdown,
        array $serviceCheckoutBreakdown,
        array $serviceConfirmedBreakdown
    ): array {
        $serviceKeys = array_values(array_unique(array_merge(
            array_keys($serviceDetailBreakdown),
            array_keys($serviceBookingIntentBreakdown),
            array_keys($serviceCheckoutBreakdown),
            array_keys($serviceConfirmedBreakdown)
        )));

        $rows = [];
        foreach ($serviceKeys as $serviceSlug) {
            $detailViews = (int) ($serviceDetailBreakdown[$serviceSlug] ?? 0);
            $bookingIntent = (int) ($serviceBookingIntentBreakdown[$serviceSlug] ?? 0);
            $checkoutStarts = (int) ($serviceCheckoutBreakdown[$serviceSlug] ?? 0);
            $bookingConfirmed = (int) ($serviceConfirmedBreakdown[$serviceSlug] ?? 0);

            $rows[] = [
                'serviceSlug' => (string) $serviceSlug,
                'detailViews' => $detailViews,
                'bookingIntent' => $bookingIntent,
                'checkoutStarts' => $checkoutStarts,
                'bookingConfirmed' => $bookingConfirmed,
                'intentToCheckoutPct' => $bookingIntent > 0 ? round(($checkoutStarts / $bookingIntent) * 100, 1) : 0.0,
                'checkoutToConfirmedPct' => $checkoutStarts > 0 ? round(($bookingConfirmed / $checkoutStarts) * 100, 1) : 0.0,
                'detailToConfirmedPct' => $detailViews > 0 ? round(($bookingConfirmed / $detailViews) * 100, 1) : 0.0,
            ];
        }

        usort($rows, static function (array $a, array $b): int {
            $confirmedA = (int) ($a['bookingConfirmed'] ?? 0);
            $confirmedB = (int) ($b['bookingConfirmed'] ?? 0);
            if ($confirmedA !== $confirmedB) {
                return $confirmedB <=> $confirmedA;
            }

            $detailA = (int) ($a['detailViews'] ?? 0);
            $detailB = (int) ($b['detailViews'] ?? 0);
            if ($detailA !== $detailB) {
                return $detailB <=> $detailA;
            }

            return strcmp((string) ($a['serviceSlug'] ?? ''), (string) ($b['serviceSlug'] ?? ''));
        });

        return $rows;
    }

    /**
     * @return array<string,int|float>
     */
    private static function buildIdempotencySnapshot(string $rawMetrics): array
    {
        $series = PrometheusCounterParser::parseCounterSeries($rawMetrics, 'booking_idempotency_events_total');
        $counts = [
            'new' => 0,
            'replay' => 0,
            'conflict' => 0,
            'unknown' => 0,
        ];

        foreach ($series as $row) {
            $labels = is_array($row['labels'] ?? null) ? $row['labels'] : [];
            $value = (int) round((float) ($row['value'] ?? 0));
            if ($value <= 0) {
                continue;
            }

            $outcome = AnalyticsLabelNormalizer::normalize($labels['outcome'] ?? 'unknown');
            if (!isset($counts[$outcome])) {
                $counts['unknown'] += $value;
                continue;
            }
            $counts[$outcome] += $value;
        }

        $requestsWithKey = $counts['new'] + $counts['replay'] + $counts['conflict'] + $counts['unknown'];

        return [
            'requestsWithKey' => $requestsWithKey,
            'new' => $counts['new'],
            'replay' => $counts['replay'],
            'conflict' => $counts['conflict'],
            'unknown' => $counts['unknown'],
            'conflictRatePct' => $requestsWithKey > 0 ? round(($counts['conflict'] / $requestsWithKey) * 100, 2) : 0.0,
            'replayRatePct' => $requestsWithKey > 0 ? round(($counts['replay'] / $requestsWithKey) * 100, 2) : 0.0,
        ];
    }
}

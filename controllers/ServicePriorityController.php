<?php

declare(strict_types=1);

class ServicePriorityController
{
    public static function index(array $context): void
    {
        $catalog = self::loadCatalog();
        $params = self::resolveParams();
        $services = self::normalizeServices($catalog['services']);
        $signalsPayload = self::loadFunnelSignals($context);
        $signalsByService = $signalsPayload['map'];
        $hasSignals = $signalsPayload['hasSignals'];

        $filteredServices = array_values(array_filter(
            $services,
            static function (array $service) use ($params): bool {
                if ($params['category'] !== '' && $params['category'] !== (string) ($service['category'] ?? '')) {
                    return false;
                }
                if ($params['audience'] !== '' && !in_array($params['audience'], (array) ($service['audience'] ?? []), true)) {
                    return false;
                }
                return true;
            }
        ));

        $rankedServices = [];
        foreach ($filteredServices as $service) {
            $metricSlug = self::normalizeMetricToken((string) ($service['slug'] ?? ''));
            $signal = $signalsByService[$metricSlug] ?? self::emptySignal();
            $rankedServices[] = self::buildServiceRankRow($service, $signal, $params['sort'], $params['audience']);
        }

        usort($rankedServices, static function (array $a, array $b): int {
            $scoreA = (float) ($a['score'] ?? 0.0);
            $scoreB = (float) ($b['score'] ?? 0.0);
            if ($scoreA !== $scoreB) {
                return $scoreB <=> $scoreA;
            }

            $confirmedA = (int) (($a['signals']['bookingConfirmed'] ?? 0));
            $confirmedB = (int) (($b['signals']['bookingConfirmed'] ?? 0));
            if ($confirmedA !== $confirmedB) {
                return $confirmedB <=> $confirmedA;
            }

            return strcmp((string) ($a['slug'] ?? ''), (string) ($b['slug'] ?? ''));
        });

        $position = 1;
        foreach ($rankedServices as &$row) {
            $row['recommendedOrder'] = $position++;
        }
        unset($row);

        $categories = self::buildCategoryRows($rankedServices, $params['categoryLimit']);
        $servicesLimited = array_slice($rankedServices, 0, $params['limit']);
        $featured = array_values(array_map(
            static fn (array $row): string => (string) ($row['slug'] ?? ''),
            array_slice($servicesLimited, 0, $params['featuredLimit'])
        ));

        $prioritySource = self::resolvePrioritySource($catalog['source'], $hasSignals);
        header('Cache-Control: public, max-age=180, s-maxage=180');
        json_response([
            'ok' => true,
            'data' => [
                'categories' => $categories,
                'services' => $servicesLimited,
                'featured' => $featured,
            ],
            'meta' => [
                'source' => $prioritySource,
                'catalogSource' => $catalog['source'],
                'catalogVersion' => $catalog['version'],
                'timezone' => $catalog['timezone'],
                'serviceCount' => count($filteredServices),
                'categoryCount' => count($categories),
                'sort' => $params['sort'],
                'audience' => $params['audience'],
                'generatedAt' => gmdate('c'),
            ],
        ], 200);
    }

    /**
     * @return array{source:string,version:string,timezone:string,services:array<int,mixed>}
     */
    private static function loadCatalog(): array
    {
        $path = self::resolveCatalogPath();
        if ($path === '' || !is_file($path)) {
            return [
                'source' => 'missing',
                'version' => 'missing',
                'timezone' => 'America/Guayaquil',
                'services' => [],
            ];
        }

        $raw = file_get_contents($path);
        if ($raw === false || trim($raw) === '') {
            return [
                'source' => 'invalid',
                'version' => 'invalid',
                'timezone' => 'America/Guayaquil',
                'services' => [],
            ];
        }

        $decoded = json_decode($raw, true);
        if (!is_array($decoded)) {
            return [
                'source' => 'invalid',
                'version' => 'invalid',
                'timezone' => 'America/Guayaquil',
                'services' => [],
            ];
        }

        $services = isset($decoded['services']) && is_array($decoded['services']) ? $decoded['services'] : [];
        $version = is_string($decoded['version'] ?? null) ? trim((string) $decoded['version']) : '';
        $timezone = is_string($decoded['timezone'] ?? null) ? trim((string) $decoded['timezone']) : '';
        return [
            'source' => 'file',
            'version' => $version !== '' ? $version : 'unknown',
            'timezone' => $timezone !== '' ? $timezone : 'America/Guayaquil',
            'services' => $services,
        ];
    }

    private static function resolveCatalogPath(): string
    {
        $defaultPath = __DIR__ . '/../content/services.json';
        $override = getenv('PIELARMONIA_SERVICES_CATALOG_FILE');
        if (
            is_string($override) &&
            trim($override) !== '' &&
            defined('TESTING_ENV') &&
            TESTING_ENV === true
        ) {
            return trim($override);
        }
        return $defaultPath;
    }

    /**
     * @param array<int,mixed> $services
     * @return array<int,array<string,mixed>>
     */
    private static function normalizeServices(array $services): array
    {
        $normalized = [];
        foreach ($services as $item) {
            if (!is_array($item)) {
                continue;
            }
            $slug = self::normalizeToken($item['slug'] ?? '');
            if ($slug === '') {
                continue;
            }

            $category = self::normalizeToken($item['category'] ?? '');
            $subcategory = self::normalizeToken($item['subcategory'] ?? '');
            $audience = self::normalizeAudienceList($item['audience'] ?? []);
            $doctorProfile = self::normalizeTokenList($item['doctor_profile'] ?? []);
            $hero = is_string($item['hero'] ?? null) ? trim((string) $item['hero']) : '';
            $summary = is_string($item['summary'] ?? null) ? trim((string) $item['summary']) : '';

            $normalized[] = [
                'slug' => $slug,
                'metricSlug' => self::normalizeMetricToken($slug),
                'category' => $category,
                'subcategory' => $subcategory,
                'audience' => $audience,
                'doctor_profile' => $doctorProfile,
                'hero' => $hero,
                'summary' => $summary,
            ];
        }
        return $normalized;
    }

    /**
     * @return array{map:array<string,array<string,int|float>>,hasSignals:bool}
     */
    private static function loadFunnelSignals(array $context): array
    {
        $map = [];
        $hasSignals = false;
        if (!class_exists('AnalyticsController') || !method_exists('AnalyticsController', 'buildFunnelMetricsData')) {
            return ['map' => $map, 'hasSignals' => false];
        }

        $payload = AnalyticsController::buildFunnelMetricsData($context);
        $rows = isset($payload['serviceFunnel']) && is_array($payload['serviceFunnel']) ? $payload['serviceFunnel'] : [];
        foreach ($rows as $row) {
            if (!is_array($row)) {
                continue;
            }

            $slug = self::normalizeMetricToken((string) ($row['serviceSlug'] ?? ''));
            if ($slug === '') {
                continue;
            }

            $detailViews = (int) ($row['detailViews'] ?? 0);
            $bookingIntent = (int) ($row['bookingIntent'] ?? 0);
            $checkoutStarts = (int) ($row['checkoutStarts'] ?? 0);
            $bookingConfirmed = (int) ($row['bookingConfirmed'] ?? 0);

            if ($detailViews > 0 || $bookingIntent > 0 || $checkoutStarts > 0 || $bookingConfirmed > 0) {
                $hasSignals = true;
            }

            $map[$slug] = [
                'detailViews' => $detailViews,
                'bookingIntent' => $bookingIntent,
                'checkoutStarts' => $checkoutStarts,
                'bookingConfirmed' => $bookingConfirmed,
                'intentToCheckoutPct' => (float) ($row['intentToCheckoutPct'] ?? 0.0),
                'checkoutToConfirmedPct' => (float) ($row['checkoutToConfirmedPct'] ?? 0.0),
                'detailToConfirmedPct' => (float) ($row['detailToConfirmedPct'] ?? 0.0),
            ];
        }

        return [
            'map' => $map,
            'hasSignals' => $hasSignals,
        ];
    }

    /**
     * @param array<string,mixed> $service
     * @param array<string,int|float> $signal
     * @return array<string,mixed>
     */
    private static function buildServiceRankRow(array $service, array $signal, string $sortMode, string $audienceFilter): array
    {
        $baseWeight = self::resolveCategoryBaseWeight((string) ($service['category'] ?? ''));
        $audienceBoost = self::resolveAudienceBoost((array) ($service['audience'] ?? []), $audienceFilter);
        $volumeScore = self::resolveVolumeScore($signal);
        $conversionScore = self::resolveConversionScore($signal);

        $score = $baseWeight + $audienceBoost;
        if ($sortMode === 'volume') {
            $score += $volumeScore;
        } elseif ($sortMode === 'conversion') {
            $score += ($conversionScore * 2.0);
        } else {
            $score += ($volumeScore * 0.65) + ($conversionScore * 0.8);
        }

        $reason = $sortMode === 'volume'
            ? 'volume_signals'
            : ($sortMode === 'conversion' ? 'conversion_signals' : 'hybrid_signals');
        if ($audienceFilter !== '') {
            $reason .= '_audience';
        }

        return [
            'slug' => (string) ($service['slug'] ?? ''),
            'category' => (string) ($service['category'] ?? ''),
            'subcategory' => (string) ($service['subcategory'] ?? ''),
            'audience' => array_values((array) ($service['audience'] ?? [])),
            'doctorProfile' => array_values((array) ($service['doctor_profile'] ?? [])),
            'hero' => (string) ($service['hero'] ?? ''),
            'summary' => (string) ($service['summary'] ?? ''),
            'score' => round($score, 2),
            'recommendationReason' => $reason,
            'signals' => [
                'detailViews' => (int) ($signal['detailViews'] ?? 0),
                'bookingIntent' => (int) ($signal['bookingIntent'] ?? 0),
                'checkoutStarts' => (int) ($signal['checkoutStarts'] ?? 0),
                'bookingConfirmed' => (int) ($signal['bookingConfirmed'] ?? 0),
            ],
            'rates' => [
                'intentToCheckoutPct' => round((float) ($signal['intentToCheckoutPct'] ?? 0.0), 1),
                'checkoutToConfirmedPct' => round((float) ($signal['checkoutToConfirmedPct'] ?? 0.0), 1),
                'detailToConfirmedPct' => round((float) ($signal['detailToConfirmedPct'] ?? 0.0), 1),
            ],
        ];
    }

    /**
     * @param array<int,array<string,mixed>> $rankedServices
     * @return array<int,array<string,mixed>>
     */
    private static function buildCategoryRows(array $rankedServices, int $categoryLimit): array
    {
        $grouped = [];
        foreach ($rankedServices as $service) {
            $category = (string) ($service['category'] ?? '');
            if ($category === '') {
                $category = 'general';
            }

            if (!isset($grouped[$category])) {
                $grouped[$category] = [
                    'category' => $category,
                    'score' => 0.0,
                    'servicesCount' => 0,
                    'detailViews' => 0,
                    'bookingIntent' => 0,
                    'checkoutStarts' => 0,
                    'bookingConfirmed' => 0,
                    'topServices' => [],
                ];
            }

            $grouped[$category]['score'] += (float) ($service['score'] ?? 0.0);
            $grouped[$category]['servicesCount']++;
            $grouped[$category]['detailViews'] += (int) ($service['signals']['detailViews'] ?? 0);
            $grouped[$category]['bookingIntent'] += (int) ($service['signals']['bookingIntent'] ?? 0);
            $grouped[$category]['checkoutStarts'] += (int) ($service['signals']['checkoutStarts'] ?? 0);
            $grouped[$category]['bookingConfirmed'] += (int) ($service['signals']['bookingConfirmed'] ?? 0);
            if (count($grouped[$category]['topServices']) < 3) {
                $grouped[$category]['topServices'][] = (string) ($service['slug'] ?? '');
            }
        }

        $rows = array_values($grouped);
        usort($rows, static function (array $a, array $b): int {
            $scoreA = (float) ($a['score'] ?? 0.0);
            $scoreB = (float) ($b['score'] ?? 0.0);
            if ($scoreA !== $scoreB) {
                return $scoreB <=> $scoreA;
            }
            return strcmp((string) ($a['category'] ?? ''), (string) ($b['category'] ?? ''));
        });

        $rows = array_slice($rows, 0, $categoryLimit);
        $position = 1;
        foreach ($rows as &$row) {
            $row['score'] = round((float) ($row['score'] ?? 0.0), 2);
            $row['intentToCheckoutPct'] = $row['bookingIntent'] > 0
                ? round(((float) $row['checkoutStarts'] / (float) $row['bookingIntent']) * 100, 1)
                : 0.0;
            $row['checkoutToConfirmedPct'] = $row['checkoutStarts'] > 0
                ? round(((float) $row['bookingConfirmed'] / (float) $row['checkoutStarts']) * 100, 1)
                : 0.0;
            $row['recommendedOrder'] = $position++;
        }
        unset($row);

        return $rows;
    }

    /**
     * @return array{category:string,audience:string,sort:string,limit:int,categoryLimit:int,featuredLimit:int}
     */
    private static function resolveParams(): array
    {
        $category = self::normalizeToken($_GET['category'] ?? '');
        $audience = self::normalizeAudienceToken($_GET['audience'] ?? '');
        $sort = self::normalizeToken($_GET['sort'] ?? 'hybrid');
        if (!in_array($sort, ['hybrid', 'volume', 'conversion'], true)) {
            $sort = 'hybrid';
        }

        $limit = isset($_GET['limit']) ? (int) $_GET['limit'] : 12;
        if ($limit < 1) {
            $limit = 1;
        }
        if ($limit > 50) {
            $limit = 50;
        }

        $categoryLimit = isset($_GET['categoryLimit']) ? (int) $_GET['categoryLimit'] : 8;
        if ($categoryLimit < 1) {
            $categoryLimit = 1;
        }
        if ($categoryLimit > 20) {
            $categoryLimit = 20;
        }

        $featuredLimit = isset($_GET['featuredLimit']) ? (int) $_GET['featuredLimit'] : 3;
        if ($featuredLimit < 1) {
            $featuredLimit = 1;
        }
        if ($featuredLimit > 6) {
            $featuredLimit = 6;
        }

        return [
            'category' => $category,
            'audience' => $audience,
            'sort' => $sort,
            'limit' => $limit,
            'categoryLimit' => $categoryLimit,
            'featuredLimit' => $featuredLimit,
        ];
    }

    private static function resolvePrioritySource(string $catalogSource, bool $hasSignals): string
    {
        if ($catalogSource !== 'file') {
            return $catalogSource;
        }
        return $hasSignals ? 'catalog+funnel' : 'catalog_only';
    }

    private static function resolveCategoryBaseWeight(string $category): float
    {
        if (str_contains($category, 'pediatric') || str_contains($category, 'ninos') || str_contains($category, 'children')) {
            return 40.0;
        }
        if (str_contains($category, 'clinical') || str_contains($category, 'diagnostic') || str_contains($category, 'medic')) {
            return 32.0;
        }
        if (str_contains($category, 'telemed')) {
            return 26.0;
        }
        if (str_contains($category, 'aesthetic') || str_contains($category, 'estet')) {
            return 20.0;
        }
        return 24.0;
    }

    /**
     * @param array<int,string> $audience
     */
    private static function resolveAudienceBoost(array $audience, string $audienceFilter): float
    {
        $boost = 0.0;
        if ($audienceFilter !== '' && in_array($audienceFilter, $audience, true)) {
            $boost += 18.0;
        }
        if (in_array('children', $audience, true)) {
            $boost += 8.0;
        }
        if (in_array('adolescents', $audience, true)) {
            $boost += 4.0;
        }
        if (in_array('seniors', $audience, true)) {
            $boost += 2.0;
        }
        return $boost;
    }

    /**
     * @param array<string,int|float> $signal
     */
    private static function resolveVolumeScore(array $signal): float
    {
        return
            ((float) ($signal['detailViews'] ?? 0) * 0.15) +
            ((float) ($signal['bookingIntent'] ?? 0) * 2.5) +
            ((float) ($signal['checkoutStarts'] ?? 0) * 3.5) +
            ((float) ($signal['bookingConfirmed'] ?? 0) * 5.0);
    }

    /**
     * @param array<string,int|float> $signal
     */
    private static function resolveConversionScore(array $signal): float
    {
        return
            ((float) ($signal['intentToCheckoutPct'] ?? 0.0) * 1.0) +
            ((float) ($signal['checkoutToConfirmedPct'] ?? 0.0) * 1.2) +
            ((float) ($signal['detailToConfirmedPct'] ?? 0.0) * 1.4);
    }

    /**
     * @return array{detailViews:int,bookingIntent:int,checkoutStarts:int,bookingConfirmed:int,intentToCheckoutPct:float,checkoutToConfirmedPct:float,detailToConfirmedPct:float}
     */
    private static function emptySignal(): array
    {
        return [
            'detailViews' => 0,
            'bookingIntent' => 0,
            'checkoutStarts' => 0,
            'bookingConfirmed' => 0,
            'intentToCheckoutPct' => 0.0,
            'checkoutToConfirmedPct' => 0.0,
            'detailToConfirmedPct' => 0.0,
        ];
    }

    private static function normalizeToken(mixed $value): string
    {
        if (!is_string($value)) {
            return '';
        }
        $normalized = self::toLower(trim($value));
        if ($normalized === '') {
            return '';
        }
        return preg_replace('/\s+/', '-', $normalized) ?? '';
    }

    private static function normalizeMetricToken(mixed $value): string
    {
        if (!is_string($value)) {
            return '';
        }
        $normalized = self::toLower(trim($value));
        if ($normalized === '') {
            return '';
        }
        $normalized = preg_replace('/[^a-z0-9]+/', '_', $normalized) ?? '';
        return trim((string) $normalized, '_');
    }

    /**
     * @param mixed $values
     * @return array<int,string>
     */
    private static function normalizeTokenList(mixed $values): array
    {
        if (!is_array($values)) {
            return [];
        }
        $normalized = [];
        foreach ($values as $value) {
            $token = self::normalizeToken($value);
            if ($token === '') {
                continue;
            }
            $normalized[$token] = true;
        }
        return array_keys($normalized);
    }

    /**
     * @param mixed $values
     * @return array<int,string>
     */
    private static function normalizeAudienceList(mixed $values): array
    {
        if (!is_array($values)) {
            return [];
        }
        $normalized = [];
        foreach ($values as $value) {
            $token = self::normalizeAudienceToken($value);
            if ($token === '') {
                continue;
            }
            $normalized[$token] = true;
        }
        return array_keys($normalized);
    }

    private static function normalizeAudienceToken(mixed $value): string
    {
        $token = self::normalizeToken($value);
        if ($token === '') {
            return '';
        }

        if (in_array($token, ['children', 'child', 'ninos', 'ninas', 'nin@', 'pediatric', 'pediatrico', 'pediatrica'], true)) {
            return 'children';
        }
        if (in_array($token, ['adolescents', 'adolescentes', 'teen', 'teens'], true)) {
            return 'adolescents';
        }
        if (in_array($token, ['adults', 'adultos', 'adulto'], true)) {
            return 'adults';
        }
        if (in_array($token, ['seniors', 'senior', 'mayores', 'adultos-mayores', 'adultos_mayores'], true)) {
            return 'seniors';
        }

        return $token;
    }

    private static function toLower(string $value): string
    {
        if (function_exists('mb_strtolower')) {
            return mb_strtolower($value, 'UTF-8');
        }
        return strtolower($value);
    }
}

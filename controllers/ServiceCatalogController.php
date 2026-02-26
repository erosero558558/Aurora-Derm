<?php

declare(strict_types=1);

class ServiceCatalogController
{
    public static function index(array $context): void
    {
        $catalog = self::loadCatalog();
        $services = self::normalizeServices($catalog['services']);
        $filters = self::resolveFilters();

        $filtered = array_values(array_filter($services, static function (array $service) use ($filters): bool {
            if ($filters['slug'] !== '' && strcasecmp((string) ($service['slug'] ?? ''), $filters['slug']) !== 0) {
                return false;
            }
            if ($filters['category'] !== '' && strcasecmp((string) ($service['category'] ?? ''), $filters['category']) !== 0) {
                return false;
            }
            if ($filters['subcategory'] !== '' && strcasecmp((string) ($service['subcategory'] ?? ''), $filters['subcategory']) !== 0) {
                return false;
            }
            if ($filters['audience'] !== '' && !in_array($filters['audience'], $service['audience'], true)) {
                return false;
            }
            if ($filters['doctor'] !== '' && !in_array($filters['doctor'], $service['doctor_profile'], true)) {
                return false;
            }
            if ($filters['q'] !== '') {
                $searchable = self::toLower(
                    implode(' ', [
                        (string) ($service['slug'] ?? ''),
                        (string) ($service['hero'] ?? ''),
                        (string) ($service['summary'] ?? ''),
                    ])
                );
                if (!self::contains($searchable, $filters['q'])) {
                    return false;
                }
            }
            return true;
        }));

        $total = count($services);
        $filteredTotal = count($filtered);
        $limit = $filters['limit'];
        $offset = $filters['offset'];
        if ($offset > $filteredTotal) {
            $offset = $filteredTotal;
        }
        $returned = array_slice($filtered, $offset, $limit);

        header('Cache-Control: public, max-age=300, s-maxage=300');
        json_response([
            'ok' => true,
            'data' => $returned,
            'meta' => [
                'source' => $catalog['source'],
                'version' => $catalog['version'],
                'timezone' => $catalog['timezone'],
                'total' => $total,
                'filtered' => $filteredTotal,
                'returned' => count($returned),
                'offset' => $offset,
                'limit' => $limit,
                'filters' => [
                    'slug' => $filters['slug'],
                    'category' => $filters['category'],
                    'subcategory' => $filters['subcategory'],
                    'audience' => $filters['audience'],
                    'doctor' => $filters['doctor'],
                    'q' => $filters['qRaw'],
                ],
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

        $services = $decoded['services'] ?? [];
        if (!is_array($services)) {
            $services = [];
        }

        return [
            'source' => 'file',
            'version' => is_string($decoded['version'] ?? null) ? (string) $decoded['version'] : 'unknown',
            'timezone' => is_string($decoded['timezone'] ?? null) && trim((string) $decoded['timezone']) !== ''
                ? (string) $decoded['timezone']
                : 'America/Guayaquil',
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

            $audience = self::normalizeTokenList($item['audience'] ?? []);
            $doctorProfile = self::normalizeTokenList($item['doctor_profile'] ?? []);

            $normalized[] = [
                'slug' => $slug,
                'category' => self::normalizeToken($item['category'] ?? ''),
                'subcategory' => self::normalizeToken($item['subcategory'] ?? ''),
                'audience' => $audience,
                'hero' => is_string($item['hero'] ?? null) ? trim((string) $item['hero']) : '',
                'summary' => is_string($item['summary'] ?? null) ? trim((string) $item['summary']) : '',
                'indications' => self::normalizeStringList($item['indications'] ?? []),
                'contraindications' => self::normalizeStringList($item['contraindications'] ?? []),
                'duration' => is_string($item['duration'] ?? null) ? trim((string) $item['duration']) : '',
                'price_from' => is_numeric($item['price_from'] ?? null) ? (float) $item['price_from'] : null,
                'iva' => is_numeric($item['iva'] ?? null) ? (float) $item['iva'] : null,
                'doctor_profile' => $doctorProfile,
                'faq' => self::normalizeStringList($item['faq'] ?? []),
                'cta' => is_array($item['cta'] ?? null) ? $item['cta'] : [],
            ];
        }
        return $normalized;
    }

    /**
     * @return array{slug:string,category:string,subcategory:string,audience:string,doctor:string,q:string,qRaw:string,limit:int,offset:int}
     */
    private static function resolveFilters(): array
    {
        $qRaw = isset($_GET['q']) ? trim((string) $_GET['q']) : '';
        $q = $qRaw !== '' ? self::toLower($qRaw) : '';

        $limitRaw = isset($_GET['limit']) ? (int) $_GET['limit'] : 200;
        if ($limitRaw < 1) {
            $limitRaw = 1;
        }
        if ($limitRaw > 200) {
            $limitRaw = 200;
        }

        $offsetRaw = isset($_GET['offset']) ? (int) $_GET['offset'] : 0;
        if ($offsetRaw < 0) {
            $offsetRaw = 0;
        }

        return [
            'slug' => self::normalizeToken($_GET['slug'] ?? ''),
            'category' => self::normalizeToken($_GET['category'] ?? ''),
            'subcategory' => self::normalizeToken($_GET['subcategory'] ?? ''),
            'audience' => self::normalizeToken($_GET['audience'] ?? ''),
            'doctor' => self::normalizeToken($_GET['doctor'] ?? ''),
            'q' => $q,
            'qRaw' => $qRaw,
            'limit' => $limitRaw,
            'offset' => $offsetRaw,
        ];
    }

    private static function normalizeToken(mixed $value): string
    {
        if (!is_string($value)) {
            return '';
        }
        $normalized = self::toLower(trim($value));
        return preg_replace('/\s+/', '-', $normalized) ?? '';
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
    private static function normalizeStringList(mixed $values): array
    {
        if (!is_array($values)) {
            return [];
        }
        $normalized = [];
        foreach ($values as $value) {
            if (!is_string($value)) {
                continue;
            }
            $trimmed = trim($value);
            if ($trimmed === '') {
                continue;
            }
            $normalized[] = $trimmed;
        }
        return $normalized;
    }

    private static function toLower(string $value): string
    {
        if (function_exists('mb_strtolower')) {
            return mb_strtolower($value, 'UTF-8');
        }
        return strtolower($value);
    }

    private static function contains(string $haystack, string $needle): bool
    {
        if ($needle === '') {
            return true;
        }
        if (function_exists('mb_strpos')) {
            return mb_strpos($haystack, $needle, 0, 'UTF-8') !== false;
        }
        return strpos($haystack, $needle) !== false;
    }
}

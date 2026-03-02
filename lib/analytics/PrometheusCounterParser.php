<?php

declare(strict_types=1);

final class PrometheusCounterParser
{
    /**
     * @return array<int,array{labels:array<string,string>,value:float}>
     */
    public static function parseCounterSeries(string $metricsText, string $metricName): array
    {
        $series = [];
        if ($metricName === '' || trim($metricsText) === '') {
            return $series;
        }

        $pattern = '/^' . preg_quote($metricName, '/') . '(?:\{([^}]*)\})?\s+([+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?)$/';
        $lines = preg_split('/\R/', $metricsText) ?: [];

        foreach ($lines as $line) {
            $line = trim((string) $line);
            if ($line === '' || $line[0] === '#') {
                continue;
            }

            if (preg_match($pattern, $line, $match) !== 1) {
                continue;
            }

            $labelsRaw = isset($match[1]) ? (string) $match[1] : '';
            $valueRaw = isset($match[2]) ? (string) $match[2] : '0';
            $value = is_numeric($valueRaw) ? (float) $valueRaw : 0.0;

            $series[] = [
                'labels' => self::parseLabels($labelsRaw),
                'value' => $value,
            ];
        }

        return $series;
    }

    /**
     * @return array<string,string>
     */
    public static function parseLabels(string $rawLabels): array
    {
        $labels = [];
        if ($rawLabels === '') {
            return $labels;
        }

        $matchCount = preg_match_all('/([a-zA-Z_][a-zA-Z0-9_]*)="((?:[^"\\\\]|\\\\.)*)"/', $rawLabels, $matches, PREG_SET_ORDER);
        if (!is_int($matchCount) || $matchCount < 1) {
            return $labels;
        }

        foreach ($matches as $match) {
            $key = isset($match[1]) ? (string) $match[1] : '';
            $value = isset($match[2]) ? (string) $match[2] : '';
            if ($key === '') {
                continue;
            }
            $labels[$key] = stripcslashes($value);
        }

        return $labels;
    }
}

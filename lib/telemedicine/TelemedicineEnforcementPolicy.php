<?php

declare(strict_types=1);

final class TelemedicineEnforcementPolicy
{
    private const OVERRIDE_DECISIONS = [
        'approve_remote',
        'request_more_info',
        'escalate_presential',
    ];

    public static function snapshot(): array
    {
        return [
            'shadowModeEnabled' => self::readEnvBool('PIELARMONIA_TELEMED_V2_SHADOW', true),
            'enforceUnsuitable' => self::readEnvBool('PIELARMONIA_TELEMED_V2_ENFORCE_UNSUITABLE', false),
            'enforceReviewRequired' => self::readEnvBool('PIELARMONIA_TELEMED_V2_ENFORCE_REVIEW_REQUIRED', false),
            'allowDecisionOverride' => self::readEnvBool('PIELARMONIA_TELEMED_V2_ALLOW_DECISION_OVERRIDE', true),
        ];
    }

    public static function evaluateBooking(?array $intake, array $appointment): array
    {
        $policy = self::snapshot();
        if (!is_array($intake)) {
            return self::allow('', 'none', $policy);
        }

        $suitability = self::normalizeSuitability((string) ($intake['suitability'] ?? ''));
        $reviewDecision = self::normalizeDecision(
            (string) ($intake['reviewDecision'] ?? $intake['encounterPlan']['reviewDecision'] ?? '')
        );

        if ($policy['allowDecisionOverride']) {
            if ($reviewDecision === 'approve_remote') {
                return self::allow($suitability !== '' ? $suitability : 'fit', $reviewDecision, $policy);
            }
            if ($reviewDecision === 'request_more_info') {
                return self::block(
                    409,
                    'telemedicine_review_required',
                    'Se requiere mas informacion clinica antes de confirmar la telemedicina.',
                    'manual_request_more_info',
                    'review_required',
                    $reviewDecision,
                    $policy
                );
            }
            if ($reviewDecision === 'escalate_presential') {
                return self::block(
                    422,
                    'telemedicine_unsuitable',
                    'El caso debe escalarse a consulta presencial.',
                    'manual_escalate_presential',
                    'unsuitable',
                    $reviewDecision,
                    $policy
                );
            }
        }

        if ($suitability === 'unsuitable' && $policy['enforceUnsuitable']) {
            return self::block(
                422,
                'telemedicine_unsuitable',
                'El caso no es apto para telemedicina.',
                'unsuitable',
                $suitability,
                $reviewDecision,
                $policy
            );
        }

        if ($suitability === 'review_required' && $policy['enforceReviewRequired']) {
            return self::block(
                409,
                'telemedicine_review_required',
                'El caso requiere revision clinica previa.',
                'review_required',
                $suitability,
                $reviewDecision,
                $policy
            );
        }

        return self::allow($suitability, $reviewDecision, $policy);
    }

    private static function allow(string $suitability, string $reviewDecision, array $policy): array
    {
        return [
            'allowed' => true,
            'status' => 200,
            'error' => '',
            'errorCode' => '',
            'reason' => '',
            'suitability' => $suitability,
            'reviewDecision' => $reviewDecision,
            'policy' => $policy,
        ];
    }

    private static function block(
        int $status,
        string $errorCode,
        string $error,
        string $reason,
        string $suitability,
        string $reviewDecision,
        array $policy
    ): array {
        return [
            'allowed' => false,
            'status' => $status,
            'error' => $error,
            'errorCode' => $errorCode,
            'reason' => $reason,
            'suitability' => $suitability,
            'reviewDecision' => $reviewDecision,
            'policy' => $policy,
        ];
    }

    private static function normalizeSuitability(string $value): string
    {
        $normalized = strtolower(trim($value));
        if (in_array($normalized, ['fit', 'review_required', 'unsuitable'], true)) {
            return $normalized;
        }

        return '';
    }

    private static function normalizeDecision(string $value): string
    {
        $normalized = strtolower(trim($value));
        if (in_array($normalized, self::OVERRIDE_DECISIONS, true)) {
            return $normalized;
        }

        return 'none';
    }

    private static function readEnvBool(string $key, bool $default): bool
    {
        $raw = getenv($key);
        if (!is_string($raw) || trim($raw) === '') {
            return $default;
        }

        $parsed = filter_var($raw, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
        if ($parsed === null) {
            return $default;
        }

        return $parsed;
    }
}

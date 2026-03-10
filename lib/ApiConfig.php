<?php

declare(strict_types=1);

/**
 * Configuration for the API.
 */
class ApiConfig
{
    public static function getRateLimits(): array
    {
        return [
            // Public GET - High volume
            'content:GET' => [120, 60],
            'features:GET' => [60, 60],
            'public-runtime-config:GET' => [60, 60],
            'availability:GET' => [60, 60],
            'reviews:GET' => [60, 60],
            'booked-slots:GET' => [60, 60],
            'queue-state:GET' => [180, 60],
            'services-catalog:GET' => [60, 60],
            'service-priorities:GET' => [60, 60],
            'payment-config:GET' => [60, 60],
            'monitoring-config:GET' => [60, 60],
            'metrics:GET' => [60, 60],
            'funnel-metrics:GET' => [60, 60],
            'retention-report:GET' => [30, 60],
            'lead-ai-queue:GET' => [60, 60],

            // Public POST - Actionable, lower volume to prevent spam
            'payment-intent:POST' => [10, 60],
            'payment-verify:POST' => [10, 60],
            'transfer-proof:POST' => [5, 60],
            'appointments:POST' => [5, 60],
            'reviews:POST' => [5, 60],
            'callbacks:POST' => [5, 60],
            'funnel-event:POST' => [120, 60],
            'queue-checkin:POST' => [20, 60],
            'queue-ticket:POST' => [20, 60],
            'lead-ai-result:POST' => [60, 60],
            'queue-surface-heartbeat:POST' => [240, 60],

            // Webhooks
            'stripe-webhook:POST' => [60, 60],

            // Reschedule
            'reschedule:GET' => [30, 60],
            'reschedule:PATCH' => [10, 60],

            // Admin (authenticated)
            'data:GET' => [60, 60],
            'import:POST' => [5, 60],
            'push-config:GET' => [60, 60],
            'push-subscribe:POST' => [15, 60],
            'push-unsubscribe:POST' => [15, 60],
            'push-test:POST' => [6, 60],
            'queue-call-next:POST' => [60, 60],
            'queue-ticket:PATCH' => [60, 60],
            'queue-reprint:POST' => [30, 60],

            // Predictions
            'predictions:GET' => [20, 60],
        ];
    }

    public static function getPublicEndpoints(): array
    {
        return [
            ['method' => 'GET', 'resource' => 'monitoring-config'],
            ['method' => 'GET', 'resource' => 'features'],
            ['method' => 'GET', 'resource' => 'public-runtime-config'],
            ['method' => 'GET', 'resource' => 'metrics'],
            ['method' => 'GET', 'resource' => 'payment-config'],
            ['method' => 'GET', 'resource' => 'availability'],
            ['method' => 'GET', 'resource' => 'reviews'],
            ['method' => 'GET', 'resource' => 'booked-slots'],
            ['method' => 'GET', 'resource' => 'queue-state'],
            ['method' => 'GET', 'resource' => 'services-catalog'],
            ['method' => 'GET', 'resource' => 'service-priorities'],
            ['method' => 'POST', 'resource' => 'payment-intent'],
            ['method' => 'POST', 'resource' => 'payment-verify'],
            ['method' => 'POST', 'resource' => 'transfer-proof'],
            ['method' => 'POST', 'resource' => 'stripe-webhook'],
            ['method' => 'POST', 'resource' => 'appointments'],
            ['method' => 'POST', 'resource' => 'callbacks'],
            ['method' => 'POST', 'resource' => 'reviews'],
            ['method' => 'POST', 'resource' => 'funnel-event'],
            ['method' => 'POST', 'resource' => 'queue-checkin'],
            ['method' => 'POST', 'resource' => 'queue-ticket'],
            ['method' => 'GET', 'resource' => 'lead-ai-queue'],
            ['method' => 'POST', 'resource' => 'lead-ai-result'],
            ['method' => 'POST', 'resource' => 'queue-surface-heartbeat'],
            ['method' => 'GET', 'resource' => 'reschedule'],
            ['method' => 'PATCH', 'resource' => 'reschedule'],
            ['method' => 'GET', 'resource' => 'content'],
            // Previously handled inline as public
            ['method' => 'GET', 'resource' => 'health'],
        ];
    }
}

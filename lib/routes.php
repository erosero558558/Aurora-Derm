<?php

declare(strict_types=1);

function register_api_routes(Router $router): void
{
    // v1 Routes
    $router->add('GET', 'monitoring-config', [SystemController::class, 'monitoringConfig']);
    $router->add('GET', 'features', [SystemController::class, 'features']);
    $router->add('GET', 'public-runtime-config', [SystemController::class, 'publicRuntimeConfig']);
    $router->add('GET', 'metrics', [SystemController::class, 'metrics']);
    $router->add('GET', 'predictions', [SystemController::class, 'predictions']);

    $router->add('GET', 'figo-config', [ConfigController::class, 'getFigoConfig']);
    $router->add('POST', 'figo-config', [ConfigController::class, 'updateFigoConfig']);
    $router->add('PUT', 'figo-config', [ConfigController::class, 'updateFigoConfig']);
    $router->add('PATCH', 'figo-config', [ConfigController::class, 'updateFigoConfig']);

    $router->add('GET', 'health', [HealthController::class, 'check']);

    $router->add('GET', 'payment-config', [PaymentController::class, 'config']);

    $router->add('GET', 'data', [AdminDataController::class, 'index']);
    $router->add('POST', 'import', [AdminDataController::class, 'import']);

    $router->add('GET', 'queue-state', [QueueController::class, 'state']);
    $router->add('POST', 'queue-checkin', [QueueController::class, 'checkin']);
    $router->add('POST', 'queue-ticket', [QueueController::class, 'ticket']);
    $router->add('POST', 'queue-call-next', [QueueController::class, 'callNext']);
    $router->add('PATCH', 'queue-ticket', [QueueController::class, 'patchTicket']);
    $router->add('POST', 'queue-reprint', [QueueController::class, 'reprint']);

    $router->add('GET', 'appointments', [AppointmentController::class, 'index']);
    $router->add('POST', 'appointments', [AppointmentController::class, 'store']);
    $router->add('PATCH', 'appointments', [AppointmentController::class, 'update']);
    $router->add('PUT', 'appointments', [AppointmentController::class, 'update']);

    $router->add('GET', 'callbacks', [CallbackController::class, 'index']);
    $router->add('POST', 'callbacks', [CallbackController::class, 'store']);
    $router->add('PATCH', 'callbacks', [CallbackController::class, 'update']);
    $router->add('PUT', 'callbacks', [CallbackController::class, 'update']);

    $router->add('GET', 'reviews', [ReviewController::class, 'index']);
    $router->add('POST', 'reviews', [ReviewController::class, 'store']);

    $router->add('GET', 'availability', [AvailabilityController::class, 'index']);
    $router->add('POST', 'availability', [AvailabilityController::class, 'update']);

    $router->add('GET', 'booked-slots', [AppointmentController::class, 'bookedSlots']);
    $router->add('POST', 'funnel-event', [AnalyticsController::class, 'recordEvent']);
    $router->add('GET', 'funnel-metrics', [AnalyticsController::class, 'getFunnelMetrics']);
    $router->add('GET', 'retention-report', [AnalyticsController::class, 'getRetentionReport']);

    $router->add('POST', 'payment-intent', [PaymentController::class, 'createIntent']);
    $router->add('POST', 'payment-verify', [PaymentController::class, 'verify']);
    $router->add('POST', 'transfer-proof', [PaymentController::class, 'transferProof']);
    $router->add('POST', 'stripe-webhook', [PaymentController::class, 'webhook']);

    $router->add('GET', 'reschedule', [AppointmentController::class, 'checkReschedule']);
    $router->add('PATCH', 'reschedule', [AppointmentController::class, 'processReschedule']);

    $router->add('GET', 'content', [ContentController::class, 'get']);
    $router->add('GET', 'services-catalog', [ServiceCatalogController::class, 'index']);
    $router->add('GET', 'service-priorities', [ServicePriorityController::class, 'index']);

    $router->add('GET', 'push-config', [PushController::class, 'config']);
    $router->add('POST', 'push-subscribe', [PushController::class, 'subscribe']);
    $router->add('POST', 'push-unsubscribe', [PushController::class, 'unsubscribe']);
    $router->add('POST', 'push-test', [PushController::class, 'test']);

    // v2 Routes
    $router->add('GET', 'health', [HealthController::class, 'check'], 'v2');
}

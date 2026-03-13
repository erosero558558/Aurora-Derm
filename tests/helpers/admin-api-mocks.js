// @ts-check

function fulfillJson(route, payload, status = 200) {
    return route.fulfill({
        status,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify(payload),
    });
}

function buildAdminAvailabilityMeta(overrides = {}) {
    return {
        source: 'store',
        mode: 'live',
        timezone: 'America/Guayaquil',
        calendarConfigured: true,
        calendarReachable: true,
        generatedAt: new Date().toISOString(),
        ...overrides,
    };
}

function buildAdminDataPayload(overrides = {}) {
    const {
        appointments = [],
        callbacks = [],
        reviews = [],
        availability = {},
        availabilityMeta = {},
        ...rest
    } = overrides;

    return {
        appointments: Array.isArray(appointments) ? appointments : [],
        callbacks: Array.isArray(callbacks) ? callbacks : [],
        reviews: Array.isArray(reviews) ? reviews : [],
        availability:
            availability && typeof availability === 'object'
                ? availability
                : {},
        availabilityMeta: buildAdminAvailabilityMeta(availabilityMeta),
        ...rest,
    };
}

function buildAdminFunnelMetricsFixture(overrides = {}) {
    const {
        summary: summaryOverride = {},
        queueAssistant: queueAssistantRaw = {},
        checkoutAbandonByStep = [],
        checkoutEntryBreakdown = [],
        paymentMethodBreakdown = [],
        bookingStepBreakdown = [],
        sourceBreakdown = [],
        abandonReasonBreakdown = [],
        errorCodeBreakdown = [],
        ...rest
    } = overrides;
    const queueAssistantOverride =
        queueAssistantRaw && typeof queueAssistantRaw === 'object'
            ? queueAssistantRaw
            : {};
    const todayOverride =
        queueAssistantOverride.today &&
        typeof queueAssistantOverride.today === 'object'
            ? queueAssistantOverride.today
            : {};
    const last7dOverride =
        queueAssistantOverride.last7d &&
        typeof queueAssistantOverride.last7d === 'object'
            ? queueAssistantOverride.last7d
            : {};

    return {
        summary: {
            viewBooking: 0,
            startCheckout: 0,
            bookingConfirmed: 0,
            checkoutAbandon: 0,
            startRatePct: 0,
            confirmedRatePct: 0,
            abandonRatePct: 0,
            ...summaryOverride,
        },
        checkoutAbandonByStep,
        checkoutEntryBreakdown,
        paymentMethodBreakdown,
        bookingStepBreakdown,
        sourceBreakdown,
        abandonReasonBreakdown,
        errorCodeBreakdown,
        queueAssistant: {
            today: {
                actioned: 0,
                resolvedWithoutHuman: 0,
                assistedResolutions: 0,
                escalated: 0,
                clinicalBlocked: 0,
                fallback: 0,
                errors: 0,
                latencyTotalMs: 0,
                latencySamples: 0,
                sessions: 0,
                usefulSessions: 0,
                avgLatencyMs: 0,
                ...todayOverride,
            },
            last7d: {
                actioned: 0,
                resolvedWithoutHuman: 0,
                assistedResolutions: 0,
                escalated: 0,
                clinicalBlocked: 0,
                fallback: 0,
                errors: 0,
                latencyTotalMs: 0,
                latencySamples: 0,
                sessions: 0,
                usefulSessions: 0,
                avgLatencyMs: 0,
                ...last7dOverride,
            },
            intentBreakdown: queueAssistantOverride.intentBreakdown || [],
            helpReasonBreakdown:
                queueAssistantOverride.helpReasonBreakdown || [],
            reviewOutcomeBreakdown:
                queueAssistantOverride.reviewOutcomeBreakdown || [],
            topIntent: queueAssistantOverride.topIntent || {
                label: '',
                count: 0,
            },
            topHelpReason: queueAssistantOverride.topHelpReason || {
                label: '',
                count: 0,
            },
            topReviewOutcome: queueAssistantOverride.topReviewOutcome || {
                label: '',
                count: 0,
            },
            generatedAt: queueAssistantOverride.generatedAt || '',
        },
        ...rest,
    };
}

function buildAdminFeaturesPayload(overrides = {}) {
    const { data: dataOverride = {}, ...rest } = overrides;

    return {
        ok: true,
        ...rest,
        data: {
            admin_sony_ui: true,
            ...dataOverride,
        },
    };
}

function buildAdminHealthPayload(overrides = {}) {
    return {
        ok: true,
        data: {},
        ...overrides,
    };
}

function buildAdminMonitoringConfigPayload(overrides = {}) {
    return {
        ok: true,
        data: {},
        ...overrides,
    };
}

function buildAdminDefaultPayload(overrides = {}) {
    return {
        ok: true,
        data: {},
        ...overrides,
    };
}

function parseRoutePayload(route, method) {
    if (!['PATCH', 'POST', 'PUT'].includes(method)) {
        return {};
    }

    try {
        return route.request().postDataJSON() || {};
    } catch (_error) {
        const rawBody = route.request().postData() || '';
        const params = new URLSearchParams(rawBody);
        return Object.fromEntries(params.entries());
    }
}

async function installBasicAdminApiMocks(page, options = {}) {
    const context = {
        data: buildAdminDataPayload(options.dataOverrides || {}),
        funnelMetrics: buildAdminFunnelMetricsFixture(
            options.funnelMetrics || {}
        ),
        featuresPayload: buildAdminFeaturesPayload(
            options.featuresPayload || {}
        ),
        healthPayload: buildAdminHealthPayload(options.healthPayload || {}),
        monitoringConfigPayload: buildAdminMonitoringConfigPayload(
            options.monitoringConfigPayload || {}
        ),
        defaultPayload: buildAdminDefaultPayload(options.defaultPayload || {}),
    };

    await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
        const url = new URL(route.request().url());
        const resource = url.searchParams.get('resource') || '';
        const method = route.request().method().toUpperCase();
        const payload = parseRoutePayload(route, method);
        const intendedMethod = String(payload._method || method).toUpperCase();

        if (typeof options.handleRoute === 'function') {
            const handled = await options.handleRoute({
                route,
                url,
                resource,
                method,
                payload,
                intendedMethod,
                context,
                fulfillJson,
            });

            if (handled) {
                return;
            }
        }

        if (resource === 'data') {
            return fulfillJson(route, { ok: true, data: context.data });
        }

        if (resource === 'features') {
            return fulfillJson(route, context.featuresPayload);
        }

        if (resource === 'funnel-metrics') {
            return fulfillJson(route, {
                ok: true,
                data: context.funnelMetrics,
            });
        }

        if (resource === 'availability') {
            return fulfillJson(route, {
                ok: true,
                data: context.data.availability,
                meta: context.data.availabilityMeta,
            });
        }

        if (resource === 'monitoring-config') {
            return fulfillJson(route, context.monitoringConfigPayload);
        }

        if (resource === 'health') {
            return fulfillJson(route, context.healthPayload);
        }

        return fulfillJson(route, context.defaultPayload);
    });

    return context;
}

module.exports = {
    buildAdminAvailabilityMeta,
    buildAdminDataPayload,
    buildAdminDefaultPayload,
    buildAdminFeaturesPayload,
    buildAdminFunnelMetricsFixture,
    buildAdminHealthPayload,
    buildAdminMonitoringConfigPayload,
    fulfillJson,
    installBasicAdminApiMocks,
};

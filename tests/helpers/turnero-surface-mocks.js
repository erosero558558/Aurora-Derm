// @ts-check

function fulfillJson(route, payload, status = 200) {
    return route.fulfill({
        status,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify(payload),
    });
}

function buildTurneroQueueStatePayload(overrides = {}) {
    return {
        updatedAt: new Date().toISOString(),
        waitingCount: 0,
        calledCount: 0,
        callingNow: [],
        nextTickets: [],
        ...overrides,
    };
}

async function installTurneroClinicProfileMock(page, payload, status = 200) {
    await page.route(
        /\/content\/turnero\/clinic-profile\.json(\?.*)?$/i,
        async (route) => fulfillJson(route, payload, status)
    );
}

async function installTurneroClinicProfileFailure(
    page,
    { status = 404, payload = { ok: false } } = {}
) {
    await page.route(
        /\/content\/turnero\/clinic-profile\.json(\?.*)?$/i,
        async (route) => fulfillJson(route, payload, status)
    );
}

async function installTurneroQueueStateMock(page, options = {}) {
    const {
        queueState = {},
        queueStateResponse = null,
        queueStateAbortReason = '',
        queueStateStatus = 200,
        defaultPayload = { ok: true, data: {} },
        handleApiRoute = null,
    } = options;
    let queueStateCalls = 0;

    await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        const resource = url.searchParams.get('resource') || '';
        const method = request.method().toUpperCase();

        if (typeof handleApiRoute === 'function') {
            const handled = await handleApiRoute({
                route,
                request,
                url,
                resource,
                method,
                queueStateCalls,
                fulfillJson,
                buildTurneroQueueStatePayload,
            });
            if (handled) {
                return;
            }
        }

        if (resource !== 'queue-state') {
            const payload =
                typeof defaultPayload === 'function'
                    ? await defaultPayload({
                          route,
                          request,
                          url,
                          resource,
                          method,
                          queueStateCalls,
                          buildTurneroQueueStatePayload,
                      })
                    : defaultPayload;
            return fulfillJson(route, payload);
        }

        queueStateCalls += 1;

        if (queueStateAbortReason) {
            return route.abort(queueStateAbortReason);
        }

        if (queueStateResponse !== null) {
            const responsePayload =
                typeof queueStateResponse === 'function'
                    ? await queueStateResponse({
                          route,
                          request,
                          url,
                          resource,
                          method,
                          callCount: queueStateCalls,
                          buildTurneroQueueStatePayload,
                      })
                    : queueStateResponse;
            const responseStatus =
                typeof queueStateStatus === 'function'
                    ? await queueStateStatus({
                          route,
                          request,
                          url,
                          resource,
                          method,
                          callCount: queueStateCalls,
                          buildTurneroQueueStatePayload,
                      })
                    : queueStateStatus;

            return fulfillJson(route, responsePayload, responseStatus);
        }

        const queueStateData =
            typeof queueState === 'function'
                ? await queueState({
                      route,
                      request,
                      url,
                      resource,
                      method,
                      callCount: queueStateCalls,
                      buildTurneroQueueStatePayload,
                  })
                : buildTurneroQueueStatePayload(queueState);

        return fulfillJson(
            route,
            {
                ok: true,
                data: queueStateData,
            },
            queueStateStatus
        );
    });

    return {
        getQueueStateCalls() {
            return queueStateCalls;
        },
    };
}

module.exports = {
    buildTurneroQueueStatePayload,
    fulfillJson,
    installTurneroClinicProfileFailure,
    installTurneroClinicProfileMock,
    installTurneroQueueStateMock,
};

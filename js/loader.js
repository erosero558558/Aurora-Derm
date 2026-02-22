import { debugLog, isConstrainedNetworkConnection } from '../src/apps/shared/utils.js';

const deferredModulePromises = new Map();

export function loadDeferredModule(options) {
    const {
        cacheKey,
        src,
        scriptDataAttribute,
        resolveModule,
        isModuleReady = (module) => !!module,
        onModuleReady,
        missingApiError = 'Deferred module loaded without expected API',
        loadError = 'No se pudo cargar el modulo diferido',
        logLabel = '',
    } = options || {};

    if (
        !cacheKey ||
        !src ||
        !scriptDataAttribute ||
        typeof resolveModule !== 'function'
    ) {
        return Promise.reject(
            new Error('Invalid deferred module configuration')
        );
    }

    const getReadyModule = () => {
        const module = resolveModule();
        if (!isModuleReady(module)) {
            return null;
        }

        if (typeof onModuleReady === 'function') {
            onModuleReady(module);
        }

        return module;
    };

    const readyModule = getReadyModule();
    if (readyModule) {
        return Promise.resolve(readyModule);
    }

    if (deferredModulePromises.has(cacheKey)) {
        return deferredModulePromises.get(cacheKey);
    }

    const promise = new Promise((resolve, reject) => {
        const handleLoad = () => {
            const module = getReadyModule();
            if (module) {
                resolve(module);
                return;
            }
            reject(new Error(missingApiError));
        };

        import(src)
            .then(() => {
                if (
                    !document.querySelector(
                        'script[' + scriptDataAttribute + '="true"]'
                    )
                ) {
                    const marker = document.createElement('script');
                    marker.setAttribute(scriptDataAttribute, 'true');
                    marker.dataset.dynamicImport = 'true';
                    document.head.appendChild(marker);
                }
                handleLoad();
            })
            .catch((err) => {
                debugLog(logLabel + ' dynamic import failed:', err);
                reject(new Error(loadError));
            });
    }).catch((error) => {
        deferredModulePromises.delete(cacheKey);
        if (logLabel) {
            debugLog(logLabel + ' load failed:', error);
        }
        throw error;
    });

    deferredModulePromises.set(cacheKey, promise);
    return promise;
}

export function scheduleDeferredTask(task, options = {}) {
    const {
        idleTimeout = 2000,
        fallbackDelay = 1200,
        skipOnConstrained = true,
        constrainedDelay = fallbackDelay,
    } = options;

    if (isConstrainedNetworkConnection()) {
        if (skipOnConstrained) {
            return false;
        }
        setTimeout(task, constrainedDelay);
        return true;
    }

    if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(task, { timeout: idleTimeout });
    } else {
        setTimeout(task, fallbackDelay);
    }

    return true;
}

export function bindWarmupTarget(selector, eventName, handler, passive = true) {
    const element = document.querySelector(selector);
    if (!element) {
        return false;
    }

    element.addEventListener(eventName, handler, { once: true, passive });
    return true;
}

export function createOnceTask(task) {
    let executed = false;

    return function runOnce() {
        if (executed) {
            return;
        }

        executed = true;
        task();
    };
}

export function createWarmupRunner(loadFn, options = {}) {
    const markWarmOnSuccess = options.markWarmOnSuccess === true;
    let warmed = false;

    return function warmup() {
        if (warmed || window.location.protocol === 'file:') {
            return;
        }

        if (markWarmOnSuccess) {
            Promise.resolve(loadFn())
                .then(() => {
                    warmed = true;
                })
                .catch(() => undefined);
            return;
        }

        warmed = true;
        Promise.resolve(loadFn()).catch(() => {
            warmed = false;
        });
    };
}

export function observeOnceWhenVisible(element, onVisible, options = {}) {
    const { threshold = 0.05, rootMargin = '0px', onNoObserver } = options;

    if (!element) {
        return false;
    }

    if (!('IntersectionObserver' in window)) {
        if (typeof onNoObserver === 'function') {
            onNoObserver();
        }
        return false;
    }

    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) {
                    return;
                }
                onVisible(entry);
                observer.disconnect();
            });
        },
        {
            threshold,
            rootMargin,
        }
    );

    observer.observe(element);
    return true;
}

export function withDeferredModule(loader, onReady) {
    return Promise.resolve()
        .then(() => loader())
        .then((module) => onReady(module));
}

export function runDeferredModule(loader, onReady, onError) {
    return withDeferredModule(loader, onReady).catch((error) => {
        if (typeof onError === 'function') {
            return onError(error);
        }
        return undefined;
    });
}

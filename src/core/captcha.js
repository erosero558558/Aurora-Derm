let captchaPromise = null;

function getCaptchaConfig() {
    const piel = window.Piel || {};
    const config = piel.config || {};
    const captcha = config.captcha || {};
    return {
        provider: String(captcha.provider || '').trim().toLowerCase(),
        siteKey: String(captcha.siteKey || '').trim(),
        scriptUrl: String(captcha.scriptUrl || '').trim(),
    };
}

function loadCaptchaScript() {
    if (captchaPromise) return captchaPromise;

    const config = getCaptchaConfig();
    if (!config.provider || !config.siteKey || !config.scriptUrl) {
        return Promise.resolve(null);
    }

    captchaPromise = new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = config.scriptUrl;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve(config.provider);
        script.onerror = () => resolve(null);
        document.head.appendChild(script);
    });

    return captchaPromise;
}

export async function getCaptchaToken(action) {
    const normalizedAction = String(action || '').trim() || 'submit';
    try {
        const provider = await loadCaptchaScript();
        if (!provider) return null;

        const config = getCaptchaConfig();
        const siteKey = config.siteKey;

        if (provider === 'recaptcha') {
            if (!window.grecaptcha || typeof window.grecaptcha.ready !== 'function') {
                return null;
            }
            return new Promise((resolve) => {
                window.grecaptcha.ready(async () => {
                    try {
                        const token = await window.grecaptcha.execute(siteKey, {
                            action: normalizedAction,
                        });
                        resolve(token || null);
                    } catch (_) {
                        resolve(null);
                    }
                });
            });
        }

        if (provider === 'turnstile') {
            if (!window.turnstile || typeof window.turnstile.render !== 'function') {
                return null;
            }

            const target = document.createElement('div');
            target.style.display = 'none';
            document.body.appendChild(target);

            return new Promise((resolve) => {
                let widgetId = null;
                const cleanup = () => {
                    try {
                        if (widgetId !== null && window.turnstile && typeof window.turnstile.remove === 'function') {
                            window.turnstile.remove(widgetId);
                        }
                    } catch (_) {
                        // noop
                    }
                    target.remove();
                };

                try {
                    widgetId = window.turnstile.render(target, {
                        sitekey: siteKey,
                        action: normalizedAction,
                        callback: (token) => {
                            cleanup();
                            resolve(token || null);
                        },
                        'error-callback': () => {
                            cleanup();
                            resolve(null);
                        },
                    });
                } catch (_) {
                    cleanup();
                    resolve(null);
                }
            });
        }
    } catch (_) {
        return null;
    }

    return null;
}

let captchaPromise = null;

function loadCaptchaScript() {
    if (captchaPromise) return captchaPromise;

    const config = window.Piel && window.Piel.config && window.Piel.config.captcha;
    if (!config || !config.scriptUrl || !config.siteKey) {
        // If config is missing, we assume no captcha is required (dev mode or misconfig)
        // Backend should handle missing token if secret is also missing.
        return Promise.resolve(null);
    }

    captchaPromise = new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = config.scriptUrl;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve(config.provider);
        script.onerror = () => {
            console.error('Captcha script load failed');
            resolve(null); // Resolve null to allow fallback/graceful failure
        };
        document.head.appendChild(script);
    });

    return captchaPromise;
}

export async function getCaptchaToken(action) {
    try {
        const provider = await loadCaptchaScript();
        if (!provider) return null;

        const siteKey = window.Piel.config.captcha.siteKey;

        if (provider === 'recaptcha') {
            return new Promise((resolve) => {
                if (!window.grecaptcha) {
                    resolve(null);
                    return;
                }
                window.grecaptcha.ready(async () => {
                    try {
                        const token = await window.grecaptcha.execute(siteKey, { action });
                        resolve(token);
                    } catch (e) {
                        console.error('Recaptcha error', e);
                        resolve(null);
                    }
                });
            });
        }

        if (provider === 'turnstile') {
             if (!window.turnstile) return null;

             const div = document.createElement('div');
             div.style.display = 'none';
             document.body.appendChild(div);

             return new Promise((resolve) => {
                 try {
                     const widgetId = window.turnstile.render(div, {
                         sitekey: siteKey,
                         callback: (token) => {
                             setTimeout(() => {
                                 window.turnstile.remove(widgetId);
                                 div.remove();
                             }, 1000);
                             resolve(token);
                         },
                         'error-callback': () => {
                             window.turnstile.remove(widgetId);
                             div.remove();
                             resolve(null);
                         },
                         action: action
                     });
                 } catch (e) {
                     console.error('Turnstile error', e);
                     div.remove();
                     resolve(null);
                 }
             });
        }

        return null;
    } catch (e) {
        console.error('Captcha init error', e);
        return null;
    }
}

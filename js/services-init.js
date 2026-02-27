(function () {
    'use strict';

    function normalizeSlug(pathname) {
        var clean = String(pathname || '')
            .trim()
            .replace(/\/+$/, '')
            .replace(/^\/+/, '');
        if (!clean) return '';
        var parts = clean.split('/');
        if (parts.length < 2) return '';
        return String(parts[1] || '').replace(/\.html$/i, '');
    }

    function trackEvent(eventName, payload) {
        if (
            window.Piel &&
            window.Piel.AnalyticsEngine &&
            typeof window.Piel.AnalyticsEngine.trackEvent === 'function'
        ) {
            window.Piel.AnalyticsEngine.trackEvent(eventName, payload || {});
            return;
        }

        if (typeof window.gtag === 'function') {
            window.gtag('event', eventName, payload || {});
            return;
        }

        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push(
            Object.assign({ event: eventName }, payload || {})
        );
    }

    function initServiceLegacyTracking() {
        var path = window.location.pathname || '';
        if (!/^\/(servicios|ninos)\//.test(path)) {
            return;
        }

        var slug = normalizeSlug(path);
        if (!slug) return;

        trackEvent('view_service_detail', {
            source: 'legacy_service_page',
            service_slug: slug,
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener(
            'DOMContentLoaded',
            initServiceLegacyTracking,
            {
                once: true,
            }
        );
    } else {
        initServiceLegacyTracking();
    }
})();

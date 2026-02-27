(function () {
    'use strict';

    var SERVICE_CATEGORY_MAP = {
        consulta: 'clinical',
        telefono: 'clinical',
        video: 'clinical',
        acne: 'clinical',
        cancer: 'clinical',
        laser: 'aesthetic',
        rejuvenecimiento: 'aesthetic',
        'diagnostico-integral': 'clinical',
        'acne-rosacea': 'clinical',
        verrugas: 'clinical',
        'granitos-brazos-piernas': 'clinical',
        cicatrices: 'clinical',
        'cancer-piel': 'clinical',
        'peeling-quimico': 'aesthetic',
        mesoterapia: 'aesthetic',
        'laser-dermatologico': 'aesthetic',
        botox: 'aesthetic',
        'bioestimuladores-colageno': 'aesthetic',
        'piel-cabello-unas': 'clinical',
        'dermatologia-pediatrica': 'children',
    };

    function normalizeSlugFromPath(pathname) {
        var cleanPath = String(pathname || '')
            .trim()
            .replace(/\/+$/, '')
            .replace(/^\/+/, '');
        if (!cleanPath) return '';
        var parts = cleanPath.split('/');
        if (parts.length < 2) return '';
        var slug = parts[1] || '';
        slug = slug.replace(/\.html$/i, '');
        return slug;
    }

    function getCategory(slug) {
        return SERVICE_CATEGORY_MAP[slug] || 'clinical';
    }

    function trackEvent(eventName, payload) {
        try {
            if (
                window.Piel &&
                window.Piel.AnalyticsEngine &&
                typeof window.Piel.AnalyticsEngine.trackEvent === 'function'
            ) {
                window.Piel.AnalyticsEngine.trackEvent(
                    eventName,
                    payload || {}
                );
                return;
            }
        } catch (_error) {
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

    function trackServicePageView() {
        if (!document.body.classList.contains('service-page-premium')) {
            return;
        }
        var slug = normalizeSlugFromPath(window.location.pathname);
        if (!slug) return;
        var category = getCategory(slug);

        trackEvent('view_service_category', {
            source: 'service_page',
            service_category: category,
        });
        trackEvent('view_service_detail', {
            source: 'service_page',
            service_slug: slug,
            service_category: category,
        });
    }

    function trackServiceLinkClicks() {
        document.addEventListener(
            'click',
            function (event) {
                var target =
                    event.target instanceof Element ? event.target : null;
                if (!target) return;
                var link = target.closest('a[href]');
                if (!link) return;

                var href = link.getAttribute('href') || '';
                if (!href) return;
                if (
                    href.indexOf('/servicios/') !== 0 &&
                    href.indexOf('/ninos/') !== 0
                ) {
                    return;
                }

                var serviceSlug = normalizeSlugFromPath(href);
                if (!serviceSlug) return;

                var category = getCategory(serviceSlug);
                var entry = link.closest('.mega-menu')
                    ? 'mega_menu'
                    : link.closest('.services-premium-grid')
                      ? 'services_grid'
                      : link.closest('.mobile-menu')
                        ? 'mobile_menu'
                        : 'link';

                trackEvent('view_service_detail', {
                    source: 'home',
                    entry_point: entry,
                    service_slug: serviceSlug,
                    service_category: category,
                });
            },
            true
        );
    }

    function trackBookingIntentClicks() {
        document.addEventListener(
            'click',
            function (event) {
                var target =
                    event.target instanceof Element ? event.target : null;
                if (!target) return;
                var cta = target.closest('a[data-analytics-event]');
                if (!cta) return;

                var eventName = cta.getAttribute('data-analytics-event');
                if (!eventName) return;
                trackEvent(eventName, {
                    source: document.body.classList.contains(
                        'service-page-premium'
                    )
                        ? 'service_page'
                        : 'home',
                    service_slug: cta.getAttribute('data-service-slug') || '',
                    service_category:
                        cta.getAttribute('data-service-category') || 'clinical',
                });
            },
            true
        );
    }

    function applyServiceSelectionFromQuery() {
        var onHomePath =
            window.location.pathname === '/' ||
            window.location.pathname === '/index.html' ||
            window.location.pathname === '';
        if (!onHomePath) return;

        var params = new URLSearchParams(window.location.search || '');
        var serviceValue = (params.get('service') || '').trim();
        if (!serviceValue) return;

        var attempts = 0;
        var maxAttempts = 80;
        var timer = window.setInterval(function () {
            attempts += 1;
            var select = document.getElementById('serviceSelect');
            if (!select) {
                if (attempts >= maxAttempts) window.clearInterval(timer);
                return;
            }

            var option = select.querySelector(
                'option[value="' + CSS.escape(serviceValue) + '"]'
            );
            if (!option) {
                window.clearInterval(timer);
                return;
            }

            select.value = serviceValue;
            select.dispatchEvent(new Event('change', { bubbles: true }));

            var citas = document.getElementById('citas');
            if (citas) {
                var nav = document.querySelector('.nav');
                var offset = nav ? nav.offsetHeight + 18 : 96;
                var top = Math.max(0, citas.offsetTop - offset);
                window.scrollTo({ top: top, behavior: 'smooth' });
            }

            trackEvent('start_booking_from_service', {
                source: 'service_page_redirect',
                service_slug: serviceValue,
                service_category: getCategory(serviceValue),
            });

            window.clearInterval(timer);
        }, 150);
    }

    function init() {
        trackServicePageView();
        trackServiceLinkClicks();
        trackBookingIntentClicks();
        applyServiceSelectionFromQuery();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();

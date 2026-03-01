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

    var VALID_CATEGORIES = {
        all: true,
        clinical: true,
        aesthetic: true,
        children: true,
    };

    var VALID_INTENTS = {
        all: true,
        diagnosis: true,
        inflammation: true,
        procedures: true,
        rejuvenation: true,
        pediatric: true,
        remote: true,
    };
    var SERVICE_INTENT_MAP = {
        consulta: 'diagnosis',
        telefono: 'remote',
        video: 'remote',
        telemedicina: 'remote',
        telemedicine: 'remote',
        acne: 'inflammation',
        cancer: 'diagnosis',
        laser: 'procedures',
        rejuvenecimiento: 'rejuvenation',
        'diagnostico-integral': 'diagnosis',
        'acne-rosacea': 'inflammation',
        verrugas: 'procedures',
        'granitos-brazos-piernas': 'inflammation',
        cicatrices: 'procedures',
        'cancer-piel': 'diagnosis',
        'peeling-quimico': 'rejuvenation',
        mesoterapia: 'rejuvenation',
        'laser-dermatologico': 'procedures',
        botox: 'rejuvenation',
        'bioestimuladores-colageno': 'rejuvenation',
        'piel-cabello-unas': 'diagnosis',
        'dermatologia-pediatrica': 'pediatric',
    };

    var lastTrackedFilterKeys = {
        service_finder: '',
        service_hub: '',
    };
    var lastTrackedRoutePlannerKey = '';
    var lastTrackedSharedContextKey = '';

    function normalizePath(pathname) {
        var value = String(pathname || '').trim();
        if (!value) return '/';
        if (!value.startsWith('/')) {
            value = '/' + value;
        }
        return value.endsWith('/') ? value : value + '/';
    }

    function normalizeSlugFromPath(pathname) {
        var cleanPath = String(pathname || '')
            .trim()
            .replace(/\/+$/, '')
            .replace(/^\/+/, '');
        if (!cleanPath) return '';
        var parts = cleanPath.split('/');
        if (parts.length < 1) return '';

        var slug = '';
        if (
            (parts[0] === 'es' && parts[1] === 'servicios') ||
            (parts[0] === 'en' && parts[1] === 'services')
        ) {
            slug = parts[2] || '';
        } else if (
            parts[0] === 'servicios' ||
            parts[0] === 'services' ||
            parts[0] === 'ninos'
        ) {
            slug = parts[1] || '';
        } else {
            slug = parts[parts.length - 1] || '';
        }

        slug = slug.replace(/\.html$/i, '');
        return slug;
    }

    function getCategory(slug) {
        return SERVICE_CATEGORY_MAP[slug] || 'clinical';
    }

    function getIntent(slug) {
        return SERVICE_INTENT_MAP[slug] || '';
    }

    function normalizeFilterValue(value, allowList, fallback) {
        var normalized = String(value || '')
            .trim()
            .toLowerCase();
        return allowList[normalized] ? normalized : fallback;
    }

    function parseCatalogState(target) {
        var url = null;
        try {
            url =
                target instanceof URL
                    ? target
                    : new URL(String(target || ''), window.location.origin);
        } catch (_error) {
            url = new URL(window.location.href);
        }

        return {
            category: normalizeFilterValue(
                url.searchParams.get('category'),
                VALID_CATEGORIES,
                'all'
            ),
            intent: normalizeFilterValue(
                url.searchParams.get('intent'),
                VALID_INTENTS,
                'all'
            ),
        };
    }

    function isServiceHubPath(pathname) {
        var normalized = normalizePath(pathname);
        return (
            normalized === '/es/servicios/' ||
            normalized === '/en/services/' ||
            normalized === '/servicios/' ||
            normalized === '/services/'
        );
    }

    function isServiceDetailPath(pathname) {
        var normalized = normalizePath(pathname);
        return (
            normalized.indexOf('/es/servicios/') === 0 ||
            normalized.indexOf('/en/services/') === 0 ||
            normalized.indexOf('/servicios/') === 0 ||
            normalized.indexOf('/services/') === 0 ||
            normalized.indexOf('/ninos/') === 0
        );
    }

    function getLocaleFromPath(pathname) {
        var normalized = normalizePath(pathname);
        return normalized.indexOf('/en/') === 0 ? 'en' : 'es';
    }

    function getPageSurface(pathname) {
        var normalized = normalizePath(pathname);
        if (isServiceHubPath(normalized)) return 'service_hub';
        if (isServiceDetailPath(normalized)) return 'service_page';
        if (
            normalized === '/es/' ||
            normalized === '/en/' ||
            normalized === '/' ||
            normalized === '/index.html/'
        ) {
            return 'home';
        }
        if (
            normalized === '/es/telemedicina/' ||
            normalized === '/en/telemedicine/'
        ) {
            return 'telemedicine';
        }
        if (
            normalized.indexOf('/es/legal/') === 0 ||
            normalized.indexOf('/en/legal/') === 0
        ) {
            return 'legal';
        }
        return 'public';
    }

    function getLinkEntryPoint(link) {
        if (!link) return 'link';
        if (link.closest('.public-mega-panel__feature-card'))
            return 'mega_feature';
        if (link.closest('.public-mega-panel__lists')) return 'mega_group';
        if (link.closest('.public-mega-panel__family')) return 'mega_family';
        if (link.closest('[data-stage-carousel]')) return 'hero_stage';
        if (link.closest('[data-latest-news]')) return 'latest_strip';
        if (link.closest('[data-featured-story]')) return 'featured_story';
        if (link.closest('[data-program-grid]')) return 'program_family_grid';
        if (link.closest('[data-services-grid]')) return 'service_hub_grid';
        if (link.closest('[data-related-programs]')) return 'related_programs';
        if (link.closest('[data-support-band]')) return 'support_band';
        if (link.closest('[data-booking-bridge-band]')) return 'booking_bridge';
        if (link.closest('.public-footer')) return 'footer';
        if (link.closest('.public-nav')) return 'nav';
        if (link.closest('.sony-mobile-nav__quick-paths'))
            return 'mobile_quick_path';
        if (link.closest('.sony-mobile-nav__features'))
            return 'mobile_mega_feature';
        if (link.closest('.sony-mega__features')) return 'mega_feature';
        if (link.closest('.sony-mega__group')) return 'mega_group';
        if (link.closest('.sony-mobile-nav__group')) return 'mobile_group';
        if (link.closest('[data-service-finder]')) return 'service_finder';
        if (link.closest('.sony-service-hub__feature'))
            return 'service_hub_feature';
        if (link.closest('.sony-service-hub__grid')) return 'service_hub_grid';
        if (link.closest('.sony-mobile-nav')) return 'mobile_nav';
        if (link.closest('.sony-mega')) return 'mega_menu';
        if (link.closest('.sony-service-atlas')) return 'service_atlas';
        if (link.closest('.sony-related-services')) return 'related_services';
        if (link.closest('.sony-route-planner')) return 'route_planner';
        if (link.closest('.sony-hero')) return 'hero_media';
        if (link.closest('.sony-intent-rail')) return 'intent_rail';
        if (link.closest('.sony-journey')) return 'journey_rail';
        if (link.closest('.sony-cta-cluster')) return 'cta_cluster';
        if (link.closest('.sony-footer')) return 'footer';
        return 'link';
    }

    function classifyCtaTargetFromHref(href) {
        var value = String(href || '').trim();
        if (!value) return 'navigation';
        if (value.indexOf('wa.me/') !== -1) return 'whatsapp';

        var destination = null;
        try {
            destination = new URL(value, window.location.origin);
        } catch (_error) {
            if (value.indexOf('#citas') !== -1) return 'booking';
            if (value.indexOf('#service-finder') !== -1)
                return 'service_finder';
            return 'navigation';
        }

        if (
            destination.hash === '#citas' ||
            destination.searchParams.has('service')
        ) {
            return 'booking';
        }
        if (destination.hash === '#service-finder') return 'service_finder';
        if (destination.hash === '#servicios') return 'services_section';
        if (
            normalizePath(destination.pathname) === '/es/telemedicina/' ||
            normalizePath(destination.pathname) === '/en/telemedicine/'
        ) {
            return 'telemedicine';
        }
        if (isServiceHubPath(destination.pathname)) return 'service_hub';
        if (isServiceDetailPath(destination.pathname)) return 'service_detail';
        return 'navigation';
    }

    function normalizeEntrySurface(value, fallback) {
        var source = String(value || fallback || '')
            .trim()
            .toLowerCase();
        if (!source) return 'link';
        return source
            .replace(/^v\d+_+/g, '')
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '')
            .replace(/_+/g, '_');
    }

    function inferServiceIntent(payload) {
        var details = payload || {};
        if (details.serviceIntent) {
            return details.serviceIntent;
        }

        var intentFromSlug = getIntent(details.routeSlug || '');
        if (intentFromSlug) {
            return intentFromSlug;
        }

        var intentFromHint = getIntent(details.bookingHint || '');
        if (intentFromHint) {
            return intentFromHint;
        }

        if (
            details.routeProfile === 'remote' ||
            details.routeId === 'telemedicine' ||
            details.ctaTarget === 'telemedicine'
        ) {
            return 'remote';
        }
        if (details.routeProfile === 'pediatric') {
            return 'pediatric';
        }
        if (
            details.routeProfile === 'procedure' ||
            details.routeId === 'treatment'
        ) {
            return details.routeCategory === 'children'
                ? 'pediatric'
                : 'rejuvenation';
        }
        if (
            details.routeProfile === 'diagnosis' ||
            details.routeId === 'inperson'
        ) {
            return details.routeCategory === 'children'
                ? 'pediatric'
                : 'diagnosis';
        }

        return '';
    }

    function inferServiceCategory(payload) {
        var details = payload || {};
        if (details.routeCategory && VALID_CATEGORIES[details.routeCategory]) {
            return details.routeCategory;
        }

        if (details.serviceIntent === 'pediatric') {
            return 'children';
        }
        if (
            details.serviceIntent === 'procedures' ||
            details.serviceIntent === 'rejuvenation'
        ) {
            return 'aesthetic';
        }
        if (details.serviceIntent === 'remote') {
            return details.routeProfile === 'remote' ? 'all' : 'clinical';
        }
        if (
            details.routeProfile === 'remote' ||
            details.routeId === 'telemedicine'
        ) {
            return 'all';
        }

        return details.routeSlug ? getCategory(details.routeSlug) : '';
    }

    function resolveCatalogContext(payload) {
        var details = payload || {};
        var category =
            details.explicitCatalogCategory ||
            (details.catalogState && details.catalogState.category !== 'all'
                ? details.catalogState.category
                : '');
        var intent =
            details.explicitCatalogIntent ||
            (details.catalogState && details.catalogState.intent !== 'all'
                ? details.catalogState.intent
                : '');

        if (!intent) {
            intent = details.serviceIntent || 'all';
        }
        if (!category) {
            if (
                details.routeProfile === 'remote' ||
                details.routeId === 'telemedicine' ||
                details.ctaTarget === 'telemedicine'
            ) {
                category = 'all';
            } else {
                category = details.routeCategory || 'all';
            }
        }

        return {
            category: category || 'all',
            intent: intent || 'all',
        };
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

    function trackServiceHubView() {
        if (!isServiceHubPath(window.location.pathname)) {
            return;
        }

        var state = parseCatalogState(window.location.href);
        var locale = getLocaleFromPath(window.location.pathname);

        trackEvent('view_service_catalog', {
            source: 'service_hub',
            locale: locale,
            service_category: state.category,
            service_intent: state.intent,
        });

        if (state.category !== 'all' || state.intent !== 'all') {
            trackEvent('view_service_category', {
                source: 'service_hub',
                entry_point: 'query_route',
                service_category: state.category,
                service_intent: state.intent,
            });
        }
    }

    function trackCatalogRouteClicks() {
        document.addEventListener(
            'click',
            function (event) {
                var target =
                    event.target instanceof Element ? event.target : null;
                if (!target) return;

                var link = target.closest('a[href]');
                if (!link) return;

                var destination = null;
                try {
                    destination = new URL(
                        link.getAttribute('href') || '',
                        window.location.origin
                    );
                } catch (_error) {
                    return;
                }

                if (!isServiceHubPath(destination.pathname)) {
                    return;
                }

                var state = parseCatalogState(destination);

                trackEvent('open_service_catalog_route', {
                    source: getPageSurface(window.location.pathname),
                    entry_point: getLinkEntryPoint(link),
                    locale: getLocaleFromPath(destination.pathname),
                    service_category: state.category,
                    service_intent: state.intent,
                });
            },
            true
        );
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

                var destination = null;
                try {
                    destination = new URL(href, window.location.origin);
                } catch (_error) {
                    return;
                }

                if (!isServiceDetailPath(destination.pathname)) {
                    return;
                }

                var serviceSlug = normalizeSlugFromPath(destination.pathname);
                if (!serviceSlug) return;

                var category = getCategory(serviceSlug);
                var catalogState = parseCatalogState(window.location.href);

                trackEvent('view_service_detail', {
                    source: getPageSurface(window.location.pathname),
                    entry_point: getLinkEntryPoint(link),
                    service_slug: serviceSlug,
                    service_category: category,
                    catalog_category: catalogState.category,
                    catalog_intent: catalogState.intent,
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

                var catalogState = parseCatalogState(window.location.href);
                var href = cta.getAttribute('href') || '';
                var explicitCatalogCategory =
                    cta.getAttribute('data-catalog-category') || '';
                var explicitCatalogIntent =
                    cta.getAttribute('data-catalog-intent') || '';
                var destination = null;
                try {
                    destination = new URL(href, window.location.origin);
                } catch (_error) {
                    destination = null;
                }
                var bookingHint = '';
                if (destination) {
                    bookingHint = destination.searchParams.get('service') || '';
                }
                var routeSlug =
                    cta.getAttribute('data-service-slug') ||
                    normalizeSlugFromPath(
                        destination ? destination.pathname : ''
                    ) ||
                    bookingHint;
                var routeCategory =
                    cta.getAttribute('data-service-category') ||
                    (routeSlug ? getCategory(routeSlug) : '');
                var ctaTarget =
                    cta.getAttribute('data-cta-target') ||
                    classifyCtaTargetFromHref(href);
                var routeProfile = cta.getAttribute('data-route-profile') || '';
                var routeId = cta.getAttribute('data-route-id') || '';
                var serviceIntent = inferServiceIntent({
                    serviceIntent:
                        cta.getAttribute('data-service-intent') || '',
                    routeSlug: routeSlug,
                    routeCategory: routeCategory,
                    bookingHint: bookingHint,
                    routeProfile: routeProfile,
                    routeId: routeId,
                    ctaTarget: ctaTarget,
                });
                routeCategory = inferServiceCategory({
                    routeCategory: routeCategory,
                    routeSlug: routeSlug,
                    serviceIntent: serviceIntent,
                    routeProfile: routeProfile,
                    routeId: routeId,
                });
                var catalogContext = resolveCatalogContext({
                    explicitCatalogCategory: explicitCatalogCategory,
                    explicitCatalogIntent: explicitCatalogIntent,
                    catalogState: catalogState,
                    routeCategory: routeCategory,
                    serviceIntent: serviceIntent,
                    routeProfile: routeProfile,
                    routeId: routeId,
                    ctaTarget: ctaTarget,
                });

                var entryPoint = normalizeEntrySurface(
                    cta.getAttribute('data-entry-surface'),
                    getLinkEntryPoint(cta)
                );

                trackEvent(eventName, {
                    source: getPageSurface(window.location.pathname),
                    entry_point: entryPoint || 'link',
                    cta_target: ctaTarget,
                    service_slug: routeSlug || '',
                    service_category: routeCategory || '',
                    service_intent: serviceIntent,
                    route_profile: routeProfile,
                    route_variant: cta.getAttribute('data-route-variant') || '',
                    route_id: routeId,
                    booking_hint: bookingHint,
                    catalog_category: catalogContext.category,
                    catalog_intent: catalogContext.intent,
                });
            },
            true
        );
    }

    function trackRoutePlannerChanges() {
        window.addEventListener(
            'route-planner-profile-change',
            function (event) {
                var detail = event && event.detail ? event.detail : {};
                var key = [
                    String(detail.profile || ''),
                    String(detail.routeId || ''),
                    String(detail.variant || ''),
                    String(detail.currentService || ''),
                ].join('|');

                if (!key || lastTrackedRoutePlannerKey === key) {
                    return;
                }
                lastTrackedRoutePlannerKey = key;
                var inferredIntent = inferServiceIntent({
                    serviceIntent: detail.intent || '',
                    routeSlug: detail.currentService || '',
                    routeCategory: detail.category || '',
                    routeProfile: detail.profile || '',
                    routeId: detail.routeId || '',
                });
                var inferredCategory = inferServiceCategory({
                    routeCategory: detail.category || '',
                    routeSlug: detail.currentService || '',
                    serviceIntent: inferredIntent,
                    routeProfile: detail.profile || '',
                    routeId: detail.routeId || '',
                });
                var catalogContext = resolveCatalogContext({
                    routeCategory: inferredCategory,
                    serviceIntent: inferredIntent,
                    routeProfile: detail.profile || '',
                    routeId: detail.routeId || '',
                });

                trackEvent('route_planner_profile_selected', {
                    source: getPageSurface(window.location.pathname),
                    route_profile: detail.profile || '',
                    route_id: detail.routeId || '',
                    route_variant: detail.variant || '',
                    locale:
                        detail.locale ||
                        getLocaleFromPath(window.location.pathname),
                    service_slug: detail.currentService || '',
                    service_category: inferredCategory,
                    service_intent: inferredIntent,
                    catalog_category: catalogContext.category,
                    catalog_intent: catalogContext.intent,
                });
            }
        );
    }

    function trackFinderFilterEvents() {
        window.addEventListener('service-filter-change', function (event) {
            var detail = event && event.detail ? event.detail : {};
            if (isServiceHubPath(window.location.pathname)) {
                return;
            }

            if (String(detail.reason || '') !== 'interaction') {
                return;
            }

            var key = [
                String(detail.intent || 'all'),
                String(detail.visibleCount || 0),
            ].join('|');
            if (lastTrackedFilterKeys.service_finder === key) {
                return;
            }
            lastTrackedFilterKeys.service_finder = key;

            trackEvent('service_catalog_filter_applied', {
                source: 'service_finder',
                locale:
                    detail.locale ||
                    getLocaleFromPath(window.location.pathname),
                service_intent: detail.intent || 'all',
                visible_routes: Number(detail.visibleCount || 0),
            });
        });
    }

    function trackHubFilterEvents() {
        window.addEventListener('service-hub-state-change', function (event) {
            var detail = event && event.detail ? event.detail : {};
            if (String(detail.reason || '') !== 'interaction') {
                return;
            }

            var key = [
                String(detail.category || 'all'),
                String(detail.intent || 'all'),
                String(detail.visibleFamilies || 0),
                String(detail.visibleServices || 0),
                String(detail.triggerSource || 'service_hub'),
            ].join('|');

            if (lastTrackedFilterKeys.service_hub === key) {
                return;
            }
            lastTrackedFilterKeys.service_hub = key;

            trackEvent('service_catalog_filter_applied', {
                source: 'service_hub',
                trigger_source: detail.triggerSource || 'service_hub',
                locale:
                    detail.locale ||
                    getLocaleFromPath(window.location.pathname),
                service_category: detail.category || 'all',
                service_intent: detail.intent || 'all',
                visible_families: Number(detail.visibleFamilies || 0),
                visible_routes: Number(detail.visibleServices || 0),
            });
        });
    }

    function trackSharedContextEvents() {
        var handleContextEvent = function (event) {
            var detail = event && event.detail ? event.detail : {};
            if (String(detail.reason || '') !== 'interaction') {
                return;
            }

            var pageSurface = getPageSurface(window.location.pathname);
            var contextSurface = isServiceHubPath(window.location.pathname)
                ? 'shared_catalog_context'
                : 'shared_navigation';
            var key = [
                pageSurface,
                contextSurface,
                String(detail.source || ''),
                String(detail.category || 'all'),
                String(detail.intent || 'all'),
            ].join('|');

            if (lastTrackedSharedContextKey === key) {
                return;
            }
            lastTrackedSharedContextKey = key;

            trackEvent('service_navigation_context_updated', {
                source: pageSurface,
                context_surface: contextSurface,
                trigger_source: detail.source || '',
                locale:
                    detail.locale ||
                    getLocaleFromPath(window.location.pathname),
                service_category: detail.category || 'all',
                service_intent: detail.intent || 'all',
            });
        };

        window.addEventListener('service-filter-change', handleContextEvent);
        window.addEventListener('service-hub-state-change', handleContextEvent);
    }

    function applyServiceSelectionFromQuery() {
        var pathname = window.location.pathname || '';
        var onHomePath =
            pathname === '/' ||
            pathname === '/index.html' ||
            pathname === '' ||
            pathname === '/es/' ||
            pathname === '/es' ||
            pathname === '/en/' ||
            pathname === '/en';
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
                var nav = document.querySelector(
                    '.nav, .sony-header, .public-nav'
                );
                var offset = nav ? nav.offsetHeight + 18 : 96;
                var top = Math.max(0, citas.offsetTop - offset);
                window.scrollTo({ top: top, behavior: 'smooth' });
            }

            trackEvent('start_booking_from_service', {
                source: 'service_page_redirect',
                service_slug: serviceValue,
                service_category: getCategory(serviceValue),
                entry_point: 'query_redirect',
                catalog_category: 'all',
                catalog_intent: 'all',
            });

            window.clearInterval(timer);
        }, 150);
    }

    function init() {
        trackServicePageView();
        trackServiceHubView();
        trackCatalogRouteClicks();
        trackServiceLinkClicks();
        trackBookingIntentClicks();
        trackFinderFilterEvents();
        trackHubFilterEvents();
        trackSharedContextEvents();
        trackRoutePlannerChanges();
        applyServiceSelectionFromQuery();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();

(function () {
    'use strict';

    function bootHeroStage() {
        var roots = Array.from(
            document.querySelectorAll('[data-stage-carousel]')
        );
        roots.forEach(function (root) {
            if (!root || root.dataset.stageReady === 'true') return;
            root.dataset.stageReady = 'true';

            var slides = Array.from(
                root.querySelectorAll('[data-stage-slide]')
            );
            var triggers = Array.from(
                root.querySelectorAll('[data-stage-trigger]')
            );
            if (!slides.length || slides.length !== triggers.length) return;

            var current = 0;
            var activate = function (index) {
                current = index;
                slides.forEach(function (slide, slideIndex) {
                    slide.classList.toggle('is-active', slideIndex === index);
                });
                triggers.forEach(function (trigger, triggerIndex) {
                    trigger.classList.toggle(
                        'is-active',
                        triggerIndex === index
                    );
                });
            };

            triggers.forEach(function (trigger, index) {
                trigger.addEventListener('click', function () {
                    activate(index);
                });
            });

            window.setInterval(function () {
                activate((current + 1) % slides.length);
            }, 7000);
        });
    }

    function bootFamilyTabs() {
        var url = new URL(window.location.href);
        var category = url.searchParams.get('category');
        document.querySelectorAll('[data-family-tabs]').forEach(function (nav) {
            if (!nav || nav.dataset.familyTabsReady === 'true') return;
            nav.dataset.familyTabsReady = 'true';
            if (category) {
                var link = nav.querySelector(
                    '[data-family-tab="' + category + '"]'
                );
                if (link) {
                    link.dataset.familyActive = 'true';
                    link.setAttribute('aria-current', 'page');
                }
            }

            nav.addEventListener('click', function (event) {
                var target =
                    event.target instanceof Element ? event.target : null;
                var tab = target ? target.closest('[data-family-tab]') : null;
                if (!tab) return;
                var nextCategory = String(
                    tab.getAttribute('data-family-tab') || ''
                ).trim();
                var nextUrl = new URL(window.location.href);
                if (nextCategory) {
                    nextUrl.searchParams.set('category', nextCategory);
                } else {
                    nextUrl.searchParams.delete('category');
                }
                window.history.replaceState({}, '', nextUrl.toString());
            });
        });
    }

    function bootServiceGrid() {
        var url = new URL(window.location.href);
        var category = url.searchParams.get('category');
        var intent = url.searchParams.get('intent');
        var audience = url.searchParams.get('audience');

        function hasToken(payload, token) {
            if (!token) return true;
            return (
                String(payload || '')
                    .split(',')
                    .map(function (value) {
                        return value.trim();
                    })
                    .filter(Boolean)
                    .indexOf(token) !== -1
            );
        }

        function applyFilters(
            root,
            currentCategory,
            currentIntent,
            currentAudience
        ) {
            if (!root) return;
            var cards = Array.from(
                root.querySelectorAll('[data-service-card]')
            );
            cards.forEach(function (card) {
                var matchesCategory =
                    !currentCategory ||
                    String(card.dataset.cardCategory || '') === currentCategory;
                var matchesIntent = hasToken(
                    card.dataset.cardIntents || '',
                    currentIntent
                );
                var matchesAudience = hasToken(
                    card.dataset.cardAudience || '',
                    currentAudience
                );
                var visible =
                    matchesCategory && matchesIntent && matchesAudience;
                card.hidden = !visible;
            });

            Array.from(root.querySelectorAll('[data-family-section]')).forEach(
                function (section) {
                    var visibleCards = section.querySelectorAll(
                        '[data-service-card]:not([hidden])'
                    );
                    section.hidden = visibleCards.length === 0;
                    if (
                        !section.hidden &&
                        currentCategory &&
                        section.getAttribute('data-family-section') ===
                            currentCategory
                    ) {
                        section.dataset.familyActive = 'true';
                    }
                }
            );
        }

        document
            .querySelectorAll('[data-services-grid]')
            .forEach(function (root) {
                if (!root || root.dataset.familyReady === 'true') return;
                root.dataset.familyReady = 'true';

                var filterIntent = root.querySelector('[data-filter-intent]');
                var filterAudience = root.querySelector(
                    '[data-filter-audience]'
                );

                if (filterIntent) {
                    filterIntent.value = intent || '';
                }
                if (filterAudience) {
                    filterAudience.value = audience || '';
                }

                function syncFilterQuery() {
                    var nextUrl = new URL(window.location.href);
                    var selectedIntent = filterIntent ? filterIntent.value : '';
                    var selectedAudience = filterAudience
                        ? filterAudience.value
                        : '';

                    if (selectedIntent) {
                        nextUrl.searchParams.set('intent', selectedIntent);
                    } else {
                        nextUrl.searchParams.delete('intent');
                    }
                    if (selectedAudience) {
                        nextUrl.searchParams.set('audience', selectedAudience);
                    } else {
                        nextUrl.searchParams.delete('audience');
                    }

                    window.history.replaceState({}, '', nextUrl.toString());
                    applyFilters(
                        root,
                        category,
                        selectedIntent,
                        selectedAudience
                    );
                }

                if (filterIntent) {
                    filterIntent.addEventListener('change', syncFilterQuery);
                }
                if (filterAudience) {
                    filterAudience.addEventListener('change', syncFilterQuery);
                }

                applyFilters(
                    root,
                    category,
                    filterIntent ? filterIntent.value : intent,
                    filterAudience ? filterAudience.value : audience
                );
            });
    }

    function bootCookieBanner() {
        var banner = document.getElementById('cookieBanner');
        if (!banner || banner.dataset.publicV5CookieReady === 'true') return;
        banner.dataset.publicV5CookieReady = 'true';

        var measurementId = 'G-GYY8PE5M8W';
        var storageKey = 'pa_cookie_consent_v1';

        function readConsent() {
            try {
                var raw = window.localStorage.getItem(storageKey);
                if (!raw) return '';
                var payload = JSON.parse(raw);
                return typeof payload.status === 'string' ? payload.status : '';
            } catch (_error) {
                return '';
            }
        }

        function writeConsent(status) {
            try {
                window.localStorage.setItem(
                    storageKey,
                    JSON.stringify({
                        status: status,
                        at: new Date().toISOString(),
                    })
                );
            } catch (_error) {
                // no-op
            }
        }

        function gtag() {
            window.dataLayer = window.dataLayer || [];
            if (typeof window.gtag !== 'function') {
                window.gtag = function () {
                    window.dataLayer.push(arguments);
                };
            }
            window.gtag.apply(null, arguments);
        }

        function updateVisibility() {
            var consent = readConsent();
            banner.classList.toggle(
                'active',
                consent !== 'accepted' && consent !== 'rejected'
            );
        }

        function ensureDefaultConsent() {
            if (window.__publicV5ConsentDefaultReady === true) return;
            window.__publicV5ConsentDefaultReady = true;
            gtag('consent', 'default', {
                analytics_storage: 'denied',
                ad_storage: 'denied',
                ad_user_data: 'denied',
                ad_personalization: 'denied',
            });
        }

        function loadGa4() {
            if (window._ga4Loaded || readConsent() !== 'accepted') return;
            window._ga4Loaded = true;

            if (
                !document.querySelector(
                    'script[data-public-v5-ga4="' + measurementId + '"]'
                )
            ) {
                var script = document.createElement('script');
                script.async = true;
                script.src =
                    'https://www.googletagmanager.com/gtag/js?id=' +
                    measurementId;
                script.dataset.publicV5Ga4 = measurementId;
                document.head.appendChild(script);
            }

            gtag('js', new Date());
            gtag('consent', 'update', {
                analytics_storage: 'granted',
                ad_storage: 'denied',
                ad_user_data: 'denied',
                ad_personalization: 'denied',
            });
            gtag('config', measurementId);
        }

        function applyConsent(status) {
            var normalized = status === 'accepted' ? 'accepted' : 'rejected';
            writeConsent(normalized);
            banner.classList.remove('active');
            gtag('consent', 'update', {
                analytics_storage:
                    normalized === 'accepted' ? 'granted' : 'denied',
                ad_storage: 'denied',
                ad_user_data: 'denied',
                ad_personalization: 'denied',
            });
            if (normalized === 'accepted') {
                loadGa4();
            }
        }

        ensureDefaultConsent();
        updateVisibility();
        if (readConsent() === 'accepted') {
            loadGa4();
        }

        banner.addEventListener('click', function (event) {
            var target = event.target instanceof Element ? event.target : null;
            if (!target) return;
            if (target.closest('#cookieAcceptBtn')) {
                event.preventDefault();
                applyConsent('accepted');
                return;
            }
            if (target.closest('#cookieRejectBtn')) {
                event.preventDefault();
                applyConsent('rejected');
            }
        });
    }

    function bootLegacyRuntimeBridge() {
        var runtimeRoot = document.querySelector('.public-runtime-bridge');
        if (!runtimeRoot) return;

        var root = document.documentElement;
        if (root.dataset.publicV5RuntimeReady === 'true') return;
        root.dataset.publicV5RuntimeReady = 'true';
        if (document.body) {
            document.body.dataset.publicShellVersion = 'v5';
        }

        var bootstrapHref = '/js/bootstrap-inline-engine.js?v=public-v5-bridge';
        var runtimeHref = '/script.js?v=public-v5-bridge';
        var booted = false;

        function applyServiceHint() {
            var booking = document.getElementById('citas');
            var select = document.getElementById('serviceSelect');
            if (!booking || !select) return;

            var url = new URL(window.location.href);
            var hint =
                url.searchParams.get('service') ||
                booking.dataset.serviceHint ||
                '';
            if (!hint) return;

            var match = Array.from(select.options || []).some(
                function (option) {
                    return String(option.value || '').trim() === hint;
                }
            );
            if (!match) return;

            select.value = hint;
            select.dispatchEvent(new Event('change', { bubbles: true }));
        }

        function appendScript(src, type) {
            if (
                document.querySelector(
                    'script[data-public-v5-src="' + src + '"]'
                )
            )
                return;
            var script = document.createElement('script');
            script.src = src;
            script.dataset.publicV5Src = src;
            if (type === 'module') {
                script.type = 'module';
            } else {
                script.defer = true;
            }
            document.head.appendChild(script);
        }

        function boot() {
            if (booted) return;
            booted = true;
            root.dataset.publicV5RuntimeBooted = 'true';
            applyServiceHint();
            appendScript(bootstrapHref, 'classic');
            appendScript(runtimeHref, 'module');
        }

        function requestBoot() {
            if (document.readyState === 'complete') {
                window.setTimeout(boot, 0);
                return;
            }

            window.addEventListener(
                'load',
                function () {
                    window.setTimeout(boot, 0);
                },
                { once: true }
            );
        }

        function shouldBootImmediately() {
            var url = new URL(window.location.href);
            return url.hash === '#citas' || url.searchParams.has('service');
        }

        if (shouldBootImmediately()) {
            requestBoot();
            return;
        }

        document.addEventListener(
            'click',
            function (event) {
                var target =
                    event.target instanceof Element ? event.target : null;
                if (!target) return;
                if (
                    target.closest('a[href="#citas"]') ||
                    target.closest('[data-cta-target="booking"]') ||
                    target.closest('#chatbotWidget')
                ) {
                    requestBoot();
                }
            },
            true
        );

        document.addEventListener(
            'focusin',
            function (event) {
                var target =
                    event.target instanceof Element ? event.target : null;
                if (!target) return;
                if (target.closest('#citas')) {
                    requestBoot();
                }
            },
            true
        );

        // Avoid automatic boot to prevent non-user-triggered layout shifts.
        // Runtime loads when booking/chat intent is explicit (click/focus/hash).
    }

    function bootChatFallback() {
        var widget = document.getElementById('chatbotWidget');
        var container = document.getElementById('chatbotContainer');
        if (
            !widget ||
            !container ||
            widget.dataset.publicV5ChatFallbackReady === 'true'
        ) {
            return;
        }

        widget.dataset.publicV5ChatFallbackReady = 'true';

        var syncState = function (open) {
            widget.classList.toggle('open', open);
            container.classList.toggle('active', open);
            widget.setAttribute('data-chat-open', open ? 'true' : 'false');
            document.body.classList.toggle('chatbot-mobile-open', open);
            if (open) {
                container.removeAttribute('hidden');
            } else {
                container.setAttribute('hidden', 'hidden');
            }
        };

        syncState(false);

        widget.addEventListener('click', function (event) {
            var target = event.target instanceof Element ? event.target : null;
            if (!target) return;

            var toggle = target.closest(
                '.chatbot-toggle, [data-action="toggle-chatbot"]'
            );
            var minimize = target.closest('[data-action="minimize-chat"]');
            if (!toggle && !minimize) return;

            event.preventDefault();
            event.stopImmediatePropagation();

            if (minimize) {
                syncState(false);
                return;
            }

            syncState(widget.getAttribute('data-chat-open') !== 'true');
        });
    }

    function bootAll() {
        bootHeroStage();
        bootFamilyTabs();
        bootServiceGrid();
        bootCookieBanner();
        bootChatFallback();
        bootLegacyRuntimeBridge();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootAll, { once: true });
    } else {
        bootAll();
    }
})();

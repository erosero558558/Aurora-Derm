(function () {
    'use strict';

    function normalizeIndex(index, total) {
        if (!total) return 0;
        if (index < 0) return total - 1;
        if (index >= total) return 0;
        return index;
    }

    function bootMegaMenu() {
        var header = document.querySelector('[data-v6-header]');
        if (!header || header.dataset.v6MegaReady === 'true') return;
        header.dataset.v6MegaReady = 'true';

        var trigger = header.querySelector('[data-v6-mega-trigger]');
        var panel = header.querySelector('[data-v6-mega]');
        var closeButton = header.querySelector('[data-v6-mega-close]');
        var tabs = panel
            ? Array.from(panel.querySelectorAll('[data-v6-mega-tab]'))
            : [];
        var details = panel
            ? Array.from(panel.querySelectorAll('[data-v6-mega-detail]'))
            : [];
        var focusables = [];
        var hoverIntent = null;
        if (!trigger || !panel) return;

        function syncFocusables() {
            focusables = panel
                ? Array.from(panel.querySelectorAll('[data-v6-mega-focusable]'))
                : [];
        }

        function activateTab(targetId, focusDetail) {
            if (!targetId) return;
            tabs.forEach(function (tab) {
                var isActive = tab.getAttribute('data-v6-target') === targetId;
                tab.classList.toggle('is-active', isActive);
                tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
            });
            details.forEach(function (detail) {
                var isActive = detail.id === targetId;
                detail.classList.toggle('is-active', isActive);
                detail.hidden = !isActive;
            });
            if (focusDetail) {
                var detailNode = document.getElementById(targetId);
                if (detailNode) {
                    var detailFocusable = detailNode.querySelector(
                        '[data-v6-mega-focusable]'
                    );
                    if (detailFocusable) {
                        detailFocusable.focus();
                    }
                }
            }
        }

        syncFocusables();
        if (tabs.length) {
            activateTab(tabs[0].getAttribute('data-v6-target') || '', false);
        }

        function isDesktop() {
            return window.matchMedia('(min-width: 901px)').matches;
        }

        function alignPointer() {
            if (panel.hidden) return;
            var triggerRect = trigger.getBoundingClientRect();
            var panelRect = panel.getBoundingClientRect();
            if (!triggerRect.width || !panelRect.width) return;
            var desiredLeft =
                triggerRect.left + triggerRect.width / 2 - panelRect.left;
            var clampedLeft = Math.max(
                18,
                Math.min(panelRect.width - 30, desiredLeft)
            );
            panel.style.setProperty(
                '--v6-mega-pointer-left',
                clampedLeft + 'px'
            );
        }

        function openPanel() {
            panel.hidden = false;
            trigger.setAttribute('aria-expanded', 'true');
            panel.classList.add('is-open');
            syncFocusables();
            window.requestAnimationFrame(alignPointer);
        }

        function closePanel() {
            panel.hidden = true;
            trigger.setAttribute('aria-expanded', 'false');
            panel.classList.remove('is-open');
        }

        trigger.addEventListener('click', function () {
            if (panel.hidden) {
                openPanel();
            } else {
                closePanel();
            }
        });

        trigger.addEventListener('mouseenter', function () {
            if (!isDesktop()) return;
            if (hoverIntent) window.clearTimeout(hoverIntent);
            hoverIntent = window.setTimeout(openPanel, 70);
        });

        trigger.addEventListener('keydown', function (event) {
            if (event.key === 'ArrowDown') {
                event.preventDefault();
                if (panel.hidden) {
                    openPanel();
                }
                if (tabs[0]) {
                    tabs[0].focus();
                }
            } else if (event.key === 'Escape') {
                closePanel();
            }
        });

        panel.addEventListener('mouseenter', function () {
            if (hoverIntent) window.clearTimeout(hoverIntent);
        });

        panel.addEventListener('mouseleave', function () {
            if (!isDesktop()) return;
            hoverIntent = window.setTimeout(function () {
                if (!panel.contains(document.activeElement)) {
                    closePanel();
                }
            }, 120);
        });

        panel.addEventListener('keydown', function (event) {
            if (event.key === 'Escape') {
                event.preventDefault();
                closePanel();
                trigger.focus();
                return;
            }

            var activeElement = document.activeElement;
            if (
                activeElement &&
                activeElement.closest('[data-v6-mega-categories]')
            ) {
                return;
            }

            if (
                event.key !== 'ArrowDown' &&
                event.key !== 'ArrowUp' &&
                event.key !== 'Home' &&
                event.key !== 'End'
            ) {
                return;
            }
            if (!focusables.length) return;
            var currentIndex = focusables.indexOf(activeElement);
            if (currentIndex === -1) return;

            event.preventDefault();
            var nextIndex = currentIndex;
            if (event.key === 'ArrowDown') {
                nextIndex = (currentIndex + 1) % focusables.length;
            } else if (event.key === 'ArrowUp') {
                nextIndex =
                    (currentIndex - 1 + focusables.length) % focusables.length;
            } else if (event.key === 'Home') {
                nextIndex = 0;
            } else if (event.key === 'End') {
                nextIndex = focusables.length - 1;
            }
            focusables[nextIndex].focus();
        });

        tabs.forEach(function (tab, tabIndex) {
            if (tab.dataset.v6MegaTabReady === 'true') return;
            tab.dataset.v6MegaTabReady = 'true';

            var targetId = tab.getAttribute('data-v6-target') || '';
            if (!targetId) return;

            tab.addEventListener('mouseenter', function () {
                if (!isDesktop()) return;
                activateTab(targetId, false);
            });

            tab.addEventListener('focus', function () {
                activateTab(targetId, false);
            });

            tab.addEventListener('click', function () {
                activateTab(targetId, true);
            });

            tab.addEventListener('keydown', function (event) {
                var key = event.key;
                if (
                    key !== 'ArrowDown' &&
                    key !== 'ArrowUp' &&
                    key !== 'ArrowLeft' &&
                    key !== 'ArrowRight' &&
                    key !== 'Home' &&
                    key !== 'End' &&
                    key !== 'Enter' &&
                    key !== ' '
                ) {
                    return;
                }

                event.preventDefault();
                event.stopPropagation();

                if (key === 'Enter' || key === ' ') {
                    activateTab(targetId, true);
                    return;
                }

                var nextIndex = tabIndex;
                if (key === 'ArrowDown' || key === 'ArrowRight') {
                    nextIndex = (tabIndex + 1) % tabs.length;
                } else if (key === 'ArrowUp' || key === 'ArrowLeft') {
                    nextIndex = (tabIndex - 1 + tabs.length) % tabs.length;
                } else if (key === 'Home') {
                    nextIndex = 0;
                } else if (key === 'End') {
                    nextIndex = tabs.length - 1;
                }

                var nextTab = tabs[nextIndex];
                if (!nextTab) return;
                var nextTargetId = nextTab.getAttribute('data-v6-target') || '';
                activateTab(nextTargetId, false);
                nextTab.focus();
            });
        });

        if (closeButton) {
            closeButton.addEventListener('click', function () {
                closePanel();
                trigger.focus();
            });
        }

        document.addEventListener('click', function (event) {
            if (panel.hidden) return;
            var target = event.target instanceof Element ? event.target : null;
            if (!target) return;
            if (
                !target.closest('[data-v6-mega]') &&
                !target.closest('[data-v6-mega-trigger]')
            ) {
                closePanel();
            }
        });

        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape') {
                closePanel();
            }
        });

        window.addEventListener('resize', alignPointer);
    }

    function bootPageMenus() {
        var menuButtons = Array.from(
            document.querySelectorAll('[data-v6-page-menu]')
        );
        if (!menuButtons.length) return;

        function closeAll(exceptButton) {
            menuButtons.forEach(function (button) {
                if (exceptButton && button === exceptButton) return;
                var panelId = button.getAttribute('aria-controls');
                if (!panelId) return;
                var panel = document.getElementById(panelId);
                if (!panel) return;
                panel.hidden = true;
                button.setAttribute('aria-expanded', 'false');
            });
        }

        menuButtons.forEach(function (button) {
            if (button.dataset.v6PageMenuReady === 'true') return;
            button.dataset.v6PageMenuReady = 'true';
            var panelId = button.getAttribute('aria-controls');
            if (!panelId) return;
            var panel = document.getElementById(panelId);
            if (!panel) return;

            button.addEventListener('click', function () {
                var open = !panel.hidden;
                closeAll(button);
                panel.hidden = open;
                button.setAttribute('aria-expanded', open ? 'false' : 'true');
            });

            panel
                .querySelectorAll('[data-v6-page-menu-link]')
                .forEach(function (link) {
                    link.addEventListener('click', function () {
                        panel.hidden = true;
                        button.setAttribute('aria-expanded', 'false');
                    });
                });
        });

        document.addEventListener('click', function (event) {
            var target = event.target instanceof Element ? event.target : null;
            if (!target) return;
            var insideMenu =
                target.closest('[data-v6-page-menu]') ||
                target.closest('[data-v6-page-menu-panel]');
            if (!insideMenu) {
                closeAll(null);
            }
        });

        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape') {
                closeAll(null);
            }
        });
    }

    function bootDrawer() {
        var header = document.querySelector('[data-v6-header]');
        if (!header || header.dataset.v6DrawerReady === 'true') return;
        header.dataset.v6DrawerReady = 'true';

        var drawer = header.querySelector('[data-v6-drawer]');
        var openButton = header.querySelector('[data-v6-drawer-open]');
        var groupToggles = drawer
            ? Array.from(
                  drawer.querySelectorAll('[data-v6-drawer-group-toggle]')
              )
            : [];
        if (!drawer || !openButton) return;

        function openDrawer() {
            drawer.hidden = false;
            document.body.style.overflow = 'hidden';
        }

        function closeDrawer() {
            drawer.hidden = true;
            document.body.style.overflow = '';
        }

        function setGroup(targetId, expand) {
            groupToggles.forEach(function (toggle) {
                var panelId = toggle.getAttribute('data-v6-target');
                var isTarget = panelId === targetId;
                var isExpanded = isTarget && expand;
                toggle.setAttribute(
                    'aria-expanded',
                    isExpanded ? 'true' : 'false'
                );
                toggle.classList.toggle('is-active', isExpanded);
                if (!panelId) return;
                var content = drawer.querySelector('#' + panelId);
                if (content) {
                    content.hidden = !isExpanded;
                }
            });
        }

        openButton.addEventListener('click', openDrawer);

        drawer
            .querySelectorAll('[data-v6-drawer-close]')
            .forEach(function (node) {
                node.addEventListener('click', closeDrawer);
            });

        groupToggles.forEach(function (toggle) {
            toggle.addEventListener('click', function () {
                var targetId = toggle.getAttribute('data-v6-target');
                if (!targetId) return;
                var willExpand =
                    toggle.getAttribute('aria-expanded') !== 'true';
                setGroup(targetId, willExpand);
            });
        });

        drawer.querySelectorAll('a').forEach(function (anchor) {
            anchor.addEventListener('click', closeDrawer);
        });

        drawer.addEventListener('keydown', function (event) {
            if (event.key === 'Escape') {
                closeDrawer();
            }
        });
    }

    function bootHero() {
        var roots = Array.from(document.querySelectorAll('[data-v6-hero]'));
        roots.forEach(function (root) {
            if (!root || root.dataset.v6HeroReady === 'true') return;
            root.dataset.v6HeroReady = 'true';

            var slides = Array.from(root.querySelectorAll('[data-v6-slide]'));
            var indicators = Array.from(
                root.querySelectorAll('[data-v6-indicator]')
            );
            if (!slides.length) return;

            var prev = root.querySelector('[data-v6-prev]');
            var next = root.querySelector('[data-v6-next]');
            var toggle = root.querySelector('[data-v6-toggle]');
            var bandCategory = root.querySelector('[data-v6-band-category]');
            var bandTitle = root.querySelector('[data-v6-band-title]');
            var bandDescription = root.querySelector(
                '[data-v6-band-description]'
            );

            var autoplayMs = Number(
                root.getAttribute('data-v6-autoplay-ms') || 7000
            );
            if (!Number.isFinite(autoplayMs) || autoplayMs < 2000) {
                autoplayMs = 7000;
            }
            var playLabel = root.getAttribute('data-v6-label-play') || 'Play';
            var pauseLabel =
                root.getAttribute('data-v6-label-pause') || 'Pause';

            var current = 0;
            var paused = false;
            var timer = null;
            var autoplayDelay = Math.max(6500, autoplayMs - 200);
            var prefersReducedMotion =
                Boolean(window.matchMedia) &&
                window.matchMedia('(prefers-reduced-motion: reduce)').matches;

            function updateBand(activeSlide) {
                if (!activeSlide) return;
                if (bandCategory) {
                    bandCategory.textContent =
                        activeSlide.getAttribute('data-v6-category') || '';
                }
                if (bandTitle) {
                    bandTitle.textContent =
                        activeSlide.getAttribute('data-v6-title') || '';
                }
                if (bandDescription) {
                    bandDescription.textContent =
                        activeSlide.getAttribute('data-v6-description') || '';
                }
            }

            function syncToggle() {
                if (!toggle) return;
                toggle.textContent = paused ? playLabel : pauseLabel;
                toggle.setAttribute('aria-pressed', paused ? 'true' : 'false');
                root.setAttribute(
                    'data-v6-state',
                    paused ? 'paused' : 'playing'
                );
                syncIndicatorProgress();
            }

            function syncIndicatorProgress() {
                var shouldAnimate =
                    !paused &&
                    !document.hidden &&
                    !prefersReducedMotion &&
                    slides.length > 1;
                indicators.forEach(function (indicator, indicatorIndex) {
                    indicator.style.setProperty(
                        '--v6-progress-duration',
                        autoplayDelay + 'ms'
                    );
                    indicator.classList.remove('is-progressing');
                    var fill = indicator.querySelector(
                        '[data-v6-indicator-fill]'
                    );
                    if (fill) {
                        fill.style.animation = 'none';
                        void fill.offsetWidth;
                        fill.style.animation = '';
                    }
                    if (indicatorIndex === current && shouldAnimate) {
                        indicator.classList.add('is-progressing');
                    }
                });
            }

            function render(index) {
                current = normalizeIndex(index, slides.length);
                var prevIndex = normalizeIndex(current - 1, slides.length);
                var nextIndex = normalizeIndex(current + 1, slides.length);

                slides.forEach(function (slide, slideIndex) {
                    slide.classList.toggle('is-active', slideIndex === current);
                    slide.classList.toggle('is-prev', slideIndex === prevIndex);
                    slide.classList.toggle('is-next', slideIndex === nextIndex);
                    slide.setAttribute(
                        'aria-hidden',
                        slideIndex === current ? 'false' : 'true'
                    );
                });

                indicators.forEach(function (indicator, indicatorIndex) {
                    var isActive = indicatorIndex === current;
                    indicator.classList.toggle('is-active', isActive);
                    indicator.setAttribute(
                        'aria-selected',
                        isActive ? 'true' : 'false'
                    );
                });

                updateBand(slides[current]);
                syncIndicatorProgress();
            }

            function stopAutoplay() {
                if (timer !== null) {
                    window.clearTimeout(timer);
                    timer = null;
                }
                syncIndicatorProgress();
            }

            function startAutoplay() {
                stopAutoplay();
                if (paused || slides.length < 2 || document.hidden) return;
                syncIndicatorProgress();

                timer = window.setTimeout(function tick() {
                    render(current + 1);
                    if (paused || slides.length < 2 || document.hidden) {
                        timer = null;
                        return;
                    }
                    timer = window.setTimeout(tick, autoplayDelay);
                }, autoplayDelay);
            }

            if (prev) {
                prev.addEventListener('click', function () {
                    render(current - 1);
                    startAutoplay();
                });
            }

            if (next) {
                next.addEventListener('click', function () {
                    render(current + 1);
                    startAutoplay();
                });
            }

            if (toggle) {
                toggle.addEventListener('click', function () {
                    paused = !paused;
                    syncToggle();
                    if (paused) {
                        stopAutoplay();
                    } else {
                        startAutoplay();
                    }
                });
            }

            indicators.forEach(function (indicator) {
                indicator.addEventListener('click', function () {
                    var target = Number(
                        indicator.getAttribute('data-v6-target') || 0
                    );
                    render(target);
                    startAutoplay();
                });
            });

            root.addEventListener('keydown', function (event) {
                if (event.key === 'ArrowLeft') {
                    event.preventDefault();
                    render(current - 1);
                    startAutoplay();
                }
                if (event.key === 'ArrowRight') {
                    event.preventDefault();
                    render(current + 1);
                    startAutoplay();
                }
                if (event.key === 'Home') {
                    event.preventDefault();
                    render(0);
                    startAutoplay();
                }
                if (event.key === 'End') {
                    event.preventDefault();
                    render(slides.length - 1);
                    startAutoplay();
                }
            });

            document.addEventListener('visibilitychange', function () {
                if (document.hidden) {
                    stopAutoplay();
                } else {
                    startAutoplay();
                }
            });

            render(0);
            syncToggle();
            startAutoplay();
        });
    }

    function bootBackTop() {
        var button = document.querySelector('[data-v6-back-top]');
        if (!button || button.dataset.v6TopReady === 'true') return;
        button.dataset.v6TopReady = 'true';

        function sync() {
            if (window.scrollY > 520) {
                button.classList.add('is-visible');
            } else {
                button.classList.remove('is-visible');
            }
        }

        button.addEventListener('click', function () {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });

        window.addEventListener('scroll', sync, { passive: true });
        sync();
    }

    function bootstrap() {
        bootMegaMenu();
        bootPageMenus();
        bootDrawer();
        bootHero();
        bootBackTop();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootstrap, {
            once: true,
        });
    } else {
        bootstrap();
    }
})();

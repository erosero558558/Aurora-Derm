(function () {
    'use strict';

    let deps = null;
    let bookingViewTracked = false;
    let availabilityPrefetched = false;
    let reviewsPrefetched = false;
    let checkoutSession = {
        active: false,
        completed: false,
        startedAt: 0,
        service: '',
        doctor: '',
        step: '',
        entry: '',
        paymentMethod: '',
    };

    function init(inputDeps) {
        deps = inputDeps || {};
        return window.Piel.AnalyticsEngine;
    }

    function trackEvent(eventName, params = {}) {
        if (!eventName || typeof eventName !== 'string') {
            return;
        }

        if (deps && typeof deps.trackEventToServer === 'function') {
            try {
                deps.trackEventToServer(eventName, params);
            } catch (_) {
                // Ignore telemetry forwarding failures.
            }
        }

        const payload = {
            event_category: 'conversion',
            ...params,
        };

        if (typeof window.gtag === 'function') {
            window.gtag('event', eventName, payload);
            return;
        }

        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({
            event: eventName,
            ...payload,
        });
    }

    function normalizeAnalyticsLabel(value, fallback = 'unknown') {
        if (value === null || value === undefined) {
            return fallback;
        }

        const normalized = String(value)
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '')
            .slice(0, 64);

        return normalized || fallback;
    }

    function observeOnceWhenVisible(element, onVisible, options = {}) {
        if (!element || typeof onVisible !== 'function') {
            return false;
        }

        if (deps && typeof deps.observeOnceWhenVisible === 'function') {
            return deps.observeOnceWhenVisible(
                element,
                onVisible,
                options || {}
            );
        }

        const {
            threshold = 0.2,
            rootMargin = '0px',
            onNoObserver,
        } = options || {};
        if (!('IntersectionObserver' in window)) {
            if (typeof onNoObserver === 'function') {
                onNoObserver();
            }
            return false;
        }

        const observer = new IntersectionObserver(
            (entries, currentObserver) => {
                const isVisible = entries.some(
                    (entry) => entry && entry.isIntersecting
                );
                if (!isVisible) {
                    return;
                }
                currentObserver.disconnect();
                onVisible();
            },
            {
                threshold,
                rootMargin,
            }
        );

        observer.observe(element);
        return true;
    }

    function prefetchAvailabilityData(source = 'unknown') {
        if (availabilityPrefetched) {
            return;
        }

        availabilityPrefetched = true;

        if (deps && typeof deps.loadAvailabilityData === 'function') {
            Promise.resolve(
                deps.loadAvailabilityData({ background: true })
            ).catch(() => {
                availabilityPrefetched = false;
            });
        }

        trackEvent('availability_prefetch', { source });
    }

    function prefetchReviewsData(source = 'unknown') {
        if (reviewsPrefetched) {
            return;
        }

        reviewsPrefetched = true;

        if (deps && typeof deps.loadPublicReviews === 'function') {
            Promise.resolve(deps.loadPublicReviews({ background: true })).catch(
                () => {
                    reviewsPrefetched = false;
                }
            );
        }

        trackEvent('reviews_prefetch', { source });
    }

    function markBookingViewed(source = 'unknown') {
        if (bookingViewTracked) {
            return;
        }

        bookingViewTracked = true;
        trackEvent('view_booking', { source });
    }

    function initBookingFunnelObserver() {
        const bookingSection = document.getElementById('citas');
        if (!bookingSection) {
            return;
        }

        observeOnceWhenVisible(
            bookingSection,
            () => {
                markBookingViewed('observer');
                prefetchAvailabilityData('booking_section_visible');
            },
            {
                threshold: 0.35,
                onNoObserver: () => {
                    markBookingViewed('fallback_no_observer');
                    prefetchAvailabilityData('fallback_no_observer');
                },
            }
        );
    }

    function initDeferredSectionPrefetch() {
        const reviewsSection = document.getElementById('resenas');
        if (!reviewsSection) {
            return;
        }

        observeOnceWhenVisible(
            reviewsSection,
            () => {
                prefetchReviewsData('reviews_section_visible');
            },
            {
                threshold: 0.2,
                rootMargin: '120px 0px',
                onNoObserver: () => {
                    prefetchReviewsData('fallback_no_observer');
                },
            }
        );
    }

    function startCheckoutSession(appointment, metadata = {}) {
        const checkoutEntry = normalizeAnalyticsLabel(
            metadata && (metadata.checkoutEntry || metadata.entry),
            'unknown'
        );
        const initialStep = normalizeAnalyticsLabel(
            metadata && metadata.step,
            'checkout_started'
        );

        checkoutSession = {
            active: true,
            completed: false,
            startedAt: Date.now(),
            service:
                appointment && appointment.service ? appointment.service : '',
            doctor: appointment && appointment.doctor ? appointment.doctor : '',
            step: initialStep,
            entry: checkoutEntry,
            paymentMethod: '',
        };
    }

    function setCheckoutStep(step, metadata = {}) {
        if (!checkoutSession.active || checkoutSession.completed) {
            return;
        }

        checkoutSession.step = normalizeAnalyticsLabel(
            step,
            checkoutSession.step || 'unknown'
        );

        if (metadata && typeof metadata === 'object') {
            if (metadata.service) {
                checkoutSession.service = String(metadata.service);
            }
            if (metadata.doctor) {
                checkoutSession.doctor = String(metadata.doctor);
            }
            if (metadata.paymentMethod) {
                checkoutSession.paymentMethod = normalizeAnalyticsLabel(
                    metadata.paymentMethod,
                    'unknown'
                );
            }
            if (metadata.checkoutEntry || metadata.entry) {
                checkoutSession.entry = normalizeAnalyticsLabel(
                    metadata.checkoutEntry || metadata.entry,
                    checkoutSession.entry || 'unknown'
                );
            }
        }
    }

    function setCheckoutSessionActive(active) {
        checkoutSession.active = active === true;
    }

    function getCheckoutSession() {
        return {
            active: checkoutSession.active === true,
            completed: checkoutSession.completed === true,
            startedAt: Number(checkoutSession.startedAt) || 0,
            service: String(checkoutSession.service || ''),
            doctor: String(checkoutSession.doctor || ''),
            step: String(checkoutSession.step || ''),
            entry: String(checkoutSession.entry || ''),
            paymentMethod: String(checkoutSession.paymentMethod || ''),
        };
    }

    function completeCheckoutSession(method) {
        if (!checkoutSession.active) {
            return;
        }

        checkoutSession.completed = true;
        checkoutSession.step = 'booking_confirmed';
        checkoutSession.paymentMethod = normalizeAnalyticsLabel(
            method,
            checkoutSession.paymentMethod || 'unknown'
        );
        trackEvent('booking_confirmed', {
            payment_method: method || 'unknown',
            service: checkoutSession.service || '',
            doctor: checkoutSession.doctor || '',
            checkout_step: checkoutSession.step || 'booking_confirmed',
            checkout_entry: checkoutSession.entry || 'unknown',
        });
    }

    function maybeTrackCheckoutAbandon(reason = 'unknown') {
        if (!checkoutSession.active || checkoutSession.completed) {
            return;
        }

        const startedAt = checkoutSession.startedAt || Date.now();
        const elapsedSec = Math.max(
            0,
            Math.round((Date.now() - startedAt) / 1000)
        );
        trackEvent('checkout_abandon', {
            service: checkoutSession.service || '',
            doctor: checkoutSession.doctor || '',
            payment_method: checkoutSession.paymentMethod || 'unknown',
            elapsed_sec: elapsedSec,
            reason: normalizeAnalyticsLabel(reason, 'unknown'),
            checkout_step: checkoutSession.step || 'unknown',
            checkout_entry: checkoutSession.entry || 'unknown',
        });
    }

    window.Piel = window.Piel || {};
    window.Piel.AnalyticsEngine = {
        init,
        trackEvent,
        normalizeAnalyticsLabel,
        markBookingViewed,
        prefetchAvailabilityData,
        prefetchReviewsData,
        initBookingFunnelObserver,
        initDeferredSectionPrefetch,
        startCheckoutSession,
        setCheckoutStep,
        setCheckoutSessionActive,
        getCheckoutSession,
        completeCheckoutSession,
        maybeTrackCheckoutAbandon,
    };

})();

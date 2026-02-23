'use strict';

let deps = null;
let initialized = false;
let escapeListenerBound = false;
let backGestureBound = false;
let isClosingViaBack = false;

function isAnyModalActive() {
    return document.querySelectorAll('.modal.active').length > 0;
}

function updateScrollLock() {
    const shouldLock = isAnyModalActive() || (document.getElementById('mobileMenu') && document.getElementById('mobileMenu').classList.contains('active'));

    if (shouldLock) {
        document.body.style.overflow = 'hidden';
    } else {
        document.body.style.overflow = '';
    }
}

function closeModalElement(modal) {
    if (!modal) {
        return;
    }

    if (modal.id === 'paymentModal') {
        if (deps && typeof deps.closePaymentModal === 'function') {
            deps.closePaymentModal();
        }
        return;
    }

    // Add closing class for exit animation
    modal.classList.add('closing');

    const onAnimationEnd = () => {
        modal.classList.remove('active');
        modal.classList.remove('closing');
        modal.removeEventListener('animationend', onAnimationEnd);
        updateScrollLock();
    };

    // Listen for animation end
    modal.addEventListener('animationend', onAnimationEnd, { once: true });

    // Fallback in case animation fails or prefers-reduced-motion
    setTimeout(() => {
        if (modal.classList.contains('closing')) {
            onAnimationEnd();
        }
    }, 400);
}

function bindBackdropClose() {
    document.querySelectorAll('.modal').forEach((modal) => {
        if (modal.dataset.modalUxBackdropBound === 'true') {
            return;
        }
        modal.dataset.modalUxBackdropBound = 'true';
        modal.addEventListener('click', function (e) {
            if (e.target === this) {
                closeModalElement(this);
            }
        });
    });
}

function bindEscapeClose() {
    if (escapeListenerBound) {
        return;
    }
    escapeListenerBound = true;

    document.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape') {
            return;
        }

        document.querySelectorAll('.modal.active').forEach((modal) => {
            closeModalElement(modal);
        });

        if (deps && typeof deps.toggleMobileMenu === 'function') {
            // Check if mobile menu is open before trying to close it
            const mobileMenu = document.getElementById('mobileMenu');
            if (mobileMenu && mobileMenu.classList.contains('active')) {
                deps.toggleMobileMenu(false);
            }
        }
    });
}

function setupBackGesture() {
    if (backGestureBound) {
        return;
    }
    backGestureBound = true;

    window.addEventListener('popstate', function () {
        isClosingViaBack = true;
        let closedAny = false;

        document.querySelectorAll('.modal.active').forEach((modal) => {
            closedAny = true;
            if (modal.id === 'paymentModal') {
                if (deps && typeof deps.closePaymentModal === 'function') {
                    deps.closePaymentModal({ skipAbandonTrack: false, reason: 'back_gesture' });
                }
            } else {
                modal.classList.remove('active');
            }
        });

        const mobileMenu = document.getElementById('mobileMenu');
        if (mobileMenu && mobileMenu.classList.contains('active')) {
            closedAny = true;
            if (deps && typeof deps.toggleMobileMenu === 'function') {
                deps.toggleMobileMenu(false);
            } else {
                mobileMenu.classList.remove('active');
            }
        }

        if (closedAny) {
            updateScrollLock();
        }

        setTimeout(() => {
            isClosingViaBack = false;
        }, 50);
    });

    const observer = new MutationObserver((mutations) => {
        let opened = false;
        let closed = false;

        mutations.forEach((mutation) => {
            if (mutation.attributeName === 'class') {
                const target = mutation.target;
                if (target.classList.contains('active')) {
                    opened = true;
                } else {
                    closed = true;
                }
            }
        });

        // Always update scroll lock on state change
        updateScrollLock();

        if (opened) {
            if (!history.state || !history.state.modalOpen) {
                history.pushState({ modalOpen: true }, '');
            }
        } else if (closed) {
            if (!isClosingViaBack && history.state && history.state.modalOpen) {
                history.back();
            }
        }
    });

    document.querySelectorAll('.modal, #mobileMenu').forEach((el) => {
        observer.observe(el, { attributes: true, attributeFilter: ['class'] });
    });
}

function init(inputDeps) {
    deps = inputDeps || deps;
    bindBackdropClose();
    bindEscapeClose();
    setupBackGesture();
    initialized = true;
    return window.PielModalUxEngine;
}

function isInitialized() {
    return initialized;
}

window.PielModalUxEngine = {
    init,
    isInitialized
};

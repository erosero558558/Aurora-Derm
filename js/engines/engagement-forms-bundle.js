(function () {
    'use strict';

    // build-sync: 20260219-sync1

    let deps = null;
    let initialized = false;
    let selectedRating = 0;
    let stars = [];

    function getLang() {
        return deps && typeof deps.getCurrentLang === 'function'
            ? deps.getCurrentLang()
            : 'es';
    }

    function t(esText, enText) {
        return getLang() === 'en' ? enText : esText;
    }

    function getCaptchaToken(action) {
        try {
            return deps.getCaptchaToken
                ? deps.getCaptchaToken(action)
                : Promise.resolve(null);
        } catch (_e) {
            return Promise.resolve(null);
        }
    }

    function resetStarVisuals() {
        stars.forEach((star) => {
            star.classList.remove('active', 'fas');
            star.classList.add('far');
        });
    }

    function applySelectedRating(rating) {
        selectedRating = rating;
        stars.forEach((star, index) => {
            const active = index < selectedRating;
            star.classList.toggle('active', active);
            star.classList.toggle('fas', active);
            star.classList.toggle('far', !active);
        });
    }

    function bindCallbackForm() {
        const callbackForm = document.getElementById('callbackForm');
        if (
            !callbackForm ||
            callbackForm.dataset.callbackEngineBound === 'true'
        ) {
            return;
        }
        callbackForm.dataset.callbackEngineBound = 'true';

        callbackForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            const submitBtn = this.querySelector('button[type="submit"]');
            const originalContent = submitBtn ? submitBtn.innerHTML : '';
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML =
                    '<i class="fas fa-spinner fa-spin"></i> Enviando...';
            }

            const formData = new FormData(this);
            const token = await getCaptchaToken('callback');
            const callback = {
                id: Date.now(),
                telefono: formData.get('telefono'),
                preferencia: formData.get('preferencia'),
                fecha: new Date().toISOString(),
                status: 'pendiente',
                captchaToken: token,
            };

            try {
                if (deps && typeof deps.createCallbackRecord === 'function') {
                    await deps.createCallbackRecord(callback);
                }
                if (deps && typeof deps.showToast === 'function') {
                    deps.showToast(
                        t(
                            'Solicitud enviada. Te llamaremos pronto.',
                            'Request sent. We will call you soon.'
                        ),
                        'success'
                    );
                }
                this.reset();
            } catch (_e) {
                if (deps && typeof deps.showToast === 'function') {
                    deps.showToast(
                        t(
                            'No se pudo enviar tu solicitud. Intenta de nuevo.',
                            'We could not send your request. Try again.'
                        ),
                        'error'
                    );
                }
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalContent;
                }
            }
        });
    }

    function bindReviewForm() {
        const reviewForm = document.getElementById('reviewForm');
        const reviewStars = Array.from(
            document.querySelectorAll('.star-rating i')
        );
        if (!reviewForm || reviewForm.dataset.reviewEngineBound === 'true') {
            stars = reviewStars;
            return;
        }

        reviewForm.dataset.reviewEngineBound = 'true';
        stars = reviewStars;
        selectedRating = 0;

        stars.forEach((star, index) => {
            star.addEventListener('click', () => {
                applySelectedRating(index + 1);
            });
        });

        reviewForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            if (selectedRating === 0) {
                alert(
                    t(
                        'Por favor selecciona una calificacion',
                        'Please select a rating'
                    )
                );
                return;
            }

            const formData = new FormData(this);
            const token = await getCaptchaToken('review');
            const review = {
                id: Date.now(),
                name: formData.get('reviewerName'),
                rating: selectedRating,
                text: formData.get('reviewText'),
                date: new Date().toISOString(),
                verified: true,
                captchaToken: token,
            };

            try {
                const savedReview =
                    deps && typeof deps.createReviewRecord === 'function'
                        ? await deps.createReviewRecord(review)
                        : review;

                const currentReviews =
                    deps && typeof deps.getReviewsCache === 'function'
                        ? deps.getReviewsCache()
                            : [];
                const mergedReviews = [
                    savedReview,
                    ...currentReviews.filter(
                        (item) => item.id !== savedReview.id
                    ),
                ];

                if (deps && typeof deps.setReviewsCache === 'function') {
                    deps.setReviewsCache(mergedReviews);
                }
                if (deps && typeof deps.renderPublicReviews === 'function') {
                    deps.renderPublicReviews(mergedReviews);
                }

                if (deps && typeof deps.showToast === 'function') {
                    deps.showToast(
                        t(
                            'Gracias por tu reseña.',
                            'Thank you for your review.'
                        ),
                        'success'
                    );
                }

                closeReviewModal();
                this.reset();
                selectedRating = 0;
                resetStarVisuals();
            } catch (_e) {
                if (deps && typeof deps.showToast === 'function') {
                    deps.showToast(
                        t(
                            'No pudimos guardar tu reseña. Intenta nuevamente.',
                            'We could not save your review. Try again.'
                        ),
                        'error'
                    );
                }
            }
        });
    }

    function openReviewModal() {
        const modal = document.getElementById('reviewModal');
        if (!modal) return;
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeReviewModal() {
        const modal = document.getElementById('reviewModal');
        if (!modal) return;
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }

    function init(inputDeps) {
        deps = inputDeps || deps;
        bindCallbackForm();
        bindReviewForm();
        initialized = true;
        return window.PielEngagementFormsEngine;
    }

    function isInitialized() {
        return initialized;
    }

    window.PielEngagementFormsEngine = {
        init,
        isInitialized,
        openReviewModal,
        closeReviewModal,
    };

})();

(function () {
    'use strict';

    let deps = null;
    let reviewsCache = [];

    const DEFAULT_PUBLIC_REVIEWS = [
        {
            id: 'google-jose-gancino',
            name: 'Jose Gancino',
            rating: 5,
            text: 'Buena atencion, solo faltan los numeros de la oficina y horarios de atencion.',
            date: '2025-10-01T10:00:00-05:00',
            verified: true
        },
        {
            id: 'google-jacqueline-ruiz-torres',
            name: 'Jacqueline Ruiz Torres',
            rating: 5,
            text: 'Excelente atencion y economico.',
            date: '2025-04-15T10:00:00-05:00',
            verified: true
        },
        {
            id: 'google-cris-lema',
            name: 'Cris Lema',
            rating: 5,
            text: '',
            date: '2025-10-10T10:00:00-05:00',
            verified: true
        },
        {
            id: 'google-camila-escobar',
            name: 'Camila Escobar',
            rating: 5,
            text: '',
            date: '2025-02-01T10:00:00-05:00',
            verified: true
        }
    ];

    function getLang() {
        return deps && typeof deps.getCurrentLang === 'function' ? deps.getCurrentLang() : 'es';
    }

    function escapeText(value) {
        if (deps && typeof deps.escapeHtml === 'function') {
            return deps.escapeHtml(value);
        }
        return '';
    }

    function mergePublicReviews(inputReviews) {
        const merged = [];
        const seen = new Set();

        const addReview = (review) => {
            if (!review || typeof review !== 'object') return;
            const name = String(review.name || '').trim().toLowerCase();
            const text = String(review.text || '').trim().toLowerCase();
            const date = String(review.date || '').trim();
            const signature = `${name}|${text}|${date}`;
            if (!name || seen.has(signature)) return;
            seen.add(signature);
            merged.push(review);
        };

        DEFAULT_PUBLIC_REVIEWS.forEach(addReview);
        if (Array.isArray(inputReviews)) {
            inputReviews.forEach(addReview);
        }

        return merged;
    }

    function getInitials(name) {
        if (deps && typeof deps.getInitials === 'function') {
            return deps.getInitials(name);
        }
        return 'PA';
    }

    function getRelativeDateLabel(dateText) {
        if (deps && typeof deps.getRelativeDateLabel === 'function') {
            return deps.getRelativeDateLabel(dateText);
        }
        return '';
    }

    function renderStars(rating) {
        if (deps && typeof deps.renderStars === 'function') {
            return deps.renderStars(rating);
        }
        return '';
    }

    function renderPublicReviews(reviews) {
        const grid = document.querySelector('.reviews-grid');
        if (!grid || !Array.isArray(reviews) || reviews.length === 0) return;

        const topReviews = reviews.slice(0, 6);
        grid.innerHTML = topReviews.map((review) => {
            const text = String(review.text || '').trim();
            const textHtml = text !== ''
                ? `<p class="review-text">"${escapeText(text)}"</p>`
                : '';
            return `
    <div class="review-card">
        <div class="review-header">
            <div class="review-avatar">${escapeText(getInitials(review.name))}</div>
            <div class="review-meta">
                <h4>${escapeText(review.name || (getLang() === 'es' ? 'Paciente' : 'Patient'))}</h4>
                <div class="review-stars">${renderStars(review.rating)}</div>
            </div>
        </div>
        ${textHtml}
        <span class="review-date">${getRelativeDateLabel(review.date)}</span>
    </div>
`;
        }).join('');

        if (reviews.length > 0) {
            const avg = reviews.reduce((sum, item) => sum + (Number(item.rating) || 0), 0) / reviews.length;
            const starsHtml = renderStars(Math.round(avg));

            document.querySelectorAll('.rating-number').forEach((el) => {
                el.textContent = avg.toFixed(1);
            });

            document.querySelectorAll('.rating-stars').forEach((el) => {
                el.innerHTML = starsHtml;
            });
        }

        const countText = getLang() === 'es'
            ? `${reviews.length} reseñas verificadas`
            : `${reviews.length} verified reviews`;

        document.querySelectorAll('.rating-count').forEach((el) => {
            el.textContent = countText;
        });
    }

    async function loadPublicReviews(options = {}) {
        const background = options && options.background === true;

        try {
            if (!deps || typeof deps.apiRequest !== 'function') {
                throw new Error('reviews-engine missing apiRequest dependency');
            }

            const payload = await deps.apiRequest('reviews', {
                background,
                silentSlowNotice: background
            });
            const fetchedReviews = Array.isArray(payload.data) ? payload.data : [];
            reviewsCache = mergePublicReviews(fetchedReviews);
        } catch (_e) {
            const localReviews = deps && typeof deps.storageGetJSON === 'function'
                ? deps.storageGetJSON('reviews', [])
                : [];
            reviewsCache = mergePublicReviews(localReviews);
        }

        renderPublicReviews(reviewsCache);
        return getCache();
    }

    function getCache() {
        return Array.isArray(reviewsCache) ? reviewsCache.slice() : [];
    }

    function setCache(items) {
        reviewsCache = mergePublicReviews(Array.isArray(items) ? items : []);
        return getCache();
    }

    function init(inputDeps) {
        deps = inputDeps || deps || {};
        if (reviewsCache.length === 0) {
            reviewsCache = mergePublicReviews([]);
        }
        return window.PielReviewsEngine;
    }

    window.PielReviewsEngine = {
        init,
        loadPublicReviews,
        renderPublicReviews,
        getCache,
        setCache
    };

})();

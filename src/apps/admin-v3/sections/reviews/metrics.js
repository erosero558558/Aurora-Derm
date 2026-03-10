import { formatDateTime } from '../../shared/ui/render.js';
import { reviewTimestamp } from './helpers.js';

export function getAverageRating(reviews) {
    if (!reviews.length) return 0;
    return (
        reviews.reduce((sum, item) => sum + Number(item.rating || 0), 0) /
        reviews.length
    );
}

export function countRecentReviews(reviews, days = 30) {
    const now = Date.now();
    return reviews.filter((item) => {
        const stamp = reviewTimestamp(item);
        if (!stamp) return false;
        return now - stamp <= days * 24 * 60 * 60 * 1000;
    }).length;
}

export function countLowRatedReviews(reviews) {
    return reviews.filter((item) => Number(item.rating || 0) <= 3).length;
}

export function countFiveStarReviews(reviews) {
    return reviews.filter((item) => Number(item.rating || 0) >= 5).length;
}

export function getSentimentLabel(avgRating, totalReviews, lowRatedCount) {
    if (!totalReviews) return 'Sin senal suficiente';
    if (lowRatedCount > 0 && avgRating < 4) return 'Atencion requerida';
    if (avgRating >= 4.7) return 'Confianza alta';
    if (avgRating >= 4.2) return 'Tono solido';
    if (avgRating >= 3.5) return 'Lectura mixta';
    return 'Atencion requerida';
}

export function getLatestReviewMeta(sortedReviews) {
    const latestReview = sortedReviews[0];
    return {
        latestDate: latestReview
            ? formatDateTime(latestReview.date || latestReview.createdAt || '')
            : '-',
        latestAuthor: latestReview
            ? String(latestReview.name || 'Anonimo')
            : 'Sin datos',
    };
}

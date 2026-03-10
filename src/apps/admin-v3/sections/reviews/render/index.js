import { getState } from '../../../shared/core/store.js';
import { setHtml, setText } from '../../../shared/ui/render.js';
import { getSortedReviews, normalize, reviewTimestamp } from '../helpers.js';
import {
    countFiveStarReviews,
    countLowRatedReviews,
    countRecentReviews,
    getAverageRating,
    getLatestReviewMeta,
    getSentimentLabel,
} from '../metrics.js';
import {
    buildSummaryRail,
    renderEmptyReviewsGrid,
    renderEmptyReviewsSpotlight,
    renderSpotlightCard,
    renderSpotlightEmpty,
    reviewCard,
} from '../markup.js';
import { getSpotlightReview } from '../spotlight.js';

function buildReviewsGrid(sortedReviews, spotlight) {
    return sortedReviews
        .map((item) =>
            reviewCard(item, {
                featured:
                    spotlight.item &&
                    normalize(item.name) === normalize(spotlight.item.name) &&
                    reviewTimestamp(item) === reviewTimestamp(spotlight.item),
            })
        )
        .join('');
}

export function renderReviewsSection() {
    const state = getState();
    const reviews = Array.isArray(state?.data?.reviews)
        ? state.data.reviews
        : [];
    const sortedReviews = getSortedReviews(reviews);
    const avgRating = getAverageRating(reviews);
    const recentCount = countRecentReviews(reviews);
    const lowRatedCount = countLowRatedReviews(reviews);
    const spotlight = getSpotlightReview(sortedReviews);
    const { latestAuthor, latestDate } = getLatestReviewMeta(sortedReviews);

    setText('#reviewsAverageRating', avgRating.toFixed(1));
    setText('#reviewsFiveStarCount', countFiveStarReviews(reviews));
    setText('#reviewsRecentCount', recentCount);
    setText('#reviewsTotalCount', reviews.length);
    setText(
        '#reviewsSentimentLabel',
        getSentimentLabel(avgRating, reviews.length, lowRatedCount)
    );
    setHtml(
        '#reviewsSummaryRail',
        buildSummaryRail({
            latestAuthor,
            latestDate,
            recentCount,
            lowRatedCount,
        })
    );

    if (!reviews.length) {
        setHtml('#reviewsSpotlight', renderEmptyReviewsSpotlight());
        setHtml('#reviewsGrid', renderEmptyReviewsGrid());
        return;
    }

    if (!spotlight.item) {
        setHtml('#reviewsSpotlight', renderSpotlightEmpty(spotlight.summary));
    } else {
        setHtml('#reviewsSpotlight', renderSpotlightCard(spotlight));
    }

    setHtml('#reviewsGrid', buildReviewsGrid(sortedReviews, spotlight));
}

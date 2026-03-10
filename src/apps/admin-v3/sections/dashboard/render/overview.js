import { setText } from '../../../shared/ui/render.js';
import { heroSummary } from '../markup.js';

export function setOverviewMetrics(state) {
    const {
        appointments,
        avgRating,
        nextAppointment,
        noShows,
        pendingCallbacks,
        pendingTransfers,
        recentReviews,
        reviews,
        todayAppointments,
        urgentCallbacks,
    } = state;

    setText('#todayAppointments', todayAppointments);
    setText('#totalAppointments', appointments.length);
    setText('#pendingCallbacks', pendingCallbacks);
    setText('#totalReviewsCount', reviews.length);
    setText('#totalNoShows', noShows);
    setText('#avgRating', avgRating);
    setText('#adminAvgRating', avgRating);

    setText('#dashboardHeroRating', avgRating);
    setText('#dashboardHeroRecentReviews', recentReviews);
    setText('#dashboardHeroUrgentCallbacks', urgentCallbacks);
    setText('#dashboardHeroPendingTransfers', pendingTransfers);
    setText(
        '#dashboardHeroSummary',
        heroSummary({
            pendingTransfers,
            urgentCallbacks,
            noShows,
            nextAppointment,
        })
    );
}

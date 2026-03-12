import { setText } from '../../../shared/ui/render.js';

export function renderChromeBadges(metrics) {
    setText('#dashboardBadge', metrics.dashboardAlerts);
    setText('#clinical-historyBadge', metrics.clinicalHistoryQueue);
    setText('#appointmentsBadge', metrics.appointments.length);
    setText('#callbacksBadge', metrics.pendingCallbacks);
    setText('#reviewsBadge', metrics.reviews.length);
    setText('#availabilityBadge', metrics.availabilityDays);
    setText('#queueBadge', metrics.waitingTickets);
}

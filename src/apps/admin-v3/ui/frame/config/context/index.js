import { DASHBOARD_CONTEXT } from './dashboard.js';
import { CLINICAL_HISTORY_CONTEXT } from './clinical-history.js';
import { APPOINTMENTS_CONTEXT } from './appointments.js';
import { CALLBACKS_CONTEXT } from './callbacks.js';
import { REVIEWS_CONTEXT } from './reviews.js';
import { AVAILABILITY_CONTEXT } from './availability.js';
import { QUEUE_CONTEXT } from './queue.js';

export const SECTION_CONTEXT = {
    dashboard: DASHBOARD_CONTEXT,
    'clinical-history': CLINICAL_HISTORY_CONTEXT,
    appointments: APPOINTMENTS_CONTEXT,
    callbacks: CALLBACKS_CONTEXT,
    reviews: REVIEWS_CONTEXT,
    availability: AVAILABILITY_CONTEXT,
    queue: QUEUE_CONTEXT,
};

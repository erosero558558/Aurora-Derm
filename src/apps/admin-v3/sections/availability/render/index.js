import { persistAvailabilityPreferences } from '../preferences.js';
import { renderAvailabilityCalendar } from './calendar.js';
import { refreshAvailabilityHeader } from './header.js';
import { renderAvailabilityReviewContext } from './review-context.js';
import { renderAvailabilitySlotList } from './slots.js';

export function renderAvailabilitySection() {
    renderAvailabilityReviewContext();
    renderAvailabilityCalendar();
    renderAvailabilitySlotList();
    refreshAvailabilityHeader();
    persistAvailabilityPreferences();
}

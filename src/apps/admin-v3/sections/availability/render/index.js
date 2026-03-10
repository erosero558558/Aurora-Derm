import { persistAvailabilityPreferences } from '../preferences.js';
import { renderAvailabilityCalendar } from './calendar.js';
import { refreshAvailabilityHeader } from './header.js';
import { renderAvailabilitySlotList } from './slots.js';

export function renderAvailabilitySection() {
    renderAvailabilityCalendar();
    renderAvailabilitySlotList();
    refreshAvailabilityHeader();
    persistAvailabilityPreferences();
}

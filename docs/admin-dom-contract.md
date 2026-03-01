# Admin DOM and API Contract (Frozen)

## Scope

This document freezes the public admin contract used by Playwright suites and operational scripts.

## Route Contract

- `GET /admin.html`
- Variant selector precedence:

1. `admin_ui=sony_v2|legacy` query param
2. `localStorage.adminUiVariant`
3. backend feature flag `admin_sony_ui` from `GET /api.php?resource=features`
4. fallback `legacy`

- Optional contingency query: `admin_ui_reset=1` clears `localStorage.adminUiVariant` before variant resolution.
- Kill-switch hard rule:
  If `admin_sony_ui=false`, any requested/stored `sony_v2` must be downgraded to `legacy` and persisted as `legacy` for immediate rollback consistency.
- Admin CSP hardening:
  `script-src 'self'`, `style-src 'self'`, `font-src 'self'` (sin dependencias externas).

## Auth/API Contract

- `POST /admin-auth.php?action=login`
- `POST /admin-auth.php?action=login-2fa`
- `GET /admin-auth.php?action=status`
- `POST /admin-auth.php?action=logout`
- `GET /api.php?resource=data`
- `GET /api.php?resource=funnel-metrics`
- `GET /api.php?resource=health`
- `PATCH /api.php?resource=appointments`
- `PATCH /api.php?resource=callbacks`
- `POST /api.php?resource=availability`
- `GET /api.php?resource=queue-state`
- `POST /api.php?resource=queue-call-next`
- `PATCH /api.php?resource=queue-ticket`
- `POST /api.php?resource=queue-reprint`

## Required Sections (`data-section`)

- `dashboard`
- `appointments`
- `callbacks`
- `reviews`
- `availability`
- `queue`

## Required IDs (tests + ops)

- `#loginForm`, `#adminDashboard`, `#adminSidebar`, `#adminMenuToggle`, `#adminMenuClose`, `#adminSidebarBackdrop`, `#adminSidebarCollapse`
- `#pageTitle`, `#adminQuickCommand`, `#adminRunQuickCommandBtn`, `#adminRefreshStatus`, `#adminContextTitle`
- `#dashboard`, `#funnelAbandonList`, `#funnelEntryList`, `#funnelSourceList`, `#funnelPaymentMethodList`, `#funnelAbandonReasonList`, `#funnelStepList`, `#funnelErrorCodeList`
- `#appointments`, `#appointmentFilter`, `#appointmentSort`, `#searchAppointments`, `#clearAppointmentsFiltersBtn`, `#appointmentsToolbarMeta`, `#appointmentsToolbarState`, `#appointmentsTableBody`
- `#callbacks`, `#callbackFilter`, `#searchCallbacks`, `#clearCallbacksFiltersBtn`, `#callbacksToolbarMeta`, `#callbacksToolbarState`, `#callbacksGrid`, `#callbacksSelectionChip`, `#callbacksSelectedCount`
- `#callbacksOpsPendingCount`, `#callbacksOpsUrgentCount`, `#callbacksOpsTodayCount`, `#callbacksOpsQueueHealth`, `#callbacksOpsNext`, `#callbacksOpsNextBtn`
- `#reviews`, `#reviewsGrid`
- `#availability`, `#calendarMonth`, `#availabilityCalendar`, `#selectedDate`, `#timeSlotsList`, `#newSlotTime`, `#addSlotForm`, `#availabilityQuickSlotPresets`, `#availabilityDetailGrid`
- `#availabilitySelectionSummary`, `#availabilityDraftStatus`, `#availabilitySyncStatus`, `#availabilityDayActions`, `#availabilityDayActionsStatus`, `#availabilitySaveDraftBtn`, `#availabilityDiscardDraftBtn`
- `#queue`, `#queueWaitingCountAdmin`, `#queueCalledCountAdmin`, `#queueC1Now`, `#queueC2Now`, `#queueSyncStatus`, `#queueNextAdminList`, `#queueTriageToolbar`, `#queueTriageSummary`, `#queueTableBody`, `#queueActivityPanel`, `#queueActivityList`
- `#queueStationBadge`, `#queueStationModeBadge`, `#queuePracticeModeBadge`, `#queueShortcutPanel`, `#queueSensitiveConfirmDialog`, `#queueReleaseC1`
- `#toastContainer`

## Required `data-action`

- Core: `set-admin-theme`, `toggle-sidebar-collapse`, `refresh-admin-data`, `run-admin-command`, `logout`, `close-toast`
- Appointments: `appointment-quick-filter`, `clear-appointment-filters`, `appointment-density`, `approve-transfer`, `reject-transfer`, `mark-no-show`, `cancel-appointment`, `export-csv`
- Callbacks: `callback-quick-filter`, `clear-callback-filters`, `callbacks-triage-next`, `mark-contacted`
- Availability: `change-month`, `availability-today`, `availability-next-with-slots`, `select-availability-day`, `prefill-time-slot`, `add-time-slot`, `remove-time-slot`, `copy-availability-day`, `paste-availability-day`, `duplicate-availability-day-next`, `duplicate-availability-next-week`, `clear-availability-day`, `clear-availability-week`, `save-availability-draft`, `discard-availability-draft`
- Queue: `queue-refresh-state`, `queue-call-next`, `queue-ticket-action`, `queue-reprint-ticket`, `queue-bulk-action`, `queue-bulk-reprint`, `queue-clear-search`, `queue-toggle-shortcuts`, `queue-toggle-one-tap`, `queue-start-practice`, `queue-stop-practice`, `queue-lock-station`, `queue-set-station-mode`, `queue-sensitive-confirm`, `queue-sensitive-cancel`, `queue-capture-call-key`, `queue-clear-call-key`

## Required Filters

- `data-filter-value`: `all`, `pending_transfer`, `upcoming_48h`, `no_show`, `triage_attention`, `pending`, `contacted`, `today`
- `data-queue-filter`: `all`, `called`, `sla_risk`

## Storage Keys (compat)

- `themeMode`
- `adminLastSection`
- `adminSidebarCollapsed`
- `admin-appointments-sort`
- `admin-appointments-density`
- `queueStationMode`
- `queueStationConsultorio`
- `queueOneTapAdvance`
- `queueCallKeyBindingV1`
- `queueNumpadHelpOpen`
- `adminUiVariant`

## Keyboard Contract

- Section shortcuts: `Alt+Shift+Digit1..Digit6`
- Global: `Ctrl+K`, `/`, `Escape`, `Alt+Shift+M`
- Quick filters: `Alt+Shift+T`, `Alt+Shift+A`, `Alt+Shift+N`, `Alt+Shift+P`, `Alt+Shift+C`, `Alt+Shift+W`
- Queue panel: `Alt+Shift+0`
- Queue numpad flow: `NumpadEnter`, `NumpadDecimal`, `NumpadSubtract`, `Numpad2`

## Query Params (queue ops)

- `/admin.html?station=c1|c2&lock=1|0&one_tap=1|0`
- `/admin.html?admin_ui=sony_v2|legacy`
- `/admin.html?admin_ui_reset=1` (contingency: clear `adminUiVariant`)

## Notes

- Contract is additive and must stay backward compatible while legacy and sony_v2 coexist.
- Any contract break requires explicit test migration in `tests/admin*.spec.js` and `tests/queue-integrated-flow.spec.js`.

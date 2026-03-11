# Admin DOM and API Contract (V3 Only)

## Scope

This document freezes the active admin frontend contract after the total cutover to `sony_v3`.

## Route Contract

- `GET /admin.html`
- `GET /operador-turnos.html`
- The admin always boots in `sony_v3`.
- Legacy compatibility inputs are inert:
    - `admin_ui=legacy|sony_v2|sony_v3`
    - `admin_ui_reset=1`
- Legacy storage compatibility key:
    - `localStorage.adminUiVariant` may still exist, but preboot/runtime no longer reads or mutates it.
- Admin CSP hardening:
    - `script-src 'self'`
    - `style-src 'self'`
    - `font-src 'self'`

## Runtime Contract

- `html[data-admin-ui="sony_v3"]`
- `html[data-admin-ready="true"]` after boot completes
- `body.admin-v3-mode`
- `[data-admin-frame="sony_v3"]`

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

- `#loginForm`, `#adminDashboard`, `#adminSidebar`, `#adminPrimaryNav`, `#adminSecondaryNav`, `#adminMenuToggle`, `#adminMenuClose`, `#adminSidebarBackdrop`, `#adminSidebarCollapse`
- `#pageTitle`, `#adminQuickCommand`, `#adminRunQuickCommandBtn`, `#adminRefreshStatus`, `#adminContextTitle`, `#adminCommandPalette`
- `#dashboard`, `#opsTodaySummaryCard`, `#opsTodayCount`, `#opsTodayMeta`, `#opsPendingSummaryCard`, `#opsPendingCount`, `#opsPendingMeta`, `#opsAvailabilitySummaryCard`, `#opsAvailabilityCount`, `#opsAvailabilityMeta`
- `#opsQueueLaunchCard`, `#opsQueueStatus`, `#opsQueueMeta`, `#openOperatorAppBtn`, `#dashboardLiveStatus`, `#dashboardLiveMeta`, `#dashboardQueueHealth`, `#dashboardFlowStatus`, `#dashboardAttentionList`
- `#operationPendingReviewCount`, `#operationPendingCallbacksCount`, `#operationTodayLoadCount`, `#operationQueueHealth`, `#operationActionList`
- `#funnelSummary`, `#dashboardAdvancedAnalytics`, `#funnelAbandonList`, `#funnelEntryList`, `#funnelSourceList`, `#funnelPaymentMethodList`, `#funnelAbandonReasonList`, `#funnelStepList`, `#funnelErrorCodeList`
- `#appointments`, `#appointmentFilter`, `#appointmentSort`, `#searchAppointments`, `#clearAppointmentsFiltersBtn`, `#appointmentsToolbarMeta`, `#appointmentsToolbarState`, `#appointmentsTableBody`
- `#callbacks`, `#callbackFilter`, `#callbackSort`, `#searchCallbacks`, `#clearCallbacksFiltersBtn`, `#callbacksBulkSelectVisibleBtn`, `#callbacksBulkClearBtn`, `#callbacksBulkMarkBtn`, `#callbacksToolbarMeta`, `#callbacksToolbarState`, `#callbacksGrid`, `#callbacksSelectionChip`, `#callbacksSelectedCount`
- `#callbacksOpsPendingCount`, `#callbacksOpsUrgentCount`, `#callbacksOpsTodayCount`, `#callbacksOpsQueueHealth`, `#callbacksOpsNext`, `#callbacksOpsNextBtn`
- `#reviews`, `#reviewsGrid`
- `#availability`, `#availabilityHeading`, `#availabilitySourceBadge`, `#availabilityModeBadge`, `#availabilityTimezoneBadge`, `#calendarMonth`, `#availabilityCalendar`, `#selectedDate`, `#timeSlotsList`, `#newSlotTime`, `#addSlotForm`, `#availabilityQuickSlotPresets`, `#availabilityDetailGrid`
- `#availabilitySelectionSummary`, `#availabilityDraftStatus`, `#availabilitySyncStatus`, `#availabilityDayActions`, `#availabilityDayActionsStatus`, `#availabilitySaveDraftBtn`, `#availabilityDiscardDraftBtn`
- `#queue`, `#queueWaitingCountAdmin`, `#queueCalledCountAdmin`, `#queueC1Now`, `#queueC2Now`, `#queueSyncStatus`, `#queueNextAdminList`, `#queueTriageToolbar`, `#queueTriageSummary`, `#queueTableBody`, `#queueActivityPanel`, `#queueActivityList`
- `#queueAppsHub`, `#queueAppsPlatformChip`, `#queueAppDownloadsCards`
- `#queueFocusMode`, `#queueFocusModeTitle`, `#queueFocusModeSummary`, `#queueFocusModeChip`, `#queueFocusModePrimary`, `#queueFocusModeAuto`, `#queueFocusModeOpening`, `#queueFocusModeOperations`, `#queueFocusModeIncidents`, `#queueFocusModeClosing`
- `#queueNumpadGuide`, `#queueNumpadGuideTitle`, `#queueNumpadGuideSummary`, `#queueNumpadGuideChipStation`, `#queueNumpadGuideChipOperator`, `#queueNumpadGuideChipOneTap`, `#queueNumpadGuideChipBinding`, `#queueNumpadGuideActions`, `#queueNumpadGuideToggleOneTap`, `#queueNumpadGuideCaptureKey`, `#queueNumpadGuideOpenOperator`, `#queueNumpadGuideKeys`, `#queueNumpadGuideKey_enter`, `#queueNumpadGuideKey_station`
- `#queueConsultorioBoard`, `#queueConsultorioBoardTitle`, `#queueConsultorioBoardSummary`, `#queueConsultorioBoardStatus`, `#queueConsultorioBoardCards`, `#queueConsultorioCard_c1`, `#queueConsultorioCurrent_c1`, `#queueConsultorioNext_c1`, `#queueConsultorioPrimary_c1`, `#queueConsultorioRelease_c1`, `#queueConsultorioOpenOperator_c1`, `#queueConsultorioCard_c2`, `#queueConsultorioCurrent_c2`, `#queueConsultorioNext_c2`, `#queueConsultorioPrimary_c2`, `#queueConsultorioRelease_c2`, `#queueConsultorioOpenOperator_c2`
- `#queueQuickConsole`, `#queueQuickConsoleTitle`, `#queueQuickConsoleSummary`, `#queueQuickConsoleChip`, `#queueQuickConsoleActions`, `#queueQuickConsoleAction_opening_apply`, `#queueQuickConsoleAction_incident_log`, `#queueQuickConsoleAction_closing_apply`, `#queueQuickConsoleAction_copy_handoff`
- `#queuePlaybook`, `#queuePlaybookTitle`, `#queuePlaybookSummary`, `#queuePlaybookChip`, `#queuePlaybookAssistChip`, `#queuePlaybookApplyBtn`, `#queuePlaybookAssistBtn`, `#queuePlaybookCopyBtn`, `#queuePlaybookResetBtn`, `#queuePlaybookSteps`, `#queuePlaybookToggle_opening_operator`
- `#queueOpsPilot`, `#queueOpsPilotTitle`, `#queueOpsPilotSummary`, `#queueOpsPilotProgressValue`, `#queueOpsPilotChipConfirmed`, `#queueOpsPilotChipSuggested`, `#queueOpsPilotChipEquipment`, `#queueOpsPilotChipIssues`
- `#queueSurfaceTelemetry`, `#queueSurfaceTelemetryTitle`, `#queueSurfaceTelemetrySummary`, `#queueSurfaceTelemetryAutoMeta`, `#queueSurfaceTelemetryAutoState`, `#queueSurfaceTelemetryStatus`, `#queueSurfaceTelemetryCards`
- `#queueOpsAlerts`, `#queueOpsAlertsTitle`, `#queueOpsAlertsSummary`, `#queueOpsAlertsChipTotal`, `#queueOpsAlertsChipPending`, `#queueOpsAlertsChipReviewed`, `#queueOpsAlertsApplyBtn`, `#queueOpsAlertsItems`, `#queueOpsAlert_kiosk_printer_pending`, `#queueOpsAlertReview_kiosk_printer_pending`
- `#queueOpeningChecklist`, `#queueOpeningChecklistTitle`, `#queueOpeningChecklistSummary`, `#queueOpeningChecklistAssistChip`, `#queueOpeningChecklistApplyBtn`, `#queueOpeningChecklistResetBtn`, `#queueOpeningChecklistSteps`, `#queueOpeningToggle_operator_ready`
- `#queueShiftHandoff`, `#queueShiftHandoffTitle`, `#queueShiftHandoffSummary`, `#queueShiftHandoffAssistChip`, `#queueShiftHandoffCopyBtn`, `#queueShiftHandoffApplyBtn`, `#queueShiftHandoffResetBtn`, `#queueShiftHandoffPreview`, `#queueShiftHandoffSteps`, `#queueShiftToggle_queue_clear`
- `#queueOpsLog`, `#queueOpsLogTitle`, `#queueOpsLogSummary`, `#queueOpsLogChip`, `#queueOpsLogFilterAll`, `#queueOpsLogFilterIncidents`, `#queueOpsLogFilterChanges`, `#queueOpsLogFilterStatus`, `#queueOpsLogStatusBtn`, `#queueOpsLogIncidentBtn`, `#queueOpsLogCopyBtn`, `#queueOpsLogClearBtn`, `#queueOpsLogItems`
- `#queueContingencyDeck`, `#queueContingencyTitle`, `#queueContingencySummary`, `#queueContingencyCards`, `#queueContingencySyncCard`
- `#queueInstallConfigurator`, `#queueInstallSurfaceSelect`, `#queueInstallProfileSelect`, `#queueInstallPlatformSelect`, `#queueInstallPreset_operator_c1_locked`, `#queueInstallPreset_operator_c2_locked`, `#queueInstallPreset_operator_free`, `#queueInstallPreset_kiosk`, `#queueInstallPreset_sala_tv`
- `#queueStationBadge`, `#queueStationModeBadge`, `#queuePracticeModeBadge`, `#queueShortcutPanel`, `#queueSensitiveConfirmDialog`, `#queueReleaseC1`, `#queueSelectVisibleBtn`, `#queueClearSelectionBtn`, `#queueSelectionChip`, `#queueSelectedCount`
- `#toastContainer`

## Required `data-action`

- Core: `set-admin-theme`, `toggle-sidebar-collapse`, `refresh-admin-data`, `run-admin-command`, `open-command-palette`, `close-command-palette`, `logout`, `close-toast`, `open-operator-app`
- Dashboard context: `context-open-appointments-overview`, `context-open-callbacks-pending`, `context-open-callbacks-next`, `context-open-availability`
- Appointments: `appointment-quick-filter`, `clear-appointment-filters`, `appointment-density`, `approve-transfer`, `reject-transfer`, `mark-no-show`, `cancel-appointment`, `export-csv`
- Callbacks: `callback-quick-filter`, `clear-callback-filters`, `callbacks-triage-next`, `mark-contacted`, `callbacks-bulk-select-visible`, `callbacks-bulk-clear`, `callbacks-bulk-mark`
- Availability: `change-month`, `availability-today`, `availability-prev-with-slots`, `availability-next-with-slots`, `select-availability-day`, `prefill-time-slot`, `add-time-slot`, `remove-time-slot`, `copy-availability-day`, `paste-availability-day`, `duplicate-availability-day-next`, `duplicate-availability-next-week`, `clear-availability-day`, `clear-availability-week`, `save-availability-draft`, `discard-availability-draft`
- Queue: `queue-refresh-state`, `queue-call-next`, `queue-release-station`, `queue-toggle-ticket-select`, `queue-select-visible`, `queue-clear-selection`, `queue-ticket-action`, `queue-reprint-ticket`, `queue-bulk-action`, `queue-bulk-reprint`, `queue-clear-search`, `queue-toggle-shortcuts`, `queue-toggle-one-tap`, `queue-start-practice`, `queue-stop-practice`, `queue-lock-station`, `queue-set-station-mode`, `queue-sensitive-confirm`, `queue-sensitive-cancel`, `queue-capture-call-key`, `queue-clear-call-key`, `queue-copy-install-link`

## Required Filters

- `data-filter-value`: `all`, `pending_transfer`, `upcoming_48h`, `no_show`, `triage_attention`, `pending`, `contacted`, `today`, `sla_urgent`
- `data-queue-filter`: `all`, `called`, `sla_risk`

## Storage Keys

- Active:
    - `themeMode`
    - `adminLastSection`
    - `adminSidebarCollapsed`
    - `admin-appointments-sort`
    - `admin-appointments-density`
    - `admin-callbacks-filter`
    - `admin-callbacks-sort`
    - `admin-availability-selected-date`
    - `admin-availability-month-anchor`
    - `queueStationMode`
    - `queueStationConsultorio`
    - `queueOneTapAdvance`
    - `queueCallKeyBindingV1`
    - `queueNumpadHelpOpen`
    - `queueOpeningChecklistV1`
    - `queueShiftHandoffV1`
    - `queueOpsLogV1`
    - `queueOpsLogFilterV1`
    - `queueOpsAlertsV1`
    - `queueOpsFocusModeV1`
    - `queueOpsPlaybookV1`
    - `queueInstallPresetV1`
- Retired compatibility key:
    - `adminUiVariant` (historical only; not read or cleaned by runtime)

## Keyboard Contract

- Section shortcuts: `Alt+Shift+Digit1..Digit6`
- Global: `Ctrl+K`, `/`, `Escape`, `Alt+Shift+M`
- Quick filters: `Alt+Shift+T`, `Alt+Shift+A`, `Alt+Shift+N`, `Alt+Shift+P`, `Alt+Shift+C`, `Alt+Shift+U`, `Alt+Shift+W`
- Queue panel: `Alt+Shift+0`
- Queue numpad flow: `NumpadEnter`, `NumpadDecimal`, `NumpadSubtract`, `Numpad2`

## Query Params (queue ops)

- Active:
    - `/admin.html?station=c1|c2&lock=1|0&one_tap=1|0`
    - `/operador-turnos.html?station=c1|c2&lock=1|0&one_tap=1|0`
- Retired compatibility params:
    - `/admin.html?admin_ui=sony_v3|sony_v2|legacy`
    - `/admin.html?admin_ui_reset=1`

## Non-blocking hooks

- `[data-admin-frame]`
- `[data-admin-section-hero]`
- `[data-admin-priority-rail]`
- `[data-admin-workbench]`
- `[data-admin-detail-rail]`
- `[data-admin-empty-state]`
- `#openOperatorAppBtn`
- `#opsTodaySummaryCard`
- `#opsPendingSummaryCard`
- `#opsAvailabilitySummaryCard`
- `#adminSecondaryNav`

## Notes

- `sony_v3` is the only supported admin runtime.
- `GET /api.php?resource=data` now includes `data.appDownloads` for `operator`, `kiosk` and `sala_tv`, including `guideUrl` for the public install center.
- `GET /api.php?resource=data` now also includes `data.queueSurfaceStatus` with grouped heartbeats for `operator`, `kiosk` and `display`.
- Rollback is operational (`revert + deploy`), not a runtime variant switch.
- Any DOM contract break requires explicit test migration in active admin suites.

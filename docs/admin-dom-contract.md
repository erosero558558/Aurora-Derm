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

- Primary consultorio auth:
    - `POST /admin-auth.php?action=start`
    - `GET /admin-auth.php?action=status`
    - `POST /api.php?resource=operator-auth-complete`
    - `POST /admin-auth.php?action=logout`
- Legacy support override only:
    - `POST /admin-auth.php?action=login`
    - `POST /admin-auth.php?action=login-2fa`
    - requires `PIELARMONIA_INTERNAL_CONSOLE_AUTH_PRIMARY=legacy_password`
- `GET /api.php?resource=data`
- `GET /api.php?resource=funnel-metrics`
- `GET /api.php?resource=health`
- `GET /content/turnero/clinic-profile.json`
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
- `#queueAppsHub`, `#queueAppsPlatformChip`, `#queueAppsRefreshShieldChip`, `#queueAppDownloadsCards`
- `#queueAdminViewMode`, `#queueAdminViewModeTitle`, `#queueAdminViewModeSummary`, `#queueAdminViewModeChip`, `#queueAdminViewModeClinic`, `#queueAdminViewModeBasic`, `#queueAdminViewModeExpert`
- `#queueFocusMode`, `#queueFocusModeTitle`, `#queueFocusModeSummary`, `#queueFocusModeChip`, `#queueFocusModePrimary`, `#queueFocusModeAuto`, `#queueFocusModeOpening`, `#queueFocusModeOperations`, `#queueFocusModeIncidents`, `#queueFocusModeClosing`
- `#queueNumpadGuide`, `#queueNumpadGuideTitle`, `#queueNumpadGuideSummary`, `#queueNumpadGuideChipStation`, `#queueNumpadGuideChipOperator`, `#queueNumpadGuideChipOneTap`, `#queueNumpadGuideChipBinding`, `#queueNumpadGuideActions`, `#queueNumpadGuideToggleOneTap`, `#queueNumpadGuideCaptureKey`, `#queueNumpadGuideOpenOperator`, `#queueNumpadGuideKeys`, `#queueNumpadGuideKey_enter`, `#queueNumpadGuideKey_station`
- `#queueConsultorioBoard`, `#queueConsultorioBoardTitle`, `#queueConsultorioBoardSummary`, `#queueConsultorioBoardStatus`, `#queueConsultorioBoardCards`, `#queueConsultorioCard_c1`, `#queueConsultorioCurrent_c1`, `#queueConsultorioNext_c1`, `#queueConsultorioPrimary_c1`, `#queueConsultorioRelease_c1`, `#queueConsultorioOpenOperator_c1`, `#queueConsultorioCard_c2`, `#queueConsultorioCurrent_c2`, `#queueConsultorioNext_c2`, `#queueConsultorioPrimary_c2`, `#queueConsultorioRelease_c2`, `#queueConsultorioOpenOperator_c2`
- `#queueAttentionDeck`, `#queueAttentionDeckTitle`, `#queueAttentionDeckSummary`, `#queueAttentionDeckStatus`, `#queueAttentionDeckCards`, `#queueAttentionCard_c1`, `#queueAttentionHeadline_c1`, `#queueAttentionCurrent_c1`, `#queueAttentionNext_c1`, `#queueAttentionPressure_c1`, `#queueAttentionRecommendation_c1`, `#queueAttentionPrimary_c1`, `#queueAttentionComplete_c1`, `#queueAttentionRelease_c1`, `#queueAttentionOpenOperator_c1`, `#queueAttentionCard_c2`, `#queueAttentionHeadline_c2`, `#queueAttentionCurrent_c2`, `#queueAttentionNext_c2`, `#queueAttentionPressure_c2`, `#queueAttentionRecommendation_c2`, `#queueAttentionPrimary_c2`, `#queueAttentionComplete_c2`, `#queueAttentionRelease_c2`, `#queueAttentionOpenOperator_c2`
- `#queueResolutionDeck`, `#queueResolutionDeckTitle`, `#queueResolutionDeckSummary`, `#queueResolutionDeckStatus`, `#queueResolutionPending`, `#queueResolutionPendingConfirm`, `#queueResolutionPendingCancel`, `#queueResolutionDeckCards`, `#queueResolutionCard_c1`, `#queueResolutionHeadline_c1`, `#queueResolutionCurrent_c1`, `#queueResolutionStatusLine_c1`, `#queueResolutionCompletePreview_c1`, `#queueResolutionNoShowPreview_c1`, `#queueResolutionReleasePreview_c1`, `#queueResolutionPrimary_c1`, `#queueResolutionNoShow_c1`, `#queueResolutionRelease_c1`, `#queueResolutionOpenOperator_c1`, `#queueResolutionCard_c2`, `#queueResolutionHeadline_c2`, `#queueResolutionCurrent_c2`, `#queueResolutionStatusLine_c2`, `#queueResolutionCompletePreview_c2`, `#queueResolutionNoShowPreview_c2`, `#queueResolutionReleasePreview_c2`, `#queueResolutionPrimary_c2`, `#queueResolutionNoShow_c2`, `#queueResolutionRelease_c2`, `#queueResolutionOpenOperator_c2`
- `#queueTicketLookup`, `#queueTicketLookupTitle`, `#queueTicketLookupSummary`, `#queueTicketLookupStatus`, `#queueTicketLookupInput`, `#queueTicketLookupSearchBtn`, `#queueTicketLookupClearBtn`, `#queueTicketLookupSuggestions`, `#queueTicketLookupSuggestion_0`, `#queueTicketLookupResult`, `#queueTicketLookupMatchCode`, `#queueTicketLookupHeadline`, `#queueTicketLookupBadge`, `#queueTicketLookupPending`, `#queueTicketLookupDetail`, `#queueTicketLookupRecommendation`, `#queueTicketLookupPrimary`, `#queueTicketLookupSecondary_0`
- `#queueTicketRoute`, `#queueTicketRouteTitle`, `#queueTicketRouteSummary`, `#queueTicketRouteStatus`, `#queueTicketRouteCopyBtn`, `#queueTicketRouteLane`, `#queueTicketRoutePosition`, `#queueTicketRoutePressure`, `#queueTicketRouteImpact`, `#queueTicketRoutePivotPrimary`, `#queueTicketRoutePivotSecondary`, `#queueTicketRoutePivotDetailPrimary`, `#queueTicketRoutePivotDetailSecondary`, `#queueTicketRouteEmpty`
- `#queueTicketSimulation`, `#queueTicketSimulationTitle`, `#queueTicketSimulationSummary`, `#queueTicketSimulationStatus`, `#queueTicketSimulationCopyBtn`, `#queueTicketSimulationBefore`, `#queueTicketSimulationAction`, `#queueTicketSimulationAfter`, `#queueTicketSimulationRisk`, `#queueTicketSimulationFocusBtn`, `#queueTicketSimulationFocusDetail`, `#queueTicketSimulationEmpty`
- `#queueNextTurns`, `#queueNextTurnsTitle`, `#queueNextTurnsSummary`, `#queueNextTurnsStatus`, `#queueNextTurnsCopyBtn`, `#queueNextTurnsCards`, `#queueNextTurnsCard_c1`, `#queueNextTurnsHeadline_c1`, `#queueNextTurnsStep_c1_0`, `#queueNextTurnsLoad_c1_0`, `#queueNextTurnsCard_c2`, `#queueNextTurnsHeadline_c2`, `#queueNextTurnsStep_c2_0`, `#queueNextTurnsLoad_c2_0`, `#queueNextTurnsCard_general`, `#queueNextTurnsHeadline_general`, `#queueNextTurnsStep_general_0`, `#queueNextTurnsLoad_general_0`
- `#queueMasterSequence`, `#queueMasterSequenceTitle`, `#queueMasterSequenceSummary`, `#queueMasterSequenceStatus`, `#queueMasterSequenceCopyBtn`, `#queueMasterSequenceItems`, `#queueMasterSequenceItem_0`, `#queueMasterSequenceAction_0`, `#queueMasterSequenceSupport_0`, `#queueMasterSequenceLoad_0`, `#queueMasterSequenceEmpty`
- `#queueCoverageDeck`, `#queueCoverageDeckTitle`, `#queueCoverageDeckSummary`, `#queueCoverageDeckStatus`, `#queueCoverageDeckCopyBtn`, `#queueCoverageDeckCards`, `#queueCoverageCard_c1`, `#queueCoverageHeadline_c1`, `#queueCoverageCurrent_c1`, `#queueCoverageNext_c1`, `#queueCoverageGap_c1`, `#queueCoveragePrimary_c1`, `#queueCoverageCard_c2`, `#queueCoverageHeadline_c2`, `#queueCoverageCurrent_c2`, `#queueCoverageNext_c2`, `#queueCoverageGap_c2`, `#queueCoveragePrimary_c2`
- `#queueReserveDeck`, `#queueReserveDeckTitle`, `#queueReserveDeckSummary`, `#queueReserveDeckStatus`, `#queueReserveDeckCopyBtn`, `#queueReserveDeckCards`, `#queueReserveCard_c1`, `#queueReserveHeadline_c1`, `#queueReserveCurrent_c1`, `#queueReserveNext_c1`, `#queueReserveBuffer_c1`, `#queueReserveSupport_c1`, `#queueReservePrimary_c1`, `#queueReserveCard_c2`, `#queueReserveHeadline_c2`, `#queueReserveCurrent_c2`, `#queueReserveNext_c2`, `#queueReserveBuffer_c2`, `#queueReserveSupport_c2`, `#queueReservePrimary_c2`
- `#queueGeneralGuidance`, `#queueGeneralGuidanceTitle`, `#queueGeneralGuidanceSummary`, `#queueGeneralGuidanceStatus`, `#queueGeneralGuidanceCopyBtn`, `#queueGeneralGuidanceItems`, `#queueGeneralGuidanceItem_0`, `#queueGeneralGuidanceHeadline_0`, `#queueGeneralGuidanceReason_0`, `#queueGeneralGuidanceTarget_0`, `#queueGeneralGuidanceLoad_0`, `#queueGeneralGuidanceEmpty`
- `#queueProjectedDeck`, `#queueProjectedDeckTitle`, `#queueProjectedDeckSummary`, `#queueProjectedDeckStatus`, `#queueProjectedDeckCopyBtn`, `#queueProjectedDeckCards`, `#queueProjectedCard_c1`, `#queueProjectedHeadline_c1`, `#queueProjectedCurrent_c1`, `#queueProjectedSequence_c1`, `#queueProjectedSupport_c1`, `#queueProjectedPrimary_c1`, `#queueProjectedCard_c2`, `#queueProjectedHeadline_c2`, `#queueProjectedCurrent_c2`, `#queueProjectedSequence_c2`, `#queueProjectedSupport_c2`, `#queueProjectedPrimary_c2`
- `#queueIncomingDeck`, `#queueIncomingDeckTitle`, `#queueIncomingDeckSummary`, `#queueIncomingDeckStatus`, `#queueIncomingDeckCopyBtn`, `#queueIncomingDeckCards`, `#queueIncomingCard_c1`, `#queueIncomingHeadline_c1`, `#queueIncomingCurrent_c1`, `#queueIncomingSequence_c1`, `#queueIncomingSupport_c1`, `#queueIncomingOpen_c1`, `#queueIncomingCard_c2`, `#queueIncomingHeadline_c2`, `#queueIncomingCurrent_c2`, `#queueIncomingSequence_c2`, `#queueIncomingSupport_c2`, `#queueIncomingOpen_c2`
- `#queueScenarioDeck`, `#queueScenarioDeckTitle`, `#queueScenarioDeckSummary`, `#queueScenarioDeckStatus`, `#queueScenarioDeckCopyBtn`, `#queueScenarioDeckCards`, `#queueScenarioCard_appointment`, `#queueScenarioHeadline_appointment`, `#queueScenarioCurrent_appointment`, `#queueScenarioSequence_appointment`, `#queueScenarioSupport_appointment`, `#queueScenarioOpen_appointment`, `#queueScenarioCard_walkin`, `#queueScenarioHeadline_walkin`, `#queueScenarioCurrent_walkin`, `#queueScenarioSequence_walkin`, `#queueScenarioSupport_walkin`, `#queueScenarioOpen_walkin`
- `#queueReceptionScript`, `#queueReceptionScriptTitle`, `#queueReceptionScriptSummary`, `#queueReceptionScriptStatus`, `#queueReceptionScriptCopyBtn`, `#queueReceptionScriptItems`, `#queueReceptionScriptItem_0`, `#queueReceptionScriptHeadline_0`, `#queueReceptionScriptDetail_0`, `#queueReceptionScriptOpen_0`, `#queueReceptionScriptEmpty`
- `#queueReceptionCollision`, `#queueReceptionCollisionTitle`, `#queueReceptionCollisionSummary`, `#queueReceptionCollisionStatus`, `#queueReceptionCollisionCopyBtn`, `#queueReceptionCollisionCards`, `#queueReceptionCollisionCard_appointment`, `#queueReceptionCollisionHeadline_appointment`, `#queueReceptionCollisionDetail_appointment`, `#queueReceptionCollisionSupport_appointment`, `#queueReceptionCollisionOpen_appointment`, `#queueReceptionCollisionCard_walkin`, `#queueReceptionCollisionHeadline_walkin`, `#queueReceptionCollisionDetail_walkin`, `#queueReceptionCollisionSupport_walkin`, `#queueReceptionCollisionOpen_walkin`, `#queueReceptionCollisionEmpty`
- `#queueReceptionLights`, `#queueReceptionLightsTitle`, `#queueReceptionLightsSummary`, `#queueReceptionLightsStatus`, `#queueReceptionLightsCopyBtn`, `#queueReceptionLightsCards`, `#queueReceptionLightsCard_c1`, `#queueReceptionLightsHeadline_c1`, `#queueReceptionLightsBadge_c1`, `#queueReceptionLightsDetail_c1`, `#queueReceptionLightsRules_c1`, `#queueReceptionLightsSupport_c1`, `#queueReceptionLightsOpen_c1`, `#queueReceptionLightsCard_c2`, `#queueReceptionLightsHeadline_c2`, `#queueReceptionLightsBadge_c2`, `#queueReceptionLightsDetail_c2`, `#queueReceptionLightsRules_c2`, `#queueReceptionLightsSupport_c2`, `#queueReceptionLightsOpen_c2`
- `#queueWindowDeck`, `#queueWindowDeckTitle`, `#queueWindowDeckSummary`, `#queueWindowDeckStatus`, `#queueWindowDeckCopyBtn`, `#queueWindowDeckCards`, `#queueWindowCard_c1`, `#queueWindowHeadline_c1`, `#queueWindowBadge_c1`, `#queueWindowDetail_c1`, `#queueWindowRules_c1`, `#queueWindowSupport_c1`, `#queueWindowOpen_c1`, `#queueWindowCard_c2`, `#queueWindowHeadline_c2`, `#queueWindowBadge_c2`, `#queueWindowDetail_c2`, `#queueWindowRules_c2`, `#queueWindowSupport_c2`, `#queueWindowOpen_c2`
- `#queueDeskReply`, `#queueDeskReplyTitle`, `#queueDeskReplySummary`, `#queueDeskReplyStatus`, `#queueDeskReplyCopyBtn`, `#queueDeskReplyItems`, `#queueDeskReplyItem_appointment`, `#queueDeskReplyHeadline_appointment`, `#queueDeskReplyPhrase_appointment`, `#queueDeskReplySupport_appointment`, `#queueDeskReplyOpen_appointment`, `#queueDeskReplyItem_walkin`, `#queueDeskReplyHeadline_walkin`, `#queueDeskReplyPhrase_walkin`, `#queueDeskReplySupport_walkin`, `#queueDeskReplyOpen_walkin`, `#queueDeskReplyItem_collision`, `#queueDeskReplyHeadline_collision`, `#queueDeskReplyPhrase_collision`, `#queueDeskReplySupport_collision`, `#queueDeskReplyOpen_collision`, `#queueDeskReplyEmpty`
- `#queueDeskFallback`, `#queueDeskFallbackTitle`, `#queueDeskFallbackSummary`, `#queueDeskFallbackStatus`, `#queueDeskFallbackCopyBtn`, `#queueDeskFallbackItems`, `#queueDeskFallbackItem_appointment`, `#queueDeskFallbackHeadline_appointment`, `#queueDeskFallbackPhrase_appointment`, `#queueDeskFallbackSupport_appointment`, `#queueDeskFallbackOpen_appointment`, `#queueDeskFallbackItem_walkin`, `#queueDeskFallbackHeadline_walkin`, `#queueDeskFallbackPhrase_walkin`, `#queueDeskFallbackSupport_walkin`, `#queueDeskFallbackOpen_walkin`, `#queueDeskFallbackEmpty`
- `#queueDeskObjections`, `#queueDeskObjectionsTitle`, `#queueDeskObjectionsSummary`, `#queueDeskObjectionsStatus`, `#queueDeskObjectionsCopyBtn`, `#queueDeskObjectionsItems`, `#queueDeskObjectionsItem_first_available`, `#queueDeskObjectionsHeadline_first_available`, `#queueDeskObjectionsPhrase_first_available`, `#queueDeskObjectionsSupport_first_available`, `#queueDeskObjectionsOpen_first_available`, `#queueDeskObjectionsItem_short_wait`, `#queueDeskObjectionsHeadline_short_wait`, `#queueDeskObjectionsPhrase_short_wait`, `#queueDeskObjectionsSupport_short_wait`, `#queueDeskObjectionsOpen_short_wait`, `#queueDeskObjectionsItem_other_lane`, `#queueDeskObjectionsHeadline_other_lane`, `#queueDeskObjectionsPhrase_other_lane`, `#queueDeskObjectionsSupport_other_lane`, `#queueDeskObjectionsOpen_other_lane`, `#queueDeskObjectionsEmpty`
- `#queueDeskCloseout`, `#queueDeskCloseoutTitle`, `#queueDeskCloseoutSummary`, `#queueDeskCloseoutStatus`, `#queueDeskCloseoutCopyBtn`, `#queueDeskCloseoutItems`, `#queueDeskCloseoutItem_appointment`, `#queueDeskCloseoutHeadline_appointment`, `#queueDeskCloseoutPhrase_appointment`, `#queueDeskCloseoutSupport_appointment`, `#queueDeskCloseoutOpen_appointment`, `#queueDeskCloseoutItem_walkin`, `#queueDeskCloseoutHeadline_walkin`, `#queueDeskCloseoutPhrase_walkin`, `#queueDeskCloseoutSupport_walkin`, `#queueDeskCloseoutOpen_walkin`, `#queueDeskCloseoutItem_if_not_called`, `#queueDeskCloseoutHeadline_if_not_called`, `#queueDeskCloseoutPhrase_if_not_called`, `#queueDeskCloseoutSupport_if_not_called`, `#queueDeskCloseoutOpen_if_not_called`, `#queueDeskCloseoutEmpty`
- `#queueDeskRecheck`, `#queueDeskRecheckTitle`, `#queueDeskRecheckSummary`, `#queueDeskRecheckStatus`, `#queueDeskRecheckCopyBtn`, `#queueDeskRecheckItems`, `#queueDeskRecheckItem_appointment`, `#queueDeskRecheckHeadline_appointment`, `#queueDeskRecheckPhrase_appointment`, `#queueDeskRecheckSupport_appointment`, `#queueDeskRecheckOpen_appointment`, `#queueDeskRecheckItem_walkin`, `#queueDeskRecheckHeadline_walkin`, `#queueDeskRecheckPhrase_walkin`, `#queueDeskRecheckSupport_walkin`, `#queueDeskRecheckOpen_walkin`, `#queueDeskRecheckItem_timing`, `#queueDeskRecheckHeadline_timing`, `#queueDeskRecheckPhrase_timing`, `#queueDeskRecheckSupport_timing`, `#queueDeskRecheckOpen_timing`, `#queueDeskRecheckEmpty`
- `#queueDeskShift`, `#queueDeskShiftTitle`, `#queueDeskShiftSummary`, `#queueDeskShiftStatus`, `#queueDeskShiftCopyBtn`, `#queueDeskShiftItems`, `#queueDeskShiftItem_appointment`, `#queueDeskShiftHeadline_appointment`, `#queueDeskShiftPhrase_appointment`, `#queueDeskShiftSupport_appointment`, `#queueDeskShiftOpen_appointment`, `#queueDeskShiftItem_walkin`, `#queueDeskShiftHeadline_walkin`, `#queueDeskShiftPhrase_walkin`, `#queueDeskShiftSupport_walkin`, `#queueDeskShiftOpen_walkin`, `#queueDeskShiftItem_rule`, `#queueDeskShiftHeadline_rule`, `#queueDeskShiftPhrase_rule`, `#queueDeskShiftSupport_rule`, `#queueDeskShiftOpen_rule`, `#queueDeskShiftEmpty`
- `#queueDeskPromise`, `#queueDeskPromiseTitle`, `#queueDeskPromiseSummary`, `#queueDeskPromiseStatus`, `#queueDeskPromiseCopyBtn`, `#queueDeskPromiseItems`, `#queueDeskPromiseItem_appointment`, `#queueDeskPromiseHeadline_appointment`, `#queueDeskPromisePhrase_appointment`, `#queueDeskPromiseSupport_appointment`, `#queueDeskPromiseOpen_appointment`, `#queueDeskPromiseItem_walkin`, `#queueDeskPromiseHeadline_walkin`, `#queueDeskPromisePhrase_walkin`, `#queueDeskPromiseSupport_walkin`, `#queueDeskPromiseOpen_walkin`, `#queueDeskPromiseItem_rule`, `#queueDeskPromiseHeadline_rule`, `#queueDeskPromisePhrase_rule`, `#queueDeskPromiseSupport_rule`, `#queueDeskPromiseOpen_rule`, `#queueDeskPromiseEmpty`
- `#queueDeskEscalation`, `#queueDeskEscalationTitle`, `#queueDeskEscalationSummary`, `#queueDeskEscalationStatus`, `#queueDeskEscalationCopyBtn`, `#queueDeskEscalationItems`, `#queueDeskEscalationItem_appointment`, `#queueDeskEscalationHeadline_appointment`, `#queueDeskEscalationPhrase_appointment`, `#queueDeskEscalationSupport_appointment`, `#queueDeskEscalationOpen_appointment`, `#queueDeskEscalationItem_walkin`, `#queueDeskEscalationHeadline_walkin`, `#queueDeskEscalationPhrase_walkin`, `#queueDeskEscalationSupport_walkin`, `#queueDeskEscalationOpen_walkin`, `#queueDeskEscalationItem_rule`, `#queueDeskEscalationHeadline_rule`, `#queueDeskEscalationPhrase_rule`, `#queueDeskEscalationSupport_rule`, `#queueDeskEscalationOpen_rule`, `#queueDeskEscalationEmpty`
- `#queueDeskEscalationTalk`, `#queueDeskEscalationTalkTitle`, `#queueDeskEscalationTalkSummary`, `#queueDeskEscalationTalkStatus`, `#queueDeskEscalationTalkCopyBtn`, `#queueDeskEscalationTalkItems`, `#queueDeskEscalationTalkItem_appointment`, `#queueDeskEscalationTalkHeadline_appointment`, `#queueDeskEscalationTalkPhrase_appointment`, `#queueDeskEscalationTalkSupport_appointment`, `#queueDeskEscalationTalkOpen_appointment`, `#queueDeskEscalationTalkItem_walkin`, `#queueDeskEscalationTalkHeadline_walkin`, `#queueDeskEscalationTalkPhrase_walkin`, `#queueDeskEscalationTalkSupport_walkin`, `#queueDeskEscalationTalkOpen_walkin`, `#queueDeskEscalationTalkItem_rule`, `#queueDeskEscalationTalkHeadline_rule`, `#queueDeskEscalationTalkPhrase_rule`, `#queueDeskEscalationTalkSupport_rule`, `#queueDeskEscalationTalkOpen_rule`, `#queueDeskEscalationTalkEmpty`
- `#queueDeskEscalationConfirm`, `#queueDeskEscalationConfirmTitle`, `#queueDeskEscalationConfirmSummary`, `#queueDeskEscalationConfirmStatus`, `#queueDeskEscalationConfirmCopyBtn`, `#queueDeskEscalationConfirmItems`, `#queueDeskEscalationConfirmItem_appointment`, `#queueDeskEscalationConfirmHeadline_appointment`, `#queueDeskEscalationConfirmPhrase_appointment`, `#queueDeskEscalationConfirmSupport_appointment`, `#queueDeskEscalationConfirmOpen_appointment`, `#queueDeskEscalationConfirmItem_walkin`, `#queueDeskEscalationConfirmHeadline_walkin`, `#queueDeskEscalationConfirmPhrase_walkin`, `#queueDeskEscalationConfirmSupport_walkin`, `#queueDeskEscalationConfirmOpen_walkin`, `#queueDeskEscalationConfirmItem_rule`, `#queueDeskEscalationConfirmHeadline_rule`, `#queueDeskEscalationConfirmPhrase_rule`, `#queueDeskEscalationConfirmSupport_rule`, `#queueDeskEscalationConfirmOpen_rule`, `#queueDeskEscalationConfirmEmpty`
- `#queueDeskEscalationFollowup`, `#queueDeskEscalationFollowupTitle`, `#queueDeskEscalationFollowupSummary`, `#queueDeskEscalationFollowupStatus`, `#queueDeskEscalationFollowupCopyBtn`, `#queueDeskEscalationFollowupItems`, `#queueDeskEscalationFollowupItem_appointment`, `#queueDeskEscalationFollowupHeadline_appointment`, `#queueDeskEscalationFollowupPhrase_appointment`, `#queueDeskEscalationFollowupSupport_appointment`, `#queueDeskEscalationFollowupOpen_appointment`, `#queueDeskEscalationFollowupItem_walkin`, `#queueDeskEscalationFollowupHeadline_walkin`, `#queueDeskEscalationFollowupPhrase_walkin`, `#queueDeskEscalationFollowupSupport_walkin`, `#queueDeskEscalationFollowupOpen_walkin`, `#queueDeskEscalationFollowupItem_rule`, `#queueDeskEscalationFollowupHeadline_rule`, `#queueDeskEscalationFollowupPhrase_rule`, `#queueDeskEscalationFollowupSupport_rule`, `#queueDeskEscalationFollowupOpen_rule`, `#queueDeskEscalationFollowupEmpty`
- `#queueDeskEscalationReopen`, `#queueDeskEscalationReopenTitle`, `#queueDeskEscalationReopenSummary`, `#queueDeskEscalationReopenStatus`, `#queueDeskEscalationReopenCopyBtn`, `#queueDeskEscalationReopenItems`, `#queueDeskEscalationReopenItem_appointment`, `#queueDeskEscalationReopenHeadline_appointment`, `#queueDeskEscalationReopenPhrase_appointment`, `#queueDeskEscalationReopenSupport_appointment`, `#queueDeskEscalationReopenOpen_appointment`, `#queueDeskEscalationReopenItem_walkin`, `#queueDeskEscalationReopenHeadline_walkin`, `#queueDeskEscalationReopenPhrase_walkin`, `#queueDeskEscalationReopenSupport_walkin`, `#queueDeskEscalationReopenOpen_walkin`, `#queueDeskEscalationReopenItem_rule`, `#queueDeskEscalationReopenHeadline_rule`, `#queueDeskEscalationReopenPhrase_rule`, `#queueDeskEscalationReopenSupport_rule`, `#queueDeskEscalationReopenOpen_rule`, `#queueDeskEscalationReopenEmpty`
- `#queueDeskEscalationLimit`, `#queueDeskEscalationLimitTitle`, `#queueDeskEscalationLimitSummary`, `#queueDeskEscalationLimitStatus`, `#queueDeskEscalationLimitCopyBtn`, `#queueDeskEscalationLimitItems`, `#queueDeskEscalationLimitItem_appointment`, `#queueDeskEscalationLimitHeadline_appointment`, `#queueDeskEscalationLimitPhrase_appointment`, `#queueDeskEscalationLimitSupport_appointment`, `#queueDeskEscalationLimitOpen_appointment`, `#queueDeskEscalationLimitItem_walkin`, `#queueDeskEscalationLimitHeadline_walkin`, `#queueDeskEscalationLimitPhrase_walkin`, `#queueDeskEscalationLimitSupport_walkin`, `#queueDeskEscalationLimitOpen_walkin`, `#queueDeskEscalationLimitItem_rule`, `#queueDeskEscalationLimitHeadline_rule`, `#queueDeskEscalationLimitPhrase_rule`, `#queueDeskEscalationLimitSupport_rule`, `#queueDeskEscalationLimitOpen_rule`, `#queueDeskEscalationLimitEmpty`
- `#queueDeskEscalationBridge`, `#queueDeskEscalationBridgeTitle`, `#queueDeskEscalationBridgeSummary`, `#queueDeskEscalationBridgeStatus`, `#queueDeskEscalationBridgeCopyBtn`, `#queueDeskEscalationBridgeItems`, `#queueDeskEscalationBridgeItem_appointment`, `#queueDeskEscalationBridgeHeadline_appointment`, `#queueDeskEscalationBridgePhrase_appointment`, `#queueDeskEscalationBridgeSupport_appointment`, `#queueDeskEscalationBridgeOpen_appointment`, `#queueDeskEscalationBridgeItem_walkin`, `#queueDeskEscalationBridgeHeadline_walkin`, `#queueDeskEscalationBridgePhrase_walkin`, `#queueDeskEscalationBridgeSupport_walkin`, `#queueDeskEscalationBridgeOpen_walkin`, `#queueDeskEscalationBridgeItem_rule`, `#queueDeskEscalationBridgeHeadline_rule`, `#queueDeskEscalationBridgePhrase_rule`, `#queueDeskEscalationBridgeSupport_rule`, `#queueDeskEscalationBridgeOpen_rule`, `#queueDeskEscalationBridgeEmpty`
- `#queueDeskEscalationBrief`, `#queueDeskEscalationBriefTitle`, `#queueDeskEscalationBriefSummary`, `#queueDeskEscalationBriefStatus`, `#queueDeskEscalationBriefCopyBtn`, `#queueDeskEscalationBriefItems`, `#queueDeskEscalationBriefItem_appointment`, `#queueDeskEscalationBriefHeadline_appointment`, `#queueDeskEscalationBriefPhrase_appointment`, `#queueDeskEscalationBriefSupport_appointment`, `#queueDeskEscalationBriefOpen_appointment`, `#queueDeskEscalationBriefItem_walkin`, `#queueDeskEscalationBriefHeadline_walkin`, `#queueDeskEscalationBriefPhrase_walkin`, `#queueDeskEscalationBriefSupport_walkin`, `#queueDeskEscalationBriefOpen_walkin`, `#queueDeskEscalationBriefItem_rule`, `#queueDeskEscalationBriefHeadline_rule`, `#queueDeskEscalationBriefPhrase_rule`, `#queueDeskEscalationBriefSupport_rule`, `#queueDeskEscalationBriefOpen_rule`, `#queueDeskEscalationBriefEmpty`
- `#queueDeskEscalationReturn`, `#queueDeskEscalationReturnTitle`, `#queueDeskEscalationReturnSummary`, `#queueDeskEscalationReturnStatus`, `#queueDeskEscalationReturnCopyBtn`, `#queueDeskEscalationReturnItems`, `#queueDeskEscalationReturnItem_appointment`, `#queueDeskEscalationReturnHeadline_appointment`, `#queueDeskEscalationReturnPhrase_appointment`, `#queueDeskEscalationReturnSupport_appointment`, `#queueDeskEscalationReturnOpen_appointment`, `#queueDeskEscalationReturnItem_walkin`, `#queueDeskEscalationReturnHeadline_walkin`, `#queueDeskEscalationReturnPhrase_walkin`, `#queueDeskEscalationReturnSupport_walkin`, `#queueDeskEscalationReturnOpen_walkin`, `#queueDeskEscalationReturnItem_rule`, `#queueDeskEscalationReturnHeadline_rule`, `#queueDeskEscalationReturnPhrase_rule`, `#queueDeskEscalationReturnSupport_rule`, `#queueDeskEscalationReturnOpen_rule`, `#queueDeskEscalationReturnEmpty`
- `#queueDeskEscalationResolution`, `#queueDeskEscalationResolutionTitle`, `#queueDeskEscalationResolutionSummary`, `#queueDeskEscalationResolutionStatus`, `#queueDeskEscalationResolutionCopyBtn`, `#queueDeskEscalationResolutionItems`, `#queueDeskEscalationResolutionItem_appointment`, `#queueDeskEscalationResolutionHeadline_appointment`, `#queueDeskEscalationResolutionPhrase_appointment`, `#queueDeskEscalationResolutionSupport_appointment`, `#queueDeskEscalationResolutionOpen_appointment`, `#queueDeskEscalationResolutionItem_walkin`, `#queueDeskEscalationResolutionHeadline_walkin`, `#queueDeskEscalationResolutionPhrase_walkin`, `#queueDeskEscalationResolutionSupport_walkin`, `#queueDeskEscalationResolutionOpen_walkin`, `#queueDeskEscalationResolutionItem_rule`, `#queueDeskEscalationResolutionHeadline_rule`, `#queueDeskEscalationResolutionPhrase_rule`, `#queueDeskEscalationResolutionSupport_rule`, `#queueDeskEscalationResolutionOpen_rule`, `#queueDeskEscalationResolutionEmpty`
- `#queueBlockers`, `#queueBlockersTitle`, `#queueBlockersSummary`, `#queueBlockersStatus`, `#queueBlockersCopyBtn`, `#queueBlockersItems`, `#queueBlockersItem_0`, `#queueBlockersHeadline_0`, `#queueBlockersAction_0`, `#queueBlockersSupport_0`, `#queueBlockersLoad_0`, `#queueBlockersEmpty`
- `#queueSlaDeck`, `#queueSlaDeckTitle`, `#queueSlaDeckSummary`, `#queueSlaDeckStatus`, `#queueSlaDeckCopyBtn`, `#queueSlaDeckItems`, `#queueSlaDeckItem_0`, `#queueSlaDeckHeadline_0`, `#queueSlaDeckDue_0`, `#queueSlaDeckSupport_0`, `#queueSlaDeckLoad_0`, `#queueSlaDeckEmpty`
- `#queueWaitRadar`, `#queueWaitRadarTitle`, `#queueWaitRadarSummary`, `#queueWaitRadarStatus`, `#queueWaitRadarCards`, `#queueWaitRadarCard_general`, `#queueWaitRadarHeadline_general`, `#queueWaitRadarOldest_general`, `#queueWaitRadarPressure_general`, `#queueWaitRadarRecommendation_general`, `#queueWaitRadarPrimary_general`, `#queueWaitRadarCard_c1`, `#queueWaitRadarHeadline_c1`, `#queueWaitRadarOldest_c1`, `#queueWaitRadarPressure_c1`, `#queueWaitRadarRecommendation_c1`, `#queueWaitRadarPrimary_c1`, `#queueWaitRadarCard_c2`, `#queueWaitRadarHeadline_c2`, `#queueWaitRadarOldest_c2`, `#queueWaitRadarPressure_c2`, `#queueWaitRadarRecommendation_c2`, `#queueWaitRadarPrimary_c2`
- `#queueLoadBalance`, `#queueLoadBalanceTitle`, `#queueLoadBalanceSummary`, `#queueLoadBalanceStatus`, `#queueLoadBalanceCards`, `#queueLoadBalanceCard_c1`, `#queueLoadBalanceHeadline_c1`, `#queueLoadBalanceLoad_c1`, `#queueLoadBalanceDelta_c1`, `#queueLoadBalanceCapacity_c1`, `#queueLoadBalancePrimary_c1`, `#queueLoadBalanceOpenOperator_c1`, `#queueLoadBalanceCard_c2`, `#queueLoadBalanceHeadline_c2`, `#queueLoadBalanceLoad_c2`, `#queueLoadBalanceDelta_c2`, `#queueLoadBalanceCapacity_c2`, `#queueLoadBalancePrimary_c2`, `#queueLoadBalanceOpenOperator_c2`
- `#queuePriorityLane`, `#queuePriorityLaneTitle`, `#queuePriorityLaneSummary`, `#queuePriorityLaneStatus`, `#queuePriorityLaneItems`, `#queuePriorityLaneEmpty`, `#queuePriorityLaneItem_0`, `#queuePriorityLaneHeadline_0`, `#queuePriorityLaneMeta_0`, `#queuePriorityLaneRecommendation_0`, `#queuePriorityLanePrimary_0`, `#queuePriorityLaneItem_1`, `#queuePriorityLaneHeadline_1`, `#queuePriorityLaneMeta_1`, `#queuePriorityLaneRecommendation_1`, `#queuePriorityLanePrimary_1`
- `#queueQuickTrays`, `#queueQuickTraysTitle`, `#queueQuickTraysSummary`, `#queueQuickTraysStatus`, `#queueQuickTraysCards`, `#queueQuickTray_sla_risk`, `#queueQuickTrayCount_sla_risk`, `#queueQuickTrayAction_sla_risk`, `#queueQuickTray_waiting_unassigned`, `#queueQuickTrayCount_waiting_unassigned`, `#queueQuickTrayAction_waiting_unassigned`, `#queueQuickTray_waiting_c1`, `#queueQuickTrayCount_waiting_c1`, `#queueQuickTrayAction_waiting_c1`, `#queueQuickTray_waiting_c2`, `#queueQuickTrayCount_waiting_c2`, `#queueQuickTrayAction_waiting_c2`, `#queueQuickTray_called`, `#queueQuickTrayCount_called`, `#queueQuickTrayAction_called`
- `#queueActiveTray`, `#queueActiveTrayTitle`, `#queueActiveTraySummary`, `#queueActiveTrayStatus`, `#queueActiveTrayResetBtn`, `#queueActiveTrayOpenTable`, `#queueActiveTrayItems`, `#queueActiveTrayEmpty`, `#queueActiveTrayItem_0`, `#queueActiveTrayHeadline_0`, `#queueActiveTrayMeta_0`, `#queueActiveTrayRecommendation_0`, `#queueActiveTrayPrimary_0`
- `#queueTrayBurst`, `#queueTrayBurstTitle`, `#queueTrayBurstSummary`, `#queueTrayBurstStatus`, `#queueTrayBurstRunBtn`, `#queueTrayBurstCopyBtn`, `#queueTrayBurstSteps`, `#queueTrayBurstEmpty`, `#queueTrayBurstStep_0`, `#queueTrayBurstStepTitle_0`, `#queueTrayBurstStepDetail_0`
- `#queueDispatchDeck`, `#queueDispatchDeckTitle`, `#queueDispatchDeckSummary`, `#queueDispatchDeckStatus`, `#queueDispatchDeckCards`, `#queueDispatchCard_c1`, `#queueDispatchHeadline_c1`, `#queueDispatchDetail_c1`, `#queueDispatchTarget_c1`, `#queueDispatchQueue_c1`, `#queueDispatchBacklog_c1`, `#queueDispatchPrimary_c1`, `#queueDispatchOpenOperator_c1`, `#queueDispatchCard_c2`, `#queueDispatchHeadline_c2`, `#queueDispatchDetail_c2`, `#queueDispatchTarget_c2`, `#queueDispatchQueue_c2`, `#queueDispatchBacklog_c2`, `#queueDispatchPrimary_c2`, `#queueDispatchOpenOperator_c2`
- `#queueQuickConsole`, `#queueQuickConsoleTitle`, `#queueQuickConsoleSummary`, `#queueQuickConsoleChip`, `#queueQuickConsoleActions`, `#queueQuickConsoleAction_opening_apply`, `#queueQuickConsoleAction_incident_log`, `#queueQuickConsoleAction_closing_apply`, `#queueQuickConsoleAction_copy_handoff`
- `#queuePlaybook`, `#queuePlaybookTitle`, `#queuePlaybookSummary`, `#queuePlaybookChip`, `#queuePlaybookAssistChip`, `#queuePlaybookApplyBtn`, `#queuePlaybookAssistBtn`, `#queuePlaybookCopyBtn`, `#queuePlaybookResetBtn`, `#queuePlaybookSteps`, `#queuePlaybookToggle_opening_operator`
- `#queueOpsPilot`, `#queueOpsPilotTitle`, `#queueOpsPilotSummary`, `#queueOpsPilotProgressValue`, `#queueOpsPilotChipConfirmed`, `#queueOpsPilotChipSuggested`, `#queueOpsPilotChipEquipment`, `#queueOpsPilotChipIssues`
- `#queueOpsPilotReadiness`, `#queueOpsPilotReadinessTitle`, `#queueOpsPilotReadinessStatus`, `#queueOpsPilotReadinessSummary`, `#queueOpsPilotReadinessSupport`
- `#queueOpsPilotReadinessItem_profile`, `#queueOpsPilotReadinessItem_catalog`, `#queueOpsPilotReadinessItem_surfaces`, `#queueOpsPilotReadinessItem_publish`, `#queueOpsPilotReadinessItem_health`, `#queueOpsPilotReadinessItem_smoke`
- `#queueOpsPilotIssues`, `#queueOpsPilotIssuesTitle`, `#queueOpsPilotIssuesStatus`, `#queueOpsPilotIssuesSummary`, `#queueOpsPilotIssuesSupport`, `#queueOpsPilotIssuesItems`
- `#queueOpsPilotIssuesItem_profile`, `#queueOpsPilotIssuesItem_catalog`, `#queueOpsPilotIssuesItem_publish`, `#queueOpsPilotIssuesItem_health`, `#queueOpsPilotIssuesItem_smoke`, `#queueOpsPilotIssuesItem_surface_operator`
- `#queueOpsPilotCanon`, `#queueOpsPilotCanonTitle`, `#queueOpsPilotCanonStatus`, `#queueOpsPilotCanonItems`, `#queueOpsPilotCanonSupport`
- `#queueOpsPilotCanonItem_admin`, `#queueOpsPilotCanonItem_operator`, `#queueOpsPilotCanonItem_kiosk`, `#queueOpsPilotCanonItem_display`
- `#queueOpsPilotSmoke`, `#queueOpsPilotSmokeTitle`, `#queueOpsPilotSmokeStatus`, `#queueOpsPilotSmokeSummary`, `#queueOpsPilotSmokeSupport`, `#queueOpsPilotSmokeItems`
- `#queueOpsPilotSmokeItem_admin`, `#queueOpsPilotSmokeItem_operator`, `#queueOpsPilotSmokeItem_kiosk`, `#queueOpsPilotSmokeItem_display`, `#queueOpsPilotSmokeItem_end_to_end`
- `#queueOpsPilotSmokeAction_admin`, `#queueOpsPilotSmokeAction_operator`, `#queueOpsPilotSmokeAction_kiosk`, `#queueOpsPilotSmokeAction_display`, `#queueOpsPilotSmokeAction_end_to_end`
- `#queueOpsPilotHandoff`, `#queueOpsPilotHandoffTitle`, `#queueOpsPilotHandoffSummary`, `#queueOpsPilotHandoffSupport`, `#queueOpsPilotHandoffItems`, `#queueOpsPilotHandoffCopyBtn`
- `#queueOpsPilotHandoffItem_clinic`, `#queueOpsPilotHandoffItem_profile_source`, `#queueOpsPilotHandoffItem_catalog`, `#queueOpsPilotHandoffItem_release`, `#queueOpsPilotHandoffItem_publish`, `#queueOpsPilotHandoffItem_canon`, `#queueOpsPilotHandoffItem_blockers`, `#queueOpsPilotHandoffItem_smoke`
- `#queueSurfaceTelemetry`, `#queueSurfaceTelemetryTitle`, `#queueSurfaceTelemetrySummary`, `#queueSurfaceTelemetryAutoMeta`, `#queueSurfaceTelemetryAutoState`, `#queueSurfaceTelemetryStatus`, `#queueSurfaceTelemetryCards`
- `#queueOpsAlerts`, `#queueOpsAlertsTitle`, `#queueOpsAlertsSummary`, `#queueOpsAlertsChipTotal`, `#queueOpsAlertsChipPending`, `#queueOpsAlertsChipReviewed`, `#queueOpsAlertsApplyBtn`, `#queueOpsAlertsItems`, `#queueOpsAlert_kiosk_printer_pending`, `#queueOpsAlertReview_kiosk_printer_pending`
- `#queueOpeningChecklist`, `#queueOpeningChecklistTitle`, `#queueOpeningChecklistSummary`, `#queueOpeningChecklistAssistChip`, `#queueOpeningChecklistApplyBtn`, `#queueOpeningChecklistResetBtn`, `#queueOpeningChecklistSteps`, `#queueOpeningToggle_operator_ready`
- `#queueShiftHandoff`, `#queueShiftHandoffTitle`, `#queueShiftHandoffSummary`, `#queueShiftHandoffAssistChip`, `#queueShiftHandoffCopyBtn`, `#queueShiftHandoffApplyBtn`, `#queueShiftHandoffResetBtn`, `#queueShiftHandoffPreview`, `#queueShiftHandoffSteps`, `#queueShiftToggle_queue_clear`
- `#queueOpsLog`, `#queueOpsLogTitle`, `#queueOpsLogSummary`, `#queueOpsLogChip`, `#queueOpsLogFilterAll`, `#queueOpsLogFilterIncidents`, `#queueOpsLogFilterChanges`, `#queueOpsLogFilterStatus`, `#queueOpsLogStatusBtn`, `#queueOpsLogIncidentBtn`, `#queueOpsLogCopyBtn`, `#queueOpsLogClearBtn`, `#queueOpsLogItems`
- `#queueContingencyDeck`, `#queueContingencyTitle`, `#queueContingencySummary`, `#queueContingencyCards`, `#queueContingencySyncCard`
- `#queueInstallConfigurator`, `#queueInstallSurfaceSelect`, `#queueInstallProfileSelect`, `#queueInstallPlatformSelect`, `#queueInstallPreset_operator_c1_locked`, `#queueInstallPreset_operator_c2_locked`, `#queueInstallPreset_operator_free`, `#queueInstallPreset_kiosk`, `#queueInstallPreset_sala_tv`
- `#queueStationBadge`, `#queueStationModeBadge`, `#queuePracticeModeBadge`, `#queueShortcutPanel`, `#queueSensitiveConfirmDialog`, `#queueReleaseC1`, `#queueSelectVisibleBtn`, `#queueClearSelectionBtn`, `#queueSelectionChip`, `#queueSelectedCount`
- `#toastContainer`
- If `admin.html#queue` falls back to an invalid pilot profile or a non-canonical route, `#toastContainer` must show `No se puede operar esta clínica desde admin...` for blocked queue mutations and the queue must remain unchanged.

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
    - `queueHubDomainViewV1`
    - `queueAdminViewModeV1`
    - `queueInstallPresetV1`
    - `queueTicketLookupV1`
- Retired compatibility key:
    - `adminUiVariant` (historical only; not read or cleaned by runtime)

## Keyboard Contract

- Section shortcuts: `Alt+Shift+Digit1..Digit6`
- Global:
    - `Ctrl+K` abre la barra de comandos
    - `Ctrl+Shift+K` abre el copiloto
    - `Alt+Shift+I` abre el copiloto
    - `/` enfoca la busqueda de la seccion activa
    - `Escape` cierra overlays activos
    - `Alt+Shift+M` alterna el menu
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
- `GET /api.php?resource=data` now includes `data.appDownloads` for `operator`, `kiosk` and `sala_tv`, including `guideUrl` for the public install center. This catalog is optional for the piloto web and does not block the canonical web release.
- `GET /api.php?resource=data` now also includes `data.queueSurfaceStatus` with grouped heartbeats for `operator`, `kiosk` and `display`.
- `GET /api.php?resource=data` now also includes `data.turneroClinicProfile` with `clinic_id`, `branding`, `consultorios`, `surfaces` and `release.admin_mode_default`.
- El perfil activo que alimenta `data.turneroClinicProfile` debe salir de `content/turnero/clinic-profile.json`, pero su fuente canónica de release vive en `content/turnero/clinic-profiles/*.json` y se promueve con `bin/turnero-clinic-profile.js`.
- The admin runtime also persists `data.turneroClinicProfileMeta` locally to distinguish `remote` vs `fallback_local`; `queueOpsPilotReadinessItem_profile` must block go-live when the profile source is only local fallback.
- `GET /api.php?resource=health` now also includes `checks.turneroPilot` with `clinicId`, `profileFingerprint`, `profileSource`, `catalogReady`, `catalogEntryId`, `releaseMode`, `adminModeDefault`, `separateDeploy` and `surfaces.*.route`.
- `admin.html#queue` now runs in `queueAdminViewModeV1=basic|expert`; `basic` is the production default for the piloto web and `expert` keeps the advanced hub as non-blocking support tooling.
- In deployment/basic, `#queueOpsPilotReadiness` is the canonical go-live gate for the piloto web: it evaluates `perfil por clínica`, `perfil catalogado`, `superficies web`, `publicación del release`, `señal viva + heartbeats` and `smoke final`.
- In deployment/basic, `#queueOpsPilotIssues` is the short actionable blocker deck for the same piloto web: it must surface only the unresolved items that still stop go-live (`perfil`, `publish`, `health`, `canon` or `smoke`) and may link directly to the affected surface or health check.
- In deployment/basic, `#queueOpsPilotSmoke` is the repeatable smoke sequence for the piloto web: it must expose direct clinic-specific links for `admin`, `operator`, `kiosk`, `display` and the final called-flow closeout.
- In deployment/basic, `#queueOpsPilotCanon` is also a live route contract: each `#queueOpsPilotCanonItem_*` must expose whether the surface is `Verificada`, `Declarada` or `Bloquea` against the route declared in `turneroClinicProfile.surfaces.*.route`, and `#queueOpsPilotCanonSupport` must summarize any route drift.
- In deployment/basic, `#queueOpsPilotCanonItem_*` must also block if `queueSurfaceStatus.*.latest.details.clinicId` differs from `turneroClinicProfile.clinic_id`, even when the route matches.
- In deployment/basic, `#queueOpsPilotCanonItem_*` must also block if `queueSurfaceStatus.*.latest.details.profileFingerprint` differs from the active profile fingerprint, even when `clinicId` and route still match.
- In deployment/basic, `#queueOpsPilotReadinessItem_health` must also block if `checks.turneroPilot.clinicId`, `checks.turneroPilot.profileFingerprint`, `checks.turneroPilot.profileSource` or `checks.turneroPilot.catalogReady` differ from the active clinic profile, even when `publicSync` stays healthy.
- In deployment/basic, `#queueOpsPilotHandoff` is the shareable opening packet for the clinic pilot: it must summarize `clinic_id`, release mode, deployed commit, `bloqueo activo` and smoke progress, and `#queueOpsPilotHandoffCopyBtn` must copy the packet plus canonical routes.
- The same gate also depends on `data.turneroClinicProfileCatalogStatus`; if the active `clinic-profile.json` does not match a file under `content/turnero/clinic-profiles/*.json`, `#queueOpsPilotReadinessItem_catalog` must block go-live and `#queueOpsPilotHandoffItem_catalog` must say whether the profile is `verificado`, `desalineado` or still `sin entrada catalogada`.
- `queueOpeningChecklistV1`, `queueShiftHandoffV1`, `queueOpsLogV1`, `queueOpsLogFilterV1`, `queueOpsAlertsV1`, `queueOpsFocusModeV1`, `queueOpsPlaybookV1` and `queueHubDomainViewV1` are clinic-scoped. If the active `turneroClinicProfile.clinic_id` changes, runtime must reset those states before rendering the piloto web.
- `queueTicketLookupV1` is also clinic-scoped; if the active clinic changes, runtime must clear the prior lookup before rendering the piloto web.
- `queueStationMode`, `queueStationConsultorio`, `queueOneTapAdvance`, `queueNumpadHelpOpen`, `queueCallKeyBindingV1` and `queueAdminLastSnapshot` are now persisted per clinic. If the active clinic changes, runtime must load the values for that clinic and ignore snapshot/settings from another one.
- `queueDisplayBellMuted`, `queueDisplayLastSnapshot`, `queueKioskSeniorMode`, `queueKioskPrinterState` and `queueKioskOfflineOutbox` are also clinic-scoped. The piloto web must ignore local TV/kiosk state that belongs to another `clinic_id`.
- `state.queue.activity[*]` now also carries `clinicId`; `queueOpsPilotSmoke` and checklist assist must ignore local call activity that belongs to another clinic or lacks `clinicId`.
- Rollback is operational (`revert + deploy`), not a runtime variant switch.
- Any DOM contract break requires explicit test migration in active admin suites.

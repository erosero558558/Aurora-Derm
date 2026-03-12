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
- `#queueAppsHub`, `#queueAppsPlatformChip`, `#queueAppsRefreshShieldChip`, `#queueAppDownloadsCards`
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

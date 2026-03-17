export function renderClinicalHistorySection() {
    return `
        <section id="clinical-history" class="admin-section" tabindex="-1">
            <div class="clinical-history-stage">
                <article class="sony-panel clinical-history-summary-panel">
                    <header class="section-header">
                        <div>
                            <h3>Historia clinica</h3>
                            <p id="clinicalHistoryHeaderMeta">
                                Selecciona un caso para revisar la conversacion y el borrador medico.
                            </p>
                        </div>
                        <div class="clinical-history-header-status">
                            <span
                                class="clinical-history-status-chip"
                                id="clinicalHistoryStatusChip"
                                data-tone="neutral"
                            >
                                Sin seleccion
                            </span>
                            <span
                                class="clinical-history-status-meta"
                                id="clinicalHistoryStatusMeta"
                            >
                                Cola lista para revision
                            </span>
                        </div>
                    </header>
                    <div
                        id="clinicalHistorySummaryGrid"
                        class="clinical-history-summary-grid"
                    ></div>
                    <div
                        id="clinicalHistoryAttachmentStrip"
                        class="clinical-history-attachment-strip"
                    ></div>
                </article>

                <article class="sony-panel clinical-history-side-panel">
                    <header class="section-header">
                        <div>
                            <h3>Cola clinica</h3>
                            <p id="clinicalHistoryQueueMeta">
                                Casos listos para revision humana.
                            </p>
                        </div>
                        <button
                            type="button"
                            id="clinicalHistoryRefreshBtn"
                            data-clinical-review-action="refresh-current"
                        >
                            Refrescar caso
                        </button>
                    </header>
                    <div
                        id="clinicalHistoryQueueList"
                        class="clinical-history-queue-list"
                    ></div>
                </article>
            </div>

            <div class="clinical-history-workbench">
                <article class="sony-panel clinical-history-transcript-panel">
                    <header class="section-header">
                        <div>
                            <h3>Conversacion</h3>
                            <p id="clinicalHistoryTranscriptMeta">
                                El transcript del paciente aparece aqui.
                            </p>
                        </div>
                        <span
                            class="clinical-history-panel-meta"
                            id="clinicalHistoryTranscriptCount"
                        >
                            0 mensajes
                        </span>
                    </header>
                    <div
                        id="clinicalHistoryTranscript"
                        class="clinical-history-transcript"
                    ></div>
                </article>

                <article class="sony-panel clinical-history-draft-panel">
                    <header class="section-header">
                        <div>
                            <h3>Borrador medico</h3>
                            <p id="clinicalHistoryDraftSummary">
                                Ajusta anamnesis, guardrails y plan antes de aprobar.
                            </p>
                        </div>
                        <span
                            class="clinical-history-panel-meta"
                            id="clinicalHistoryDraftMeta"
                        >
                            Sin cambios
                        </span>
                    </header>
                    <form
                        id="clinicalHistoryDraftForm"
                        class="clinical-history-form"
                    ></form>
                </article>
            </div>

            <div class="clinical-history-footer-grid">
                <article class="sony-panel soft clinical-history-events-panel">
                    <header class="section-header">
                        <div>
                            <h3>Eventos del caso</h3>
                            <p id="clinicalHistoryEventsMeta">
                                Alertas, conciliacion y acciones pendientes.
                            </p>
                        </div>
                    </header>
                    <div
                        id="clinicalHistoryEvents"
                        class="clinical-history-events"
                    ></div>
                </article>

                <article class="sony-panel soft clinical-history-followup-panel">
                    <header class="section-header">
                        <div>
                            <h3>Pregunta adicional</h3>
                            <p id="clinicalHistoryFollowUpMeta">
                                Envia una pregunta puntual al paciente sin salir del review.
                            </p>
                        </div>
                    </header>
                    <textarea
                        id="clinicalHistoryFollowUpInput"
                        class="clinical-history-followup-input"
                        rows="4"
                        placeholder="Ej.: ¿Puedes decirme si el brote empeora con el sol o el calor?"
                    ></textarea>
                    <div class="toolbar-row clinical-history-actions-row">
                        <button
                            type="button"
                            id="clinicalHistorySendFollowUpBtn"
                            data-clinical-review-action="send-follow-up"
                        >
                            Pedir pregunta
                        </button>
                        <button
                            type="button"
                            id="clinicalHistoryReviewRequiredBtn"
                            data-clinical-review-action="mark-review-required"
                        >
                            Marcar revision
                        </button>
                        <button
                            type="submit"
                            id="clinicalHistorySaveBtn"
                            form="clinicalHistoryDraftForm"
                        >
                            Guardar borrador
                        </button>
                        <button
                            type="button"
                            id="clinicalHistoryApproveBtn"
                            data-clinical-review-action="approve-current"
                        >
                            Aprobar
                        </button>
                    </div>
                </article>
            </div>

            <div class="clinical-media-flow-grid">
                <article class="sony-panel soft clinical-media-flow-queue-panel">
                    <header class="section-header">
                        <div>
                            <h3>Media Flow</h3>
                            <p id="clinicalMediaFlowQueueMeta">
                                Cola editorial con media clinica privada disponible.
                            </p>
                        </div>
                        <div class="clinical-history-header-status">
                            <span
                                class="clinical-history-status-chip"
                                id="clinicalMediaFlowStatusChip"
                                data-tone="neutral"
                            >
                                Sin caso
                            </span>
                            <span
                                class="clinical-history-status-meta"
                                id="clinicalMediaFlowStatusMeta"
                            >
                                Esperando seleccion
                            </span>
                        </div>
                    </header>
                    <div
                        id="clinicalMediaFlowQueueList"
                        class="clinical-media-flow-queue-list"
                    ></div>
                </article>

                <article class="sony-panel clinical-media-flow-workspace-panel">
                    <header class="section-header">
                        <div>
                            <h3>Workspace editorial</h3>
                            <p id="clinicalMediaFlowCaseMeta">
                                OpenClaw prepara comparativas, copy y paquete publico antes de publicar.
                            </p>
                        </div>
                        <div class="toolbar-row clinical-media-flow-toolbar">
                            <button
                                type="button"
                                id="clinicalMediaFlowRefreshBtn"
                                data-media-flow-action="refresh"
                            >
                                Refrescar
                            </button>
                            <button
                                type="button"
                                id="clinicalMediaFlowGenerateBtn"
                                data-media-flow-action="generate-proposal"
                            >
                                Generar propuesta
                            </button>
                        </div>
                    </header>

                    <div
                        id="clinicalMediaFlowConsentStrip"
                        class="clinical-media-flow-consent-strip"
                    ></div>
                    <div
                        id="clinicalMediaFlowAssetGrid"
                        class="clinical-media-flow-asset-grid"
                    ></div>
                    <section
                        id="clinicalMediaFlowAgentSurface"
                        class="clinical-media-flow-agent-surface"
                    ></section>
                    <form
                        id="clinicalMediaFlowProposalForm"
                        class="clinical-media-flow-form"
                    ></form>
                    <div
                        id="clinicalMediaFlowTimeline"
                        class="clinical-media-flow-timeline"
                    ></div>
                </article>
            </div>
        </section>
    `;
}

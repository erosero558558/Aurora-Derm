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
        </section>
    `;
}

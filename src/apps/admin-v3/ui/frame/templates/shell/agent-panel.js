export function renderAdminAgentPanel() {
    return `
        <aside
            id="adminAgentPanel"
            class="admin-agent-panel is-hidden"
            aria-hidden="true"
            aria-labelledby="adminAgentPanelTitle"
        >
            <div class="admin-agent-panel__shell">
                <header class="admin-agent-panel__header">
                    <div>
                        <p class="sony-kicker">Copiloto operativo</p>
                        <h3 id="adminAgentPanelTitle">Admin Agent</h3>
                        <p id="adminAgentPanelSummary">
                            Sesion inactiva. Abre el copiloto para trabajar con contexto del admin.
                        </p>
                    </div>
                    <div class="admin-agent-panel__header-actions">
                        <span id="adminAgentRelayBadge" class="admin-agent-badge" data-state="disabled">relay disabled</span>
                        <button type="button" class="admin-agent-panel__ghost" data-action="admin-agent-refresh">Actualizar</button>
                        <button type="button" class="admin-agent-panel__close" data-action="close-agent-panel">Cerrar</button>
                    </div>
                </header>

                <div class="admin-agent-panel__meta">
                    <article class="admin-agent-surface">
                        <span>Contexto activo</span>
                        <strong id="adminAgentContextSummary">Sincronizando contexto del admin</strong>
                        <small id="adminAgentContextMeta">El agente usa estado interno y APIs, no el DOM.</small>
                    </article>
                    <article class="admin-agent-surface">
                        <span>Sesion</span>
                        <strong id="adminAgentSessionState">idle</strong>
                        <small id="adminAgentSessionMeta">Sin hilo operativo abierto.</small>
                    </article>
                    <article class="admin-agent-surface">
                        <span>Sync</span>
                        <strong id="adminAgentSyncState">idle</strong>
                        <small id="adminAgentLiveMeta">Sin sincronizacion activa.</small>
                    </article>
                </div>

                <section class="admin-agent-surface">
                    <div class="admin-agent-surface__head">
                        <h4>Conversacion</h4>
                        <small id="adminAgentConversationMeta">Sin mensajes</small>
                    </div>
                    <div id="adminAgentConversation" class="admin-agent-log"></div>
                </section>

                <section class="admin-agent-surface">
                    <div class="admin-agent-surface__head">
                        <h4>Tool plan</h4>
                        <small id="adminAgentPlanMeta">Sin ejecuciones</small>
                    </div>
                    <div id="adminAgentToolPlan" class="admin-agent-list"></div>
                </section>

                <section class="admin-agent-surface">
                    <div class="admin-agent-surface__head">
                        <h4>Aprobaciones</h4>
                        <small id="adminAgentApprovalMeta">Sin pendientes</small>
                    </div>
                    <div id="adminAgentApprovalQueue" class="admin-agent-list"></div>
                </section>

                <section class="admin-agent-surface">
                    <div class="admin-agent-surface__head">
                        <h4>Timeline</h4>
                        <small id="adminAgentTimelineMeta">Sin eventos</small>
                    </div>
                    <div id="adminAgentEventTimeline" class="admin-agent-list"></div>
                </section>

                <section class="admin-agent-surface">
                    <div class="admin-agent-surface__head">
                        <h4>Outbox</h4>
                        <small id="adminAgentOutboxMeta">Sin salidas externas</small>
                    </div>
                    <div id="adminAgentOutboxList" class="admin-agent-list"></div>
                </section>

                <div class="admin-agent-panel__composer">
                    <label class="admin-agent-panel__label" for="adminAgentPrompt">Instruccion para el copiloto</label>
                    <textarea
                        id="adminAgentPrompt"
                        rows="4"
                        placeholder="Ej. Resume los callbacks pendientes y marca como sin_respuesta el 402"
                    ></textarea>
                    <div class="admin-agent-panel__composer-actions">
                        <button type="button" data-action="admin-agent-cancel">Cancelar sesion</button>
                        <button type="button" id="adminAgentSubmitBtn" data-action="admin-agent-submit">Ejecutar</button>
                    </div>
                </div>
            </div>
        </aside>
    `;
}

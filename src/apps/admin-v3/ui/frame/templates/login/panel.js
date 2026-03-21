import { renderThemeSwitcher } from './theme-switcher.js';

export function renderLoginPanel() {
    return `
        <section class="admin-v3-login__panel">
            <div class="admin-v3-login__panel-head">
                <p class="sony-kicker" id="adminLoginStepEyebrow">Ingreso interno</p>
                <h2 id="adminLoginRouteTitle">Acceso de consultorio</h2>
                <p id="adminLoginStepSummary">
                    Validando si este entorno esta listo para operar con OpenClaw y datos clinicos.
                </p>
            </div>

            <div
                id="adminLoginStatusCard"
                class="admin-login-status-card admin-login-alert"
                data-state="neutral"
            >
                <strong id="adminLoginStatusTitle">Readiness del consultorio</strong>
                <p id="adminLoginStatusMessage">
                    El panel comprueba acceso OpenClaw y estado clinico antes de abrir la operacion.
                </p>
            </div>

            <form id="loginForm" class="sony-login-form" novalidate>
                <div id="legacyLoginStage">
                    <label id="adminPasswordField" class="admin-login-field" for="adminPassword">
                        <span>Contrasena</span>
                        <input id="adminPassword" type="password" required placeholder="Ingresa tu clave" autocomplete="current-password" />
                    </label>
                    <div id="group2FA" class="is-hidden">
                        <label id="admin2FAField" class="admin-login-field" for="admin2FACode">
                            <span>Codigo 2FA</span>
                            <input id="admin2FACode" type="text" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="123456" />
                        </label>
                    </div>
                </div>
                <div id="openclawLoginStage" class="admin-openclaw-stage is-hidden" aria-live="polite">
                    <div class="admin-openclaw-stage__intro">
                        <strong id="adminOpenClawIntroTitle">Sesion local OpenClaw</strong>
                        <p id="adminOpenClawIntroMessage">
                            Este panel puede delegar la identidad del operador a OpenClaw en este mismo laptop.
                        </p>
                    </div>
                    <div id="adminOpenClawChallengeCard" class="admin-openclaw-challenge is-hidden">
                        <div class="admin-openclaw-challenge__head">
                            <span class="admin-openclaw-challenge__eyebrow">Codigo manual</span>
                            <strong id="adminOpenClawManualCode">-</strong>
                        </div>
                        <p id="adminOpenClawChallengeMeta">
                            El helper local mostrara aqui el challenge activo cuando inicies el flujo.
                        </p>
                        <div class="admin-openclaw-challenge__actions">
                            <a
                                id="adminOpenClawHelperLink"
                                class="admin-login-inline-link is-hidden"
                                href="#"
                                target="_blank"
                                rel="noopener"
                            >
                                Abrir helper local
                            </a>
                        </div>
                    </div>
                </div>
                <div class="admin-login-actions">
                    <button id="loginBtn" type="submit">Ingresar</button>
                    <button
                        id="loginReset2FABtn"
                        type="button"
                        class="sony-login-reset is-hidden"
                        data-action="reset-login-2fa"
                    >
                        Volver
                    </button>
                </div>
                <div class="admin-login-alt-actions">
                    <button
                        id="loginFallbackToggleBtn"
                        type="button"
                        class="admin-login-inline-link is-hidden"
                        data-action="show-login-fallback"
                    >
                        Usar clave de contingencia
                    </button>
                    <button
                        id="loginPrimaryToggleBtn"
                        type="button"
                        class="admin-login-inline-link is-hidden"
                        data-action="show-login-primary"
                    >
                        Volver a OpenClaw
                    </button>
                </div>
                <p id="adminLoginSupportCopy" class="admin-login-support-copy">
                    Esta tarjeta se adapta al modo de autenticacion y al gate clinico del backend.
                </p>
                <p
                    id="adminLoginContingencyCopy"
                    class="admin-login-support-copy admin-login-support-copy-secondary is-hidden"
                >
                    OpenClaw es el acceso principal del operador local.
                </p>
            </form>

            ${renderThemeSwitcher('login-theme-bar')}
        </section>
    `;
}

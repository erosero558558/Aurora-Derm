import { icon } from '../../../shared/ui/icons.js';

function themeSwitcher(className) {
    return `
        <div class="sony-theme-switcher ${className}" role="group" aria-label="Tema">
            <button type="button" class="admin-theme-btn" data-action="set-admin-theme" data-theme-mode="light">${icon('sun')}</button>
            <button type="button" class="admin-theme-btn" data-action="set-admin-theme" data-theme-mode="dark">${icon('moon')}</button>
            <button type="button" class="admin-theme-btn" data-action="set-admin-theme" data-theme-mode="system">${icon('system')}</button>
        </div>
    `;
}

export function renderLoginTemplate() {
    return `
        <div class="admin-v3-login">
            <section class="admin-v3-login__hero">
                <div class="admin-v3-login__brand">
                    <p class="sony-kicker">Piel en Armonia</p>
                    <h1>Centro operativo claro y protegido</h1>
                    <p>
                        Acceso editorial para agenda, callbacks y disponibilidad con
                        jerarquia simple y lectura rapida.
                    </p>
                </div>
                <div class="admin-v3-login__facts">
                    <article class="admin-v3-login__fact">
                        <span>Sesion</span>
                        <strong>Acceso administrativo aislado</strong>
                        <small>Entrada dedicada para operacion diaria.</small>
                    </article>
                    <article class="admin-v3-login__fact">
                        <span>Proteccion</span>
                        <strong>Clave y 2FA en la misma tarjeta</strong>
                        <small>El segundo paso aparece solo cuando el backend lo exige.</small>
                    </article>
                    <article class="admin-v3-login__fact">
                        <span>Entorno</span>
                        <strong>Activos self-hosted y CSP activa</strong>
                        <small>Sin dependencias remotas para estilos ni fuentes.</small>
                    </article>
                </div>
            </section>

            <section class="admin-v3-login__panel">
                <div class="admin-v3-login__panel-head">
                    <p class="sony-kicker" id="adminLoginStepEyebrow">Ingreso protegido</p>
                    <h2 id="adminLoginStepTitle">Acceso de administrador</h2>
                    <p id="adminLoginStepSummary">
                        Usa tu clave para abrir el workbench operativo.
                    </p>
                </div>

                <div id="adminLoginStatusCard" class="admin-login-status-card" data-state="neutral">
                    <strong id="adminLoginStatusTitle">Proteccion activa</strong>
                    <p id="adminLoginStatusMessage">
                        El panel usa autenticacion endurecida y activos self-hosted.
                    </p>
                </div>

                <form id="loginForm" class="sony-login-form" novalidate>
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
                    <p id="adminLoginSupportCopy" class="admin-login-support-copy">
                        Si el backend solicita un segundo paso, el flujo sigue en esta misma tarjeta.
                    </p>
                </form>

                ${themeSwitcher('login-theme-bar')}
            </section>
        </div>
    `;
}

export function renderHeaderThemeSwitcher() {
    return themeSwitcher('admin-theme-switcher-header');
}

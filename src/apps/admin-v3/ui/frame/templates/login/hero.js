export function renderLoginHero() {
    return `
        <section class="admin-v3-login__hero">
            <div class="admin-v3-login__brand">
                <p class="sony-kicker">Piel en Armonia</p>
                <h1>Nucleo interno de consultorio</h1>
                <p>
                    Turnero, acceso OpenClaw e historias clinicas en una sola
                    consola interna para recepcion y consultorio.
                </p>
            </div>
            <div class="admin-v3-login__facts">
                <article class="admin-v3-login__fact">
                    <span>Acceso</span>
                    <strong>OpenClaw como puerta principal</strong>
                    <small>El login del operador vive dentro del flujo interno.</small>
                </article>
                <article class="admin-v3-login__fact">
                    <span>Clinica</span>
                    <strong>Historias clinicas con gate de seguridad</strong>
                    <small>No se consideran listas si el almacenamiento no cumple.</small>
                </article>
                <article class="admin-v3-login__fact">
                    <span>Operacion</span>
                    <strong>Turnero primero, herramientas despues</strong>
                    <small>La operacion diaria no depende de la web publica.</small>
                </article>
            </div>
        </section>
    `;
}

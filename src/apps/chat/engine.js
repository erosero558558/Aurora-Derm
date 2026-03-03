/**
 * Figo chat engine (deferred-loaded).
 * Extracted from script.js to reduce initial parsing work.
 */
// build-sync: 20260219-sync1
// ========================================
// INTEGRACIÓN CON BOT DEL SERVIDOR
// ========================================
const KIMI_CONFIG = {
    apiUrl: '/figo-chat.php',
    model: 'figo-assistant',
    // Limite pragmático para bajar p95 sin degradar utilidad clínica.
    maxTokens: 256,
    temperature: 0.7,
};
const CHAT_CONTEXT_MAX_ITEMS = 14;
const OPENCLAW_POLL_MAX_MS = 30000;

let deps = null;
let conversationContext = [];
let chatHistory = [];
let currentAppointment = null;
let CLINIC_ADDRESS = 'Dr. Cecilio Caiza e hijas, Quito, Ecuador';
let CLINIC_MAP_URL = '';
let DOCTOR_CAROLINA_PHONE = '+593 98 786 6885';
let DOCTOR_CAROLINA_EMAIL = 'caro93narvaez@gmail.com';
let isProcessingMessage = false; // Evitar duplicados

function init(inputDeps = {}) {
    deps = inputDeps || {};
    conversationContext = getConversationContextSafe();
    chatHistory = getChatHistorySafe();
    currentAppointment = getCurrentAppointmentSafe();

    const clinicAddress = String(deps.clinicAddress || '').trim();
    const clinicMapUrl = String(deps.clinicMapUrl || '').trim();
    const doctorPhone = String(deps.doctorCarolinaPhone || '').trim();
    const doctorEmail = String(deps.doctorCarolinaEmail || '').trim();

    if (clinicAddress) CLINIC_ADDRESS = clinicAddress;
    if (clinicMapUrl) CLINIC_MAP_URL = clinicMapUrl;
    if (doctorPhone) DOCTOR_CAROLINA_PHONE = doctorPhone;
    if (doctorEmail) DOCTOR_CAROLINA_EMAIL = doctorEmail;

    return window.Piel && window.Piel.FigoChatEngine;
}

function debugLog(...args) {
    if (deps && typeof deps.debugLog === 'function') {
        deps.debugLog(...args);
    }
}

function showTypingIndicator() {
    if (deps && typeof deps.showTypingIndicator === 'function') {
        deps.showTypingIndicator();
    }
}

function removeTypingIndicator() {
    if (deps && typeof deps.removeTypingIndicator === 'function') {
        deps.removeTypingIndicator();
    }
}

function addBotMessage(content, showOfflineLabel = false) {
    if (deps && typeof deps.addBotMessage === 'function') {
        deps.addBotMessage(content, showOfflineLabel);
    }
}

function startChatBooking() {
    if (deps && typeof deps.startChatBooking === 'function') {
        deps.startChatBooking();
    }
}

function processChatBookingStep(message) {
    if (deps && typeof deps.processChatBookingStep === 'function') {
        return deps.processChatBookingStep(message);
    }
    return Promise.resolve(false);
}

function isChatBookingActive() {
    if (deps && typeof deps.isChatBookingActive === 'function') {
        return deps.isChatBookingActive() === true;
    }
    return false;
}

function showToast(message, type = 'info', title = '') {
    if (deps && typeof deps.showToast === 'function') {
        deps.showToast(message, type, title);
    }
}

function getConversationContextSafe() {
    if (deps && typeof deps.getConversationContext === 'function') {
        const value = deps.getConversationContext();
        return Array.isArray(value) ? value.slice() : [];
    }
    return Array.isArray(conversationContext)
        ? conversationContext.slice()
        : [];
}

function setConversationContextSafe(nextContext) {
    conversationContext = Array.isArray(nextContext) ? nextContext.slice() : [];
    if (deps && typeof deps.setConversationContext === 'function') {
        deps.setConversationContext(conversationContext.slice());
    }
}

function getChatHistorySafe() {
    if (deps && typeof deps.getChatHistory === 'function') {
        const value = deps.getChatHistory();
        return Array.isArray(value) ? value.slice() : [];
    }
    return Array.isArray(chatHistory) ? chatHistory.slice() : [];
}

function setChatHistorySafe(nextHistory) {
    chatHistory = Array.isArray(nextHistory) ? nextHistory.slice() : [];
    if (deps && typeof deps.setChatHistory === 'function') {
        deps.setChatHistory(chatHistory.slice());
    }
}

function getCurrentAppointmentSafe() {
    if (deps && typeof deps.getCurrentAppointment === 'function') {
        const appointment = deps.getCurrentAppointment();
        return appointment && typeof appointment === 'object'
            ? appointment
            : null;
    }
    return currentAppointment && typeof currentAppointment === 'object'
        ? currentAppointment
        : null;
}

function shouldUseRealAI() {
    if (localStorage.getItem('forceAI') === 'true') {
        return true;
    }

    if (window.location.protocol === 'file:') {
        return false;
    }

    return true;
}

function createFigoError(message, details = {}) {
    const error = new Error(message);
    if (details && typeof details === 'object') {
        Object.assign(error, details);
    }
    return error;
}

function isOpenClawQueueError(error) {
    if (!error || typeof error !== 'object') {
        return false;
    }

    if (error.noLocalFallback === true) {
        return true;
    }

    if (
        typeof error.provider === 'string' &&
        error.provider === 'openclaw_queue'
    ) {
        return true;
    }

    if (typeof error.code === 'string') {
        return /^(queue_|gateway_|provider_mode_disabled)/.test(error.code);
    }

    return false;
}

function showOpenClawUnavailableMessage(reason = '') {
    const hint = reason
        ? `<br><small>Detalle técnico: ${String(reason)}</small>`
        : '';

    addBotMessage(
        `El asistente Figo no está disponible por unos minutos.${hint}<br><br>
Puedes continuar por <a href="https://wa.me/593982453672" target="_blank" rel="noopener noreferrer">WhatsApp +593 98 245 3672</a> para atención inmediata.`,
        false
    );
}

async function processWithKimi(message) {
    if (isProcessingMessage) {
        debugLog('Ya procesando, ignorando duplicado');
        return;
    }

    // Si hay un booking en curso, desviar al flujo conversacional
    if (typeof isChatBookingActive === 'function' && isChatBookingActive()) {
        const handled = await processChatBookingStep(message);
        if (handled !== false) {
            return;
        }
    }

    // Detectar intención de agendar cita para iniciar booking conversacional
    if (
        /cita|agendar|reservar|turno|quiero una consulta|necesito cita/i.test(
            message
        )
    ) {
        startChatBooking();
        return;
    }

    isProcessingMessage = true;

    showTypingIndicator();

    if (isOutOfScopeIntent(message)) {
        removeTypingIndicator();
        addBotMessage(
            `Puedo ayudarte con temas de <strong>Piel en Armonía</strong> (servicios, precios, citas, pagos, horarios y ubicación).<br><br>Si deseas, te ayudo ahora con:<br>- <a href="#servicios" data-action="minimize-chat">Servicios y tratamientos</a><br>- <a href="#v5-booking" data-action="minimize-chat">Reservar cita</a><br>- <a href="https://wa.me/593982453672" target="_blank" rel="noopener noreferrer">WhatsApp directo</a>`,
            false
        );
        isProcessingMessage = false;
        return;
    }

    // Prioriza IA real cuando el servidor esta disponible.
    // Si falla la conexion, usa fallback local para no romper la experiencia.
    debugLog('Procesando mensaje:', message);

    try {
        if (shouldUseRealAI()) {
            debugLog('?? Consultando bot del servidor...');
            await tryRealAI(message);
        } else {
            debugLog('?? Usando respuestas locales (modo offline)');
            setTimeout(() => {
                removeTypingIndicator();
                processLocalResponse(message, false);
            }, 600);
        }
    } catch (error) {
        debugLog('Error:', error);
        removeTypingIndicator();
        processLocalResponse(message, false);
    } finally {
        isProcessingMessage = false;
    }
}

function normalizeIntentText(text) {
    if (!text) return '';

    return text
        .toString()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
}

function isPaymentIntent(text) {
    const normalized = normalizeIntentText(text);
    return /(pago|pagar|metodo de pago|tarjeta|transferencia|efectivo|deposito|comprobante|referencia|factura|visa|mastercard)/.test(
        normalized
    );
}

function buildPaymentGuidance(normalizedMsg) {
    const asksCard = /(tarjeta|visa|mastercard|debito|credito|stripe)/.test(
        normalizedMsg
    );
    const asksTransfer =
        /(transferencia|deposito|comprobante|referencia|banco)/.test(
            normalizedMsg
        );
    const asksCash = /(efectivo|consultorio|presencial)/.test(normalizedMsg);
    const asksInvoice = /(factura|facturacion|ruc|cedula)/.test(normalizedMsg);

    let response = `Asi puedes realizar tu pago en la web:<br><br>
<strong>1) Reserva tu cita</strong><br>
Ve a <a href="#v5-booking" data-action="minimize-chat">Reservar Cita</a>, completa tus datos y selecciona fecha/hora.<br><br>

<strong>2) Abre el modulo de pago</strong><br>
Al enviar el formulario se abre la ventana de pago automaticamente.<br><br>

<strong>3) Elige metodo de pago</strong><br>
• <strong>Tarjeta:</strong> cobro seguro con Stripe.<br>
• <strong>Transferencia:</strong> subes el comprobante y el numero de referencia.<br>
• <strong>Efectivo:</strong> dejas la reserva registrada y pagas en consultorio.<br><br>`;

    if (asksCard) {
        response += `<strong>Tarjeta (paso a paso):</strong><br>
1. Selecciona <strong>Tarjeta</strong>.<br>
2. Completa nombre + datos de tarjeta en el formulario seguro.<br>
3. Confirma el pago y espera la validacion final de la cita.<br><br>`;
    }

    if (asksTransfer) {
        response += `<strong>Transferencia (paso a paso):</strong><br>
1. Selecciona <strong>Transferencia</strong>.<br>
2. Realiza el deposito o transferencia a la cuenta indicada.<br>
3. Sube el comprobante y agrega numero de referencia.<br>
4. Nuestro equipo valida y confirma por WhatsApp.<br><br>`;
    }

    if (asksCash) {
        response += `<strong>Efectivo:</strong><br>
La cita queda registrada y pagas el dia de la atencion en consultorio.<br><br>`;
    }

    if (asksInvoice) {
        response += `<strong>Facturacion:</strong><br>
Comparte tus datos de facturacion (cedula/RUC y correo) y te ayudamos por WhatsApp.<br><br>`;
    }

    response += `<strong>4) Confirmacion</strong><br>
Tu cita queda registrada y te contactamos para confirmar detalles por WhatsApp: <a href="https://wa.me/593982453672" target="_blank" rel="noopener noreferrer">098 245 3672</a>.<br><br>

Si quieres, te guio ahora mismo segun el metodo que prefieras: <strong>tarjeta</strong>, <strong>transferencia</strong> o <strong>efectivo</strong>.`;

    return response;
}

function isClinicScopeIntent(text) {
    const normalized = normalizeIntentText(text);
    if (!normalized) return true;

    const clinicScopePattern =
        /(piel|dermat|acne|grano|espinilla|mancha|lesion|consulta|cita|agendar|reservar|turno|doctor|dra|dr|rosero|narvaez|quito|ubicacion|direccion|horario|precio|costo|tarifa|pago|pagar|transferencia|efectivo|tarjeta|whatsapp|telefono|telemedicina|video|laser|rejuvenecimiento|cancer|consultorio|servicio|tratamiento)/;
    return clinicScopePattern.test(normalized);
}

function isOutOfScopeIntent(text) {
    const normalized = normalizeIntentText(text);
    if (!normalized) return false;

    if (
        /^(hola|buenos dias|buenas tardes|buenas noches|hi|hello|gracias|adios|bye|ok|vale)$/.test(
            normalized
        )
    ) {
        return false;
    }

    if (isClinicScopeIntent(normalized)) {
        return false;
    }

    return /(capital|presidente|deporte|futbol|partido|clima|temperatura|noticia|historia|geografia|matematica|programacion|codigo|traduce|traducir|pelicula|musica|bitcoin|criptomoneda|politica)/.test(
        normalized
    );
}

function isGenericAssistantReply(text) {
    const normalized = normalizeIntentText(text);
    if (!normalized) return true;

    const genericPatterns = [
        /gracias por tu mensaje/,
        /puedo ayudarte con piel en armonia/,
        /soy figo/,
        /asistente virtual/,
        /modo offline/,
        /te sugiero/,
        /para informacion mas detallada/,
        /escribenos por whatsapp/,
        /visita estas secciones/,
        /hay algo mas en lo que pueda orientarte/,
        /si prefieres atencion inmediata/,
        /te guio paso a paso/,
        /sobre ".*", te guio paso a paso/,
        /estoy teniendo problemas tecnicos/,
        /contactanos directamente por whatsapp/,
        /te atenderemos personalmente/,
    ];

    let matches = 0;
    for (const pattern of genericPatterns) {
        if (pattern.test(normalized)) matches += 1;
    }

    return matches >= 2;
}

function shouldRefineWithFigo(botResponse) {
    return isGenericAssistantReply(botResponse);
}

const SYSTEM_PROMPT = `Eres el Dr. Virtual, asistente inteligente de la clinica dermatologica "Piel en Armonia" en Quito, Ecuador.

INFORMACION DE LA CLINICA:
- Nombre: Piel en Armonia
- Doctores: Dr. Javier Rosero (Dermatologo Clinico) y Dra. Carolina Narvaez (Dermatologa Estetica)
- Direccion: Valparaiso 13-183 y Sodiro, Consultorio Dr. Celio Caiza, Quito (Frente al Colegio de las Mercedarias, a 2 cuadras de la Maternidad Isidro Ayora)
- Telefono/WhatsApp: 098 245 3672
- Contacto Dra. Carolina: 098 786 6885 | caro93narvaez@gmail.com
- Horario: Lunes-Viernes 9:00-18:00, Sabados 9:00-13:00
- Estacionamiento privado disponible

SERVICIOS Y PRECIOS (con IVA 15%):
- Consulta Dermatológica: $46
- Consulta Telefónica: $28.75
- Video Consulta: $34.50
- Tratamiento Láser: desde $172.50
- Rejuvenecimiento: desde $138
- Tratamiento de Acné: desde $80
- Detección de Cáncer de Piel: desde $70

OPCIONES DE CONSULTA ONLINE:
1. Llamada telefonica: tel:+593982453672
2. WhatsApp Video: https://wa.me/593982453672
3. Video Web (Jitsi): https://meet.jit.si/PielEnArmonia-Consulta

INSTRUCCIONES:
- Se profesional, amable y empatico
- Responde en espanol (o en el idioma que use el paciente)
- Si el paciente tiene sintomas graves o emergencias, recomienda acudir a urgencias
- Para agendar citas, dirige al formulario web, WhatsApp o llamada telefonica
- Si no sabes algo especifico, ofrece transferir al doctor real
- No hagas diagnosticos medicos definitivos, solo orientacion general
- Usa emojis ocasionalmente para ser amigable
- Manten respuestas concisas pero informativas

Tu objetivo es ayudar a los pacientes a:
1. Conocer los servicios de la clinica
2. Entender los precios
3. Agendar citas
4. Resolver dudas basicas sobre dermatologia
5. Conectar con un doctor real cuando sea necesario`;

const FIGO_EXPERT_PROMPT = `MODO FIGO PRO:
- Responde con pasos claros y accionables, no con texto general.
- Si preguntan por pagos, explica el flujo real del sitio: reservar cita -> modal de pago -> metodo (tarjeta/transferencia/efectivo) -> confirmacion.
- Si faltan datos para ayudar mejor, haz una sola pregunta de seguimiento concreta.
- Mantente enfocado en Piel en Armonía (servicios, precios, citas, pagos, ubicación y contacto).
- Si preguntan temas fuera de la clínica (capitales, noticias, deportes o cultura general), explica que solo atiendes temas de Piel en Armonía y redirige a servicios/citas.
- Evita decir "modo offline" salvo que realmente no haya conexion con el servidor.`;

function buildAppointmentContextSummary() {
    currentAppointment = getCurrentAppointmentSafe();
    if (!currentAppointment) return 'sin cita activa';

    const parts = [];
    if (currentAppointment.service)
        parts.push(`servicio=${currentAppointment.service}`);
    if (currentAppointment.doctor)
        parts.push(`doctor=${currentAppointment.doctor}`);
    if (currentAppointment.date) parts.push(`fecha=${currentAppointment.date}`);
    if (currentAppointment.time) parts.push(`hora=${currentAppointment.time}`);
    if (currentAppointment.price)
        parts.push(`precio=${currentAppointment.price}`);

    return parts.length ? parts.join(', ') : 'sin datos relevantes';
}

function getChatRuntimeContext() {
    const section = window.location.hash || '#inicio';
    const paymentModalOpen =
        !!document
            .getElementById('v5-payment-modal')
            ?.classList.contains('active') ||
        !!document.getElementById('paymentModal')?.classList.contains('active');
    const appointmentSummary = buildAppointmentContextSummary();

    return `CONTEXTO WEB EN TIEMPO REAL:
- Seccion actual: ${section}
- Modal de pago abierto: ${paymentModalOpen ? 'si' : 'no'}
- Cita en progreso: ${appointmentSummary}

FLUJO DE PAGO REAL DEL SITIO:
1) El paciente completa el formulario de cita.
2) Se abre el modal de pago automaticamente.
3) Puede elegir tarjeta, transferencia o efectivo.
4) Al confirmar, la cita se registra y el equipo valida por WhatsApp.`;
}

function buildFigoMessages() {
    conversationContext = getConversationContextSafe();
    return [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'system', content: FIGO_EXPERT_PROMPT },
        { role: 'system', content: getChatRuntimeContext() },
        ...conversationContext.slice(-6),
    ];
}

async function requestFigoCompletion(
    messages,
    overrides = {},
    debugLabel = 'principal'
) {
    const overrideSource =
        typeof overrides.source === 'string' ? overrides.source.trim() : '';
    const depSource =
        deps && typeof deps.chatSource === 'string'
            ? deps.chatSource.trim()
            : '';
    const source = overrideSource || depSource;
    const payload = {
        model: KIMI_CONFIG.model,
        messages: messages,
        max_tokens: KIMI_CONFIG.maxTokens,
        temperature: KIMI_CONFIG.temperature,
        ...overrides,
    };
    if (source) {
        payload.source = source;
    }

    const controller = new AbortController();
    const timeoutMs = 9000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    let response;
    try {
        response = await fetch(KIMI_CONFIG.apiUrl + '?t=' + Date.now(), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                'Cache-Control': 'no-cache',
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
        });
    } catch (error) {
        if (error && error.name === 'AbortError') {
            throw new Error('TIMEOUT');
        }
        throw error;
    } finally {
        clearTimeout(timeoutId);
    }

    debugLog(`?? Status (${debugLabel}):`, response.status);

    const responseText = await response.text();
    debugLog(
        `?? Respuesta cruda (${debugLabel}):`,
        responseText.substring(0, 500)
    );

    let data;
    try {
        data = responseText ? JSON.parse(responseText) : {};
    } catch (e) {
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        debugLog('Error parseando JSON:', e);
        throw new Error('Respuesta no es JSON valido');
    }

    if (data && typeof data === 'object' && data.mode === 'queued') {
        return {
            content: '',
            mode: 'queued',
            source: typeof data.source === 'string' ? data.source : '',
            reason: typeof data.reason === 'string' ? data.reason : '',
            configured: data.configured !== false,
            recursiveConfigDetected: data.recursiveConfigDetected === true,
            upstreamStatus: Number.isFinite(data.upstreamStatus)
                ? Number(data.upstreamStatus)
                : 0,
            queued: true,
            provider:
                typeof data.provider === 'string'
                    ? data.provider
                    : 'openclaw_queue',
            jobId: typeof data.jobId === 'string' ? data.jobId : '',
            pollUrl: typeof data.pollUrl === 'string' ? data.pollUrl : '',
            pollAfterMs: Number.isFinite(data.pollAfterMs)
                ? Number(data.pollAfterMs)
                : 1500,
        };
    }

    if (!response.ok || data.ok === false) {
        const reasonHint =
            data && typeof data.reason === 'string' && data.reason
                ? ` (${data.reason})`
                : '';
        throw createFigoError(`HTTP ${response.status}${reasonHint}`, {
            provider:
                data && typeof data.provider === 'string' ? data.provider : '',
            code:
                data && typeof data.errorCode === 'string'
                    ? data.errorCode
                    : '',
            noLocalFallback:
                data &&
                typeof data.provider === 'string' &&
                data.provider === 'openclaw_queue',
        });
    }

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        debugLog('Estructura invalida:', data);
        throw new Error('Respuesta invalida');
    }

    return {
        content: data.choices[0].message.content || '',
        mode: typeof data.mode === 'string' ? data.mode : '',
        source: typeof data.source === 'string' ? data.source : '',
        reason: typeof data.reason === 'string' ? data.reason : '',
        configured: data.configured !== false,
        recursiveConfigDetected: data.recursiveConfigDetected === true,
        upstreamStatus: Number.isFinite(data.upstreamStatus)
            ? Number(data.upstreamStatus)
            : 0,
        queued: false,
        provider: typeof data.provider === 'string' ? data.provider : '',
        jobId: typeof data.jobId === 'string' ? data.jobId : '',
        pollUrl: typeof data.pollUrl === 'string' ? data.pollUrl : '',
        pollAfterMs: Number.isFinite(data.pollAfterMs)
            ? Number(data.pollAfterMs)
            : 1500,
    };
}

async function waitForQueuedCompletion(initialReply) {
    const jobId = String(initialReply?.jobId || '').trim();
    if (!jobId) {
        throw createFigoError('queue_missing_job_id', {
            code: 'queue_missing_job_id',
            noLocalFallback: true,
            provider: 'openclaw_queue',
        });
    }

    const pollAfterMs = Math.max(
        500,
        Math.min(5000, Number(initialReply?.pollAfterMs || 1500))
    );
    const rawPollUrl = String(initialReply?.pollUrl || '').trim();
    const pollUrl = rawPollUrl
        ? rawPollUrl
        : `/check-ai-response.php?jobId=${encodeURIComponent(jobId)}`;
    const deadline = Date.now() + OPENCLAW_POLL_MAX_MS;

    let firstPoll = true;
    while (Date.now() < deadline) {
        if (!firstPoll) {
            await new Promise((resolve) => setTimeout(resolve, pollAfterMs));
        }
        firstPoll = false;
        const pollTickUrl = pollUrl.includes('?')
            ? `${pollUrl}&t=${Date.now()}`
            : `${pollUrl}?t=${Date.now()}`;

        let response;
        try {
            response = await fetch(pollTickUrl, {
                method: 'GET',
                headers: {
                    Accept: 'application/json',
                    'Cache-Control': 'no-cache',
                },
            });
        } catch (networkError) {
            throw createFigoError('queue_poll_network', {
                code: 'queue_poll_network',
                noLocalFallback: true,
                provider: 'openclaw_queue',
                cause: networkError,
            });
        }

        let data;
        try {
            data = await response.json();
        } catch (parseError) {
            throw createFigoError('queue_poll_invalid_json', {
                code: 'queue_poll_invalid_json',
                noLocalFallback: true,
                provider: 'openclaw_queue',
                cause: parseError,
            });
        }

        const status = String(data?.status || '').toLowerCase();
        if (status === 'queued' || status === 'processing') {
            continue;
        }

        if (status === 'completed') {
            const completion = data?.completion;
            const content = String(
                completion?.choices?.[0]?.message?.content || ''
            ).trim();
            if (!content) {
                throw createFigoError('queue_completed_without_content', {
                    code: 'queue_completed_without_content',
                    noLocalFallback: true,
                    provider: 'openclaw_queue',
                });
            }

            return {
                content,
                mode: 'live',
                source: 'openclaw_queue',
                reason: '',
                configured: true,
                recursiveConfigDetected: false,
                upstreamStatus: 200,
                queued: false,
                provider: 'openclaw_queue',
                jobId,
                pollUrl,
                pollAfterMs,
            };
        }

        throw createFigoError('queue_failed', {
            code:
                typeof data?.errorCode === 'string'
                    ? data.errorCode
                    : 'queue_failed',
            noLocalFallback: true,
            provider: 'openclaw_queue',
            message:
                typeof data?.errorMessage === 'string'
                    ? data.errorMessage
                    : 'No se pudo completar la respuesta de Figo',
        });
    }

    throw createFigoError('queue_timeout', {
        code: 'queue_timeout',
        noLocalFallback: true,
        provider: 'openclaw_queue',
    });
}

async function tryRealAI(message) {
    try {
        // Limpiar duplicados del contexto antes de enviar
        conversationContext = getConversationContextSafe();
        const uniqueContext = [];
        for (const msg of conversationContext) {
            const last = uniqueContext[uniqueContext.length - 1];
            if (
                !last ||
                last.role !== msg.role ||
                last.content !== msg.content
            ) {
                uniqueContext.push(msg);
            }
        }
        setConversationContextSafe(uniqueContext);
        if (conversationContext.length > CHAT_CONTEXT_MAX_ITEMS) {
            setConversationContextSafe(
                conversationContext.slice(-CHAT_CONTEXT_MAX_ITEMS)
            );
        }

        // Preparar mensajes para la API
        const messages = buildFigoMessages();

        debugLog('?? Enviando a:', KIMI_CONFIG.apiUrl);
        debugLog('?? Contexto actual:', conversationContext.length, 'mensajes');
        let primaryReply = await requestFigoCompletion(
            messages,
            {},
            'principal'
        );

        if (primaryReply.queued === true) {
            debugLog(
                'Respuesta en cola detectada. jobId:',
                primaryReply.jobId || 'n/a'
            );
            primaryReply = await waitForQueuedCompletion(primaryReply);
        }

        let botResponse = String(primaryReply.content || '').trim();
        if (!botResponse) {
            throw new Error('Respuesta vacia del backend de chat');
        }
        debugLog('Respuesta recibida:', botResponse.substring(0, 100) + '...');
        if (
            primaryReply.mode === 'degraded' ||
            primaryReply.source === 'fallback'
        ) {
            debugLog(
                'Figo en modo degradado:',
                primaryReply.reason || 'sin motivo'
            );
        }

        const canRefine =
            primaryReply.mode === 'live' && primaryReply.source !== 'fallback';
        if (canRefine && shouldRefineWithFigo(botResponse)) {
            debugLog(
                'Respuesta generica detectada, solicitando precision adicional a Figo'
            );

            const precisionPrompt = `Tu respuesta anterior fue demasiado general.
Responde con información específica para la web de Piel en Armonía.
Incluye pasos concretos y el siguiente paso recomendado para el paciente.
Pregunta original del paciente: "${message}"`;

            const refinedMessages = [
                ...messages,
                { role: 'assistant', content: botResponse },
                { role: 'user', content: precisionPrompt },
            ];

            try {
                const refinedResponse = await requestFigoCompletion(
                    refinedMessages,
                    { temperature: 0.3 },
                    'refinada'
                );

                const refinedText = String(
                    refinedResponse?.content || ''
                ).trim();
                if (refinedText && !isGenericAssistantReply(refinedText)) {
                    botResponse = refinedText;
                    debugLog('? Respuesta refinada aplicada');
                }
            } catch (refineError) {
                debugLog('No se pudo refinar con Figo:', refineError);
            }

            if (isGenericAssistantReply(botResponse)) {
                debugLog(
                    'Respuesta sigue generica, usando fallback local especializado'
                );
                removeTypingIndicator();
                processLocalResponse(message, false);
                return;
            }
        }

        // Evitar duplicados: verificar si el último mensaje ya es del asistente con el mismo contenido
        const lastMsg = conversationContext[conversationContext.length - 1];
        if (
            !lastMsg ||
            lastMsg.role !== 'assistant' ||
            lastMsg.content !== botResponse
        ) {
            const nextContext = conversationContext.concat({
                role: 'assistant',
                content: botResponse,
            });
            if (nextContext.length > CHAT_CONTEXT_MAX_ITEMS) {
                setConversationContextSafe(
                    nextContext.slice(-CHAT_CONTEXT_MAX_ITEMS)
                );
            } else {
                setConversationContextSafe(nextContext);
            }
        }

        removeTypingIndicator();
        addBotMessage(formatMarkdown(botResponse), false);
        debugLog('?? Mensaje mostrado en chat');
    } catch (error) {
        debugLog('Error con bot del servidor:', error);
        removeTypingIndicator();
        if (isOpenClawQueueError(error)) {
            showOpenClawUnavailableMessage(error?.code || error?.message || '');
            return;
        }
        processLocalResponse(message, false);
    }
}

// ========================================
// SISTEMA DE RESPUESTAS LOCALES (FALLBACK)
// ========================================
function processLocalResponse(message, isOffline = true) {
    const normalizedMsg = normalizeIntentText(message);

    // Comando especial: forzar IA
    if (/forzar ia|activar ia|modo ia|usar ia/.test(normalizedMsg)) {
        forzarModoIA();
        return;
    }

    // Comando especial: debug info
    if (/debug|info sistema|informacion tecnica/.test(normalizedMsg)) {
        mostrarInfoDebug();
        return;
    }

    // Intentar detectar intención y dar respuesta local
    let response;

    // AYUDA / MENU
    if (/ayuda|help|menu|opciones|que puedes hacer/.test(normalizedMsg)) {
        response = 'Opciones disponibles:<br><br>';
        response +=
            '<strong>Servicios:</strong> Información sobre consultas<br>';
        response += '<strong>Precios:</strong> Tarifas de servicios<br>';
        response += '<strong>Citas:</strong> Como agendar<br>';
        response += '<strong>Ubicación:</strong> Dirección y horarios<br>';
        response += '<strong>Contacto:</strong> WhatsApp y teléfono';
    }
    // FUERA DE ALCANCE
    else if (isOutOfScopeIntent(normalizedMsg)) {
        response = `Puedo ayudarte solo con temas de <strong>Piel en Armonía</strong>.<br><br>
Puedes consultarme sobre:<br>
- Servicios y tratamientos dermatologicos<br>
- Precios y formas de pago<br>
- Agenda de citas y horarios<br>
- Ubicacion y contacto<br><br>
Si quieres, te llevo directo a <a href="#v5-booking" data-action="minimize-chat">Reservar Cita</a> o te conecto por <a href="https://wa.me/593982453672" target="_blank" rel="noopener noreferrer">WhatsApp</a>.`;
        addBotMessage(response, isOffline);
        return;
    }
    // SALUDO
    else if (
        /hola|buenos dias|buenas tardes|buenas noches|hey|hi|hello/.test(
            normalizedMsg
        )
    ) {
        response =
            '¡Hola! Soy <strong>Figo</strong>, asistente de <strong>Piel en Armonía</strong>.<br><br>';
        response += 'Puedo ayudarte con:<br>';
        response += '• Servicios dermatologicos<br>';
        response += '• Precios de tratamientos<br>';
        response += '• Agendar citas<br>';
        response += '• Ubicacion y horarios<br><br>';
        response += '¿En que puedo ayudarte?';
    }
    // SERVICIOS
    else if (
        /servicio|tratamiento|hacen|ofrecen|que hacen/.test(normalizedMsg)
    ) {
        response = 'Servicios dermatológicos:<br><br>';
        response += '<strong>Consultas:</strong><br>';
        response += '• Presencial: $46<br>';
        response += '• Telefónica: $28.75<br>';
        response += '• Video: $34.50<br><br>';
        response += '<strong>Tratamientos:</strong><br>';
        response += '• Acné: desde $80<br>';
        response += '• Láser: desde $172.50<br>';
        response += '• Rejuvenecimiento: desde $138<br>';
        response += '• Detección de cáncer de piel: desde $70';
    }
    // PRECIOS
    else if (/precio|cuanto cuesta|valor|tarifa|costo/.test(normalizedMsg)) {
        response = 'Precios (incluyen IVA 15%):<br><br>';
        response += '<strong>Consultas:</strong><br>';
        response += '• Presencial: $46<br>';
        response += '• Telefónica: $28.75<br>';
        response += '• Video: $34.50<br><br>';
        response += '<strong>Tratamientos (desde):</strong><br>';
        response += '• Acné: $80<br>';
        response += '• Láser: $172.50<br>';
        response += '• Rejuvenecimiento: $138<br><br>';
        response += 'Para presupuesto preciso, agenda una consulta.';
    }
    // PAGOS
    else if (isPaymentIntent(normalizedMsg)) {
        response = buildPaymentGuidance(normalizedMsg);
    }
    // HANDOFF / HUMAN
    else if (
        /hablar con|humano|persona real|doctor real|agente/.test(normalizedMsg)
    ) {
        response = `Entiendo que prefieres hablar con una persona. ?????<br><br>
Puedes chatear directamente con nuestro equipo humano por WhatsApp aquí:<br><br>
?? <a href="https://wa.me/593982453672" target="_blank" rel="noopener noreferrer">Abrir Chat de WhatsApp</a><br><br>
O llámanos al +593 98 245 3672.`;
    }
    // CITAS - iniciar booking conversacional
    else if (/cita|agendar|reservar|turno|hora/.test(normalizedMsg)) {
        startChatBooking();
        return;
    }
    // ACNÉ
    else if (/acne|grano|espinilla|barro/.test(normalizedMsg)) {
        response =
            'El acne es muy comun y tenemos soluciones efectivas.<br><br>';
        response += 'Nuestro enfoque:<br>';
        response += '• Evaluacion personalizada<br>';
        response += '• Tratamientos topicos<br>';
        response += '• Medicacion oral si es necesario<br>';
        response += '• Peelings quimicos<br>';
        response += '• Laser para cicatrices<br><br>';
        response += 'Primera consulta: $40<br><br>';
        response += '¿Te gustaria agendar?';
    }
    // LASER
    else if (/laser/.test(normalizedMsg)) {
        response = 'Tecnologia laser de ultima generacion.<br><br>';
        response += 'Tratamientos:<br>';
        response += '• Eliminacion de lesiones vasculares<br>';
        response += '• Tratamiento de manchas<br>';
        response += '• Rejuvenecimiento facial<br>';
        response += '• Cicatrices de acne<br><br>';
        response += 'Precio: Desde $150<br><br>';
        response += 'Se requiere consulta de evaluaci\u00f3n previa.<br>';
        response += '¿Deseas agendar?';
    }
    // UBICACION
    else if (/donde|ubicacion|direccion|lugar|mapa|quito/.test(normalizedMsg)) {
        response = '<strong>Ubicacion:</strong><br>';
        response += `${CLINIC_ADDRESS}<br>`;
        response += '<br>';
        response += '<strong>Horario:</strong><br>';
        response += 'Lunes - Viernes: 9:00 - 18:00<br>';
        response += 'Sabados: 9:00 - 13:00<br><br>';
        response +=
            '<strong>Estacionamiento:</strong> Privado disponible<br><br>';
        response += `<strong>Mapa:</strong> <a href="${CLINIC_MAP_URL}" target="_blank" rel="noopener noreferrer">Abrir en Google Maps</a><br>`;
        response += '<strong>Contacto:</strong> 098 245 3672';
    }
    // DOCTORES
    else if (
        /doctor|medico|especialista|rosero|narvaez|dr|dra/.test(normalizedMsg)
    ) {
        response = `Contamos con dos excelentes especialistas:

<strong>Dr. Javier Rosero</strong>
Dermatólogo Clínico
15 años de experiencia
Especialista en detección temprana de cáncer de piel

<strong>Dra. Carolina Narvaez</strong>
Dermatóloga Estética
Especialista en rejuvenecimiento facial y láser
Contacto directo: ${DOCTOR_CAROLINA_PHONE} | ${DOCTOR_CAROLINA_EMAIL}

Ambos están disponibles para consulta presencial y online.

¿Con quién te gustaría agendar?`;
    }
    // TELEMEDICINA
    else if (
        /online|virtual|video|remota|telemedicina|whatsapp|llamada/.test(
            normalizedMsg
        )
    ) {
        response = `Ofrecemos 3 opciones de consulta remota:

<strong>?? 1. Llamada Telefónica - $25</strong>
Ideal para consultas rápidas y seguimientos

<strong>?? 2. WhatsApp Video - $30</strong>
Videollamada por WhatsApp, muy fácil de usar

<strong>3. Video Web (Jitsi) - $30</strong>
No necesitas instalar nada, funciona en el navegador

Todas incluyen:
? Evaluación médica completa
? Receta digital
? Recomendaciones personalizadas
? Seguimiento por WhatsApp

¿Cuál prefieres?`;
    }
    // DESPEDIDA
    else if (/gracias|thank|adios|chao|hasta luego|bye/.test(normalizedMsg)) {
        response = `¡De nada! ??

Si tienes más dudas, no dudes en escribirme. También puedes contactarnos directamente:

?? WhatsApp: 098 245 3672
?? Teléfono: 098 245 3672

¡Que tengas un excelente día!`;
    }
    // RESPUESTA POR DEFECTO
    else {
        response = `Puedo ayudarte mejor si eliges una opcion:<br><br>
1) <strong>Servicios y precios</strong><br>
2) <strong>Reservar cita</strong><br>
3) <strong>Pagos</strong><br><br>
Tambien puedes ir directo:<br>
- <a href="#servicios" data-action="minimize-chat">Servicios</a><br>
- <a href="#v5-booking" data-action="minimize-chat">Reservar Cita</a><br>
- <a href="https://wa.me/593982453672" target="_blank" rel="noopener noreferrer">WhatsApp 098 245 3672</a>`;
    }

    addBotMessage(response, isOffline);
}

function formatMarkdown(text) {
    // Convertir markdown básico a HTML
    let html = text
        // Negritas
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        // Cursiva
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        // Links
        .replace(
            /\[(.+?)\]\((.+?)\)/g,
            '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
        )
        // Saltos de línea
        .replace(/\n/g, '<br>');

    return html;
}

// ========================================
// UTILIDADES DEL CHATBOT
// ========================================
function resetConversation() {
    setConversationContextSafe([]);
    localStorage.removeItem('chatHistory');
    setChatHistorySafe([]);
    showToast('Conversacion reiniciada', 'info');
}

function checkServerEnvironment() {
    if (window.location.protocol === 'file:') {
        setTimeout(() => {
            showToast(
                'Para usar funciones online, abre el sitio en un servidor local. Ver SERVIDOR-LOCAL.md',
                'warning',
                'Servidor requerido'
            );
        }, 2000);
        return false;
    }
    return true;
}

function forzarModoIA() {
    localStorage.setItem('forceAI', 'true');
    showToast('Modo IA activado manualmente', 'success');

    chatHistory = getChatHistorySafe();
    if (chatHistory.length > 0) {
        addBotMessage(
            '<strong>Modo IA activado</strong><br>Intentare usar inteligencia artificial real en los proximos mensajes.'
        );
    }
}

function mostrarInfoDebug() {
    const usaIA = shouldUseRealAI();
    const protocolo = window.location.protocol;
    const hostname = window.location.hostname;
    const forzado = localStorage.getItem('forceAI') === 'true';

    let msg = '<strong>Información del sistema:</strong><br><br>';
    msg += 'Protocolo: ' + protocolo + '<br>';
    msg += 'Hostname: ' + hostname + '<br>';
    msg += 'Usa IA: ' + (usaIA ? 'SI' : 'NO') + '<br>';
    msg += 'Forzado: ' + (forzado ? 'SI' : 'NO') + '<br><br>';
    msg += 'Endpoint: ' + KIMI_CONFIG.apiUrl;

    addBotMessage(msg);
}

if (typeof window !== 'undefined') {
    window.Piel = window.Piel || {};
    window.Piel.FigoChatEngine = {
        init,
        processWithKimi,
        resetConversation,
        checkServerEnvironment,
        forzarModoIA,
        mostrarInfoDebug,
    };
}

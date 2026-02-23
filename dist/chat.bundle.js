const KIMI_CONFIG = {
    apiUrl: '/figo-chat.php',
    model: 'figo-assistant',
    maxTokens: 1000,
    temperature: 0.7,
};
const CHAT_CONTEXT_MAX_ITEMS = 24;
const OPENCLAW_POLL_MAX_MS = 30000;

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

// Helper functions
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
    const asksCard = /(tarjeta|visa|mastercard|debito|credito|stripe)/.test(normalizedMsg);
    const asksTransfer = /(transferencia|deposito|comprobante|referencia|banco)/.test(normalizedMsg);
    const asksCash = /(efectivo|consultorio|presencial)/.test(normalizedMsg);
    const asksInvoice = /(factura|facturacion|ruc|cedula)/.test(normalizedMsg);

    let response = `Asi puedes realizar tu pago en la web:<br><br>
<strong>1) Reserva tu cita</strong><br>
Ve a <a href="#citas" data-action="minimize-chat">Reservar Cita</a>, completa tus datos y selecciona fecha/hora.<br><br>

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
    const clinicScopePattern = /(piel|dermat|acne|grano|espinilla|mancha|lesion|consulta|cita|agendar|reservar|turno|doctor|dra|dr|rosero|narvaez|quito|ubicacion|direccion|horario|precio|costo|tarifa|pago|pagar|transferencia|efectivo|tarjeta|whatsapp|telefono|telemedicina|video|laser|rejuvenecimiento|cancer|consultorio|servicio|tratamiento)/;
    return clinicScopePattern.test(normalized);
}

function isOutOfScopeIntent(text) {
    const normalized = normalizeIntentText(text);
    if (!normalized) return false;
    if (/^(hola|buenos dias|buenas tardes|buenas noches|hi|hello|gracias|adios|bye|ok|vale)$/.test(normalized)) {
        return false;
    }
    if (isClinicScopeIntent(normalized)) {
        return false;
    }
    return /(capital|presidente|deporte|futbol|partido|clima|temperatura|noticia|historia|geografia|matematica|programacion|codigo|traduce|traducir|pelicula|musica|bitcoin|criptomoneda|politica)/.test(normalized);
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
    if (typeof error.provider === 'string' && error.provider === 'openclaw_queue') {
        return true;
    }
    if (typeof error.code === 'string') {
        return /^(queue_|gateway_|provider_mode_disabled)/.test(error.code);
    }
    return false;
}

function formatMarkdown(text) {
    let html = text
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(
            /\[(.+?)\]\((.+?)\)/g,
            '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
        )
        .replace(/\n/g, '<br>');
    return html;
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

class ChatEngine {
    constructor() {
        this.deps = null;
        this.conversationContext = [];
        this.chatHistory = [];
        this.currentAppointment = null;
        this.clinicAddress = 'Dr. Cecilio Caiza e hijas, Quito, Ecuador';
        this.clinicMapUrl = '';
        this.doctorPhone = '+593 98 786 6885';
        this.doctorEmail = 'caro93narvaez@gmail.com';
        this.isProcessingMessage = false;
    }

    init(inputDeps = {}) {
        this.deps = inputDeps || {};
        this.conversationContext = this.getConversationContextSafe();
        this.chatHistory = this.getChatHistorySafe();
        this.currentAppointment = this.getCurrentAppointmentSafe();

        const clinicAddress = String(this.deps.clinicAddress || '').trim();
        const clinicMapUrl = String(this.deps.clinicMapUrl || '').trim();
        const doctorPhone = String(this.deps.doctorCarolinaPhone || '').trim();
        const doctorEmail = String(this.deps.doctorCarolinaEmail || '').trim();

        if (clinicAddress) this.clinicAddress = clinicAddress;
        if (clinicMapUrl) this.clinicMapUrl = clinicMapUrl;
        if (doctorPhone) this.doctorPhone = doctorPhone;
        if (doctorEmail) this.doctorEmail = doctorEmail;

        return this;
    }

    debugLog(...args) {
        if (this.deps && typeof this.deps.debugLog === 'function') {
            this.deps.debugLog(...args);
        }
    }

    showTypingIndicator() {
        if (this.deps && typeof this.deps.showTypingIndicator === 'function') {
            this.deps.showTypingIndicator();
        }
    }

    removeTypingIndicator() {
        if (this.deps && typeof this.deps.removeTypingIndicator === 'function') {
            this.deps.removeTypingIndicator();
        }
    }

    addBotMessage(content, showOfflineLabel = false) {
        if (this.deps && typeof this.deps.addBotMessage === 'function') {
            this.deps.addBotMessage(content, showOfflineLabel);
        }
    }

    startChatBooking() {
        if (this.deps && typeof this.deps.startChatBooking === 'function') {
            this.deps.startChatBooking();
        }
    }

    processChatBookingStep(message) {
        if (this.deps && typeof this.deps.processChatBookingStep === 'function') {
            return this.deps.processChatBookingStep(message);
        }
        return Promise.resolve(false);
    }

    isChatBookingActive() {
        if (this.deps && typeof this.deps.isChatBookingActive === 'function') {
            return this.deps.isChatBookingActive() === true;
        }
        return false;
    }

    showToast(message, type = 'info', title = '') {
        if (this.deps && typeof this.deps.showToast === 'function') {
            this.deps.showToast(message, type, title);
        }
    }

    getConversationContextSafe() {
        if (this.deps && typeof this.deps.getConversationContext === 'function') {
            const value = this.deps.getConversationContext();
            return Array.isArray(value) ? value.slice() : [];
        }
        return Array.isArray(this.conversationContext) ? this.conversationContext.slice() : [];
    }

    setConversationContextSafe(nextContext) {
        this.conversationContext = Array.isArray(nextContext) ? nextContext.slice() : [];
        if (this.deps && typeof this.deps.setConversationContext === 'function') {
            this.deps.setConversationContext(this.conversationContext.slice());
        }
    }

    getChatHistorySafe() {
        if (this.deps && typeof this.deps.getChatHistory === 'function') {
            const value = this.deps.getChatHistory();
            return Array.isArray(value) ? value.slice() : [];
        }
        return Array.isArray(this.chatHistory) ? this.chatHistory.slice() : [];
    }

    setChatHistorySafe(nextHistory) {
        this.chatHistory = Array.isArray(nextHistory) ? nextHistory.slice() : [];
        if (this.deps && typeof this.deps.setChatHistory === 'function') {
            this.deps.setChatHistory(this.chatHistory.slice());
        }
    }

    getCurrentAppointmentSafe() {
        if (this.deps && typeof this.deps.getCurrentAppointment === 'function') {
            const appointment = this.deps.getCurrentAppointment();
            return appointment && typeof appointment === 'object'
                ? appointment
                : null;
        }
        return this.currentAppointment && typeof this.currentAppointment === 'object'
            ? this.currentAppointment
            : null;
    }

    showOpenClawUnavailableMessage(reason = '') {
        const hint = reason
            ? `<br><small>Detalle técnico: ${String(reason)}</small>`
            : '';

        this.addBotMessage(
            `El asistente Figo no está disponible por unos minutos.${hint}<br><br>
Puedes continuar por <a href="https://wa.me/593982453672" target="_blank" rel="noopener noreferrer">WhatsApp +593 98 245 3672</a> para atención inmediata.`,
            false
        );
    }

    async processWithKimi(message) {
        if (this.isProcessingMessage) {
            this.debugLog('Ya procesando, ignorando duplicado');
            return;
        }

        if (this.isChatBookingActive()) {
            const handled = await this.processChatBookingStep(message);
            if (handled !== false) {
                return;
            }
        }

        if (/cita|agendar|reservar|turno|quiero una consulta|necesito cita/i.test(message)) {
            this.startChatBooking();
            return;
        }

        this.isProcessingMessage = true;
        this.showTypingIndicator();

        if (isOutOfScopeIntent(message)) {
            this.removeTypingIndicator();
            this.addBotMessage(
                `Puedo ayudarte con temas de <strong>Piel en Armonía</strong> (servicios, precios, citas, pagos, horarios y ubicación).<br><br>Si deseas, te ayudo ahora con:<br>- <a href="#servicios" data-action="minimize-chat">Servicios y tratamientos</a><br>- <a href="#citas" data-action="minimize-chat">Reservar cita</a><br>- <a href="https://wa.me/593982453672" target="_blank" rel="noopener noreferrer">WhatsApp directo</a>`,
                false
            );
            this.isProcessingMessage = false;
            return;
        }

        this.debugLog('Procesando mensaje:', message);

        try {
            if (shouldUseRealAI()) {
                this.debugLog('?? Consultando bot del servidor...');
                await this.tryRealAI(message);
            } else {
                this.debugLog('?? Usando respuestas locales (modo offline)');
                setTimeout(() => {
                    this.removeTypingIndicator();
                    this.processLocalResponse(message, false);
                }, 600);
            }
        } catch (error) {
            this.debugLog('Error:', error);
            this.removeTypingIndicator();
            this.processLocalResponse(message, false);
        } finally {
            this.isProcessingMessage = false;
        }
    }

    buildAppointmentContextSummary() {
        this.currentAppointment = this.getCurrentAppointmentSafe();
        if (!this.currentAppointment) return 'sin cita activa';

        const parts = [];
        if (this.currentAppointment.service)
            parts.push(`servicio=${this.currentAppointment.service}`);
        if (this.currentAppointment.doctor)
            parts.push(`doctor=${this.currentAppointment.doctor}`);
        if (this.currentAppointment.date)
            parts.push(`fecha=${this.currentAppointment.date}`);
        if (this.currentAppointment.time)
            parts.push(`hora=${this.currentAppointment.time}`);
        if (this.currentAppointment.price)
            parts.push(`precio=${this.currentAppointment.price}`);

        return parts.length ? parts.join(', ') : 'sin datos relevantes';
    }

    getChatRuntimeContext() {
        const section = window.location.hash || '#inicio';
        const paymentModalOpen = !!document
            .getElementById('paymentModal')
            ?.classList.contains('active');
        const appointmentSummary = this.buildAppointmentContextSummary();

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

    buildFigoMessages() {
        this.conversationContext = this.getConversationContextSafe();
        return [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'system', content: FIGO_EXPERT_PROMPT },
            { role: 'system', content: this.getChatRuntimeContext() },
            ...this.conversationContext.slice(-10),
        ];
    }

    async requestFigoCompletion(messages, overrides = {}, debugLabel = 'principal') {
        const payload = {
            model: KIMI_CONFIG.model,
            messages: messages,
            max_tokens: KIMI_CONFIG.maxTokens,
            temperature: KIMI_CONFIG.temperature,
            ...overrides,
        };

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

        this.debugLog(`?? Status (${debugLabel}):`, response.status);

        const responseText = await response.text();
        this.debugLog(
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
            this.debugLog('Error parseando JSON:', e);
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
                    data && typeof data.provider === 'string'
                        ? data.provider
                        : '',
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
            this.debugLog('Estructura invalida:', data);
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
            provider:
                typeof data.provider === 'string'
                    ? data.provider
                    : '',
            jobId: typeof data.jobId === 'string' ? data.jobId : '',
            pollUrl: typeof data.pollUrl === 'string' ? data.pollUrl : '',
            pollAfterMs: Number.isFinite(data.pollAfterMs)
                ? Number(data.pollAfterMs)
                : 1500,
        };
    }

    async waitForQueuedCompletion(initialReply) {
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

    async tryRealAI(message) {
        try {
            this.conversationContext = this.getConversationContextSafe();
            const uniqueContext = [];
            for (const msg of this.conversationContext) {
                const last = uniqueContext[uniqueContext.length - 1];
                if (
                    !last ||
                    last.role !== msg.role ||
                    last.content !== msg.content
                ) {
                    uniqueContext.push(msg);
                }
            }
            this.setConversationContextSafe(uniqueContext);
            if (this.conversationContext.length > CHAT_CONTEXT_MAX_ITEMS) {
                this.setConversationContextSafe(
                    this.conversationContext.slice(-CHAT_CONTEXT_MAX_ITEMS)
                );
            }

            const messages = this.buildFigoMessages();

            this.debugLog('?? Enviando a:', KIMI_CONFIG.apiUrl);
            this.debugLog(
                '?? Contexto actual:',
                this.conversationContext.length,
                'mensajes'
            );
            let primaryReply = await this.requestFigoCompletion(
                messages,
                {},
                'principal'
            );

            if (primaryReply.queued === true) {
                this.debugLog(
                    'Respuesta en cola detectada. jobId:',
                    primaryReply.jobId || 'n/a'
                );
                primaryReply = await this.waitForQueuedCompletion(primaryReply);
            }

            let botResponse = String(primaryReply.content || '').trim();
            if (!botResponse) {
                throw new Error('Respuesta vacia del backend de chat');
            }
            this.debugLog(
                'Respuesta recibida:',
                botResponse.substring(0, 100) + '...'
            );
            if (
                primaryReply.mode === 'degraded' ||
                primaryReply.source === 'fallback'
            ) {
                this.debugLog(
                    'Figo en modo degradado:',
                    primaryReply.reason || 'sin motivo'
                );
            }

            const canRefine =
                primaryReply.mode === 'live' &&
                primaryReply.source !== 'fallback';
            if (canRefine && shouldRefineWithFigo(botResponse)) {
                this.debugLog(
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
                    const refinedResponse = await this.requestFigoCompletion(
                        refinedMessages,
                        { temperature: 0.3 },
                        'refinada'
                    );

                    const refinedText = String(
                        refinedResponse?.content || ''
                    ).trim();
                    if (refinedText && !isGenericAssistantReply(refinedText)) {
                        botResponse = refinedText;
                        this.debugLog('? Respuesta refinada aplicada');
                    }
                } catch (refineError) {
                    this.debugLog('No se pudo refinar con Figo:', refineError);
                }

                if (isGenericAssistantReply(botResponse)) {
                    this.debugLog(
                        'Respuesta sigue generica, usando fallback local especializado'
                    );
                    this.removeTypingIndicator();
                    this.processLocalResponse(message, false);
                    return;
                }
            }

            const lastMsg = this.conversationContext[this.conversationContext.length - 1];
            if (
                !lastMsg ||
                lastMsg.role !== 'assistant' ||
                lastMsg.content !== botResponse
            ) {
                const nextContext = this.conversationContext.concat({
                    role: 'assistant',
                    content: botResponse,
                });
                if (nextContext.length > CHAT_CONTEXT_MAX_ITEMS) {
                    this.setConversationContextSafe(
                        nextContext.slice(-CHAT_CONTEXT_MAX_ITEMS)
                    );
                } else {
                    this.setConversationContextSafe(nextContext);
                }
            }

            this.removeTypingIndicator();
            this.addBotMessage(formatMarkdown(botResponse), false);
            this.debugLog('?? Mensaje mostrado en chat');
        } catch (error) {
            this.debugLog('Error con bot del servidor:', error);
            this.removeTypingIndicator();
            if (isOpenClawQueueError(error)) {
                this.showOpenClawUnavailableMessage(error?.code || error?.message || '');
                return;
            }
            this.processLocalResponse(message, false);
        }
    }

    processLocalResponse(message, isOffline = true) {
        const normalizedMsg = normalizeIntentText(message);

        if (/forzar ia|activar ia|modo ia|usar ia/.test(normalizedMsg)) {
            this.forzarModoIA();
            return;
        }

        if (/debug|info sistema|informacion tecnica/.test(normalizedMsg)) {
            this.mostrarInfoDebug();
            return;
        }

        let response;

        if (/ayuda|help|menu|opciones|que puedes hacer/.test(normalizedMsg)) {
            response = 'Opciones disponibles:<br><br>';
            response += '<strong>Servicios:</strong> Información sobre consultas<br>';
            response += '<strong>Precios:</strong> Tarifas de servicios<br>';
            response += '<strong>Citas:</strong> Como agendar<br>';
            response += '<strong>Ubicación:</strong> Dirección y horarios<br>';
            response += '<strong>Contacto:</strong> WhatsApp y teléfono';
        }
        else if (isOutOfScopeIntent(normalizedMsg)) {
            response = `Puedo ayudarte solo con temas de <strong>Piel en Armonía</strong>.<br><br>
Puedes consultarme sobre:<br>
- Servicios y tratamientos dermatologicos<br>
- Precios y formas de pago<br>
- Agenda de citas y horarios<br>
- Ubicacion y contacto<br><br>
Si quieres, te llevo directo a <a href="#citas" data-action="minimize-chat">Reservar Cita</a> o te conecto por <a href="https://wa.me/593982453672" target="_blank" rel="noopener noreferrer">WhatsApp</a>.`;
            this.addBotMessage(response, isOffline);
            return;
        }
        else if (/hola|buenos dias|buenas tardes|buenas noches|hey|hi|hello/.test(normalizedMsg)) {
            response = '¡Hola! Soy <strong>Figo</strong>, asistente de <strong>Piel en Armonía</strong>.<br><br>';
            response += 'Puedo ayudarte con:<br>';
            response += '• Servicios dermatologicos<br>';
            response += '• Precios de tratamientos<br>';
            response += '• Agendar citas<br>';
            response += '• Ubicacion y horarios<br><br>';
            response += '¿En que puedo ayudarte?';
        }
        else if (/servicio|tratamiento|hacen|ofrecen|que hacen/.test(normalizedMsg)) {
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
        else if (isPaymentIntent(normalizedMsg)) {
            response = buildPaymentGuidance(normalizedMsg);
        }
        else if (/hablar con|humano|persona real|doctor real|agente/.test(normalizedMsg)) {
            response = `Entiendo que prefieres hablar con una persona. ?????<br><br>
Puedes chatear directamente con nuestro equipo humano por WhatsApp aquí:<br><br>
?? <a href="https://wa.me/593982453672" target="_blank" rel="noopener noreferrer">Abrir Chat de WhatsApp</a><br><br>
O llámanos al +593 98 245 3672.`;
        }
        else if (/cita|agendar|reservar|turno|hora/.test(normalizedMsg)) {
            this.startChatBooking();
            return;
        }
        else if (/acne|grano|espinilla|barro/.test(normalizedMsg)) {
            response = 'El acne es muy comun y tenemos soluciones efectivas.<br><br>';
            response += 'Nuestro enfoque:<br>';
            response += '• Evaluacion personalizada<br>';
            response += '• Tratamientos topicos<br>';
            response += '• Medicacion oral si es necesario<br>';
            response += '• Peelings quimicos<br>';
            response += '• Laser para cicatrices<br><br>';
            response += 'Primera consulta: $40<br><br>';
            response += '¿Te gustaria agendar?';
        }
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
        else if (/donde|ubicacion|direccion|lugar|mapa|quito/.test(normalizedMsg)) {
            response = '<strong>Ubicacion:</strong><br>';
            response += `${this.clinicAddress}<br>`;
            response += '<br>';
            response += '<strong>Horario:</strong><br>';
            response += 'Lunes - Viernes: 9:00 - 18:00<br>';
            response += 'Sabados: 9:00 - 13:00<br><br>';
            response += '<strong>Estacionamiento:</strong> Privado disponible<br><br>';
            response += `<strong>Mapa:</strong> <a href="${this.clinicMapUrl}" target="_blank" rel="noopener noreferrer">Abrir en Google Maps</a><br>`;
            response += '<strong>Contacto:</strong> 098 245 3672';
        }
        else if (/doctor|medico|especialista|rosero|narvaez|dr|dra/.test(normalizedMsg)) {
            response = `Contamos con dos excelentes especialistas:

<strong>Dr. Javier Rosero</strong>
Dermatólogo Clínico
15 años de experiencia
Especialista en detección temprana de cáncer de piel

<strong>Dra. Carolina Narvaez</strong>
Dermatóloga Estética
Especialista en rejuvenecimiento facial y láser
Contacto directo: ${this.doctorPhone} | ${this.doctorEmail}

Ambos están disponibles para consulta presencial y online.

¿Con quién te gustaría agendar?`;
        }
        else if (/online|virtual|video|remota|telemedicina|whatsapp|llamada/.test(normalizedMsg)) {
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
        else if (/gracias|thank|adios|chao|hasta luego|bye/.test(normalizedMsg)) {
            response = `¡De nada! ??

Si tienes más dudas, no dudes en escribirme. También puedes contactarnos directamente:

?? WhatsApp: 098 245 3672
?? Teléfono: 098 245 3672

¡Que tengas un excelente día!`;
        }
        else {
            response = `Puedo ayudarte mejor si eliges una opcion:<br><br>
1) <strong>Servicios y precios</strong><br>
2) <strong>Reservar cita</strong><br>
3) <strong>Pagos</strong><br><br>
Tambien puedes ir directo:<br>
- <a href="#servicios" data-action="minimize-chat">Servicios</a><br>
- <a href="#citas" data-action="minimize-chat">Reservar Cita</a><br>
- <a href="https://wa.me/593982453672" target="_blank" rel="noopener noreferrer">WhatsApp 098 245 3672</a>`;
        }

        this.addBotMessage(response, isOffline);
    }

    resetConversation() {
        this.setConversationContextSafe([]);
        localStorage.removeItem('chatHistory');
        this.setChatHistorySafe([]);
        this.showToast('Conversacion reiniciada', 'info');
    }

    checkServerEnvironment() {
        if (window.location.protocol === 'file:') {
            setTimeout(() => {
                this.showToast(
                    'Para usar funciones online, abre el sitio en un servidor local. Ver SERVIDOR-LOCAL.md',
                    'warning',
                    'Servidor requerido'
                );
            }, 2000);
            return false;
        }
        return true;
    }

    forzarModoIA() {
        localStorage.setItem('forceAI', 'true');
        this.showToast('Modo IA activado manualmente', 'success');

        this.chatHistory = this.getChatHistorySafe();
        if (this.chatHistory.length > 0) {
            this.addBotMessage(
                '<strong>Modo IA activado</strong><br>Intentare usar inteligencia artificial real en los proximos mensajes.'
            );
        }
    }

    mostrarInfoDebug() {
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

        this.addBotMessage(msg);
    }
}

const QUICK_MESSAGES = {
    services: 'Que servicios ofrecen?',
    prices: 'Cuales son los precios?',
    telemedicine: 'Como funciona la consulta online?',
    human: 'Quiero hablar con un doctor real',
    acne: 'Tengo problemas de acne',
    laser: 'Informacion sobre tratamientos laser',
    location: 'Donde estan ubicados?',
};

class ChatWidgetEngine {
    constructor() {
        this.deps = null;
        this.chatStartedTracked = false;
    }

    init(inputDeps = {}) {
        this.deps = inputDeps || {};
        return this;
    }

    getChatbotOpen() {
        if (this.deps && typeof this.deps.getChatbotOpen === 'function') {
            return this.deps.getChatbotOpen() === true;
        }
        return false;
    }

    setChatbotOpen(isOpen) {
        if (this.deps && typeof this.deps.setChatbotOpen === 'function') {
            this.deps.setChatbotOpen(isOpen === true);
        }
    }

    getChatHistoryLength() {
        if (this.deps && typeof this.deps.getChatHistoryLength === 'function') {
            return Number(this.deps.getChatHistoryLength()) || 0;
        }
        return 0;
    }

    warmChatUi() {
        if (this.deps && typeof this.deps.warmChatUi === 'function') {
            this.deps.warmChatUi();
        }
    }

    scrollToBottomSafe() {
        if (this.deps && typeof this.deps.scrollToBottom === 'function') {
            this.deps.scrollToBottom();
        }
    }

    trackEventSafe(eventName, payload) {
        if (this.deps && typeof this.deps.trackEvent === 'function') {
            this.deps.trackEvent(eventName, payload || {});
        }
    }

    ensureChatStartedTracked(source) {
        if (this.chatStartedTracked) {
            return;
        }

        this.chatStartedTracked = true;
        this.trackEventSafe('chat_started', {
            source: source || 'widget',
        });
    }

    debugLogSafe(...args) {
        if (this.deps && typeof this.deps.debugLog === 'function') {
            this.deps.debugLog(...args);
        }
    }

    addBotMessageSafe(html) {
        if (this.deps && typeof this.deps.addBotMessage === 'function') {
            this.deps.addBotMessage(html);
        }
    }

    addUserMessageSafe(text) {
        if (this.deps && typeof this.deps.addUserMessage === 'function') {
            return this.deps.addUserMessage(text);
        }
        return undefined;
    }

    processWithKimiSafe(text) {
        if (this.deps && typeof this.deps.processWithKimi === 'function') {
            return this.deps.processWithKimi(text);
        }
        return Promise.resolve();
    }

    startChatBookingSafe() {
        if (this.deps && typeof this.deps.startChatBooking === 'function') {
            this.deps.startChatBooking();
        }
    }

    shouldUseRealAI() {
        if (localStorage.getItem('forceAI') === 'true') {
            return true;
        }
        if (typeof window !== 'undefined') {
            return window.location.protocol !== 'file:';
        }
        return false;
    }

    buildWelcomeMessage(usingRealAI) {
        let message =
            'Hola! Soy el <strong>Dr. Virtual</strong> de <strong>Piel en Armonia</strong>.<br><br>';

        if (usingRealAI) {
            message +=
                '<strong>Conectado con Inteligencia Artificial</strong><br><br>';
            message += 'Puedo ayudarte con informacion detallada sobre:<br>';
            message += '- Nuestros servicios dermatologicos<br>';
            message += '- Precios de consultas y tratamientos<br>';
            message += '- Agendar citas presenciales o online<br>';
            message += '- Ubicacion y horarios de atencion<br>';
            message += '- Resolver tus dudas sobre cuidado de la piel<br><br>';
        } else {
            message += 'Puedo ayudarte con informacion sobre:<br>';
            message += '- Nuestros servicios dermatologicos<br>';
            message += '- Precios de consultas y tratamientos<br>';
            message += '- Agendar citas presenciales o online<br>';
            message += '- Ubicacion y horarios de atencion<br><br>';
        }

        message += 'En que puedo ayudarte hoy?';
        return message;
    }

    renderQuickSuggestions() {
        setTimeout(() => {
            let quickOptions = '<div class="chat-suggestions">';
            quickOptions +=
                '<button class="chat-suggestion-btn" data-action="quick-message" data-value="services">';
            quickOptions += '<i class="fas fa-stethoscope"></i> Ver servicios';
            quickOptions += '</button>';
            quickOptions +=
                '<button class="chat-suggestion-btn" data-action="quick-message" data-value="appointment">';
            quickOptions +=
                '<i class="fas fa-calendar-check"></i> Agendar cita';
            quickOptions += '</button>';
            quickOptions +=
                '<button class="chat-suggestion-btn" data-action="quick-message" data-value="prices">';
            quickOptions += '<i class="fas fa-tag"></i> Consultar precios';
            quickOptions += '</button>';
            quickOptions += '</div>';

            this.addBotMessageSafe(quickOptions);
        }, 500);
    }

    toggleChatbot() {
        if (typeof document === 'undefined') return;
        const container = document.getElementById('chatbotContainer');
        if (!container) {
            return;
        }

        this.warmChatUi();

        const nextOpen = !this.getChatbotOpen();
        this.setChatbotOpen(nextOpen);

        if (!nextOpen) {
            container.classList.remove('active');
            return;
        }

        container.classList.add('active');
        this.hideTeaser();

        const notification = document.getElementById('chatNotification');
        if (notification) {
            notification.style.display = 'none';
        }

        this.scrollToBottomSafe();

        this.ensureChatStartedTracked('widget_open');

        if (this.getChatHistoryLength() > 0) {
            return;
        }

        const usingRealAI = this.shouldUseRealAI();
        this.debugLogSafe(
            'Estado del chatbot:',
            usingRealAI ? 'IA REAL' : 'Respuestas locales'
        );
        this.addBotMessageSafe(this.buildWelcomeMessage(usingRealAI));
        this.renderQuickSuggestions();
    }

    minimizeChatbot() {
        if (typeof document === 'undefined') return;
        const container = document.getElementById('chatbotContainer');
        if (container) {
            container.classList.remove('active');
        }
        this.setChatbotOpen(false);
    }

    handleChatKeypress(event) {
        if (event && event.key === 'Enter') {
            this.sendChatMessage();
        }
    }

    async sendChatMessage() {
        if (typeof document === 'undefined') return;
        const input = document.getElementById('chatInput');
        if (!input) {
            return;
        }

        const message = String(input.value || '').trim();
        if (!message) {
            return;
        }

        this.ensureChatStartedTracked('first_message');

        await Promise.resolve(this.addUserMessageSafe(message)).catch(
            () => undefined
        );
        input.value = '';
        await Promise.resolve(this.processWithKimiSafe(message)).catch(
            () => undefined
        );
    }

    sendQuickMessage(type) {
        this.ensureChatStartedTracked('quick_message');

        if (type === 'appointment') {
            Promise.resolve(
                this.addUserMessageSafe('Quiero agendar una cita')
            ).catch(() => undefined);
            this.startChatBookingSafe();
            return;
        }

        const message = QUICK_MESSAGES[type] || type;
        Promise.resolve(this.addUserMessageSafe(message)).catch(() => undefined);
        Promise.resolve(this.processWithKimiSafe(message)).catch(() => undefined);
    }

    showTeaser() {
        if (typeof document === 'undefined') return;
        const teaser = document.getElementById('chatTeaser');
        if (teaser) {
            teaser.classList.add('show');
        }
    }

    hideTeaser() {
        if (typeof document === 'undefined') return;
        const teaser = document.getElementById('chatTeaser');
        if (teaser) {
            teaser.classList.remove('show');
        }
    }

    scheduleInitialNotification(delayMs) {
        const delay = Number(delayMs);
        const safeDelay = Number.isFinite(delay) && delay >= 0 ? delay : 8000;

        setTimeout(() => {
            const notification = document.getElementById('chatNotification');

            const isOpen = this.getChatbotOpen();
            const historyLength = this.getChatHistoryLength();

            if (!isOpen && historyLength === 0) {
                if (notification) {
                    notification.style.display = 'flex';
                }
                this.showTeaser();
            }
        }, safeDelay);
    }
}

class ChatUIEngine {
    constructor() {
        this.deps = null;
    }

    init(inputDeps = {}) {
        this.deps = inputDeps || {};
        return this;
    }

    getChatHistory() {
        if (this.deps && typeof this.deps.getChatHistory === 'function') {
            return this.deps.getChatHistory();
        }
        return [];
    }

    setChatHistory(nextHistory) {
        if (this.deps && typeof this.deps.setChatHistory === 'function') {
            this.deps.setChatHistory(nextHistory);
        }
    }

    getConversationContext() {
        if (this.deps && typeof this.deps.getConversationContext === 'function') {
            const context = this.deps.getConversationContext();
            return Array.isArray(context) ? context : [];
        }
        return [];
    }

    setConversationContext(nextContext) {
        if (this.deps && typeof this.deps.setConversationContext === 'function') {
            this.deps.setConversationContext(nextContext);
        }
    }

    getHistoryStorageKey() {
        if (
            this.deps &&
            typeof this.deps.historyStorageKey === 'string' &&
            this.deps.historyStorageKey
        ) {
            return this.deps.historyStorageKey;
        }
        return 'chatHistory';
    }

    getHistoryTtlMs() {
        const ttl = Number(this.deps && this.deps.historyTtlMs);
        return Number.isFinite(ttl) && ttl > 0 ? ttl : 24 * 60 * 60 * 1000;
    }

    getHistoryMaxItems() {
        const max = Number(this.deps && this.deps.historyMaxItems);
        return Number.isFinite(max) && max > 0 ? Math.floor(max) : 50;
    }

    getContextMaxItems() {
        const max = Number(this.deps && this.deps.contextMaxItems);
        return Number.isFinite(max) && max > 0 ? Math.floor(max) : 24;
    }

    pruneChatHistory(entries) {
        if (!Array.isArray(entries) || entries.length === 0) {
            return [];
        }

        const cutoff = Date.now() - this.getHistoryTtlMs();
        const filtered = entries.filter((entry) => {
            if (!entry || typeof entry !== 'object') {
                return false;
            }
            const ts = entry.time ? new Date(entry.time).getTime() : Number.NaN;
            return Number.isFinite(ts) && ts > cutoff;
        });

        const maxItems = this.getHistoryMaxItems();
        if (filtered.length <= maxItems) {
            return filtered;
        }

        return filtered.slice(-maxItems);
    }

    persistChatHistory() {
        try {
            localStorage.setItem(
                this.getHistoryStorageKey(),
                JSON.stringify(this.getChatHistory())
            );
        } catch {
            // noop
        }
    }

    appendConversationContext(role, content) {
        const normalizedRole = String(role || '').trim();
        const normalizedContent = String(content || '').trim();
        if (!normalizedRole || !normalizedContent) {
            return;
        }

        const context = this.getConversationContext().slice();
        const last = context[context.length - 1];
        if (
            last &&
            last.role === normalizedRole &&
            last.content === normalizedContent
        ) {
            return;
        }

        context.push({
            role: normalizedRole,
            content: normalizedContent,
        });

        const maxItems = this.getContextMaxItems();
        const nextContext =
            context.length > maxItems ? context.slice(-maxItems) : context;
        this.setConversationContext(nextContext);
    }

    debugLogSafe(...args) {
        if (this.deps && typeof this.deps.debugLog === 'function') {
            this.deps.debugLog(...args);
        }
    }

    escapeHtml(text) {
        if (this.deps && typeof this.deps.escapeHtml === 'function') {
            return this.deps.escapeHtml(text);
        }
        if (typeof document !== 'undefined') {
            const div = document.createElement('div');
            div.textContent = String(text || '');
            return div.innerHTML;
        }
        return String(text || '');
    }

    sanitizeBotHtml(html) {
        const allowed = [
            'b',
            'strong',
            'i',
            'em',
            'br',
            'p',
            'ul',
            'ol',
            'li',
            'a',
            'div',
            'button',
            'input',
            'span',
            'small',
        ];
        const allowedAttrs = {
            a: ['href', 'target', 'rel'],
            button: ['class', 'data-action'],
            div: ['class'],
            input: ['type', 'id', 'min', 'value', 'class'],
            i: ['class'],
            span: ['class'],
            small: ['class'],
        };

        const safeHtml = String(html || '')
            .replace(
                /onclick="handleChatBookingSelection\('([^']+)'\)"/g,
                'data-action="chat-booking" data-value="$1"'
            )
            .replace(
                /onclick="sendQuickMessage\('([^']+)'\)"/g,
                'data-action="quick-message" data-value="$1"'
            )
            .replace(
                /onclick="handleChatDateSelect\(this\.value\)"/g,
                'data-action="chat-date-select"'
            )
            .replace(
                /onclick="minimizeChatbot\(\)"/g,
                'data-action="minimize-chat"'
            )
            .replace(
                /onclick="startChatBooking\(\)"/g,
                'data-action="start-booking"'
            );

        if (typeof document === 'undefined') return safeHtml;

        const container = document.createElement('div');
        container.innerHTML = safeHtml;
        container
            .querySelectorAll('script, style, iframe, object, embed')
            .forEach((el) => el.remove());
        container.querySelectorAll('*').forEach((el) => {
            const tag = el.tagName.toLowerCase();
            if (!allowed.includes(tag)) {
                el.replaceWith(document.createTextNode(el.textContent || ''));
                return;
            }

            const keep = (allowedAttrs[tag] || []).concat([
                'data-action',
                'data-value',
            ]);
            Array.from(el.attributes).forEach((attr) => {
                if (!keep.includes(attr.name)) {
                    el.removeAttribute(attr.name);
                }
            });

            if (tag === 'a') {
                const href = el.getAttribute('href') || '';
                if (!/^https?:\/\/|^#/.test(href)) {
                    el.removeAttribute('href');
                }
                if (href.startsWith('http')) {
                    el.setAttribute('target', '_blank');
                    el.setAttribute('rel', 'noopener noreferrer');
                }
            }

            Array.from(el.attributes).forEach((attr) => {
                if (attr.name.startsWith('on')) {
                    el.removeAttribute(attr.name);
                }
            });
        });

        return container.innerHTML;
    }

    scrollToBottom() {
        if (typeof document === 'undefined') return;
        const container = document.getElementById('chatMessages');
        if (!container) return;
        container.scrollTop = container.scrollHeight;
    }

    addUserMessage(text) {
        if (typeof document === 'undefined') return;
        const messagesContainer = document.getElementById('chatMessages');
        if (!messagesContainer) {
            return;
        }

        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message user';
        messageDiv.innerHTML = `
            <div class="message-avatar"><i class="fas fa-user"></i></div>
            <div class="message-content"><p>${this.escapeHtml(text)}</p></div>
        `;
        messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();

        const entry = { type: 'user', text, time: new Date().toISOString() };
        const nextHistory = this.pruneChatHistory(this.getChatHistory().concat(entry));
        this.setChatHistory(nextHistory);
        this.persistChatHistory();
        this.appendConversationContext('user', text);
    }

    addBotMessage(html, showOfflineLabel) {
        if (typeof document === 'undefined') return;
        const messagesContainer = document.getElementById('chatMessages');
        if (!messagesContainer) {
            return;
        }

        const safeHtml = this.sanitizeBotHtml(html);
        const lastMessage = messagesContainer.querySelector(
            '.chat-message.bot:last-child'
        );
        if (lastMessage) {
            const lastContent = lastMessage.querySelector('.message-content');
            if (lastContent && lastContent.innerHTML === safeHtml) {
                this.debugLogSafe('Mensaje duplicado detectado, no se muestra');
                return;
            }
        }

        const offlineIndicator = showOfflineLabel
            ? '<div class="chatbot-offline-badge"><i class="fas fa-robot"></i> Asistente Virtual</div>'
            : '';

        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message bot';
        messageDiv.innerHTML = `
            <div class="message-avatar"><i class="fas fa-user-md"></i></div>
            <div class="message-content">${offlineIndicator}${safeHtml}</div>
        `;
        messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();

        const entry = {
            type: 'bot',
            text: safeHtml,
            time: new Date().toISOString(),
        };
        const nextHistory = this.pruneChatHistory(this.getChatHistory().concat(entry));
        this.setChatHistory(nextHistory);
        this.persistChatHistory();
    }

    showTypingIndicator() {
        if (typeof document === 'undefined') return;
        const messagesContainer = document.getElementById('chatMessages');
        if (!messagesContainer || document.getElementById('typingIndicator')) {
            return;
        }

        const typingDiv = document.createElement('div');
        typingDiv.className = 'chat-message bot typing';
        typingDiv.id = 'typingIndicator';
        typingDiv.innerHTML = `
            <div class="message-avatar"><i class="fas fa-user-md"></i></div>
            <div class="typing-indicator">
                <span></span><span></span><span></span>
            </div>
        `;
        messagesContainer.appendChild(typingDiv);
        this.scrollToBottom();
    }

    removeTypingIndicator() {
        if (typeof document === 'undefined') return;
        const typing = document.getElementById('typingIndicator');
        if (typing) {
            typing.remove();
        }
    }
}

const CHAT_SERVICES = [
    { key: 'consulta', label: 'Consulta Presencial', price: '$46.00' },
    { key: 'telefono', label: 'Consulta Telefónica', price: '$28.75' },
    { key: 'video', label: 'Video Consulta', price: '$34.50' },
    { key: 'laser', label: 'Tratamiento Láser', price: '$172.50' },
    {
        key: 'rejuvenecimiento',
        label: 'Rejuvenecimiento',
        price: '$138.00',
    },
];
const CHAT_DOCTORS = [
    { key: 'rosero', label: 'Dr. Javier Rosero' },
    { key: 'narvaez', label: 'Dra. Carolina Narvaez' },
    { key: 'indiferente', label: 'Cualquiera disponible' },
];

class ChatBookingEngine {
    constructor() {
        this.deps = null;
        this.chatBooking = null;
    }

    init(inputDeps = {}) {
        this.deps = inputDeps || {};
        return this;
    }

    isActive() {
        return this.chatBooking !== null;
    }

    getLang() {
        return this.deps && typeof this.deps.getCurrentLang === 'function'
            ? this.deps.getCurrentLang()
            : 'es';
    }

    t(esText, enText) {
        return this.getLang() === 'en' ? enText : esText;
    }

    escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    sanitizeBookingRegistrationError(rawMessage) {
        const message = String(rawMessage || '').trim();
        if (!message) {
            return this.t(
                'Hubo un problema tecnico temporal al registrar la cita',
                'There was a temporary technical issue while registering your appointment'
            );
        }

        const technicalPatterns = [
            /call to undefined function/i,
            /fatal error/i,
            /uncaught/i,
            /stack trace/i,
            /syntax error/i,
            /on line \d+/i,
            /in \/.+\.php/i,
            /mb_strlen/i,
        ];

        if (technicalPatterns.some((pattern) => pattern.test(message))) {
            return this.t(
                'Hubo un problema tecnico temporal al registrar la cita',
                'There was a temporary technical issue while registering your appointment'
            );
        }

        return message;
    }

    isCalendarUnavailableError(error) {
        if (!error) return false;
        const code = String(error.code || '').toLowerCase();
        const message = String(error.message || '').toLowerCase();
        return (
            code === 'calendar_unreachable' ||
            code === 'calendar_auth_failed' ||
            code === 'calendar_token_rejected' ||
            message.includes('calendar_unreachable') ||
            message.includes('agenda temporalmente no disponible') ||
            message.includes('no se pudo consultar la agenda real') ||
            message.includes('google calendar no')
        );
    }

    isSlotUnavailableError(error) {
        if (!error) return false;
        const code = String(error.code || '').toLowerCase();
        const message = String(error.message || '').toLowerCase();
        return (
            code === 'slot_conflict' ||
            code === 'slot_unavailable' ||
            code === 'booking_slot_not_available' ||
            message.includes('no hay agenda disponible') ||
            message.includes('ese horario no esta disponible') ||
            message.includes('slot_conflict')
        );
    }

    buildChatDateInput() {
        const today = new Date().toISOString().split('T')[0];
        return `<input type="date" id="chatDateInput" min="${today}" data-action="chat-date-select" class="chat-date-input">`;
    }

    addBotMessage(html) {
        if (this.deps && typeof this.deps.addBotMessage === 'function') {
            this.deps.addBotMessage(html);
        }
    }

    addUserMessage(text) {
        if (this.deps && typeof this.deps.addUserMessage === 'function') {
            this.deps.addUserMessage(text);
        }
    }

    normalizeSelectionLabel(rawValue) {
        const value = String(rawValue || '');
        const service = CHAT_SERVICES.find((item) => item.key === value);
        if (service) return service.label;
        const doctor = CHAT_DOCTORS.find((item) => item.key === value);
        if (doctor) return doctor.label;
        if (value === 'efectivo' || value === 'cash') return 'Efectivo';
        if (value === 'tarjeta' || value === 'card') return 'Tarjeta';
        if (value === 'transferencia' || value === 'transfer')
            return 'Transferencia';
        return value;
    }

    trackChatBookingStep(step, payload = {}, options = {}) {
        if (
            !this.deps ||
            typeof this.deps.trackEvent !== 'function' ||
            !this.chatBooking ||
            !step
        ) {
            return;
        }

        const once = options && options.once !== false;
        if (once) {
            if (!this.chatBooking.completedSteps) {
                this.chatBooking.completedSteps = {};
            }
            if (this.chatBooking.completedSteps[step]) {
                return;
            }
            this.chatBooking.completedSteps[step] = true;
        }

        this.deps.trackEvent('booking_step_completed', {
            step,
            source: 'chatbot',
            ...payload,
        });
    }

    startChatBooking() {
        this.chatBooking = { step: 'service', completedSteps: {} };
        if (this.deps && typeof this.deps.trackEvent === 'function') {
            this.deps.trackEvent('booking_step_completed', {
                step: 'chat_booking_started',
                source: 'chatbot',
            });
        }
        let msg = this.t(
            'Vamos a agendar tu cita paso a paso.<br><br><strong>Paso 1/7:</strong> ¿Que servicio necesitas?<br><br>',
            'Let us schedule your appointment step by step.<br><br><strong>Step 1/7:</strong> Which service do you need?<br><br>'
        );
        msg += '<div class="chat-suggestions">';
        CHAT_SERVICES.forEach((service) => {
            msg += `<button class="chat-suggestion-btn" data-action="chat-booking" data-value="${service.key}">${this.escapeHtml(service.label)} (${service.price})</button>`;
        });
        msg += '</div>';
        this.addBotMessage(msg);
    }

    cancelChatBooking(silent = false) {
        if (this.chatBooking && this.deps && typeof this.deps.trackEvent === 'function') {
            this.deps.trackEvent('checkout_abandon', {
                source: 'chatbot',
                reason: 'chat_cancel',
                step: this.chatBooking.step || 'unknown',
            });
        }
        this.chatBooking = null;
        if (!silent) {
            this.addBotMessage(
                this.t(
                    'Reserva cancelada. Si necesitas algo mas, estoy aqui para ayudarte.',
                    'Booking cancelled. If you need anything else, I am here to help.'
                )
            );
        }
    }

    isGeneralIntent(text) {
        const normalized = String(text || '').toLowerCase();
        return /(precio|costo|cuanto|doctor|humano|ayuda|hablar|contactar|ubicacion|donde|horario|telefono|whatsapp)/.test(
            normalized
        );
    }

    handleChatBookingSelection(value) {
        const cleanValue = String(value || '').trim();
        if (!cleanValue) {
            return;
        }
        this.addUserMessage(this.normalizeSelectionLabel(cleanValue));
        this.processChatBookingStep(cleanValue);
    }

    handleChatDateSelect(value) {
        const cleanValue = String(value || '').trim();
        if (!cleanValue) {
            return;
        }
        this.addUserMessage(cleanValue);
        this.processChatBookingStep(cleanValue);
    }

    async processChatBookingStep(userInput) {
        if (!this.chatBooking) return false;
        const input = String(userInput || '').trim();

        if (/cancelar|salir|no quiero|cancel|exit/i.test(input)) {
            this.cancelChatBooking();
            return true;
        }

        switch (this.chatBooking.step) {
            case 'service': {
                const service = CHAT_SERVICES.find(
                    (item) =>
                        item.key === input ||
                        item.label.toLowerCase() === input.toLowerCase()
                );
                if (!service) {
                    if (this.isGeneralIntent(input)) {
                        this.cancelChatBooking(true);
                        return false;
                    }
                    this.addBotMessage(
                        this.t(
                            'Por favor selecciona un servicio valido de las opciones.',
                            'Please choose a valid service from the options.'
                        )
                    );
                    return true;
                }
                this.chatBooking.service = service.key;
                this.chatBooking.serviceLabel = service.label;
                this.chatBooking.price = service.price;
                this.chatBooking.step = 'doctor';
                this.trackChatBookingStep('service_selected', {
                    service: service.key,
                });

                let msg = `${this.t('Servicio', 'Service')}: <strong>${this.escapeHtml(service.label)}</strong> (${service.price})<br><br>`;
                msg += this.t(
                    '<strong>Paso 2/7:</strong> ¿Con que doctor prefieres?<br><br>',
                    '<strong>Step 2/7:</strong> Which doctor do you prefer?<br><br>'
                );
                msg += '<div class="chat-suggestions">';
                CHAT_DOCTORS.forEach((doctor) => {
                    msg += `<button class="chat-suggestion-btn" data-action="chat-booking" data-value="${doctor.key}">${this.escapeHtml(doctor.label)}</button>`;
                });
                msg += '</div>';
                this.addBotMessage(msg);
                break;
            }

            case 'doctor': {
                const doctor = CHAT_DOCTORS.find(
                    (item) =>
                        item.key === input ||
                        item.label.toLowerCase() === input.toLowerCase()
                );
                if (!doctor) {
                    if (this.isGeneralIntent(input)) {
                        this.cancelChatBooking(true);
                        return false;
                    }
                    this.addBotMessage(
                        this.t(
                            'Por favor selecciona un doctor de las opciones.',
                            'Please choose a doctor from the options.'
                        )
                    );
                    return true;
                }
                this.chatBooking.doctor = doctor.key;
                this.chatBooking.doctorLabel = doctor.label;
                this.chatBooking.step = 'date';
                this.trackChatBookingStep('doctor_selected', {
                    doctor: doctor.key,
                });

                const today = new Date().toISOString().split('T')[0];
                let msg = `${this.t('Doctor', 'Doctor')}: <strong>${this.escapeHtml(doctor.label)}</strong><br><br>`;
                msg += this.t(
                    '<strong>Paso 3/7:</strong> ¿Que fecha prefieres?<br><br>',
                    '<strong>Step 3/7:</strong> Which date do you prefer?<br><br>'
                );
                msg += `<input type="date" id="chatDateInput" min="${today}" `;
                msg += 'data-action="chat-date-select" ';
                msg += 'class="chat-date-input">';
                this.addBotMessage(msg);
                break;
            }

            case 'date': {
                const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
                if (!dateRegex.test(input)) {
                    this.addBotMessage(
                        this.t(
                            'Por favor selecciona una fecha valida (usa el calendario).',
                            'Please select a valid date (use the date picker).'
                        )
                    );
                    return true;
                }

                const selectedDate = new Date(`${input}T12:00:00`);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                if (selectedDate < today) {
                    this.addBotMessage(
                        this.t(
                            'La fecha debe ser hoy o en el futuro. Selecciona otra fecha.',
                            'Date must be today or in the future. Please choose another date.'
                        )
                    );
                    return true;
                }

                this.chatBooking.date = input;
                this.chatBooking.step = 'time';
                this.trackChatBookingStep('date_selected', {
                    date: input,
                });

                if (this.deps && typeof this.deps.showTypingIndicator === 'function') {
                    this.deps.showTypingIndicator();
                }

                try {
                    const availability =
                        this.deps && typeof this.deps.loadAvailabilityData === 'function'
                            ? await this.deps.loadAvailabilityData({
                                  doctor: this.chatBooking.doctor || 'indiferente',
                                  service: this.chatBooking.service || 'consulta',
                                  strict: true,
                              })
                            : {};
                    const booked =
                        this.deps && typeof this.deps.getBookedSlots === 'function'
                            ? await this.deps.getBookedSlots(
                                  input,
                                  this.chatBooking.doctor || '',
                                  this.chatBooking.service || 'consulta'
                              )
                            : [];
                    const allSlots =
                        Array.isArray(availability[input]) &&
                        availability[input].length > 0
                            ? availability[input]
                            : [];
                    const isToday =
                        input === new Date().toISOString().split('T')[0];
                    const nowMinutes = isToday
                        ? new Date().getHours() * 60 + new Date().getMinutes()
                        : -1;
                    const freeSlots = allSlots
                        .filter((slot) => {
                            if (booked.includes(slot)) return false;
                            if (isToday) {
                                const [h, m] = slot.split(':').map(Number);
                                if (h * 60 + m <= nowMinutes + 60) return false;
                            }
                            return true;
                        })
                        .sort();

                    if (
                        this.deps &&
                        typeof this.deps.removeTypingIndicator === 'function'
                    ) {
                        this.deps.removeTypingIndicator();
                    }

                    if (freeSlots.length === 0) {
                        this.addBotMessage(
                            this.t(
                                'No hay horarios disponibles para esa fecha. Por favor elige otra.<br><br>',
                                'No times are available for that date. Please choose another one.<br><br>'
                            ) +
                                `<input type="date" id="chatDateInput" min="${new Date().toISOString().split('T')[0]}" data-action="chat-date-select" class="chat-date-input">`
                        );
                        this.chatBooking.step = 'date';
                        return true;
                    }

                    const locale = this.getLang() === 'en' ? 'en-US' : 'es-EC';
                    const dateLabel = selectedDate.toLocaleDateString(locale, {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                    });
                    let msg = `${this.t('Fecha', 'Date')}: <strong>${this.escapeHtml(dateLabel)}</strong><br><br>`;
                    msg += this.t(
                        '<strong>Paso 4/7:</strong> Horarios disponibles:<br><br>',
                        '<strong>Step 4/7:</strong> Available times:<br><br>'
                    );
                    msg += '<div class="chat-suggestions">';
                    freeSlots.forEach((time) => {
                        msg += `<button class="chat-suggestion-btn" data-action="chat-booking" data-value="${time}">${time}</button>`;
                    });
                    msg += '</div>';
                    this.addBotMessage(msg);
                } catch (error) {
                    const isCalendarUnavailable = this.isCalendarUnavailableError(error);
                    if (
                        this.deps &&
                        typeof this.deps.removeTypingIndicator === 'function'
                    ) {
                        this.deps.removeTypingIndicator();
                    }
                    this.addBotMessage(
                        isCalendarUnavailable
                            ? this.t(
                                  'La agenda esta temporalmente no disponible. Intenta de nuevo en unos minutos.',
                                  'The schedule is temporarily unavailable. Please try again in a few minutes.'
                              )
                            : this.t(
                                  'No pude consultar los horarios. Intenta de nuevo.',
                                  'I could not load the schedule. Please try again.'
                              )
                    );
                    this.chatBooking.step = 'date';
                }
                break;
            }

            case 'time': {
                if (!/^\d{2}:\d{2}$/.test(input)) {
                    this.addBotMessage(
                        this.t(
                            'Por favor selecciona un horario valido de las opciones.',
                            'Please choose a valid time from the options.'
                        )
                    );
                    return true;
                }
                this.chatBooking.time = input;
                this.chatBooking.step = 'name';
                this.trackChatBookingStep('time_selected', {
                    time: input,
                });
                this.addBotMessage(
                    `${this.t('Hora', 'Time')}: <strong>${this.escapeHtml(input)}</strong><br><br>${this.t('<strong>Paso 5/7:</strong> ¿Cual es tu nombre completo?', '<strong>Step 5/7:</strong> What is your full name?')}`
                );
                break;
            }

            case 'name': {
                if (input.length < 2) {
                    this.addBotMessage(
                        this.t(
                            'El nombre debe tener al menos 2 caracteres.',
                            'Name must be at least 2 characters long.'
                        )
                    );
                    return true;
                }
                this.chatBooking.name = input;
                this.chatBooking.step = 'email';
                this.trackChatBookingStep('name_added');
                this.addBotMessage(
                    `${this.t('Nombre', 'Name')}: <strong>${this.escapeHtml(input)}</strong><br><br>${this.t('<strong>Paso 6/7:</strong> ¿Cual es tu email?', '<strong>Step 6/7:</strong> What is your email?')}`
                );
                break;
            }

            case 'email': {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(input)) {
                    this.addBotMessage(
                        this.t(
                            'El formato del email no es valido. Ejemplo: nombre@correo.com',
                            'Invalid email format. Example: name@example.com'
                        )
                    );
                    return true;
                }
                this.chatBooking.email = input;
                this.chatBooking.step = 'phone';
                this.trackChatBookingStep('email_added');
                this.addBotMessage(
                    `${this.t('Email', 'Email')}: <strong>${this.escapeHtml(input)}</strong><br><br>${this.t('<strong>Paso 7/7:</strong> ¿Cual es tu numero de telefono?', '<strong>Step 7/7:</strong> What is your phone number?')}`
                );
                break;
            }

            case 'phone': {
                const digits = input.replace(/\D/g, '');
                if (digits.length < 7 || digits.length > 15) {
                    this.addBotMessage(
                        this.t(
                            'El telefono debe tener entre 7 y 15 digitos.',
                            'Phone number must have between 7 and 15 digits.'
                        )
                    );
                    return true;
                }
                this.chatBooking.phone = input;
                this.chatBooking.step = 'payment';
                this.trackChatBookingStep('contact_info_completed');

                let msg = `${this.t('Telefono', 'Phone')}: <strong>${this.escapeHtml(input)}</strong><br><br>`;
                msg += `<strong>${this.t('Resumen de tu cita', 'Appointment summary')}:</strong><br>`;
                msg += `&bull; ${this.t('Servicio', 'Service')}: ${this.escapeHtml(this.chatBooking.serviceLabel)} (${this.chatBooking.price})<br>`;
                msg += `&bull; ${this.t('Doctor', 'Doctor')}: ${this.escapeHtml(this.chatBooking.doctorLabel)}<br>`;
                msg += `&bull; ${this.t('Fecha', 'Date')}: ${this.escapeHtml(this.chatBooking.date)}<br>`;
                msg += `&bull; ${this.t('Hora', 'Time')}: ${this.escapeHtml(this.chatBooking.time)}<br>`;
                msg += `&bull; ${this.t('Nombre', 'Name')}: ${this.escapeHtml(this.chatBooking.name)}<br>`;
                msg += `&bull; Email: ${this.escapeHtml(this.chatBooking.email)}<br>`;
                msg += `&bull; ${this.t('Telefono', 'Phone')}: ${this.escapeHtml(this.chatBooking.phone)}<br><br>`;
                msg += `${this.t('¿Como deseas pagar?', 'How would you like to pay?')}<br><br>`;
                msg += '<div class="chat-suggestions">';
                msg +=
                    '<button class="chat-suggestion-btn" data-action="chat-booking" data-value="efectivo"><i class="fas fa-money-bill-wave"></i> Efectivo</button>';
                msg +=
                    '<button class="chat-suggestion-btn" data-action="chat-booking" data-value="tarjeta"><i class="fas fa-credit-card"></i> Tarjeta</button>';
                msg +=
                    '<button class="chat-suggestion-btn" data-action="chat-booking" data-value="transferencia"><i class="fas fa-university"></i> Transferencia</button>';
                msg += '</div>';
                this.addBotMessage(msg);
                break;
            }

            case 'payment': {
                const paymentMap = {
                    efectivo: 'cash',
                    cash: 'cash',
                    tarjeta: 'card',
                    card: 'card',
                    transferencia: 'transfer',
                    transfer: 'transfer',
                };
                const method = paymentMap[input.toLowerCase()];
                if (!method) {
                    this.addBotMessage(
                        this.t(
                            'Elige un metodo de pago: Efectivo, Tarjeta o Transferencia.',
                            'Choose a payment method: Cash, Card, or Transfer.'
                        )
                    );
                    return true;
                }

                this.chatBooking.paymentMethod = method;
                this.chatBooking.step = 'confirm';
                this.trackChatBookingStep('payment_method_selected', {
                    payment_method: method,
                });
                await this.finalizeChatBooking();
                break;
            }
        }
        return true;
    }

    async finalizeChatBooking() {
        if (!this.chatBooking) return;

        const appointment = {
            service: this.chatBooking.service,
            doctor: this.chatBooking.doctor,
            date: this.chatBooking.date,
            time: this.chatBooking.time,
            name: this.chatBooking.name,
            email: this.chatBooking.email,
            phone: this.chatBooking.phone,
            privacyConsent: true,
            price: this.chatBooking.price,
        };

        if (this.deps && typeof this.deps.startCheckoutSession === 'function') {
            this.deps.startCheckoutSession(appointment, {
                checkoutEntry: 'chatbot',
                step: 'chat_booking_validated',
            });
        }
        if (this.deps && typeof this.deps.trackEvent === 'function') {
            this.deps.trackEvent('start_checkout', {
                service: appointment.service || '',
                doctor: appointment.doctor || '',
                checkout_entry: 'chatbot',
            });
            this.deps.trackEvent('payment_method_selected', {
                payment_method: this.chatBooking.paymentMethod || 'unknown',
            });
        }
        if (this.deps && typeof this.deps.setCheckoutStep === 'function') {
            this.deps.setCheckoutStep('payment_method_selected', {
                checkoutEntry: 'chatbot',
                paymentMethod: this.chatBooking.paymentMethod || 'unknown',
                service: appointment.service || '',
                doctor: appointment.doctor || '',
            });
        }

        if (this.chatBooking.paymentMethod === 'cash') {
            if (this.deps && typeof this.deps.showTypingIndicator === 'function') {
                this.deps.showTypingIndicator();
            }
            if (this.deps && typeof this.deps.setCheckoutStep === 'function') {
                this.deps.setCheckoutStep('payment_processing', {
                    checkoutEntry: 'chatbot',
                    paymentMethod: 'cash',
                });
            }

            try {
                const payload = {
                    ...appointment,
                    paymentMethod: 'cash',
                    paymentStatus: 'pending_cash',
                    status: 'confirmed',
                };
                const result =
                    this.deps && typeof this.deps.createAppointmentRecord === 'function'
                        ? await this.deps.createAppointmentRecord(payload)
                        : null;
                if (!result) {
                    throw new Error('Could not create appointment record');
                }

                if (this.deps && typeof this.deps.removeTypingIndicator === 'function') {
                    this.deps.removeTypingIndicator();
                }
                if (
                    result &&
                    typeof this.deps.setCurrentAppointment === 'function'
                ) {
                    this.deps.setCurrentAppointment(result.appointment);
                }
                if (
                    this.deps &&
                    typeof this.deps.completeCheckoutSession === 'function'
                ) {
                    this.deps.completeCheckoutSession('cash');
                }
                if (this.deps && typeof this.deps.setCheckoutStep === 'function') {
                    this.deps.setCheckoutStep('booking_confirmed', {
                        checkoutEntry: 'chatbot',
                        paymentMethod: 'cash',
                    });
                }

                let msg = `<strong>${this.t('¡Cita agendada con exito!', 'Appointment booked successfully!')}</strong><br><br>`;
                msg += this.t(
                    'Tu cita ha sido registrada. ',
                    'Your appointment has been registered. '
                );
                if (result && result.emailSent) {
                    msg += this.t(
                        'Te enviamos un correo de confirmacion.<br><br>',
                        'We sent you a confirmation email.<br><br>'
                    );
                } else {
                    msg += this.t(
                        'Te contactaremos para confirmar detalles.<br><br>',
                        'We will contact you to confirm details.<br><br>'
                    );
                }
                msg += `&bull; ${this.t('Servicio', 'Service')}: ${this.escapeHtml(this.chatBooking.serviceLabel)}<br>`;
                msg += `&bull; ${this.t('Doctor', 'Doctor')}: ${this.escapeHtml(this.chatBooking.doctorLabel)}<br>`;
                msg += `&bull; ${this.t('Fecha', 'Date')}: ${this.escapeHtml(this.chatBooking.date)}<br>`;
                msg += `&bull; ${this.t('Hora', 'Time')}: ${this.escapeHtml(this.chatBooking.time)}<br>`;
                msg += `&bull; ${this.t('Pago', 'Payment')}: ${this.t('En consultorio', 'At clinic')}<br><br>`;
                msg += this.t(
                    'Recuerda llegar 10 minutos antes de tu cita.',
                    'Please arrive 10 minutes before your appointment.'
                );
                this.addBotMessage(msg);

                if (this.deps && typeof this.deps.showToast === 'function') {
                    this.deps.showToast(
                        this.t(
                            'Cita agendada correctamente desde el asistente.',
                            'Appointment booked from chat assistant.'
                        ),
                        'success'
                    );
                }

                this.chatBooking = null;
            } catch (error) {
                if (this.deps && typeof this.deps.removeTypingIndicator === 'function') {
                    this.deps.removeTypingIndicator();
                }

                if (this.isCalendarUnavailableError(error)) {
                    this.addBotMessage(
                        this.t(
                            'La agenda esta temporalmente no disponible. Intenta de nuevo en unos minutos o agenda por WhatsApp.<br><br>',
                            'The schedule is temporarily unavailable. Please try again in a few minutes or book via WhatsApp.<br><br>'
                        ) + this.buildChatDateInput()
                    );
                    if (this.deps && typeof this.deps.setCheckoutStep === 'function') {
                        this.deps.setCheckoutStep('payment_error', {
                            checkoutEntry: 'chatbot',
                            paymentMethod: 'cash',
                            reason: 'calendar_unreachable',
                        });
                    }
                    this.chatBooking.step = 'date';
                    return;
                }

                if (this.isSlotUnavailableError(error)) {
                    this.addBotMessage(
                        this.t(
                            'Ese horario ya no esta disponible. Elige una nueva fecha u hora para continuar.<br><br>',
                            'That slot is no longer available. Please choose a new date or time to continue.<br><br>'
                        ) + this.buildChatDateInput()
                    );
                    if (this.deps && typeof this.deps.setCheckoutStep === 'function') {
                        this.deps.setCheckoutStep('payment_error', {
                            checkoutEntry: 'chatbot',
                            paymentMethod: 'cash',
                            reason: 'slot_unavailable',
                        });
                    }
                    this.chatBooking.step = 'date';
                    return;
                }

                const safeError = this.sanitizeBookingRegistrationError(
                    error && error.message ? error.message : ''
                );
                this.addBotMessage(
                    this.t(
                        `No se pudo registrar la cita: ${this.escapeHtml(safeError)}. Intenta de nuevo o agenda desde <a href="#citas" data-action="minimize-chat">el formulario</a>.`,
                        `Could not register your appointment: ${this.escapeHtml(safeError)}. Try again or use the <a href="#citas" data-action="minimize-chat">booking form</a>.`
                    )
                );
                if (this.deps && typeof this.deps.setCheckoutStep === 'function') {
                    this.deps.setCheckoutStep('payment_error', {
                        checkoutEntry: 'chatbot',
                        paymentMethod: 'cash',
                    });
                }
                this.chatBooking.step = 'payment';
            }
            return;
        }

        if (typeof this.deps.setCurrentAppointment === 'function') {
            this.deps.setCurrentAppointment(appointment);
        }
        const method = this.chatBooking.paymentMethod;
        this.chatBooking = null;

        this.addBotMessage(
            this.t(
                `Abriendo el modulo de pago por <strong>${method === 'card' ? 'tarjeta' : 'transferencia'}</strong>...<br>Completa el pago en la ventana que se abrira.`,
                `Opening payment module for <strong>${method === 'card' ? 'card' : 'transfer'}</strong>...<br>Please complete payment in the modal window.`
            )
        );

        setTimeout(() => {
            if (this.deps && typeof this.deps.minimizeChatbot === 'function') {
                this.deps.minimizeChatbot();
            }
            if (this.deps && typeof this.deps.openPaymentModal === 'function') {
                this.deps.openPaymentModal(appointment);
            }
            setTimeout(() => {
                const methodEl = document.querySelector(
                    `.payment-method[data-method="${method}"]`
                );
                if (methodEl && !methodEl.classList.contains('disabled')) {
                    methodEl.click();
                }
            }, 300);
        }, 800);
    }
}

export { ChatBookingEngine, ChatEngine, ChatUIEngine, ChatWidgetEngine };

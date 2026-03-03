!(function () {
    'use strict';
    const e = '/figo-chat.php';
    let o = null,
        r = [],
        a = [],
        n = null,
        t = 'Dr. Cecilio Caiza e hijas, Quito, Ecuador',
        i = '',
        s = '+593 98 786 6885',
        c = 'caro93narvaez@gmail.com',
        l = !1;
    function u(...e) {
        o && 'function' == typeof o.debugLog && o.debugLog(...e);
    }
    function d() {
        o &&
            'function' == typeof o.removeTypingIndicator &&
            o.removeTypingIndicator();
    }
    function p(e, r = !1) {
        o && 'function' == typeof o.addBotMessage && o.addBotMessage(e, r);
    }
    function g() {
        o && 'function' == typeof o.startChatBooking && o.startChatBooking();
    }
    function m(e, r = 'info', a = '') {
        o && 'function' == typeof o.showToast && o.showToast(e, r, a);
    }
    function f() {
        if (o && 'function' == typeof o.getConversationContext) {
            const e = o.getConversationContext();
            return Array.isArray(e) ? e.slice() : [];
        }
        return Array.isArray(r) ? r.slice() : [];
    }
    function b(e) {
        ((r = Array.isArray(e) ? e.slice() : []),
            o &&
                'function' == typeof o.setConversationContext &&
                o.setConversationContext(r.slice()));
    }
    function h() {
        if (o && 'function' == typeof o.getChatHistory) {
            const e = o.getChatHistory();
            return Array.isArray(e) ? e.slice() : [];
        }
        return Array.isArray(a) ? a.slice() : [];
    }
    function v() {
        if (o && 'function' == typeof o.getCurrentAppointment) {
            const e = o.getCurrentAppointment();
            return e && 'object' == typeof e ? e : null;
        }
        return n && 'object' == typeof n ? n : null;
    }
    function y() {
        return (
            'true' === localStorage.getItem('forceAI') ||
            'file:' !== window.location.protocol
        );
    }
    function C(e, o = {}) {
        const r = new Error(e);
        return (o && 'object' == typeof o && Object.assign(r, o), r);
    }
    function w(e) {
        return e
            ? e
                  .toString()
                  .toLowerCase()
                  .normalize('NFD')
                  .replace(/[\u0300-\u036f]/g, '')
                  .trim()
            : '';
    }
    function A(e) {
        const o = w(e);
        return (
            !!o &&
            !/^(hola|buenos dias|buenas tardes|buenas noches|hi|hello|gracias|adios|bye|ok|vale)$/.test(
                o
            ) &&
            !(function (e) {
                const o = w(e);
                return (
                    !o ||
                    /(piel|dermat|acne|grano|espinilla|mancha|lesion|consulta|cita|agendar|reservar|turno|doctor|dra|dr|rosero|narvaez|quito|ubicacion|direccion|horario|precio|costo|tarifa|pago|pagar|transferencia|efectivo|tarjeta|whatsapp|telefono|telemedicina|video|laser|rejuvenecimiento|cancer|consultorio|servicio|tratamiento)/.test(
                        o
                    )
                );
            })(o) &&
            /(capital|presidente|deporte|futbol|partido|clima|temperatura|noticia|historia|geografia|matematica|programacion|codigo|traduce|traducir|pelicula|musica|bitcoin|criptomoneda|politica)/.test(
                o
            )
        );
    }
    function S(e) {
        const o = w(e);
        if (!o) return !0;
        const r = [
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
        let a = 0;
        for (const e of r) e.test(o) && (a += 1);
        return a >= 2;
    }
    async function E(r, a = {}, n = 'principal') {
        const t = 'string' == typeof a.source ? a.source.trim() : '',
            i = o && 'string' == typeof o.chatSource ? o.chatSource.trim() : '',
            s = t || i,
            c = {
                model: 'figo-assistant',
                messages: r,
                max_tokens: 256,
                temperature: 0.7,
                ...a,
            };
        s && (c.source = s);
        const l = new AbortController(),
            d = setTimeout(() => l.abort(), 9e3);
        let p;
        try {
            p = await fetch(e + '?t=' + Date.now(), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'Cache-Control': 'no-cache',
                },
                body: JSON.stringify(c),
                signal: l.signal,
            });
        } catch (e) {
            if (e && 'AbortError' === e.name) throw new Error('TIMEOUT');
            throw e;
        } finally {
            clearTimeout(d);
        }
        u(`?? Status (${n}):`, p.status);
        const g = await p.text();
        let m;
        u(`?? Respuesta cruda (${n}):`, g.substring(0, 500));
        try {
            m = g ? JSON.parse(g) : {};
        } catch (e) {
            if (!p.ok) throw new Error(`HTTP ${p.status}`);
            throw (
                u('Error parseando JSON:', e),
                new Error('Respuesta no es JSON valido')
            );
        }
        if (m && 'object' == typeof m && 'queued' === m.mode)
            return {
                content: '',
                mode: 'queued',
                source: 'string' == typeof m.source ? m.source : '',
                reason: 'string' == typeof m.reason ? m.reason : '',
                configured: !1 !== m.configured,
                recursiveConfigDetected: !0 === m.recursiveConfigDetected,
                upstreamStatus: Number.isFinite(m.upstreamStatus)
                    ? Number(m.upstreamStatus)
                    : 0,
                queued: !0,
                provider:
                    'string' == typeof m.provider
                        ? m.provider
                        : 'openclaw_queue',
                jobId: 'string' == typeof m.jobId ? m.jobId : '',
                pollUrl: 'string' == typeof m.pollUrl ? m.pollUrl : '',
                pollAfterMs: Number.isFinite(m.pollAfterMs)
                    ? Number(m.pollAfterMs)
                    : 1500,
            };
        if (!p.ok || !1 === m.ok) {
            const e =
                m && 'string' == typeof m.reason && m.reason
                    ? ` (${m.reason})`
                    : '';
            throw C(`HTTP ${p.status}${e}`, {
                provider: m && 'string' == typeof m.provider ? m.provider : '',
                code: m && 'string' == typeof m.errorCode ? m.errorCode : '',
                noLocalFallback:
                    m &&
                    'string' == typeof m.provider &&
                    'openclaw_queue' === m.provider,
            });
        }
        if (!m.choices || !m.choices[0] || !m.choices[0].message)
            throw (
                u('Estructura invalida:', m),
                new Error('Respuesta invalida')
            );
        return {
            content: m.choices[0].message.content || '',
            mode: 'string' == typeof m.mode ? m.mode : '',
            source: 'string' == typeof m.source ? m.source : '',
            reason: 'string' == typeof m.reason ? m.reason : '',
            configured: !1 !== m.configured,
            recursiveConfigDetected: !0 === m.recursiveConfigDetected,
            upstreamStatus: Number.isFinite(m.upstreamStatus)
                ? Number(m.upstreamStatus)
                : 0,
            queued: !1,
            provider: 'string' == typeof m.provider ? m.provider : '',
            jobId: 'string' == typeof m.jobId ? m.jobId : '',
            pollUrl: 'string' == typeof m.pollUrl ? m.pollUrl : '',
            pollAfterMs: Number.isFinite(m.pollAfterMs)
                ? Number(m.pollAfterMs)
                : 1500,
        };
    }
    function I(e, o = !0) {
        const r = w(e);
        if (/forzar ia|activar ia|modo ia|usar ia/.test(r)) return void q();
        if (/debug|info sistema|informacion tecnica/.test(r)) return void $();
        let a;
        if (/ayuda|help|menu|opciones|que puedes hacer/.test(r))
            ((a = 'Opciones disponibles:<br><br>'),
                (a +=
                    '<strong>Servicios:</strong> Información sobre consultas<br>'),
                (a += '<strong>Precios:</strong> Tarifas de servicios<br>'),
                (a += '<strong>Citas:</strong> Como agendar<br>'),
                (a += '<strong>Ubicación:</strong> Dirección y horarios<br>'),
                (a += '<strong>Contacto:</strong> WhatsApp y teléfono'));
        else {
            if (A(r))
                return (
                    (a =
                        'Puedo ayudarte solo con temas de <strong>Piel en Armonía</strong>.<br><br>\nPuedes consultarme sobre:<br>\n- Servicios y tratamientos dermatologicos<br>\n- Precios y formas de pago<br>\n- Agenda de citas y horarios<br>\n- Ubicacion y contacto<br><br>\nSi quieres, te llevo directo a <a href="#v5-booking" data-action="minimize-chat">Reservar Cita</a> o te conecto por <a href="https://wa.me/593982453672" target="_blank" rel="noopener noreferrer">WhatsApp</a>.'),
                    void p(a, o)
                );
            if (
                /hola|buenos dias|buenas tardes|buenas noches|hey|hi|hello/.test(
                    r
                )
            )
                ((a =
                    '¡Hola! Soy <strong>Figo</strong>, asistente de <strong>Piel en Armonía</strong>.<br><br>'),
                    (a += 'Puedo ayudarte con:<br>'),
                    (a += '• Servicios dermatologicos<br>'),
                    (a += '• Precios de tratamientos<br>'),
                    (a += '• Agendar citas<br>'),
                    (a += '• Ubicacion y horarios<br><br>'),
                    (a += '¿En que puedo ayudarte?'));
            else if (/servicio|tratamiento|hacen|ofrecen|que hacen/.test(r))
                ((a = 'Servicios dermatológicos:<br><br>'),
                    (a += '<strong>Consultas:</strong><br>'),
                    (a += '• Presencial: $46<br>'),
                    (a += '• Telefónica: $28.75<br>'),
                    (a += '• Video: $34.50<br><br>'),
                    (a += '<strong>Tratamientos:</strong><br>'),
                    (a += '• Acné: desde $80<br>'),
                    (a += '• Láser: desde $172.50<br>'),
                    (a += '• Rejuvenecimiento: desde $138<br>'),
                    (a += '• Detección de cáncer de piel: desde $70'));
            else if (/precio|cuanto cuesta|valor|tarifa|costo/.test(r))
                ((a = 'Precios (incluyen IVA 15%):<br><br>'),
                    (a += '<strong>Consultas:</strong><br>'),
                    (a += '• Presencial: $46<br>'),
                    (a += '• Telefónica: $28.75<br>'),
                    (a += '• Video: $34.50<br><br>'),
                    (a += '<strong>Tratamientos (desde):</strong><br>'),
                    (a += '• Acné: $80<br>'),
                    (a += '• Láser: $172.50<br>'),
                    (a += '• Rejuvenecimiento: $138<br><br>'),
                    (a += 'Para presupuesto preciso, agenda una consulta.'));
            else if (
                (function (e) {
                    const o = w(e);
                    return /(pago|pagar|metodo de pago|tarjeta|transferencia|efectivo|deposito|comprobante|referencia|factura|visa|mastercard)/.test(
                        o
                    );
                })(r)
            )
                a = (function (e) {
                    let o =
                        'Asi puedes realizar tu pago en la web:<br><br>\n<strong>1) Reserva tu cita</strong><br>\nVe a <a href="#v5-booking" data-action="minimize-chat">Reservar Cita</a>, completa tus datos y selecciona fecha/hora.<br><br>\n\n<strong>2) Abre el modulo de pago</strong><br>\nAl enviar el formulario se abre la ventana de pago automaticamente.<br><br>\n\n<strong>3) Elige metodo de pago</strong><br>\n• <strong>Tarjeta:</strong> cobro seguro con Stripe.<br>\n• <strong>Transferencia:</strong> subes el comprobante y el numero de referencia.<br>\n• <strong>Efectivo:</strong> dejas la reserva registrada y pagas en consultorio.<br><br>';
                    return (
                        /(tarjeta|visa|mastercard|debito|credito|stripe)/.test(
                            e
                        ) &&
                            (o +=
                                '<strong>Tarjeta (paso a paso):</strong><br>\n1. Selecciona <strong>Tarjeta</strong>.<br>\n2. Completa nombre + datos de tarjeta en el formulario seguro.<br>\n3. Confirma el pago y espera la validacion final de la cita.<br><br>'),
                        /(transferencia|deposito|comprobante|referencia|banco)/.test(
                            e
                        ) &&
                            (o +=
                                '<strong>Transferencia (paso a paso):</strong><br>\n1. Selecciona <strong>Transferencia</strong>.<br>\n2. Realiza el deposito o transferencia a la cuenta indicada.<br>\n3. Sube el comprobante y agrega numero de referencia.<br>\n4. Nuestro equipo valida y confirma por WhatsApp.<br><br>'),
                        /(efectivo|consultorio|presencial)/.test(e) &&
                            (o +=
                                '<strong>Efectivo:</strong><br>\nLa cita queda registrada y pagas el dia de la atencion en consultorio.<br><br>'),
                        /(factura|facturacion|ruc|cedula)/.test(e) &&
                            (o +=
                                '<strong>Facturacion:</strong><br>\nComparte tus datos de facturacion (cedula/RUC y correo) y te ayudamos por WhatsApp.<br><br>'),
                        (o +=
                            '<strong>4) Confirmacion</strong><br>\nTu cita queda registrada y te contactamos para confirmar detalles por WhatsApp: <a href="https://wa.me/593982453672" target="_blank" rel="noopener noreferrer">098 245 3672</a>.<br><br>\n\nSi quieres, te guio ahora mismo segun el metodo que prefieras: <strong>tarjeta</strong>, <strong>transferencia</strong> o <strong>efectivo</strong>.'),
                        o
                    );
                })(r);
            else if (
                /hablar con|humano|persona real|doctor real|agente/.test(r)
            )
                a =
                    'Entiendo que prefieres hablar con una persona. ?????<br><br>\nPuedes chatear directamente con nuestro equipo humano por WhatsApp aquí:<br><br>\n?? <a href="https://wa.me/593982453672" target="_blank" rel="noopener noreferrer">Abrir Chat de WhatsApp</a><br><br>\nO llámanos al +593 98 245 3672.';
            else {
                if (/cita|agendar|reservar|turno|hora/.test(r)) return void g();
                /acne|grano|espinilla|barro/.test(r)
                    ? ((a =
                          'El acne es muy comun y tenemos soluciones efectivas.<br><br>'),
                      (a += 'Nuestro enfoque:<br>'),
                      (a += '• Evaluacion personalizada<br>'),
                      (a += '• Tratamientos topicos<br>'),
                      (a += '• Medicacion oral si es necesario<br>'),
                      (a += '• Peelings quimicos<br>'),
                      (a += '• Laser para cicatrices<br><br>'),
                      (a += 'Primera consulta: $40<br><br>'),
                      (a += '¿Te gustaria agendar?'))
                    : /laser/.test(r)
                      ? ((a = 'Tecnologia laser de ultima generacion.<br><br>'),
                        (a += 'Tratamientos:<br>'),
                        (a += '• Eliminacion de lesiones vasculares<br>'),
                        (a += '• Tratamiento de manchas<br>'),
                        (a += '• Rejuvenecimiento facial<br>'),
                        (a += '• Cicatrices de acne<br><br>'),
                        (a += 'Precio: Desde $150<br><br>'),
                        (a += 'Se requiere consulta de evaluación previa.<br>'),
                        (a += '¿Deseas agendar?'))
                      : /donde|ubicacion|direccion|lugar|mapa|quito/.test(r)
                        ? ((a = '<strong>Ubicacion:</strong><br>'),
                          (a += `${t}<br>`),
                          (a += '<br>'),
                          (a += '<strong>Horario:</strong><br>'),
                          (a += 'Lunes - Viernes: 9:00 - 18:00<br>'),
                          (a += 'Sabados: 9:00 - 13:00<br><br>'),
                          (a +=
                              '<strong>Estacionamiento:</strong> Privado disponible<br><br>'),
                          (a += `<strong>Mapa:</strong> <a href="${i}" target="_blank" rel="noopener noreferrer">Abrir en Google Maps</a><br>`),
                          (a += '<strong>Contacto:</strong> 098 245 3672'))
                        : (a =
                              /doctor|medico|especialista|rosero|narvaez|dr|dra/.test(
                                  r
                              )
                                  ? `Contamos con dos excelentes especialistas:\n\n<strong>Dr. Javier Rosero</strong>\nDermatólogo Clínico\n15 años de experiencia\nEspecialista en detección temprana de cáncer de piel\n\n<strong>Dra. Carolina Narvaez</strong>\nDermatóloga Estética\nEspecialista en rejuvenecimiento facial y láser\nContacto directo: ${s} | ${c}\n\nAmbos están disponibles para consulta presencial y online.\n\n¿Con quién te gustaría agendar?`
                                  : /online|virtual|video|remota|telemedicina|whatsapp|llamada/.test(
                                          r
                                      )
                                    ? 'Ofrecemos 3 opciones de consulta remota:\n\n<strong>?? 1. Llamada Telefónica - $25</strong>\nIdeal para consultas rápidas y seguimientos\n\n<strong>?? 2. WhatsApp Video - $30</strong>\nVideollamada por WhatsApp, muy fácil de usar\n\n<strong>3. Video Web (Jitsi) - $30</strong>\nNo necesitas instalar nada, funciona en el navegador\n\nTodas incluyen:\n? Evaluación médica completa\n? Receta digital\n? Recomendaciones personalizadas\n? Seguimiento por WhatsApp\n\n¿Cuál prefieres?'
                                    : /gracias|thank|adios|chao|hasta luego|bye/.test(
                                            r
                                        )
                                      ? '¡De nada! ??\n\nSi tienes más dudas, no dudes en escribirme. También puedes contactarnos directamente:\n\n?? WhatsApp: 098 245 3672\n?? Teléfono: 098 245 3672\n\n¡Que tengas un excelente día!'
                                      : 'Puedo ayudarte mejor si eliges una opcion:<br><br>\n1) <strong>Servicios y precios</strong><br>\n2) <strong>Reservar cita</strong><br>\n3) <strong>Pagos</strong><br><br>\nTambien puedes ir directo:<br>\n- <a href="#servicios" data-action="minimize-chat">Servicios</a><br>\n- <a href="#v5-booking" data-action="minimize-chat">Reservar Cita</a><br>\n- <a href="https://wa.me/593982453672" target="_blank" rel="noopener noreferrer">WhatsApp 098 245 3672</a>');
            }
        }
        p(a, o);
    }
    function q() {
        (localStorage.setItem('forceAI', 'true'),
            m('Modo IA activado manualmente', 'success'),
            (a = h()),
            a.length > 0 &&
                p(
                    '<strong>Modo IA activado</strong><br>Intentare usar inteligencia artificial real en los proximos mensajes.'
                ));
    }
    function $() {
        const o = y();
        let r = '<strong>Información del sistema:</strong><br><br>';
        ((r += 'Protocolo: ' + window.location.protocol + '<br>'),
            (r += 'Hostname: ' + window.location.hostname + '<br>'),
            (r += 'Usa IA: ' + (o ? 'SI' : 'NO') + '<br>'),
            (r +=
                'Forzado: ' +
                ('true' === localStorage.getItem('forceAI') ? 'SI' : 'NO') +
                '<br><br>'),
            (r += 'Endpoint: ' + e),
            p(r));
    }
    'undefined' != typeof window &&
        ((window.Piel = window.Piel || {}),
        (window.Piel.FigoChatEngine = {
            init: function (e = {}) {
                ((o = e || {}), (r = f()), (a = h()), (n = v()));
                const l = String(o.clinicAddress || '').trim(),
                    u = String(o.clinicMapUrl || '').trim(),
                    d = String(o.doctorCarolinaPhone || '').trim(),
                    p = String(o.doctorCarolinaEmail || '').trim();
                return (
                    l && (t = l),
                    u && (i = u),
                    d && (s = d),
                    p && (c = p),
                    window.Piel && window.Piel.FigoChatEngine
                );
            },
            processWithKimi: async function (a) {
                if (l) u('Ya procesando, ignorando duplicado');
                else {
                    if (
                        o &&
                        'function' == typeof o.isChatBookingActive &&
                        !0 === o.isChatBookingActive()
                    ) {
                        const e = await (function (e) {
                            return o &&
                                'function' == typeof o.processChatBookingStep
                                ? o.processChatBookingStep(e)
                                : Promise.resolve(!1);
                        })(a);
                        if (!1 !== e) return;
                    }
                    if (
                        /cita|agendar|reservar|turno|quiero una consulta|necesito cita/i.test(
                            a
                        )
                    )
                        g();
                    else {
                        if (
                            ((l = !0),
                            o &&
                                'function' == typeof o.showTypingIndicator &&
                                o.showTypingIndicator(),
                            A(a))
                        )
                            return (
                                d(),
                                p(
                                    'Puedo ayudarte con temas de <strong>Piel en Armonía</strong> (servicios, precios, citas, pagos, horarios y ubicación).<br><br>Si deseas, te ayudo ahora con:<br>- <a href="#servicios" data-action="minimize-chat">Servicios y tratamientos</a><br>- <a href="#v5-booking" data-action="minimize-chat">Reservar cita</a><br>- <a href="https://wa.me/593982453672" target="_blank" rel="noopener noreferrer">WhatsApp directo</a>',
                                    !1
                                ),
                                void (l = !1)
                            );
                        u('Procesando mensaje:', a);
                        try {
                            y()
                                ? (u('?? Consultando bot del servidor...'),
                                  await (async function (o) {
                                      try {
                                          r = f();
                                          const a = [];
                                          for (const e of r) {
                                              const o = a[a.length - 1];
                                              (o &&
                                                  o.role === e.role &&
                                                  o.content === e.content) ||
                                                  a.push(e);
                                          }
                                          (b(a),
                                              r.length > 14 && b(r.slice(-14)));
                                          const t =
                                              ((r = f()),
                                              [
                                                  {
                                                      role: 'system',
                                                      content:
                                                          'Eres el Dr. Virtual, asistente inteligente de la clinica dermatologica "Piel en Armonia" en Quito, Ecuador.\n\nINFORMACION DE LA CLINICA:\n- Nombre: Piel en Armonia\n- Doctores: Dr. Javier Rosero (Dermatologo Clinico) y Dra. Carolina Narvaez (Dermatologa Estetica)\n- Direccion: Valparaiso 13-183 y Sodiro, Consultorio Dr. Celio Caiza, Quito (Frente al Colegio de las Mercedarias, a 2 cuadras de la Maternidad Isidro Ayora)\n- Telefono/WhatsApp: 098 245 3672\n- Contacto Dra. Carolina: 098 786 6885 | caro93narvaez@gmail.com\n- Horario: Lunes-Viernes 9:00-18:00, Sabados 9:00-13:00\n- Estacionamiento privado disponible\n\nSERVICIOS Y PRECIOS (con IVA 15%):\n- Consulta Dermatológica: $46\n- Consulta Telefónica: $28.75\n- Video Consulta: $34.50\n- Tratamiento Láser: desde $172.50\n- Rejuvenecimiento: desde $138\n- Tratamiento de Acné: desde $80\n- Detección de Cáncer de Piel: desde $70\n\nOPCIONES DE CONSULTA ONLINE:\n1. Llamada telefonica: tel:+593982453672\n2. WhatsApp Video: https://wa.me/593982453672\n3. Video Web (Jitsi): https://meet.jit.si/PielEnArmonia-Consulta\n\nINSTRUCCIONES:\n- Se profesional, amable y empatico\n- Responde en espanol (o en el idioma que use el paciente)\n- Si el paciente tiene sintomas graves o emergencias, recomienda acudir a urgencias\n- Para agendar citas, dirige al formulario web, WhatsApp o llamada telefonica\n- Si no sabes algo especifico, ofrece transferir al doctor real\n- No hagas diagnosticos medicos definitivos, solo orientacion general\n- Usa emojis ocasionalmente para ser amigable\n- Manten respuestas concisas pero informativas\n\nTu objetivo es ayudar a los pacientes a:\n1. Conocer los servicios de la clinica\n2. Entender los precios\n3. Agendar citas\n4. Resolver dudas basicas sobre dermatologia\n5. Conectar con un doctor real cuando sea necesario',
                                                  },
                                                  {
                                                      role: 'system',
                                                      content:
                                                          'MODO FIGO PRO:\n- Responde con pasos claros y accionables, no con texto general.\n- Si preguntan por pagos, explica el flujo real del sitio: reservar cita -> modal de pago -> metodo (tarjeta/transferencia/efectivo) -> confirmacion.\n- Si faltan datos para ayudar mejor, haz una sola pregunta de seguimiento concreta.\n- Mantente enfocado en Piel en Armonía (servicios, precios, citas, pagos, ubicación y contacto).\n- Si preguntan temas fuera de la clínica (capitales, noticias, deportes o cultura general), explica que solo atiendes temas de Piel en Armonía y redirige a servicios/citas.\n- Evita decir "modo offline" salvo que realmente no haya conexion con el servidor.',
                                                  },
                                                  {
                                                      role: 'system',
                                                      content: `CONTEXTO WEB EN TIEMPO REAL:\n- Seccion actual: ${window.location.hash || '#inicio'}\n- Modal de pago abierto: ${document.getElementById('v5-payment-modal')?.classList.contains('active') || document.getElementById('paymentModal')?.classList.contains('active') ? 'si' : 'no'}\n- Cita en progreso: ${(function () {
                                                          if (((n = v()), !n))
                                                              return 'sin cita activa';
                                                          const e = [];
                                                          return (
                                                              n.service &&
                                                                  e.push(
                                                                      `servicio=${n.service}`
                                                                  ),
                                                              n.doctor &&
                                                                  e.push(
                                                                      `doctor=${n.doctor}`
                                                                  ),
                                                              n.date &&
                                                                  e.push(
                                                                      `fecha=${n.date}`
                                                                  ),
                                                              n.time &&
                                                                  e.push(
                                                                      `hora=${n.time}`
                                                                  ),
                                                              n.price &&
                                                                  e.push(
                                                                      `precio=${n.price}`
                                                                  ),
                                                              e.length
                                                                  ? e.join(', ')
                                                                  : 'sin datos relevantes'
                                                          );
                                                      })()}\n\nFLUJO DE PAGO REAL DEL SITIO:\n1) El paciente completa el formulario de cita.\n2) Se abre el modal de pago automaticamente.\n3) Puede elegir tarjeta, transferencia o efectivo.\n4) Al confirmar, la cita se registra y el equipo valida por WhatsApp.`,
                                                  },
                                                  ...r.slice(-6),
                                              ]);
                                          (u('?? Enviando a:', e),
                                              u(
                                                  '?? Contexto actual:',
                                                  r.length,
                                                  'mensajes'
                                              ));
                                          let i = await E(t, {}, 'principal');
                                          !0 === i.queued &&
                                              (u(
                                                  'Respuesta en cola detectada. jobId:',
                                                  i.jobId || 'n/a'
                                              ),
                                              (i = await (async function (e) {
                                                  const o = String(
                                                      e?.jobId || ''
                                                  ).trim();
                                                  if (!o)
                                                      throw C(
                                                          'queue_missing_job_id',
                                                          {
                                                              code: 'queue_missing_job_id',
                                                              noLocalFallback:
                                                                  !0,
                                                              provider:
                                                                  'openclaw_queue',
                                                          }
                                                      );
                                                  const r = Math.max(
                                                          500,
                                                          Math.min(
                                                              5e3,
                                                              Number(
                                                                  e?.pollAfterMs ||
                                                                      1500
                                                              )
                                                          )
                                                      ),
                                                      a =
                                                          String(
                                                              e?.pollUrl || ''
                                                          ).trim() ||
                                                          `/check-ai-response.php?jobId=${encodeURIComponent(o)}`,
                                                      n = Date.now() + 3e4;
                                                  let t = !0;
                                                  for (; Date.now() < n; ) {
                                                      (t ||
                                                          (await new Promise(
                                                              (e) =>
                                                                  setTimeout(
                                                                      e,
                                                                      r
                                                                  )
                                                          )),
                                                          (t = !1));
                                                      const e = a.includes('?')
                                                          ? `${a}&t=${Date.now()}`
                                                          : `${a}?t=${Date.now()}`;
                                                      let n, i;
                                                      try {
                                                          n = await fetch(e, {
                                                              method: 'GET',
                                                              headers: {
                                                                  Accept: 'application/json',
                                                                  'Cache-Control':
                                                                      'no-cache',
                                                              },
                                                          });
                                                      } catch (e) {
                                                          throw C(
                                                              'queue_poll_network',
                                                              {
                                                                  code: 'queue_poll_network',
                                                                  noLocalFallback:
                                                                      !0,
                                                                  provider:
                                                                      'openclaw_queue',
                                                                  cause: e,
                                                              }
                                                          );
                                                      }
                                                      try {
                                                          i = await n.json();
                                                      } catch (e) {
                                                          throw C(
                                                              'queue_poll_invalid_json',
                                                              {
                                                                  code: 'queue_poll_invalid_json',
                                                                  noLocalFallback:
                                                                      !0,
                                                                  provider:
                                                                      'openclaw_queue',
                                                                  cause: e,
                                                              }
                                                          );
                                                      }
                                                      const s = String(
                                                          i?.status || ''
                                                      ).toLowerCase();
                                                      if (
                                                          'queued' !== s &&
                                                          'processing' !== s
                                                      ) {
                                                          if (
                                                              'completed' === s
                                                          ) {
                                                              const e =
                                                                      i?.completion,
                                                                  n = String(
                                                                      e
                                                                          ?.choices?.[0]
                                                                          ?.message
                                                                          ?.content ||
                                                                          ''
                                                                  ).trim();
                                                              if (!n)
                                                                  throw C(
                                                                      'queue_completed_without_content',
                                                                      {
                                                                          code: 'queue_completed_without_content',
                                                                          noLocalFallback:
                                                                              !0,
                                                                          provider:
                                                                              'openclaw_queue',
                                                                      }
                                                                  );
                                                              return {
                                                                  content: n,
                                                                  mode: 'live',
                                                                  source: 'openclaw_queue',
                                                                  reason: '',
                                                                  configured:
                                                                      !0,
                                                                  recursiveConfigDetected:
                                                                      !1,
                                                                  upstreamStatus: 200,
                                                                  queued: !1,
                                                                  provider:
                                                                      'openclaw_queue',
                                                                  jobId: o,
                                                                  pollUrl: a,
                                                                  pollAfterMs:
                                                                      r,
                                                              };
                                                          }
                                                          throw C(
                                                              'queue_failed',
                                                              {
                                                                  code:
                                                                      'string' ==
                                                                      typeof i?.errorCode
                                                                          ? i.errorCode
                                                                          : 'queue_failed',
                                                                  noLocalFallback:
                                                                      !0,
                                                                  provider:
                                                                      'openclaw_queue',
                                                                  message:
                                                                      'string' ==
                                                                      typeof i?.errorMessage
                                                                          ? i.errorMessage
                                                                          : 'No se pudo completar la respuesta de Figo',
                                                              }
                                                          );
                                                      }
                                                  }
                                                  throw C('queue_timeout', {
                                                      code: 'queue_timeout',
                                                      noLocalFallback: !0,
                                                      provider:
                                                          'openclaw_queue',
                                                  });
                                              })(i)));
                                          let s = String(
                                              i.content || ''
                                          ).trim();
                                          if (!s)
                                              throw new Error(
                                                  'Respuesta vacia del backend de chat'
                                              );
                                          if (
                                              (u(
                                                  'Respuesta recibida:',
                                                  s.substring(0, 100) + '...'
                                              ),
                                              ('degraded' !== i.mode &&
                                                  'fallback' !== i.source) ||
                                                  u(
                                                      'Figo en modo degradado:',
                                                      i.reason || 'sin motivo'
                                                  ),
                                              'live' === i.mode &&
                                                  'fallback' !== i.source &&
                                                  (function (e) {
                                                      return S(e);
                                                  })(s))
                                          ) {
                                              u(
                                                  'Respuesta generica detectada, solicitando precision adicional a Figo'
                                              );
                                              const e = `Tu respuesta anterior fue demasiado general.\nResponde con información específica para la web de Piel en Armonía.\nIncluye pasos concretos y el siguiente paso recomendado para el paciente.\nPregunta original del paciente: "${o}"`,
                                                  r = [
                                                      ...t,
                                                      {
                                                          role: 'assistant',
                                                          content: s,
                                                      },
                                                      {
                                                          role: 'user',
                                                          content: e,
                                                      },
                                                  ];
                                              try {
                                                  const e = await E(
                                                          r,
                                                          { temperature: 0.3 },
                                                          'refinada'
                                                      ),
                                                      o = String(
                                                          e?.content || ''
                                                      ).trim();
                                                  o &&
                                                      !S(o) &&
                                                      ((s = o),
                                                      u(
                                                          '? Respuesta refinada aplicada'
                                                      ));
                                              } catch (e) {
                                                  u(
                                                      'No se pudo refinar con Figo:',
                                                      e
                                                  );
                                              }
                                              if (S(s))
                                                  return (
                                                      u(
                                                          'Respuesta sigue generica, usando fallback local especializado'
                                                      ),
                                                      d(),
                                                      void I(o, !1)
                                                  );
                                          }
                                          const c = r[r.length - 1];
                                          if (
                                              !c ||
                                              'assistant' !== c.role ||
                                              c.content !== s
                                          ) {
                                              const e = r.concat({
                                                  role: 'assistant',
                                                  content: s,
                                              });
                                              e.length > 14
                                                  ? b(e.slice(-14))
                                                  : b(e);
                                          }
                                          (d(),
                                              p(
                                                  s
                                                      .replace(
                                                          /\*\*(.+?)\*\*/g,
                                                          '<strong>$1</strong>'
                                                      )
                                                      .replace(
                                                          /\*(.+?)\*/g,
                                                          '<em>$1</em>'
                                                      )
                                                      .replace(
                                                          /\[(.+?)\]\((.+?)\)/g,
                                                          '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
                                                      )
                                                      .replace(/\n/g, '<br>'),
                                                  !1
                                              ),
                                              u('?? Mensaje mostrado en chat'));
                                      } catch (e) {
                                          if (
                                              (u(
                                                  'Error con bot del servidor:',
                                                  e
                                              ),
                                              d(),
                                              (function (e) {
                                                  return (
                                                      !(
                                                          !e ||
                                                          'object' != typeof e
                                                      ) &&
                                                      (!0 ===
                                                          e.noLocalFallback ||
                                                          ('string' ==
                                                              typeof e.provider &&
                                                              'openclaw_queue' ===
                                                                  e.provider) ||
                                                          ('string' ==
                                                              typeof e.code &&
                                                              /^(queue_|gateway_|provider_mode_disabled)/.test(
                                                                  e.code
                                                              )))
                                                  );
                                              })(e))
                                          )
                                              return void (function (e = '') {
                                                  p(
                                                      `El asistente Figo no está disponible por unos minutos.${e ? `<br><small>Detalle técnico: ${String(e)}</small>` : ''}<br><br>\nPuedes continuar por <a href="https://wa.me/593982453672" target="_blank" rel="noopener noreferrer">WhatsApp +593 98 245 3672</a> para atención inmediata.`,
                                                      !1
                                                  );
                                              })(e?.code || e?.message || '');
                                          I(o, !1);
                                      }
                                  })(a))
                                : (u(
                                      '?? Usando respuestas locales (modo offline)'
                                  ),
                                  setTimeout(() => {
                                      (d(), I(a, !1));
                                  }, 600));
                        } catch (e) {
                            (u('Error:', e), d(), I(a, !1));
                        } finally {
                            l = !1;
                        }
                    }
                }
            },
            resetConversation: function () {
                var e;
                (b([]),
                    localStorage.removeItem('chatHistory'),
                    (e = []),
                    (a = Array.isArray(e) ? e.slice() : []),
                    o &&
                        'function' == typeof o.setChatHistory &&
                        o.setChatHistory(a.slice()),
                    m('Conversacion reiniciada', 'info'));
            },
            checkServerEnvironment: function () {
                return (
                    'file:' !== window.location.protocol ||
                    (setTimeout(() => {
                        m(
                            'Para usar funciones online, abre el sitio en un servidor local. Ver SERVIDOR-LOCAL.md',
                            'warning',
                            'Servidor requerido'
                        );
                    }, 2e3),
                    !1)
                );
            },
            forzarModoIA: q,
            mostrarInfoDebug: $,
        }));
})();

import {
    getDictionary,
    getLocalizedServiceBySlug,
    getLocalizedServices,
    getLocalizedServicesBySlugs,
    getLocaleSwitchPath,
    getNavigation,
    getRelatedServices,
    getServiceCtaLabel,
    legalBasePath,
    localizeCategory,
    localizeDoctorProfiles,
    mapServiceHint,
    serviceHubPath,
    servicePath,
    telemedicinePath,
} from './content.js';

const IMAGE_MAP = {
    heroMain: '/images/optimized/showcase-hero.webp',
    heroAlt: '/images/optimized/hero-woman.webp',
    clinical: '/images/optimized/showcase-diagnostic.webp',
    aesthetic: '/images/optimized/showcase-treatment.webp',
    clinic: '/images/optimized/showcase-clinic.webp',
    telemedicine: '/images/optimized/service-telemedicina.webp',
    consult: '/images/optimized/service-consulta.webp',
    rejuvenation: '/images/optimized/service-rejuvenecimiento.webp',
    doctorRosero: '/images/optimized/team-rosero.webp',
    doctorNarvaez: '/images/optimized/team-narvaez.webp',
};

const FAMILY_ORDER = ['clinical', 'aesthetic', 'children'];
const SERVICE_INTENT_BY_SLUG = {
    'diagnostico-integral': 'diagnosis',
    'acne-rosacea': 'inflammation',
    verrugas: 'procedures',
    'granitos-brazos-piernas': 'inflammation',
    cicatrices: 'procedures',
    'cancer-piel': 'diagnosis',
    'peeling-quimico': 'rejuvenation',
    mesoterapia: 'rejuvenation',
    'laser-dermatologico': 'procedures',
    botox: 'rejuvenation',
    'bioestimuladores-colageno': 'rejuvenation',
    'piel-cabello-unas': 'diagnosis',
    'dermatologia-pediatrica': 'pediatric',
};

const LEGAL_PAGES = {
    es: {
        terminos: {
            title: 'Terminos y condiciones',
            description: 'Marco legal de reservas, pagos y uso publico del sitio.',
            heading: 'Terminos y condiciones',
            summary: 'Esta pagina explica como opera la reserva, el soporte y la continuidad asistencial dentro del sitio publico.',
            highlights: [
                { eyebrow: 'Reserva', title: 'La cita se confirma con agenda, datos y validacion operativa.', body: 'El servicio puede requerir confirmacion adicional, soporte o pago segun el tipo de atencion.' },
                { eyebrow: 'Cambios', title: 'Reprogramacion y cancelacion siguen una politica publica clara.', body: 'La anticipacion, la disponibilidad real y el estado del pago definen el siguiente paso.' },
            ],
            sections: [
                { title: 'Alcance del servicio', body: 'El sitio organiza informacion publica, rutas de servicios y la reserva para consulta presencial o telemedicina.', items: ['Los precios publicados son referenciales o de entrada segun el servicio.', 'La indicacion final depende de valoracion medica.', 'La modalidad puede cambiar por criterio clinico.'] },
                { title: 'Reservas y pagos', body: 'La continuidad del booking depende de agenda, metodo de pago y validacion del caso.', items: ['La disponibilidad puede cerrarse si otra reserva confirma antes.', 'Los requisitos previos se informan antes de confirmar.', 'Las politicas de no show y reembolso aplican segun canal y caso.'] },
            ],
        },
        privacidad: {
            title: 'Politica de privacidad',
            description: 'Tratamiento de datos personales y clinicos iniciales.',
            heading: 'Politica de privacidad',
            summary: 'Tratamos informacion de contacto y contexto clinico con finalidad asistencial, operativa y de soporte.',
            highlights: [
                { eyebrow: 'Datos', title: 'Pedimos solo lo necesario para reserva, soporte y continuidad.', body: 'Nombre, contacto, motivo, fotos y datos de pago se usan segun el paso del recorrido.' },
                { eyebrow: 'Finalidad', title: 'La informacion existe para coordinar la atencion, no para reutilizarla fuera del caso.', body: 'Se usa para validar disponibilidad, preparar la cita y sostener seguimiento.' },
            ],
            sections: [
                { title: 'Que datos tratamos', body: 'El sitio puede procesar contacto, motivo clinico inicial, preferencias de cita y evidencia de pago.', items: ['Datos de contacto para confirmacion y seguimiento.', 'Contexto clinico inicial para orientar la primera atencion.', 'Metadatos tecnicos minimos para seguridad y operacion.'] },
                { title: 'Como se usan', body: 'La informacion permite disponibilidad, respuesta, preparacion de cita y continuidad asistencial.', items: ['Confirmacion o reprogramacion de citas.', 'Soporte por WhatsApp o telemedicina cuando aplica.', 'Prevencion de fraude y errores operativos.'] },
            ],
        },
        cookies: {
            title: 'Politica de cookies',
            description: 'Uso de cookies esenciales y medicion opcional.',
            heading: 'Politica de cookies',
            summary: 'Las cookies esenciales sostienen seguridad y operacion. Las opcionales de medicion dependen de consentimiento.',
            highlights: [
                { eyebrow: 'Esenciales', title: 'Mantienen la continuidad minima del sitio y del booking.', body: 'Sin ellas algunas partes de reserva, soporte o seguridad pueden degradarse.' },
                { eyebrow: 'Opcionales', title: 'La medicion existe para entender uso y mejorar conversion.', body: 'Se controla por consentimiento y no sustituye decisiones clinicas.' },
            ],
            sections: [
                { title: 'Cookies esenciales', body: 'Soportan consentimiento, recursos cargados y continuidad tecnica del sitio.', items: ['Persistencia de consentimiento.', 'Proteccion basica del flujo publico.', 'Integridad de recursos y componentes.'] },
                { title: 'Gestion de preferencias', body: 'Puedes modificar preferencias desde el banner o desde el navegador.', items: ['Eliminar cookies existentes.', 'Bloquear terceros.', 'Revisar la politica cuando el sitio cambie.'] },
            ],
        },
        'aviso-medico': {
            title: 'Aviso medico',
            description: 'Alcance clinico del contenido, el soporte y el chatbot.',
            heading: 'Aviso medico',
            summary: 'La web publica informa y orienta, pero no sustituye valoracion dermatologica profesional ni diagnostico definitivo.',
            highlights: [
                { eyebrow: 'Orientacion', title: 'La web ayuda a decidir el siguiente paso, no a diagnosticar.', body: 'Servicios, telemedicina y soporte editorial conducen al funnel, no cierran el criterio medico.' },
                { eyebrow: 'Urgencia', title: 'Los casos agudos requieren atencion inmediata fuera del sitio.', body: 'No debes depender del formulario o del chatbot para una emergencia.' },
            ],
            sections: [
                { title: 'Limites del contenido', body: 'El contenido editorial y automatizado no reemplaza juicio medico individual.', items: ['No constituye receta ni indicacion definitiva.', 'No garantiza elegibilidad para un procedimiento.', 'No reemplaza examen fisico cuando hace falta.'] },
                { title: 'Cuando escalar', body: 'Dolor intenso, sangrado o progresion rapida exigen asistencia por el canal adecuado.', items: ['No esperar una respuesta asincrona del sitio.', 'Usar servicios de emergencia cuando corresponda.', 'Reservar seguimiento una vez controlado el evento agudo.'] },
            ],
        },
    },
    en: {
        terms: {
            title: 'Terms and conditions',
            description: 'Public legal framework for reservations, payments, and website usage.',
            heading: 'Terms and conditions',
            summary: 'This page explains how booking, support, and care continuity operate across the public site.',
            highlights: [
                { eyebrow: 'Booking', title: 'Appointments are confirmed through schedule, data, and operational validation.', body: 'A service may require confirmation, support, or payment depending on the type of care.' },
                { eyebrow: 'Changes', title: 'Rescheduling and cancellation follow a public policy.', body: 'Lead time, live availability, and payment state define the next step.' },
            ],
            sections: [
                { title: 'Service scope', body: 'The website organizes public information, service routes, and booking for in-person or telemedicine consultations.', items: ['Published prices are entry or reference prices depending on the service.', 'Final indication depends on medical assessment.', 'Care mode can change according to clinical criteria.'] },
                { title: 'Bookings and payments', body: 'Booking continuity depends on live schedule, payment method, and case validation.', items: ['Displayed availability can close if another reservation confirms first.', 'Preparation requirements are disclosed before confirmation.', 'No-show and refund rules apply according to channel and case.'] },
            ],
        },
        privacy: {
            title: 'Privacy policy',
            description: 'How contact and initial clinical information are processed.',
            heading: 'Privacy policy',
            summary: 'We process contact information and initial clinical context for care delivery, operations, and support.',
            highlights: [
                { eyebrow: 'Data', title: 'We ask only for what is necessary for booking, support, and continuity.', body: 'Name, contact data, concern, photos, and payment information are used according to the current step.' },
                { eyebrow: 'Purpose', title: 'Information exists to coordinate care, not to reuse it outside the case.', body: 'It supports availability checks, appointment preparation, and follow-up continuity.' },
            ],
            sections: [
                { title: 'What we process', body: 'The website may process contact details, initial clinical context, appointment preferences, and payment evidence.', items: ['Contact data for confirmation and follow-up.', 'Initial clinical context to orient the first consultation.', 'Minimum technical metadata for security and operations.'] },
                { title: 'How it is used', body: 'Information supports availability, response, appointment preparation, and care continuity.', items: ['Appointment confirmation or rescheduling.', 'WhatsApp or telemedicine support when needed.', 'Fraud prevention and operational error reduction.'] },
            ],
        },
        cookies: {
            title: 'Cookie policy',
            description: 'Use of essential cookies and optional measurement.',
            heading: 'Cookie policy',
            summary: 'Essential cookies support security and operations. Optional measurement depends on consent.',
            highlights: [
                { eyebrow: 'Essential', title: 'They keep the minimum website and booking continuity running.', body: 'Without them, parts of booking, support, or security can degrade.' },
                { eyebrow: 'Optional', title: 'Measurement exists to understand usage and improve conversion.', body: 'It is controlled by consent and does not replace clinical decisions.' },
            ],
            sections: [
                { title: 'Essential cookies', body: 'They support consent persistence, loaded resources, and technical continuity.', items: ['Consent persistence.', 'Basic public-flow protection.', 'Integrity of resources and components.'] },
                { title: 'Preference management', body: 'You can modify preferences through the banner or browser settings.', items: ['Delete existing cookies.', 'Block third parties.', 'Review the policy when the website changes.'] },
            ],
        },
        'medical-disclaimer': {
            title: 'Medical disclaimer',
            description: 'Clinical scope of website, support, and chatbot content.',
            heading: 'Medical disclaimer',
            summary: 'The public website informs and guides, but it does not replace professional dermatology evaluation or final diagnosis.',
            highlights: [
                { eyebrow: 'Guidance', title: 'The website helps decide the next step, not diagnose.', body: 'Services, telemedicine, and editorial support route the funnel but do not close medical judgement.' },
                { eyebrow: 'Urgency', title: 'Acute cases require immediate assistance outside the website.', body: 'Do not rely on the form or chatbot during an emergency.' },
            ],
            sections: [
                { title: 'Content limits', body: 'Editorial and automated content does not replace individual medical judgement.', items: ['It is not a prescription or final recommendation.', 'It does not guarantee eligibility for a procedure.', 'It does not replace physical examination when needed.'] },
                { title: 'When to escalate', body: 'Intense pain, bleeding, or rapid progression require immediate assistance through the right channel.', items: ['Do not wait for an async website response.', 'Use emergency services when appropriate.', 'Book follow-up once the acute event is stabilized.'] },
            ],
        },
    },
};

function groupServicesByFamily(locale) {
    const services = getLocalizedServices(locale);
    return {
        clinical: services.filter((service) => service.category === 'clinical'),
        aesthetic: services.filter((service) => service.category === 'aesthetic'),
        children: services.filter((service) => service.category === 'children'),
    };
}

function getFamilyDeck(family, locale) {
    const deck = {
        es: {
            clinical: 'Diagnostico, triage y rutas medicas para piel, cabello y unas.',
            aesthetic: 'Protocolos medicos para textura, tono, soporte y rejuvenecimiento.',
            children: 'Dermatologia pediatrica con decisiones claras para ninos y adolescentes.',
        },
        en: {
            clinical: 'Diagnosis, triage, and medical routes for skin, hair, and nails.',
            aesthetic: 'Medical protocols for texture, tone, support, and rejuvenation.',
            children: 'Pediatric dermatology with clear decisions for children and teenagers.',
        },
    };

    return deck[locale === 'en' ? 'en' : 'es'][family];
}

function serviceMediaForFamily(family) {
    if (family === 'aesthetic') return IMAGE_MAP.rejuvenation;
    if (family === 'children') return IMAGE_MAP.heroAlt;
    return IMAGE_MAP.clinical;
}

function buildServiceCard(service, locale) {
    const family = service.category === 'children' ? 'children' : service.category;
    return {
        slug: service.slug,
        family,
        label: localizeCategory(service.category, locale),
        title: service.hero,
        deck: service.summary,
        media: serviceMediaForFamily(family),
        href: servicePath(locale, service.slug),
        cta: getServiceCtaLabel(service, locale),
        price: service.price_from,
        duration: service.duration,
        serviceHint: mapServiceHint(service.slug),
        doctors: localizeDoctorProfiles(service.doctor_profile, locale),
    };
}

export function getPublicNavigationModel(locale, pathname = '/') {
    const navigation = getNavigation();
    const servicesGroup = Array.isArray(navigation?.desktop?.[0]?.children)
        ? navigation.desktop[0].children
        : [];
    const featured = getLocalizedServices(locale).slice(0, 3).map((service) => ({
        title: service.hero,
        family: localizeCategory(service.category, locale),
        href: servicePath(locale, service.slug),
    }));

    return {
        locale,
        pathname,
        brand: 'Piel en Armonia',
        switchHref: getLocaleSwitchPath(locale === 'en' ? 'es' : 'en', pathname),
        switchLabel: locale === 'en' ? 'ES' : 'EN',
        bookingHref: '#citas',
        links: [
            { label: locale === 'en' ? 'Home' : 'Inicio', href: locale === 'en' ? '/en/' : '/es/' },
            { label: locale === 'en' ? 'Services' : 'Servicios', href: serviceHubPath(locale), kind: 'mega' },
            { label: locale === 'en' ? 'Telemedicine' : 'Telemedicina', href: telemedicinePath(locale) },
            { label: 'Legal', href: legalBasePath(locale) + (locale === 'en' ? 'terms/' : 'terminos/') },
        ],
        mega: {
            intro: {
                eyebrow: locale === 'en' ? 'Programs' : 'Programas',
                title: locale === 'en' ? 'A cleaner public catalogue for clinical, aesthetic, and pediatric care.' : 'Un catalogo publico mas limpio para cuidado clinico, estetico y pediatrico.',
                deck: locale === 'en' ? 'Browse by family and then move into the right consultation, procedure, or telemedicine route.' : 'Navega por familia y luego entra a la consulta, procedimiento o ruta online correcta.',
                href: serviceHubPath(locale),
            },
            families: FAMILY_ORDER.map((family) => ({
                id: family,
                title: localizeCategory(family, locale),
                deck: getFamilyDeck(family, locale),
                href: `${serviceHubPath(locale)}?category=${family}`,
            })),
            groups: servicesGroup.map((group) => ({
                title: locale === 'en' ? group.label_en : group.label_es,
                items: group.items.slice(0, 4).map((item) => ({
                    label: locale === 'en' ? item.label_en : item.label_es,
                    href: servicePath(locale, item.slug),
                })),
            })),
            featured,
        },
    };
}

export function getHomeV2Data(locale) {
    const dictionary = getDictionary(locale);
    const grouped = groupServicesByFamily(locale);

    return {
        title: locale === 'en' ? 'Piel en Armonia | Editorial dermatology' : 'Piel en Armonia | Dermatologia editorial',
        description: locale === 'en' ? 'A rebuilt public dermatology frontend with editorial structure, service programmes, telemedicine, and booking continuity.' : 'Un frontend publico de dermatologia reconstruido con estructura editorial, programas de servicio, telemedicina y continuidad de reserva.',
        slides: [
            { id: 'clinical-stage', category: locale === 'en' ? 'Clinical dermatology' : 'Dermatologia clinica', title: locale === 'en' ? 'Medical skin decisions, presented with a clearer editorial spine.' : 'Decisiones medicas sobre la piel, presentadas con una espina editorial mas clara.', deck: locale === 'en' ? 'The public experience now starts with diagnosis, treatment programmes, and continuity instead of stacked conversion rails.' : 'La experiencia publica ahora empieza por diagnostico, programas de tratamiento y continuidad, no por una cascada de rails de conversion.', media: IMAGE_MAP.heroMain, primary: { label: locale === 'en' ? 'Book appointment' : 'Reservar cita', href: '#citas', target: 'booking' }, secondary: { label: locale === 'en' ? 'Explore services' : 'Explorar servicios', href: serviceHubPath(locale), target: 'service_hub' } },
            { id: 'aesthetic-stage', category: locale === 'en' ? 'Medical aesthetics' : 'Estetica medica', title: locale === 'en' ? 'Procedural care framed like a programme, not a stack of cards.' : 'Atencion procedural enmarcada como programa, no como pila de tarjetas.', deck: locale === 'en' ? 'Laser, peels, injectables, and collagen strategies are grouped into readable treatment systems.' : 'Laser, peelings, inyectables y bioestimuladores se agrupan en sistemas de tratamiento legibles.', media: IMAGE_MAP.heroAlt, primary: { label: locale === 'en' ? 'View treatment routes' : 'Ver rutas de tratamiento', href: `${serviceHubPath(locale)}?category=aesthetic`, target: 'service_hub' }, secondary: { label: locale === 'en' ? 'WhatsApp guidance' : 'Orientacion por WhatsApp', href: 'https://wa.me/593982453672', target: 'whatsapp' } },
            { id: 'tele-stage', category: dictionary.nav_telemedicine || (locale === 'en' ? 'Telemedicine' : 'Telemedicina'), title: locale === 'en' ? 'Remote dermatology when the case fits, in-person escalation when it does not.' : 'Dermatologia remota cuando el caso encaja, escalamiento presencial cuando no.', deck: locale === 'en' ? 'Telemedicine is now presented as part of the same editorial care system.' : 'La telemedicina ahora se presenta como parte del mismo sistema editorial de cuidado.', media: IMAGE_MAP.telemedicine, primary: { label: locale === 'en' ? 'Open telemedicine' : 'Abrir telemedicina', href: telemedicinePath(locale), target: 'telemedicine' }, secondary: { label: locale === 'en' ? 'Start with diagnosis' : 'Empezar por diagnostico', href: servicePath(locale, 'diagnostico-integral'), target: 'service_detail' } },
        ],
        latest: [
            { eyebrow: locale === 'en' ? 'Latest' : 'Actualizacion', title: locale === 'en' ? 'Clinical intake now supports telemedicine-first triage.' : 'La entrada clinica ahora soporta triage inicial por telemedicina.', href: telemedicinePath(locale) },
            { eyebrow: locale === 'en' ? 'Featured family' : 'Familia destacada', title: locale === 'en' ? 'Aesthetic routes are grouped as full treatment systems.' : 'Las rutas esteticas se agrupan como sistemas completos de tratamiento.', href: `${serviceHubPath(locale)}?category=aesthetic` },
            { eyebrow: locale === 'en' ? 'For children' : 'Para ninos', title: locale === 'en' ? 'Pediatric dermatology keeps its own care language and entry point.' : 'La dermatologia pediatrica conserva su propio lenguaje y punto de entrada.', href: servicePath(locale, 'dermatologia-pediatrica') },
        ],
        featuredStories: [
            { eyebrow: locale === 'en' ? 'Clinical precision' : 'Precision clinica', title: locale === 'en' ? 'Diagnosis first, then the right programme.' : 'Primero diagnostico, despues el programa correcto.', deck: locale === 'en' ? 'Suspicious lesions, acne, hair, nails, and chronic skin issues now start with a structured medical story module.' : 'Lesiones sospechosas, acne, cabello, unas y problemas cronicos ahora empiezan con un modulo medico mas estructurado.', media: IMAGE_MAP.clinical, href: servicePath(locale, 'diagnostico-integral'), alignment: 'left' },
            { eyebrow: locale === 'en' ? 'Medical aesthetics' : 'Estetica medica', title: locale === 'en' ? 'Procedures are explained as care programmes.' : 'Los procedimientos se explican como programas de cuidado.', deck: locale === 'en' ? 'Eligibility, timing, and continuity are visible before the booking layer appears.' : 'La elegibilidad, los tiempos y la continuidad aparecen antes de la capa de reserva.', media: IMAGE_MAP.rejuvenation, href: `${serviceHubPath(locale)}?category=aesthetic`, alignment: 'right' },
            { eyebrow: locale === 'en' ? 'Pediatric care' : 'Cuidado pediatrico', title: locale === 'en' ? 'Children follow a dedicated dermatology route.' : 'Los ninos siguen una ruta dermatologica dedicada.', deck: locale === 'en' ? 'Parents get a clearer entry point for dermatitis, adolescent acne, warts, and scalp concerns.' : 'Las familias tienen una entrada mas clara para dermatitis, acne adolescente, verrugas y cuero cabelludo.', media: IMAGE_MAP.clinic, href: servicePath(locale, 'dermatologia-pediatrica'), alignment: 'left' },
        ],
        families: FAMILY_ORDER.map((family) => ({
            id: family,
            eyebrow: localizeCategory(family, locale),
            title: grouped[family][0]?.hero || localizeCategory(family, locale),
            deck: getFamilyDeck(family, locale),
            href: `${serviceHubPath(locale)}?category=${family}`,
            media: serviceMediaForFamily(family),
            services: grouped[family].slice(0, 4).map((service) => buildServiceCard(service, locale)),
        })),
        telemedicine: {
            eyebrow: dictionary.nav_telemedicine || (locale === 'en' ? 'Telemedicine' : 'Telemedicina'),
            title: locale === 'en' ? 'Remote care belongs inside the same editorial system.' : 'La atencion remota pertenece al mismo sistema editorial.',
            deck: locale === 'en' ? 'Use telemedicine for first guidance, ongoing acne or dermatitis review, and structured escalation to clinic when the case needs it.' : 'Usa telemedicina para orientacion inicial, seguimiento de acne o dermatitis y escalamiento estructurado a consultorio cuando el caso lo requiera.',
            points: locale === 'en' ? ['Video, WhatsApp, or phone intake', 'Structured handoff to in-person care', 'Same booking continuity and support'] : ['Entrada por video, WhatsApp o llamada', 'Escalamiento estructurado a presencial', 'La misma continuidad de reserva y soporte'],
            href: telemedicinePath(locale),
        },
        doctors: [
            { name: 'Dr. Javier Rosero', role: locale === 'en' ? 'Clinical dermatology lead' : 'Lider de dermatologia clinica', deck: locale === 'en' ? 'Early detection, skin cancer review, and diagnostic leadership across general dermatology.' : 'Deteccion temprana, revision de cancer de piel y liderazgo diagnostico en dermatologia general.', media: IMAGE_MAP.doctorRosero, services: getLocalizedServicesBySlugs(['diagnostico-integral', 'cancer-piel', 'piel-cabello-unas'], locale).map((service) => ({ label: service.hero, href: servicePath(locale, service.slug) })) },
            { name: locale === 'en' ? 'Dr. Carolina Narvaez' : 'Dra. Carolina Narvaez', role: locale === 'en' ? 'Medical aesthetics lead' : 'Lider de estetica medica', deck: locale === 'en' ? 'Laser, injectables, skin quality, and procedure-led programmes with medical framing.' : 'Laser, inyectables, calidad de piel y programas de procedimiento con criterio medico.', media: IMAGE_MAP.doctorNarvaez, services: getLocalizedServicesBySlugs(['botox', 'laser-dermatologico', 'mesoterapia'], locale).map((service) => ({ label: service.hero, href: servicePath(locale, service.slug) })) },
        ],
        booking: {
            eyebrow: locale === 'en' ? 'Booking' : 'Reserva',
            title: locale === 'en' ? 'The conversion layer stays intact, but it no longer defines the page language.' : 'La capa de conversion sigue intacta, pero ya no define el lenguaje visual de la pagina.',
            deck: locale === 'en' ? 'Start from a general assessment, a specific service hint, or telemedicine and keep the same appointment hooks.' : 'Empieza por valoracion general, por una pista de servicio o por telemedicina y conserva los mismos hooks de cita.',
            actionLabel: locale === 'en' ? 'Open booking' : 'Abrir reserva',
            serviceHint: 'consulta',
        },
    };
}

export function getHubV2Data(locale) {
    const grouped = groupServicesByFamily(locale);
    return {
        title: locale === 'en' ? 'Services | Piel en Armonia' : 'Servicios | Piel en Armonia',
        description: locale === 'en' ? 'Editorial service catalogue grouped by family, programme, and care mode.' : 'Catalogo editorial de servicios agrupado por familia, programa y modo de atencion.',
        hero: {
            eyebrow: locale === 'en' ? 'Services catalogue' : 'Catalogo de servicios',
            title: locale === 'en' ? 'A service hub rebuilt as an editorial catalogue, not as an internal finder.' : 'Un hub de servicios reconstruido como catalogo editorial, no como buscador interno.',
            deck: locale === 'en' ? 'Browse clinical, aesthetic, and pediatric dermatology through lighter tabs and featured family stories.' : 'Navega dermatologia clinica, estetica y pediatrica mediante tabs sobrias e historias destacadas por familia.',
            media: IMAGE_MAP.heroMain,
        },
        families: FAMILY_ORDER.map((family) => ({
            id: family,
            label: localizeCategory(family, locale),
            deck: getFamilyDeck(family, locale),
            media: serviceMediaForFamily(family),
            featured: buildServiceCard(grouped[family][0], locale),
            cards: grouped[family].map((service) => buildServiceCard(service, locale)),
        })),
        telemedicine: {
            eyebrow: locale === 'en' ? 'Care modes' : 'Modos de atencion',
            title: locale === 'en' ? 'Telemedicine remains part of the same system, not a detached route.' : 'Telemedicina sigue dentro del mismo sistema, no como ruta separada.',
            deck: locale === 'en' ? 'Use it when remote intake fits and escalate to clinic when the case demands examination or procedure.' : 'Usala cuando el intake remoto encaje y escala a consultorio cuando el caso necesite examen o procedimiento.',
            href: telemedicinePath(locale),
        },
        booking: {
            eyebrow: locale === 'en' ? 'Booking bridge' : 'Puente de reserva',
            title: locale === 'en' ? 'The catalogue leads into booking without flattening the editorial hierarchy.' : 'El catalogo entra a reserva sin aplastar la jerarquia editorial.',
            deck: locale === 'en' ? 'Service CTAs can still preselect the correct hint and preserve analytics metadata.' : 'Los CTA de servicio siguen pudiendo preseleccionar la pista correcta y conservar metadata analitica.',
            actionLabel: locale === 'en' ? 'Open booking' : 'Abrir reserva',
            serviceHint: 'consulta',
        },
    };
}

export function getServiceDetailV2Data(slug, locale) {
    const service = getLocalizedServiceBySlug(slug, locale);
    if (!service) return null;

    return {
        service,
        title: `${service.hero} | Piel en Armonia`,
        description: service.summary,
        family: service.category === 'children' ? 'children' : service.category,
        bookingHint: mapServiceHint(service.slug),
        hero: {
            slug: service.slug,
            category: service.category === 'children' ? 'children' : service.category,
            intent: SERVICE_INTENT_BY_SLUG[service.slug] || 'diagnosis',
            serviceHint: mapServiceHint(service.slug),
            eyebrow: localizeCategory(service.category, locale),
            title: service.hero,
            deck: service.summary,
            media: serviceMediaForFamily(service.category === 'children' ? 'children' : service.category),
            price: service.price_from,
            duration: service.duration,
        },
        story: {
            eyebrow: locale === 'en' ? 'Programme overview' : 'Resumen del programa',
            summary: locale === 'en' ? 'This route is framed as a care programme with diagnostic fit, treatment timing, and continuity.' : 'Esta ruta se presenta como un programa de cuidado con ajuste diagnostico, tiempos de tratamiento y continuidad.',
            indications: service.indications || [],
            audience: service.audience || [],
            doctors: localizeDoctorProfiles(service.doctor_profile, locale),
            faq: service.faq || [],
        },
        evidence: {
            eyebrow: locale === 'en' ? 'Eligibility and evidence' : 'Elegibilidad y evidencia',
            title: locale === 'en' ? 'What usually indicates fit, what requires caution, and how results are read.' : 'Que suele indicar buen ajuste, que requiere cautela y como se leen los resultados.',
            bullets: service.contraindications && service.contraindications.length > 0 ? service.contraindications : [locale === 'en' ? 'The final indication is confirmed in consultation according to skin, goals, and history.' : 'La indicacion final se confirma en consulta segun piel, objetivos y antecedentes.'],
            outcomes: locale === 'en' ? ['Initial clinical review', 'Expected timing by treatment type', 'Escalation to procedure or follow-up when needed'] : ['Revision clinica inicial', 'Ventanas esperadas segun tipo de tratamiento', 'Escalamiento a procedimiento o seguimiento cuando haga falta'],
        },
        timeline: {
            eyebrow: locale === 'en' ? 'Care timeline' : 'Timeline de cuidado',
            steps: locale === 'en' ? ['Assessment and fit confirmation', 'Preparation and medical briefing', 'Treatment or follow-up execution', 'Result review and continuity'] : ['Valoracion y confirmacion de ajuste', 'Preparacion e indicacion medica', 'Ejecucion de tratamiento o seguimiento', 'Revision de resultados y continuidad'],
        },
        related: getRelatedServices(slug, locale, 3).map((item) => buildServiceCard(item, locale)),
        booking: {
            eyebrow: locale === 'en' ? 'Booking bridge' : 'Puente de reserva',
            title: locale === 'en' ? 'Keep the current service hint, then move into the existing booking hooks.' : 'Conserva la pista del servicio actual y luego entra a los hooks de reserva existentes.',
            deck: locale === 'en' ? 'You can start from this detail view without losing the original programme context.' : 'Puedes empezar desde esta ficha sin perder el contexto original del programa.',
            actionLabel: locale === 'en' ? 'Book this route' : 'Reservar esta ruta',
            serviceHint: mapServiceHint(service.slug),
        },
    };
}

export function getTelemedicineV2Data(locale) {
    const dictionary = getDictionary(locale);
    return {
        title: locale === 'en' ? 'Telemedicine | Piel en Armonia' : 'Telemedicina | Piel en Armonia',
        description: locale === 'en' ? 'Remote dermatology intake and escalation as a premium editorial experience.' : 'Intake dermatologico remoto y escalamiento como una experiencia editorial premium.',
        hero: {
            eyebrow: dictionary.nav_telemedicine || (locale === 'en' ? 'Telemedicine' : 'Telemedicina'),
            title: locale === 'en' ? 'Telemedicine rebuilt as a service experience, not just a shortcut to conversion.' : 'Telemedicina reconstruida como experiencia de servicio, no solo como atajo a conversion.',
            deck: locale === 'en' ? 'Remote dermatology is presented with fit, workflow, and escalation logic before the booking layer appears.' : 'La dermatologia remota se presenta con ajuste, flujo de trabajo y logica de escalamiento antes de que aparezca la capa de reserva.',
            media: IMAGE_MAP.telemedicine,
        },
        howItWorks: {
            eyebrow: locale === 'en' ? 'How it works' : 'Como funciona',
            points: locale === 'en' ? ['Choose browser video, WhatsApp, or phone entry.', 'Share context and images before the consultation.', 'Escalate to clinic when examination or procedure is required.'] : ['Elige entrada por navegador, WhatsApp o llamada.', 'Comparte contexto e imagenes antes de la consulta.', 'Escala a consultorio cuando el caso requiera examen o procedimiento.'],
        },
        whoItFits: {
            eyebrow: locale === 'en' ? 'Who it fits' : 'Para quien encaja',
            points: locale === 'en' ? ['Acne and inflammatory control', 'Dermatitis follow-up and medication review', 'Spots, texture, and first-route questions'] : ['Control de acne e inflamacion', 'Seguimiento de dermatitis y revision de medicacion', 'Manchas, textura y dudas de primera ruta'],
        },
        escalation: {
            eyebrow: locale === 'en' ? 'Escalation model' : 'Modelo de escalamiento',
            points: locale === 'en' ? ['Move to diagnostic review when the case is broad.', 'Move to service detail when a procedure-led route is clearer.', 'Keep the same booking hooks and support channels.'] : ['Pasa a valoracion diagnostica cuando el caso sea amplio.', 'Pasa a ficha de servicio cuando la ruta procedural sea mas clara.', 'Conserva los mismos hooks de reserva y soporte.'],
        },
        booking: {
            eyebrow: locale === 'en' ? 'Booking bridge' : 'Puente de reserva',
            title: locale === 'en' ? 'Remote booking uses the same appointment hooks and can preselect the online mode.' : 'La reserva remota usa los mismos hooks de cita y puede preseleccionar la modalidad online.',
            deck: locale === 'en' ? 'You can still move directly into the existing appointment flow with the correct service hint.' : 'Puedes seguir entrando directo al flujo de cita existente con la pista correcta de servicio.',
            actionLabel: locale === 'en' ? 'Book telemedicine' : 'Reservar telemedicina',
            serviceHint: 'video',
        },
    };
}

export function getLegalPageV2Data(slug, locale) {
    const collection = LEGAL_PAGES[locale === 'en' ? 'en' : 'es'];
    const legal = collection[slug];
    if (!legal) return null;

    return {
        ...legal,
        supportBand: {
            eyebrow: locale === 'en' ? 'Support' : 'Soporte',
            title: locale === 'en' ? 'Legal pages stay connected to booking, telemedicine, and human support.' : 'Las paginas legales siguen conectadas con reserva, telemedicina y soporte humano.',
            deck: locale === 'en' ? 'Review policy first, then continue through the care route that matches your urgency and context.' : 'Revisa la politica y luego continua por la ruta de atencion que mejor encaje con tu urgencia y contexto.',
        },
    };
}

export function getLegalIndex(locale) {
    const collection = LEGAL_PAGES[locale === 'en' ? 'en' : 'es'];
    return Object.keys(collection).map((slug) => ({
        slug,
        title: collection[slug].title,
        href: locale === 'en' ? `/en/legal/${slug}/` : `/es/legal/${slug}/`,
    }));
}

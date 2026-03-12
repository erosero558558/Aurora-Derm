(function () {
    'use strict';

    const STORAGE_KEY = 'language';
    const SUPPORTED_LANGS = ['es', 'en'];

    const common = {
        es: {
            brand: 'Aurora Derm',
            updated: '\u00daltima actualizaci\u00f3n: 18 de febrero de 2026',
            link_terms: 'T\u00e9rminos y Condiciones',
            link_privacy: 'Pol\u00edtica de Privacidad',
            link_cookies: 'Pol\u00edtica de Cookies',
            link_medical: 'Aviso de Responsabilidad M\u00e9dica',
            link_home: 'Volver al inicio',
            lang_selector: 'Selector de idioma',
        },
        en: {
            brand: 'Aurora Derm',
            updated: 'Last updated: February 18, 2026',
            link_terms: 'Terms and Conditions',
            link_privacy: 'Privacy Policy',
            link_cookies: 'Cookie Policy',
            link_medical: 'Medical Disclaimer',
            link_home: 'Back to home',
            lang_selector: 'Language selector',
        },
    };

    const pages = {
        terms: {
            es: {
                page_title:
                    'T\u00e9rminos y Condiciones | Aurora Derm',
                h1: 'T\u00e9rminos y Condiciones',
                intro: 'Estos t\u00e9rminos regulan el uso del sitio web, formularios de agendamiento, pagos en l\u00ednea y servicios digitales de Aurora Derm.',
                s1_title: '1. Uso del sitio',
                s1_li1: 'El usuario debe ingresar datos reales y actualizados para citas, pagos y contacto.',
                s1_li2: 'Se proh\u00edbe el uso del sitio para actividades fraudulentas o no relacionadas con atenci\u00f3n dermatol\u00f3gica.',
                s2_title: '2. Citas y pagos',
                s2_li1: 'Las reservas pueden requerir pago con tarjeta, transferencia o pago en consultorio.',
                s2_li2: 'Las transacciones con tarjeta se procesan mediante pasarela externa (Stripe).',
                s2_li3: 'El env\u00edo de comprobantes de transferencia queda sujeto a validaci\u00f3n administrativa.',
                s3_title: '3. Cancelaciones y reprogramaci\u00f3n',
                s3_li1: 'La reprogramaci\u00f3n sin costo aplica hasta 24 horas antes de la cita, sujeta a disponibilidad.',
                s3_li2: 'Cancelaciones de \u00faltimo momento o inasistencias pueden requerir revisi\u00f3n administrativa.',
                s3_li3: 'Para soporte inmediato: WhatsApp 098 245 3672.',
                s4_title: '4. Teledermatologia y chatbot',
                s4_li1: 'La orientaci\u00f3n por chatbot y canales digitales no reemplaza una evaluaci\u00f3n m\u00e9dica presencial o por teledermatologia cuando sea necesaria.',
                s4_li2: 'En emergencias, se debe acudir de inmediato a un servicio de urgencias.',
                s5_title: '5. Limitaci\u00f3n de responsabilidad',
                s5_p1: 'La informaci\u00f3n del sitio es referencial y puede actualizarse sin previo aviso. La decisi\u00f3n cl\u00ednica final depende de una evaluaci\u00f3n profesional realizada por personal m\u00e9dico autorizado.',
                s6_title: '6. Contacto legal',
                s6_li1: 'Dr. Javier Rosero: javier.rosero94@gmail.com',
                s6_li2: 'Dra. Carolina Narv\u00e1ez: caro93narvaez@gmail.com | 098 786 6885',
            },
            en: {
                page_title: 'Terms and Conditions | Aurora Derm',
                h1: 'Terms and Conditions',
                intro: 'These terms govern the use of the website, appointment forms, online payments, and digital services provided by Aurora Derm.',
                s1_title: '1. Website use',
                s1_li1: 'Users must provide real and updated information for appointments, payments, and contact.',
                s1_li2: 'Using this website for fraudulent activities or for purposes unrelated to dermatological care is prohibited.',
                s2_title: '2. Appointments and payments',
                s2_li1: 'Bookings may require payment by card, bank transfer, or in-clinic payment.',
                s2_li2: 'Card transactions are processed through an external payment gateway (Stripe).',
                s2_li3: 'Transfer receipts are subject to administrative validation.',
                s3_title: '3. Cancellations and rescheduling',
                s3_li1: 'Free rescheduling applies up to 24 hours before the appointment, subject to availability.',
                s3_li2: 'Last-minute cancellations or no-shows may require administrative review.',
                s3_li3: 'For immediate support: WhatsApp 098 245 3672.',
                s4_title: '4. Teledermatology and chatbot',
                s4_li1: 'Guidance provided through the chatbot and digital channels does not replace an in-person or teledermatology medical evaluation when required.',
                s4_li2: 'In emergencies, you must go immediately to an emergency care service.',
                s5_title: '5. Limitation of liability',
                s5_p1: 'Website information is for reference and may be updated without prior notice. Final clinical decisions depend on a professional evaluation performed by authorized medical staff.',
                s6_title: '6. Legal contact',
                s6_li1: 'Dr. Javier Rosero: javier.rosero94@gmail.com',
                s6_li2: 'Dr. Carolina Narvaez: caro93narvaez@gmail.com | 098 786 6885',
            },
        },
        privacy: {
            es: {
                page_title:
                    'Pol\u00edtica de Privacidad | Aurora Derm',
                h1: 'Pol\u00edtica de Privacidad',
                intro: 'Esta pol\u00edtica describe c\u00f3mo Aurora Derm recopila, usa y protege los datos personales y de salud compartidos por pacientes y usuarios.',
                s1_title: '1. Datos que recopilamos',
                s1_li1: 'Identificaci\u00f3n y contacto: nombre, tel\u00e9fono y correo electr\u00f3nico.',
                s1_li2: 'Datos de atenci\u00f3n: servicio, fecha, hora y profesional seleccionado.',
                s1_li3: 'Datos de pago y soporte: referencia de transferencia, comprobante y estado de pago.',
                s1_li4: 'Datos t\u00e9cnicos: IP, fecha y hora de acceso, y eventos de seguridad/auditor\u00eda.',
                s2_title: '2. Finalidades del tratamiento',
                s2_li1: 'Gesti\u00f3n de citas m\u00e9dicas y seguimiento administrativo.',
                s2_li2: 'Procesamiento y verificaci\u00f3n de pagos.',
                s2_li3: 'Seguridad, auditor\u00eda y prevenci\u00f3n de fraude.',
                s2_li4: 'Comunicaci\u00f3n con el paciente por tel\u00e9fono, email o WhatsApp.',
                s3_title: '3. Base legal y normativa aplicable',
                s3_p1: 'El tratamiento se realiza de acuerdo con la Ley Org\u00e1nica de Protecci\u00f3n de Datos Personales del Ecuador y, cuando aplique, con principios del GDPR para pacientes en la Uni\u00f3n Europea.',
                s4_title: '4. Conservaci\u00f3n y seguridad',
                s4_li1: 'Se aplican controles de acceso, registros de auditor\u00eda y protecci\u00f3n de sesi\u00f3n.',
                s4_li2: 'Se implementan medidas razonables para proteger la confidencialidad de la informaci\u00f3n cl\u00ednica y administrativa.',
                s4_li3: 'Los datos se conservan durante el tiempo necesario para fines asistenciales, administrativos y legales.',
                s5_title: '5. Derechos del titular',
                s5_p1: 'El titular puede solicitar acceso, rectificaci\u00f3n, actualizaci\u00f3n, eliminaci\u00f3n y oposici\u00f3n al tratamiento de sus datos, conforme la normativa vigente.',
                s6_title: '6. Contacto para privacidad',
                s6_li1: 'Dr. Javier Rosero: javier.rosero94@gmail.com',
                s6_li2: 'Dra. Carolina Narv\u00e1ez: caro93narvaez@gmail.com | 098 786 6885',
                s6_li3: 'WhatsApp de la cl\u00ednica: 098 245 3672',
                note: '<strong>Importante:</strong> Ninguna medida t\u00e9cnica garantiza riesgo cero. Aurora Derm mantiene un proceso continuo de mejora en seguridad y cumplimiento.',
            },
            en: {
                page_title: 'Privacy Policy | Aurora Derm',
                h1: 'Privacy Policy',
                intro: 'This policy describes how Aurora Derm collects, uses, and protects personal and health data shared by patients and users.',
                s1_title: '1. Data we collect',
                s1_li1: 'Identification and contact data: name, phone number, and email.',
                s1_li2: 'Care-related data: selected service, date, time, and professional.',
                s1_li3: 'Payment and support data: transfer reference, receipt, and payment status.',
                s1_li4: 'Technical data: IP, access date/time, and security or audit events.',
                s2_title: '2. Processing purposes',
                s2_li1: 'Management of medical appointments and administrative follow-up.',
                s2_li2: 'Payment processing and verification.',
                s2_li3: 'Security, auditing, and fraud prevention.',
                s2_li4: 'Communication with patients via phone, email, or WhatsApp.',
                s3_title: '3. Legal basis and applicable regulations',
                s3_p1: "Data processing follows Ecuador's Organic Law on Personal Data Protection and, where applicable, GDPR principles for patients in the European Union.",
                s4_title: '4. Retention and security',
                s4_li1: 'Access controls, audit logs, and session protection are applied.',
                s4_li2: 'Reasonable safeguards are implemented to protect clinical and administrative confidentiality.',
                s4_li3: 'Data is retained for the period required for clinical, administrative, and legal purposes.',
                s5_title: '5. Data subject rights',
                s5_p1: 'Data subjects may request access, rectification, update, deletion, and objection to processing, in accordance with applicable law.',
                s6_title: '6. Privacy contact',
                s6_li1: 'Dr. Javier Rosero: javier.rosero94@gmail.com',
                s6_li2: 'Dr. Carolina Narvaez: caro93narvaez@gmail.com | 098 786 6885',
                s6_li3: 'Clinic WhatsApp: 098 245 3672',
                note: '<strong>Important:</strong> No technical measure can guarantee zero risk. Aurora Derm maintains an ongoing process to improve security and compliance.',
            },
        },
        cookies: {
            es: {
                page_title: 'Pol\u00edtica de Cookies | Piel en Armon\u00eda',
                h1: 'Pol\u00edtica de Cookies',
                intro: 'Este sitio utiliza cookies y almacenamiento local para brindar una experiencia segura, estable y personalizada.',
                s1_title: '1. Cookies esenciales',
                s1_li1: 'Autenticaci\u00f3n y sesi\u00f3n del panel administrativo.',
                s1_li2: 'Protecci\u00f3n CSRF y controles de seguridad.',
                s1_li3: 'Preferencias t\u00e9cnicas de interfaz (idioma, tema y consentimientos).',
                s2_title: '2. Cookies opcionales',
                s2_li1: 'Las cookies anal\u00edticas o de mejora solo se activan con consentimiento del usuario.',
                s2_li2: 'Si no se aceptan, el sitio seguir\u00e1 funcionando con cookies esenciales.',
                s3_title: '3. Gesti\u00f3n del consentimiento',
                s3_li1: 'Al ingresar al sitio se muestra un banner para aceptar o rechazar cookies opcionales.',
                s3_li2: 'Las preferencias se guardan localmente y pueden modificarse eliminando datos del navegador.',
                s4_title: '4. C\u00f3mo deshabilitar cookies',
                s4_p1: 'Tambi\u00e9n puedes bloquear cookies desde la configuraci\u00f3n de tu navegador. Esto puede afectar algunas funcionalidades del sitio.',
            },
            en: {
                page_title: 'Cookie Policy | Aurora Derm',
                h1: 'Cookie Policy',
                intro: 'This website uses cookies and local storage to provide a secure, stable, and personalized experience.',
                s1_title: '1. Essential cookies',
                s1_li1: 'Administrative panel authentication and session management.',
                s1_li2: 'CSRF protection and security controls.',
                s1_li3: 'Technical interface preferences (language, theme, and consents).',
                s2_title: '2. Optional cookies',
                s2_li1: 'Analytics or improvement cookies are enabled only with user consent.',
                s2_li2: 'If rejected, the website will continue to work using essential cookies.',
                s3_title: '3. Consent management',
                s3_li1: 'A banner is shown on site entry to accept or reject optional cookies.',
                s3_li2: 'Preferences are stored locally and can be changed by clearing browser data.',
                s4_title: '4. How to disable cookies',
                s4_p1: 'You can also block cookies in your browser settings. This may affect some website features.',
            },
        },
        medical: {
            es: {
                page_title:
                    'Aviso de Responsabilidad M\u00e9dica | Aurora Derm',
                h1: 'Aviso de Responsabilidad M\u00e9dica',
                intro: 'El contenido del sitio, las respuestas del chatbot y los mensajes informativos son orientativos y no sustituyen una consulta m\u00e9dica presencial o por teledermatologia con evaluaci\u00f3n cl\u00ednica completa.',
                s1_title: '1. Alcance del chatbot',
                s1_li1: 'El asistente virtual ayuda con informaci\u00f3n de servicios, precios, reservas y orientaci\u00f3n general.',
                s1_li2: 'No emite diagn\u00f3sticos definitivos ni prescribe tratamientos personalizados.',
                s2_title: '2. Emergencias',
                s2_p1: 'Si presentas s\u00edntomas graves, sangrado activo, reacciones severas o cualquier emergencia, debes acudir inmediatamente a urgencias.',
                s3_title: '3. Decisiones cl\u00ednicas',
                s3_p1: 'Toda decisi\u00f3n diagn\u00f3stica y terap\u00e9utica debe ser confirmada por un profesional de salud autorizado tras una evaluaci\u00f3n m\u00e9dica adecuada.',
                s4_title: '4. Cumplimiento y buenas pr\u00e1cticas',
                s4_p1: 'Aurora Derm implementa controles de seguridad y privacidad alineados con la Ley Org\u00e1nica de Protecci\u00f3n de Datos Personales del Ecuador, normativa sanitaria aplicable y buenas pr\u00e1cticas internacionales de protecci\u00f3n de informaci\u00f3n cl\u00ednica.',
                note: '<strong>Nota:</strong> Referencias a marcos internacionales (como HIPAA) se usan como gu\u00eda de buenas pr\u00e1cticas y no implican certificaci\u00f3n autom\u00e1tica en todas las jurisdicciones.',
                s5_title: '5. Contacto m\u00e9dico',
                s5_li1: 'Dr. Javier Rosero: javier.rosero94@gmail.com',
                s5_li2: 'Dra. Carolina Narv\u00e1ez: caro93narvaez@gmail.com | 098 786 6885',
                s5_li3: 'WhatsApp de la cl\u00ednica: 098 245 3672',
            },
            en: {
                page_title: 'Medical Disclaimer | Aurora Derm',
                h1: 'Medical Disclaimer',
                intro: 'Website content, chatbot responses, and informational messages are for guidance only and do not replace an in-person or teledermatology consultation with full clinical evaluation.',
                s1_title: '1. Chatbot scope',
                s1_li1: 'The virtual assistant helps with information about services, pricing, bookings, and general guidance.',
                s1_li2: 'It does not issue definitive diagnoses or prescribe personalized treatments.',
                s2_title: '2. Emergencies',
                s2_p1: 'If you have severe symptoms, active bleeding, severe reactions, or any emergency, seek emergency care immediately.',
                s3_title: '3. Clinical decisions',
                s3_p1: 'All diagnostic and therapeutic decisions must be confirmed by an authorized healthcare professional after an appropriate medical evaluation.',
                s4_title: '4. Compliance and best practices',
                s4_p1: "Aurora Derm applies security and privacy controls aligned with Ecuador's Organic Law on Personal Data Protection, applicable health regulations, and international best practices for protecting clinical information.",
                note: '<strong>Note:</strong> References to international frameworks (such as HIPAA) are used as best-practice guidance and do not imply automatic certification in all jurisdictions.',
                s5_title: '5. Medical contact',
                s5_li1: 'Dr. Javier Rosero: javier.rosero94@gmail.com',
                s5_li2: 'Dr. Carolina Narvaez: caro93narvaez@gmail.com | 098 786 6885',
                s5_li3: 'Clinic WhatsApp: 098 245 3672',
            },
        },
    };

    const pageName =
        document.body && document.body.dataset
            ? document.body.dataset.legalPage
            : '';

    if (!pageName || !pages[pageName]) {
        return;
    }

    function readStoredLanguage() {
        try {
            const value = localStorage.getItem(STORAGE_KEY);
            return SUPPORTED_LANGS.includes(value) ? value : null;
        } catch (_e) {
            return null;
        }
    }

    function saveLanguage(lang) {
        try {
            localStorage.setItem(STORAGE_KEY, lang);
        } catch (_e) {
            // Ignore storage failures in private mode.
        }
    }

    function inferBrowserLanguage() {
        const navLang = (navigator.language || 'es').toLowerCase();
        return navLang.startsWith('en') ? 'en' : 'es';
    }

    function updateLanguageButtons(lang) {
        document.querySelectorAll('.lang-btn[data-lang]').forEach((button) => {
            const isActive = button.dataset.lang === lang;
            button.classList.toggle('active', isActive);
            button.setAttribute('aria-pressed', String(isActive));
        });
    }

    function buildDictionary(lang) {
        const pageDict = pages[pageName][lang] || pages[pageName].es;
        const commonDict = common[lang] || common.es;
        return Object.assign({}, commonDict, pageDict);
    }

    function applyLanguage(lang) {
        if (!SUPPORTED_LANGS.includes(lang)) {
            return;
        }

        const dict = buildDictionary(lang);
        document.documentElement.lang = lang;

        if (dict.page_title) {
            document.title = dict.page_title;
        }

        const switchContainer = document.querySelector('.legal-lang-switch');
        if (switchContainer && dict.lang_selector) {
            switchContainer.setAttribute('aria-label', dict.lang_selector);
        }

        document.querySelectorAll('[data-i18n]').forEach((element) => {
            const key = element.getAttribute('data-i18n');
            if (!key || typeof dict[key] !== 'string') {
                return;
            }
            element.innerHTML = dict[key];
        });

        updateLanguageButtons(lang);
        saveLanguage(lang);
    }

    document.querySelectorAll('.lang-btn[data-lang]').forEach((button) => {
        button.addEventListener('click', () => {
            applyLanguage(button.dataset.lang);
        });
    });

    const initialLang = readStoredLanguage() || inferBrowserLanguage();
    applyLanguage(initialLang);
})();

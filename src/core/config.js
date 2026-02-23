export const API_ENDPOINT = '/api.php';
export const CLINIC_ADDRESS = 'Dr. Cecilio Caiza e hijas, Quito, Ecuador';
export const CLINIC_MAP_URL =
    'https://www.google.com/maps/place/Dr.+Cecilio+Caiza+e+hijas/@-0.1740225,-78.4865596,15z/data=!4m6!3m5!1s0x91d59b0024fc4507:0xdad3a4e6c831c417!8m2!3d-0.2165855!4d-78.4998702!16s%2Fg%2F11vpt0vjj1?entry=ttu&g_ep=EgoyMDI2MDIxMS4wIKXMDSoASAFQAw%3D%3D';
export const DOCTOR_CAROLINA_PHONE = '+593 98 786 6885';
export const DOCTOR_CAROLINA_EMAIL = 'caro93narvaez@gmail.com';
export const MAX_CASE_PHOTOS = 3;
export const MAX_CASE_PHOTO_BYTES = 5 * 1024 * 1024;
export const CASE_PHOTO_ALLOWED_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
]);
export const COOKIE_CONSENT_KEY = 'pa_cookie_consent_v1';
export const API_REQUEST_TIMEOUT_MS = 9000;
export const API_RETRY_BASE_DELAY_MS = 450;
export const API_DEFAULT_RETRIES = 1;
export const API_SLOW_NOTICE_MS = 1200;
export const API_SLOW_NOTICE_COOLDOWN_MS = 25000;
export const AVAILABILITY_CACHE_TTL_MS = 5 * 60 * 1000;
export const BOOKED_SLOTS_CACHE_TTL_MS = 45 * 1000;
export const DEFAULT_PUBLIC_REVIEWS = [
    {
        id: 'google-jose-gancino',
        name: 'Jose Gancino',
        rating: 5,
        text: 'Buena atención solo falta los números de la oficina y horarios de atención.',
        date: '2025-10-01T10:00:00-05:00',
        verified: true,
    },
    {
        id: 'google-jacqueline-ruiz-torres',
        name: 'Jacqueline Ruiz Torres',
        rating: 5,
        text: 'Exelente atención y económico 🙏🤗👌',
        date: '2025-04-15T10:00:00-05:00',
        verified: true,
    },
    {
        id: 'google-cris-lema',
        name: 'Cris Lema',
        rating: 5,
        text: '',
        date: '2025-10-10T10:00:00-05:00',
        verified: true,
    },
    {
        id: 'google-camila-escobar',
        name: 'Camila Escobar',
        rating: 5,
        text: '',
        date: '2025-02-01T10:00:00-05:00',
        verified: true,
    },
];
export const DEFAULT_TIME_SLOTS = [
    '09:00',
    '10:00',
    '11:00',
    '12:00',
    '15:00',
    '16:00',
    '17:00',
];
export const LOCAL_FALLBACK_ENABLED = window.location.protocol === 'file:';
export const THEME_STORAGE_KEY = 'themeMode';
export const VALID_THEME_MODES = new Set(['light', 'dark', 'system']);
export const KIMI_CONFIG = {
    apiUrl: '/figo-chat.php',
    model: 'figo-assistant',
    maxTokens: 1000,
    temperature: 0.7,
};
export const SYSTEM_PROMPT = `Eres el Dr. Virtual, asistente inteligente de la clínica dermatológica "Piel en Armonía" en Quito, Ecuador.

INFORMACIÓN DE LA CLÍNICA:
- Nombre: Piel en Armonía
- Doctores: Dr. Javier Rosero (Dermatólogo Clínico) y Dra. Carolina Narváez (Dermatóloga Estética)
- Dirección: ${CLINIC_ADDRESS}
- Teléfono/WhatsApp: +593 98 245 3672
- Contacto Dra. Carolina: ${DOCTOR_CAROLINA_PHONE} | ${DOCTOR_CAROLINA_EMAIL}
- Horario: Lunes-Viernes 9:00-18:00, Sábados 9:00-13:00
- Estacionamiento privado disponible

SERVICIOS Y PRECIOS (con IVA incluido):
- Consulta Dermatológica: $40.00 (IVA 0% - servicio de salud)
- Consulta Telefónica: $25.00 (IVA 0%)
- Video Consulta: $30.00 (IVA 0%)
- Tratamiento Láser: desde $172.50 (Base $150 + IVA 15%)
- Rejuvenecimiento: desde $138.00 (Base $120 + IVA 15%)
- Tratamiento de Acné: desde $80.00 (IVA 0%)
- Detección de Cáncer de Piel: desde $70.00 (IVA 0%)

NOTAS IMPORTANTES:
- Los servicios clínicos (salud) tienen IVA 0%
- Los servicios estéticos y láser tienen IVA 15%
- Servicios marcados con "desde" requieren valoración previa
- Cupos solidarios disponibles para pacientes con limitaciones económicas

OPCIONES DE CONSULTA ONLINE:
1. Llamada telefónica: tel:+593982453672
2. WhatsApp Video: https://wa.me/593982453672
3. Video Web (Jitsi): https://meet.jit.si/PielEnArmonia-Consulta

INSTRUCCIONES:
- Sé profesional, amable y empático
- Responde en español (o en el idioma que use el paciente)
- Si el paciente tiene síntomas graves o emergencias, recomienda acudir a urgencias
- Para agendar citas, dirige al formulario web, WhatsApp o llamada telefónica
- Si no sabes algo específico, ofrece transferir al doctor real
- No hagas diagnósticos médicos definitivos, solo orientación general
- Usa emojis ocasionalmente para ser amigable
- Mantén respuestas concisas pero informativas

Tu objetivo es ayudar a los pacientes a:
1. Conocer los servicios de la clínica
2. Entender los precios
3. Agendar citas
4. Resolver dudas básicas sobre dermatología
5. Conectar con un doctor real cuando sea necesario`;

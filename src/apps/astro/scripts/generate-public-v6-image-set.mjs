import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const SRC_DIR = path.join(ROOT, 'images', 'src');
const OPTIMIZED_DIR = path.join(ROOT, 'images', 'optimized');
const MANIFEST_PATH = path.join(
    ROOT,
    'content',
    'public-v6',
    'assets-manifest.json'
);

const KIND_SPECS = {
    wide: {
        aspect: 0.5,
        sizes: [400, 640, 800, 1024, 1200, 1344, 1400],
        lqip: 56,
    },
    card: {
        aspect: 0.78,
        sizes: [400, 640, 800, 900, 1200, 1400],
        lqip: 56,
    },
    portrait: {
        aspect: 1.2,
        sizes: [500, 900],
        lqip: 72,
    },
};

const KIND_DEFAULT_SIZES = {
    wide: '(max-width: 900px) 100vw, 48vw',
    card: '(max-width: 900px) 100vw, 33vw',
    portrait: '(max-width: 900px) 100vw, 40vw',
};

const ASSETS = [
    {
        id: 'v6-clinic-brand-hero-wide',
        kind: 'wide',
        scene: 'brand',
        palette: ['#0b1220', '#1e3b5c', '#6db7ff', '#ffe4d4'],
        accent: '#7fd1ff',
        altEs: 'Panoramica editorial del entorno clinico dermatologico',
        altEn: 'Editorial panorama of the dermatology clinical environment',
    },
    {
        id: 'v6-clinic-home-followup',
        kind: 'card',
        scene: 'consultation',
        palette: ['#111d2d', '#345871', '#9bd5cf', '#f1ddd1'],
        accent: '#8fe3b2',
        altEs: 'Seguimiento dermatologico con comparacion de avance y ajustes',
        altEn: 'Dermatology follow-up with progress comparison and adjustments',
    },
    {
        id: 'v6-clinic-team-roundtable',
        kind: 'card',
        scene: 'brand',
        palette: ['#0d1524', '#28425f', '#88c6ff', '#f2ddd1'],
        accent: '#9ae6d0',
        altEs: 'Equipo dermatologico revisando decisiones de forma conjunta',
        altEn: 'Dermatology team reviewing decisions together',
    },
    {
        id: 'v6-clinic-hub-editorial-map',
        kind: 'wide',
        scene: 'tri-panel',
        palette: ['#0d1623', '#284764', '#93cfff', '#f4dfd2'],
        accent: '#86d7ff',
        altEs: 'Mapa editorial de rutas dermatologicas y decisiones clinicas',
        altEn: 'Editorial map of dermatology routes and clinical decisions',
    },
    {
        id: 'v6-clinic-clinic-environment',
        kind: 'card',
        scene: 'clinic',
        palette: ['#09131f', '#204266', '#88c8f7', '#f2e3d7'],
        accent: '#86d9d2',
        altEs: 'Consultorio dermatologico preparado para una evaluacion tranquila',
        altEn: 'Dermatology clinic prepared for a calm evaluation',
    },
    {
        id: 'v6-clinic-consent-trust',
        kind: 'card',
        scene: 'consent',
        palette: ['#101826', '#2b4564', '#a8d8ff', '#f7d2c4'],
        accent: '#ffb49a',
        altEs: 'Acompanamiento clinico con explicacion y consentimiento claro',
        altEn: 'Clinical guidance with clear explanation and consent',
    },
    {
        id: 'v6-clinic-telemedicine-intake',
        kind: 'card',
        scene: 'consent',
        palette: ['#121926', '#325073', '#a9d9ff', '#f8d9c7'],
        accent: '#ffba9f',
        altEs: 'Inicio de telemedicina con contexto clinico e imagenes',
        altEn: 'Telemedicine intake with clinical context and imaging',
    },
    {
        id: 'v6-clinic-telemedicine-review',
        kind: 'card',
        scene: 'macro-study',
        palette: ['#111a27', '#2f4b67', '#8ec2ff', '#f3ddd0'],
        accent: '#7fe0d5',
        altEs: 'Revision dermatologica remota con seguimiento y ajuste',
        altEn: 'Remote dermatology review with follow-up and adjustment',
    },
    {
        id: 'v6-clinic-legal-governance',
        kind: 'card',
        scene: 'clinic',
        palette: ['#131925', '#384a5d', '#b8d0ff', '#efe0d4'],
        accent: '#f7c77f',
        altEs: 'Privacidad, consentimiento y reglas del sitio en un marco claro',
        altEn: 'Privacy, consent, and site rules framed with clarity',
    },
    {
        id: 'v6-clinic-statement-clinical-direction',
        kind: 'card',
        scene: 'consultation',
        palette: ['#101a28', '#2f4f73', '#9cd2ff', '#f0dbcf'],
        accent: '#9fe3ff',
        altEs: 'Direccion clinica dermatologica con lectura estructurada',
        altEn: 'Clinical dermatology direction with a structured read',
    },
    {
        id: 'v6-clinic-statement-procedure-guidance',
        kind: 'card',
        scene: 'precision-procedure',
        palette: ['#151827', '#415066', '#b6c8ff', '#f1ddd2'],
        accent: '#8ed5ff',
        altEs: 'Guia dermatologica para procedimientos indicados',
        altEn: 'Dermatology guidance for indicated procedures',
    },
    {
        id: 'v6-clinic-statement-family-support',
        kind: 'card',
        scene: 'family',
        palette: ['#14202c', '#37536a', '#a6d7f4', '#f6e0ce'],
        accent: '#ffd47d',
        altEs: 'Acompanamiento dermatologico familiar y seguimiento compartido',
        altEn: 'Family dermatology support and shared follow-up',
    },
    {
        id: 'v6-clinic-diagnostico-integral',
        kind: 'card',
        scene: 'consultation',
        palette: ['#0e1724', '#29507a', '#9fd0ff', '#f0d7ca'],
        accent: '#9ce1ff',
        altEs: 'Consulta dermatologica integral con lectura inicial estructurada',
        altEn: 'Comprehensive dermatology consultation with structured first review',
    },
    {
        id: 'v6-clinic-acne-rosacea',
        kind: 'card',
        scene: 'macro-study',
        palette: ['#1a1220', '#4b3559', '#ffb3c9', '#ffe9ef'],
        accent: '#ff8bb3',
        altEs: 'Seguimiento dermatologico de inflamacion y sensibilidad cutanea',
        altEn: 'Dermatology follow-up for inflammation and skin sensitivity',
    },
    {
        id: 'v6-clinic-verrugas',
        kind: 'card',
        scene: 'precision-procedure',
        palette: ['#111827', '#304c68', '#93c5fd', '#e7d6c5'],
        accent: '#5fd0c2',
        altEs: 'Procedimiento dermatologico de precision para lesiones localizadas',
        altEn: 'Precision dermatology procedure for localized lesions',
    },
    {
        id: 'v6-clinic-granitos-brazos-piernas',
        kind: 'card',
        scene: 'texture-study',
        palette: ['#121c2a', '#335372', '#9ac8ef', '#efe6db'],
        accent: '#b4e08d',
        altEs: 'Evaluacion de textura cutanea y control de barrera',
        altEn: 'Skin texture evaluation and barrier care control',
    },
    {
        id: 'v6-clinic-cicatrices',
        kind: 'card',
        scene: 'repair-grid',
        palette: ['#141620', '#38435e', '#b3c8ff', '#e8d3c3'],
        accent: '#a3e1c6',
        altEs: 'Ruta dermatologica para relieve, tono y reparacion visible',
        altEn: 'Dermatology route for visible texture, tone, and repair',
    },
    {
        id: 'v6-clinic-cancer-piel',
        kind: 'card',
        scene: 'dermatoscopy',
        palette: ['#10171f', '#243f5d', '#8eb8e8', '#eed7c8'],
        accent: '#ffd280',
        altEs: 'Dermatoscopia y lectura de lesiones con criterios de alarma',
        altEn: 'Dermatoscopy and lesion review with warning criteria',
    },
    {
        id: 'v6-clinic-peeling-quimico',
        kind: 'card',
        scene: 'renewal',
        palette: ['#171521', '#4a4067', '#d0c1ff', '#f7dccf'],
        accent: '#ffca8d',
        altEs: 'Preparacion dermatologica para renovacion cutanea controlada',
        altEn: 'Dermatology preparation for controlled skin renewal',
    },
    {
        id: 'v6-clinic-mesoterapia',
        kind: 'card',
        scene: 'micro-protocol',
        palette: ['#18131e', '#4e3860', '#d5c0ff', '#ffe5db'],
        accent: '#f9b4d0',
        altEs: 'Protocolo dermoestetico de soporte e hidratacion profunda',
        altEn: 'Dermoaesthetic protocol for deep support and hydration',
    },
    {
        id: 'v6-clinic-laser-dermatologico',
        kind: 'card',
        scene: 'laser',
        palette: ['#0b1420', '#274262', '#86b5ff', '#eed4c5'],
        accent: '#60d2ff',
        altEs: 'Plataforma laser dermatologica con parametros controlados',
        altEn: 'Dermatology laser platform with controlled settings',
    },
    {
        id: 'v6-clinic-botox',
        kind: 'card',
        scene: 'precision-face',
        palette: ['#16131f', '#473b63', '#ceb8ff', '#f7e3da'],
        accent: '#ffb0a1',
        altEs: 'Evaluacion de armonia facial con criterio dermatologico',
        altEn: 'Facial harmony evaluation with dermatology judgment',
    },
    {
        id: 'v6-clinic-bioestimuladores-colageno',
        kind: 'card',
        scene: 'collagen',
        palette: ['#15131d', '#4f3f60', '#d6c1ff', '#f6ddd0'],
        accent: '#f6b26b',
        altEs: 'Soporte de firmeza y calidad cutanea con enfoque medico',
        altEn: 'Firmness and skin quality support with a medical approach',
    },
    {
        id: 'v6-clinic-piel-cabello-unas',
        kind: 'card',
        scene: 'tri-panel',
        palette: ['#101927', '#2b4c72', '#9cc9ee', '#eddccf'],
        accent: '#8be2b0',
        altEs: 'Ruta integral para piel, cabello y unas con lectura coordinada',
        altEn: 'Integrated skin, hair, and nails route with coordinated review',
    },
    {
        id: 'v6-clinic-dermatologia-pediatrica',
        kind: 'card',
        scene: 'family',
        palette: ['#15202c', '#30526e', '#a5d5f3', '#f4dfcc'],
        accent: '#ffd66b',
        altEs: 'Consulta dermatologica pediatrica con acompanamiento familiar',
        altEn: 'Pediatric dermatology consultation with family support',
    },
    {
        id: 'v6-clinic-doctor-rosero',
        kind: 'portrait',
        scene: 'portrait-a',
        palette: ['#111a28', '#284767', '#7eb6ff', '#f0d7c6'],
        accent: '#9fe3ff',
        altEs: 'Direccion clinica dermatologica',
        altEn: 'Clinical dermatology leadership',
    },
    {
        id: 'v6-clinic-doctor-narvaez',
        kind: 'portrait',
        scene: 'portrait-b',
        palette: ['#171421', '#473c64', '#c8b4ff', '#f4ddcf'],
        accent: '#ffb0c3',
        altEs: 'Direccion de estetica medica dermatologica',
        altEn: 'Medical aesthetics dermatology leadership',
    },
];

function ensureDirectory(dir) {
    fs.mkdirSync(dir, { recursive: true });
}

function hashString(input) {
    let hash = 2166136261;
    for (const char of String(input)) {
        hash ^= char.charCodeAt(0);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

function rng(seed) {
    let value = seed >>> 0;
    return () => {
        value = (1664525 * value + 1013904223) >>> 0;
        return value / 0xffffffff;
    };
}

function round(value) {
    return Math.round(value);
}

function svgNode(tag, attrs, body = '') {
    const serialized = Object.entries(attrs)
        .filter(
            ([, value]) => value !== undefined && value !== null && value !== ''
        )
        .map(
            ([key, value]) =>
                `${key}="${String(value).replace(/"/g, '&quot;')}"`
        )
        .join(' ');
    return `<${tag}${serialized ? ` ${serialized}` : ''}>${body}</${tag}>`;
}

function circle(cx, cy, r, fill, opacity = 1, extra = {}) {
    return svgNode('circle', {
        cx,
        cy,
        r,
        fill,
        opacity,
        stroke: extra.stroke,
        'stroke-width': extra.strokeWidth,
        filter: extra.filter,
    });
}

function ellipse(cx, cy, rx, ry, fill, opacity = 1, extra = {}) {
    return svgNode('ellipse', {
        cx,
        cy,
        rx,
        ry,
        fill,
        opacity,
        stroke: extra.stroke,
        'stroke-width': extra.strokeWidth,
        filter: extra.filter,
    });
}

function rect(x, y, width, height, fill, extra = {}) {
    return svgNode('rect', {
        x,
        y,
        width,
        height,
        rx: extra.rx ?? 24,
        fill,
        opacity: extra.opacity,
        transform: extra.transform,
        stroke: extra.stroke,
        'stroke-width': extra.strokeWidth,
        filter: extra.filter,
    });
}

function pathNode(d, fill, extra = {}) {
    return svgNode('path', {
        d,
        fill,
        opacity: extra.opacity,
        transform: extra.transform,
        stroke: extra.stroke,
        'stroke-width': extra.strokeWidth,
        'stroke-linecap': extra.strokeLinecap,
        'stroke-linejoin': extra.strokeLinejoin,
        'stroke-dasharray': extra.strokeDasharray,
        filter: extra.filter,
    });
}

function lineNode(
    x1,
    y1,
    x2,
    y2,
    stroke,
    strokeWidth,
    opacity = 1,
    extra = {}
) {
    return svgNode('line', {
        x1,
        y1,
        x2,
        y2,
        stroke,
        'stroke-width': strokeWidth,
        opacity,
        'stroke-linecap': extra.strokeLinecap ?? 'round',
        'stroke-dasharray': extra.strokeDasharray,
        filter: extra.filter,
    });
}

function buildBackdrop(width, height, asset) {
    const seed = hashString(asset.id);
    const random = rng(seed);
    const [base, mid, light, skin] = asset.palette;
    const shapes = [];

    for (let index = 0; index < 3; index += 1) {
        const radius = width * (0.08 + random() * 0.18);
        const cx = width * (0.05 + random() * 0.9);
        const cy = height * (0.05 + random() * 0.9);
        const fill = index % 2 === 0 ? light : asset.accent;
        shapes.push(circle(cx, cy, radius, fill, 0.05 + random() * 0.04));
    }

    for (let index = 0; index < 1; index += 1) {
        const cardWidth = width * (0.18 + random() * 0.18);
        const cardHeight = height * (0.1 + random() * 0.18);
        const x = width * random();
        const y = height * random();
        const angle = -10 + random() * 20;
        shapes.push(
            rect(x, y, cardWidth, cardHeight, skin, {
                rx: 26,
                opacity: 0.03 + random() * 0.02,
                transform: `rotate(${angle} ${round(x + cardWidth / 2)} ${round(
                    y + cardHeight / 2
                )})`,
            })
        );
    }

    return svgNode(
        'g',
        {},
        [
            svgNode('rect', {
                width,
                height,
                fill: `url(#bg-${asset.id})`,
            }),
            shapes.join(''),
            rect(
                width * 0.05,
                height * 0.1,
                width * 0.9,
                height * 0.82,
                'rgba(255,255,255,0.05)',
                {
                    rx: 40,
                    stroke: 'rgba(255,255,255,0.12)',
                    strokeWidth: 1.8,
                }
            ),
            rect(
                width * 0.12,
                height * 0.16,
                width * 0.76,
                height * 0.68,
                `url(#panel-${asset.id})`,
                {
                    rx: 34,
                    stroke: 'rgba(255,255,255,0.08)',
                    strokeWidth: 1.2,
                }
            ),
            lineNode(
                width * 0.12,
                height * 0.76,
                width * 0.88,
                height * 0.76,
                'rgba(255,255,255,0.05)',
                2
            ),
            svgNode(
                'rect',
                {
                    width,
                    height,
                    fill: `url(#vignette-${asset.id})`,
                },
                ''
            ),
        ].join('')
    );
}

function buildRoom(width, height, palette, accent, random) {
    const [, mid, light, skin] = palette;
    return [
        rect(
            width * 0.14,
            height * 0.22,
            width * 0.72,
            height * 0.5,
            '#12243b',
            {
                rx: 32,
                opacity: 0.92,
                stroke: 'rgba(255,255,255,0.08)',
                strokeWidth: 1.2,
            }
        ),
        rect(width * 0.18, height * 0.28, width * 0.24, height * 0.18, light, {
            rx: 24,
            opacity: 0.24,
            stroke: 'rgba(255,255,255,0.16)',
            strokeWidth: 1.4,
        }),
        rect(width * 0.64, height * 0.26, width * 0.14, height * 0.16, accent, {
            rx: 18,
            opacity: 0.18,
        }),
        rect(width * 0.26, height * 0.56, width * 0.38, height * 0.08, skin, {
            rx: 18,
            opacity: 0.74,
        }),
        rect(width * 0.18, height * 0.66, width * 0.64, height * 0.09, mid, {
            rx: 22,
            opacity: 0.58,
        }),
        circle(
            width * (0.25 + random() * 0.5),
            height * 0.2,
            width * 0.022,
            '#fff5ef',
            0.34
        ),
        rect(
            width * 0.24,
            height * 0.36,
            width * 0.14,
            height * 0.02,
            '#ffffff',
            {
                rx: 6,
                opacity: 0.22,
            }
        ),
        rect(
            width * 0.66,
            height * 0.46,
            width * 0.09,
            height * 0.16,
            'rgba(255,255,255,0.12)',
            {
                rx: 14,
            }
        ),
        lineNode(
            width * 0.18,
            height * 0.74,
            width * 0.82,
            height * 0.74,
            'rgba(255,255,255,0.06)',
            2
        ),
    ].join('');
}

function buildFigure(x, y, scale, colors, variant = 'adult') {
    const skin = colors.skin;
    const coat = colors.coat;
    const hair = colors.hair;
    const accent = colors.accent;
    const shoulders = variant === 'child' ? 68 : 84;
    const head = variant === 'child' ? 24 : 30;
    const bodyHeight = variant === 'child' ? 92 : 138;
    const neckWidth = variant === 'child' ? 14 : 18;
    const neckHeight = variant === 'child' ? 18 : 24;
    const torsoTop = variant === 'child' ? 32 : 40;
    const armWidth = variant === 'child' ? 16 : 20;
    const armHeight = variant === 'child' ? 54 : 72;
    const hairShape = `M -${head} 2 C -${round(head * 0.92)} -${round(head * 1.04)}, ${round(
        head * 0.92
    )} -${round(head * 1.04)}, ${head} 2 L ${round(head * 0.7)} 0 C ${round(
        head * 0.24
    )} -${round(head * 0.26)}, -${round(head * 0.24)} -${round(
        head * 0.26
    )}, -${round(head * 0.7)} 0 Z`;

    return svgNode(
        'g',
        { transform: `translate(${round(x)} ${round(y)}) scale(${scale})` },
        [
            rect(
                -round(neckWidth / 2),
                round(head * 0.82),
                neckWidth,
                neckHeight,
                skin,
                {
                    rx: 8,
                    opacity: 0.94,
                }
            ),
            rect(
                -round(shoulders * 0.8),
                torsoTop + 24,
                armWidth,
                armHeight,
                coat,
                {
                    rx: 14,
                    opacity: 0.9,
                    transform: `rotate(-8 ${-round(shoulders * 0.7)} ${torsoTop + 52})`,
                }
            ),
            rect(
                round(shoulders * 0.56),
                torsoTop + 22,
                armWidth,
                armHeight,
                coat,
                {
                    rx: 14,
                    opacity: 0.9,
                    transform: `rotate(8 ${round(shoulders * 0.66)} ${torsoTop + 50})`,
                }
            ),
            pathNode(
                `M ${-shoulders} ${bodyHeight} C ${-round(shoulders * 0.78)} ${round(
                    bodyHeight * 0.34
                )}, ${round(shoulders * 0.78)} ${round(bodyHeight * 0.34)}, ${shoulders} ${bodyHeight} L ${round(
                    shoulders * 0.8
                )} ${bodyHeight + 48} L -${round(shoulders * 0.8)} ${bodyHeight + 48} Z`,
                coat,
                { opacity: 0.98 }
            ),
            rect(-12, torsoTop, 24, 64, accent, {
                rx: 12,
                opacity: 0.18,
            }),
            pathNode(
                `M -${round(shoulders * 0.22)} ${torsoTop + 12} L -6 ${torsoTop + 56} L -${round(
                    shoulders * 0.28
                )} ${torsoTop + 74} Z`,
                'rgba(255,255,255,0.9)',
                {
                    opacity: 0.88,
                }
            ),
            pathNode(
                `M ${round(shoulders * 0.22)} ${torsoTop + 12} L 6 ${torsoTop + 56} L ${round(
                    shoulders * 0.28
                )} ${torsoTop + 74} Z`,
                'rgba(255,255,255,0.9)',
                {
                    opacity: 0.88,
                }
            ),
            rect(round(shoulders * 0.24), torsoTop + 44, 14, 18, accent, {
                rx: 8,
                opacity: 0.16,
            }),
            circle(0, 0, head, skin, 0.98),
            pathNode(hairShape, hair, {
                opacity: 0.96,
            }),
            lineNode(
                -round(head * 0.4),
                -round(head * 0.08),
                -round(head * 0.14),
                -round(head * 0.08),
                'rgba(34,41,56,0.42)',
                2.2
            ),
            lineNode(
                round(head * 0.14),
                -round(head * 0.08),
                round(head * 0.4),
                -round(head * 0.08),
                'rgba(34,41,56,0.42)',
                2.2
            ),
            lineNode(
                -round(head * 0.44),
                -round(head * 0.24),
                -round(head * 0.12),
                -round(head * 0.2),
                'rgba(34,41,56,0.24)',
                1.8
            ),
            lineNode(
                round(head * 0.12),
                -round(head * 0.2),
                round(head * 0.44),
                -round(head * 0.24),
                'rgba(34,41,56,0.24)',
                1.8
            ),
            pathNode(
                `M -${round(head * 0.16)} ${round(head * 0.42)} Q 0 ${round(head * 0.54)} ${round(
                    head * 0.16
                )} ${round(head * 0.42)}`,
                'transparent',
                {
                    stroke: 'rgba(74,58,56,0.32)',
                    strokeWidth: 2.4,
                    strokeLinecap: 'round',
                }
            ),
        ].join('')
    );
}

function buildProcedureProp(x, y, width, height, accent, glow) {
    return svgNode(
        'g',
        { transform: `translate(${round(x)} ${round(y)})` },
        [
            rect(0, 0, width, height, '#102237', {
                rx: 20,
                stroke: 'rgba(255,255,255,0.08)',
                strokeWidth: 1.2,
            }),
            rect(
                width * 0.12,
                height * 0.12,
                width * 0.76,
                height * 0.18,
                accent,
                {
                    rx: 12,
                    opacity: 0.16,
                }
            ),
            rect(width * 0.2, height * 0.4, width * 0.22, height * 0.08, glow, {
                rx: 8,
                opacity: 0.2,
            }),
            rect(width * 0.5, height * 0.4, width * 0.18, height * 0.08, glow, {
                rx: 8,
                opacity: 0.12,
            }),
            lineNode(
                width * 0.2,
                height * 0.66,
                width * 0.8,
                height * 0.66,
                'rgba(255,255,255,0.12)',
                3
            ),
        ].join('')
    );
}

function buildMacroPanel(x, y, width, height, palette, accent) {
    return svgNode(
        'g',
        { transform: `translate(${round(x)} ${round(y)})` },
        [
            rect(0, 0, width, height, '#172538', {
                rx: 28,
                opacity: 0.96,
                stroke: 'rgba(255,255,255,0.08)',
                strokeWidth: 1.2,
            }),
            circle(width * 0.5, height * 0.46, width * 0.22, '#f6d5df', 0.98),
            circle(width * 0.42, height * 0.38, width * 0.032, accent, 0.36),
            circle(width * 0.58, height * 0.52, width * 0.024, '#ffffff', 0.22),
            rect(
                width * 0.18,
                height * 0.18,
                width * 0.18,
                height * 0.12,
                palette[2],
                {
                    rx: 12,
                    opacity: 0.16,
                }
            ),
            rect(
                width * 0.64,
                height * 0.28,
                width * 0.1,
                height * 0.24,
                palette[1],
                {
                    rx: 12,
                    opacity: 0.18,
                }
            ),
            lineNode(
                width * 0.2,
                height * 0.76,
                width * 0.8,
                height * 0.76,
                'rgba(255,255,255,0.12)',
                3
            ),
        ].join('')
    );
}

function buildTexturePanel(x, y, width, height, palette, accent) {
    const dots = [];
    for (let row = 0; row < 4; row += 1) {
        for (let column = 0; column < 4; column += 1) {
            dots.push(
                circle(
                    width * (0.56 + column * 0.06),
                    height * (0.26 + row * 0.12),
                    width * 0.018,
                    (row + column) % 2 === 0 ? accent : palette[2],
                    0.2
                )
            );
        }
    }

    return svgNode(
        'g',
        { transform: `translate(${round(x)} ${round(y)})` },
        [
            rect(0, 0, width, height, '#172538', {
                rx: 28,
                opacity: 0.96,
                stroke: 'rgba(255,255,255,0.08)',
                strokeWidth: 1.2,
            }),
            pathNode(
                `M ${round(width * 0.26)} ${round(height * 0.16)} C ${round(width * 0.18)} ${round(
                    height * 0.34
                )}, ${round(width * 0.16)} ${round(height * 0.58)}, ${round(width * 0.26)} ${round(
                    height * 0.8
                )} L ${round(width * 0.42)} ${round(height * 0.8)} C ${round(width * 0.48)} ${round(
                    height * 0.62
                )}, ${round(width * 0.48)} ${round(height * 0.38)}, ${round(width * 0.42)} ${round(
                    height * 0.16
                )} Z`,
                palette[3],
                { opacity: 0.98 }
            ),
            rect(
                width * 0.18,
                height * 0.2,
                width * 0.16,
                height * 0.08,
                accent,
                {
                    rx: 10,
                    opacity: 0.16,
                }
            ),
            dots.join(''),
        ].join('')
    );
}

function buildRepairPanel(x, y, width, height, palette, accent) {
    const cells = [];
    for (let index = 0; index < 3; index += 1) {
        const cellX = width * (0.08 + index * 0.29);
        cells.push(
            rect(
                cellX,
                height * 0.18,
                width * 0.2,
                height * 0.58,
                'rgba(255,255,255,0.05)',
                {
                    rx: 18,
                }
            )
        );
        cells.push(
            rect(
                cellX + width * 0.04,
                height * 0.26,
                width * 0.12,
                height * 0.08,
                index === 1 ? accent : palette[2],
                {
                    rx: 10,
                    opacity: 0.22,
                }
            )
        );
        cells.push(
            lineNode(
                cellX + width * 0.04,
                height * 0.48,
                cellX + width * 0.16,
                height * 0.48,
                'rgba(255,255,255,0.16)',
                4
            )
        );
        cells.push(
            lineNode(
                cellX + width * 0.04,
                height * 0.62,
                cellX + width * 0.14,
                height * 0.62,
                'rgba(255,255,255,0.12)',
                4
            )
        );
    }

    return svgNode(
        'g',
        { transform: `translate(${round(x)} ${round(y)})` },
        [
            rect(0, 0, width, height, '#172538', {
                rx: 28,
                opacity: 0.96,
                stroke: 'rgba(255,255,255,0.08)',
                strokeWidth: 1.2,
            }),
            cells.join(''),
            pathNode(
                `M ${round(width * 0.12)} ${round(height * 0.82)} Q ${round(width * 0.36)} ${round(
                    height * 0.68
                )}, ${round(width * 0.56)} ${round(height * 0.78)} T ${round(width * 0.9)} ${round(height * 0.74)}`,
                'transparent',
                {
                    stroke: accent,
                    strokeWidth: 8,
                    strokeLinecap: 'round',
                    opacity: 0.3,
                }
            ),
        ].join('')
    );
}

function buildDermatoscopyPanel(x, y, width, height, palette, accent) {
    return svgNode(
        'g',
        { transform: `translate(${round(x)} ${round(y)})` },
        [
            rect(0, 0, width, height, '#172538', {
                rx: 28,
                opacity: 0.96,
                stroke: 'rgba(255,255,255,0.08)',
                strokeWidth: 1.2,
            }),
            circle(width * 0.38, height * 0.52, width * 0.14, '#edd1bf', 1),
            circle(
                width * 0.38,
                height * 0.52,
                width * 0.032,
                'rgba(91,57,44,0.5)',
                1
            ),
            circle(width * 0.3, height * 0.44, width * 0.018, accent, 0.26),
            circle(width * 0.46, height * 0.6, width * 0.016, palette[2], 0.28),
            circle(
                width * 0.68,
                height * 0.38,
                width * 0.12,
                'transparent',
                1,
                {
                    stroke: 'rgba(255,255,255,0.5)',
                    strokeWidth: 8,
                }
            ),
            lineNode(
                width * 0.76,
                height * 0.48,
                width * 0.88,
                height * 0.64,
                'rgba(255,255,255,0.5)',
                8
            ),
        ].join('')
    );
}

function buildRenewalPanel(x, y, width, height, palette, accent) {
    return svgNode(
        'g',
        { transform: `translate(${round(x)} ${round(y)})` },
        [
            rect(0, 0, width, height, '#172538', {
                rx: 28,
                opacity: 0.96,
                stroke: 'rgba(255,255,255,0.08)',
                strokeWidth: 1.2,
            }),
            ellipse(
                width * 0.34,
                height * 0.48,
                width * 0.12,
                height * 0.18,
                palette[3],
                0.98
            ),
            pathNode(
                `M ${round(width * 0.58)} ${round(height * 0.24)} C ${round(width * 0.52)} ${round(
                    height * 0.4
                )}, ${round(width * 0.54)} ${round(height * 0.58)}, ${round(width * 0.64)} ${round(
                    height * 0.72
                )} C ${round(width * 0.72)} ${round(height * 0.58)}, ${round(width * 0.74)} ${round(
                    height * 0.4
                )}, ${round(width * 0.58)} ${round(height * 0.24)}`,
                accent,
                { opacity: 0.26 }
            ),
            rect(
                width * 0.22,
                height * 0.72,
                width * 0.22,
                height * 0.08,
                palette[2],
                {
                    rx: 12,
                    opacity: 0.14,
                }
            ),
        ].join('')
    );
}

function buildBottlePanel(x, y, width, height, palette, accent) {
    const bubbles = [];
    for (let index = 0; index < 5; index += 1) {
        bubbles.push(
            circle(
                width * (0.62 + index * 0.05),
                height * (0.24 + (index % 3) * 0.14),
                width * (0.016 + (index % 2) * 0.006),
                index % 2 === 0 ? accent : palette[2],
                0.22
            )
        );
    }

    return svgNode(
        'g',
        { transform: `translate(${round(x)} ${round(y)})` },
        [
            rect(0, 0, width, height, '#172538', {
                rx: 28,
                opacity: 0.96,
                stroke: 'rgba(255,255,255,0.08)',
                strokeWidth: 1.2,
            }),
            rect(
                width * 0.26,
                height * 0.2,
                width * 0.16,
                height * 0.1,
                palette[2],
                {
                    rx: 10,
                    opacity: 0.22,
                }
            ),
            rect(
                width * 0.3,
                height * 0.28,
                width * 0.08,
                height * 0.38,
                'rgba(255,247,241,0.94)',
                {
                    rx: 16,
                }
            ),
            rect(
                width * 0.28,
                height * 0.42,
                width * 0.12,
                height * 0.12,
                accent,
                {
                    rx: 12,
                    opacity: 0.18,
                }
            ),
            bubbles.join(''),
        ].join('')
    );
}

function buildLaserPanel(x, y, width, height, palette, accent) {
    return svgNode(
        'g',
        { transform: `translate(${round(x)} ${round(y)})` },
        [
            rect(0, 0, width, height, '#172538', {
                rx: 28,
                opacity: 0.96,
                stroke: 'rgba(255,255,255,0.08)',
                strokeWidth: 1.2,
            }),
            rect(
                width * 0.16,
                height * 0.22,
                width * 0.14,
                height * 0.42,
                'rgba(241,247,255,0.9)',
                {
                    rx: 18,
                }
            ),
            rect(
                width * 0.19,
                height * 0.32,
                width * 0.08,
                height * 0.1,
                accent,
                {
                    rx: 10,
                    opacity: 0.18,
                }
            ),
            lineNode(
                width * 0.3,
                height * 0.46,
                width * 0.72,
                height * 0.34,
                accent,
                8,
                0.36
            ),
            circle(width * 0.78, height * 0.32, width * 0.08, palette[2], 0.18),
            circle(width * 0.78, height * 0.32, width * 0.03, accent, 0.34),
        ].join('')
    );
}

function buildPrecisionFacePanel(x, y, width, height, palette, accent) {
    return svgNode(
        'g',
        { transform: `translate(${round(x)} ${round(y)})` },
        [
            rect(0, 0, width, height, '#172538', {
                rx: 28,
                opacity: 0.96,
                stroke: 'rgba(255,255,255,0.08)',
                strokeWidth: 1.2,
            }),
            ellipse(
                width * 0.38,
                height * 0.48,
                width * 0.12,
                height * 0.18,
                palette[3],
                1
            ),
            circle(width * 0.38, height * 0.32, width * 0.014, accent, 0.34),
            circle(width * 0.3, height * 0.48, width * 0.014, accent, 0.34),
            circle(width * 0.46, height * 0.48, width * 0.014, accent, 0.34),
            circle(width * 0.38, height * 0.62, width * 0.014, accent, 0.34),
            lineNode(
                width * 0.38,
                height * 0.32,
                width * 0.38,
                height * 0.62,
                'rgba(255,255,255,0.16)',
                3
            ),
            lineNode(
                width * 0.3,
                height * 0.48,
                width * 0.46,
                height * 0.48,
                'rgba(255,255,255,0.16)',
                3
            ),
            rect(
                width * 0.62,
                height * 0.24,
                width * 0.16,
                height * 0.08,
                palette[2],
                {
                    rx: 10,
                    opacity: 0.14,
                }
            ),
        ].join('')
    );
}

function buildCollagenPanel(x, y, width, height, palette, accent) {
    const bands = [];
    for (let index = 0; index < 4; index += 1) {
        const yBand = height * (0.24 + index * 0.14);
        bands.push(
            pathNode(
                `M ${round(width * 0.14)} ${round(yBand)} Q ${round(width * 0.34)} ${round(
                    yBand - height * 0.08
                )}, ${round(width * 0.52)} ${round(yBand)} T ${round(width * 0.86)} ${round(yBand)}`,
                'transparent',
                {
                    stroke: index % 2 === 0 ? accent : palette[2],
                    strokeWidth: 10,
                    strokeLinecap: 'round',
                    opacity: 0.24,
                }
            )
        );
    }

    return svgNode(
        'g',
        { transform: `translate(${round(x)} ${round(y)})` },
        [
            rect(0, 0, width, height, '#172538', {
                rx: 28,
                opacity: 0.96,
                stroke: 'rgba(255,255,255,0.08)',
                strokeWidth: 1.2,
            }),
            bands.join(''),
            circle(width * 0.74, height * 0.34, width * 0.02, accent, 0.3),
            circle(
                width * 0.66,
                height * 0.58,
                width * 0.016,
                palette[2],
                0.28
            ),
        ].join('')
    );
}

function buildTriptychPanel(x, y, width, height, palette, accent) {
    return svgNode(
        'g',
        { transform: `translate(${round(x)} ${round(y)})` },
        [
            rect(0, 0, width, height, '#172538', {
                rx: 28,
                opacity: 0.96,
                stroke: 'rgba(255,255,255,0.08)',
                strokeWidth: 1.2,
            }),
            rect(
                width * 0.1,
                height * 0.18,
                width * 0.16,
                height * 0.58,
                'rgba(255,255,255,0.05)',
                {
                    rx: 18,
                }
            ),
            rect(
                width * 0.42,
                height * 0.18,
                width * 0.16,
                height * 0.58,
                'rgba(255,255,255,0.05)',
                {
                    rx: 18,
                }
            ),
            rect(
                width * 0.74,
                height * 0.18,
                width * 0.16,
                height * 0.58,
                'rgba(255,255,255,0.05)',
                {
                    rx: 18,
                }
            ),
            lineNode(
                width * 0.18,
                height * 0.28,
                width * 0.18,
                height * 0.68,
                accent,
                6,
                0.32
            ),
            pathNode(
                `M ${round(width * 0.5)} ${round(height * 0.28)} C ${round(width * 0.44)} ${round(
                    height * 0.42
                )}, ${round(width * 0.46)} ${round(height * 0.54)}, ${round(width * 0.52)} ${round(
                    height * 0.7
                )}`,
                'transparent',
                {
                    stroke: palette[2],
                    strokeWidth: 8,
                    strokeLinecap: 'round',
                    opacity: 0.3,
                }
            ),
            pathNode(
                `M ${round(width * 0.82)} ${round(height * 0.32)} Q ${round(width * 0.88)} ${round(
                    height * 0.42
                )}, ${round(width * 0.82)} ${round(height * 0.52)} Q ${round(width * 0.76)} ${round(
                    height * 0.42
                )}, ${round(width * 0.82)} ${round(height * 0.32)}`,
                'transparent',
                {
                    stroke: accent,
                    strokeWidth: 8,
                    strokeLinecap: 'round',
                    opacity: 0.28,
                }
            ),
        ].join('')
    );
}

function buildPortraitBust(x, y, scale, colors) {
    const skin = colors.skin;
    const hair = colors.hair;
    const coat = colors.coat;
    const accent = colors.accent;

    return svgNode(
        'g',
        { transform: `translate(${round(x)} ${round(y)}) scale(${scale})` },
        [
            ellipse(0, 154, 118, 24, 'rgba(0,0,0,0.14)', 0.22),
            pathNode(
                'M -118 164 C -108 96, -74 58, 0 58 C 74 58, 108 96, 118 164 L 84 164 C 72 126, 44 104, 0 104 C -44 104, -72 126, -84 164 Z',
                coat,
                { opacity: 0.98 }
            ),
            rect(-26, 86, 52, 52, accent, {
                rx: 18,
                opacity: 0.12,
            }),
            pathNode(
                'M -70 78 L -20 130 L -72 150 Z',
                'rgba(255,255,255,0.88)',
                {
                    opacity: 0.92,
                }
            ),
            pathNode('M 70 78 L 20 130 L 72 150 Z', 'rgba(255,255,255,0.88)', {
                opacity: 0.92,
            }),
            rect(-16, 52, 32, 44, skin, {
                rx: 12,
                opacity: 0.94,
            }),
            circle(0, 0, 62, skin, 1),
            pathNode(
                'M -62 6 C -60 -48, -32 -74, 0 -74 C 32 -74, 60 -48, 62 6 L 44 2 C 30 -20, 14 -28, 0 -28 C -14 -28, -30 -20, -44 2 Z',
                hair,
                { opacity: 0.96 }
            ),
            lineNode(-24, -6, -8, -6, 'rgba(34,41,56,0.42)', 2.4),
            lineNode(8, -6, 24, -6, 'rgba(34,41,56,0.42)', 2.4),
            lineNode(-26, -20, -6, -16, 'rgba(34,41,56,0.24)', 2),
            lineNode(6, -16, 26, -20, 'rgba(34,41,56,0.24)', 2),
            pathNode('M -10 26 Q 0 34 10 26', 'transparent', {
                stroke: 'rgba(74,58,56,0.34)',
                strokeWidth: 2.8,
                strokeLinecap: 'round',
            }),
        ].join('')
    );
}

function buildScene(width, height, asset) {
    const random = rng(hashString(`${asset.id}:scene`));
    const palette = asset.palette;
    const accent = asset.accent;
    const body = [];
    const colors = {
        skin: palette[3],
        coat: 'rgba(242,248,255,0.92)',
        hair: palette[1],
        accent,
    };

    switch (asset.scene) {
        case 'brand':
            body.push(buildRoom(width, height, palette, accent, random));
            body.push(
                buildFigure(width * 0.32, height * 0.44, 1.12, colors, 'adult')
            );
            body.push(
                buildFigure(width * 0.62, height * 0.46, 0.96, {
                    ...colors,
                    coat: 'rgba(223,236,250,0.92)',
                    hair: palette[2],
                    accent: palette[2],
                })
            );
            body.push(
                buildProcedureProp(
                    width * 0.68,
                    height * 0.24,
                    width * 0.14,
                    height * 0.16,
                    accent,
                    palette[2]
                )
            );
            break;
        case 'clinic':
            body.push(buildRoom(width, height, palette, accent, random));
            body.push(buildFigure(width * 0.28, height * 0.46, 1.02, colors));
            body.push(
                buildProcedureProp(
                    width * 0.62,
                    height * 0.3,
                    width * 0.14,
                    height * 0.16,
                    accent,
                    palette[2]
                )
            );
            body.push(
                rect(
                    width * 0.72,
                    height * 0.36,
                    width * 0.06,
                    height * 0.22,
                    palette[2],
                    { rx: 14, opacity: 0.1 }
                )
            );
            break;
        case 'consent':
            body.push(buildRoom(width, height, palette, accent, random));
            body.push(buildFigure(width * 0.26, height * 0.48, 0.96, colors));
            body.push(
                buildFigure(width * 0.56, height * 0.54, 0.88, {
                    ...colors,
                    hair: palette[2],
                    accent: palette[2],
                })
            );
            body.push(
                rect(
                    width * 0.4,
                    height * 0.42,
                    width * 0.18,
                    height * 0.12,
                    '#fff4ea',
                    {
                        rx: 18,
                        opacity: 0.92,
                        transform: `rotate(-10 ${round(width * 0.49)} ${round(height * 0.48)})`,
                    }
                )
            );
            break;
        case 'consultation':
            body.push(buildRoom(width, height, palette, accent, random));
            body.push(buildFigure(width * 0.28, height * 0.46, 1.04, colors));
            body.push(
                buildFigure(width * 0.56, height * 0.58, 0.82, {
                    ...colors,
                    coat: 'rgba(241,229,219,0.74)',
                    accent: palette[2],
                })
            );
            body.push(
                buildProcedureProp(
                    width * 0.64,
                    height * 0.24,
                    width * 0.14,
                    height * 0.14,
                    accent,
                    palette[2]
                )
            );
            break;
        case 'macro-study':
            body.push(buildRoom(width, height, palette, accent, random));
            body.push(
                buildMacroPanel(
                    width * 0.26,
                    height * 0.24,
                    width * 0.5,
                    height * 0.4,
                    palette,
                    accent
                )
            );
            body.push(buildFigure(width * 0.2, height * 0.58, 0.68, colors));
            break;
        case 'precision-procedure':
            body.push(buildRoom(width, height, palette, accent, random));
            body.push(buildFigure(width * 0.28, height * 0.46, 1.02, colors));
            body.push(
                buildFigure(width * 0.58, height * 0.58, 0.8, {
                    ...colors,
                    coat: 'rgba(240,224,214,0.82)',
                    accent: palette[2],
                })
            );
            body.push(
                buildProcedureProp(
                    width * 0.66,
                    height * 0.24,
                    width * 0.14,
                    height * 0.16,
                    accent,
                    palette[2]
                )
            );
            body.push(
                pathNode(
                    `M ${round(width * 0.55)} ${round(height * 0.47)} Q ${round(width * 0.64)} ${round(height * 0.38)}, ${round(width * 0.7)} ${round(height * 0.52)}`,
                    accent,
                    {
                        opacity: 0.32,
                        stroke: accent,
                        strokeWidth: 6,
                        strokeLinecap: 'round',
                    }
                )
            );
            break;
        case 'laser':
            body.push(buildRoom(width, height, palette, accent, random));
            body.push(
                buildLaserPanel(
                    width * 0.28,
                    height * 0.26,
                    width * 0.46,
                    height * 0.34,
                    palette,
                    accent
                )
            );
            body.push(buildFigure(width * 0.24, height * 0.58, 0.78, colors));
            body.push(
                buildFigure(width * 0.6, height * 0.62, 0.64, {
                    ...colors,
                    coat: 'rgba(240,224,214,0.82)',
                    accent: palette[2],
                })
            );
            break;
        case 'micro-protocol':
            body.push(buildRoom(width, height, palette, accent, random));
            body.push(
                buildBottlePanel(
                    width * 0.3,
                    height * 0.26,
                    width * 0.42,
                    height * 0.34,
                    palette,
                    accent
                )
            );
            body.push(buildFigure(width * 0.22, height * 0.58, 0.7, colors));
            break;
        case 'renewal':
            body.push(buildRoom(width, height, palette, accent, random));
            body.push(
                buildRenewalPanel(
                    width * 0.3,
                    height * 0.26,
                    width * 0.42,
                    height * 0.34,
                    palette,
                    accent
                )
            );
            body.push(buildFigure(width * 0.22, height * 0.58, 0.7, colors));
            break;
        case 'precision-face':
            body.push(buildRoom(width, height, palette, accent, random));
            body.push(
                buildPrecisionFacePanel(
                    width * 0.3,
                    height * 0.26,
                    width * 0.42,
                    height * 0.34,
                    palette,
                    accent
                )
            );
            body.push(buildFigure(width * 0.22, height * 0.58, 0.7, colors));
            break;
        case 'collagen':
            body.push(buildRoom(width, height, palette, accent, random));
            body.push(
                buildCollagenPanel(
                    width * 0.3,
                    height * 0.26,
                    width * 0.42,
                    height * 0.34,
                    palette,
                    accent
                )
            );
            body.push(buildFigure(width * 0.22, height * 0.58, 0.7, colors));
            break;
        case 'texture-study':
            body.push(buildRoom(width, height, palette, accent, random));
            body.push(
                buildTexturePanel(
                    width * 0.26,
                    height * 0.26,
                    width * 0.48,
                    height * 0.34,
                    palette,
                    accent
                )
            );
            body.push(buildFigure(width * 0.22, height * 0.58, 0.66, colors));
            break;
        case 'repair-grid':
            body.push(buildRoom(width, height, palette, accent, random));
            body.push(
                buildRepairPanel(
                    width * 0.24,
                    height * 0.26,
                    width * 0.5,
                    height * 0.34,
                    palette,
                    accent
                )
            );
            body.push(buildFigure(width * 0.22, height * 0.58, 0.66, colors));
            break;
        case 'dermatoscopy':
            body.push(buildRoom(width, height, palette, accent, random));
            body.push(
                buildDermatoscopyPanel(
                    width * 0.24,
                    height * 0.26,
                    width * 0.5,
                    height * 0.34,
                    palette,
                    accent
                )
            );
            body.push(buildFigure(width * 0.22, height * 0.58, 0.66, colors));
            break;
        case 'tri-panel':
            body.push(buildRoom(width, height, palette, accent, random));
            body.push(
                buildTriptychPanel(
                    width * 0.3,
                    height * 0.26,
                    width * 0.42,
                    height * 0.34,
                    palette,
                    accent
                )
            );
            body.push(buildFigure(width * 0.22, height * 0.58, 0.66, colors));
            break;
        case 'family':
            body.push(buildRoom(width, height, palette, accent, random));
            body.push(buildFigure(width * 0.26, height * 0.46, 0.98, colors));
            body.push(
                buildFigure(
                    width * 0.54,
                    height * 0.54,
                    0.64,
                    {
                        ...colors,
                        coat: 'rgba(243,229,214,0.8)',
                        accent: palette[2],
                    },
                    'child'
                )
            );
            body.push(
                buildProcedureProp(
                    width * 0.64,
                    height * 0.26,
                    width * 0.14,
                    height * 0.14,
                    accent,
                    palette[2]
                )
            );
            body.push(
                rect(
                    width * 0.46,
                    height * 0.34,
                    width * 0.16,
                    height * 0.12,
                    '#fff4ea',
                    {
                        rx: 16,
                        opacity: 0.9,
                        transform: `rotate(-8 ${round(width * 0.54)} ${round(height * 0.4)})`,
                    }
                )
            );
            break;
        case 'portrait-a':
        case 'portrait-b': {
            const isB = asset.scene === 'portrait-b';
            body.push(
                rect(
                    width * 0.14,
                    height * 0.08,
                    width * 0.72,
                    height * 0.84,
                    '#122033',
                    {
                        rx: 40,
                        opacity: 0.96,
                        stroke: 'rgba(255,255,255,0.08)',
                        strokeWidth: 1.2,
                    }
                )
            );
            body.push(
                circle(
                    width * 0.5,
                    height * 0.24,
                    width * 0.2,
                    palette[2],
                    0.12
                )
            );
            body.push(
                buildPortraitBust(width * 0.5, height * 0.32, 1, {
                    skin: palette[3],
                    coat: 'rgba(245,248,255,0.98)',
                    hair: isB ? palette[1] : accent,
                    accent: isB ? accent : palette[2],
                })
            );
            break;
        }
        default:
            body.push(buildRoom(width, height, palette, accent, random));
            body.push(buildFigure(width * 0.35, height * 0.46, 0.92, colors));
            break;
    }

    return svgNode('g', {}, body.join(''));
}

function buildSvg(asset, width, height) {
    const [base, mid, light] = asset.palette;
    return [
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${asset.altEn}">`,
        '<defs>',
        `<linearGradient id="bg-${asset.id}" x1="0%" y1="0%" x2="100%" y2="100%">`,
        `<stop offset="0%" stop-color="${base}" />`,
        `<stop offset="55%" stop-color="${mid}" />`,
        `<stop offset="100%" stop-color="#070c13" />`,
        '</linearGradient>',
        `<linearGradient id="panel-${asset.id}" x1="10%" y1="0%" x2="90%" y2="100%">`,
        `<stop offset="0%" stop-color="rgba(255,255,255,0.14)" />`,
        `<stop offset="100%" stop-color="rgba(255,255,255,0.05)" />`,
        '</linearGradient>',
        `<radialGradient id="vignette-${asset.id}" cx="50%" cy="50%" r="65%">`,
        '<stop offset="45%" stop-color="rgba(255,255,255,0)" />',
        '<stop offset="100%" stop-color="rgba(0,0,0,0.18)" />',
        '</radialGradient>',
        '</defs>',
        buildBackdrop(width, height, asset),
        buildScene(width, height, asset),
        circle(width * 0.18, height * 0.12, width * 0.03, light, 0.2),
        circle(width * 0.82, height * 0.18, width * 0.022, asset.accent, 0.22),
        '</svg>',
    ].join('');
}

async function rasterize(browser, svg, width, height, format) {
    const page = await browser.newPage({ viewport: { width, height } });
    const dataUri = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;

    await page.setContent(
        `<html><body style="margin:0;background:#0b1220;"><img id="art" src="${dataUri}" style="display:block;width:${width}px;height:${height}px;" /></body></html>`
    );
    await page.waitForFunction(() => {
        const art = document.getElementById('art');
        return art && art.complete;
    });

    let buffer;
    if (format === 'jpg') {
        buffer = await page.screenshot({ type: 'jpeg', quality: 92 });
    } else {
        const base64 = await page.evaluate(
            async ({ uri, width: canvasWidth, height: canvasHeight }) => {
                const loadImage = (src) =>
                    new Promise((resolve, reject) => {
                        const image = new Image();
                        image.onload = () => resolve(image);
                        image.onerror = (error) => reject(error);
                        image.src = src;
                    });

                const image = await loadImage(uri);
                const canvas = document.createElement('canvas');
                canvas.width = canvasWidth;
                canvas.height = canvasHeight;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(image, 0, 0, canvasWidth, canvasHeight);
                return canvas.toDataURL('image/webp', 0.92).split(',')[1];
            },
            { uri: dataUri, width, height }
        );
        buffer = Buffer.from(base64, 'base64');
    }

    await page.close();
    return buffer;
}

function writeBuffer(filePath, buffer) {
    fs.writeFileSync(filePath, buffer);
}

function baseName(assetId) {
    return assetId;
}

function buildManifestSrcSet(asset) {
    const spec = KIND_SPECS[asset.kind];
    return spec.sizes
        .map((size, index) => {
            const filename =
                index === spec.sizes.length - 1
                    ? `${baseName(asset.id)}.webp`
                    : `${baseName(asset.id)}-${size}.webp`;
            const width =
                index === spec.sizes.length - 1 ? spec.sizes[index] : size;
            return `/images/optimized/${filename} ${width}w`;
        })
        .join(', ');
}

function readExistingManifest() {
    if (!fs.existsSync(MANIFEST_PATH)) {
        return { assets: [] };
    }
    try {
        return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    } catch (_error) {
        return { assets: [] };
    }
}

function defaultManifestMetadata(asset) {
    return {
        status: 'approved',
        sourceType: 'ai_generated',
        publicWebSafe: true,
        orientation: asset.kind === 'portrait' ? 'portrait' : 'landscape',
        editorialTags: [asset.scene, asset.kind].filter(Boolean),
        allowedSlotRoles:
            asset.kind === 'portrait'
                ? ['profile_portrait']
                : asset.kind === 'wide'
                  ? ['page_hero', 'seo_hero', 'initiative_card']
                  : [
                        'hero_slide',
                        'editorial_card',
                        'matrix_card',
                        'featured_card',
                        'hub_card',
                        'initiative_card',
                        'statement_band',
                        'index_card',
                        'page_hero',
                    ],
        tone: 'ink',
        localeAlt: {
            es: asset.altEs,
            en: asset.altEn,
        },
        generation: {
            strategy: 'local_editorial_illustration',
            source: 'src/apps/astro/scripts/generate-public-v6-image-set.mjs',
            promptPack: 'docs/public-v6-image-refresh.md',
            reviewState: 'approved',
        },
    };
}

function buildManifest() {
    const existingManifest = readExistingManifest();
    const existingAssets = new Map(
        (Array.isArray(existingManifest.assets) ? existingManifest.assets : []).map(
            (asset) => [asset.id, asset]
        )
    );
    return {
        version: '2026.03-v6-image-relaunch',
        updated_at: new Date().toISOString().slice(0, 10),
        assets: ASSETS.map((asset) => {
            const existing = existingAssets.get(asset.id) || {};
            const defaults = defaultManifestMetadata(asset);
            const existingLocaleAlt =
                existing.localeAlt && typeof existing.localeAlt === 'object'
                    ? existing.localeAlt
                    : {};
            const existingGeneration =
                existing.generation && typeof existing.generation === 'object'
                    ? existing.generation
                    : {};

            return {
                ...existing,
                id: asset.id,
                kind: asset.kind,
                src: `/images/optimized/${baseName(asset.id)}.webp`,
                srcset: buildManifestSrcSet(asset),
                sizes: KIND_DEFAULT_SIZES[asset.kind] || KIND_DEFAULT_SIZES.card,
                alt_es: asset.altEs,
                alt_en: asset.altEn,
                status: existing.status || defaults.status,
                sourceType: existing.sourceType || defaults.sourceType,
                publicWebSafe:
                    typeof existing.publicWebSafe === 'boolean'
                        ? existing.publicWebSafe
                        : defaults.publicWebSafe,
                orientation: existing.orientation || defaults.orientation,
                editorialTags:
                    Array.isArray(existing.editorialTags) &&
                    existing.editorialTags.length
                        ? existing.editorialTags
                        : defaults.editorialTags,
                allowedSlotRoles:
                    Array.isArray(existing.allowedSlotRoles) &&
                    existing.allowedSlotRoles.length
                        ? existing.allowedSlotRoles
                        : defaults.allowedSlotRoles,
                tone: existing.tone || defaults.tone,
                localeAlt: {
                    ...defaults.localeAlt,
                    ...existingLocaleAlt,
                    es: existingLocaleAlt.es || asset.altEs,
                    en: existingLocaleAlt.en || asset.altEn,
                },
                generation: {
                    ...defaults.generation,
                    ...existingGeneration,
                    source:
                        existingGeneration.source || defaults.generation.source,
                },
            };
        }),
    };
}

async function generateAsset(browser, asset) {
    const spec = KIND_SPECS[asset.kind];
    if (!spec) {
        throw new Error(`Unknown kind for ${asset.id}`);
    }

    const largestWidth = spec.sizes[spec.sizes.length - 1];
    const largestHeight = round(largestWidth * spec.aspect);
    const masterSvg = buildSvg(asset, largestWidth, largestHeight);
    fs.writeFileSync(
        path.join(SRC_DIR, `${baseName(asset.id)}.svg`),
        masterSvg,
        'utf8'
    );

    for (const size of spec.sizes) {
        const width = size;
        const height = round(width * spec.aspect);
        const sizedSvg = buildSvg(asset, width, height);
        const jpg = await rasterize(browser, sizedSvg, width, height, 'jpg');
        const webp = await rasterize(browser, sizedSvg, width, height, 'webp');

        writeBuffer(
            path.join(OPTIMIZED_DIR, `${baseName(asset.id)}-${size}.jpg`),
            jpg
        );
        writeBuffer(
            path.join(OPTIMIZED_DIR, `${baseName(asset.id)}-${size}.webp`),
            webp
        );
    }

    const lqipWidth = spec.lqip;
    const lqipHeight = round(lqipWidth * spec.aspect);
    const lqipSvg = buildSvg(asset, lqipWidth, lqipHeight);
    const lqipJpg = await rasterize(
        browser,
        lqipSvg,
        lqipWidth,
        lqipHeight,
        'jpg'
    );
    writeBuffer(
        path.join(OPTIMIZED_DIR, `${baseName(asset.id)}-lqip.jpg`),
        lqipJpg
    );

    const baseSize = spec.sizes[spec.sizes.length - 1];
    fs.copyFileSync(
        path.join(OPTIMIZED_DIR, `${baseName(asset.id)}-${baseSize}.jpg`),
        path.join(OPTIMIZED_DIR, `${baseName(asset.id)}.jpg`)
    );
    fs.copyFileSync(
        path.join(OPTIMIZED_DIR, `${baseName(asset.id)}-${baseSize}.webp`),
        path.join(OPTIMIZED_DIR, `${baseName(asset.id)}.webp`)
    );
}

async function main() {
    ensureDirectory(SRC_DIR);
    ensureDirectory(OPTIMIZED_DIR);

    const browser = await chromium.launch({ headless: true });
    try {
        for (const asset of ASSETS) {
            // Generate assets serially to keep memory stable on Windows.
            await generateAsset(browser, asset);
        }
    } finally {
        await browser.close();
    }

    fs.writeFileSync(
        MANIFEST_PATH,
        `${JSON.stringify(buildManifest(), null, 4)}\n`,
        'utf8'
    );

    process.stdout.write(
        `${JSON.stringify(
            {
                ok: true,
                assets: ASSETS.length,
                srcDir: path.relative(ROOT, SRC_DIR).replace(/\\/g, '/'),
                optimizedDir: path
                    .relative(ROOT, OPTIMIZED_DIR)
                    .replace(/\\/g, '/'),
                manifest: path
                    .relative(ROOT, MANIFEST_PATH)
                    .replace(/\\/g, '/'),
            },
            null,
            2
        )}\n`
    );
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});

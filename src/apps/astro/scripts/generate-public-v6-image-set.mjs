import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const SRC_DIR = path.join(ROOT, 'images', 'src');
const OPT_DIR = path.join(ROOT, 'images', 'optimized');
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
    card: { aspect: 0.78, sizes: [400, 640, 800, 900, 1200, 1400], lqip: 56 },
    portrait: { aspect: 1.2, sizes: [500, 900], lqip: 72 },
};

const KIND_DEFAULT_SIZES = {
    wide: '(max-width: 900px) 100vw, 48vw',
    card: '(max-width: 900px) 100vw, 33vw',
    portrait: '(max-width: 900px) 100vw, 40vw',
};

const SOURCE_LIBRARY = {
    clinic: 'showcase-clinic.jpg',
    diagnostic: 'showcase-diagnostic.jpg',
    treatment: 'showcase-treatment.jpg',
    telemedicine: 'service-telemedicina.jpg',
    consultation: 'service-consulta.jpg',
    acne: 'service-acne.jpg',
    cancer: 'service-cancer.jpg',
    rejuvenation: 'service-rejuvenecimiento.jpg',
    heroWoman: 'hero-woman.jpg',
    showcaseHero: 'showcase-hero.jpg',
    rosero: 'team-rosero.jpg',
    narvaez: 'team-narvaez.jpg',
};

const a = (
    id,
    kind,
    sourceKind,
    identityPolicy,
    backdrop,
    background,
    frames,
    options = {}
) => ({
    id,
    kind,
    sourceKind,
    identityPolicy,
    backdrop,
    background,
    frames,
    ...options,
});

const ASSET_DEFS = [
    a(
        'v6-clinic-brand-hero-wide',
        'wide',
        'real_photo',
        'generic',
        ['#edf3fa', '#d5e2f1', '#b7c9de'],
        ['clinic', 'xMidYMid slice', 0.2],
        [
            ['clinic', 0.04, 0.08, 0.58, 0.84, 36],
            ['diagnostic', 0.66, 0.08, 0.3, 0.38, 28],
            ['telemedicine', 0.66, 0.52, 0.3, 0.28, 28],
        ]
    ),
    a(
        'v6-clinic-home-followup',
        'card',
        'real_photo',
        'generic',
        ['#eef4fa', '#dce7f2', '#c3d2e4'],
        ['diagnostic', 'xMidYMid slice', 0.18],
        [
            ['diagnostic', 0.05, 0.06, 0.9, 0.56, 32],
            ['consultation', 0.06, 0.66, 0.42, 0.24, 24],
            ['clinic', 0.54, 0.66, 0.4, 0.24, 24],
        ]
    ),
    a(
        'v6-clinic-home-diagnostic-brief',
        'card',
        'real_photo',
        'generic',
        ['#eef4fa', '#dde8f2', '#c4d5e7'],
        ['consultation', 'xMidYMid slice', 0.17],
        [
            ['consultation', 0.05, 0.08, 0.56, 0.8, 32],
            ['diagnostic', 0.67, 0.18, 0.23, 0.5, 24],
        ],
        {
            altEs: 'Consulta dermatologica inicial con mapa claro de hallazgos y prioridades',
            altEn: 'Initial dermatology visit with a clear map of findings and priorities',
            editorialTags: ['clinical_direction', 'diagnosis', 'consultation'],
        }
    ),
    a(
        'v6-clinic-home-followup-review',
        'card',
        'real_photo',
        'generic',
        ['#eef4fa', '#dde8f2', '#c7d7e8'],
        ['diagnostic', 'xMidYMid slice', 0.18],
        [
            ['diagnostic', 0.05, 0.08, 0.56, 0.8, 32],
            ['consultation', 0.66, 0.16, 0.24, 0.34, 22],
            ['clinic', 0.66, 0.56, 0.24, 0.16, 20],
        ],
        {
            altEs: 'Seguimiento dermatologico con revision comparativa y ajustes medicos',
            altEn: 'Dermatology follow-up with comparative review and medical adjustments',
            editorialTags: ['follow_up', 'comparison', 'care_review'],
        }
    ),
    a(
        'v6-clinic-home-remote-handoff',
        'card',
        'real_photo',
        'generic',
        ['#eef4fa', '#dce7f1', '#c3d4e6'],
        ['telemedicine', 'xMidYMid slice', 0.17],
        [
            ['telemedicine', 0.05, 0.08, 0.56, 0.8, 32],
            ['clinic', 0.67, 0.18, 0.23, 0.3, 22],
            ['consultation', 0.67, 0.56, 0.23, 0.14, 18],
        ],
        {
            altEs: 'Teledermatologia con criterio para pasar a consulta presencial',
            altEn: 'Teledermatology with clear criteria for moving into clinic',
            editorialTags: ['telemedicine', 'handoff', 'clinical_transition'],
        }
    ),
    a(
        'v6-clinic-team-roundtable',
        'card',
        'real_photo',
        'staff_real',
        ['#edf2f9', '#dbe5f1', '#c6d5e7'],
        ['clinic', 'xMidYMid slice', 0.14],
        [
            ['rosero', 0.08, 0.15, 0.38, 0.7, 28],
            ['narvaez', 0.54, 0.15, 0.38, 0.7, 28],
        ]
    ),
    a(
        'v6-clinic-hub-editorial-map',
        'wide',
        'real_photo',
        'generic',
        ['#eef3fa', '#dbe6f1', '#bdcee2'],
        ['clinic', 'xMidYMid slice', 0.16],
        [
            ['diagnostic', 0.04, 0.12, 0.28, 0.76, 28],
            ['clinic', 0.36, 0.08, 0.28, 0.8, 32],
            ['telemedicine', 0.68, 0.18, 0.28, 0.62, 28],
        ]
    ),
    a(
        'v6-clinic-hub-clinical-ladder',
        'card',
        'real_photo',
        'generic',
        ['#eef4fa', '#dde7f1', '#c5d5e6'],
        ['clinic', 'xMidYMid slice', 0.16],
        [
            ['diagnostic', 0.05, 0.08, 0.56, 0.8, 32],
            ['consultation', 0.67, 0.18, 0.23, 0.18, 20],
            ['treatment', 0.67, 0.44, 0.23, 0.24, 22],
        ],
        {
            altEs: 'Ruta dermatologica para evaluar, confirmar y decidir el siguiente paso',
            altEn: 'Dermatology route to assess, confirm, and decide the next step',
            editorialTags: ['clinical_direction', 'decisioning', 'care_route'],
        }
    ),
    a(
        'v6-clinic-hub-remote-entry',
        'card',
        'real_photo',
        'generic',
        ['#eef4fa', '#dde8f2', '#c5d6e7'],
        ['telemedicine', 'xMidYMid slice', 0.17],
        [
            ['telemedicine', 0.05, 0.08, 0.9, 0.56, 32],
            ['diagnostic', 0.06, 0.68, 0.28, 0.18, 20],
            ['clinic', 0.38, 0.68, 0.24, 0.18, 20],
        ],
        {
            altEs: 'Entrada remota dermatologica con triage y lectura inicial',
            altEn: 'Remote dermatology entry with triage and initial review',
            editorialTags: ['telemedicine', 'intake', 'remote_entry'],
        }
    ),
    a(
        'v6-clinic-hub-care-handoff',
        'card',
        'real_photo',
        'generic',
        ['#eef4fa', '#dde7f1', '#c6d5e6'],
        ['clinic', 'xMidYMid slice', 0.16],
        [
            ['consultation', 0.05, 0.08, 0.9, 0.56, 32],
            ['telemedicine', 0.06, 0.68, 0.28, 0.18, 20],
            ['diagnostic', 0.38, 0.68, 0.24, 0.18, 20],
        ],
        {
            altEs: 'Transicion coordinada entre teledermatologia, consulta y seguimiento',
            altEn: 'Coordinated transition across teledermatology, clinic review, and follow-up',
            editorialTags: ['telemedicine', 'handoff', 'continuity'],
        }
    ),
    a(
        'v6-clinic-clinic-environment',
        'card',
        'real_photo',
        'generic',
        ['#edf2f8', '#d7e2ee', '#c0d0e2'],
        ['clinic', 'xMidYMid slice', 0.18],
        [['clinic', 0.05, 0.06, 0.9, 0.88, 34, 'xMidYMid slice', 0.04]]
    ),
    a(
        'v6-clinic-consent-trust',
        'card',
        'real_photo',
        'staff_real',
        ['#eef4fa', '#dfe8f2', '#c7d6e7'],
        ['consultation', 'xMidYMid slice', 0.16],
        [
            ['narvaez', 0.06, 0.08, 0.44, 0.82, 30],
            ['consultation', 0.56, 0.14, 0.34, 0.56, 24],
        ]
    ),
    a(
        'v6-clinic-telemedicine-intake',
        'card',
        'real_photo',
        'generic',
        ['#edf2f8', '#d8e4ef', '#bfd1e3'],
        ['telemedicine', 'xMidYMid slice', 0.18],
        [
            ['telemedicine', 0.05, 0.08, 0.9, 0.56, 32],
            ['diagnostic', 0.58, 0.68, 0.3, 0.18, 20],
        ]
    ),
    a(
        'v6-clinic-telemedicine-review',
        'card',
        'real_photo',
        'generic',
        ['#eef4fa', '#dde8f2', '#c5d4e6'],
        ['diagnostic', 'xMidYMid slice', 0.16],
        [
            ['diagnostic', 0.05, 0.08, 0.56, 0.8, 32],
            ['telemedicine', 0.67, 0.18, 0.23, 0.48, 24],
        ]
    ),
    a(
        'v6-clinic-legal-governance',
        'card',
        'real_photo',
        'generic',
        ['#eef3f8', '#dde5ee', '#c5d1df'],
        ['clinic', 'xMidYMid slice', 0.14],
        [
            ['clinic', 0.05, 0.08, 0.5, 0.8, 32],
            ['diagnostic', 0.61, 0.18, 0.28, 0.54, 24],
        ]
    ),
    a(
        'v6-clinic-statement-clinical-direction',
        'card',
        'real_photo',
        'staff_real',
        ['#eef4fa', '#dfe8f2', '#c8d7e8'],
        ['clinic', 'xMidYMid slice', 0.12],
        [
            ['rosero', 0.06, 0.08, 0.5, 0.82, 30],
            ['diagnostic', 0.62, 0.18, 0.26, 0.52, 24],
        ]
    ),
    a(
        'v6-clinic-statement-procedure-guidance',
        'card',
        'real_photo',
        'generic',
        ['#f0f2f7', '#e4e7ef', '#cfd6e4'],
        ['treatment', 'xMidYMid slice', 0.16],
        [
            ['treatment', 0.05, 0.08, 0.56, 0.8, 32],
            ['clinic', 0.67, 0.2, 0.23, 0.5, 24],
        ]
    ),
    a(
        'v6-clinic-statement-family-support',
        'card',
        'real_photo',
        'staff_real',
        ['#f0f5fa', '#e0e9f2', '#cad9e8'],
        ['clinic', 'xMidYMid slice', 0.14],
        [
            ['narvaez', 0.06, 0.08, 0.48, 0.82, 30],
            ['telemedicine', 0.61, 0.22, 0.28, 0.46, 22],
        ]
    ),
    a(
        'v6-clinic-diagnostico-integral',
        'card',
        'real_photo',
        'generic',
        ['#edf4fa', '#dfe8f2', '#c7d7e8'],
        ['consultation', 'xMidYMid slice', 0.16],
        [
            ['consultation', 0.05, 0.08, 0.56, 0.8, 32],
            ['diagnostic', 0.67, 0.18, 0.23, 0.5, 24],
        ]
    ),
    a(
        'v6-clinic-acne-rosacea',
        'card',
        'ai_photoreal',
        'generic',
        ['#f7f1f4', '#eddde4', '#dec8d4'],
        ['heroWoman', 'xMidYMid slice', 0.16],
        [
            ['heroWoman', 0.05, 0.08, 0.56, 0.8, 32],
            ['acne', 0.67, 0.18, 0.23, 0.5, 24],
        ]
    ),
    a(
        'v6-clinic-verrugas',
        'card',
        'real_photo',
        'generic',
        ['#eef3f9', '#dde6f0', '#c8d5e5'],
        ['treatment', 'xMidYMid slice', 0.16],
        [
            ['treatment', 0.05, 0.08, 0.9, 0.56, 32],
            ['clinic', 0.58, 0.68, 0.3, 0.18, 20],
        ]
    ),
    a(
        'v6-clinic-granitos-brazos-piernas',
        'card',
        'real_photo',
        'generic',
        ['#f6f3ef', '#ece4db', '#d8cec2'],
        ['acne', 'xMidYMid slice', 0.16],
        [
            ['acne', 0.05, 0.08, 0.9, 0.56, 32],
            ['heroWoman', 0.58, 0.68, 0.3, 0.18, 20],
        ]
    ),
    a(
        'v6-clinic-cicatrices',
        'card',
        'real_photo',
        'generic',
        ['#f1f2f7', '#e3e7ee', '#cdd6e2'],
        ['treatment', 'xMidYMid slice', 0.15],
        [
            ['treatment', 0.05, 0.08, 0.56, 0.8, 32],
            ['clinic', 0.67, 0.18, 0.23, 0.5, 24],
        ]
    ),
    a(
        'v6-clinic-cancer-piel',
        'card',
        'real_photo',
        'generic',
        ['#eff1f6', '#e1e6ee', '#ccd4e0'],
        ['cancer', 'xMidYMid slice', 0.14],
        [
            ['cancer', 0.05, 0.08, 0.9, 0.58, 32],
            ['diagnostic', 0.58, 0.7, 0.3, 0.16, 20],
        ]
    ),
    a(
        'v6-clinic-peeling-quimico',
        'card',
        'real_photo',
        'generic',
        ['#f5efed', '#ecdfdb', '#dbc8c0'],
        ['showcaseHero', 'xMidYMid slice', 0.15],
        [['showcaseHero', 0.05, 0.08, 0.9, 0.84, 34, 'xMidYMid slice', 0.05]]
    ),
    a(
        'v6-clinic-mesoterapia',
        'card',
        'real_photo',
        'generic',
        ['#f5efee', '#eadfdb', '#d6cac4'],
        ['rejuvenation', 'xMidYMid slice', 0.15],
        [['rejuvenation', 0.05, 0.08, 0.9, 0.84, 34, 'xMidYMid slice', 0.05]]
    ),
    a(
        'v6-clinic-laser-dermatologico',
        'card',
        'real_photo',
        'generic',
        ['#edf2f7', '#dbe4ef', '#c3d1e2'],
        ['clinic', 'xMidYMid slice', 0.16],
        [
            ['clinic', 0.05, 0.08, 0.9, 0.56, 32],
            ['consultation', 0.58, 0.68, 0.3, 0.18, 20],
        ]
    ),
    a(
        'v6-clinic-botox',
        'card',
        'real_photo',
        'generic',
        ['#f5efee', '#ebdfdd', '#dbcfc9'],
        ['rejuvenation', 'xMidYMid slice', 0.14],
        [
            ['rejuvenation', 0.05, 0.08, 0.56, 0.8, 32],
            ['heroWoman', 0.67, 0.18, 0.23, 0.5, 24],
        ]
    ),
    a(
        'v6-clinic-bioestimuladores-colageno',
        'card',
        'ai_photoreal',
        'generic',
        ['#f6f0ef', '#ece0de', '#d9cdca'],
        ['heroWoman', 'xMidYMid slice', 0.16],
        [
            ['heroWoman', 0.05, 0.08, 0.56, 0.8, 32],
            ['rejuvenation', 0.67, 0.18, 0.23, 0.5, 24],
        ]
    ),
    a(
        'v6-clinic-piel-cabello-unas',
        'card',
        'ai_photoreal',
        'generic',
        ['#f4f0ee', '#e8dfda', '#d3c9c3'],
        ['heroWoman', 'xMidYMid slice', 0.16],
        [
            ['heroWoman', 0.05, 0.08, 0.9, 0.56, 32],
            ['consultation', 0.06, 0.68, 0.28, 0.18, 20],
            ['clinic', 0.38, 0.68, 0.24, 0.18, 20],
        ]
    ),
    a(
        'v6-clinic-dermatologia-pediatrica',
        'card',
        'real_photo',
        'staff_real',
        ['#f0f5fa', '#dfe8f1', '#c8d7e6'],
        ['narvaez', 'xMidYMid slice', 0.12],
        [
            ['narvaez', 0.06, 0.08, 0.48, 0.82, 30],
            ['clinic', 0.61, 0.22, 0.28, 0.46, 22],
        ]
    ),
    a(
        'v6-clinic-doctor-rosero',
        'portrait',
        'real_photo',
        'staff_real',
        ['#edf3fa', '#dde7f2', '#c5d4e4'],
        ['clinic', 'xMidYMid slice', 0.12],
        [['rosero', 0.1, 0.06, 0.8, 0.88, 34]]
    ),
    a(
        'v6-clinic-doctor-narvaez',
        'portrait',
        'real_photo',
        'staff_real',
        ['#eef4fa', '#dfe8f2', '#c7d6e6'],
        ['clinic', 'xMidYMid slice', 0.12],
        [['narvaez', 0.1, 0.06, 0.8, 0.88, 34]]
    ),
];

const previousManifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
const altMap = new Map(
    (Array.isArray(previousManifest.assets) ? previousManifest.assets : []).map(
        (asset) => [asset.id, { altEs: asset.alt_es, altEn: asset.alt_en }]
    )
);
const ASSETS = ASSET_DEFS.map((asset) => {
    const inlineCopy =
        typeof asset.altEs === 'string' &&
        asset.altEs.trim() &&
        typeof asset.altEn === 'string' &&
        asset.altEn.trim()
            ? {
                  altEs: asset.altEs.trim(),
                  altEn: asset.altEn.trim(),
              }
            : null;
    const copy = altMap.get(asset.id) || inlineCopy;
    if (!copy?.altEs || !copy?.altEn)
        throw new Error(`Missing alt copy for ${asset.id}`);
    return { ...asset, altEs: copy.altEs, altEn: copy.altEn };
});

const sourceCache = new Map();
const escapeXml = (value) =>
    String(value)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
const px = (value, total) =>
    Math.round(
        (typeof value === 'number' && value <= 1 ? value * total : value) || 0
    );
const ensureDir = (dir) => fs.mkdirSync(dir, { recursive: true });
const rect = (x, y, width, height, radius, attrs = {}) =>
    `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" ${Object.entries(
        attrs
    )
        .filter(
            ([, value]) => value !== undefined && value !== null && value !== ''
        )
        .map(([key, value]) => `${key}="${escapeXml(value)}"`)
        .join(' ')} />`;

function sourceUri(sourceId) {
    if (sourceCache.has(sourceId)) return sourceCache.get(sourceId);
    const fileName = SOURCE_LIBRARY[sourceId];
    if (!fileName) throw new Error(`Unknown source ${sourceId}`);
    const ext = path.extname(fileName).toLowerCase();
    const mime =
        ext === '.png'
            ? 'image/png'
            : ext === '.webp'
              ? 'image/webp'
              : 'image/jpeg';
    const uri = `data:${mime};base64,${fs.readFileSync(path.join(SRC_DIR, fileName)).toString('base64')}`;
    sourceCache.set(sourceId, uri);
    return uri;
}

function buildFrame(asset, frameDef, index, width, height) {
    const [
        source,
        fx,
        fy,
        fw,
        fh,
        fr = 32,
        focus = 'xMidYMid slice',
        overlayOpacity = 0.08,
        borderOpacity = 0.34,
    ] = frameDef;
    const x = px(fx, width);
    const y = px(fy, height);
    const frameWidth = px(fw, width);
    const frameHeight = px(fh, height);
    const radius = px(fr, Math.min(width, height));
    const clipId = `${asset.id}-clip-${index}`;
    const overlayId = `${asset.id}-overlay-${index}`;
    return {
        defs: [
            `<clipPath id="${clipId}">${rect(x, y, frameWidth, frameHeight, radius)}</clipPath>`,
            `<linearGradient id="${overlayId}" x1="0%" y1="0%" x2="100%" y2="100%">`,
            '<stop offset="0%" stop-color="rgba(255,255,255,0.02)" />',
            '<stop offset="100%" stop-color="rgba(6,18,32,0.24)" />',
            '</linearGradient>',
        ].join(''),
        body: [
            rect(x, y + 6, frameWidth, frameHeight, radius, {
                fill: 'rgba(8,18,34,0.16)',
                filter: 'url(#shadow-soft)',
                opacity: '0.9',
            }),
            rect(x, y, frameWidth, frameHeight, radius, {
                fill: 'rgba(255,255,255,0.16)',
            }),
            `<image href="${sourceUri(source)}" xlink:href="${sourceUri(source)}" x="${x}" y="${y}" width="${frameWidth}" height="${frameHeight}" preserveAspectRatio="${focus}" clip-path="url(#${clipId})" />`,
            rect(x, y, frameWidth, frameHeight, radius, {
                fill: `url(#${overlayId})`,
                opacity: String(overlayOpacity),
                'clip-path': `url(#${clipId})`,
            }),
            rect(x, y, frameWidth, frameHeight, radius, {
                fill: 'none',
                stroke: `rgba(255,255,255,${borderOpacity})`,
                'stroke-width': '1.4',
            }),
        ].join(''),
    };
}

function buildSvg(asset, width, height) {
    const [bgStart, bgMid, bgEnd] = asset.backdrop;
    const bgId = `${asset.id}-bg`;
    const canvasId = `${asset.id}-canvas`;
    const canvasClip = `${asset.id}-canvas-clip`;
    const defs = [
        `<linearGradient id="${bgId}" x1="0%" y1="0%" x2="100%" y2="100%">`,
        `<stop offset="0%" stop-color="${bgStart}" />`,
        `<stop offset="55%" stop-color="${bgMid}" />`,
        `<stop offset="100%" stop-color="${bgEnd}" />`,
        '</linearGradient>',
        `<linearGradient id="${canvasId}" x1="0%" y1="0%" x2="100%" y2="100%">`,
        '<stop offset="0%" stop-color="rgba(255,255,255,0.2)" />',
        '<stop offset="55%" stop-color="rgba(255,255,255,0)" />',
        '<stop offset="100%" stop-color="rgba(12,20,33,0.12)" />',
        '</linearGradient>',
        `<clipPath id="${canvasClip}">${rect(0, 0, width, height, 0)}</clipPath>`,
        '<filter id="shadow-soft" x="-20%" y="-20%" width="140%" height="160%">',
        '<feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="#081222" flood-opacity="0.12" />',
        '</filter>',
    ];
    const body = [
        rect(0, 0, width, height, 0, { fill: `url(#${bgId})` }),
        `<image href="${sourceUri(asset.background[0])}" xlink:href="${sourceUri(asset.background[0])}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="${asset.background[1]}" opacity="${asset.background[2]}" clip-path="url(#${canvasClip})" />`,
        rect(0, 0, width, height, 0, { fill: `url(#${canvasId})` }),
        rect(width * 0.02, height * 0.04, width * 0.96, height * 0.92, 34, {
            fill: 'none',
            stroke: 'rgba(255,255,255,0.3)',
            'stroke-width': '1.2',
        }),
    ];

    asset.frames.forEach((frameDef, index) => {
        const frame = buildFrame(asset, frameDef, index, width, height);
        defs.push(frame.defs);
        body.push(frame.body);
    });

    body.push(
        rect(width * 0.06, height * 0.87, width * 0.2, 4, 2, {
            fill: 'rgba(35,56,86,0.26)',
        })
    );
    body.push(
        rect(width * 0.28, height * 0.87, width * 0.08, 4, 2, {
            fill: 'rgba(255,255,255,0.34)',
        })
    );

    return [
        `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${escapeXml(asset.altEn)}">`,
        '<defs>',
        defs.join(''),
        '</defs>',
        body.join(''),
        '</svg>',
    ].join('');
}

async function rasterize(browser, svg, width, height, format) {
    const page = await browser.newPage({ viewport: { width, height } });
    const uri = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
    await page.setContent(
        `<html><body style="margin:0;background:#0d1623;"><img id="art" src="${uri}" style="display:block;width:${width}px;height:${height}px;" /></body></html>`
    );
    await page.waitForFunction(() => document.getElementById('art')?.complete);
    if (format === 'jpg') {
        const jpg = await page.screenshot({ type: 'jpeg', quality: 92 });
        await page.close();
        return jpg;
    }
    const base64 = await page.evaluate(
        async ({ dataUri, canvasWidth, canvasHeight }) => {
            const image = await new Promise((resolve, reject) => {
                const next = new Image();
                next.onload = () => resolve(next);
                next.onerror = reject;
                next.src = dataUri;
            });
            const canvas = document.createElement('canvas');
            canvas.width = canvasWidth;
            canvas.height = canvasHeight;
            canvas
                .getContext('2d')
                .drawImage(image, 0, 0, canvasWidth, canvasHeight);
            return canvas.toDataURL('image/webp', 0.92).split(',')[1];
        },
        { dataUri: uri, canvasWidth: width, canvasHeight: height }
    );
    await page.close();
    return Buffer.from(base64, 'base64');
}

function manifestSrcSet(asset) {
    const spec = KIND_SPECS[asset.kind];
    return spec.sizes
        .map((size, index) => {
            const filename =
                index === spec.sizes.length - 1
                    ? `${asset.id}.webp`
                    : `${asset.id}-${size}.webp`;
            return `/images/optimized/${filename} ${index === spec.sizes.length - 1 ? spec.sizes[index] : size}w`;
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
    const editorialTag = asset.id.replace(/^v6-clinic-/, '');
    const defaultAllowedSlotRoles =
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
                ];
    return {
        status: 'approved',
        sourceType:
            asset.sourceKind === 'ai_photoreal'
                ? 'ai_generated'
                : asset.identityPolicy === 'staff_real'
                  ? 'staff_photo'
                  : 'real_photo',
        publicWebSafe: true,
        orientation: asset.kind === 'portrait' ? 'portrait' : 'landscape',
        editorialTags:
            Array.isArray(asset.editorialTags) && asset.editorialTags.length
                ? asset.editorialTags
                : [editorialTag, asset.kind].filter(Boolean),
        allowedSlotRoles:
            Array.isArray(asset.allowedSlotRoles) &&
            asset.allowedSlotRoles.length
                ? asset.allowedSlotRoles
                : defaultAllowedSlotRoles,
        tone: asset.tone || 'ink',
        localeAlt: {
            es: asset.altEs,
            en: asset.altEn,
        },
        generation: {
            strategy: 'photo_first_composite',
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
        version: '2026.03-v6-photoreal-home-hub-r2',
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
                sourceKind: asset.sourceKind,
                identityPolicy: asset.identityPolicy,
                src: `/images/optimized/${asset.id}.webp`,
                srcset: manifestSrcSet(asset),
                sizes: KIND_DEFAULT_SIZES[asset.kind] || KIND_DEFAULT_SIZES.card,
                alt_es: asset.altEs,
                alt_en: asset.altEn,
                status: existing.status || defaults.status,
                sourceType: defaults.sourceType,
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
                    ...existingGeneration,
                    ...defaults.generation,
                },
            };
        }),
    };
}

async function generateAsset(browser, asset) {
    const spec = KIND_SPECS[asset.kind];
    const largest = spec.sizes[spec.sizes.length - 1];
    const svgPath = path.join(SRC_DIR, `${asset.id}.svg`);
    if (fs.existsSync(svgPath)) fs.unlinkSync(svgPath);
    for (const size of spec.sizes) {
        const width = size;
        const height = Math.round(width * spec.aspect);
        const svg = buildSvg(asset, width, height);
        const jpg = await rasterize(browser, svg, width, height, 'jpg');
        const webp = await rasterize(browser, svg, width, height, 'webp');
        fs.writeFileSync(path.join(OPT_DIR, `${asset.id}-${size}.jpg`), jpg);
        fs.writeFileSync(path.join(OPT_DIR, `${asset.id}-${size}.webp`), webp);
        if (size === largest)
            fs.writeFileSync(path.join(SRC_DIR, `${asset.id}.jpg`), jpg);
    }
    const lqipWidth = spec.lqip;
    const lqipHeight = Math.round(lqipWidth * spec.aspect);
    const lqip = await rasterize(
        browser,
        buildSvg(asset, lqipWidth, lqipHeight),
        lqipWidth,
        lqipHeight,
        'jpg'
    );
    fs.writeFileSync(path.join(OPT_DIR, `${asset.id}-lqip.jpg`), lqip);
    fs.copyFileSync(
        path.join(OPT_DIR, `${asset.id}-${largest}.jpg`),
        path.join(OPT_DIR, `${asset.id}.jpg`)
    );
    fs.copyFileSync(
        path.join(OPT_DIR, `${asset.id}-${largest}.webp`),
        path.join(OPT_DIR, `${asset.id}.webp`)
    );
}

async function main() {
    ensureDir(SRC_DIR);
    ensureDir(OPT_DIR);
    const browser = await chromium.launch({ headless: true });
    try {
        for (const asset of ASSETS) await generateAsset(browser, asset);
    } finally {
        await browser.close();
    }
    fs.writeFileSync(
        MANIFEST_PATH,
        `${JSON.stringify(buildManifest(), null, 4)}\n`,
        'utf8'
    );
    process.stdout.write(
        `${JSON.stringify({ ok: true, assets: ASSETS.length, manifest: 'content/public-v6/assets-manifest.json' }, null, 2)}\n`
    );
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});

import { withDeployAssetVersion } from '../src/apps/shared/utils.js';
import {
    loadDeferredModule,
    createWarmupRunner,
    bindWarmupTarget,
    scheduleDeferredTask,
    observeOnceWhenVisible,
} from './loader.js';

const GALLERY_INTERACTIONS_URL = withDeployAssetVersion(
    '/js/engines/gallery-interactions.js?v=figo-gallery-20260218-phase4'
);

export function loadGalleryInteractions() {
    return loadDeferredModule({
        cacheKey: 'gallery-interactions',
        src: GALLERY_INTERACTIONS_URL,
        scriptDataAttribute: 'data-gallery-interactions',
        resolveModule: () => window.Piel && window.Piel.GalleryInteractions,
        isModuleReady: (module) =>
            !!(module && typeof module.init === 'function'),
        onModuleReady: (module) => module.init(),
        missingApiError: 'gallery-interactions loaded without API',
        loadError: 'No se pudo cargar gallery-interactions.js',
        logLabel: 'Gallery interactions',
    });
}

export function initGalleryInteractionsWarmup() {
    const warmup = createWarmupRunner(() => loadGalleryInteractions());
    const gallerySection = document.getElementById('galeria');
    observeOnceWhenVisible(gallerySection, warmup, {
        threshold: 0.05,
        rootMargin: '320px 0px',
        onNoObserver: warmup,
    });
    const firstFilterBtn = document.querySelector('.filter-btn');
    if (firstFilterBtn) {
        firstFilterBtn.addEventListener('mouseenter', warmup, {
            once: true,
            passive: true,
        });
        firstFilterBtn.addEventListener('touchstart', warmup, {
            once: true,
            passive: true,
        });
    }
    if (!gallerySection && !firstFilterBtn) {
        return;
    }
    scheduleDeferredTask(warmup, { idleTimeout: 2500, fallbackDelay: 1500 });
}

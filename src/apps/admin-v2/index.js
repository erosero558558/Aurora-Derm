import { bootAdminV2 } from './core/boot.js';

function runBoot() {
    if (document.readyState === 'loading') {
        return new Promise((resolve, reject) => {
            document.addEventListener(
                'DOMContentLoaded',
                () => {
                    bootAdminV2().then(resolve).catch(reject);
                },
                { once: true }
            );
        });
    }
    return bootAdminV2();
}

const bootPromise = runBoot().catch((error) => {
    console.error('admin-v2 boot failed', error);
    throw error;
});

export default bootPromise;

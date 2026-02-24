import { apiRequest } from './api.js';
import { showToast } from './ui.js';

let initialized = false;

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const normalized = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');

    const raw = window.atob(normalized);
    const output = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i += 1) {
        output[i] = raw.charCodeAt(i);
    }
    return output;
}

function getButtons() {
    const subscribeBtn = document.getElementById('subscribePushBtn');
    const testBtn = document.getElementById('testPushBtn');
    return { subscribeBtn, testBtn };
}

function setButtonsVisibility(visible) {
    const { subscribeBtn, testBtn } = getButtons();
    if (subscribeBtn) {
        subscribeBtn.classList.toggle('is-hidden', !visible);
        subscribeBtn.disabled = !visible;
    }
    if (testBtn) {
        testBtn.classList.toggle('is-hidden', !visible);
        testBtn.disabled = !visible;
    }
}

function updateSubscribeButton(isSubscribed) {
    const { subscribeBtn } = getButtons();
    if (!subscribeBtn) return;

    if (isSubscribed) {
        subscribeBtn.dataset.action = 'unsubscribe';
        subscribeBtn.classList.remove('btn-primary');
        subscribeBtn.classList.add('btn-secondary');
        subscribeBtn.innerHTML = '<i class="fas fa-bell-slash"></i> Desactivar Notificaciones';
        return;
    }

    subscribeBtn.dataset.action = 'subscribe';
    subscribeBtn.classList.remove('btn-secondary');
    subscribeBtn.classList.add('btn-primary');
    subscribeBtn.innerHTML = '<i class="fas fa-bell"></i> Activar Notificaciones';
}

async function getPushConfig() {
    const payload = await apiRequest('push-config');
    const publicKey = String(payload.publicKey || '');
    if (!publicKey) {
        throw new Error('VAPID public key no disponible');
    }
    return publicKey;
}

async function checkSubscriptionState() {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    updateSubscribeButton(Boolean(subscription));
    return subscription;
}

async function subscribe() {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
        throw new Error('Permiso de notificaciones denegado');
    }

    const publicKey = await getPushConfig();
    const registration = await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    if (existing) {
        return existing;
    }

    const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
    });

    await apiRequest('push-subscribe', {
        method: 'POST',
        body: { subscription }
    });

    return subscription;
}

async function unsubscribe() {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
        return;
    }

    await apiRequest('push-unsubscribe', {
        method: 'POST',
        body: { endpoint: subscription.endpoint }
    });

    await subscription.unsubscribe();
}

async function onToggleSubscription() {
    const { subscribeBtn } = getButtons();
    if (!subscribeBtn) return;
    const action = String(subscribeBtn.dataset.action || 'subscribe');

    const previous = subscribeBtn.innerHTML;
    subscribeBtn.disabled = true;
    subscribeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...';

    try {
        if (action === 'unsubscribe') {
            await unsubscribe();
            showToast('Notificaciones desactivadas', 'info');
        } else {
            await subscribe();
            showToast('Notificaciones activadas', 'success');
        }
    } catch (error) {
        showToast(`Push: ${error.message || 'error desconocido'}`, 'error');
    } finally {
        subscribeBtn.disabled = false;
        await checkSubscriptionState().catch(() => {
            updateSubscribeButton(false);
        });
        if (subscribeBtn.dataset.action !== 'subscribe' && subscribeBtn.dataset.action !== 'unsubscribe') {
            subscribeBtn.innerHTML = previous;
        }
    }
}

async function onTestNotification() {
    const { testBtn } = getButtons();
    if (!testBtn) return;
    const icon = testBtn.querySelector('i');
    const previousClass = icon ? icon.className : '';
    testBtn.disabled = true;
    if (icon) {
        icon.className = 'fas fa-spinner fa-spin';
    }

    try {
        const payload = await apiRequest('push-test', { method: 'POST', body: {} });
        const result = payload.result || {};
        const success = Number(result.success || 0);
        const failed = Number(result.failed || 0);
        if (failed > 0) {
            showToast(`Push test: ${success} ok, ${failed} fallidos`, 'warning');
        } else {
            showToast(`Push test enviado (${success})`, 'success');
        }
    } catch (error) {
        showToast(`Push test: ${error.message || 'error'}`, 'error');
    } finally {
        if (icon) {
            icon.className = previousClass;
        }
        testBtn.disabled = false;
    }
}

export async function initPushNotifications() {
    if (initialized) {
        return;
    }
    initialized = true;

    const { subscribeBtn, testBtn } = getButtons();
    if (!subscribeBtn || !testBtn) {
        return;
    }

    const supported = (
        typeof window !== 'undefined' &&
        'serviceWorker' in navigator &&
        'PushManager' in window &&
        typeof Notification !== 'undefined'
    );

    if (!supported) {
        setButtonsVisibility(false);
        return;
    }

    try {
        await navigator.serviceWorker.register('/sw.js');
        await getPushConfig();
        setButtonsVisibility(true);
        subscribeBtn.addEventListener('click', onToggleSubscription);
        testBtn.addEventListener('click', onTestNotification);
        await checkSubscriptionState();
    } catch (error) {
        setButtonsVisibility(false);
        // Keep admin UX clean when push is not enabled in this environment.
        // The controls stay hidden and the dashboard remains fully functional.
        console.info('Push no configurado en servidor:', error?.message || error);
    }
}

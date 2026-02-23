import { checkAuth, login, login2FA, logout } from './modules/auth.js';
import { refreshData, getLocalData } from './modules/data.js';
import { showToast } from './modules/ui.js';
import {
    setCsrfToken,
    currentAppointments,
    currentCallbacks,
    currentReviews,
    currentAvailability,
} from './modules/state.js';
import { apiRequest } from './modules/api.js';
import { loadDashboardData } from './modules/dashboard.js';
import {
    loadCallbacks,
    filterCallbacks,
    markContacted,
} from './modules/callbacks.js';
import { loadReviews } from './modules/reviews.js';
import { initPushNotifications } from './modules/push.js';

// Modulos cargados bajo demanda (code splitting)
function loadAppointmentsModule() {
    return import('./modules/appointments.js');
}
function loadAvailabilityModule() {
    return import('./modules/availability.js');
}

async function renderSection(section) {
    const titles = {
        dashboard: 'Dashboard',
        appointments: 'Citas',
        callbacks: 'Callbacks',
        reviews: 'Resenas',
        availability: 'Disponibilidad',
    };
    const titleEl = document.getElementById('pageTitle');
    if (titleEl) titleEl.textContent = titles[section] || 'Dashboard';

    document
        .querySelectorAll('.admin-section')
        .forEach((s) => s.classList.remove('active'));
    const sectionEl = document.getElementById(section);
    if (sectionEl) sectionEl.classList.add('active');

    switch (section) {
        case 'dashboard':
            loadDashboardData();
            break;
        case 'appointments': {
            const { loadAppointments } = await loadAppointmentsModule();
            loadAppointments();
            break;
        }
        case 'callbacks':
            loadCallbacks();
            break;
        case 'reviews':
            loadReviews();
            break;
        case 'availability': {
            const { initAvailabilityCalendar } = await loadAvailabilityModule();
            await initAvailabilityCalendar();
            break;
        }
        default:
            loadDashboardData();
            break;
    }
}

function showLogin() {
    const loginScreen = document.getElementById('loginScreen');
    const dashboard = document.getElementById('adminDashboard');
    if (loginScreen) loginScreen.classList.remove('is-hidden');
    if (dashboard) dashboard.classList.add('is-hidden');
}

async function showDashboard() {
    const loginScreen = document.getElementById('loginScreen');
    const dashboard = document.getElementById('adminDashboard');
    if (loginScreen) loginScreen.classList.add('is-hidden');
    if (dashboard) dashboard.classList.remove('is-hidden');
    await updateDate();
    await initPushNotifications();
}

async function handleLogin(event) {
    event.preventDefault();

    const group2FA = document.getElementById('group2FA');
    const is2FAMode = group2FA && !group2FA.classList.contains('is-hidden');

    if (is2FAMode) {
        const code = document.getElementById('admin2FACode')?.value || '';
        try {
            const result = await login2FA(code);
            if (result.csrfToken) setCsrfToken(result.csrfToken);
            showToast('Bienvenido al panel de administracion', 'success');
            await showDashboard();
        } catch {
            showToast('Codigo incorrecto o sesion expirada', 'error');
        }
        return;
    }

    const password = document.getElementById('adminPassword')?.value || '';
    try {
        const loginResult = await login(password);

        if (loginResult.twoFactorRequired) {
            document.getElementById('passwordGroup')?.classList.add('is-hidden');
            group2FA?.classList.remove('is-hidden');
            document.getElementById('admin2FACode')?.focus();
            const btn = document.getElementById('loginBtn');
            if (btn) btn.innerHTML = '<i class="fas fa-check"></i> Verificar';
            showToast('Ingresa tu codigo 2FA', 'info');
            return;
        }

        if (loginResult.csrfToken) setCsrfToken(loginResult.csrfToken);
        showToast('Bienvenido al panel de administracion', 'success');
        await showDashboard();
    } catch {
        showToast('Contrasena incorrecta', 'error');
    }
}

async function checkAuthAndBoot() {
    if (!navigator.onLine && getLocalData('appointments', null)) {
        showToast('Modo offline: mostrando datos locales', 'info');
        await showDashboard();
        return;
    }

    const authenticated = await checkAuth();
    if (authenticated) {
        await showDashboard();
        return;
    }
    showLogin();
}

async function updateDate() {
    const dateEl = document.getElementById('currentDate');
    if (dateEl) {
        const options = {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        };
        dateEl.textContent = new Date().toLocaleDateString('es-EC', options);
    }

    await refreshData();
    const activeItem = document.querySelector('.nav-item.active');
    const section = activeItem?.dataset.section || 'dashboard';
    await renderSection(section);
}

function exportData() {
    const payload = {
        appointments: currentAppointments,
        callbacks: currentCallbacks,
        reviews: currentReviews,
        availability: currentAvailability,
        exportDate: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `piel-en-armonia-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Datos exportados correctamente', 'success');
}

async function importData(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    input.value = '';

    if (
        !confirm(
            'Esto reemplazara TODOS los datos actuales con los del archivo seleccionado.\n\nDeseas continuar?'
        )
    ) {
        return;
    }

    try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!data || typeof data !== 'object') {
            throw new Error('El archivo no contiene datos validos');
        }

        const payload = {
            appointments: Array.isArray(data.appointments)
                ? data.appointments
                : [],
            callbacks: Array.isArray(data.callbacks) ? data.callbacks : [],
            reviews: Array.isArray(data.reviews) ? data.reviews : [],
            availability:
                data.availability && typeof data.availability === 'object'
                    ? data.availability
                    : {},
        };

        await apiRequest('import', {
            method: 'POST',
            body: payload,
        });

        await refreshData();
        const activeItem = document.querySelector('.nav-item.active');
        await renderSection(activeItem?.dataset.section || 'dashboard');
        showToast(`Datos importados: ${payload.appointments.length} citas`, 'success');
    } catch (error) {
        showToast(`Error al importar: ${error.message}`, 'error');
    }
}

function attachGlobalListeners() {
    document.addEventListener('click', async (event) => {
        const actionEl = event.target.closest('[data-action]');
        if (!actionEl) return;
        const action = actionEl.dataset.action;

        if (action === 'close-toast') {
            actionEl.closest('.toast')?.remove();
            return;
        }

        if (action === 'logout') {
            event.preventDefault();
            await logout();
            return;
        }

        if (action === 'export-data') {
            event.preventDefault();
            exportData();
            return;
        }

        if (action === 'open-import-file') {
            event.preventDefault();
            document.getElementById('importFileInput')?.click();
            return;
        }

        try {
            if (action === 'export-csv') {
                event.preventDefault();
                const { exportAppointmentsCSV } = await loadAppointmentsModule();
                exportAppointmentsCSV();
                return;
            }
            if (action === 'change-month') {
                event.preventDefault();
                const { changeMonth } = await loadAvailabilityModule();
                changeMonth(Number(actionEl.dataset.delta || 0));
                return;
            }
            if (action === 'add-time-slot') {
                event.preventDefault();
                const { addTimeSlot } = await loadAvailabilityModule();
                await addTimeSlot();
                return;
            }
            if (action === 'remove-time-slot') {
                event.preventDefault();
                const { removeTimeSlot } = await loadAvailabilityModule();
                await removeTimeSlot(
                    decodeURIComponent(actionEl.dataset.date || ''),
                    decodeURIComponent(actionEl.dataset.time || '')
                );
                return;
            }
            if (action === 'approve-transfer') {
                event.preventDefault();
                const { approveTransfer } = await loadAppointmentsModule();
                await approveTransfer(Number(actionEl.dataset.id || 0));
                return;
            }
            if (action === 'reject-transfer') {
                event.preventDefault();
                const { rejectTransfer } = await loadAppointmentsModule();
                await rejectTransfer(Number(actionEl.dataset.id || 0));
                return;
            }
            if (action === 'cancel-appointment') {
                event.preventDefault();
                const { cancelAppointment } = await loadAppointmentsModule();
                await cancelAppointment(Number(actionEl.dataset.id || 0));
                return;
            }
            if (action === 'mark-no-show') {
                event.preventDefault();
                const { markNoShow } = await loadAppointmentsModule();
                await markNoShow(Number(actionEl.dataset.id || 0));
                return;
            }
            if (action === 'mark-contacted') {
                event.preventDefault();
                await markContacted(
                    Number(actionEl.dataset.callbackId || 0),
                    actionEl.dataset.callbackDate || ''
                );
            }
        } catch (error) {
            showToast(`Error ejecutando accion: ${error.message}`, 'error');
        }
    });

    const appointmentFilter = document.getElementById('appointmentFilter');
    if (appointmentFilter) {
        appointmentFilter.addEventListener('change', async () => {
            const { filterAppointments } = await loadAppointmentsModule();
            filterAppointments();
        });
    }

    const searchInput = document.getElementById('searchAppointments');
    if (searchInput) {
        searchInput.addEventListener('input', async () => {
            const { searchAppointments } = await loadAppointmentsModule();
            searchAppointments();
        });
    }

    const callbackFilter = document.getElementById('callbackFilter');
    if (callbackFilter) {
        callbackFilter.addEventListener('change', filterCallbacks);
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    attachGlobalListeners();

    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach((item) => {
        item.addEventListener('click', async function onNavClick(event) {
            event.preventDefault();
            navItems.forEach((nav) => nav.classList.remove('active'));
            this.classList.add('active');
            await refreshData();
            await renderSection(this.dataset.section);
        });
    });

    const importFileInput = document.getElementById('importFileInput');
    if (importFileInput) {
        importFileInput.addEventListener('change', () => importData(importFileInput));
    }

    window.addEventListener('online', async () => {
        showToast('Conexion restaurada. Actualizando datos...', 'success');
        await refreshData();
        const activeItem = document.querySelector('.nav-item.active');
        await renderSection(activeItem?.dataset.section || 'dashboard');
    });

    await checkAuthAndBoot();
});

export const SECTION_TITLES = {
    dashboard: 'Dashboard',
    appointments: 'Citas',
    callbacks: 'Callbacks',
    reviews: 'Resenas',
    availability: 'Disponibilidad',
    queue: 'Turnero Sala',
};

export const SECTION_CONTEXT = {
    dashboard: {
        eyebrow: 'Resumen Diario',
        title: 'Que requiere atencion ahora',
        summary:
            'Lee agenda, callbacks y disponibilidad desde un frente claro y sin ruido.',
        actions: [
            {
                action: 'context-open-appointments-transfer',
                label: 'Validar pagos',
                meta: 'Transferencias pendientes',
                shortcut: 'Alt+Shift+T',
            },
            {
                action: 'context-open-callbacks-pending',
                label: 'Llamadas',
                meta: 'Pendientes por contacto',
                shortcut: 'Alt+Shift+P',
            },
            {
                action: 'refresh-admin-data',
                label: 'Actualizar',
                meta: 'Sincronizar tablero',
                shortcut: 'Ctrl+K',
            },
        ],
    },
    appointments: {
        eyebrow: 'Agenda Clinica',
        title: 'Triage de citas',
        summary:
            'Prioriza transferencias, no show y proximas 48 horas sin perder lectura.',
        actions: [
            {
                action: 'clear-appointment-filters',
                label: 'Limpiar filtros',
                meta: 'Regresar al corte total',
                shortcut: 'Reset',
            },
            {
                action: 'export-csv',
                label: 'Exportar CSV',
                meta: 'Bajar corte operativo',
                shortcut: 'CSV',
            },
            {
                action: 'context-open-callbacks-pending',
                label: 'Ir a callbacks',
                meta: 'Cruzar seguimiento telefonico',
                shortcut: 'Alt+Shift+3',
            },
        ],
    },
    callbacks: {
        eyebrow: 'SLA Telefonico',
        title: 'Siguiente callback',
        summary:
            'Ordena la cola por urgencia, contacto pendiente y siguiente accion real.',
        actions: [
            {
                action: 'callbacks-triage-next',
                label: 'Siguiente llamada',
                meta: 'Mover foco al siguiente caso',
                shortcut: 'Next',
            },
            {
                action: 'context-open-callbacks-next',
                label: 'Abrir siguiente',
                meta: 'Ir a la tarjeta prioritaria',
                shortcut: 'Alt+Shift+3',
            },
            {
                action: 'context-open-appointments-transfer',
                label: 'Cruzar citas',
                meta: 'Revisar pagos pendientes',
                shortcut: 'Alt+Shift+2',
            },
        ],
    },
    reviews: {
        eyebrow: 'Lectura De Calidad',
        title: 'Resenas y senal reciente',
        summary:
            'Resume rating, volumen y comentarios utiles sin convertir feedback en ruido.',
        actions: [
            {
                action: 'refresh-admin-data',
                label: 'Actualizar',
                meta: 'Sincronizar resenas',
                shortcut: 'Sync',
            },
            {
                action: 'context-open-dashboard',
                label: 'Volver al dashboard',
                meta: 'Regresar al resumen diario',
                shortcut: 'Alt+Shift+1',
            },
            {
                action: 'context-open-callbacks-pending',
                label: 'Ir a callbacks',
                meta: 'Cerrar seguimiento operativo',
                shortcut: 'Alt+Shift+3',
            },
        ],
    },
    availability: {
        eyebrow: 'Calendario Editorial',
        title: 'Planeacion de disponibilidad',
        summary:
            'Gestiona slots, duplicados y semanas futuras con el calendario como canvas principal.',
        actions: [
            {
                action: 'context-availability-today',
                label: 'Ir a hoy',
                meta: 'Volver al dia actual',
                shortcut: 'Today',
            },
            {
                action: 'context-availability-next',
                label: 'Siguiente con slots',
                meta: 'Buscar siguiente dia util',
                shortcut: 'Next',
            },
            {
                action: 'context-copy-availability-day',
                label: 'Copiar dia',
                meta: 'Duplicar jornada seleccionada',
                shortcut: 'Copy',
            },
        ],
    },
    queue: {
        eyebrow: 'Fase 2',
        title: 'Turnero sala',
        summary:
            'Esta superficie se mantiene compatible, pero su rediseño completo queda fuera de esta primera ola.',
        actions: [
            {
                action: 'queue-call-next',
                label: 'Llamar C1',
                meta: 'Despachar siguiente ticket',
                shortcut: 'C1',
                queueConsultorio: '1',
            },
            {
                action: 'queue-call-next',
                label: 'Llamar C2',
                meta: 'Despachar consultorio 2',
                shortcut: 'C2',
                queueConsultorio: '2',
            },
            {
                action: 'queue-refresh-state',
                label: 'Refrescar cola',
                meta: 'Sincronizar estado operativo',
                shortcut: 'Sync',
            },
        ],
    },
};

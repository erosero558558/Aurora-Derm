export const QUEUE_CONTEXT = {
    eyebrow: 'Herramientas avanzadas',
    title: 'Turnero y diagnostico de sala',
    summary:
        'Mantiene el turnero completo, instaladores y diagnostico fuera del flujo principal diario.',
    actions: [
        {
            action: 'open-operator-app',
            label: 'Abrir turnero',
            meta: 'Ir a la app operativa separada',
        },
        {
            action: 'queue-call-next',
            label: 'Llamar C1',
            meta: 'Despachar siguiente ticket',
            queueConsultorio: '1',
        },
        {
            action: 'queue-refresh-state',
            label: 'Refrescar cola',
            meta: 'Sincronizar estado operativo',
        },
    ],
};

export const QUEUE_CONTEXT = {
    eyebrow: 'Consola operativa',
    title: 'Control room del turnero',
    summary:
        'El admin arranca en queue para mostrar operación diaria, truth/readiness y release registry sin abrir paneles expertos.',
    actions: [
        {
            action: 'open-operator-app',
            label: 'Abrir operador',
            meta: 'Ir a la surface operativa primaria',
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

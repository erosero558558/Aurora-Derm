export const CALLBACKS_CONTEXT = {
    eyebrow: 'Seguimiento',
    title: 'Pendientes de contacto',
    summary:
        'Prioriza llamadas pendientes y resuelve primero los casos mas atrasados.',
    actions: [
        {
            action: 'callbacks-triage-next',
            label: 'Siguiente llamada',
            meta: 'Mover foco al siguiente caso',
        },
        {
            action: 'context-open-callbacks-next',
            label: 'Abrir siguiente',
            meta: 'Ir a la tarjeta prioritaria',
        },
        {
            action: 'context-open-appointments-overview',
            label: 'Ver agenda',
            meta: 'Cruzar citas y seguimientos',
        },
    ],
};

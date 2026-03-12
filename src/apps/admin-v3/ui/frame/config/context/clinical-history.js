export const CLINICAL_HISTORY_CONTEXT = {
    eyebrow: 'Revision medica',
    title: 'Historia clinica conversacional',
    summary:
        'Revisa el transcript, ajusta el borrador y aprueba el caso antes de la atencion.',
    actions: [
        {
            action: 'refresh-admin-data',
            label: 'Actualizar cola',
            meta: 'Sincronizar snapshot clinico',
        },
        {
            action: 'context-open-dashboard',
            label: 'Volver al inicio',
            meta: 'Regresar al resumen operativo',
        },
        {
            action: 'context-open-callbacks-pending',
            label: 'Ver pendientes',
            meta: 'Cruzar seguimiento operativo',
        },
    ],
};

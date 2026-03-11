export const REVIEWS_CONTEXT = {
    eyebrow: 'Calidad',
    title: 'Resenas y calidad reciente',
    summary:
        'Consulta feedback y calidad reciente desde una vista secundaria.',
    actions: [
        {
            action: 'refresh-admin-data',
            label: 'Actualizar',
            meta: 'Sincronizar resenas',
        },
        {
            action: 'context-open-dashboard',
            label: 'Volver al inicio',
            meta: 'Regresar al resumen operativo',
        },
        {
            action: 'context-open-callbacks-pending',
            label: 'Ver pendientes',
            meta: 'Cerrar seguimiento operativo',
        },
    ],
};

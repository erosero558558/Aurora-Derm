export const AVAILABILITY_CONTEXT = {
    eyebrow: 'Horarios',
    title: 'Horarios de atencion',
    summary:
        'Gestiona horarios publicados y prepara nuevas jornadas sin salir del calendario.',
    actions: [
        {
            action: 'context-availability-today',
            label: 'Ir a hoy',
            meta: 'Volver al dia actual',
        },
        {
            action: 'context-availability-next',
            label: 'Siguiente con slots',
            meta: 'Buscar siguiente dia util',
        },
        {
            action: 'context-copy-availability-day',
            label: 'Copiar dia',
            meta: 'Duplicar jornada seleccionada',
        },
    ],
};

export const DASHBOARD_CONTEXT = {
    eyebrow: 'Recepcion/Admin',
    title: 'Que requiere atencion ahora',
    summary:
        'Agenda, pendientes y turnero separados en un panel mas simple para la operacion diaria.',
    actions: [
        {
            action: 'open-operator-app',
            label: 'Abrir turnero',
            meta: 'Ir a la app operativa de sala',
        },
        {
            action: 'context-open-appointments-overview',
            label: 'Ver agenda',
            meta: 'Ir a pacientes y citas del dia',
        },
        {
            action: 'context-open-callbacks-pending',
            label: 'Revisar pendientes',
            meta: 'Llamadas y seguimientos pendientes',
        },
    ],
};

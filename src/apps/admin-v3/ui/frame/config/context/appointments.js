export const APPOINTMENTS_CONTEXT = {
    eyebrow: 'Agenda del dia',
    title: 'Pacientes y citas',
    summary:
        'Consulta la agenda, filtra pendientes y resuelve pagos sin perder el hilo del dia.',
    actions: [
        {
            action: 'clear-appointment-filters',
            label: 'Limpiar filtros',
            meta: 'Volver a la agenda completa',
        },
        {
            action: 'export-csv',
            label: 'Exportar CSV',
            meta: 'Descargar agenda para soporte',
        },
        {
            action: 'context-open-callbacks-pending',
            label: 'Ver pendientes',
            meta: 'Cruzar seguimiento telefonico',
        },
    ],
};

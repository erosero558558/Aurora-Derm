export function phoneLabel(item) {
    return (
        String(item?.telefono || item?.phone || 'Sin telefono').trim() ||
        'Sin telefono'
    );
}

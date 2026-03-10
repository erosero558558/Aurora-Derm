export function getSpotlightReview(sortedReviews) {
    const lowRated = sortedReviews.find(
        (item) => Number(item.rating || 0) <= 3
    );
    if (lowRated) {
        return {
            item: lowRated,
            eyebrow: 'Feedback accionable',
            summary:
                'Empieza por la resena mas fragil para entender si hay friccion operativa real.',
        };
    }

    const premiumSignal = sortedReviews.find(
        (item) => Number(item.rating || 0) >= 5
    );
    if (premiumSignal) {
        return {
            item: premiumSignal,
            eyebrow: 'Senal a repetir',
            summary:
                'Usa este comentario como referencia del recorrido que conviene proteger.',
        };
    }

    if (sortedReviews[0]) {
        return {
            item: sortedReviews[0],
            eyebrow: 'Ultima voz',
            summary: 'Es la resena mas reciente dentro del corte actual.',
        };
    }

    return {
        item: null,
        eyebrow: 'Sin spotlight',
        summary:
            'Cuando entren resenas apareceran aqui con lectura prioritaria.',
    };
}

export function normalize(value) {
    return String(value || '')
        .toLowerCase()
        .trim();
}

export function reviewTimestamp(item) {
    const date = new Date(item?.date || item?.createdAt || '');
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

export function getSortedReviews(reviews) {
    return reviews
        .slice()
        .sort((a, b) => reviewTimestamp(b) - reviewTimestamp(a));
}

export function getStarLabel(rating) {
    const safeRating = Math.max(
        0,
        Math.min(5, Math.round(Number(rating || 0)))
    );
    return `${safeRating}/5`;
}

export function getInitials(name) {
    const parts = String(name || 'Anonimo')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2);

    if (!parts.length) return 'AN';
    return parts.map((part) => part.charAt(0).toUpperCase()).join('');
}

export function clipCopy(value, maxLength = 220) {
    const text = String(value || '').trim();
    if (!text) return 'Sin comentario escrito.';
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength - 1).trim()}...`;
}

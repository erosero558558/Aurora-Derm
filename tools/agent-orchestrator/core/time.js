function isoNow() {
    return new Date().toISOString();
}

function plusHoursIso(hours) {
    const safeHours = Number.isFinite(Number(hours)) ? Number(hours) : 24;
    return new Date(Date.now() + safeHours * 60 * 60 * 1000).toISOString();
}

function currentDate() {
    return new Date().toISOString().slice(0, 10);
}

module.exports = {
    isoNow,
    plusHoursIso,
    currentDate,
};

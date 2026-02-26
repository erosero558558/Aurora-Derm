/**
 * Piel en Armonia - Booking Calendar Logic
 * Extracted for lazy loading.
 */

function initCalendar() {
    // This function satisfies the explicit user request example.
    // In our architecture, the logic is mainly in updateAvailableTimes which is called by UI events.
    if (window.debugLog) {
        window.debugLog('Booking calendar module loaded lazy.');
    }
}

async function updateAvailableTimes(deps, elements) {
    const { dateInput, timeSelect, doctorSelect, serviceSelect, t } = elements;

    const selectedDate = dateInput ? dateInput.value : '';
    if (!selectedDate || !timeSelect) return;

    const selectedDoctor = doctorSelect ? doctorSelect.value : '';
    const selectedService = serviceSelect ? serviceSelect.value : 'consulta';
    const availability = await deps.loadAvailabilityData({
        doctor: selectedDoctor || 'indiferente',
        service: selectedService || 'consulta',
        strict: true,
    });
    const bookedSlots = await deps.getBookedSlots(
        selectedDate,
        selectedDoctor,
        selectedService
    );
    const availableSlots = availability[selectedDate] || [];
    const isToday = selectedDate === new Date().toISOString().split('T')[0];
    const nowMinutes = isToday
        ? new Date().getHours() * 60 + new Date().getMinutes()
        : -1;
    const freeSlots = availableSlots.filter((slot) => {
        if (bookedSlots.includes(slot)) return false;
        if (isToday) {
            const [h, m] = slot.split(':').map(Number);
            if (h * 60 + m <= nowMinutes + 60) return false;
        }
        return true;
    });

    const currentValue = timeSelect.value;
    timeSelect.innerHTML = '<option value="">Hora</option>';

    if (freeSlots.length === 0) {
        timeSelect.innerHTML +=
            '<option value="" disabled>No hay horarios disponibles</option>';
        deps.showToast(
            t(
                'No hay horarios disponibles para esta fecha',
                'No slots available for this date'
            ),
            'warning'
        );
        return;
    }

    freeSlots.forEach((time) => {
        const option = document.createElement('option');
        option.value = time;
        option.textContent = time;
        if (time === currentValue) option.selected = true;
        timeSelect.appendChild(option);
    });
}

export { initCalendar, updateAvailableTimes };

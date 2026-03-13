import { updateState } from '../../../core/store.js';
import { renderQueueActivity } from '../render.js';

export function appendActivity(message) {
    updateState((state) => {
        const clinicId = String(
            state?.data?.turneroClinicProfile?.clinic_id || 'default-clinic'
        ).trim();
        const nextActivity = [
            {
                at: new Date().toISOString(),
                clinicId,
                message: String(message || ''),
            },
            ...(state.queue.activity || []),
        ].slice(0, 30);

        return {
            ...state,
            queue: {
                ...state.queue,
                activity: nextActivity,
            },
        };
    });

    try {
        renderQueueActivity();
    } catch (_error) {
        // queue UI may not be mounted yet
    }
}

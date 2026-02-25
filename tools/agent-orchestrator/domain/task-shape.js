'use strict';

function toTaskJson(task) {
    return {
        id: String(task?.id || ''),
        title: String(task?.title || ''),
        owner: String(task?.owner || ''),
        executor: String(task?.executor || ''),
        status: String(task?.status || ''),
        risk: String(task?.risk || ''),
        scope: String(task?.scope || ''),
        files: Array.isArray(task?.files) ? task.files : [],
        acceptance_ref: String(task?.acceptance_ref || ''),
        updated_at: String(task?.updated_at || ''),
    };
}

function toTaskFullJson(task) {
    return {
        id: String(task?.id || ''),
        title: String(task?.title || ''),
        owner: String(task?.owner || ''),
        executor: String(task?.executor || ''),
        status: String(task?.status || ''),
        risk: String(task?.risk || ''),
        scope: String(task?.scope || ''),
        files: Array.isArray(task?.files) ? task.files : [],
        acceptance: String(task?.acceptance || ''),
        acceptance_ref: String(task?.acceptance_ref || ''),
        depends_on: Array.isArray(task?.depends_on) ? task.depends_on : [],
        prompt: String(task?.prompt || ''),
        created_at: String(task?.created_at || ''),
        updated_at: String(task?.updated_at || ''),
    };
}

module.exports = {
    toTaskJson,
    toTaskFullJson,
};

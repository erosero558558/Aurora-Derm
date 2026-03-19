function normalizeControlRow(control = {}, index = 0) {
    const source = control && typeof control === 'object' ? control : {};
    return {
        key:
            String(source.key || `control-${index + 1}`).trim() ||
            `control-${index + 1}`,
        label:
            String(source.label || `Control ${index + 1}`).trim() ||
            `Control ${index + 1}`,
        owner: String(source.owner || 'unassigned').trim() || 'unassigned',
        state: String(source.state || 'watch').trim() || 'watch',
        detail: String(source.detail || '').trim(),
        source: String(source.source || 'library').trim() || 'library',
        updatedAt:
            String(source.updatedAt || new Date().toISOString()).trim() ||
            new Date().toISOString(),
    };
}

export function buildTurneroReleaseControlLibrary(input = {}) {
    const controlsInput =
        Array.isArray(input.controls) && input.controls.length
            ? input.controls
            : [
                  {
                      key: 'canon-profile',
                      label: 'Clinic profile canon',
                      owner: 'product',
                      state: 'pass',
                  },
                  {
                      key: 'remote-health',
                      label: 'Remote health checks',
                      owner: 'infra',
                      state: 'watch',
                  },
                  {
                      key: 'public-sync',
                      label: 'Public sync verification',
                      owner: 'web',
                      state: 'watch',
                  },
                  {
                      key: 'incident-handoff',
                      label: 'Incident handoff discipline',
                      owner: 'ops',
                      state: 'pass',
                  },
              ];

    const controls = controlsInput.map((control, index) =>
        normalizeControlRow(control, index)
    );

    const summary = {
        all: controls.length,
        pass: controls.filter((item) => item.state === 'pass').length,
        watch: controls.filter((item) => item.state === 'watch').length,
        fail: controls.filter((item) => item.state === 'fail').length,
    };

    return {
        controls,
        summary,
        generatedAt: new Date().toISOString(),
    };
}

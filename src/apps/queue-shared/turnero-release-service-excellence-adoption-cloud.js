import { buildTurneroReleaseServiceQualityMetrics } from './turnero-release-service-quality-metrics.js';
import { buildTurneroReleaseAdoptionCohortLab } from './turnero-release-adoption-cohort-lab.js';
import { createTurneroReleaseTrainingReadinessRegistry } from './turnero-release-training-readiness-registry.js';
import { buildTurneroReleaseChangeSaturationIndex } from './turnero-release-change-saturation-index.js';
import { createTurneroReleaseFieldFeedbackExchange } from './turnero-release-field-feedback-exchange.js';
import { buildTurneroReleaseClinicMaturityLadder } from './turnero-release-clinic-maturity-ladder.js';
import { buildTurneroReleaseServiceExcellenceScore } from './turnero-release-service-excellence-score.js';

function downloadJson(filename, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function copyText(text) {
    if (!navigator.clipboard?.writeText) return false;
    await navigator.clipboard.writeText(text);
    return true;
}

function adoptionBriefToMarkdown(pack = {}) {
    const lines = [
        '# Service Excellence Adoption Cloud',
        '',
        `Service excellence score: ${pack.excellence?.score ?? 0} (${pack.excellence?.band || 'n/a'})`,
        `Average quality: ${pack.quality?.avgScore ?? 0}`,
        `Average change load: ${pack.saturation?.avgLoad ?? 0}`,
        `Training entries: ${(pack.training || []).length}`,
        `Feedback entries: ${(pack.feedback || []).length}`,
    ];
    return lines.join('\n');
}

function normalizeClinicRecord(clinic = {}, index = 0) {
    return {
        clinicId: String(
            clinic.clinicId ||
                clinic.id ||
                clinic.clinic_id ||
                `clinic-${index + 1}`
        ),
        adoptionRate: Number(clinic.adoptionRate || 72),
        queueFlowScore: Number(clinic.queueFlowScore || 78),
        callAccuracyScore: Number(clinic.callAccuracyScore || 80),
        deskReadinessScore: Number(clinic.deskReadinessScore || 74),
        patientSignalScore: Number(clinic.patientSignalScore || 76),
        trainingReadiness: Number(clinic.trainingReadiness || 68),
        status: clinic.status || 'active',
    };
}

function resolveClinics(input = {}) {
    const clinicProfile =
        input.clinicProfile || input.turneroClinicProfile || {};

    if (Array.isArray(input.clinics) && input.clinics.length) {
        return input.clinics.map(normalizeClinicRecord);
    }

    if (Array.isArray(input.regionalClinics) && input.regionalClinics.length) {
        return input.regionalClinics.map(normalizeClinicRecord);
    }

    if (
        Array.isArray(clinicProfile.regionalClinics) &&
        clinicProfile.regionalClinics.length
    ) {
        return clinicProfile.regionalClinics.map(normalizeClinicRecord);
    }

    if (
        clinicProfile &&
        typeof clinicProfile === 'object' &&
        Object.keys(clinicProfile).length
    ) {
        return [
            normalizeClinicRecord(
                {
                    clinicId:
                        clinicProfile.clinicId ||
                        clinicProfile.clinic_id ||
                        input.clinicId ||
                        input.scope ||
                        'regional',
                    adoptionRate: clinicProfile.adoptionRate,
                    queueFlowScore: clinicProfile.queueFlowScore,
                    callAccuracyScore: clinicProfile.callAccuracyScore,
                    deskReadinessScore: clinicProfile.deskReadinessScore,
                    patientSignalScore: clinicProfile.patientSignalScore,
                    trainingReadiness: clinicProfile.trainingReadiness,
                    status: clinicProfile.status,
                },
                0
            ),
        ];
    }

    return [];
}

export function mountTurneroReleaseServiceExcellenceAdoptionCloud(
    target,
    input = {}
) {
    if (!target) return null;

    const clinicProfile =
        input.clinicProfile || input.turneroClinicProfile || null;
    const clinics = resolveClinics(input);
    const scope =
        input.scope ||
        input.region ||
        input.clinicId ||
        clinicProfile?.region ||
        clinics[0]?.clinicId ||
        clinicProfile?.clinic_id ||
        clinicProfile?.clinicId ||
        'global';
    const incidents = Array.isArray(input.incidents)
        ? input.incidents
        : Array.isArray(input.releaseIncidents)
          ? input.releaseIncidents
          : [];

    const trainingRegistry =
        createTurneroReleaseTrainingReadinessRegistry(scope);
    const feedbackExchange = createTurneroReleaseFieldFeedbackExchange(scope);

    const quality = buildTurneroReleaseServiceQualityMetrics({
        ...input,
        clinics,
    });
    const buildComposite = (training, feedback) => {
        const cohorts = buildTurneroReleaseAdoptionCohortLab({
            clinics: clinics.map((clinic) => {
                const clinicId = clinic.clinicId || clinic.id;
                const trainingRows = training.filter(
                    (item) => item.clinicId === clinicId
                );
                const trainingAvg = trainingRows.length
                    ? trainingRows.reduce(
                          (sum, item) => sum + Number(item.readiness || 0),
                          0
                      ) / trainingRows.length
                    : Number(clinic.trainingReadiness || 0);
                const qualityRow = quality.rows.find(
                    (row) => row.clinicId === clinicId
                );
                return {
                    ...clinic,
                    trainingReadiness: Number(trainingAvg.toFixed(1)),
                    qualityScore: qualityRow?.score || 0,
                };
            }),
        });
        const saturation = buildTurneroReleaseChangeSaturationIndex({
            clinics,
            incidents,
            feedback,
            training,
        });
        const maturity = buildTurneroReleaseClinicMaturityLadder({
            qualityRows: quality.rows,
            cohortRows: cohorts.rows,
            saturationRows: saturation.rows,
        });
        const excellence = buildTurneroReleaseServiceExcellenceScore({
            quality,
            cohorts: cohorts.rows,
            maturity: maturity.rows,
            saturation,
        });
        return { cohorts, saturation, maturity, excellence };
    };

    let training = trainingRegistry.list();
    let feedback = feedbackExchange.list();
    let composite = buildComposite(training, feedback);

    const pack = {
        quality,
        training,
        feedback,
        cohortLab: composite.cohorts,
        saturation: composite.saturation,
        maturity: composite.maturity,
        excellence: composite.excellence,
    };

    const root = document.createElement('section');
    root.className = 'turnero-release-service-excellence-adoption-cloud';
    root.innerHTML = `
    <div class="card">
      <h3>Service Excellence Adoption Cloud</h3>
      <p>Calidad operativa, adopción, entrenamiento y madurez clínica para sostener el rollout.</p>
      <div class="grid">
        <div><strong>Excellence</strong><br><span data-role="score">${pack.excellence.score}</span> / ${pack.excellence.band}</div>
        <div><strong>Quality</strong><br>${quality.avgScore}</div>
        <div><strong>Change load</strong><br><span data-role="change-load">${pack.saturation.avgLoad}</span></div>
        <div><strong>Maturity rows</strong><br>${pack.maturity.rows.length}</div>
      </div>

      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;">
        <button type="button" data-action="copy-adoption-brief">Copy adoption brief</button>
        <button type="button" data-action="download-adoption-pack">Download adoption JSON</button>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;margin-top:16px;">
        <div>
          <label>New training readiness</label>
          <input data-field="training-clinic" placeholder="Clinic ID" style="width:100%;margin-top:6px;" />
          <input data-field="training-owner" placeholder="Owner" style="width:100%;margin-top:6px;" />
          <input data-field="training-readiness" placeholder="Readiness 0-100" style="width:100%;margin-top:6px;" />
          <button type="button" data-action="add-training" style="margin-top:8px;">Add training</button>
        </div>
        <div>
          <label>New field feedback</label>
          <input data-field="feedback-clinic" placeholder="Clinic ID" style="width:100%;margin-top:6px;" />
          <input data-field="feedback-owner" placeholder="Owner" style="width:100%;margin-top:6px;" />
          <input data-field="feedback-sentiment" placeholder="Sentiment" style="width:100%;margin-top:6px;" />
          <textarea data-field="feedback-note" placeholder="Feedback note" style="width:100%;margin-top:6px;"></textarea>
          <button type="button" data-action="add-feedback" style="margin-top:8px;">Add feedback</button>
        </div>
      </div>

      <pre data-role="adoption-brief" style="white-space:pre-wrap;margin-top:16px;">${adoptionBriefToMarkdown(pack)}</pre>
    </div>
  `;

    const scoreNode = root.querySelector('[data-role="score"]');
    const changeLoadNode = root.querySelector('[data-role="change-load"]');
    const briefNode = root.querySelector('[data-role="adoption-brief"]');

    const recompute = () => {
        pack.training = trainingRegistry.list();
        pack.feedback = feedbackExchange.list();
        const next = buildComposite(pack.training, pack.feedback);
        pack.cohortLab = next.cohorts;
        pack.saturation = next.saturation;
        pack.maturity = next.maturity;
        pack.excellence = next.excellence;

        if (scoreNode) scoreNode.textContent = String(pack.excellence.score);
        if (changeLoadNode)
            changeLoadNode.textContent = String(pack.saturation.avgLoad);
        if (briefNode) briefNode.textContent = adoptionBriefToMarkdown(pack);
    };

    root.addEventListener('click', async (event) => {
        const action = event.target?.getAttribute?.('data-action');
        if (!action) return;

        if (action === 'copy-adoption-brief') {
            await copyText(adoptionBriefToMarkdown(pack));
            return;
        }

        if (action === 'download-adoption-pack') {
            downloadJson('turnero-release-service-excellence-pack.json', pack);
            return;
        }

        if (action === 'add-training') {
            const clinicId =
                root.querySelector('[data-field="training-clinic"]')?.value ||
                '';
            const owner =
                root.querySelector('[data-field="training-owner"]')?.value ||
                '';
            const readiness =
                root.querySelector('[data-field="training-readiness"]')
                    ?.value || '';
            if (!clinicId.trim()) return;
            trainingRegistry.add({
                clinicId,
                owner,
                readiness: Number(readiness || 0),
                label: 'Training readiness',
                state: 'recorded',
            });
            recompute();
            return;
        }

        if (action === 'add-feedback') {
            const clinicId =
                root.querySelector('[data-field="feedback-clinic"]')?.value ||
                '';
            const owner =
                root.querySelector('[data-field="feedback-owner"]')?.value ||
                '';
            const sentiment =
                root.querySelector('[data-field="feedback-sentiment"]')
                    ?.value || '';
            const note =
                root.querySelector('[data-field="feedback-note"]')?.value || '';
            if (!clinicId.trim()) return;
            feedbackExchange.add({
                clinicId,
                owner,
                sentiment: sentiment || 'neutral',
                note,
                channel: 'onsite',
            });
            recompute();
        }
    });

    recompute();

    if (typeof target.replaceChildren === 'function') {
        target.replaceChildren(root);
    } else {
        target.innerHTML = '';
        target.appendChild(root);
    }

    return { root, pack, recompute };
}

# Real Debt Block 4 - Execution Cadence, Metrics, and Ratchets

Date: 2026-03-12  
Source audit: `docs/REAL_DEBT_AUDIT.md`  
Primary debt IDs: `D6`, `D8`  
Cross-block coverage: `D1-D10`  
Prerequisite blocks:

- `docs/REAL_DEBT_BLOCK_1.md`
- `docs/REAL_DEBT_BLOCK_2.md`
- `docs/REAL_DEBT_BLOCK_3.md`

## Objective

Turn the debt audit and the first three blocks into an executable program that can be run without recreating the same debt during implementation. This block defines cadence, verification rhythm, ratchets, and closeout evidence so the repo gets progressively cleaner instead of oscillating between cleanup and relapse.

## Why This Block Exists

- Blocks 1-3 define what to change, but not yet how to govern the sequence while work is in flight.
- The repo already has metrics, summaries, warnings, and stability plans, but they are not yet pointed directly at the debt program.
- Today, many safeguards are still `warn`-first, which is useful for adoption but too soft to prevent debt from quietly growing back.
- Without a program layer, the cleanup work risks reproducing the same problems:
    - mixed-surface branches,
    - queue test warnings,
    - generated-artifact review noise,
    - and governance drift that is visible but not acted on.

## Exit Criteria

This block is complete only when all of the following are true:

1. Blocks 1-3 have a common execution rhythm with explicit start, in-flight, and closeout checks.
2. The repo has debt-program scorecards that can be refreshed from existing commands and artifacts.
3. Changed-file ratchets exist for the areas most likely to regress during cleanup work.
4. A block cannot be considered complete without evidence, verification results, and a short metrics delta.
5. The program can run in `warn-first` mode initially, but with a documented path to stricter enforcement where the team proves readiness.

## In Scope

- debt-program documentation and sequencing
- verification and metrics refresh flow
- changed-file ratchets for:
    - generated artifacts
    - Playwright reliability patterns
    - branch breadth
    - root surface growth
    - governance CLI growth
- existing governance summary/metrics surfaces:
    - `verification/agent-metrics.json`
    - `node agent-orchestrator.js metrics`
    - `node agent-orchestrator.js status --json`
    - `node agent-orchestrator.js board doctor --json`
    - `npm run agent:summary:local`
- runbooks and docs that explain the cadence

## Out of Scope

- direct runtime refactors from Blocks 1-3
- rewriting the governance policy model itself
- changing product behavior to satisfy metrics
- replacing existing CI or orchestration systems

## Current Program Signals

The block should use the signals that already exist:

- `verification/agent-metrics.json` already tracks:
    - rework reduction target
    - file conflict rate target
    - non-critical lead time target
    - coordination gate red rate target
    - traceability target
- `governance-policy.json` already supports warn-first enforcement and WIP limits.
- `docs/STABILITY_14_DAYS_PLAN.md` already expresses cadence and KPI style for operational stability.
- `npm run agent:summary:local`, `status --json`, `board doctor --json`, and `metrics` already expose enough signal to power a debt-program scorecard without inventing a new control plane.

## Workstreams

### R1 - Debt program scorecard

Goal:

- Make progress visible in one repeatable snapshot.

Changes:

- Define a compact scorecard for each block using metrics that already exist plus a few debt-specific counters.
- Track at least:
    - branch breadth for active debt work
    - queue Playwright warning count trend
    - generated artifact churn in source reviews
    - governance/root surface count trend
    - block verification pass/fail state

Acceptance:

- A contributor can refresh the debt-program scorecard from existing repo commands and known files.
- Each block can show measurable movement rather than only prose status.

### R2 - Changed-file ratchets

Goal:

- Stop the most obvious debt patterns from reappearing while cleanup is underway.

Changes:

- Define progressive ratchets on changed files rather than repo-wide hard fails immediately.
- Ratchet candidates:
    - no new explicit timeout waits in queue Playwright files
    - no growth in generated artifact noise without matching source-of-truth changes
    - no new mixed-surface branches that blend ops, queue runtime, desktop, and governance evidence without documented reason
    - no new root surface additions without explicit classification
    - no new broad CLI growth without command-family review

Acceptance:

- New cleanup work cannot freely add the same kind of debt it is supposed to remove.
- Ratchets are narrow enough to be adoptable and strict enough to matter.

### R3 - Block execution cadence

Goal:

- Give the cleanup program a predictable operating rhythm.

Changes:

- Define one block lifecycle:
    - start criteria
    - in-flight checks
    - closeout checks
    - evidence handoff
- Suggested cadence:
    - start with one primary active debt block
    - allow one secondary prep block only if it does not overlap the same hot files
    - review scorecard and warnings at fixed intervals

Acceptance:

- A contributor knows when a block is ready to start, when it is drifting, and what is required to close it.
- The debt program does not depend on ad hoc memory.

### R4 - Evidence and closeout discipline

Goal:

- Keep debt cleanup held to the same standard as feature work.

Changes:

- Require each block closeout to include:
    - verification commands run
    - key pass/fail outcomes
    - unresolved risks
    - before/after metrics delta
- Keep the evidence lightweight but mandatory.

Acceptance:

- A completed debt block leaves behind proof, not just changed files.
- The next contributor can see what improved and what remains open.

### R5 - Progressive enforcement path

Goal:

- Move from visibility to prevention without destabilizing active delivery.

Changes:

- Keep initial adoption in warn-first mode.
- Promote selected rules to stronger enforcement only after one or more green cycles prove the team can operate with them.
- Candidate progression:
    - branch slicing rule
    - queue Playwright timeout rule
    - generated artifact review boundary rule
    - root surface growth rule

Acceptance:

- The team has a documented path from “we see the debt” to “we block reintroducing it.”
- Enforcement changes are staged, explicit, and evidence-driven.

## Implementation Order

### Phase 1 - Baseline and scorecard setup

- Freeze the debt-program baseline from:
    - `docs/REAL_DEBT_AUDIT.md`
    - `verification/agent-metrics.json`
    - lint warning snapshots for queue/governance hotspots
- Document the scorecard fields and refresh commands.

### Phase 2 - Ratchet definition

- Define the first changed-file ratchets and where they are checked.
- Start with warn-first thresholds tied to active block scopes.

### Phase 3 - Cadence and closeout flow

- Document start/in-flight/closeout checks for Blocks 1-3.
- Align the rhythm with the repo's existing stability and governance review habits.

### Phase 4 - Enforcement progression

- Promote proven ratchets from advisory to stronger enforcement only after stable adoption.

## Suggested File Targets

Primary likely touch points:

- `docs/REAL_DEBT_AUDIT.md`
- `docs/REAL_DEBT_BLOCK_1.md`
- `docs/REAL_DEBT_BLOCK_2.md`
- `docs/REAL_DEBT_BLOCK_3.md`
- `docs/STABILITY_14_DAYS_PLAN.md`
- `docs/AGENT_ORCHESTRATION_RUNBOOK.md`
- `docs/OPERATIONS_INDEX.md`
- `governance-policy.json`
- `package.json`
- summary/metrics scripts and docs if needed to expose the scorecard cleanly

## Risks

- Too many ratchets too early can turn cleanup into coordination overhead.
- If metrics are too broad, the scorecard will look healthy while the real hotspots stay unchanged.
- If metrics are too narrow, the program becomes fragile and easy to game.
- If closeout evidence is too heavy, contributors will skip it or batch too much work together.

## Verification

Run these to refresh the program state:

```powershell
npm run lint
npm run agent:summary:local
node agent-orchestrator.js status --json
node agent-orchestrator.js board doctor --json
node agent-orchestrator.js metrics --json
git diff --stat
git diff --shortstat
```

For queue-specific ratchet tracking, also refresh the queue-focused suites and lint counts when Block 2 is active.

## Definition of Done

This block is done when the debt cleanup effort behaves like a controlled program instead of a series of good intentions. That means visible scorecards, narrow ratchets, lightweight but mandatory evidence, and a staged path from warning to enforcement.

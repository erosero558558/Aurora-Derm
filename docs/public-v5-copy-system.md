# Public V5 Copy System (Final)

## Scope

- Surface: `/es` and `/en` in public V5.
- Coverage: home, hub, service detail, telemedicine, booking/payment, legal, shell navigation/footer.

## Voice Model

- Positioning: premium clinical dermatology for Quito.
- Narrative axis per block: `impact -> medical criteria -> next step`.
- ES register: professional `usted`.
- EN register: premium transcreation, not literal translation.

## Editorial Rules

- Use one central promise from hero to booking: clarity, continuity, safety.
- Avoid absolute claims: no "garantizado", "100%", "cura definitiva", "sin riesgos".
- Keep legal and transactional copy operational first, poetic tone second.
- Limit metaphor density: max one clear metaphor per paragraph in editorial sections.

## Clinical Claims Guardrail

- Allowed: language of probability, indication, fit, escalation, follow-up.
- Blocked: deterministic outcomes, zero-risk wording, miracle framing.

## Quito Localization

- Keep wording understandable for urban Quito audiences.
- Prefer concrete medical verbs over marketing adjectives.
- Keep references to local operation context (agenda en vivo, WhatsApp support, Quito clinic).

## Copy QA Contract

- No mixed-locale leakage in public ES/EN routes.
- No technical internal tokens visible (`bridge`, `runtime`, `shell`, `v3`, `v4`).
- ES `usted` policy active in public care routes and booking copy.
- Booking/legal anchors remain unchanged (`#cancelaciones`, `#cancellations`).

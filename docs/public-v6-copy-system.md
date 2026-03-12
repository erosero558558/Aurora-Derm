# Public V6 Copy System (R6)

Version: 2026-03-04-r6
Scope: public-v6 ES/EN (home, hub, service, telemedicine, legal, navigation, shell labels)

## Editorial goal

Deliver a premium and sober dermatology voice for Quito: emotionally warm, medically exact, and operationally clear.

## Voice model

### ES (Quito)

- Register: professional `usted`.
- Rhythm: concise, calm, and confident.
- Frame by block: `impacto -> criterio medico -> siguiente paso`.
- Lexicon: contemporary clinical language, never cold or bureaucratic.
- Product cadence: patient benefit first, medical criteria second, action third.

### EN (Global premium)

- Transcreation, not literal translation.
- Keep emotional and clinical equivalence.
- Use concise global healthcare language.

## Length constraints

- Hero category: 1-3 words.
- Hero title: 6-12 words.
- Hero description: 12-28 words.
- News strip headline: 10-22 words.
- Marketing card title: 4-12 words.
- Marketing card copy: 10-24 words.
- Hub intro title: 6-16 words.
- Hub intro deck: 10-26 words.
- Tele lead: 8-22 words.
- Booking status title: 3-8 words.
- Booking status description: 12-30 words.
- Service lead: 12-24 words.
- Service FAQ answer: 12-34 words.

## Clinical and legal guardrails

- No absolute outcomes.
- No guaranteed results.
- No risk-free or definitive cure claims.
- No legal reinterpretation.
- Legal copy must stay operational and readable.

## Banned claims (ES/EN)

- `garantizado`
- `100%`
- `cura definitiva`
- `sin riesgos`
- `guaranteed`
- `definitive cure`
- `risk-free`

## Style anti-patterns

- Protocol filler that does not help a decision.
- Inflated jargon with no patient value.
- Corporate abstractions in public routes.
- Internal technical wording visible to users.
- Mechanical legacy phrasing in hero, hub, service, or telemedicine.

## Navigation language

- IA must be dermatology-first and action-oriented.
- Menu labels must describe routes, not corporate placeholders.
- Keep an Aurora patient-first hierarchy with calm, premium density and no corporate filler.

## Booking freeze copy standard

Template:

1. State current status in plain language.
2. Clarify what remains active now.
3. Offer one practical action.

Unified booking title by locale:

- ES: `Reserva online en mantenimiento`
- EN: `Online booking under maintenance`

## Consistency rules

- One promise from hero to booking status.
- Shared terminology across home, hub, service, telemedicine, and legal.
- ES surfaces keep explicit `usted` in narrative routes.
- EN avoids Spanish leakage in user-visible copy.

## QA contract

- `node bin/validate-public-v6-content.js` must pass.
- `npm run audit:public:v6:copy` must pass.
- `npm run test:frontend:qa:v6` must pass.
- `npm run audit:public:v6:sony-parity` stays as a legacy alias and must validate the Aurora baseline >= 50.

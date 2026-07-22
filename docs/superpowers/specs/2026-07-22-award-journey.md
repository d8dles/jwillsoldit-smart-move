# Smart Move Award Journey Specification

## Objective

Transform the existing Smart Move intake into a sleek, editorial, professional journey with swagger while preserving every production route, validation rule, attribution field, partial-lead capture, final submission, and legal acknowledgment.

## Source of truth

- Production behavior: the current `origin/main` Smart Move application.
- Approved visual direction: the local award-journey prototype, summarized here so implementation does not depend on an untracked file.
- Brand mark: `JWILLSOLDIT` with the red period, consistently rendered across the journey.

## Motion thesis

The period falls. The route comes alive.

The red period is the single visual protagonist. It may behave as the cursor, route marker, map locator, and Houston arrival beacon, but the page must never show competing animated red balls. Motion is limited to three supporting languages:

1. Natural scroll and snap for moving through the intake.
2. Restrained editorial folds or camera pushes for section changes.
3. Physical period movement with anticipation, gravity, squash, rebound, and settled glow at meaningful destinations.

The period performs only at meaningful handoffs: hero to route, disclosures to budget, map to location refinement/details, punctuation landing on the route question, and the final Houston landing. It must not bounce decoratively on every screen.

## Required journey

1. Preserve the production hero content and brand lockup.
2. The red period falls out of the hero, the hero lifts, and the period follows the route into the path selector.
3. Keep all six paths: Rent, Buy, Sell, Sell + Buy, Commercial, and Not Sure Yet.
4. Preserve name, email, phone, multi-method contact preference, and best-time selection.
5. Preserve timeline, representation status, representation warning, Information About Brokerage Services, and Consumer Protection Notice acknowledgments.
6. When the prep requirements are complete, the period falls into the route-specific budget screen and activates its route animation.
7. Present an optional, full-field Houston region map. Users may select up to two regions; the map must not be reduced to a card or obscured by copy.
8. Preserve custom neighborhood, ZIP, school-zone, and open-search behavior.
9. Preserve all branch-specific questions and conditional requirements from `FormLogic`.
10. On route details, the period lands on meaningful punctuation: the dot over the `i` in “Which” when available, otherwise the final period or question mark.
11. Preserve manual Continue controls as the recovery path for every auto-advance.
12. The final brief retains the user’s answers, submission action, full-page visual PDF/print action, native share action with fallback, and standard JWILLSOLDIT footer.
13. The final period falls visibly onto Houston in a real Texas outline, rebounds, settles small, and glows. The brief remains sharp; no blur masks the motion.

## Content and legal constraints

- Write out Information About Brokerage Services and Consumer Protection Notice in the public journey.
- Use the repository PDFs at `assets/docs/iabs.pdf` and `assets/docs/cpn.pdf`.
- Acknowledgment remains separate from opening/downloading a disclosure.
- Existing representation warning remains inline/modal and does not navigate away.
- Do not invent contact information, legal language, property data, or route questions.

## Technical constraints

- Keep the static HTML/CSS/classic-script architecture and current script load order.
- Keep `FormLogic`, `SECTIONS`, `goTo`, partial submission, final submission, and payload shapes backward compatible.
- Do not add a framework or build step.
- Use one motion controller and one persistent story-dot DOM element.
- Respect `prefers-reduced-motion` and keyboard focus.
- Maintain at most 1px horizontal overflow at 360, 390, 430, 820, and 1440px.
- Preserve the C1 scroll-up recovery behavior.
- Production deploy remains out of scope until the branch is reviewed and explicitly approved for merge.

## Acceptance criteria

- All six routes complete end to end.
- Partial and final submissions retain the existing API contract and attribution.
- The same period is visually continuous at every major handoff.
- The Houston map is fully visible and selectable at desktop and mobile sizes.
- No duplicate ball, cursor, route-dot, or beacon animation appears simultaneously.
- The final brief can be printed/saved as a designed PDF without the website footer or action buttons.
- The website footer remains visible after the brief.
- Automated verification passes, and a preview is reviewed before merge.

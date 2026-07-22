# Award Journey verification checkpoint

Date: 2026-07-22

Branch: `feature/award-journey-motion`

## Verified locally

- `node --test tests/journey-motion.test.mjs`: 5 passed, 0 failed.
- `node --check` passes for `journey-motion.js`, `steps.js`, `validation.js`, and `app.js`.
- `git diff --check` passes.
- The final brief uses the CC0 Wikimedia Commons geographic outline `Outline of Texas (simplified).svg`, not a hand-drawn silhouette.
- Existing submission entry point remains `sendSmartMoveBrief`; the motion layer wraps navigation without replacing submission, validation, or state modules.

## Environment limitation

The repository's full `npm run verify` browser harness cannot bind its local mock server in this sandbox. It exits before assertions with `listen EPERM: operation not permitted 127.0.0.1`. This is not recorded as a passing browser test.

## Required before merge

1. Push this branch and obtain a unique Vercel preview URL.
2. Run the full repository verification suite in an environment that permits localhost binding.
3. Visually review desktop and mobile journeys, including reduced motion.
4. Exercise submit against preview configuration and confirm partial-lead and final-lead payloads.
5. Verify native share, clipboard fallback, and print-to-PDF output in Safari and Chrome.
6. Obtain explicit approval before merging or promoting to production.

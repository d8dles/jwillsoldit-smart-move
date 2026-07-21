# Exact JWILLSOLDIT Wordmark Design

## Goal

Match the supplied brand reference on every Smart Move surface: `JWILLSOLDIT` in uppercase black display type followed immediately by a red period.

## Scope

- Correct the home hero, home footers, privacy page, public forms, and admin headers/login.
- Keep every wordmark linked to `https://www.jwillsoldit.com/` where it is currently a link.
- Preserve the hero's existing scroll/blueprint motion.
- Leave the main JWILLSOLDIT hub unchanged because its wordmark already matches the reference.

## Implementation

Use one explicit markup contract everywhere:

```html
JWILLSOLDIT<span class="jw-logo__dot" aria-hidden="true">.</span>
```

The dot is a red period glyph. It is not an empty pseudo-element, circle, badge, or orange decoration. The hero retains its duplicate pseudo-text layers for animation, while its visible period uses the same semantic dot treatment.

## Acceptance criteria

- No visual logo uses `JWillSoldIt` mixed case.
- No visual logo creates a circular dot with `border-radius` or a background fill.
- Every `.jw-logo` contains the uppercase wordmark and literal period span.
- The hero source text/data and visible period follow the same contract.
- Existing verification remains green, subject to browser availability.

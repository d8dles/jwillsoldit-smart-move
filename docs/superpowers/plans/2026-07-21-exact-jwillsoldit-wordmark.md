# Exact JWILLSOLDIT Wordmark Implementation Plan

1. Add a Node contract test that inventories visual wordmarks and rejects mixed case, missing literal red periods, and circle-based dot styling.
2. Run it against current `main` and confirm it fails for the known mismatch.
3. Replace visual wordmark markup with the approved uppercase-plus-period contract.
4. Replace global, privacy, and hero circle styling with red period-glyph styling while preserving hero animation layers.
5. Run the contract test and the repository verification suite.
6. Commit the isolated change, open a fresh pull request, and verify its Vercel preview before requesting merge.

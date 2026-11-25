---
description: Screenshot a Tractor dashboard screen, get a design-reviewer critique, apply fixes. Max 3 iterations.
---

Run the design refinement loop for: $ARGUMENTS (a screen name — `overview`,
`store-01`, `store-01/orders`, or `system` for the index.html diagram page).

1. Ensure the static server is running: `python3 -m http.server 8743` from the
   `tractor-build-challenge/` directory (check with `curl -sI
   http://localhost:8743/dashboard.html` first; only start it if that fails).
2. Using the available browser tool (Claude in Chrome, or the built-in
   Browser pane), navigate to the screen at 1440×900 and capture into
   `.screenshots/`:
   - `<screen>-populated.png` — the normal loaded state
   - `<screen>-drilldown.png` — click the first KPI tile (or, for `system`,
     click the Money node) to open the drill-down/detail overlay, then shoot
   - `<screen>-reduced-motion.png` — emulate `prefers-reduced-motion: reduce`
     (devtools rendering emulation, or the browser tool's equivalent) and
     reshoot `-populated`
   There is no loading-skeleton state to capture (see the design-system
   skill's note on skeletons) — skip that shot.
3. Invoke the `design-reviewer` subagent on those files.
4. If score >= 8: report the score and stop.
5. Otherwise apply its fixes (smallest diff that addresses each — edit
   `dashboard.css`/`dashboard.js` or `style.css`/`script.js` depending on
   which screen), then repeat from step 2.
6. Hard cap: 3 iterations. If still below 8, stop and report the remaining
   issues with the final score — do not keep polishing unprompted.
7. Verify no regression: the connector-line alignment bug on `system`
   (duplicate `#diagram` id, fixed once already) is the kind of thing a
   careless CSS change could reintroduce — if you touched `.diagram` layout,
   re-check the lines land on their targets before calling it done.

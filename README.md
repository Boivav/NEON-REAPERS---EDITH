# E.D.I.T.H.: Enhanced Digital Identity, Trust & Heuristics

Permission management and app trust monitoring prototype. React 18 + Vite + TypeScript, mock data with a live event simulator.

## Run
```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build
```

## Demo scenario
1. Three apps (Lumen Notes, PixelShare, FitTrack) start with normal permissions and behavior.
2. Click **Simulate rogue app**. PixelShare is granted Contacts, Microphone and SMS and starts accessing data far above its baseline, mostly at night.
3. Trust drops, alerts fire, and recommendations appear (revoke unexpected permissions, restrict the rest).
4. Click **Apply** (or **Apply all** on the Alerts page), or use Approve / Restrict / Suspend / Revoke on the app detail page. Trust recovers.

## Structure
- `src/ml/features.ts`: `FEATURE_NAMES`, `buildFeatures`, and the rule-based `risk()` scorer. Swap `risk()` for a real model later.
- `src/engine.ts`: simulator, access log, alert rules, recommendations, permission actions.
- `src/ui.tsx`, `src/pages.tsx`, `src/App.tsx`: UI components, pages, hash routing and app shell.

## Notes
- `baseline_deviation = (access_count - expected_access_count) / max(expected_access_count, 1)`
- Styling is plain CSS with theme variables (dark by default), and charts are inline SVG. Tailwind, React Router, Recharts and Zustand are not used, to keep the project dependency-free beyond React.

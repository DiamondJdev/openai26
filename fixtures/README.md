# Footage fixtures

`manifest.json` is the seeded visit index + footage manifest. On startup the app
purges all prior session data and re-seeds visits from this file, so a manager's
plate lookup can find the latest visit.

## Wiring the real before/after images

Drop the wash images under `fixtures/footage/` and point each visit's per-camera
`sources` entry at them. Files may be stills (`.jpg`/`.png`, `kind: "image"`) or
clips (`.mp4`/`.mov`, `kind: "video"` — a timestamp seeks into the clip).

Suggested layout for the two demo scenarios:

```
fixtures/footage/
  demo-clean/   entrance.png  mid.png  exit.png     # clean pass  → plate 7GAB991
  demo-damage/  entrance.png  mid.png  exit.png     # damage pass → plate 8XYZ204
```

Paths in `manifest.json` are resolved **relative to `footageRoot`** and can never
escape it — a traversing or absolute path is rejected. Only the three fixed
cameras (`entrance`, `mid_tunnel`, `exit`) are recognized.

Change `CLAIMLENS_MANIFEST_PATH` in `.env.local` to point elsewhere if needed.

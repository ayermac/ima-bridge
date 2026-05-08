# Mascot Assets

Internal asset record for IMA Bridge mascot visuals.

## Source Reference

- **Reference URL**: `https://petdex.crafter.run/zh/pets/ikun-hoops`
- **Style**: Round, friendly, geometric character design with soft curves and large eyes.
- **Usage scope**: In-app loading, empty, success, and error state illustrations only.

## Asset List

| File | Variant | Description |
|---|---|---|
| `idle.svg` | idle | Neutral sitting pose, used as default mascot |
| `loading.svg` | loading | Character with a spinning ring indicator |
| `empty.svg` | empty | Character looking at an empty box |
| `success.svg` | success | Character celebrating with raised arms |
| `error.svg` | error | Character looking confused with a sweat drop |

## Notes

- All assets are hand-crafted SVG placeholders in the Petdex style.
- Color theme matches the app primary palette (`#2563eb`).
- Files are stored under `src/renderer/src/assets/mascot/` and bundled by Vite.
- If replacing with custom artwork, keep the same filenames and viewBox (`0 0 120 120`).

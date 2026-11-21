# Luminous material references

Original, authored SCS artwork; no external asset packs or image service.
Run `npm run materials:generate` to reproduce the WebP assets with
the existing Playwright Chromium installation. The source is
`scripts/lib/material-art.mjs`.

- Three 840×1120 conservatory terraces: stone garden, mirror garden, sun engine.
- Ten neutral 768×1024 instrument decks, tinted by the selected theme: ceramic,
  porcelain, precision dial, ruler, slate pages, fluted glass, linked rails,
  layered ink panels, aperture and segmented alloy.
- Three 3200×480 island atlases, each with five 640×480 restoration frames:
  garden conservatory, mirror bridge, astronomical engine. Home, map, region
  cards and results crop the frame for canonical saved completions in that zone.
- One 1280×192 crystal atlas: three colour/symbol pairs in dormant/awake states,
  a launcher, and restored foliage (eight 160×192 frames).

Directional light, relief, contact shadows and material grain are baked offline.
Runtime adds bounded light responses, not a full PBR / ray-tracing renderer.
The interactive simulation remains in the original logical coordinates.
All 17 files are listed in the shared runtime/build manifest and the source
service worker. Artwork has no knowledge of stimuli, answers or hidden state.

# Persona demo ("Recovery Journeys") — source of the artifact

Live artifact: https://claude.ai/code/artifact/b822a105-6dc4-48c7-8ef4-15bcd3f08b0f
Review deck artifact (source: ../recovery-ux-review.html):
https://claude.ai/code/artifact/ca87aff0-49ef-4322-9715-acab83ff65e3

Files:
- `demo-template.html` — the player page; `__DATA__` placeholder takes the JSON blob.
- `journeys.json` — 5 personas × (Setup + Recovery [+ Attack]) steps: screen name,
  caption, spec line, act, hotspot rect (design px) + hotspot label.
- `persona-docs.json` — verbatim persona descriptions (Notion research page).

Rebuild:
1. Export every screen named in journeys.json from `social-wireframes.pen` as webp
   (Pencil `execute` → `Export([id], "webp", path, {scale:1, quality:80})`).
2. Build the data blob: `{sizes, personas, imgs (data URIs), personaDocs,
   personaDocsNote}` and inject it into the template's `__DATA__`.
3. Republish over the artifact URL above (Artifact tool, `url` param).

Hotspot rects and screen sizes come from the live Pencil session (`ctx.bounds`),
in the frame's own coordinate space at scale 1.

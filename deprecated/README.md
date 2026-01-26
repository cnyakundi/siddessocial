# deprecated/ (Quarantine Zone)

This folder is where code goes **before** it gets deleted.

Rules:
- Nothing gets deleted directly “because it looks unused”.
- Move candidates here first (or into a subfolder).
- Keep imports/broken paths obvious so gates fail if something still depends on it.
- After **1–2 green cycles** (gates + golden flows), you may delete permanently.

Tip:
- When moving a file, leave a short stub/README note in the old location saying where it moved.

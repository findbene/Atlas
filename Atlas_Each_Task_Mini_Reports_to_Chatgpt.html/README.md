# Atlas — Claude Code Mini-Reports to ChatGPT

HTML archive of the structured mini-reports Claude Code returns after each ChatGPT-directed task on
the Atlas build. **Open `index.html`** for the full set with a sticky table-of-contents; each report
also has a standalone page (e.g. `phase-0z.html`, `phase-57b-flip.html`).

## Layout
```
Atlas__Each_Task_Mini_Reports_to_Chatgpt.html/
  index.html        ← generated — open this (all reports + TOC)
  <slug>.html       ← generated — one standalone page per report
  style.css         ← shared styling
  build.py          ← regenerator (uses the `markdown` pip package; local dev tool)
  src/*.md          ← the report sources (edit these, then rebuild)
  README.md
```

## Adding a future mini-report
1. Create `src/NN-<slug>.md` (NN keeps order, e.g. `06-phase-58.md`).
   - First line: `# Title`.
   - Optional second line: `META: <date> · <status>` (shown under the title + in the sidebar).
   - Body: the 12-section mini-report in normal Markdown (tables/code fences supported).
2. Run `python build.py` from this folder.
3. Commit the regenerated `index.html` + new `<slug>.html` (+ the new `src/*.md`).

## Notes
- `index.html` and the per-report pages are **generated** — edit `src/*.md`, never the HTML directly.
- The reports for 0.z / 0.zz / 57B-flip are verbatim; 57B-prereq / 0.x / 0.y are compiled faithfully
  from their phase close-outs / progress logs (they predate verbatim archival).

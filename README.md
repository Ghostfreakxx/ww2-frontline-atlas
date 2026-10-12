# Frontline Atlas — iPad-controlled WWII podcast map

A presentation system for a history podcast. You hold an **iPad (presenter)**; a computer shows a clean **16:9 audience map (display)** that you capture with OBS next to your camera. Everything you do on the iPad — dates, army groups, battles, drawings, scene steps — appears on the display immediately.

- `/presenter` — touch-first control surface for iPad Safari (portrait and landscape, Apple Pencil drawing)
- `/display` — 1920 × 1080 audience output (split 60/40 with camera area, full-width, title-safe, transparent)
- `/` — start page: create a session and scan the QR code with the iPad
- `/sources` — methodology, confidence labels, front-line anchors and the full source registry

The first episode, **Operation Barbarossa 1941** (8 scenes), loads automatically. A second built-in episode, **The war in Europe 1939–1945**, covers twelve campaigns: Poland, France, the Battle of Britain, the Balkans, Barbarossa, Moscow, Stalingrad, Kursk, Normandy, Bagration, the Bulge and Berlin.

---

## Quick start

```bash
npm install
npm run build
npm start            # serves on 0.0.0.0:3000 so the iPad can reach it over Wi-Fi
```

Development: `npm run dev` (also binds to `0.0.0.0`).

### 1. Presenter on the iPad
1. Put the computer and the iPad on the same Wi-Fi network.
2. On the computer, open `http://localhost:3000` and click **New session**. A six-character code and a QR code appear.
3. Scan the QR code with the iPad camera. It opens `/presenter` with the session's private presenter key. Tip: in Safari use **Share → Add to Home Screen** to get a true fullscreen app.
   *Alternatively*, open `http://<computer-ip>:3000/presenter` on the iPad; it creates a session itself and shows the code at top left.
4. If macOS asks whether Node may accept incoming connections, allow it.

### 2. Audience display on the computer
- Open `http://localhost:3000/display?code=ABC123`. The presenter's **share** button (top right) lists every variant with copy buttons and QR codes:
  - `&clean=1` — no toolbar (use this in OBS)
  - `&clean=1&transparent=1` — camera area transparent (layer the map over your camera in OBS)
  - `&layout=full` / `&layout=map-safe` — force a full-width map or a map with 90% title-safe margins regardless of the presenter's layout
  - `&guides=1` — shows the camera area and the title-safe frame while you set up
- Moving the mouse over the display reveals: **Fullscreen**, **Screenshot** (1920 × 1080 PNG), **Record tab** (WebM via the browser's tab capture) and **Guides**. Keys: `F` fullscreen, `S` screenshot, `G` guides.

### 3. Recording with OBS
1. Add a **Browser** source, URL = the *OBS — clean* link, width 1920, height 1080, FPS 60.
2. Default layout: camera on the left 40% (768 × 1080), map on the right 60% (1152 × 1080). Put your camera source in the left 40%. If you use the transparent link, the camera can sit underneath.
3. For "full-width map moments" press **Full** on the iPad: the display switches to the full-frame map (hide or fade your camera scene in OBS, or use a second OBS scene with a `&layout=full` browser source).
4. Record in OBS as usual. The iPad never records anything.

No OBS? Use **Record tab** on the display (Chrome/Edge) or a screen recorder, and **Screenshot** for stills.

### Presenter controls
| Area | Controls |
| --- | --- |
| Bottom bar | Previous/next **dated event**, previous/next **scene step**, play/pause, speed (1–30 days/s), timeline 1939–45 / year / operation, date picker |
| Left rail | Pan & zoom, freehand, arrow, circle, text label, 6 ink colours, 3 widths, undo/redo/clear, zoom ±, **reset view** |
| Top bar | Live status + code + display count, output layout (Split / Full / Safe), **Hide UI** (clean frame), audience preview, share/QR, fullscreen, **lock** (hold to unlock) |
| Side panel | **Scene** (scene list, build steps, presenter notes), **Forces** (army groups by date, commander, order of battle, lineage, compare), **Battles**, **Layers**, **Sources**, **Episode** (scene editor) |

Gestures: one finger pans, two fingers pinch-zoom; the **Apple Pencil always draws** (even in pan mode) while fingers keep panning. Tap an army-group sector or a battle marker on the map to highlight it on the audience display.

Keyboard / presentation clicker: `→`/`PageDown` next step, `←`/`PageUp` previous, `Space` play/pause, `H` hide UI, `L` lock, `⌘Z`/`⇧⌘Z` undo/redo.

### Scenes and episodes
The **Episode** tab is the scene editor. A scene stores its date, camera, layout, highlighted formations, battle, cities, layers, panels, caption, drawings, presenter notes and sources; build steps store further views (optionally "animate timeline to date"). Use **Add scene/step from current view** to capture what you see.
- Edits **autosave** on the iPad (localStorage — scene data only).
- **Export** downloads `*.episode.json`; **Import** loads one; **Save to computer** writes it to `.data/episodes/` on the presenting computer.

### Sync, recovery and security
- Server-sent events with automatic reconnection (exponential backoff, a watchdog for silent drops such as iPad sleep, and resume when the page becomes visible). The display shows "Reconnecting…" while disconnected and catches up to the latest state.
- Session state is persisted to `.data/sessions/` on the computer, so a server restart or an iPad reload resumes the same scene. If the server lost a session entirely, the iPad restores it from its own backup.
- The display link only needs the session code (read-only). Changing the session requires the presenter key, which lives in the presenter link (`#k=…`) and on the iPad. Share the presenter link only between your own devices.
- Run it on the presenting computer or another machine on your LAN. The in-memory session store is for a single Node process, so it is not meant for serverless hosting.

---

## What is on the map — and how sure it is

| Layer | Meaning | Confidence |
| --- | --- | --- |
| Political colours | Reconstructed borders and status for 1939, Oct 1939, Jul 1940, Jun 1941, Nov 1942, Sep 1943 and Sep 1944 | approximate (±10–20 km) |
| Hatched wash | **Axis military control** of Soviet territory, computed from the front line (separate from political status) | approximate |
| Red line + band | Front line snapshot on or before the date; band = stated uncertainty; dotted = no continuous front | approximate; the 22 June 1941 frontier is derived from documented borders |
| Arrows | **Schematic** direction of a dated advance between documented places. A hollow, dashed arrow is a stage still under way. | schematic |
| Hollow targets | **Planned** objectives (Directive 21 etc.), with outcome | planned |
| Dashed sectors | Approximate operational sectors of army groups / Soviet fronts | approximate |

Rules applied throughout:
- **No interpolation between sourced dates.** The map shows the latest documented snapshot and labels its date ("Front line as of 9 Jul 1941"). After `staleAfterDays` (default 60, much shorter for snapshots taken on the eve of offensives) the line is hidden and the display says "No documented front line for this date".
- Every dated record cites the [source registry](src/data/conflicts/ww2-europe/sources.ts) and carries a confidence label; the Sources tab and `/sources` page show the anchors of each front line.
- Citations are **reference-level** (author and work), not page-verified. Front lines were digitised for this project against the cited atlases and narratives; check them against the sources before publication.

### Command database
- German army groups 1939–45 are modelled as **separate organisational records** linked by predecessor/successor, because the same name denotes different headquarters (e.g. Army Group North 1939 → B → Centre → North 1945; Army Group C → North → Courland; Army Group Don → South (1943) → North Ukraine → A (1944) → Centre (1945)).
- Commanders and ranks change with the date; subordinate armies have dated assignments; Panzer groups are renamed Panzer armies on their dates.
- The June 1941 order of battle goes down to corps and divisions as a **snapshot** for 22 June 1941. It is labelled as such, and entries that are not certain are marked approximate or "details not entered" rather than guessed.
- Opposing forces: Soviet fronts with commanders (1941 and key later fronts) and Western Allied army groups (21st, 12th, 6th, 15th).
- **Portraits**: none are bundled. Add `portrait: { src, credit, license }` to a person only with an image whose licence permits reuse (e.g. Bundesarchiv images under CC BY-SA 3.0 DE).

---

## Architecture

```
src/
  app/                 Next.js routes: / presenter display sources, API (session, stream, episodes, info)
  components/
    map/               AtlasMap (SVG): memoised world-space layers + screen-space overlays
    panels/            Audience panels drawn in SVG stage coordinates (exportable as one image)
    display/           DisplayStage (1920×1080 composition), live view hooks
    presenter/         iPad app: gestures/drawing, transport, side panels, editor, share sheet
  lib/
    history/           Conflict-agnostic data model (types.ts) and date-aware queries (query.ts)
    sync/              Presentation state, server store (SSE relay + disk persistence), client hooks
    map/               Projection, camera maths (van Wijk zoom/pan), geodata loader, shapes, theme
    episodes/          Episode model, scene/step application, validation
    export/            PNG export (fonts and relief inlined), tab recording
  data/
    conflicts/ww2-europe/   sources, places, territory, front lines, formations, people, campaigns, events, episodes
    geo/projection.ts       shared projection config
public/geo/            generated geography (land, lakes, rivers, relief.png, territory-*.json, fronts.json)
scripts/               data pipeline (fetch-geo.sh, build-geo, build-relief, build-control) and dev helpers
tests/unit, tests/e2e  Vitest data/logic tests; Playwright end-to-end tests
```

- **Rendering**: SVG with a fixed conic-conformal projection (d3-geo). Heavy geography is projected once and moved with a single transform; labels, arrows and markers are laid out in screen space every frame with collision avoidance. The camera is `{lon, lat, zoom}` scaled to the *audience frame height*, so the iPad and the display frame exactly the same area. The presenter shows that frame as a gold rectangle.
- **Sync**: the iPad owns the state and PUTs it (coalesced, one request in flight). The server relays it to displays over SSE. Playback runs on the server clock (anchor date + elapsed time × speed), so every screen shows the same date without streaming ticks.
- **Expandability**: a conflict is a `ConflictPackage` (`src/lib/history/types.ts`). Add a folder under `src/data/conflicts/`, register it in `src/lib/conflict.ts`, add territory/front definitions and rebuild the geography. Nothing in the renderer or presenter is WWII-specific.

### Rebuilding the geography
```bash
./scripts/fetch-geo.sh                # Natural Earth (public domain) → .geo-raw/
npm run geo:build                     # land, lakes, rivers
npm run geo:relief                    # shaded relief from AWS terrain tiles (cached)
npm run geo:control                   # political snapshots and front-line geometry
```
The generated files are committed, so you only need this after editing borders or front lines.

---

## Tests

```bash
npm test                              # unit: data integrity, citations, dates, command queries, episodes
npm run build && npm run test:e2e     # end-to-end against the production build (Chromium)
```
The end-to-end suite covers:
- two-window sync and its latency
- a second presenter device
- presenter-key protection
- display reconnection after a dropped connection
- presenter reload recovery
- annotation placement across devices (a circle drawn on Moscow lands on Moscow on the display)
- timeline correctness (front snapshots are never interpolated), playback agreement and event stepping
- iPad portrait and landscape layout with touch-target sizes
- touch panning
- presentation lock
- scene autosave, export and import, and save to the computer
- 1920×1080 PNG export
- axe accessibility (no serious or critical issues)
- display frame times during a camera flight

## Credits and licences
- Geography: Natural Earth (public domain). Relief: Terrain Tiles (Mapzen / AWS Open Data — SRTM, GMTED2010, ETOPO1).
- Fonts: Source Serif 4, IBM Plex Sans Condensed (SIL Open Font License, `public/fonts/OFL.txt`).
- Historical sources: see `/sources` and `src/data/conflicts/ww2-europe/sources.ts`. US Army official histories cited are public-domain works.

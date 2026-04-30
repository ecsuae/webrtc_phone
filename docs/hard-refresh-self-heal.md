# Hard Refresh + Self-Heal Frontend Cache System

## Problem this solves

After a frontend deploy, some clients (especially Android Chrome / PWA) can keep running a stale cached HTML shell, service worker state, or JavaScript module graph. This can cause hard runtime failures (e.g. ES module export mismatch errors) even though the server has newer code.

Clients will not:

- use USB debugging
- manually clear browser cache/site data
- edit URL parameters

So the app must self-recover automatically.

## Why normal browser refresh was not enough

- A normal refresh does not guarantee the browser will discard:
  - a previously cached `index.html`
  - cached ES module instances
  - cached `Cache Storage` entries
  - a service worker controller that pins old assets
- Android/PWA can rehydrate old module graphs in ways that are not corrected by a simple reload.

## Architecture overview

This system combines:

- **Server-side build stamping** (a build/version token changes on each deploy)
- **Client-side build handshake** at startup (detect mismatch)
- **Automatic self-heal routine** if mismatch (unregister SW, clear caches, clear safe storage)
- **A runtime cache-buster token (`cb`)** propagated through dynamic imports to force a consistent module graph
- **Nginx no-store caching headers** for key asset paths to reduce stale reuse

## Build/version token (`FRONTEND_BUILD`)

- During deploy/render, the frontend is stamped with a build id (`FRONTEND_BUILD`).
- `make render` generates this automatically (defaults to epoch seconds) and injects it into `www/index.html` via `www/index.html.template`.

Where it appears:

- `window.__APP_BUILD__ = "${FRONTEND_BUILD}"` (rendered into `www/index.html`)
- `/config.js?v=${FRONTEND_BUILD}` (ensures config is not cached across deploys)

## Startup build handshake (automatic)

On every app load, the HTML shell:

- reads `window.__APP_BUILD__` (the build id of the currently-running shell)
- fetches the latest server shell using `fetch('/index.html?__build_check=...',{ cache:'no-store' })`
- extracts the server build id from the fetched HTML
- compares `runningBuild` vs `latestBuild`

If they differ, the app automatically runs the self-heal routine and reloads into the new build.

## `cb` runtime token (module graph cache-buster)

- The app maintains a runtime token `cb` stored in the page URL.
- The HTML shell sets `window.__BUILD_CB = cb`.
- The bootstrap sequence uses dynamic imports that include `?cb=` so the module graph is consistent.

On self-heal reload, `cb` is set to the latest build id so the entire module graph is forced to the new build.

## Final architecture requirement: `cb` must propagate through the full Android chain

Android proved to be the most sensitive client for stale module reuse. The stable design requirement is:

- The initial app entry loads the platform bootstrap using the runtime `cb` token.
- The Android bootstrap loads Android runtime modules using the same `cb`.
- Android call flow loads `controlBindings.js` using the same `cb`.

The critical chain that must remain consistent is:

- `www/app/main.js` -> `runtime/android/bootstrapAndroid.js?cb=<token>`
- `runtime/android/bootstrapAndroid.js` -> `./callFlowAndroid.js?cb=<token>`
- `runtime/android/callFlowAndroid.js` -> `../controlBindings.js?cb=<token>`

If this chain is consistent, Android cannot silently fall back to an older cached module graph.

## What was learned during debugging

- Hard refresh and cache clearing were necessary but not sufficient when Android was still executing a pinned older module graph.
- The most reliable proof of “what is actually running” is Android Remote DevTools:
  - Network request URLs (including query params)
  - `import.meta.url` logs
  - Stack traces showing exact script URLs

## Why fixed `?v=` imports broke the design

During debugging, Android logs proved an unwanted auto-login path:

- `startAndRegister` -> `runOneTapEnableFlow` -> `controlBindings.js?v=...`

Root cause:

- Some Android imports were hardcoded as `?v=...` which pinned Android onto a stale ES module graph.
- Even if the HTML shell and newer startup/cache code were live, a pinned `controlBindings.js?v=...` could still be loaded and bind handlers that triggered registration on password entry.

Final rule:

- Do not use fixed `?v=` query params in the runtime module import graph for Android.
- Use the runtime `cb` token end-to-end.

## Hard refresh icon behavior

The in-app hard refresh button:

- unregisters service workers
- clears Cache Storage
- clears IndexedDB databases
- clears sessionStorage
- clears localStorage **except** preserves safe credentials/settings
- reloads the page with a fresh `cb` token

This is a support tool, but the key guarantee is that the app should also self-heal without the user clicking it.

## What is cleared vs preserved

Cleared on self-heal/hard refresh:

- Service worker registrations
- Cache Storage (all caches)
- IndexedDB databases
- `sessionStorage`
- most `localStorage`

Preserved:

- `sipUsername`
- `sipPassword`
- `hideInstallShortcut`
- `webrtc_skin`
- `callHistoryV2`
- `callHistory`

## Nginx cache headers

To prevent stale asset reuse, nginx is configured to send `Cache-Control: no-store` for:

- `/app/`
- `/vendor/`
- `/` and `/index.html`
- `/config.js`

This reduces the chance of Android/PWA pinning an older shell or JS files.

## Deploy procedure (required)

1. Render templates (build stamping)

```bash
make render
```

2. Deploy the updated static assets (the `www/` folder) to the nginx docroot (e.g. `/var/www/phone`).

3. Restart/recreate the web server container serving the static assets (e.g. `phone-nginx`).

## Verification (Android)

On Android Chrome / PWA:

1. Open the app normally.
2. Confirm the build indicator shows:

- `build running=<X> latest=<X>`

3. After a new deploy (new `FRONTEND_BUILD`), open the app again.
4. Confirm it self-heals:

- it reloads automatically
- the build indicator converges to the new build
- the app completes boot without ES module import/export errors

## Verification proof: no pinned `?v=` modules on Android

In Android Remote DevTools:

1. Open **Network** and filter to **JS**.
2. Confirm you do not see any of:
   - `bootstrapAndroid.js?v=`
   - `controlBindings.js?v=`
3. Confirm you do see the tokenized chain:
   - `bootstrapAndroid.js?cb=<token>`
   - `callFlowAndroid.js?cb=<token>`
   - `controlBindings.js?cb=<token>`

Optional Console proof:

```js
performance.getEntriesByType('resource')
  .filter(e => e.name.includes('bootstrapAndroid') || e.name.includes('callFlowAndroid') || e.name.includes('controlBindings'))
  .map(e => e.name)
```

Expected result:

- Every returned URL includes `cb=`
- No returned URL includes `?v=`

Behavior check:

- Entering username/password must not auto-start registration.
- Only clicking **Enable Calls** should start first registration.

## Common failure modes + troubleshooting

- **`make render` fails with "Unrendered variables remain"**
  - Cause: `${...}` sequences remain in the rendered HTML (often from JavaScript template literals).
  - Fix: ensure `www/index.html.template` contains only envsubst placeholders for real deployment variables and avoid JS template literals containing `${...}`.

- **Build indicator shows `running != latest` repeatedly**
  - Cause: the app cannot successfully clear SW/cache or the server is serving mixed assets.
  - Check:
    - nginx no-store headers active
    - static deploy copied all updated `www/` files

- **Still seeing stale JS import errors after deploy**
  - Confirm Network requests show `?cb=` consistently on critical modules.
  - Confirm `/index.html` is served with no-store and is actually updating on the server.

## Why this exists

This system was added so real clients can recover from stale cached frontend code automatically, without USB debugging, manual cache clearing, or support intervention.

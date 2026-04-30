# Mobile Device Debug Dashboard

## Overview
The **Mobile Device Debug Dashboard** (served from `/dashboard`) is used to:

- View known devices and their metadata (OS, browser, last seen, current username)
- Inspect uploaded debug logs from mobile browsers
- Flush/delete logs when storage grows too large

The dashboard is served by the `push-server` container and is only reachable via the WireGuard/admin endpoint you already configured.

## Where logs come from
The web app runs a lightweight remote logger (`www/app/remoteLogs/*`) that:

- Intercepts `console.log`, `console.warn`, `console.error`
- Buffers those messages in memory
- Periodically uploads buffered logs to the server via:
  - `POST /api/logs/mobile`
- Separately uploads device/identity metadata via:
  - `POST /api/logs/mobile/metadata`

Important notes:

- Only **console** output is captured. (So WebRTC diagnostics must be written to `console.*` to appear in uploads.)
- Normal operation (Debug OFF) should only send metadata.

## Debug Mode (log capture ON/OFF)
Debug Mode is toggled via the bug/debug button in the UI.

When Debug Mode is **ON**:

- Logs are captured and uploaded on a timer (about every 45 seconds)
- Uploads include a `batchId` so the server can aggregate uploads into a single file per debug session

When Debug Mode is **OFF**:

- The log buffer is cleared
- Only metadata updates are sent

## Why you used to see many `logs_*.json` files
Historically the server stored one file per upload request:

- `logs_<timestamp>.json`

If the client uploads every ~45–60 seconds, this creates many files quickly.

## Aggregated logs (`batch_*.json`)
The server now supports aggregation:

- If the client includes `batchId`, the server appends into:
  - `batch_<batchId>.json`

This produces **one log file per debug session** instead of many.

### When aggregation is active
You will see files named like:

- `batch_1709999999999-ab12cd.json`

and the file’s `meta.logCount` will grow as new uploads are appended.

If you do **not** see `batch_*.json`, it means the client is still not sending `batchId` (usually due to stale cache or debug mode not being restarted).

## How to view logs in the dashboard
Each device row shows buttons:

- **View Latest Logs**
  - Calls `GET /api/logs/mobile/<deviceId>/latest`
  - Opens a new tab showing the JSON content of the most recent log file

## How to flush logs
Each device row has:

- **Flush Logs**
  - Calls `DELETE /api/logs/mobile/<deviceId>/logs`
  - Deletes the log files for that device but keeps metadata (device remains listed)

- **Delete**
  - Calls `DELETE /api/logs/mobile/<deviceId>`
  - Deletes both metadata and log files

## Storage layout on disk
Logs are stored on the host at:

- `backups/mobile-logs/<deviceId>/...`

Metadata is stored at:

- `backups/mobile-logs/metadata/<deviceId>.json`

## Recommended workflow to debug a call
1. On the phone, clear site data for `phone.srve.cc` (to avoid stale JS).
2. Open the app.
3. Toggle Debug Mode **OFF** then **ON** (ensures a fresh `batchId`).
4. Reproduce the issue (place/receive call).
5. Open dashboard and click **View Latest Logs**.
6. Search inside for WebRTC diagnostics, e.g. `bytesReceived=`.

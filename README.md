# ContractIt Dashboard

ContractIt Dashboard is a **fully offline** Electron desktop application that reads contract and variation order data from a live Excel workbook (`ContractIt.xlsx`).

## Core Behavior

- Ships with a packaged Excel template (`assets/ContractIt.xlsx`), generated from code.
- On first run, copies the template to a writable location:
  - `app.getPath('userData')/ContractIt.xlsx`
- Reads all dashboard data from that **live workbook**.
- Users can open the workbook in Microsoft Excel, edit, save, and the dashboard auto-refreshes.

## Tech Stack

- Electron
- electron-builder
- SheetJS (`xlsx`)
- chokidar (file watcher)
- Chart.js (local npm dependency, no CDN)
- Vanilla JS UI modules

## Project Structure

```text
/contractit-dashboard
  package.json
  electron-builder.yml
  /assets
    ContractIt.xlsx
  /scripts
    generate-template.js
  /src
    /main
      main.js
      workbookManager.js
      ipcHandlers.js
    /preload
      preload.js
    /renderer
      index.html
      styles.css
      renderer.js
      ui/
        tabs.js
        table.js
        charts.js
        filters.js
        toasts.js
      compute/
        normalizeVO.js
        deriveFields.js
        qualityChecks.js
```

## Setup and Run

```bash
npm install
npm run generate:template
npm start
```

## Build / Package

```bash
npm run dist
```

`npm run dist` runs `generate:template` first, then packages with electron-builder.

## Excel Template Generation

The template is created by:

```bash
npm run generate:template
```

This generates/overwrites `assets/ContractIt.xlsx` with:
- `Contracts` sheet (required fields + sample rows)
- `VariationOrders` sheet (normalized VO rows + sample rows)

## Packaged App Template Handling

- `electron-builder.yml` includes `assets/ContractIt.xlsx` using `extraResources`.
- Runtime template path:
  - Dev: `<projectRoot>/assets/ContractIt.xlsx`
  - Packaged: `<process.resourcesPath>/assets/ContractIt.xlsx`
- Live workbook path:
  - `<app.getPath('userData')>/ContractIt.xlsx`
- If live workbook is missing, template is copied automatically.
- App never writes into ASAR/resources template location.

## Features by Tab

1. **Overview**
   - KPI cards: total, active, expired, expiring soon
   - Charts: BU distribution, top contractors, expiry timeline, VO trend
   - Quick filters
2. **Contract Register**
   - Search/sort/paginate table
   - Date and categorical filters
   - Expiring soon toggle
   - Export filtered CSV
3. **Contract Details**
   - Drill-down details and derived fields
   - Timeline and contract VO list
4. **Variation Orders**
   - Filterable VO table
   - VO charts
   - Export filtered CSV
5. **Expiry & Renewals**
   - 30/60/90 day expiries
   - Grouping by BU and type
   - Highlights expired contracts with extension entries
6. **Data Quality**
   - Missing required fields
   - Duplicate references
   - Invalid dates and commencement > expiry
   - VOs with missing contract reference

## Security

- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`
- Renderer has no direct filesystem access
- FS access only via preload + IPC
- Minimal `contextBridge` API exposed

## Offline Guarantee

- No remote APIs, analytics, telemetry, or CDNs.
- Chart.js loaded locally from installed dependency.
- No renderer network usage by design.
- Runtime network guard blocks:
  - `window.fetch`
  - `XMLHttpRequest`
  - `WebSocket`

If any code tries network access, it throws immediately.

## Notes on Data Mapping and VO Support

- Supports normalized `VariationOrders` sheet.
- Supports wide VO columns in Contracts sheet (`VO1 Amount`, `VO1 Date`, etc.) and normalizes them internally.
- Header aliases are supported for common naming differences.
- If required column mappings are missing, UI mapping modal allows users to map fields and save mappings.

# Google Sheets Backend Integration & Setup Guide

This guide describes how to connect the VKU Field Survey application to your private Google Sheet using Google Apps Script as the serverless ingestion backend.

---

## 1. Architecture Overview

```text
VKU Field Survey (React / PWA / Android)
                 │
                 │ 1. Offline Submit -> Stored in IndexedDB (status: PENDING_SYNC)
                 │
                 │ 2. When Online -> SyncOrchestrator claims record (status: SYNCING)
                 │ 3. HTTPS POST JSON -> GoogleSheetsSubmissionGateway
                 ▼
Google Apps Script Web App Endpoint
  • Executes under authority of script owner ("Me")
  • Validates payload schema (VKU Zone, Building, Room, Rating)
  • Concurrency control via LockService
  • Idempotency check: rejects duplicate submission_id without extra row
                 │
                 │ 4. Appends row to private sheet
                 ▼
Private Google Spreadsheet ("SurveyResponses" sheet)
                 │
                 │ 5. Returns { ok: true, acknowledged: true, submissionId, duplicate }
                 ▼
VKU Field Survey Client
  • Receives positive ACK
  • Transitions submission to SYNCED in IndexedDB
```

---

## 2. Privacy & Security Boundary

- **Private Google Sheet**: Your Google Sheet must remain **100% PRIVATE**. Never set sheet sharing to _"Anyone with the link can edit"_. The Web App runs with your permissions and writes directly to the private Sheet.
- **Client Security**: No Google credentials, API keys, OAuth tokens, or service account files are bundled into the client application.
- **Web App Access**: Configured with **"Execute as: Me"** and **"Who has access: Anyone"**. This allows surveyors to submit reports without needing a Google Workspace account.
- **Client Anti-Abuse Token**: An optional `WRITE_TOKEN` can be configured to prevent accidental or stray requests.

---

## 3. Step-by-Step Human Setup Instructions

### Step A: Prepare the Google Spreadsheet

1. Open your empty Google Sheet in your browser.
2. Note the **Spreadsheet ID** from the URL:
   ```text
   https://docs.google.com/spreadsheets/d/<SPREADSHEET_ID>/edit
   ```
   _Example:_ If the URL is `https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit`, your `SPREADSHEET_ID` is `1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms`.
3. Keep the sheet **Private** (default sharing). Do not change permissions.

---

### Step B: Install the Google Apps Script Backend

1. In the Google Sheet menu, click **Extensions** $\rightarrow$ **Apps Script**.
2. An Apps Script editor tab will open.
3. In the left file tree, click on `Code.gs`.
4. Delete any default code in `Code.gs` and replace it with the complete contents of:
   [`google-apps-script/Code.gs`](../../google-apps-script/Code.gs)
5. Click the **Save** icon (diskette) or press `Ctrl + S`.
6. Name your project (e.g. `VKU Field Survey Backend`).

---

### Step C: Configure Script Properties

1. In the Apps Script editor, click **Project Settings** (gear icon on the left sidebar).
2. Scroll down to **Script Properties**.
3. Click **Add script property** and enter:

| Property         | Value                                     | Description                       |
| ---------------- | ----------------------------------------- | --------------------------------- |
| `SPREADSHEET_ID` | `<YOUR_SPREADSHEET_ID>`                   | The ID copied from your Sheet URL |
| `SHEET_NAME`     | `SurveyResponses`                         | Target worksheet name             |
| `WRITE_TOKEN`    | _(Optional)_ e.g. `vku-survey-token-2026` | Anti-abuse token (optional)       |

4. Click **Save script properties**.

---

### Step D: Initialize the Sheet Headers (`setupSheet`)

1. Return to the editor view (**Editor** / `<>` icon on left sidebar).
2. At the top toolbar, find the function dropdown (it may show `myFunction` or `doGet`).
3. Select **`setupSheet`** from the dropdown.
4. Click **Run**.
5. When prompted for authorization:
   - Click **Review permissions**.
   - Choose your Google account.
   - Click **Advanced** $\rightarrow$ **Go to VKU Field Survey Backend (unsafe)**.
   - Click **Allow**.
6. Switch back to your Google Sheet tab:
   - You will see a worksheet named **`SurveyResponses`** with formatted headers:
     `submission_id`, `submitted_at`, `zone`, `building`, `room_number`, `room_identifier`, `category`, `condition_rating`, `defect_notes`, `photo_id`, `photo_captured_at`, `synced_at`.

---

### Step E: Deploy the Web App

1. In the Apps Script editor, click the blue **Deploy** button (top right) $\rightarrow$ **New deployment**.
2. Click the gear icon next to "Select type" and choose **Web app**.
3. Configure the deployment settings:
   - **Description:** `VKU Field Survey Production Ingestion v1`
   - **Execute as:** **Me (`your-email@gmail.com`)** _(CRITICAL: allows the script to write to your private sheet)_
   - **Who has access:** **Anyone** _(CRITICAL: allows the PWA and mobile clients to submit)_
4. Click **Deploy**.
5. Copy the generated **Web app URL**:
   ```text
   https://script.google.com/macros/s/AKfycbx.../exec
   ```
   _(Save this URL — this is your `VITE_SUBMISSION_ENDPOINT`)_.

---

### Step F: Configure Cloudflare Pages

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/) $\rightarrow$ **Workers & Pages**.
2. Select your `vku-field-survey` project.
3. Go to **Settings** $\rightarrow$ **Environment variables** (or **Variables and Secrets**).
4. Under **Production**, click **Add variable**:
   - Variable name: **`VITE_SUBMISSION_ENDPOINT`**
   - Value: `<PASTE_YOUR_WEB_APP_URL>` (e.g. `https://script.google.com/macros/s/.../exec`)
5. _(Optional)_ If you set a `WRITE_TOKEN` in Step C, also add:
   - Variable name: **`VITE_SUBMISSION_CLIENT_TOKEN`**
   - Value: `<YOUR_WRITE_TOKEN>`
6. Click **Save**.
7. Go to the **Deployments** tab $\rightarrow$ click the three dots on the latest deployment $\rightarrow$ **Retry deployment** (or trigger a new build) so the new environment variables are baked into the production bundle.

---

## 4. Google Sheet Schema Specification (`SurveyResponses`)

| Col | Field Name          | Type                | Source Field                   | Example / Description                                             |
| --- | ------------------- | ------------------- | ------------------------------ | ----------------------------------------------------------------- |
| A   | `submission_id`     | String (UUID)       | `submission.id`                | `72e7d465-9cda-4e33-8464-7169cee92240` (Unique idempotency key)   |
| B   | `submitted_at`      | String (ISO 8601)   | `submission.timestamp`         | `2026-09-03T01:15:12.903Z`                                        |
| C   | `zone`              | String              | `surveyData.zone`              | `K` (Khu Hàn) or `V` (Khu Việt)                                   |
| D   | `building`          | String              | `surveyData.building`          | `A`, `B`, `C`, `D1`, `D2`, `E1`, `E2`, etc.                       |
| E   | `room_number`       | String              | `surveyData.roomNumber`        | `205`, `301`, etc. (Floor encoded inside room number)             |
| F   | `room_identifier`   | String              | `formatFullRoomIdentifier`     | `K.A-205` (VKU standard derived room identifier)                  |
| G   | `category`          | String              | `surveyData.category`          | `Hardware`, `Projector`, `AC`, `Electrical`, `Furniture`          |
| H   | `condition_rating`  | Integer (1-5)       | `surveyData.conditionRating`   | `4`                                                               |
| I   | `defect_notes`      | String              | `surveyData.defectNotes`       | `Air conditioner compressor vibrates loudly on high fan speed.`   |
| J   | `photo_id`          | String (UUID/empty) | `surveyData.photo?.id`         | `photo-uuid-1234` (Metadata only; binary Blob stays in IndexedDB) |
| K   | `photo_captured_at` | String (ISO 8601)   | `surveyData.photo?.capturedAt` | `2026-09-03T01:14:00.000Z`                                        |
| L   | `synced_at`         | String (ISO 8601)   | Server generated               | `2026-09-03T01:15:15.120Z` (Timestamp when row was inserted)      |

### Illustrative Example Row

> **EXAMPLE ONLY — DO NOT INSERT MANUALLY:**
> `72e7d465-9cda-4e33-8464-7169cee92240` | `2026-09-03T01:15:12.903Z` | `K` | `A` | `205` | `K.A-205` | `AC` | `4` | `Air conditioner compressor vibrates loudly.` | `photo-uuid-1234` | `2026-09-03T01:14:00.000Z` | `2026-09-03T01:15:15.120Z`

---

## 5. Checklist: Values the Human Must Provide

```text
[ ] SPREADSHEET_ID = _____________________________________________
    (Obtained from the Google Sheet URL between /d/ and /edit)

[ ] SHEET_NAME = SurveyResponses
    (Configured in Apps Script Script Properties; default: SurveyResponses)

[ ] WRITE_TOKEN = ________________________________________________
    (Optional anti-abuse token configured in Script Properties & Cloudflare)

[ ] APPS_SCRIPT_WEB_APP_URL = _____________________________________
    (Obtained from Apps Script: Deploy -> Manage deployments -> Web app URL)

[ ] VITE_SUBMISSION_ENDPOINT = ____________________________________
    (Set in Cloudflare Pages Production Environment Variables to match Web App URL)
```

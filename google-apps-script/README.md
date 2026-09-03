# VKU Field Survey — Google Apps Script Backend

Lightweight Web App ingestion endpoint for appending survey submissions to a private Google Sheet.

## Architecture

```text
React / Capacitor Client
         │
         │ HTTPS POST (JSON)
         ▼
Google Apps Script Web App (Executes as Sheet Owner)
         │
         │ Append Row (with LockService & UUID Idempotency)
         ▼
Private Google Spreadsheet ("SurveyResponses" sheet)
```

## Security & Privacy Model

- **Private Google Sheet**: The spreadsheet itself remains **100% PRIVATE**. It is never shared publicly or set to "Anyone with the link can edit".
- **Execution Authority**: The Apps Script Web App runs under **"Execute as: Me"** (the Google account that created the script). The script has permission to write to your private Sheet, while clients only receive access to the `doPost` function.
- **Web App Access**: Set to **"Anyone"** so survey submissions from browsers (PWA) and Android apps can POST data without requiring every surveyor to authenticate with a personal Google account.
- **No Client Secrets**: Client JavaScript never contains OAuth keys, service account credentials, or Google Sheets REST API tokens.
- **Anti-Abuse Protection**:
  - Validates payload structure and fields (Zone must be `K` or `V`, Rating must be 1–5, Category must be valid).
  - Rejects malformed requests or unsupported actions.
  - Implements **UUID idempotency**: if the client retries an already-synced submission, the script acknowledges it without creating duplicate rows.
  - Uses `LockService` to prevent race conditions during concurrent sync attempts.
  - Optional `WRITE_TOKEN` script property for lightweight client token verification.

## Sheet Schema (`SurveyResponses`)

| Column | Header | Source Domain Field | Description / Example |
|---|---|---|---|
| A | `submission_id` | `submission.id` | Client UUID (Idempotency key, e.g. `72e7d465-...`) |
| B | `submitted_at` | `submission.timestamp` | ISO timestamp when user submitted (e.g. `2026-09-03T01:15:12.903Z`) |
| C | `zone` | `surveyData.zone` | Campus Zone: `K` (Khu Hàn) or `V` (Khu Việt) |
| D | `building` | `surveyData.building` | Building name: `A`, `B`, `C`, `D1`, `D2`, `E1`, `E2`, etc. |
| E | `room_number` | `surveyData.roomNumber` | Room number (e.g. `205`, `301`) |
| F | `room_identifier` | `formatFullRoomIdentifier` | Full VKU room ID (e.g. `K.A-205`, `V.B-301`) |
| G | `category` | `surveyData.category` | `Hardware`, `Projector`, `AC`, `Electrical`, `Furniture` |
| H | `condition_rating` | `surveyData.conditionRating` | Integer rating: 1 to 5 |
| I | `defect_notes` | `surveyData.defectNotes` | Free-text survey notes |
| J | `photo_id` | `surveyData.photo?.id` | Photo attachment UUID (metadata only, or empty) |
| K | `photo_captured_at` | `surveyData.photo?.capturedAt`| Photo timestamp (or empty) |
| L | `synced_at` | Server generated | ISO timestamp when record was appended to Sheet |

> **Note on Photos:** Photo binary Blobs remain stored durably in the local IndexedDB database. The Google Sheet records photo metadata (`photo_id`, `photo_captured_at`) without storing raw image binary in cells.

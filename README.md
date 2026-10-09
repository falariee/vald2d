# Stride

A personal fitness app for screenshot imports, gym sessions, live GPS runs, height and weight check-ins, BMI, weekly reviews, photos, and Apple Calendar bookings.

## Review on your computer

1. Install **Node.js 20 or newer** from [nodejs.org](https://nodejs.org/en/download). Node.js includes npm.
2. Extract the local review ZIP. Open a terminal inside the `stride-local-review` folder, where `package.json` lives.
3. Run:

```sh
npm ci
npm run setup
npm start
```

4. Open **http://localhost:3000** in your browser. Keep the terminal running while you review the app; press **Ctrl+C** when finished.

These commands work in Windows PowerShell, macOS Terminal, and Linux. Bash, curl, and separate checksum tools are not required. The ZIP includes the English OCR model; setup verifies it and downloads a replacement from its pinned source only if it is missing or invalid. npm needs Internet access to install the locked dependencies.

To use another port, set `PORT` before starting the app. For example, in PowerShell: `$env:PORT=3001; npm start`, or on macOS/Linux: `PORT=3001 npm start`.

## Try these flows

- **Scan screenshot:** upload a clear screenshot containing a run and a gym session. Review both records, confirm their dates, and save them together.
- **Log activity:** runs record time, distance, pace, and optional calories. Gym sessions record time and optional calories. Seconds are preserved. Missing calories remain unknown; missing pace is calculated from duration and distance.
- **Track a run:** allow location access. Keep the app open while running. GPS can be reviewed on localhost; deployment uses HTTPS. Background tracking is not supported.
- **Progress:** enter height and weight to see adult BMI and keep a check-in history. BMI is a screening measure and does not account for muscle mass, pregnancy, or individual health needs.
- **Photos:** add a photo to the progress journal.
- **Bookings:** import a private `.ics` calendar export, or connect a published iCloud gym-calendar link. Choose a reminder lead time and enable notifications.

## Data and calendar behavior

Records and compressed photos are stored in this browser's localStorage. There are no accounts, cloud sync, or backups yet. Clearing site data removes records. The local site and a future Netlify site have separate browser storage, so records entered during local review will not automatically appear after deployment.

OCR runs on the device using Tesseract.js and locally served assets. Screenshots are not sent to a third-party AI service. Recognition depends on image clarity; confirm the values before saving. Dates are not inferred from relative captions.

Apple Calendar supports private `.ics` file imports and subscriptions to published iCloud calendar links (`webcal://p…-caldav.icloud.com/published/…`). A published calendar is public to anyone with the link; use a separate gym calendar. No iCloud password is requested or stored. Private account login / CalDAV syncing is not implemented.

Subscriptions refresh every 15 minutes while the app is open. File imports need re-importing after bookings change. Recurring bookings and exclusions are supported for the next 90 days. Reminders require an open, active app and browser permission. Use Apple Calendar alerts for reminders when the app is closed or the device sleeps.

## Checks and Netlify preparation

```sh
npm test
npm run build
```

The build writes the static app, local OCR assets, language model, calendar library, and fonts into `dist/`. The included `netlify.toml` configures this build and the calendar API in `netlify/functions/calendar.mjs`. Calendar subscriptions need that function, so use a Netlify build when you are ready to deploy. No deployment is performed by the commands above.

The calendar API accepts only published HTTPS iCloud URLs, validates redirect destinations, limits response size, and uses a timeout. It does not require an API key. GPS and notifications need a secure context (localhost or HTTPS).

Automated checks cover BMI, weekly totals, multi-session screenshot parsing, calendar recurrence and reminders, and calendar API request validation. Real-device GPS and a personal iCloud subscription still need checking with your phone and calendar link.

## Setup details

The English OCR model is pinned to `tesseract-ocr/tessdata_fast` commit `87416418657359cb625c412a48b6e1d6d41c29bd`, with SHA-256 `7d4322bd2a7749724879683fc3912cb542f19906c83bcc1a52132556427170b2`. Setup retains TLS verification and verifies the model checksum. `OCR_DATA_PATH` optionally selects the language-asset directory used by the local server.

DM Sans is included locally with its OFL license in `assets/fonts`. The interface does not depend on a font CDN. `scripts/setup.sh` remains available for existing cloud setup scripts.

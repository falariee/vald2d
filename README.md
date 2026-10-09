# Stride

A personal fitness app for screenshot imports, gym sessions, live GPS runs, height and weight check-ins, BMI, weekly reviews, daily photo posts, booking emails, and monthly streaks.

## Review on your computer

1. Install **Node.js 20 or newer** from [nodejs.org](https://nodejs.org/en/download). Node.js includes npm.
2. Extract the ZIP. Open a terminal inside the extracted project folder—the one containing `package.json`.
3. Run:

```sh
npm ci
npm run setup
npm start
```

4. Open **http://localhost:3000** in your browser. Keep the terminal running while you review the app; press **Ctrl+C** when finished.

These commands work in Windows PowerShell, macOS Terminal, and Linux. Bash, curl, and separate checksum tools are not required. Setup verifies any existing English OCR model and downloads it from its pinned source when missing or invalid. GitHub source downloads prepare the model on the first setup. Internet access is needed to install the locked dependencies and fetch the model when required.

To use another port, set `PORT` before starting the app. For example, in PowerShell: `$env:PORT=3001; npm start`, or on macOS/Linux: `PORT=3001 npm start`.

## Try these flows

- **Scan screenshot:** upload a clear screenshot containing a run and a gym session. Review both records, confirm their dates, and save them together.
- **Log activity:** runs record time, distance, pace, and optional calories. Gym sessions record time and optional calories. Seconds are preserved. Missing calories remain unknown; missing pace is calculated from duration and distance.
- **Track a run:** allow location access. Keep the app open while running. GPS can be reviewed on localhost; deployment uses HTTPS. Background tracking is not supported.
- **Progress:** enter height and weight to see adult BMI and keep a check-in history. BMI is a screening measure and does not account for muscle mass, pregnancy, or individual health needs.
- **Daily log:** write a dated caption, add up to six photos, and tag a post as Everyday, Run, Gym, or Rest. Browse the feed, browse photo carousels with buttons or arrow keys, filter by date or tag, and edit or delete posts. Text-only posts work too.
- **Booking emails:** paste a Gmail gym-confirmation email or scan its screenshot. Review the detected name, location, start, and end before saving. The editor uses Singapore time (UTC+08:00). Past bookings stay available in the history; upcoming bookings can trigger reminders.
- **Monthly overview:** open Bookings to browse months, switch between workout days and daily posts, and see your current and longest streaks. Multiple logs on one day count once. Planned bookings have a separate marker and do not increase a streak. Tap a date to filter bookings.
- **Calendar imports:** optionally import a private `.ics` file or connect a published iCloud gym-calendar link from the expandable Calendar imports panel. Choose a reminder lead time and enable notifications.

## Data and calendar behavior

Records and compressed photos are stored in this browser's localStorage. There are no accounts, cloud sync, or backups yet. Clearing site data removes records. The local site and a future Netlify site have separate browser storage, so records entered during local review will not automatically appear after deployment.

Daily posts are a personal feed on this device; public profiles, likes, comments, and shared posts are not implemented. Existing photos migrate into dated posts once. Workout and posting streaks count consecutive logged days through today, or through yesterday if today has not been logged yet. Future dates do not count. Calendar days follow your device timezone.

OCR runs on the device using Tesseract.js and locally served assets. Screenshots are not sent to a third-party AI service. Recognition depends on image clarity; confirm the values before saving. Dates are not inferred from relative captions.

Booking-email imports do not log into Gmail or read future messages automatically. Import each new confirmation yourself. Only the reviewed booking fields are stored; email text, screenshots, customer/contact details, booking reference numbers, and door-entry links are discarded. Re-importing the same reviewed booking does not create a duplicate. Calendar imports and refreshes preserve saved email bookings.

Apple Calendar supports private `.ics` file imports and subscriptions to published iCloud calendar links (`webcal://p…-caldav.icloud.com/published/…`). A published calendar is public to anyone with the link; use a separate gym calendar. No iCloud password is requested or stored. Private account login / CalDAV syncing is not implemented.

Subscriptions refresh every 15 minutes while the app is open. File imports need re-importing after bookings change. Recurring bookings and exclusions are supported for the next 90 days. Reminders require an open, active app and browser permission. Use Apple Calendar alerts for reminders when the app is closed or the device sleeps.

## Checks and Netlify preparation

```sh
npm test
npm run build
```

The build writes the static app, local OCR assets, language model, calendar library, and fonts into `dist/`. The included `netlify.toml` configures this build and the calendar API in `netlify/functions/calendar.mjs`. Calendar subscriptions need that function, so use a Netlify build when you are ready to deploy. No deployment is performed by the commands above.

The calendar API accepts only published HTTPS iCloud URLs, validates redirect destinations, limits response size, and uses a timeout. It does not require an API key. GPS and notifications need a secure context (localhost or HTTPS).

Automated checks cover BMI, weekly totals, multi-session screenshot parsing, daily-post validation and migration, booking-email parsing and timezone handling, monthly grids and streaks, calendar recurrence and reminders, and calendar API request validation. Real-device GPS and a personal iCloud subscription still need checking with your phone and calendar link.

## Setup details

The English OCR model is pinned to `tesseract-ocr/tessdata_fast` commit `87416418657359cb625c412a48b6e1d6d41c29bd`, with SHA-256 `7d4322bd2a7749724879683fc3912cb542f19906c83bcc1a52132556427170b2`. Setup retains TLS verification and verifies the model checksum. `OCR_DATA_PATH` optionally selects the language-asset directory used by the local server.

DM Sans is included locally with its OFL license in `assets/fonts`. The interface does not depend on a font CDN. `scripts/setup.sh` remains available for existing cloud setup scripts.

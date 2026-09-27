# Vaguthu — Time Log

A simple web app for recording how you actually spent your day, not planning it,
and seeing where your time goes each week and month.

## Features

- **Timeline grid.** A day is split into 15-minute cells. Pick a category and tap or drag across the cells to paint them.
  Tapping a cell that already has the selected category clears it.
- **Manual entries.** Add a block with a start time, end time, category and optional note. A block that runs past
  midnight is split across the two days. Anything the new block overlaps is replaced.
- **Categories.** Starts with Work, Sleep, Exercise, Meals, Commute, Leisure, Chores, Social, Learning / Study,
  Prayer / Spiritual, Social media and TV / Streaming. You can rename, recolor, reorder, add and archive them.
- **Weekly and monthly reports:**
  - A category breakdown donut. The top 7 categories are shown and the rest are grouped as "Other".
  - Daily stacked bars, including untracked time, with a table view.
  - A comparison with the previous week or month, using averages per day.
  - Untracked time: in the day view as a list of gaps, and in reports per day and as a total.
- **Sync.** Firebase Auth (Google sign-in) with Firestore. It works offline and syncs when you're back online.
- **Export.** Download all your data as JSON from the Categories tab.
- Supports light and dark mode.

## On your phone

The app is built for phones first:

- **Bottom tab bar** for switching between Log, Reports and Categories with your thumb.
- **Painting the grid:** tap a cell to paint it. **Long-press, then drag** to paint a whole range, such as a night's sleep.
  A normal swipe scrolls the page.
- **Category bar** that stays at the top of the screen while you scroll through the day.
- **+ button** that opens the add/edit entry form as a panel from the bottom of the screen.
- **Install it:** it's a PWA (progressive web app). Open the deployed site, then use **Share → Add to Home Screen** on iPhone,
  or **⋮ → Install app** in Chrome on Android. It opens full-screen like a native app and the app itself loads
  offline. Entries you make offline sync once you're back online.

Installing needs the site to be served over HTTPS, which Firebase Hosting provides.

## Run locally

```bash
npm install
npm run dev
```

Without Firebase config, the app runs in **local mode** and data stays in that browser.

## Set up Firebase (to sync across devices)

1. Create a project at <https://console.firebase.google.com>.
2. **Build → Authentication → Get started → Sign-in method → Google → Enable.**
3. **Build → Firestore Database → Create database.** Production mode is fine because the rules below lock it down.
4. **Project settings → Your apps → Add app → Web.** Copy the config values.
5. `cp .env.example .env.local` and fill in `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`,
   `VITE_FIREBASE_PROJECT_ID` and `VITE_FIREBASE_APP_ID`.
6. Deploy the security rules so each user can only access their own data:
   ```bash
   npm i -g firebase-tools
   firebase login
   firebase use --add          # pick your project
   firebase deploy --only firestore:rules
   ```

## Deploy (Firebase Hosting)

Every push to `main` runs `.github/workflows/deploy.yml`, which tests, builds and deploys to
`https://<project-id>.web.app`. It needs these repository secrets
(**Settings → Secrets and variables → Actions → New repository secret**):

| Secret | Value |
|---|---|
| `VITE_FIREBASE_API_KEY` | `apiKey` from your Firebase web config |
| `VITE_FIREBASE_AUTH_DOMAIN` | `authDomain` |
| `VITE_FIREBASE_PROJECT_ID` | `projectId` |
| `VITE_FIREBASE_APP_ID` | `appId` |
| `FIREBASE_SERVICE_ACCOUNT` | The whole JSON key file of a service account with the **Firebase Hosting Admin** role |

You can also run it by hand from the **Actions** tab (**Deploy to Firebase Hosting → Run workflow**).

To deploy from your own machine instead: `npm run build && npx firebase-tools deploy --only hosting --project <project-id>`.

## Data model

```
users/{uid}                   { categories: [...], weekStartsOn: 0 }
users/{uid}/days/{yyyy-MM-dd} { date, entries: [{ id, start, end, categoryId, note? }] }
```

`start` and `end` are minutes from midnight (0–1440). Storing one document per day keeps a monthly report
to about 60 reads, covering the current and previous month.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Typecheck and build to `dist/` |
| `npm test` | Run the unit tests (Vitest) |

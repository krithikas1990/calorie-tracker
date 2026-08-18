# Calorie Tracker — from code to Android app

This project has two parts:

- **`backend/`** — a tiny server that holds your Anthropic API key privately and talks to Claude on the app's behalf. Lives on the internet (Vercel), not on your phone.
- **`app/`** — the actual app the user sees. Built with React, wrapped into a real Android app with Capacitor.

Follow the phases in order. Don't skip ahead — each one depends on the last working.

---

## Phase 1 — Install the tools (one-time setup)

1. **Node.js** (needed to run any of this code)
   - Go to https://nodejs.org and install the **LTS** version.
   - Check it worked: open a terminal and run `node -v` — you should see a version number.

2. **Android Studio** (needed to build the Android app)
   - Download from https://developer.android.com/studio
   - Install it, open it once, and let it install the default Android SDK when prompted. This also installs the Java (JDK) you need — no separate Java install required.

3. **A code editor** — VS Code (https://code.visualstudio.com) is a good free choice if you don't have one.

You don't need to fully learn any of these tools yet — just get them installed.

---

## Phase 2 — Get your Anthropic API key

1. Go to https://console.anthropic.com and sign in / create an account.
2. Add billing (a card) — this is a pay-as-you-go API, roughly a cent or two per photo analyzed.
3. Go to **API Keys** and create a new key. Copy it somewhere safe — you'll paste it once in Phase 3 and never need to type it into the app itself.

---

## Phase 3 — Deploy the backend (so your key stays private)

We'll use **Vercel** — it's free for this kind of small project and doesn't require managing a server.

1. Go to https://vercel.com and sign up (you can sign up with GitHub).
2. Put this whole `calorie-tracker` folder into a GitHub repository:
   - Create a new repo on https://github.com/new
   - Follow GitHub's instructions to push this folder to it (or use GitHub Desktop if the command line feels unfamiliar: https://desktop.github.com)
3. In Vercel, click **Add New → Project**, and import that GitHub repo.
4. When Vercel asks for the **Root Directory**, set it to `backend`.
5. Before deploying, add an **Environment Variable**:
   - Name: `ANTHROPIC_API_KEY`
   - Value: the key you copied in Phase 2
6. Click **Deploy**.
7. Once it finishes, Vercel gives you a URL like `https://calorie-tracker-backend-xyz.vercel.app`. **Copy this URL** — you need it in the next phase.

Quick check: visiting that URL in a browser and adding `/api/analyze` should show a "Method not allowed" message (that's correct — it only accepts photo uploads, not browser visits).

---

## Phase 4 — Run the frontend and connect it to your backend

1. Open a terminal in the `app` folder:
   ```
   cd app
   npm install
   ```
2. Copy the example env file and edit it:
   ```
   cp .env.example .env
   ```
   Open `.env` and replace the URL with the real one from Phase 3:
   ```
   VITE_BACKEND_URL=https://calorie-tracker-backend-xyz.vercel.app
   ```
3. Try it in a regular browser first:
   ```
   npm run dev
   ```
   Open the link it prints (usually `http://localhost:5173`). Try uploading a food photo. If you get a result, your backend is wired up correctly — the hard part is done.

---

## Phase 5 — Turn it into an Android project with Capacitor

Still inside the `app` folder:

1. Build the production version of the app:
   ```
   npm run build
   ```
2. Add the Android platform:
   ```
   npx cap add android
   ```
   This creates a new `android/` folder — a full native Android project.
3. Copy your built app into it:
   ```
   npx cap sync
   ```

Whenever you change your code later, repeat: `npm run build` then `npx cap sync`.

---

## Phase 6 — Open it in Android Studio and run it

1. ```
   npx cap open android
   ```
   This launches Android Studio with your project already open.
2. Let it finish "Gradle sync" (a progress bar at the bottom — can take a few minutes the first time).
3. Plug in an Android phone via USB (with **USB debugging** enabled in the phone's Developer Options), or set up a virtual device inside Android Studio.
4. Click the green **Run ▶** button. The app installs and opens on your phone or emulator.

At this point you have a real, working Android app. Everything from here is optional polish.

---

## Phase 7 — Build a shareable APK (optional, once you're happy with it)

In Android Studio: **Build → Build Bundle(s) / APK(s) → Build APK(s)**.

When it finishes, click the notification to locate the `.apk` file. You can send this file to any Android phone and install it directly (the phone will ask you to allow installs from unknown sources the first time — this is normal for apps outside the Play Store).

To eventually publish it on the Google Play Store, you'd need a one-time $25 Google Play developer account and a signed release build — happy to walk through that when you're ready.

---

## If something goes wrong

- **"npm: command not found"** → Node.js isn't installed correctly; redo Phase 1, step 1.
- **App opens but photo analysis fails** → double check `.env` has the exact Vercel URL, no trailing slash, and that you ran `npm run build && npx cap sync` after editing it.
- **Backend returns an error about the API key** → check the environment variable name in Vercel is exactly `ANTHROPIC_API_KEY` and that your Anthropic account has billing enabled.
- **Gradle sync fails in Android Studio** → usually fixed by File → Invalidate Caches / Restart.

Come back and paste the exact error message any time you get stuck on a step — that's the fastest way through this.

# 📡 Cross-Schedule Bot

Schedule posts and auto-publish to **Mastodon**, **Bluesky**, and **Telegram** — powered by **Firebase Realtime Database** + **GitHub Actions**.

## How It Works

```
Firebase RTDB (scheduled posts) → GitHub Actions (every 15 min) → Platform APIs
        ↑                                      │
    Admin Dashboard                     Delete after success
    (browser-based)                     (auto-cleanup)
```

1. **Schedule a post** via the admin dashboard (date/time + text + media + platforms)
2. **Firebase stores** it with `status: "pending"`
3. **GitHub Actions** runs every 15 minutes, checks for due posts
4. Each due post gets published to all configured platforms
5. **Auto-deleted** from Firebase after successful publishing — no clutter

## Quick Start

### 1. Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a project (or use existing: `oddsalley-31ydy`)
3. Enable **Realtime Database** → create in **us-central1** → start in **test mode**
4. Go to **Project Settings → Service Accounts** → **Generate new private key**
5. Save the JSON file — you'll need it for GitHub Secrets

### 2. Deploy the Admin Dashboard

The dashboard is a single HTML file that connects to Firebase directly from the browser.

**Option A — GitHub Pages (recommended):**
Push `admin/` to a `gh-pages` branch or use any static host (Vercel, Netlify, Cloudflare Pages).

**Option B — Open locally:**
Just open `admin/index.html` in any browser. Since Firebase Web SDK handles auth, it works without a server.

> ⚠️ For production, set up **Firebase App Check** or **Authentication** to prevent unauthorized access to your database.

### 3. Set Up GitHub Secrets

Go to your repo → **Settings → Secrets and variables → Actions**:

| Secret | Value |
|--------|-------|
| `FIREBASE_SERVICE_ACCOUNT` | Full JSON from the service account key (paste as one line) |
| `FIREBASE_DATABASE_URL` | `https://oddsalley-31ydy-default-rtdb.firebaseio.com` |
| `MASTODON_TOKEN` | Your Mastodon access token |
| `MASTODON_INSTANCE` | `https://mastodon.social` |
| `BLUESKY_USERNAME` | Your Bluesky email or handle |
| `BLUESKY_PASSWORD` | Your Bluesky app password |
| `TELEGRAM_BOT_TOKEN` | Your Telegram bot token from @BotFather |
| `TELEGRAM_CHANNEL_ID` | Your channel @username or numeric ID |

### 4. Test It

- Push to GitHub
- Schedule a post via the dashboard (set it 5 minutes in the future)
- Wait for the next GitHub Actions run (or trigger manually via **Actions → Cross-Schedule Bot → Run workflow**)
- Check your platforms for the post

## Firebase Database Structure

```
/scheduled-posts/
  $postId:
    text: "Post content"
    media: [
      { url: "https://...", alt: "description", type: "image|video" }
    ]
    platforms: ["mastodon", "bluesky", "telegram"]
    scheduledAt: 1234567890       // epoch ms (UTC)
    status: "pending"             // pending | publishing | published | failed
    createdAt: 1234567890
    publishedAt: null
    error: null
```

Posts are **automatically deleted** on successful publishing. Failed posts are marked with `status: "failed"` and an error message for debugging.

## Local Testing

```bash
# Install dependencies
npm install

# Set up .env with your credentials (see .env.example)
# FIREBASE_SERVICE_ACCOUNT_PATH=path/to/service-account.json

# Dry run — check what would be posted
DRY_RUN=true node src/index.js

# Live run
node src/index.js
```

## Firestore vs RTDB

This bot uses **Realtime Database** for its simplicity:
- Real-time listener on the admin dashboard (instant updates)
- Simple JSON structure
- No schema needed
- Auto-cleanup (delete on success)

## Why Not X (Twitter)?

X/Twitter is excluded from this bot. The API authentication (OAuth 1.0a) and media upload requirements add complexity. May be added in a future version.

## License

Open source. Free for all.

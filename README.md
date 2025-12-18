# Empire RAG – Insurance Policy Intelligence Engine

This repo contains two main parts:

- **Backend** – Cloudflare Worker (Python) exposed at your Workers URL
- **Frontend** – React + TypeScript + Vite dashboard in `dashboard/`

Current production backend URL:

- `https://empire-rag-backend.soorya220104.workers.dev`

The frontend is configured to talk to this URL.

---

## 1. Project Structure

- `entry.py` – Cloudflare Worker backend (Python Workers)
- `wrangler.toml` – Cloudflare Worker config (bindings, name, etc.)
- `dashboard/` – React + Vite UI for uploading files and chatting
- `data.txt` – Sample data (not required)

---

## 2. Prerequisites

- Node.js (LTS) and npm installed
- Cloudflare account
- Wrangler CLI:

```bash
npm install -g wrangler
```

Log in once:

```bash
npx wrangler login
```

---

## 3. Run Everything **Locally** (Backend in Cloud, Frontend on Your Machine)

The backend is already deployed and running in the cloud at:

- `https://empire-rag-backend.soorya220104.workers.dev`

The frontend just needs to run locally and talk to that URL.

### Step 1 – Install frontend dependencies

```bash
cd "/Users/soorya/Desktop/Projects /insurance_policy_intelligence_engine/dashboard"
npm install
```

### Step 2 – Start the frontend dev server

```bash
cd "/Users/soorya/Desktop/Projects /insurance_policy_intelligence_engine/dashboard"
npm run dev
```

Then open the printed URL (usually `http://localhost:5173`).

You can now:

1. Upload a PDF or text file using the upload buttons
2. Ask questions in the chat box (e.g. "summarize this" / "give me a glimpse of the document")

The frontend will call these cloud endpoints:

- `POST https://empire-rag-backend.soorya220104.workers.dev/api/upload`
- `POST https://empire-rag-backend.soorya220104.workers.dev/api/chat`

---

## 4. Deploy / Update the **Backend** (Cloudflare Worker)

From the repo **root**:

```bash
cd "/Users/soorya/Desktop/Projects /insurance_policy_intelligence_engine"

# Deploy (or redeploy) the Worker
npx wrangler deploy
```

Check that it is online:

```bash
curl https://empire-rag-backend.soorya220104.workers.dev/health
```

You should see:

```json
{"status": "ok", "message": "Backend is online"}
```

---

## 5. Deploy the **Frontend** to Cloudflare Pages

The frontend is a static Vite app and should be deployed as a Pages project.

### Step 1 – Build the frontend

```bash
cd "/Users/soorya/Desktop/Projects /insurance_policy_intelligence_engine/dashboard"
npm run build
```

This creates the `dist/` folder.

### Step 2 – Deploy `dist/` with Wrangler Pages

```bash
cd "/Users/soorya/Desktop/Projects /insurance_policy_intelligence_engine/dashboard"
npx wrangler pages deploy dist --project-name empire-rag-dashboard
```

Wrangler will print a URL like:

- `https://empire-rag-dashboard.pages.dev`

Visit that URL – it will use the same backend URL
`https://empire-rag-backend.soorya220104.workers.dev`.

> If you ever change the Worker URL, update it in `dashboard/src/App.tsx` where `BACKEND_URL` is defined.

---

## 6. Quick Command Cheat Sheet

**Backend (Worker):**

```bash
# From repo root
cd "/Users/soorya/Desktop/Projects /insurance_policy_intelligence_engine"
npx wrangler deploy
```

**Frontend – dev:**

```bash
cd "/Users/soorya/Desktop/Projects /insurance_policy_intelligence_engine/dashboard"
npm install        # once
npm run dev
```

**Frontend – build & deploy to Pages:**

```bash
cd "/Users/soorya/Desktop/Projects /insurance_policy_intelligence_engine/dashboard"
npm run build
npx wrangler pages deploy dist --project-name empire-rag-dashboard
```

With these commands you can:

- Run the UI locally against the live cloud backend
- Redeploy backend code quickly with `npx wrangler deploy`
- Host the frontend itself on Cloudflare Pages for a fully cloud-hosted app.
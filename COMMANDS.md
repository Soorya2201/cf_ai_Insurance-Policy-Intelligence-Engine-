# Quick Command Reference

## 🏠 Local Development

### Run Dashboard (Frontend) Locally
```bash
cd dashboard
npm run dev
```
This will start the frontend at `http://localhost:5173` (or similar port)

### Run Backend Locally (Cloudflare Workers)
```bash
# From project root
npx wrangler dev
```
This will start the backend at `http://localhost:8787`

**Note**: When running backend locally, you need to update the `BACKEND_URL` in `dashboard/src/App.tsx` to:
```typescript
const BACKEND_URL = "http://localhost:8787";
```

### Run Both Locally (Two Terminal Windows)
**Terminal 1 - Backend:**
```bash
cd "/Users/soorya/Desktop/Projects /insurance_policy_intelligence_engine"
npx wrangler dev
```

**Terminal 2 - Frontend:**
```bash
cd "/Users/soorya/Desktop/Projects /insurance_policy_intelligence_engine/dashboard"
npm run dev
```

---

## ☁️ Cloudflare Deployment

### Deploy Backend to Cloudflare
```bash
# From project root
cd "/Users/soorya/Desktop/Projects /insurance_policy_intelligence_engine"

# Make sure you're logged in
npx wrangler login

# Deploy
npx wrangler deploy
```

After deployment, you'll get a URL like: `https://empire-rag-backend.soorya220104.workers.dev`

### Build and Deploy Frontend (Optional - if you want to host on Cloudflare Pages)
```bash
cd dashboard
npm run build
```

Then deploy the `dist` folder to Cloudflare Pages or any static hosting service.

### Verify Backend Deployment
```bash
# Test health endpoint
curl https://empire-rag-backend.soorya220104.workers.dev/health
```

---

## 🔍 Quick Checks

### Check if logged in to Cloudflare
```bash
npx wrangler whoami
```

### View Backend Logs
```bash
npx wrangler tail
```

### Check Current Backend URL
The backend URL is set in: `dashboard/src/App.tsx` (line 5)
Current value: `https://empire-rag-backend.soorya220104.workers.dev`

---

## 📝 Typical Workflow

### For Local Testing:
1. **Terminal 1**: `npx wrangler dev` (backend)
2. **Terminal 2**: `cd dashboard && npm run dev` (frontend)
3. Update `BACKEND_URL` in `App.tsx` to `http://localhost:8787`
4. Open browser to frontend URL (usually `http://localhost:5173`)

### For Production:
1. Deploy backend: `npx wrangler deploy`
2. Update `BACKEND_URL` in `App.tsx` to your Cloudflare Workers URL
3. Build frontend: `cd dashboard && npm run build`
4. Deploy frontend `dist` folder to your hosting service

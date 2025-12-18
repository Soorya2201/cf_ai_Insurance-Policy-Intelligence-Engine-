# Deployment Guide - Fix Upload Issues

## 🔧 Fixes Applied

1. **Backend JSON Parsing**: Fixed how the backend reads and parses request bodies
2. **Error Handling**: Added comprehensive error handling with detailed messages
3. **CORS Headers**: Added proper CORS headers to all responses
4. **Health Check**: Added `/health` endpoint to test backend connectivity
5. **Frontend Error Display**: Improved error messages to show actual backend errors

## 🚀 Deploy the Backend

### Step 1: Navigate to Project Root
```bash
cd "/Users/soorya/Desktop/Projects /insurance_policy_intelligence_engine"
```

### Step 2: Deploy to Cloudflare Workers
```bash
npx wrangler deploy
```

**Important**: Make sure you're logged in to Cloudflare:
```bash
npx wrangler login
```

### Step 3: Verify Deployment
After deployment, test the backend:

```bash
# Test health endpoint
curl https://empire-rag-backend.soorya220104.workers.dev/health

# Test upload endpoint (should return an error but show it's working)
curl -X POST https://empire-rag-backend.soorya220104.workers.dev/api/upload \
  -H "Content-Type: application/json" \
  -d '{"filename":"test.txt","text":"test"}'
```

## 🧪 Test Locally (Optional)

You can test the backend locally before deploying:

```bash
# Run locally
npx wrangler dev

# This will give you a local URL like: http://localhost:8787
# Update BACKEND_URL in dashboard/src/App.tsx temporarily to test
```

## 🔍 Troubleshooting

### Error: "Failed to fetch"

**Possible Causes:**
1. Backend not deployed - Run `npx wrangler deploy`
2. Backend crashed - Check Cloudflare Workers dashboard for errors
3. CORS issue - Should be fixed, but check browser console
4. Wrong URL - Verify BACKEND_URL in `dashboard/src/App.tsx`

### Error: "Worker error 1101"

This means the backend code has a runtime error. Check:
1. Cloudflare Workers dashboard → Your worker → Logs
2. Make sure all Python syntax is correct
3. Verify AI and VECTORIZE bindings are configured in `wrangler.toml`

### Check Backend Logs

1. Go to Cloudflare Dashboard
2. Navigate to Workers & Pages
3. Click on your worker
4. Go to "Logs" tab to see real-time errors

## ✅ Verification Steps

1. **Test Health Endpoint**: Visit `https://empire-rag-backend.soorya220104.workers.dev/health` in browser
   - Should return: `{"status":"ok","message":"Backend is online"}`

2. **Test Frontend Connection**: 
   - Open your frontend app
   - Check browser console (F12)
   - Should see: "✅ Backend connection successful"

3. **Test File Upload**:
   - Try uploading your lease document
   - Check console for detailed error messages if it fails

## 📝 Current Backend URL

Make sure this matches your deployed worker:
```
https://empire-rag-backend.soorya220104.workers.dev
```

If your worker has a different URL, update it in:
- `dashboard/src/App.tsx` (line 5)

## 🆘 Still Having Issues?

1. Check browser console (F12) for detailed error messages
2. Check Cloudflare Workers logs
3. Verify you're logged in: `npx wrangler whoami`
4. Try redeploying: `npx wrangler deploy`


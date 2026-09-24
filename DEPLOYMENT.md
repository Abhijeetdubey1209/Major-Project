# Deployment Guide - Cyclone Intelligence Platform

This guide covers deploying your frontend to Vercel and connecting it to your backend.

---

## 🎯 **Deployment Architecture**

```
┌─────────────┐         ┌──────────────────┐
│   Vercel    │  HTTPS  │  Backend Server  │
│  (Frontend) │ ──────> │  (FastAPI)       │
│  React App  │         │  Port 8050       │
└─────────────┘         └──────────────────┘
```

---

## 🚀 **Option 1: Local Backend + Cloudflare Tunnel (Quick Demo)**

**Use case**: Development, testing, quick demos

### **Step 1: Start Backend Locally**
```bash
cd backend
uvicorn app.main:app --host 0.0.0.0 --port 8050
```

### **Step 2: Create Cloudflare Tunnel**
```bash
# In a new terminal
cloudflared tunnel --url http://localhost:8050
```

**Output example**:
```
Your quick Tunnel has been created! Visit it at:
https://random-words-1234.trycloudflare.com
```

⚠️ **Note**: This URL changes every time you restart the tunnel!

### **Step 3: Update Frontend Environment Variable**

Create `frontend/.env.local`:
```env
VITE_API_URL=https://random-words-1234.trycloudflare.com
```

### **Step 4: Deploy Frontend to Vercel**

```bash
cd frontend

# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy
vercel --prod
```

### **Step 5: Set Environment Variable in Vercel Dashboard**

1. Go to https://vercel.com/dashboard
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Add:
   - **Key**: `VITE_API_URL`
   - **Value**: `https://your-cloudflare-tunnel-url.trycloudflare.com`
   - **Environment**: Production

5. **Redeploy** the project for changes to take effect

---

## 🌍 **Option 2: Backend on Cloud + Vercel Frontend (Production)**

**Use case**: Production deployment, stable URLs

### **Backend Hosting Options**

#### **A. Render (Recommended - Free Tier Available)**

**Step 1: Create `render.yaml`**
```yaml
services:
  - type: web
    name: cyclone-backend
    env: python
    buildCommand: "pip install -r requirements.txt"
    startCommand: "uvicorn app.main:app --host 0.0.0.0 --port $PORT"
    envVars:
      - key: PYTHON_VERSION
        value: 3.12
```

**Step 2: Deploy to Render**
1. Push code to GitHub
2. Go to https://render.com
3. Connect your GitHub repo
4. Deploy backend service
5. Copy the URL: `https://your-app.onrender.com`

---

#### **B. Railway (Easy, Free Tier)**

**Step 1: Create `railway.json`**
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "uvicorn app.main:app --host 0.0.0.0 --port $PORT",
    "restartPolicyType": "ON_FAILURE"
  }
}
```

**Step 2: Deploy to Railway**
```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Deploy
railway up
```

---

#### **C. Your Own VPS (Ubuntu/DigitalOcean/AWS)**

**Step 1: Install Dependencies**
```bash
sudo apt update
sudo apt install python3-pip python3-venv nginx

# Clone your repo
git clone https://github.com/yourusername/your-repo.git
cd your-repo/backend

# Setup virtual environment
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

**Step 2: Create Systemd Service**

Create `/etc/systemd/system/cyclone-backend.service`:
```ini
[Unit]
Description=Cyclone Backend API
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/your-repo/backend
Environment="PATH=/home/ubuntu/your-repo/backend/venv/bin"
ExecStart=/home/ubuntu/your-repo/backend/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8050
Restart=always

[Install]
WantedBy=multi-user.target
```

**Step 3: Start Service**
```bash
sudo systemctl daemon-reload
sudo systemctl start cyclone-backend
sudo systemctl enable cyclone-backend
```

**Step 4: Configure Nginx**

Create `/etc/nginx/sites-available/cyclone-backend`:
```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:8050;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/cyclone-backend /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

**Step 5: SSL with Certbot**
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d api.yourdomain.com
```

---

### **Frontend Deployment to Vercel**

**Step 1: Update Environment Variable**

In `frontend/.env.production`:
```env
VITE_API_URL=https://your-backend.onrender.com
# or
VITE_API_URL=https://api.yourdomain.com
```

**Step 2: Deploy to Vercel**

**Via Vercel Dashboard (Recommended)**:
1. Go to https://vercel.com
2. Click **Add New** → **Project**
3. Import your Git repository
4. Set **Root Directory**: `frontend`
5. **Build Command**: `npm run build`
6. **Output Directory**: `dist`
7. **Environment Variables**:
   - Key: `VITE_API_URL`
   - Value: `https://your-backend-url.com`
8. Click **Deploy**

**Via CLI**:
```bash
cd frontend

# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod

# Set environment variable
vercel env add VITE_API_URL production
# Enter: https://your-backend-url.com
```

---

## 🔒 **CORS Configuration**

Your backend needs to allow requests from your Vercel domain.

**Update `backend/app/main.py`**:

```python
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# Configure CORS
origins = [
    "http://localhost:5173",           # Local development
    "http://localhost:3000",
    "https://your-app.vercel.app",     # Your Vercel domain
    "https://your-custom-domain.com",  # Custom domain (if any)
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## 🧪 **Testing the Deployment**

### **1. Test Backend**
```bash
curl https://your-backend-url.com/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "datasets": {
    "ibtracs": true,
    "tcir": true,
    "era5": true
  }
}
```

### **2. Test Frontend**
Visit: `https://your-app.vercel.app`

Check browser console for any CORS or API errors.

---

## 📊 **Persistent Backend with Cloudflare Tunnel (Alternative)**

If you want a **stable tunnel URL** instead of the random one:

**Step 1: Create Named Tunnel**
```bash
# Login to Cloudflare
cloudflared tunnel login

# Create tunnel
cloudflared tunnel create cyclone-backend

# Configure tunnel
# Create config.yml:
```

**`~/.cloudflared/config.yml`**:
```yaml
tunnel: <TUNNEL-ID>
credentials-file: /path/to/credentials.json

ingress:
  - hostname: api.yourdomain.com
    service: http://localhost:8050
  - service: http_status:404
```

**Step 2: Route DNS**
```bash
cloudflared tunnel route dns cyclone-backend api.yourdomain.com
```

**Step 3: Run Tunnel**
```bash
cloudflared tunnel run cyclone-backend
```

---

## 🔄 **Automated Deployment Workflow**

**For GitHub → Vercel (Frontend)**:
Vercel auto-deploys on every push to `main` branch.

**For GitHub → Render/Railway (Backend)**:
Both auto-deploy on every push to `main` branch.

---

## 📝 **Environment Variables Summary**

### **Frontend (Vercel)**
- `VITE_API_URL`: Backend API URL

### **Backend (if using cloud hosting)**
- `PORT`: Server port (usually auto-set by platform)
- `DATABASE_URL`: If using cloud database (optional)
- `PYTHONUNBUFFERED`: `1` (for logging)

---

## 🎯 **Recommended Setup for Your Project**

**For Development**:
- Frontend: `npm run dev` (localhost:5173)
- Backend: `uvicorn` (localhost:8050)

**For Demo/Testing**:
- Frontend: Vercel
- Backend: Cloudflare Tunnel (local machine)

**For Production**:
- Frontend: Vercel
- Backend: Render/Railway (cloud hosted)

---

## ⚠️ **Important Notes**

1. **Large Files**: Your datasets (TCIR ~14GB, ERA5) won't fit on most cloud free tiers
   - Keep backend on your local machine with tunnel for demos
   - Use cloud storage (AWS S3, Google Cloud Storage) for production

2. **Database**: SQLite works locally but use PostgreSQL for production cloud deployment

3. **Environment Variables**: Never commit `.env` files to Git
   - Use `.env.example` as a template
   - Add `.env*` to `.gitignore`

4. **API Keys**: If you add any API keys later, use Vercel/Render environment variables

---

## 🆘 **Troubleshooting**

### **CORS Errors**
- Check backend CORS configuration
- Verify frontend is using correct API URL
- Check browser console for exact error

### **404 on Vercel**
- Check `vercel.json` rewrites configuration
- Verify build output is in `dist` folder

### **Backend Connection Failed**
- Verify tunnel is running
- Check firewall allows port 8050
- Test backend with `curl http://localhost:8050/api/health`

### **Environment Variable Not Working**
- Redeploy after adding env vars in Vercel dashboard
- Check env var name matches code (`VITE_` prefix for Vite)

---

## 🚀 **Quick Start Commands**

```bash
# Terminal 1: Start backend
cd backend
uvicorn app.main:app --host 0.0.0.0 --port 8050

# Terminal 2: Start tunnel
cloudflared tunnel --url http://localhost:8050

# Terminal 3: Deploy frontend
cd frontend
vercel --prod
# Set VITE_API_URL in Vercel dashboard to tunnel URL
```

---

## 📚 **Additional Resources**

- [Vercel Documentation](https://vercel.com/docs)
- [Render Documentation](https://render.com/docs)
- [Cloudflare Tunnel Docs](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)
- [FastAPI Deployment](https://fastapi.tiangolo.com/deployment/)

---

**Need help?** Check the logs:
- Vercel: https://vercel.com/dashboard → Your Project → Deployments → View Logs
- Backend: Check terminal output or systemd logs (`journalctl -u cyclone-backend`)

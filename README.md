# FinTrack - Loan & EMI Tracker

A web application to track personal lending with 4% monthly simple interest and flexible tenure.

## Business Logic

- **Interest**: 4% simple interest per month on principal
- **Tenure**: Configurable (default 10 months), EMI cycle starts the month after the loan date
- **Examples**:
  - ₹10,000 for 10 months → 40% interest → ₹14,000 total (₹1,400/mo)
  - ₹20,000 for 15 months → 60% interest → ₹32,000 total (₹2,133/mo)

## Tech Stack

- **Backend**: Python / FastAPI / SQLAlchemy
- **Frontend**: React / Vite / Tailwind CSS
- **Database**: SQLite (local) or PostgreSQL (cloud)
- **Deployment**: Podman (local) or Render.com (cloud)

---

## Local Deployment (Podman)

```bash
podman build -t fintrack .
podman run -d --name fintrack -p 8000:8000 -v fintrack-data:/app/data fintrack
```

Open http://localhost:8000

```bash
podman stop fintrack     # stop
podman start fintrack    # restart
podman rm fintrack       # remove (data persists in volume)
```

---

## Free Cloud Deployment (Render + Neon)

### Step 1 — Create a free PostgreSQL database on Neon

1. Go to https://neon.tech and sign up (free, no credit card)
2. Create a new project (any name, pick a region close to you)
3. Copy the **connection string** — it looks like:
   ```
   postgresql://user:password@ep-xxx.region.aws.neon.tech/dbname?sslmode=require
   ```

### Step 2 — Push code to GitHub

```bash
cd finance-app
git init
git add .
git commit -m "Initial commit"
gh repo create fintrack --public --source=. --push
```

### Step 3 — Deploy on Render

1. Go to https://render.com and sign up (free, connect GitHub)
2. Click **New → Web Service**
3. Connect your `fintrack` GitHub repo
4. Render auto-detects the Containerfile. Configure:
   - **Name**: fintrack
   - **Plan**: Free
   - **Environment variable**: `DATABASE_URL` = *(paste your Neon connection string)*
5. Click **Deploy**

Your app will be live at `https://fintrack-xxxx.onrender.com` within a few minutes.

> **Note**: Render's free tier spins down after 15 min of inactivity.
> The first request after idle takes ~30 seconds to wake up. Data is safe in Neon regardless.

# FinTrack - Loan & EMI Tracker

A web application to track personal lending with 4% monthly simple interest and flexible tenure.

## Business Logic

- **Interest**: simple interest per month on principal, set per loan (default 4%)
- **Tenure**: Configurable (default 10 months), EMI cycle starts the month after the loan date
- **Rounding**: EMIs are rounded to the paisa; the last installment absorbs the remainder
- **Partial payments**: a month is *paid* once it reaches the EMI (within ₹0.50), otherwise *partial*
- **Overdue**: any unpaid or partial installment whose due date (IST) has passed
- **Account balance**: opening balance + EMIs collected − principal lent since the balance was last set
- **Examples**:
  - ₹10,000 for 10 months → 40% interest → ₹14,000 total (₹1,400/mo)
  - ₹20,000 for 15 months → 60% interest → ₹32,000 total (₹2,133.33/mo, last ₹2,133.38)

## Local Development

```bash
cd backend
python3.12 -m venv .venv-dev && .venv-dev/bin/pip install -r requirements.txt -r requirements-dev.txt
.venv-dev/bin/pytest -q                              # tests
.venv-dev/bin/python bootstrap_db.py                 # create/upgrade local SQLite schema
.venv-dev/bin/uvicorn main:app --reload              # API on :8000

cd ../frontend && npm ci && npm run dev              # UI on :5173 (proxies /api)
```

Schema changes go through Alembic (`backend/alembic/versions`). The container runs
`bootstrap_db.py` on startup, which stamps a pre-Alembic database at `0001_baseline`
and then applies pending migrations.

## Deploying database changes safely

1. **Back up**: in Neon, create a branch of production named `backup-YYYY-MM-DD`. Leave it untouched.
2. **Dry run**: create a second branch `dryrun-YYYY-MM-DD`, copy its connection string, then:
   ```bash
   cd backend
   DATABASE_URL='<dryrun branch connection string>' .venv-dev/bin/python dryrun_check.py
   ```
   It migrates the branch and compares every profile's totals and balance before vs after.
   Deploy only if it prints `ALL NUMBERS MATCH`.
3. **Render env**: confirm `JWT_SECRET` is set to a long random value (changing it logs everyone out once).
4. **Deploy**: push to `main`. Check `/api/health`, log in, compare dashboard numbers.
5. **Reminders**: in cron-job.org, move the token from the URL to an `X-Notify-Token` header
   (the old `?token=` URL keeps working for now).
6. **Rollback**: redeploy the previous commit in Render; if data needs restoring, point
   `DATABASE_URL` at the backup branch or restore it in Neon.

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

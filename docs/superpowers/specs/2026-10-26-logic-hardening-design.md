# FinTrack Phase 1 — Logic & Security Hardening

**Date:** 2026-10-26
**Status:** Approved design, pending spec review
**Follow-up:** Phase 2 (Awwwards-style UI redesign) gets its own spec after this ships.

## Goal

Make the existing FinTrack app production-ready without losing or altering any
existing production data. No visual redesign in this phase; frontend changes are
limited to what the new logic requires (editable payment amount, overdue view,
edit forms, search, error handling).

## Hard constraint: data preservation

Production runs on Render (free tier, Docker) with Neon Postgres via
`DATABASE_URL`. All existing users, profiles, borrowers, loans, payments and
config rows must survive with identical meaning.

1. **Backup before deploy.** Before the first deploy of this phase, take a Neon
   branch (or `pg_dump`) of production. The deploy checklist (README) documents
   the exact command and the restore procedure.
2. **Dry run.** Every migration is run against a Neon branch copied from
   production, and the dashboard totals (total lent, expected, collected,
   pending, current balance) are compared before/after. They must match to the
   rupee.
3. **Additive, reversible migrations only.** Every Alembic revision has a working
   `downgrade()`. No column or table is dropped in this phase.
4. **Existing loans are never recalculated.** `total_return`, `monthly_emi`,
   `interest_rate` already stored per loan stay as-is.
5. **Displayed balance is preserved.** See "Account balance" below.

## 1. Migrations (Alembic)

- Add Alembic under `backend/alembic/`.
- Revision `0001_baseline` creates the schema exactly as `models.py` defines it
  today.
- Startup (`backend/start.sh`, used by the Containerfile `CMD`):
  - If the database has a `users` table but no `alembic_version` table, run
    `alembic stamp 0001_baseline` (production path: nothing is rebuilt).
  - Then `alembic upgrade head`.
  - Then start uvicorn.
- Remove `Base.metadata.create_all()` from `main.py`.
- `migrate.py`, `backend/migrate_add_users.py`, `backend/migrate_add_profiles.py`
  stay in the repo untouched (historical), but are no longer run.

## 2. Security

| Item | Change |
|---|---|
| JWT secret | On startup, if `JWT_SECRET` is unset or equals the dev default and `DATABASE_URL` is set (i.e. production), log an `ERROR` every startup. `render.yaml` adds `JWT_SECRET` with `generateValue: true`. If the secret changes, users re-login once; no data impact. |
| Static file route | The catch-all resolves the requested path with `os.path.realpath` and only serves it if it stays inside `static_dir`; otherwise falls back to `index.html`. |
| Rate limiting | `slowapi` (in-memory; single instance on free tier). Login: 10/min per IP. Signup: 5/hour per IP. Chat: 20/hour per user. Returns 429 with a friendly message. |
| Credentials | Signup: username 3–32 chars, `[a-zA-Z0-9_.-]`, case-insensitive uniqueness check; password ≥ 8 chars. Existing users are not forced to change anything. |
| Input limits | Pydantic constraints on every schema: names ≤ 100 chars, phone ≤ 20, notes ≤ 500, chat message ≤ 1000, principal > 0 and ≤ 1e9, months 1–120, interest rate 0–20 (% per month). |
| Cron secret | Generated server-side (`secrets.token_urlsafe(32)`) via `POST /api/settings/notifications/generate-secret`. Compared with `hmac.compare_digest`. Accepted from the `X-Notify-Token` header; the `?token=` query param still works this phase but logs a deprecation warning. Settings page shows header instructions for cron-job.org. |
| Push privacy | ntfy messages no longer contain borrower names: "3 EMIs due today — Rs 4,200 total. Open FinTrack for details." |
| Error leakage | AI and ntfy errors log full detail server-side but return generic messages to the client. |

## 3. Money logic

### 3.1 Exact decimals

Migration `0002_numeric_money` converts `loans.principal`, `loans.total_return`,
`loans.monthly_emi`, `loans.interest_rate`, `payments.amount` from `Float` to
`Numeric(14, 2)` (`interest_rate` to `Numeric(6, 2)`), rounding half-up to 2
decimals in place. Python side uses `Decimal`; JSON responses serialize as
numbers (float) for frontend compatibility.

For **new** loans: `monthly_emi = round(total_return / months, 2)`, and the
schedule's final installment is `total_return - monthly_emi * (months - 1)` so the
schedule sums exactly to `total_return`. Existing loans use their stored EMI for
every month (unchanged behavior).

### 3.2 Per-loan interest rate

- `LoanCreate` gains `monthly_rate: Decimal = 4` (percent per month).
- `interest_rate` column keeps its current meaning (total % over tenure =
  `monthly_rate * months`), so existing rows remain correct.
- Calculation lives in one backend function `compute_loan_terms(principal,
  monthly_rate, months)`. New `GET /api/loans/preview?principal=&monthly_rate=&months=`
  returns the terms; AddLoan uses it (debounced) instead of duplicating the
  formula.
- `MONTHLY_INTEREST_RATE` constant becomes the default only.

### 3.3 Payments

- Server validation on `POST /api/loans/{id}/payments`: `1 ≤ month_number ≤
  total_months`, `amount > 0`, loan must be `active`, `payment_date` not in the
  future (IST).
- Migration `0003_payment_unique` adds a unique constraint on
  `(loan_id, month_number)`. Before adding it, the migration checks for
  duplicates; if any exist it aborts with a clear message listing them (no
  automatic deletion of user data).
- **Partial payments:** the payment modal's amount is editable (prefilled with the
  EMI). New `PATCH /api/payments/{id}` updates amount/date/notes (to top up a
  partial). Month status per schedule entry: `paid` if amount ≥ expected − 0.50,
  `partial` if less, `pending`/`overdue` if no payment.
- **Completion rule:** loan is `completed` when every month is `paid` (replaces
  the current count-based rule). Recomputed after every payment create, update,
  delete. For existing data this yields the same result, since all existing
  payments were recorded at the full EMI.

### 3.4 Overdue

Computed, never stored. An installment is `overdue` if unpaid (or partial) and
its due date < today (IST). Exposed:
- In `GET /api/loans/{id}` schedule entries (`status` field).
- New `GET /api/overdue` — list of overdue installments across the profile,
  with days overdue and outstanding amount.
- Dashboard shows an "Overdue" card (count + amount) linking to the list.

### 3.5 Account balance

Current formula: `base_balance + (total_collected − collections_snapshot)`.
It ignores money lent out.

New formula:

```
balance = opening_balance
        + sum(payments.amount where payment.created_at > anchor_at)
        − sum(loans.principal where loan.created_at > anchor_at)
```

stored as config keys `balance_opening` and `balance_anchor_at` per profile.

Migration `0004_balance_ledger` (data migration), per profile:
1. Compute the balance exactly as the current code does, including the
   `INITIAL_BALANCE = 53600` default when no `base_balance` row exists.
2. Write `balance_opening = <that value>`, `balance_anchor_at = now()`.

So every profile's displayed balance is identical immediately after deploy;
only future loans/payments move it under the new rule. Old keys
(`base_balance`, `collections_snapshot`) are left in place (unused) for
downgrade.

Editing the balance in the UI sets `balance_opening = <entered>` and
`balance_anchor_at = now()`. New profiles default to opening balance 0. The
`INITIAL_BALANCE` constant is removed from runtime code (kept only inside the
migration).

Payment deletion after the anchor naturally reverses its effect; loan deletion
likewise.

### 3.6 Timezone

- Backend: `today()` helper returns `datetime.now(ZoneInfo("Asia/Kolkata")).date()`;
  configurable via `APP_TIMEZONE` env var. Every `date.today()` call is replaced.
- Frontend: `todayISO()` helper in `src/lib/format.js` using
  `Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" })`; replaces every
  `new Date().toISOString().slice(0, 10)`.

## 4. Features

- **Edit borrower:** `PUT /api/borrowers/{id}` (name, phone). Inline edit on
  Borrowers page.
- **Edit loan:** `PUT /api/loans/{id}`. If the loan has no payments: principal,
  rate, months, loan date editable (terms recomputed). If it has payments: only
  borrower reassignment within the profile is allowed. UI: edit button on
  LoanDetail.
- **Borrower detail page:** `/borrowers/:id` — contact, all loans, totals lent /
  collected / outstanding, overdue count. Backed by `GET /api/borrowers/{id}`.
- **Search & filter:** client-side on Loans (by borrower name, status:
  active/completed/overdue) and Borrowers (by name/phone).
- **CSV export:** `GET /api/export/loans.csv` and `GET /api/export/payments.csv`
  for the current profile. Buttons on Loans page.

## 5. Engineering

- **Queries:** list endpoints use `selectinload(Loan.payments)` and
  `joinedload(Loan.borrower)`; dashboard sums via SQL aggregates.
- **Health:** `GET /api/health` returns `{status: "ok", db: "ok"}` after a
  `SELECT 1`. `render.yaml` sets `healthCheckPath: /api/health`.
- **Backend structure:** split `main.py` (1000+ lines) into
  `routers/{auth,profiles,borrowers,loans,payments,dashboard,settings,chat,export}.py`
  plus `services/{loan_terms,balance,schedule,timeutil}.py`. Endpoint paths and
  response shapes unchanged except where this spec adds fields.
- **Frontend:**
  - `src/lib/format.js`: `formatCurrency`, `formatDate`, `formatFullDate`,
    `todayISO` — replaces per-file copies.
  - `src/components/Toast.jsx` + `useToast()` context; every API call surfaces
    failures as a toast. Dashboard renders each section independently so one
    failed request doesn't blank the page.
  - Interceptor: only 401 logs out (403 no longer does).
  - Top-level React error boundary with a "Something went wrong — reload" screen.
- **Tests:** `backend/tests/` with pytest + SQLite in-memory:
  - `compute_loan_terms` (examples from README; final-installment remainder).
  - Payment validation, uniqueness, partial → paid via PATCH, completion rule,
    reopening on delete.
  - Balance formula incl. anchor semantics.
  - Overdue computation around IST midnight.
  - Migration `0004` reproduces the old balance for fixtures with and without a
    `base_balance` row.
  - Profile isolation: user A cannot read/modify user B's data on every route.
  - Static route rejects path traversal.
- **CI:** `.github/workflows/ci.yml` — backend pytest, frontend `npm ci && npm run build`.

## Out of scope (this phase)

- Visual redesign (Phase 2).
- Token refresh/revocation, httpOnly cookies, 2FA.
- Multi-instance rate limiting (Redis).
- Penalties/late fees, compound interest, reschedules.
- Dropping legacy config keys or migration scripts.

## Deploy checklist (to be added to README)

1. Neon: create branch `pre-phase1-backup` from production.
2. Create a second branch `phase1-dryrun`; run the app locally against it with
   `DATABASE_URL=<dryrun url>`; compare dashboard numbers for each profile with
   production.
3. In Render, confirm `JWT_SECRET` is set (or let `render.yaml` generate it;
   users re-login once).
4. Deploy. Verify `/api/health`, log in, compare dashboard numbers again.
5. Update cron-job.org to send the `X-Notify-Token` header.
6. Rollback: redeploy previous commit and, if needed, restore from
   `pre-phase1-backup`.

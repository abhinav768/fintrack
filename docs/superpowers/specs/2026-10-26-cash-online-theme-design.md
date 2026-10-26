# Cash vs online payments, funding sources, light theme

Approved 26 Oct 2026.

## Money places
Each profile tracks two balances and one untracked source:

| Place | Tracked | Money in | Money out |
|---|---|---|---|
| Collection account (bank) | yes | online (UPI) EMIs, deposits | loans funded from it, withdrawals |
| Cash in hand | yes | cash EMIs, withdrawals | loans funded from cash, deposits |
| Capital account | no | — | loans funded from capital (shown as a total only) |

`balance = opening + events created after the opening was set`. The collection account keeps the
existing `balance_opening` / `balance_anchor_at` keys. Cash uses `cash_opening` / `cash_anchor_at`;
with no anchor, every cash event counts and the opening is 0.

**Total on hand** = collection + cash. **Total collected** = all EMIs ever received, split online / cash.

## Data
- `payments.method`: `online` | `cash`. Existing rows set to `online`. NULL is read as `online`
  (an old instance can still write during a Render deploy).
- `loans.funding_source`: `capital` | `collection` | `cash`. Existing rows set to `collection`
  (NULL read as `collection`, matching today's behaviour). New loans default to `capital`.
  Editable at any time, including after payments.
- New `transfers` table: `profile_id`, `direction` (`deposit` = cash → bank, `withdraw` = bank → cash),
  `amount`, `transfer_date` (not in the future), `notes`, `created_at`. Create, list, delete.

## API
- `POST /loans/{id}/payments` and `PATCH /payments/{id}` accept `method`. Schedule rows return it.
- `POST /loans` / `PUT /loans/{id}` accept `funding_source`; loan summaries return it.
- `GET /balance` returns the existing collection-account fields plus `cash`, `total_on_hand`,
  `collected_online`, `collected_cash`, `lent_from_capital`.
- `PUT /balance` accepts `account` (`collection` default, or `cash`).
- `GET/POST /transfers`, `DELETE /transfers/{id}`.
- `GET /monthly-collection` adds `collected_online` / `collected_cash`.
- CSV exports add `funding_source` (loans) and `method` (payments).

## UI
- Overview: Collection account, Cash in hand, Total on hand; collected split online / cash; "Move money" button.
- Payment modal: Online (UPI) / Cash toggle. New loan: "Money from" (Capital default, Collection, Cash).
- Light theme by default (warm off-white, olive-lime accent for text on light); sun/moon toggle in the
  sidebar and mobile menu, remembered per device. Colours move to CSS variables.

## Safety
Migration `0005` adds nullable columns and the table, then backfills. Before deploy: back up, dry-run on a
local copy, confirm every collection balance equals the pre-migration balance and cash is 0.

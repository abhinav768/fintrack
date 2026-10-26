from sqlalchemy import create_engine, text

import dryrun_check
from test_bootstrap import LEGACY_SCHEMA


def test_dryrun_passes_on_legacy_data(tmp_path, monkeypatch, capsys):
    url = f"sqlite:///{tmp_path / 'prod-copy.db'}"
    engine = create_engine(url)
    with engine.begin() as conn:
        for stmt in LEGACY_SCHEMA:
            conn.execute(text(stmt))
        conn.execute(text("INSERT INTO users (id, username, password_hash) VALUES (1, 'abhinav', 'x')"))
        conn.execute(text("INSERT INTO profiles (id, user_id, name) VALUES (1, 1, 'Main'), (2, 1, 'Second')"))
        conn.execute(text("INSERT INTO borrowers (id, name, profile_id) VALUES (1, 'Ravi', 1), (2, 'Sita', 2)"))
        conn.execute(text(
            "INSERT INTO loans (id, borrower_id, principal, interest_rate, total_return, monthly_emi, total_months, loan_date, cycle_start_date, status, created_at) VALUES "
            "(1, 1, 20000, 60, 32000, 2133.3333333333335, 15, '2026-01-10', '2026-02-10', 'active', '2026-01-10 10:00:00'),"
            "(2, 2, 10000, 40, 14000, 1400, 10, '2026-01-05', '2026-02-05', 'active', '2026-01-05 10:00:00')"
        ))
        conn.execute(text(
            "INSERT INTO payments (loan_id, amount, month_number, payment_date, created_at) VALUES "
            "(1, 2133.3333333333335, 1, '2026-02-10', '2026-02-10 10:00:00'),"
            "(2, 1400, 1, '2026-02-05', '2026-02-05 10:00:00')"
        ))
        conn.execute(text("INSERT INTO app_config (key, profile_id, value) VALUES ('base_balance', 2, '9000'), ('collections_snapshot', 2, '0')"))

    monkeypatch.setenv("DATABASE_URL", url)
    assert dryrun_check.main() == 0
    out = capsys.readouterr().out
    assert "ALL NUMBERS MATCH" in out
    assert "MISMATCH" not in out.replace("NO MISMATCH", "")

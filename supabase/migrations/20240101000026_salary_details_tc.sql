-- Migration: TC calculator fields on salary_details
-- Powers the full Total Compensation calculator:
--   equity_details       — structured RSU/option grant (JSONB for flexibility)
--   retirement_match_*   — employer 401(k) match as numeric percentages
--   state_of_work        — 2-char US state code for the income tax estimator
--   annual_hours_worked  — denominator for effective hourly rate (default 2,080 = 52 × 40)

ALTER TABLE salary_details
    ADD COLUMN IF NOT EXISTS equity_details        JSONB,
    ADD COLUMN IF NOT EXISTS retirement_match_percent NUMERIC(5,2)
                                                    CHECK (retirement_match_percent BETWEEN 0 AND 100),
    ADD COLUMN IF NOT EXISTS retirement_match_cap   NUMERIC(5,2)
                                                    CHECK (retirement_match_cap BETWEEN 0 AND 100),
    ADD COLUMN IF NOT EXISTS state_of_work          CHAR(2),
    ADD COLUMN IF NOT EXISTS annual_hours_worked    INT NOT NULL DEFAULT 2080
                                                    CHECK (annual_hours_worked BETWEEN 1 AND 8760);

COMMENT ON COLUMN salary_details.equity_details IS
    'RSU/option grant details: {total_shares, grant_date, cliff_months, vest_months, current_price}. '
    'cliff_months defaults to 12, vest_months to 48 (standard 1-year cliff / 4-year vest).';

COMMENT ON COLUMN salary_details.retirement_match_percent IS
    'Employer 401(k) match rate as a percentage of salary (e.g. 4.00 = matches 4% of base).';

COMMENT ON COLUMN salary_details.retirement_match_cap IS
    'Maximum employer contribution as a percentage of salary (e.g. 4.00 = capped at 4% of base). '
    'Effective employer contribution = MIN(base × match_pct, base × match_cap) / 100.';

COMMENT ON COLUMN salary_details.state_of_work IS
    '2-letter US state code for the state income tax estimator (e.g. "CA", "NY", "TX"). '
    'NULL = no state estimate shown.';

COMMENT ON COLUMN salary_details.annual_hours_worked IS
    'Expected annual work hours used to compute effective hourly rate. Default 2,080 (52 × 40).';
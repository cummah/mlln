-- Third rebuild migration. Paste into the Supabase SQL editor in a NEW query tab. Additive only, one transaction.
--
-- backtest_summary_v2 is a staging copy of backtest_summary with exactly the same columns. The rebuilt summary
-- (new engine, true 1 month to 5 year windows, one standard baseline, recomputed DCA score) is written here first,
-- so the portfolio page, which reads backtest_summary, does not change until you have compared the two and approved.
-- Nothing existing is altered or dropped.

begin;

create table if not exists backtest_summary_v2 (like backtest_summary including all);

alter table backtest_summary_v2 enable row level security;

commit;

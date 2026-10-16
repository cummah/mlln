-- Add pending_tier to track tier upgrades waiting for Revolut payment
alter table profiles add column pending_tier smallint check (pending_tier is null or (pending_tier >= 1 and pending_tier <= 3));

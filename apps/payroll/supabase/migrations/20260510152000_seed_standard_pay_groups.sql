/*
  # Seed standard payroll schedules

  Ensures the common scheduled payroll groups exist so the Pay Run modal can
  offer Weekly, Bi-weekly, Semi-monthly, and Monthly groups out of the box.
*/

INSERT INTO pay_groups (name, description, pay_schedule, wage_type, active)
SELECT 'Weekly Staff', 'Default group for weekly-paid employees', 'weekly', 'fixed', true
WHERE NOT EXISTS (
  SELECT 1 FROM pay_groups WHERE pay_schedule = 'weekly'
);

INSERT INTO pay_groups (name, description, pay_schedule, wage_type, active)
SELECT 'Bi-weekly Staff', 'Default group for bi-weekly-paid employees', 'bi_weekly', 'fixed', true
WHERE NOT EXISTS (
  SELECT 1 FROM pay_groups WHERE pay_schedule = 'bi_weekly'
);

INSERT INTO pay_groups (name, description, pay_schedule, wage_type, active)
SELECT 'Semi-monthly Staff', 'Default group for semi-monthly-paid employees', 'semi_monthly', 'fixed', true
WHERE NOT EXISTS (
  SELECT 1 FROM pay_groups WHERE pay_schedule = 'semi_monthly'
);

INSERT INTO pay_groups (name, description, pay_schedule, wage_type, active)
SELECT 'Monthly Staff', 'Default group for monthly-paid employees', 'monthly', 'fixed', true
WHERE NOT EXISTS (
  SELECT 1 FROM pay_groups WHERE pay_schedule = 'monthly'
);
-- Add layout_json to pay_templates so editors can persist drag-and-drop block layouts
ALTER TABLE pay_templates ADD COLUMN IF NOT EXISTS layout_json jsonb DEFAULT NULL;

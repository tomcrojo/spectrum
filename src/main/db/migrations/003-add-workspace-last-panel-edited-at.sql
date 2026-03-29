ALTER TABLE workspaces ADD COLUMN last_panel_edited_at TEXT;

UPDATE workspaces
SET last_panel_edited_at = updated_at
WHERE last_panel_edited_at IS NULL;

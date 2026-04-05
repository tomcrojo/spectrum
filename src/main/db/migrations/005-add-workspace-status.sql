ALTER TABLE workspaces ADD COLUMN status TEXT NOT NULL DEFAULT 'active';

UPDATE workspaces
SET status = CASE
  WHEN archived = 1 THEN 'archived'
  ELSE 'active'
END
WHERE status IS NULL
   OR status NOT IN ('active', 'saved', 'archived');

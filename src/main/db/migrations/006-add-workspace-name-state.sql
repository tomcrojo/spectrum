ALTER TABLE workspaces ADD COLUMN name_source TEXT NOT NULL DEFAULT 'default';

ALTER TABLE workspaces ADD COLUMN has_auto_renamed INTEGER NOT NULL DEFAULT 0;

UPDATE workspaces
SET name_source = CASE
  WHEN name GLOB 'Workspace [0-9]*' THEN 'default'
  ELSE 'user'
END
WHERE name_source IS NULL
   OR name_source NOT IN ('default', 'auto', 'user');

UPDATE workspaces
SET has_auto_renamed = 0
WHERE has_auto_renamed IS NULL;

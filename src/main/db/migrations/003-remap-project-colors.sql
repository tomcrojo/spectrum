UPDATE projects
SET color = CASE color
  WHEN 'slate' THEN 'graphite'
  WHEN 'red' THEN 'flag-red'
  WHEN 'orange' THEN 'persimmon'
  WHEN 'amber' THEN 'gilded-honey'
  WHEN 'emerald' THEN 'lagoon'
  WHEN 'teal' THEN 'verdigris'
  WHEN 'cyan' THEN 'sea-glass'
  WHEN 'sky' THEN 'steel-blue'
  WHEN 'blue' THEN 'cobalt-glow'
  WHEN 'indigo' THEN 'indigo-night'
  WHEN 'violet' THEN 'violet-haze'
  WHEN 'purple' THEN 'midnight-plum'
  WHEN 'fuchsia' THEN 'neon-orchid'
  WHEN 'pink' THEN 'wild-rose'
  WHEN 'rose' THEN 'rose-dust'
  ELSE color
END
WHERE color IN (
  'slate', 'red', 'orange', 'amber', 'emerald', 'teal', 'cyan',
  'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose'
);

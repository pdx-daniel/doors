-- Upgrade path for databases created before person_aliases was renamed to person_links.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'person_aliases'
  ) THEN
    ALTER TABLE person_aliases RENAME TO person_links;
    ALTER INDEX idx_person_aliases_person_id RENAME TO idx_person_links_person_id;
    ALTER INDEX idx_person_aliases_workspace_id RENAME TO idx_person_links_workspace_id;
  END IF;
END $$;

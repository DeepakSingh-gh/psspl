-- Revisions commit/rollback atomically with every writer, including future imports.
CREATE TABLE IF NOT EXISTS pipeline_owner_revisions (
  user_id TEXT PRIMARY KEY,
  revision INTEGER NOT NULL DEFAULT 0
);
CREATE TRIGGER IF NOT EXISTS pipeline_lead_insert AFTER INSERT ON leads BEGIN
  INSERT INTO pipeline_owner_revisions(user_id,revision) VALUES(NEW.user_id,1)
  ON CONFLICT(user_id) DO UPDATE SET revision=revision+1;
END;
CREATE TRIGGER IF NOT EXISTS pipeline_lead_update AFTER UPDATE ON leads BEGIN
  INSERT INTO pipeline_owner_revisions(user_id,revision) VALUES(OLD.user_id,1)
  ON CONFLICT(user_id) DO UPDATE SET revision=revision+1;
  INSERT INTO pipeline_owner_revisions(user_id,revision) SELECT NEW.user_id,1 WHERE NEW.user_id<>OLD.user_id
  ON CONFLICT(user_id) DO UPDATE SET revision=revision+1;
END;
CREATE TRIGGER IF NOT EXISTS pipeline_lead_delete AFTER DELETE ON leads BEGIN
  INSERT INTO pipeline_owner_revisions(user_id,revision) VALUES(OLD.user_id,1)
  ON CONFLICT(user_id) DO UPDATE SET revision=revision+1;
END;
CREATE TRIGGER IF NOT EXISTS pipeline_profile_update AFTER UPDATE OF full_name,manager_user_id ON salesperson_profiles BEGIN
  INSERT INTO pipeline_owner_revisions(user_id,revision) VALUES(NEW.user_id,1)
  ON CONFLICT(user_id) DO UPDATE SET revision=revision+1;
END;
CREATE TRIGGER IF NOT EXISTS pipeline_user_update AFTER UPDATE OF email,role,active ON users BEGIN
  INSERT INTO pipeline_owner_revisions(user_id,revision) VALUES(NEW.id,1)
  ON CONFLICT(user_id) DO UPDATE SET revision=revision+1;
END;

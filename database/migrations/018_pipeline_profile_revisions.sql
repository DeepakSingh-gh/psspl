-- Separate additive upgrade also covers a running local API that already
-- applied 017 while the synchronization implementation was being developed.
CREATE TRIGGER IF NOT EXISTS pipeline_profile_insert AFTER INSERT ON salesperson_profiles BEGIN
  INSERT INTO pipeline_owner_revisions(user_id,revision) VALUES(NEW.user_id,1)
  ON CONFLICT(user_id) DO UPDATE SET revision=revision+1;
END;
CREATE TRIGGER IF NOT EXISTS pipeline_profile_delete AFTER DELETE ON salesperson_profiles BEGIN
  INSERT INTO pipeline_owner_revisions(user_id,revision) VALUES(OLD.user_id,1)
  ON CONFLICT(user_id) DO UPDATE SET revision=revision+1;
END;

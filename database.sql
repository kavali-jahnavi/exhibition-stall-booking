-- SQLite
INSERT INTO admins (username, password)
VALUES ("admin","admin123");

CREATE TABLE IF NOT EXISTS stall_owners(
      owner_id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT,
      password TEXT,
      stall_id INTEGER
      );

      ALTER TABLE stalls ADD COLUMN description TEXT;
      ALTER TABLE stalls ADD COLUMN offers TEXT;
      ALTER TABLE stalls ADD COLUMN image TEXT;
      ALTER TABLE stalls ADD COLUMN owner_id INTEGER;

INSERT INTO stall_owners (owner_name,email,password,stall_id)
VALUES ("burgerhub","burger@fest.com","123",6);

UPDATE stall_owners
SET owner_name = "toykingdom"
WHERE stall_id = 6;

import sqlite3

connection = sqlite3.connect("stalls.db")
cursor = connection.cursor()

cursor.execute("""
CREATE TABLE IF NOT EXISTS stalls (
    stall_id INTEGER PRIMARY KEY,
    stall_name TEXT,
    category TEXT,
    status TEXT,
    description TEXT,
    offers TEXT,
    image TEXT,
    owner_id INTEGER
)
""")

cursor.execute("""
CREATE TABLE IF NOT EXISTS admins (
    admin_id INTEGER PRIMARY KEY,
    username TEXT,
    password TEXT
)
""")

cursor.execute("""
CREATE TABLE IF NOT EXISTS stall_owners (
    owner_id INTEGER PRIMARY KEY,
    owner_name TEXT,
    email TEXT,
    password TEXT,
    stall_id INTEGER
)
""")

cursor.execute("INSERT INTO admins (username,password) VALUES (?,?)", ("admin","admin123"))

connection.commit()
connection.close()

print("Database ready!")
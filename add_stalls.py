import sqlite3

connection = sqlite3.connect("stalls.db")
cursor = connection.cursor()

# Clear old data (optional but useful for testing)
cursor.execute("DELETE FROM stalls")

stalls = []

for i in range(1, 26):
    stalls.append((
        i,
        f"Stall {i}",
        "General",
        "available",
        None,
        None,
        None,
        None
    ))

cursor.executemany(
"INSERT INTO stalls VALUES (?,?,?,?,?,?,?,?)",
stalls
)

connection.commit()
connection.close()

print("25 stalls added successfully")
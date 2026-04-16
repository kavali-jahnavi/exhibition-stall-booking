import sqlite3
import random

connection = sqlite3.connect("stalls.db")
cursor = connection.cursor()

# -------------------------
# Clear old data
# -------------------------

cursor.execute("DELETE FROM stalls")
cursor.execute("DELETE FROM stall_owners")


# -------------------------
# Stall Status Distribution
# -------------------------

status_list = (
    ["booked"] * 15 +
    ["available"] * 8 +
    ["maintenance"] * 2
)

random.shuffle(status_list)


# -------------------------
# Stall Names
# -------------------------

stall_names = [
"Burger Hub","Game Arena","Fashion Street","Pizza Corner","Drink Zone",
"Ice Cream World","Art Gallery","Toy Kingdom","Coffee Bar","Street Food",
"Game Booth","Book Store","Chocolate House","Music Store","Gadget Shop",
"Handmade Crafts","Snack Shack","Juice Bar","Shoe Store","Gift Corner",
"Watch Store","Photo Booth","Tech World","Dessert House","BBQ Grill"
]


# -------------------------
# Categories
# -------------------------

categories = ["Food","Games","Fashion","Arts"]


# -------------------------
# Insert Stalls
# -------------------------

stalls_data = []

for i in range(25):

    stall_id = i + 1
    name = stall_names[i]
    category = random.choice(categories)
    status = status_list[i]

    description = "Popular stall at Fusion Fest"
    offers = "Festival Discount"
    image = None
    owner_id = None

    stalls_data.append(
        (stall_id,name,category,status,description,offers,image,owner_id)
    )


cursor.executemany(
"INSERT INTO stalls VALUES (?,?,?,?,?,?,?,?)",
stalls_data
)


# -------------------------
# Create Owners for booked stalls
# -------------------------

owners = []

owner_id = 1

for stall in stalls_data:

    stall_id = stall[0]
    status = stall[3]

    if status == "booked":

        owner_name = stall[1]
        email = owner_name.replace(" ","").lower()+"@fest.com"
        password = "123"

        owners.append((owner_id,owner_name,email,password,stall_id))

        cursor.execute(
        "UPDATE stalls SET owner_id=? WHERE stall_id=?",
        (owner_id,stall_id)
        )

        owner_id += 1


cursor.executemany(
"INSERT INTO stall_owners VALUES (?,?,?,?,?)",
owners
)


# -------------------------
# Save
# -------------------------

connection.commit()
connection.close()

print("Demo data created successfully!")
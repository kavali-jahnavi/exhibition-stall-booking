import sqlite3

conn = sqlite3.connect("stalls.db")
cursor = conn.cursor()

image_map = {
    "Burger Hub": "burger.jpg",
    "Pizza Corner": "pizza.jpg",
    "Ice Cream World": "icecream.jpg",
    "Coffee Bar": "coffee.jpg",
    "Snack Shack": "snacks.jpg",
    "Street Food": "streetfood.jpg",
    "Fastfood": "fastfood.jpg",
    "BBQ Grill": "bbq_grill.jpg",
    "Chocolate House": "chocolate.jpg",
    "Juice Bar": "juice.jpg",
    "Momo corner": "momo.jpg",

    "Game Arena": "games.jpg",
    "Toy Kingdom": "toys.jpg",
    "Game Booth": "games.jpg",

    "Art Gallery": "art.jpg",
    "Handmade Crafts": "handmade_crafts.jpg",
    "Vintage paintings": "art.jpg",
    "Music Store": "music.jpg",
    "Book Store": "books.jpg",

    "Fashion Street": "fashion.jpg",
    "Saree": "saree.jpg",
    "Kurti store": "kurti.jpg",
    "Shoe Store": "shoe.jpg", 
    "Dessert House" : "icecream.jpg",
    "Drink Zone" : "juice.jpg"
}

for stall, image in image_map.items():
    cursor.execute(
        "UPDATE stalls SET image=? WHERE stall_name=?",
        (image, stall)
    )

conn.commit()
conn.close()

print("Images assigned correctly!")
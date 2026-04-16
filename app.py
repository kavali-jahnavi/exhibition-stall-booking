from flask import Flask, render_template, request, redirect, jsonify, session
import sqlite3
import os

app = Flask(__name__)

UPLOAD_FOLDER = "static/images/stalls"
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
app.secret_key = "fusionfest_secret"


# --------------------------------
# ENSURE booking_requests TABLE EXISTS
# --------------------------------
def init_db():
    conn = sqlite3.connect("stalls.db")
    conn.execute("""
        CREATE TABLE IF NOT EXISTS booking_requests (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            owner_id  INTEGER NOT NULL,
            stall_id  INTEGER NOT NULL,
            status    TEXT    NOT NULL DEFAULT 'pending'
        )
    """)
    conn.commit()
    conn.close()

init_db()


# --------------------------------
# HOME PAGE (Visitor Map)
# --------------------------------
@app.route("/")
def home():

    connection = sqlite3.connect("stalls.db", check_same_thread=False)
    cursor = connection.cursor()

    cursor.execute("SELECT * FROM stalls")
    stalls = cursor.fetchall()

    connection.close()

    return render_template("index.html", stalls=stalls)


# --------------------------------
# STALL DETAIL API (for modal)
# --------------------------------
@app.route("/api/stall/<int:stall_id>")
def stall_api(stall_id):

    connection = sqlite3.connect("stalls.db", check_same_thread=False)
    cursor = connection.cursor()

    cursor.execute("SELECT * FROM stalls WHERE stall_id=?", (stall_id,))
    stall = cursor.fetchone()

    connection.close()

    if not stall:
        return jsonify({"error": "Not found"}), 404

    return jsonify({
        "stall_id": stall[0],
        "stall_name": stall[1],
        "category": stall[2],
        "status": stall[3],
        "description": stall[4] or "",
        "offers": stall[5] or "",
        "image": stall[6] or ""
    })


# --------------------------------
# STALL DETAIL PAGE
# --------------------------------
@app.route("/stall/<int:stall_id>")
def stall_detail(stall_id):

    connection = sqlite3.connect("stalls.db", check_same_thread=False)
    cursor = connection.cursor()

    cursor.execute("SELECT * FROM stalls WHERE stall_id=?", (stall_id,))
    stall = cursor.fetchone()

    connection.close()

    return render_template("stall_detail.html", stall=stall)


# --------------------------------
# ADMIN LOGIN
# --------------------------------
@app.route("/admin/login", methods=["GET", "POST"])
def admin_login():

    if request.method == "POST":

        username = request.form["username"]
        password = request.form["password"]

        connection = sqlite3.connect("stalls.db", check_same_thread=False)
        cursor = connection.cursor()

        cursor.execute(
            "SELECT * FROM admins WHERE username=? AND password=?",
            (username, password)
        )

        admin = cursor.fetchone()

        connection.close()

        if admin:
            session["admin"] = username
            return redirect("/admin/dashboard")
        else:
            return render_template("admin_login.html", error="Invalid username or password")

    return render_template("admin_login.html")


# --------------------------------
# ADMIN DASHBOARD
# --------------------------------
@app.route("/admin/dashboard")
def admin_dashboard():

    if "admin" not in session:
        return redirect("/admin/login")

    connection = sqlite3.connect("stalls.db", check_same_thread=False)
    cursor = connection.cursor()

    search = request.args.get("search", "").strip()
    category = request.args.get("category", "all")
    status_filter = request.args.get("status", "all")

    query = "SELECT s.*, o.owner_name FROM stalls s LEFT JOIN stall_owners o ON s.owner_id = o.owner_id WHERE 1=1"
    params = []

    if search:
        query += " AND (s.stall_name LIKE ? OR CAST(s.stall_id AS TEXT) LIKE ?)"
        params += [f"%{search}%", f"%{search}%"]

    if category != "all":
        query += " AND s.category = ?"
        params.append(category)

    if status_filter != "all":
        query += " AND LOWER(s.status) = ?"
        params.append(status_filter.lower())

    cursor.execute(query, params)
    stalls = cursor.fetchall()

    # Compute stats
    cursor.execute("SELECT COUNT(*) FROM stalls")
    total = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM stalls WHERE LOWER(status) IN ('available','open')")
    available = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM stalls WHERE LOWER(status)='booked'")
    booked = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM stalls WHERE LOWER(status)='closed'")
    closed = cursor.fetchone()[0]

    # Pending booking requests
    cursor.execute("""
        SELECT br.id, o.owner_name, o.email, s.stall_id, s.stall_name, s.category
        FROM booking_requests br
        JOIN stall_owners o ON br.owner_id = o.owner_id
        JOIN stalls s ON br.stall_id = s.stall_id
        WHERE br.status = 'pending'
        ORDER BY br.id
    """)
    pending_requests = cursor.fetchall()

    connection.close()

    return render_template("admin_dashboard.html", stalls=stalls,
                           search=search, category=category, status_filter=status_filter,
                           total=total, available=available, booked=booked, closed=closed,
                           pending_requests=pending_requests)


# --------------------------------
# ADMIN CHANGE STATUS (AJAX)
# --------------------------------
@app.route("/admin/change_status/<int:stall_id>", methods=["POST"])
def change_status(stall_id):

    if "admin" not in session:
        return jsonify({"error": "Unauthorized"}), 401

    new_status = request.form.get("status", "").strip()
    # Normalize to lowercase for consistent DB storage
    new_status_lower = new_status.lower()

    connection = sqlite3.connect("stalls.db", check_same_thread=False)
    cursor = connection.cursor()

    # Fetch current owner before any update
    cursor.execute("SELECT owner_id FROM stalls WHERE stall_id=?", (stall_id,))
    row = cursor.fetchone()
    current_owner_id = row[0] if row else None

    if new_status_lower == "available":
        # Clear booking link when marking available
        if current_owner_id:
            cursor.execute("UPDATE stall_owners SET stall_id=NULL WHERE owner_id=?", (current_owner_id,))
        cursor.execute("UPDATE stalls SET status=?, owner_id=NULL WHERE stall_id=?", (new_status_lower, stall_id))
    else:
        cursor.execute("UPDATE stalls SET status=? WHERE stall_id=?", (new_status_lower, stall_id))

    connection.commit()

    # Return whether a booking link exists after update (for dashboard button toggle)
    cursor.execute("SELECT owner_id FROM stalls WHERE stall_id=?", (stall_id,))
    updated = cursor.fetchone()
    has_owner = bool(updated and updated[0])

    connection.close()
    return jsonify({"success": True, "status": new_status_lower, "has_owner": has_owner})


# --------------------------------
# ADMIN REMOVE BOOKING
# --------------------------------
@app.route("/admin/remove_booking/<int:stall_id>", methods=["POST"])
def remove_booking(stall_id):

    if "admin" not in session:
        return jsonify({"error": "Unauthorized"}), 401

    connection = sqlite3.connect("stalls.db", check_same_thread=False)
    cursor = connection.cursor()

    # Get owner_id linked to this stall
    cursor.execute("SELECT owner_id FROM stalls WHERE stall_id=?", (stall_id,))
    row = cursor.fetchone()

    if row and row[0]:
        # Clear stall_id from owner record
        cursor.execute("UPDATE stall_owners SET stall_id=NULL WHERE owner_id=?", (row[0],))

    # Clear owner from stall and set available
    cursor.execute("UPDATE stalls SET owner_id=NULL, status='available' WHERE stall_id=?", (stall_id,))
    connection.commit()
    connection.close()
    return jsonify({"success": True})


# --------------------------------
# ADMIN APPROVE BOOKING REQUEST
# --------------------------------
@app.route("/admin/approve_request/<int:req_id>", methods=["POST"])
def approve_request(req_id):

    if "admin" not in session:
        return jsonify({"error": "Unauthorized"}), 401

    conn = sqlite3.connect("stalls.db")
    cursor = conn.cursor()

    cursor.execute("SELECT owner_id, stall_id FROM booking_requests WHERE id=? AND status='pending'", (req_id,))
    req = cursor.fetchone()

    if not req:
        conn.close()
        return jsonify({"error": "Request not found or already processed"}), 404

    owner_id, stall_id = req

    # Approve: assign stall, mark booked
    cursor.execute("UPDATE stalls SET owner_id=?, status='booked' WHERE stall_id=?", (owner_id, stall_id))
    cursor.execute("UPDATE stall_owners SET stall_id=? WHERE owner_id=?", (stall_id, owner_id))
    cursor.execute("UPDATE booking_requests SET status='approved' WHERE id=?", (req_id,))
    conn.commit()
    conn.close()
    return jsonify({"success": True})


# --------------------------------
# ADMIN REJECT BOOKING REQUEST
# --------------------------------
@app.route("/admin/reject_request/<int:req_id>", methods=["POST"])
def reject_request(req_id):

    if "admin" not in session:
        return jsonify({"error": "Unauthorized"}), 401

    conn = sqlite3.connect("stalls.db")
    cursor = conn.cursor()

    cursor.execute("UPDATE booking_requests SET status='rejected' WHERE id=? AND status='pending'", (req_id,))
    conn.commit()
    conn.close()
    return jsonify({"success": True})


# --------------------------------
# ADMIN LOGOUT
# --------------------------------
@app.route("/admin/logout")
def admin_logout():
    session.pop("admin", None)
    return redirect("/admin/login")


# --------------------------------
# EDIT STALL
# --------------------------------
@app.route("/admin/edit_stall/<int:stall_id>", methods=["GET", "POST"])
def edit_stall(stall_id):

    connection = sqlite3.connect("stalls.db", check_same_thread=False)
    cursor = connection.cursor()

    if request.method == "POST":

        name     = request.form["name"]
        category = request.form["category"]
        status   = request.form["status"].strip().lower()  # normalize to lowercase

        # Fetch current owner before update
        cursor.execute("SELECT owner_id FROM stalls WHERE stall_id=?", (stall_id,))
        row = cursor.fetchone()
        current_owner_id = row[0] if row else None

        cursor.execute("""
        UPDATE stalls
        SET stall_name=?, category=?, status=?
        WHERE stall_id=?
        """, (name, category, status, stall_id))

        # If setting to available, clear the booking link
        if status == "available":
            if current_owner_id:
                cursor.execute("UPDATE stall_owners SET stall_id=NULL WHERE owner_id=?", (current_owner_id,))
            cursor.execute("UPDATE stalls SET owner_id=NULL WHERE stall_id=?", (stall_id,))

        connection.commit()
        connection.close()
        return redirect("/admin/dashboard")

    cursor.execute("SELECT * FROM stalls WHERE stall_id=?", (stall_id,))
    stall = cursor.fetchone()

    connection.close()

    return render_template("edit_stall.html", stall=stall)


# --------------------------------
# OWNER LOGIN
# --------------------------------
@app.route("/owner/login", methods=["GET", "POST"])
def owner_login():

    if request.method == "POST":

        username = request.form["username"]
        password = request.form["password"]

        connection = sqlite3.connect("stalls.db", check_same_thread=False)
        cursor = connection.cursor()

        cursor.execute(
            "SELECT * FROM stall_owners WHERE owner_name=? AND password=?",
            (username, password)
        )

        owner = cursor.fetchone()

        connection.close()

        if owner:
            session["owner_id"] = owner[0]
            session["owner_name"] = owner[1]
            stall_id = owner[4]
            if stall_id:
                return redirect(f"/owner/dashboard/{stall_id}")
            else:
                return redirect("/owner/book")
        else:
            return render_template("owner_login.html", error="Invalid login")

    return render_template("owner_login.html")


# --------------------------------
# OWNER REGISTER
# --------------------------------
@app.route("/owner/register", methods=["GET", "POST"])
def owner_register():

    if request.method == "POST":

        name = request.form["owner_name"]
        email = request.form["email"]
        password = request.form["password"]

        connection = sqlite3.connect("stalls.db", check_same_thread=False)
        cursor = connection.cursor()

        # Check duplicate email
        cursor.execute("SELECT * FROM stall_owners WHERE email=?", (email,))
        if cursor.fetchone():
            connection.close()
            return render_template("register.html", error="Email already registered")

        cursor.execute(
            "INSERT INTO stall_owners (owner_name, email, password, stall_id) VALUES (?,?,?,NULL)",
            (name, email, password)
        )
        connection.commit()
        owner_id = cursor.lastrowid
        connection.close()

        session["owner_id"] = owner_id
        session["owner_name"] = name
        return redirect("/owner/book")

    return render_template("register.html")


# --------------------------------
# OWNER BOOK STALL
# --------------------------------
@app.route("/owner/book", methods=["GET", "POST"])
def owner_book():

    if "owner_id" not in session:
        return redirect("/owner/login")

    owner_id = session["owner_id"]
    connection = sqlite3.connect("stalls.db", check_same_thread=False)
    cursor = connection.cursor()

    # Check if owner already has a stall
    cursor.execute("SELECT stall_id FROM stall_owners WHERE owner_id=?", (owner_id,))
    row = cursor.fetchone()
    if row and row[0]:
        connection.close()
        return redirect(f"/owner/dashboard/{row[0]}")

    # Check if owner already has a pending request
    cursor.execute("SELECT id FROM booking_requests WHERE owner_id=? AND status='pending'", (owner_id,))
    if cursor.fetchone():
        connection.close()
        return render_template("book_stall.html", stalls=[], pending=True)

    if request.method == "POST":
        stall_id = int(request.form["stall_id"])

        # Stall must be available and not already requested
        cursor.execute("SELECT status, owner_id FROM stalls WHERE stall_id=?", (stall_id,))
        stall = cursor.fetchone()

        if not stall or stall[1] is not None or stall[0].lower() not in ("available", "open"):
            connection.close()
            return render_template("book_stall.html", error="Stall is no longer available", stalls=[])

        # Check no pending request already exists for this stall
        cursor.execute("SELECT id FROM booking_requests WHERE stall_id=? AND status='pending'", (stall_id,))
        if cursor.fetchone():
            connection.close()
            return render_template("book_stall.html", error="This stall already has a pending request", stalls=[])

        # Create booking request — do NOT change stall status yet
        cursor.execute(
            "INSERT INTO booking_requests (owner_id, stall_id, status) VALUES (?,?,'pending')",
            (owner_id, stall_id)
        )
        connection.commit()
        connection.close()
        return render_template("book_stall.html", stalls=[], pending=True)

    # Get available stalls — case-insensitive match
    cursor.execute("""
        SELECT stall_id, stall_name, category, image
        FROM stalls
        WHERE LOWER(status) IN ('available', 'open')
        AND (owner_id IS NULL OR owner_id = '')
        ORDER BY stall_id
    """)
    available_stalls = cursor.fetchall()
    print(f"[DEBUG] Available stalls found: {len(available_stalls)} → {[(s[0], s[1], s[2]) for s in available_stalls]}")
    connection.close()

    return render_template("book_stall.html", stalls=available_stalls)


# --------------------------------
# OWNER LOGOUT
# --------------------------------
@app.route("/owner/logout")
def owner_logout():
    session.pop("owner_id", None)
    session.pop("owner_name", None)
    return redirect("/owner/login")


# --------------------------------
# OWNER DASHBOARD
# --------------------------------
@app.route("/owner/dashboard/<int:stall_id>", methods=["GET","POST"])
def owner_dashboard(stall_id):

    if "owner_id" not in session:
        return redirect("/owner/login")

    conn = sqlite3.connect("stalls.db")
    cursor = conn.cursor()

    if request.method == "POST":

        description = request.form.get("description", "")
        offers = request.form.get("offers", "")
        image = request.files.get("image")

        if image and image.filename:
            filename = image.filename
            image.save(os.path.join(app.config["UPLOAD_FOLDER"], filename))
            cursor.execute("""
            UPDATE stalls SET description=?, offers=?, image=? WHERE stall_id=?
            """, (description, offers, filename, stall_id))
        else:
            cursor.execute("""
            UPDATE stalls SET description=?, offers=? WHERE stall_id=?
            """, (description, offers, stall_id))

        conn.commit()

    cursor.execute("SELECT * FROM stalls WHERE stall_id=?", (stall_id,))
    stall = cursor.fetchone()

    conn.close()

    return render_template("owner_dashboard.html", stall=stall)

# --------------------------------
# RUN SERVER
# --------------------------------
if __name__ == "__main__":
    app.run(debug=True)
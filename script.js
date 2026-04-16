// =============================================================
//  FUSION FEST 2026 — Navigation, Search, Modal, Popup
// =============================================================

// ---- HOVER POPUP ----

function showPopup(event, name, category, status, image) {
    let popup = document.getElementById("stallPopup")
    let img = ""
    if (image && image !== "None" && image !== "null" && image !== "") {
        img = `<br><img src="/static/images/stalls/${image}" width="80">`
    }
    popup.innerHTML = `<strong>${name}</strong><br>Category: ${category}<br>Status: ${status}${img}`
    popup.style.display = "block"
    popup.style.left = (event.clientX + 15) + "px"
    popup.style.top  = (event.clientY + 15) + "px"
}

function hidePopup() {
    document.getElementById("stallPopup").style.display = "none"
}


// ---- SEARCH & FILTER ----

function searchStalls() {
    let searchInput = document.getElementById("stallSearch").value.toLowerCase().trim()
    let category    = document.getElementById("categoryFilter").value  // lowercase: "food","games","fashion","art","all"

    if (searchInput === "" && category === "all") {
        resetSearch()
        return
    }

    let anyMatch = false
    document.querySelectorAll(".stall").forEach(stall => {
        let name    = stall.dataset.name.toLowerCase()
        let catRaw  = stall.dataset.category.toLowerCase()  // normalize to lowercase
        // "art" filter matches both "art" and "arts"
        let catNorm = catRaw.startsWith("art") ? "art" : catRaw
        stall.classList.remove("highlight", "dim")

        let nameMatch     = searchInput === "" || name.includes(searchInput)
        let categoryMatch = category === "all"  || catNorm === category

        if (nameMatch && categoryMatch) {
            stall.classList.add("highlight")
            anyMatch = true
        } else {
            stall.classList.add("dim")
        }
    })

    // Show empty state
    let emptyMsg = document.getElementById("searchEmptyMsg")
    if (emptyMsg) emptyMsg.style.display = anyMatch ? "none" : "block"
}

function resetSearch() {
    document.querySelectorAll(".stall").forEach(s => s.classList.remove("highlight", "dim"))
    document.getElementById("stallSearch").value    = ""
    document.getElementById("categoryFilter").value = "all"
    let emptyMsg = document.getElementById("searchEmptyMsg")
    if (emptyMsg) emptyMsg.style.display = "none"
}


// =============================================================
//  NAVIGATION — DOM-measured walkway coordinates
// =============================================================

/*
  STRATEGY:
  Instead of a BFS grid with assumed pixel sizes, we:
  1. Measure the actual pixel positions of all 25 stall divs
  2. Derive the exact X positions of the 6 vertical walkway lanes
     (left-outer, gap01, gap12, gap23, gap34, right-outer)
  3. Derive the exact Y positions of the 6 horizontal walkway lanes
     (top-outer, gap01, gap12, gap23, gap34, bottom-outer)
  4. Build a simple L-shaped (or Z-shaped) path using ONLY those
     walkway coordinates — never touching a stall bounding box.

  Walkway lane indices (0–5):
    colLane[0] = left outer border X
    colLane[1] = gap between stall-col 1 and 2
    colLane[2] = gap between stall-col 2 and 3
    colLane[3] = gap between stall-col 3 and 4
    colLane[4] = gap between stall-col 4 and 5
    colLane[5] = right outer border X

    rowLane[0] = top outer border Y
    rowLane[1] = gap between stall-row 1 and 2
    rowLane[2] = gap between stall-row 2 and 3
    rowLane[3] = gap between stall-row 3 and 4
    rowLane[4] = gap between stall-row 4 and 5
    rowLane[5] = bottom outer border Y

  Gate entry points:
    North → (colLane[2], rowLane[0])   ← center-ish top
    South → (colLane[2], rowLane[5])
    West  → (colLane[0], rowLane[2])
    East  → (colLane[5], rowLane[2])

  For each stall (row r, col c, 0-indexed):
    The stall is "entered" from the nearest walkway lane.
    Stop point = center of the gap lane adjacent to the stall.
*/

function getWalkwayCoords(mapEl) {
    let mapRect = mapEl.getBoundingClientRect()

    // Collect all 25 stall rects relative to map
    let stalls = []
    for (let i = 1; i <= 25; i++) {
        let el = document.getElementById("stall" + i)
        if (!el) { stalls.push(null); continue }
        let r = el.getBoundingClientRect()
        stalls.push({
            left:   r.left   - mapRect.left,
            right:  r.right  - mapRect.left,
            top:    r.top    - mapRect.top,
            bottom: r.bottom - mapRect.top,
            cx:     r.left   - mapRect.left + r.width  / 2,
            cy:     r.top    - mapRect.top  + r.height / 2
        })
    }

    // Row 0 stalls: S1–S5 (indices 0–4)
    // Row 1 stalls: S6–S10 (indices 5–9)  etc.
    // Col 0 stalls: S1,S6,S11,S16,S21 (indices 0,5,10,15,20)

    // Vertical walkway lanes (X coordinates)
    // colLane[0] = midpoint between map left edge and stall-col-0 left edge
    // colLane[k] = midpoint between stall-col-(k-1) right and stall-col-k left  (k=1..4)
    // colLane[5] = midpoint between stall-col-4 right and map right edge

    let colLane = []
    // col 0 stalls: indices 0,5,10,15,20
    let col0Left  = stalls[0]  ? stalls[0].left  : 80
    let col4Right = stalls[4]  ? stalls[4].right : mapRect.width - 80

    colLane[0] = col0Left / 2   // left outer lane

    for (let c = 0; c < 4; c++) {
        // gap between col c and col c+1
        let rightEdge = stalls[c]     ? stalls[c].right : 0
        let leftEdge  = stalls[c + 1] ? stalls[c + 1].left : 0
        colLane[c + 1] = (rightEdge + leftEdge) / 2
    }

    colLane[5] = (col4Right + mapRect.width) / 2   // right outer lane

    // Horizontal walkway lanes (Y coordinates)
    // row 0 stalls: indices 0–4
    let row0Top    = stalls[0]  ? stalls[0].top    : 80
    let row4Bottom = stalls[20] ? stalls[20].bottom : mapRect.height - 80

    rowLane = []
    rowLane[0] = row0Top / 2   // top outer lane

    for (let r = 0; r < 4; r++) {
        let bottomEdge = stalls[r * 5]       ? stalls[r * 5].bottom     : 0
        let topEdge    = stalls[(r + 1) * 5] ? stalls[(r + 1) * 5].top  : 0
        rowLane[r + 1] = (bottomEdge + topEdge) / 2
    }

    rowLane[5] = (row4Bottom + mapRect.height) / 2   // bottom outer lane

    return { colLane, rowLane, stalls, mapRect }
}

// Given stall ID (1-25), return its grid row/col (0-indexed)
function stallRowCol(stallId) {
    let idx = stallId - 1
    return { row: Math.floor(idx / 5), col: idx % 5 }
}

// Remove consecutive duplicate/near-duplicate points
function dedup(pts) {
    let out = [pts[0]]
    for (let i = 1; i < pts.length; i++) {
        let prev = out[out.length - 1]
        if (Math.abs(pts[i].x - prev.x) > 2 || Math.abs(pts[i].y - prev.y) > 2) {
            out.push(pts[i])
        }
    }
    return out
}

function navigateToStall(stallId) {
    let gate = document.getElementById("entryGate").value

    document.querySelectorAll(".stall").forEach(s => s.classList.remove("highlight-stall"))
    document.querySelectorAll(".gate").forEach(g => g.classList.remove("highlight-gate"))
    let stallEl = document.getElementById("stall" + stallId)
    if (!stallEl) return
    stallEl.classList.add("highlight-stall")
    document.getElementById(gate + "Gate").classList.add("highlight-gate")

    showRouteInfo(stallId, gate, stallEl.dataset.name)

    showNavLoading(() => {
        let mapEl = document.querySelector(".map-container")
        let { colLane, rowLane, mapRect } = getWalkwayCoords(mapEl)
        let { row: sRow, col: sCol } = stallRowCol(stallId)

        /*
         ROUTING STRATEGY — clean L-shape, always ends with correct approach direction.

         Gate entry points:
           north → (colLane[2], rowLane[0])  — enters from top
           south → (colLane[2], rowLane[5])  — enters from bottom
           west  → (colLane[0], rowLane[2])  — enters from left
           east  → (colLane[5], rowLane[2])  — enters from right

         For north/south gates: path must end with a VERTICAL segment into the stall.
           - colGap = colLane[sCol] or colLane[sCol+1], whichever is closer to gX
           - rowGap = rowLane[sRow] (above stall, for north) or rowLane[sRow+1] (below, for south)
           - Route: gate → {gX, rowGap} → {colGap, rowGap}
           - drawSVGPath snaps last point to stall top/bottom edge (horizontal approach → left/right snap)
           - BUT we need vertical approach for top/bottom entry, so add one more point:
             {colGap, rowGap} is the turn; then drawSVGPath snaps from there vertically.
           - Actually: last segment is horizontal → snap goes to stall left/right at stallCY.
             To get vertical snap, make last segment vertical:
             pts = [gate, {colGap, gY}, {colGap, rowGap}]  — horizontal first, then vertical

         For west/east gates: path must end with a HORIZONTAL segment into the stall.
           - rowGap = rowLane[sRow] or rowLane[sRow+1], whichever is closer to gY
           - colGap = colLane[sCol] (left of stall, for west) or colLane[sCol+1] (right, for east)
           - Route: gate → {colGap, gY} → {colGap, rowGap}  — horizontal first, then vertical
           - Last segment is vertical → snap goes to stall top/bottom at stallCX.
           - To get horizontal snap, make last segment horizontal:
             pts = [gate, {gX, rowGap}, {colGap, rowGap}]  — vertical first, then horizontal

         Summary:
           north/south: vertical first (gate→turn), then horizontal to colGap
             pts = [{gX,gY}, {gX,rowGap}, {colGap,rowGap}]
             last segment horizontal → snaps to stall left/right edge ✓

           west/east: horizontal first (gate→turn), then vertical to rowGap
             pts = [{gX,gY}, {colGap,gY}, {colGap,rowGap}]
             last segment vertical → snaps to stall top/bottom edge ✓
        */

        let gX, gY
        if (gate === "north") { gX = colLane[2]; gY = rowLane[0] }
        if (gate === "south") { gX = colLane[2]; gY = rowLane[5] }
        if (gate === "west")  { gX = colLane[0]; gY = rowLane[2] }
        if (gate === "east")  { gX = colLane[5]; gY = rowLane[2] }

        let colGap, rowGap

        if (gate === "north" || gate === "south") {
            // Vertical first: gate moves down/up to stall's row gap
            rowGap = (gate === "north") ? rowLane[sRow] : rowLane[sRow + 1]
            // Pick col gap closest to gate X
            let dL = Math.abs(gX - colLane[sCol])
            let dR = Math.abs(gX - colLane[sCol + 1])
            colGap = dL <= dR ? colLane[sCol] : colLane[sCol + 1]
            // pts: gate → turn at (gX, rowGap) → end at (colGap, rowGap)
            // Last segment is horizontal → drawSVGPath snaps to stall left/right edge
        } else {
            // Horizontal first: gate moves right/left to stall's col gap
            colGap = (gate === "west") ? colLane[sCol] : colLane[sCol + 1]
            // Pick row gap closest to gate Y
            let dT = Math.abs(gY - rowLane[sRow])
            let dB = Math.abs(gY - rowLane[sRow + 1])
            rowGap = dT <= dB ? rowLane[sRow] : rowLane[sRow + 1]
            // pts: gate → turn at (colGap, gY) → end at (colGap, rowGap)
            // Last segment is vertical → drawSVGPath snaps to stall top/bottom edge
        }

        let pts
        if (gate === "north" || gate === "south") {
            pts = [
                { x: gX,     y: gY     },   // gate entry
                { x: gX,     y: rowGap },   // move vertically to stall's row gap
                { x: colGap, y: rowGap },   // turn horizontally to stall's col gap
            ]
        } else {
            pts = [
                { x: gX,     y: gY     },   // gate entry
                { x: colGap, y: gY     },   // move horizontally to stall's col gap
                { x: colGap, y: rowGap },   // turn vertically to stall's row gap
            ]
        }

        let finalPts = dedup(pts)

        // Fallback: if stall is directly in line with gate (degenerate path),
        // draw a straight line from gate to stall center
        if (finalPts.length < 2) {
            let sr = stallEl.getBoundingClientRect()
            let sCX = sr.left - mapRect.left + sr.width  / 2
            let sCY = sr.top  - mapRect.top  + sr.height / 2
            finalPts = [{ x: gX, y: gY }, { x: sCX, y: sCY }]
        }

        drawSVGPath(finalPts, mapRect, stallEl)
        stallEl.scrollIntoView({ behavior: "smooth", block: "center" })

        // Enable reset button now that navigation is active
        let resetBtn = document.getElementById("resetNavBtn")
        if (resetBtn) resetBtn.disabled = false
    })
}


function resetNavigation() {
    // Clear SVG path
    let container = document.getElementById("pathContainer")
    if (container) {
        container.style.opacity = "0"
        container.style.transition = "opacity 0.3s ease"
        setTimeout(() => {
            container.innerHTML = ""
            container.style.opacity = "1"
        }, 300)
    }

    // Remove stall and gate highlights
    document.querySelectorAll(".stall").forEach(s => s.classList.remove("highlight-stall"))
    document.querySelectorAll(".gate").forEach(g => g.classList.remove("highlight-gate"))

    // Hide route info and loading bars
    let routeBar = document.getElementById("routeInfoBar")
    if (routeBar) routeBar.style.display = "none"
    let loadingBar = document.getElementById("navLoadingBar")
    if (loadingBar) loadingBar.style.display = "none"

    // Disable reset button
    let resetBtn = document.getElementById("resetNavBtn")
    if (resetBtn) resetBtn.disabled = true

    // Show toast
    showToast("Navigation reset")
}

function toggleActiveOnly() {
    let on = document.getElementById("activeOnlyToggle").checked
    document.querySelectorAll(".stall").forEach(stall => {
        let status = (stall.dataset.status || "").toLowerCase()
        if (status !== "booked") {
            stall.classList.toggle("inactive-hidden", on)
        }
    })
    // If active navigation is on a now-hidden stall, reset it
    if (on) {
        let highlighted = document.querySelector(".stall.highlight-stall")
        if (highlighted) {
            let status = (highlighted.dataset.status || "").toLowerCase()
            if (status !== "booked") resetNavigation()
        }
    }
}

function showToast(msg) {
    let toast = document.getElementById("navToast")
    if (!toast) {
        toast = document.createElement("div")
        toast.id = "navToast"
        toast.className = "nav-toast"
        document.body.appendChild(toast)
    }
    toast.textContent = msg
    toast.classList.add("show")
    clearTimeout(toast._timer)
    toast._timer = setTimeout(() => toast.classList.remove("show"), 2000)
}

function handleStallClick(event, stallId) {
    event.stopPropagation()
    let stallEl = document.getElementById("stall" + stallId)
    if (!stallEl) return

    // Block navigation for non-booked stalls
    let status = (stallEl.dataset.status || "").toLowerCase()
    if (status !== "booked") {
        showToast("This stall is not active yet")
        return
    }

    navigateToStall(stallId)
    openModal(stallId)
    playClickSound()
}


// ---- ROUTE INFO BAR ----

function showRouteInfo(stallId, gate, stallName) {
    let bar = document.getElementById("routeInfoBar")
    if (!bar) return
    let gateLabel = { north:"North Gate", south:"South Gate", west:"West Gate", east:"East Gate" }
    bar.innerHTML = `📍 Going to: <strong>S${stallId} — ${stallName}</strong> &nbsp;|&nbsp; 🚪 From: <strong>${gateLabel[gate]}</strong>`
    bar.style.display = "block"
}


// ---- LOADING INDICATOR ----

function showNavLoading(callback) {
    let bar = document.getElementById("navLoadingBar")
    if (bar) {
        bar.style.display = "block"
        setTimeout(() => {
            bar.style.display = "none"
            callback()
        }, 400)
    } else {
        callback()
    }
}


// ---- SVG PATH DRAWING ----

function drawSVGPath(points, mapRect, stallEl) {
    let container = document.getElementById("pathContainer")
    container.innerHTML = ""

    if (!points || points.length < 2) return

    // Snap the final point to the nearest edge of the stall
    // so the path visually ends exactly at the stall entrance, not in the gap center
    if (stallEl) {
        let sr = stallEl.getBoundingClientRect()
        let stallLeft   = sr.left   - mapRect.left
        let stallRight  = sr.right  - mapRect.left
        let stallTop    = sr.top    - mapRect.top
        let stallBottom = sr.bottom - mapRect.top
        let stallCX     = (stallLeft + stallRight)  / 2
        let stallCY     = (stallTop  + stallBottom) / 2

        let last = points[points.length - 1]
        let prev = points[points.length - 2]

        // Determine approach direction from prev → last
        let dx = last.x - prev.x
        let dy = last.y - prev.y

        let snapX, snapY

        if (Math.abs(dx) > Math.abs(dy)) {
            // Horizontal approach — snap to left or right edge, keep same Y as last point
            snapX = dx > 0 ? stallLeft  : stallRight
            snapY = last.y   // stay on the same horizontal line
        } else {
            // Vertical approach — snap to top or bottom edge, keep same X as last point
            snapX = last.x   // stay on the same vertical line
            snapY = dy > 0 ? stallTop : stallBottom
        }

        // Replace last point with snapped edge point
        points[points.length - 1] = { x: snapX, y: snapY }
    }

    let svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
    svg.setAttribute("width",  mapRect.width)
    svg.setAttribute("height", mapRect.height)
    svg.style.cssText = "position:absolute;top:0;left:0;pointer-events:none;z-index:10;overflow:visible"

    // Glow filter
    let defs   = document.createElementNS("http://www.w3.org/2000/svg", "defs")
    let filter = document.createElementNS("http://www.w3.org/2000/svg", "filter")
    filter.setAttribute("id", "navGlow")
    filter.setAttribute("x", "-50%")
    filter.setAttribute("y", "-50%")
    filter.setAttribute("width", "200%")
    filter.setAttribute("height", "200%")
    let blur = document.createElementNS("http://www.w3.org/2000/svg", "feGaussianBlur")
    blur.setAttribute("stdDeviation", "4")
    blur.setAttribute("result", "coloredBlur")
    let merge = document.createElementNS("http://www.w3.org/2000/svg", "feMerge")
    ;["coloredBlur","SourceGraphic"].forEach(inp => {
        let n = document.createElementNS("http://www.w3.org/2000/svg", "feMergeNode")
        n.setAttribute("in", inp)
        merge.appendChild(n)
    })
    filter.appendChild(blur)
    filter.appendChild(merge)
    defs.appendChild(filter)
    svg.appendChild(defs)

    let ptStr = points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")

    // Outer glow
    let glow = document.createElementNS("http://www.w3.org/2000/svg", "polyline")
    glow.setAttribute("points", ptStr)
    glow.setAttribute("fill", "none")
    glow.setAttribute("stroke", "rgba(41,121,255,0.3)")
    glow.setAttribute("stroke-width", "14")
    glow.setAttribute("stroke-linecap", "round")
    glow.setAttribute("stroke-linejoin", "round")
    svg.appendChild(glow)

    // Main line
    let line = document.createElementNS("http://www.w3.org/2000/svg", "polyline")
    line.setAttribute("points", ptStr)
    line.setAttribute("fill", "none")
    line.setAttribute("stroke", "#2979ff")
    line.setAttribute("stroke-width", "5")
    line.setAttribute("stroke-linecap", "round")
    line.setAttribute("stroke-linejoin", "round")
    line.setAttribute("filter", "url(#navGlow)")
    // Dash animation
    line.style.strokeDasharray  = "2000"
    line.style.strokeDashoffset = "2000"
    line.style.animation = "drawPath 0.7s ease forwards"
    svg.appendChild(line)

    // Start dot — green "You are here"
    let sp = points[0]
    addCircle(svg, sp.x, sp.y, 8, "#00c853", "url(#navGlow)")
    addText(svg, sp.x + 13, sp.y + 5, "You are here", "#00c853", "bold", "12")

    // End dot — red pulsing destination
    let ep = points[points.length - 1]
    let endDot = addCircle(svg, ep.x, ep.y, 8, "#ff1744", "url(#navGlow)")
    endDot.style.animation = "pulseDot 0.9s infinite alternate"

    container.appendChild(svg)
}

function addCircle(svg, cx, cy, r, fill, filter) {
    let c = document.createElementNS("http://www.w3.org/2000/svg", "circle")
    c.setAttribute("cx", cx.toFixed(1))
    c.setAttribute("cy", cy.toFixed(1))
    c.setAttribute("r",  r)
    c.setAttribute("fill", fill)
    if (filter) c.setAttribute("filter", filter)
    svg.appendChild(c)
    return c
}

function addText(svg, x, y, text, fill, weight, size) {
    let t = document.createElementNS("http://www.w3.org/2000/svg", "text")
    t.setAttribute("x", x.toFixed(1))
    t.setAttribute("y", y.toFixed(1))
    t.setAttribute("fill", fill)
    t.setAttribute("font-size", size || "12")
    t.setAttribute("font-weight", weight || "normal")
    t.setAttribute("font-family", "Segoe UI, Arial, sans-serif")
    t.textContent = text
    svg.appendChild(t)
    return t
}


// ---- CLICK SOUND ----

function playClickSound() {
    try {
        let ctx = new (window.AudioContext || window.webkitAudioContext)()
        let osc = ctx.createOscillator()
        let gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.frequency.value = 880
        gain.gain.setValueAtTime(0.15, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12)
        osc.start(ctx.currentTime)
        osc.stop(ctx.currentTime + 0.12)
    } catch(e) {}
}


// ---- STALL DETAIL MODAL ----

function openModal(stallId) {
    let modal   = document.getElementById("stallModal")
    let content = document.getElementById("modalContent")
    content.innerHTML = "<p style='color:#636e72;font-size:13px'>Loading...</p>"
    modal.style.display = "flex"

    fetch("/api/stall/" + stallId)
        .then(r => r.json())
        .then(data => {
            let img = data.image
                ? `<img class="modal-img" src="/static/images/stalls/${data.image}" alt="${data.stall_name}">`
                : ""
            let statusClass = data.status.toLowerCase()
            content.innerHTML = `
                <h2>S${data.stall_id} — ${data.stall_name}</h2>
                ${img}
                <div class="modal-meta">
                    <span class="modal-badge ${statusClass}">${data.status}</span>
                    <span class="modal-category">${data.category}</span>
                </div>
                ${data.description ? `<p class="modal-text"><strong>About:</strong> ${data.description}</p>` : ""}
                ${data.offers     ? `<p class="modal-text"><strong>Offers:</strong> ${data.offers}</p>`      : ""}
            `
        })
        .catch(() => { content.innerHTML = "<p style='color:#e57373'>Could not load stall details.</p>" })
}

function closeModal(event) {
    if (event.target === document.getElementById("stallModal"))
        document.getElementById("stallModal").style.display = "none"
}

function closeModalBtn() {
    document.getElementById("stallModal").style.display = "none"
}

document.addEventListener("keydown", e => {
    if (e.key === "Escape") closeModalBtn()
})

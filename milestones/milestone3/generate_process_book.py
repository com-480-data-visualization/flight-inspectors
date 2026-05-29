"""
Flight Inspectors – Process Book PDF generator
COM-480 Data Visualization · EPFL · 2026
"""

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm, mm
from reportlab.lib import colors
from reportlab.lib.colors import HexColor
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, Frame, Spacer
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
import os
import textwrap

# ── Palette (light theme) ──────────────────────────────────────────────────
BG       = HexColor("#ffffff")   # white
SURFACE  = HexColor("#f4f4f5")   # light card surface
BORDER   = HexColor("#d4d4d8")   # subtle borders
ACCENT   = HexColor("#7c3aed")   # violet (darker for readability on white)
ACCENT2  = HexColor("#0891b2")   # cyan-dark
ACCENT3  = HexColor("#16a34a")   # green-dark
WHITE    = HexColor("#18181b")   # near-black (body text on white bg)
GREY     = HexColor("#52525b")   # medium grey
LGREY    = HexColor("#a1a1aa")   # light grey
YELLOW   = HexColor("#d97706")   # amber

W, H = A4   # 595 × 842 pt

ASSETS = os.path.join(os.path.dirname(__file__), "..", "milestone2")

# ── Helper: draw image clipped to a box ────────────────────────────────────
def draw_image(c, path, x, y, w, h, radius=6, preserve_aspect=True):
    if not os.path.exists(path):
        return
    if preserve_aspect:
        from PIL import Image as PILImage
        img = PILImage.open(path)
        iw, ih = img.size
        scale = min(w / iw, h / ih)
        dw, dh = iw * scale, ih * scale
        dx = x + (w - dw) / 2
        dy = y + (h - dh) / 2
        c.drawImage(path, dx, dy, dw, dh, mask='auto')
    else:
        c.drawImage(path, x, y, w, h, mask='auto')


# ── Reusable drawing primitives ─────────────────────────────────────────────
def fill_bg(c):
    c.setFillColor(BG)
    c.rect(0, 0, W, H, fill=1, stroke=0)


def rounded_rect(c, x, y, w, h, r=6, fill_color=SURFACE, stroke_color=BORDER, stroke_width=0.5):
    c.setFillColor(fill_color)
    c.setStrokeColor(stroke_color)
    c.setLineWidth(stroke_width)
    c.roundRect(x, y, w, h, r, fill=1, stroke=1)


def badge(c, x, y, text, color=ACCENT):
    c.setFont("Helvetica", 7)
    c.setFillColor(color)
    tw = c.stringWidth(text, "Helvetica", 7)
    pad = 5
    rounded_rect(c, x - pad, y - 3, tw + pad * 2, 13, r=4,
                 fill_color=HexColor("#f5f3ff"), stroke_color=color, stroke_width=0.4)
    c.setFillColor(color)
    c.drawString(x, y, text)


def label(c, x, y, text, size=7, color=GREY, font="Helvetica"):
    c.setFont(font, size)
    c.setFillColor(color)
    c.drawString(x, y, text)


def heading(c, x, y, text, size=18, color=WHITE, font="Helvetica-Bold"):
    c.setFont(font, size)
    c.setFillColor(color)
    c.drawString(x, y, text)


def subheading(c, x, y, text, size=10, color=ACCENT, font="Helvetica-Bold"):
    c.setFont(font, size)
    c.setFillColor(color)
    c.drawString(x, y, text)


def body_text(c, x, y, text, size=8, color=WHITE, max_width=None, line_height=12,
              font="Helvetica", align="left"):
    """Draw wrapped body text. Returns y after last line."""
    c.setFont(font, size)
    c.setFillColor(color)
    if max_width is None:
        c.drawString(x, y, text)
        return y - line_height

    # Rough char width estimate
    avg_char = size * 0.52
    chars_per_line = max(1, int(max_width / avg_char))
    words = text.split()
    lines, current = [], []
    for word in words:
        trial = ' '.join(current + [word])
        if c.stringWidth(trial, font, size) <= max_width:
            current.append(word)
        else:
            if current:
                lines.append(' '.join(current))
            current = [word]
    if current:
        lines.append(' '.join(current))

    cy = y
    for line in lines:
        if align == "center":
            lw = c.stringWidth(line, font, size)
            c.drawString(x + (max_width - lw) / 2, cy, line)
        else:
            c.drawString(x, cy, line)
        cy -= line_height
    return cy


def divider(c, x, y, w, color=LGREY, thickness=0.5):
    c.setStrokeColor(color)
    c.setLineWidth(thickness)
    c.line(x, y, x + w, y)


def accent_bar(c, x, y, h=28, w=3, color=ACCENT):
    c.setFillColor(color)
    c.rect(x, y, w, h, fill=1, stroke=0)


def page_number(c, n):
    c.setFont("Helvetica", 7)
    c.setFillColor(GREY)
    txt = f"{n} / 9"
    tw = c.stringWidth(txt, "Helvetica", 7)
    c.drawString(W / 2 - tw / 2, 18, txt)


def footer_rule(c):
    divider(c, 30, 26, W - 60, color=LGREY, thickness=0.4)


def section_pill(c, x, y, text):
    badge(c, x, y, text, color=ACCENT2)


# ═══════════════════════════════════════════════════════════════════════════
# PAGE 1 – COVER
# ═══════════════════════════════════════════════════════════════════════════
def page_cover(c):
    fill_bg(c)

    # Top accent band
    c.setFillColor(ACCENT)
    c.rect(0, H - 8, W, 8, fill=1, stroke=0)

    # Decorative large circles (light tones)
    c.setFillColor(HexColor("#ede9fe"))   # very light violet
    c.circle(W - 30, H - 80, 230, fill=1, stroke=0)
    c.setFillColor(HexColor("#f0f9ff"))   # very light cyan
    c.circle(W - 10, H - 120, 140, fill=1, stroke=0)

    # Subtle dot grid
    c.setFillColor(HexColor("#e4e4e7"))
    for gx in range(20, int(W), 18):
        for gy in range(40, int(H) - 8, 18):
            c.circle(gx, gy, 0.8, fill=1, stroke=0)

    # Course badge
    badge(c, 35, H - 48, "COM-480 · DATA VISUALIZATION · EPFL · 2026", color=ACCENT)

    # Title
    c.setFont("Helvetica-Bold", 52)
    c.setFillColor(WHITE)   # near-black
    c.drawString(35, H - 120, "Flight")
    c.setFillColor(ACCENT)
    c.drawString(35, H - 175, "Inspectors")

    # Subtitle
    c.setFont("Helvetica", 14)
    c.setFillColor(GREY)
    c.drawString(35, H - 210, "Process Book  ·  Milestone 3")

    # Thin accent line
    c.setFillColor(ACCENT)
    c.rect(35, H - 222, 120, 2, fill=1, stroke=0)
    c.setFillColor(ACCENT2)
    c.rect(157, H - 222, 40, 2, fill=1, stroke=0)

    # Tagline
    c.setFont("Helvetica-Oblique", 10)
    c.setFillColor(GREY)
    c.drawString(35, H - 248, '"How safe do you think flying really is?"')

    # Stats strip
    stats = [("5,078", "Crashes recorded"), ("93,197", "Civilian fatalities"),
             ("116", "Years of aviation data")]
    sx = 35
    for val, lbl in stats:
        rounded_rect(c, sx, H - 320, 145, 52, r=8, fill_color=SURFACE, stroke_color=BORDER)
        c.setFont("Helvetica-Bold", 22)
        c.setFillColor(ACCENT)
        c.drawString(sx + 12, H - 294, val)
        c.setFont("Helvetica", 8)
        c.setFillColor(GREY)
        c.drawString(sx + 12, H - 308, lbl)
        sx += 155

    # Team section
    rounded_rect(c, 35, 170, W - 70, 130, r=10, fill_color=SURFACE, stroke_color=BORDER)
    c.setFont("Helvetica-Bold", 8)
    c.setFillColor(ACCENT2)
    c.drawString(50, 282, "TEAM  /  FLIGHT INSPECTORS")
    divider(c, 50, 276, W - 100, color=LGREY)

    team = [
        ("Roméo Maignal",      "360568", "Website architecture · Viz 1 & 2"),
        ("Nicolas Karmolinski","316655", "Viz 5 (Poisson) · Data analysis"),
        ("Jakub Kielar",       "423372", "Viz 3 & 4 · Globe · Heatmap · Treemap"),
    ]
    ty = 262
    avatar_colors = [ACCENT, ACCENT2, ACCENT3]
    for (name, sciper, role), avcol in zip(team, avatar_colors):
        # Avatar circle
        c.setFillColor(HexColor("#ede9fe"))
        c.circle(66, ty - 4, 10, fill=1, stroke=0)
        c.setFont("Helvetica-Bold", 8)
        c.setFillColor(avcol)
        initial = name[0]
        iw = c.stringWidth(initial, "Helvetica-Bold", 8)
        c.drawString(66 - iw / 2, ty - 7, initial)

        c.setFont("Helvetica-Bold", 9)
        c.setFillColor(WHITE)
        c.drawString(82, ty, name)
        c.setFont("Helvetica", 7.5)
        c.setFillColor(GREY)
        c.drawString(82, ty - 11, f"SCIPER {sciper}  ·  {role}")
        ty -= 32

    # Bottom strip
    c.setFillColor(HexColor("#f4f4f5"))
    c.rect(0, 0, W, 40, fill=1, stroke=0)
    divider(c, 0, 40, W, color=BORDER, thickness=0.5)
    c.setFont("Helvetica", 7)
    c.setFillColor(GREY)
    c.drawString(35, 15,
                 "GitHub · com-480-data-visualization/flight-inspectors  ·  "
                 "Hosted on GitHub Pages  ·  Built with React, TypeScript, D3.js")


# ═══════════════════════════════════════════════════════════════════════════
# PAGE 2 – OVERVIEW & MOTIVATION
# ═══════════════════════════════════════════════════════════════════════════
def page_overview(c):
    fill_bg(c)
    footer_rule(c)
    page_number(c, 2)

    # Header
    badge(c, 35, H - 38, "/ 01  OVERVIEW & MOTIVATION", color=ACCENT)
    heading(c, 35, H - 68, "Understanding the real", size=22)
    heading(c, 35, H - 94, "risks of air travel", size=22, color=ACCENT)
    divider(c, 35, H - 102, W - 70)

    # Problem + Approach cards side-by-side
    cards = [
        ("The Problem", ACCENT,
         "No matter how statistically safe modern air travel is, "
         "the feeling of insecurity when boarding a plane persists. "
         "Crash events dominate media coverage, distorting public "
         "perception of actual risk. We wanted to address this with data."),
        ("Our Approach", ACCENT2,
         "We built an interactive web platform that lets users explore "
         "aviation safety across six distinct visualizations—spanning "
         "manufacturer records, airline casualty trends, crash geography, "
         "and a Poisson-based predictive model for personalised risk assessment."),
        ("The Dataset", ACCENT3,
         "Primary: Kaggle 'Plane Crashes Dataset' (1908–2024) by Luiscé "
         "Francisco. Supplemented by OpenFlights airport, route and airline "
         "tables. Processing focused on isolating commercial flights and "
         "geo-locating routes for the globe visualization."),
    ]
    cx = 35
    for title, col, text in cards:
        cw = (W - 70 - 12) / 3
        rounded_rect(c, cx, H - 260, cw, 138, fill_color=SURFACE, stroke_color=BORDER)
        accent_bar(c, cx, H - 260, h=138, w=3, color=col)
        c.setFont("Helvetica-Bold", 9)
        c.setFillColor(col)
        c.drawString(cx + 10, H - 136, title)
        body_text(c, cx + 10, H - 150, text, size=7.5, color=WHITE,
                  max_width=cw - 16, line_height=11)
        cx += cw + 6

    # Research questions
    subheading(c, 35, H - 280, "Research questions", size=9)
    questions = [
        ("Which manufacturers", "have the safest long-term incident record?"),
        ("How do casualty rates", "per airline change decade by decade?"),
        ("Where in the world", "do crashes cluster, and on which routes?"),
        ("Can Poisson statistics", "model the probability of an incident on your flight?"),
    ]
    qy = H - 300
    for bold_part, rest in questions:
        c.setFillColor(HexColor("#f5f3ff"))
        c.rect(35, qy - 4, W - 70, 16, fill=1, stroke=0)
        c.setFont("Helvetica-Bold", 8)
        c.setFillColor(ACCENT)
        c.drawString(42, qy + 2, f"→  {bold_part}")
        bw = c.stringWidth(f"→  {bold_part}", "Helvetica-Bold", 8)
        c.setFont("Helvetica", 8)
        c.setFillColor(WHITE)
        c.drawString(42 + bw + 3, qy + 2, rest)
        qy -= 22

    # Tech-stack row
    subheading(c, 35, H - 430, "Tech stack", size=9)
    tech = [
        ("React + TypeScript", "UI & component model", ACCENT),
        ("Vite", "Build tool & dev server", ACCENT2),
        ("D3.js", "All data visualizations", ACCENT3),
        ("TailwindCSS", "Styling framework", YELLOW),
        ("GitHub Pages", "Hosting & CI/CD", HexColor("#be185d")),
        ("Python", "Data preprocessing scripts", HexColor("#c2410c")),
    ]
    tx = 35
    tw = (W - 70 - 10 * 5) / 6
    for name, role, col in tech:
        rounded_rect(c, tx, H - 500, tw, 52, fill_color=SURFACE, stroke_color=col, stroke_width=0.6)
        c.setFont("Helvetica-Bold", 7.5)
        c.setFillColor(col)
        c.drawString(tx + 6, H - 460, name)
        c.setFont("Helvetica", 7)
        c.setFillColor(GREY)
        c.drawString(tx + 6, H - 472, role)
        tx += tw + 10

    # Git-workflow diagram
    subheading(c, 35, H - 520, "Development workflow", size=9)
    rounded_rect(c, 35, H - 610, W - 70, 70, fill_color=SURFACE, stroke_color=BORDER)

    branches = [
        ("main",       ACCENT,  "Website foundation, Viz 1 & 2, UI polish"),
        ("world_maps", ACCENT2, "Viz 3 (Heatmap + Treemap) and Viz 4 (Interactive Globe)"),
        ("poisson",    ACCENT3, "Viz 5 – Poisson distribution model"),
    ]
    by = H - 550
    for bname, col, desc in branches:
        # Branch node
        c.setFillColor(col)
        c.circle(68, by, 5, fill=1, stroke=0)
        c.setFillColor(col)
        c.setLineWidth(1)
        c.setStrokeColor(col)
        # Connector line to next
        if bname != "poisson":
            c.line(68, by - 5, 68, by - 15)
        c.setFont("Helvetica-Bold", 8)
        c.setFillColor(col)
        c.drawString(80, by + 3, bname)
        c.setFont("Helvetica", 7.5)
        c.setFillColor(GREY)
        c.drawString(80, by - 8, desc)
        by -= 22

    # Deployment note
    body_text(c, 35, H - 626,
              "All three branches were merged into main and deployed automatically to "
              "GitHub Pages via a CI workflow triggered on every push.",
              size=7.5, color=GREY, max_width=W - 70, line_height=11)


# ═══════════════════════════════════════════════════════════════════════════
# PAGE 3 – MILESTONE 1 → INITIAL PLANNING
# ═══════════════════════════════════════════════════════════════════════════
def page_planning(c):
    fill_bg(c)
    footer_rule(c)
    page_number(c, 3)

    badge(c, 35, H - 38, "/ 02  INITIAL PLANNING  ·  MILESTONE 1", color=ACCENT2)
    heading(c, 35, H - 68, "From dataset to design", size=22, color=WHITE)
    divider(c, 35, H - 76, W - 70)

    # Problematic block
    body_text(c, 35, H - 96,
              "Milestone 1 established our dataset, research objectives and related work. "
              "We settled on the Kaggle 'Plane Crashes' dataset (1908–2024) complemented "
              "by OpenFlights data for geo-coordinates. The core vision: six "
              "interactive visualizations revealing different facets of aviation safety, "
              "culminating in a Poisson model that lets users estimate the risk of their "
              "own flight.",
              size=8, color=WHITE, max_width=W - 70, line_height=12)

    # Planned viz list
    subheading(c, 35, H - 175, "Six planned visualizations", size=9)

    vizlist = [
        ("Viz 1", "Manufacturer safety record",
         "Bar chart comparing incident & fatality counts per aircraft maker across a selectable year range."),
        ("Viz 2", "Airline casualty bubble chart",
         "Animated bubble chart where bubble size encodes cumulative casualties, driven by a time slider."),
        ("Viz 3", "Crash-location heatmap + treemap",
         "World choropleth showing crash density by country; treemap below for proportional breakdown."),
        ("Viz 4", "Interactive globe with crash routes",
         "Rotatable 3D globe plotting each route with arc width proportional to fatalities."),
        ("Viz 5", "Poisson distribution model",
         "Statistical tool: the user selects origin, destination, airline and manufacturer "
         "to obtain a Poisson PMF curve estimating incident probability."),
        ("Viz 6", "Directed chord diagram",
         "Originally planned to show flight-route flows between world regions. "
         "Deprioritised in favour of completing the globe and Poisson model."),
    ]

    col_w = (W - 70 - 8) / 2
    vx, vy = 35, H - 205
    for i, (tag, title, desc) in enumerate(vizlist):
        col = [ACCENT, ACCENT2, ACCENT3, YELLOW, HexColor("#be185d"), LGREY][i]
        box_h = 62
        rounded_rect(c, vx, vy - box_h, col_w, box_h, fill_color=SURFACE, stroke_color=col, stroke_width=0.5)
        accent_bar(c, vx, vy - box_h, h=box_h, w=3, color=col)
        badge(c, vx + 10, vy - 10, tag, color=col)
        c.setFont("Helvetica-Bold", 8.5)
        c.setFillColor(WHITE)
        c.drawString(vx + 10, vy - 25, title)
        body_text(c, vx + 10, vy - 37, desc, size=7, color=GREY,
                  max_width=col_w - 20, line_height=10)
        if i % 2 == 1:
            vx = 35
            vy -= box_h + 6
        else:
            vx += col_w + 8

    # Related work
    subheading(c, 35, H - 585, "Key inspirations", size=9)
    refs = [
        ("FlightRadar24", "Real-time flight tracking — inspired our route-arc approach on the globe."),
        ("FlightConnections", "Interactive route map — showed us how to make the globe explorable."),
        ("OpenFlights Map", "Static world flight map — we wanted to add crash data and interactivity."),
        ("Kaggle analyses", "Prior work on similar datasets gave us benchmarks for our own EDA."),
    ]
    ry = H - 605
    for ref, desc in refs:
        c.setFillColor(SURFACE)
        c.rect(35, ry - 4, W - 70, 15, fill=1, stroke=0)
        c.setFont("Helvetica-Bold", 7.5)
        c.setFillColor(ACCENT)
        c.drawString(42, ry + 1, f"■  {ref}")
        rw = c.stringWidth(f"■  {ref}", "Helvetica-Bold", 7.5)
        c.setFont("Helvetica", 7.5)
        c.setFillColor(GREY)
        c.drawString(42 + rw + 6, ry + 1, desc)
        ry -= 18


# ═══════════════════════════════════════════════════════════════════════════
# PAGE 4 – WEBSITE FOUNDATION & DESIGN EVOLUTION
# ═══════════════════════════════════════════════════════════════════════════
def page_website_foundation(c):
    fill_bg(c)
    footer_rule(c)
    page_number(c, 4)

    badge(c, 35, H - 38, "/ 03  WEBSITE FOUNDATION  ·  MILESTONE 2  →  MAIN BRANCH", color=ACCENT)
    heading(c, 35, H - 68, "Building the platform", size=22, color=WHITE)
    divider(c, 35, H - 76, W - 70)

    body_text(c, 35, H - 96,
              "Milestone 2 turned the design sketches into a running website. The core "
              "skeleton—navigation bar, hero section, and widget scaffolding for all six "
              "visualizations—was delivered in a single PR on main. The following weeks "
              "brought major visual refinements and the first two fully interactive visualizations.",
              size=8, color=WHITE, max_width=W - 70, line_height=12)

    # Key commits timeline
    subheading(c, 35, H - 156, "Key milestones on main", size=9)

    events = [
        ("Apr 2026", ACCENT2,  "Website skeleton finished",
         "feat(MILESTONE2): skeleton for the project is done — React + Vite + Tailwind "
         "wired up, all six widget placeholders in place, CI pipeline live on GitHub Pages."),
        ("Apr 2026", ACCENT,   "Design pivot: beige → black",
         "feat(everything): Background changed from beige to near-black (#0a0a0a) so "
         "the visualizations become the centre of attention. Accent colour set to violet "
         "— closer to aviation's digital aesthetic than warm tones."),
        ("Apr 2026", ACCENT3,  "Hero section — Boids animation",
         "feat(HERO): boids added — a flocking simulation using autonomous agents "
         "creates the illusion of aircraft contrails in the hero background. "
         "Adds life without distracting from the data."),
        ("May 2026", YELLOW,   "Viz 1 & Viz 2 fully interactive",
         "Bar chart and bubble chart connected to real JSON data generated by "
         "Python preprocessing scripts. D3.js scales, transitions and tooltips added. "
         "Dropdown menus, fullscreen mode, year slider all wired up."),
        ("May 2026", ACCENT,   "Navbar drop-down & polish",
         "feat(navbar): numeric viz links replaced by a drop-down menu for "
         "cleaner navigation as viz count grew. Light/dark mode toggle added."),
    ]

    ey = H - 180
    for date, col, title, desc in events:
        # Timeline node
        c.setFillColor(col)
        c.circle(50, ey, 4, fill=1, stroke=0)
        if title != "Navbar drop-down & polish":
            c.setStrokeColor(LGREY)
            c.setLineWidth(0.5)
            c.line(50, ey - 4, 50, ey - 46)

        # Date
        c.setFont("Helvetica", 6.5)
        c.setFillColor(GREY)
        c.drawString(35, ey + 3, date)

        # Box
        bx, bw, bh = 62, W - 97, 44
        rounded_rect(c, bx, ey - bh + 6, bw, bh,
                     fill_color=SURFACE, stroke_color=BORDER)
        accent_bar(c, bx, ey - bh + 6, h=bh, w=2, color=col)
        c.setFont("Helvetica-Bold", 8.5)
        c.setFillColor(col)
        c.drawString(bx + 8, ey, title)
        body_text(c, bx + 8, ey - 12, desc, size=7, color=GREY,
                  max_width=bw - 16, line_height=10)
        ey -= 52

    # Design decisions
    subheading(c, 35, H - 466, "Design decisions & trade-offs", size=9)

    decisions = [
        ("Dark theme",
         "Initially the site had a warm beige background. After building the first "
         "visualizations it became clear that colourful charts need a neutral canvas. "
         "Near-black (#0a0a0a) lets the D3 colour palettes pop without competing hues."),
        ("Widget + fullscreen pattern",
         "Every visualization lives in a self-contained 'widget' card. A single "
         "useFullscreen hook grants every viz a consistent fullscreen button, "
         "avoiding duplicated code and ensuring a unified UX."),
        ("Navbar backdrop blur issue",
         "On the local Vite server the translucent navbar blur rendered correctly. "
         "GitHub Pages strips certain CSS features. We resolved this by setting a "
         "solid dark background for the deployed version while keeping blur locally."),
    ]

    dy = H - 488
    dx = 35
    dw = (W - 70 - 10) / 3
    for title, text in decisions:
        rounded_rect(c, dx, dy - 82, dw, 82, fill_color=SURFACE, stroke_color=BORDER)
        accent_bar(c, dx, dy - 82, h=82, w=3, color=ACCENT)
        c.setFont("Helvetica-Bold", 8)
        c.setFillColor(WHITE)
        c.drawString(dx + 10, dy - 12, title)
        body_text(c, dx + 10, dy - 26, text, size=7, color=GREY,
                  max_width=dw - 16, line_height=10)
        dx += dw + 5


# ═══════════════════════════════════════════════════════════════════════════
# PAGE 5 – VIZ 1 & VIZ 2  (sketches + implementation)
# ═══════════════════════════════════════════════════════════════════════════
def page_viz12(c):
    fill_bg(c)
    footer_rule(c)
    page_number(c, 5)

    badge(c, 35, H - 38, "/ 04  VISUALIZATIONS 1 & 2  ·  MAIN BRANCH", color=ACCENT)
    heading(c, 35, H - 68, "Manufacturer & airline records", size=22)
    divider(c, 35, H - 76, W - 70)

    # ── Viz 1 ───────────────────────────────────────────────────────────────
    subheading(c, 35, H - 96, "Viz 1 — Manufacturer safety record (bar chart)", size=9, color=ACCENT)

    body_text(c, 35, H - 114,
              "Users select up to four aircraft manufacturers and a metric (incidents or "
              "fatalities) to compare their yearly records on a grouped bar chart. "
              "Dropdown menus and an optional year range let visitors tailor the view. "
              "Hovering a bar triggers a D3 tooltip with exact figures.",
              size=7.5, color=WHITE, max_width=W - 70, line_height=11)

    # Sketch image
    img1 = os.path.join(ASSETS, "comparison_visualization.png")
    rounded_rect(c, 35, H - 295, 220, 155, fill_color=SURFACE, stroke_color=BORDER)
    draw_image(c, img1, 40, H - 290, 210, 145)
    label(c, 35, H - 302, "Milestone 2 sketch → implemented as-is with minor layout refinements", color=GREY)

    # Implementation notes
    rounded_rect(c, 268, H - 295, W - 303, 155, fill_color=SURFACE, stroke_color=BORDER)
    accent_bar(c, 268, H - 295, h=155, w=3, color=ACCENT)
    nw = W - 313
    ny = H - 152
    notes1 = [
        ("Challenge", "Aligning grouped bars cleanly when fewer than four manufacturers "
         "are selected. Solved with D3 scaleBand for the outer group and a nested "
         "scaleBand for individual bars."),
        ("Data pipeline", "Python script (data/viz1/script.py) reads crashes_cleaned.csv, "
         "groups by manufacturer key and year, then writes public/data/"
         "crashes_by_manufacturer.json consumed by the React component."),
        ("Colour palette", "Each manufacturer gets a fixed accent colour from a hand-picked "
         "set of 15 so repeated views are consistent. Boeing → violet, Airbus → cyan."),
    ]
    for label_txt, note_txt in notes1:
        c.setFont("Helvetica-Bold", 7.5)
        c.setFillColor(ACCENT)
        c.drawString(278, ny, label_txt)
        body_text(c, 278, ny - 11, note_txt, size=7, color=GREY,
                  max_width=nw, line_height=10)
        ny -= 46

    # ── Viz 2 ───────────────────────────────────────────────────────────────
    subheading(c, 35, H - 315, "Viz 2 — Airline casualty bubble chart", size=9, color=ACCENT2)

    body_text(c, 35, H - 333,
              "A bubble-chart showing cumulative casualties (or incident counts) per airline "
              "as of a given year. A time slider animates the layout from 1919 to 2024. "
              "Bubbles are colour-coded, repel each other with a D3 force simulation, and "
              "a glow effect fires on hover to highlight the selected airline.",
              size=7.5, color=WHITE, max_width=W - 70, line_height=11)

    img2 = os.path.join(ASSETS, "top_actor_visualization.png")
    rounded_rect(c, 35, H - 510, 220, 155, fill_color=SURFACE, stroke_color=BORDER)
    draw_image(c, img2, 40, H - 505, 210, 145)
    label(c, 35, H - 517, "Milestone 2 sketch — bubble positions evolved via D3 force simulation", color=GREY)

    rounded_rect(c, 268, H - 510, W - 303, 155, fill_color=SURFACE, stroke_color=BORDER)
    accent_bar(c, 268, H - 510, h=155, w=3, color=ACCENT2)
    ny2 = H - 370
    notes2 = [
        ("Challenge", "Force simulation settling time vs. slider responsiveness. We pre-warm "
         "the simulation and debounce slider events so bubbles glide rather than jump."),
        ("Year label", "The currently selected year is rendered directly on the slider thumb "
         "so the user never loses context while dragging — small but impactful UX detail."),
        ("Pivot from sketch", "The original sketch showed a static layout. The live version "
         "uses a forceSimulation so bubbles never overlap, which required adding rest-"
         "position anchors to keep the cloud centred after each tick."),
    ]
    for label_txt, note_txt in notes2:
        c.setFont("Helvetica-Bold", 7.5)
        c.setFillColor(ACCENT2)
        c.drawString(278, ny2, label_txt)
        body_text(c, 278, ny2 - 11, note_txt, size=7, color=GREY,
                  max_width=nw, line_height=10)
        ny2 -= 46


# ═══════════════════════════════════════════════════════════════════════════
# PAGE 6 – VIZ 3 & VIZ 4  (world_maps branch)
# ═══════════════════════════════════════════════════════════════════════════
def page_viz34(c):
    fill_bg(c)
    footer_rule(c)
    page_number(c, 6)

    badge(c, 35, H - 38, "/ 05  VISUALIZATIONS 3 & 4  ·  WORLD_MAPS BRANCH", color=ACCENT2)
    heading(c, 35, H - 68, "Geography of aviation crashes", size=22)
    divider(c, 35, H - 76, W - 70)

    # ── Viz 3 ───────────────────────────────────────────────────────────────
    subheading(c, 35, H - 96, "Viz 3 — Crash heatmap (choropleth) + treemap", size=9, color=ACCENT2)

    body_text(c, 35, H - 114,
              "A dual-panel widget: the upper panel is a Mercator world choropleth where "
              "each country is shaded by incident or fatality count over a selectable year "
              "range. The lower panel is a treemap giving proportional area to each country. "
              "Hovering either panel cross-highlights the corresponding entry in the other.",
              size=7.5, color=WHITE, max_width=W - 70, line_height=11)

    img3 = os.path.join(ASSETS, "crash_locations_visualization.jpg")
    rounded_rect(c, 35, H - 288, 220, 148, fill_color=SURFACE, stroke_color=BORDER)
    draw_image(c, img3, 40, H - 283, 210, 138)
    label(c, 35, H - 295, "Milestone 2 sketch — heatmap + treemap layout preserved in final implementation", color=GREY)

    rounded_rect(c, 268, H - 288, W - 303, 148, fill_color=SURFACE, stroke_color=BORDER)
    accent_bar(c, 268, H - 288, h=148, w=3, color=ACCENT2)
    ny = H - 153
    notes3 = [
        ("TopoJSON", "Country geometries come from the world-atlas package (110m resolution). "
         "topojson-client.feature() converts topology to GeoJSON for D3 geoPath."),
        ("Mercator crop", "Antarctica wastes space. We wrote a custom makeHeatProjection() "
         "that clips to lat [−55, 84], fitting the strip precisely into the widget."),
        ("Continent colours", "Countries are coloured by continent (Africa=red, Asia=yellow, "
         "Europe=cyan…) in the treemap so regional patterns emerge at a glance."),
    ]
    for label_txt, note_txt in notes3:
        c.setFont("Helvetica-Bold", 7.5)
        c.setFillColor(ACCENT2)
        c.drawString(278, ny, label_txt)
        body_text(c, 278, ny - 11, note_txt, size=7, color=GREY,
                  max_width=W - 313, line_height=10)
        ny -= 44

    # ── Viz 4 ───────────────────────────────────────────────────────────────
    subheading(c, 35, H - 314, "Viz 4 — Interactive globe with crash routes", size=9, color=ACCENT3)

    body_text(c, 35, H - 332,
              "A rotatable 3D globe (D3 geoOrthographic) plots each crash route as an arc. "
              "Arc thickness scales with fatalities. The globe auto-rotates when idle; "
              "drag pauses it. A year-range dual slider filters routes. Clicking a route "
              "pins a tooltip showing operator, aircraft type, origin, destination and "
              "fatality count.",
              size=7.5, color=WHITE, max_width=W - 70, line_height=11)

    img4 = os.path.join(ASSETS, "globe_visualization.jpg")
    rounded_rect(c, 35, H - 510, 220, 152, fill_color=SURFACE, stroke_color=BORDER)
    draw_image(c, img4, 40, H - 505, 210, 142)
    label(c, 35, H - 517, "Milestone 2 sketch — implemented with D3 geoOrthographic & drag interaction", color=GREY)

    rounded_rect(c, 268, H - 510, W - 303, 152, fill_color=SURFACE, stroke_color=BORDER)
    accent_bar(c, 268, H - 510, h=152, w=3, color=ACCENT3)
    ny2 = H - 370
    notes4 = [
        ("Auto-rotate", "A requestAnimationFrame loop rotates the globe at 0.0008 rad/tick. "
         "Any pointer event resets a 2.5 s idle timer, keeping the globe still while "
         "the user explores before gently resuming."),
        ("Route data", "Python (data/viz3/script.py + viz4/script.py) cross-references "
         "crash records with OpenFlights to resolve origin/destination city coordinates, "
         "writing crashed_routes.json and crashes_by_country.json."),
        ("Design change", "The original sketch showed a flat 2D map. We switched to a 3D "
         "orthographic globe to allow free exploration of all routes globally and make "
         "the widget more visually engaging and unique."),
    ]
    for label_txt, note_txt in notes4:
        c.setFont("Helvetica-Bold", 7.5)
        c.setFillColor(ACCENT3)
        c.drawString(278, ny2, label_txt)
        body_text(c, 278, ny2 - 11, note_txt, size=7, color=GREY,
                  max_width=W - 313, line_height=10)
        ny2 -= 46



# ═══════════════════════════════════════════════════════════════════════════
# PAGE 7 – VIZ 5  (Poisson / statistical model)
# ═══════════════════════════════════════════════════════════════════════════
def page_viz5(c):
    fill_bg(c)
    footer_rule(c)
    page_number(c, 7)

    badge(c, 35, H - 38, "/ 06  VISUALIZATION 5  ·  POISSON BRANCH", color=ACCENT3)
    heading(c, 35, H - 68, "Statistical risk modelling", size=22)
    divider(c, 35, H - 76, W - 70)

    body_text(c, 35, H - 96,
              "Visualization 5 is the most analytically ambitious part of the project. "
              "Rather than simply displaying historical data, it uses a Poisson model "
              "to give users a personalised probability estimate: "
              "given a choice of manufacturer, airline, origin and destination, "
              "what is the probability of 0, 1, 2 … incidents occurring in the next year?",
              size=8, color=WHITE, max_width=W - 70, line_height=12)

    # Sketch
    img_p = os.path.join(ASSETS, "predictive_model_visualization.png")
    rounded_rect(c, 35, H - 272, 200, 148, fill_color=SURFACE, stroke_color=BORDER)
    draw_image(c, img_p, 42, H - 268, 186, 138)
    label(c, 35, H - 280, "Milestone 2 sketch — 'Model your flight' with Poisson curve", color=GREY)

    # Theory box
    rounded_rect(c, 248, H - 272, W - 283, 148, fill_color=SURFACE, stroke_color=BORDER)
    accent_bar(c, 248, H - 272, h=148, w=3, color=ACCENT3)
    c.setFont("Helvetica-Bold", 8.5)
    c.setFillColor(ACCENT3)
    c.drawString(258, H - 140, "Poisson model — theory")
    body_text(c, 258, H - 154,
              "We estimate λ (average incidents/year) empirically from the filtered "
              "crash records for a user-defined combination of manufacturer, airline, "
              "origin country and destination country over a selected decade. "
              "The PMF P(X=k) = e^−λ · λ^k / k! is then plotted as a bar chart "
              "up to k_max ≈ λ + 4√λ. λ=0 collapses to a degenerate spike at k=0.",
              size=7.5, color=GREY, max_width=W - 298, line_height=11)

    subheading(c, 35, H - 296, "Implementation details", size=9, color=ACCENT3)

    impl_notes = [
        ("Filters & combinations",
         "The component receives a pre-aggregated JSON (data/viz5/script.py) containing "
         "incident counts grouped by (manufacturer × airline × origin × destination × year). "
         "Four cascading dropdowns let users narrow to any combination; the λ is recomputed "
         "client-side on every change without a network round-trip."),
        ("Log-factorial cache",
         "Computing k! for large k is numerically unstable. We accumulate "
         "log-factorials in a cache array (_logFactCache) and use the identity "
         "log P(X=k) = −λ + k·log(λ) − log(k!) to stay in floating-point range."),
        ("Year-range presets",
         "Six preset decade buttons (All time, 2000–2024, 1990–1999 …) let users "
         "quickly compare how λ has changed over time for the same combination—"
         "visually showing whether a given airline has improved its safety record."),
        ("UX decision",
         "The chart updates instantly on every dropdown change (no 'Submit' button). "
         "This encourages exploratory play and makes the statistical feedback feel "
         "immediate. We debated adding a spinner for perceived loading; decided the "
         "computation is fast enough that it would feel patronising."),
        ("Branch strategy",
         "Viz 5 was developed entirely on the poisson branch to avoid blocking main "
         "with an incomplete widget. The branch diverged from main at commit c9395b9 "
         "and adds only Viz5.tsx, Viz5.css and the data/viz5 preprocessing script."),
    ]
    ny = H - 318
    for title, text in impl_notes:
        c.setFillColor(HexColor("#f0fdf4"))
        c.rect(35, ny - 28, W - 70, 30, fill=1, stroke=0)
        c.setStrokeColor(ACCENT3)
        c.setLineWidth(0.4)
        c.line(35, ny + 2, 35, ny - 26)
        c.setFont("Helvetica-Bold", 7.5)
        c.setFillColor(ACCENT3)
        c.drawString(42, ny - 2, title)
        body_text(c, 42, ny - 14, text, size=7, color=GREY,
                  max_width=W - 80, line_height=10)
        ny -= 36

    # Challenge callout
    rounded_rect(c, 35, H - 630, W - 70, 42, fill_color=HexColor("#fffbeb"),
                 stroke_color=YELLOW, stroke_width=0.6)
    c.setFont("Helvetica-Bold", 8)
    c.setFillColor(YELLOW)
    c.drawString(46, H - 596, "⚠  Key challenge")
    body_text(c, 46, H - 610,
              "Sparse combinations (e.g. a niche regional airline + obscure manufacturer) "
              "yield λ≈0, producing a degenerate distribution that looks alarming to "
              "non-statisticians. We added a contextual note explaining that λ=0 means "
              "'no recorded incidents for this combination' — not 'guaranteed crash-free' — "
              "to preserve statistical honesty.",
              size=7.5, color=GREY, max_width=W - 80, line_height=11)


# ═══════════════════════════════════════════════════════════════════════════
# PAGE 8 – VIZ 6  (Directed chord diagram)
# ═══════════════════════════════════════════════════════════════════════════
def page_viz6(c):
    fill_bg(c)
    footer_rule(c)
    page_number(c, 8)

    badge(c, 35, H - 38, "/ 07  VISUALIZATION 6  ·  NICOLAS KARMOLINSKI", color=ACCENT2)
    heading(c, 35, H - 68, "Directed chord diagram", size=22)
    divider(c, 35, H - 76, W - 70)

    body_text(c, 35, H - 96,
              "Visualization 6 maps crash flows between world regions as a directed "
              "chord diagram. Each arc connects an origin region to a destination "
              "region, with width proportional to the number of crashes on that route. "
              "The layout makes it easy to spot which regions are most linked by "
              "fatal incidents.",
              size=8, color=WHITE, max_width=W - 70, line_height=12)

    # Sketch
    img_c = os.path.join(ASSETS, "directed_chord_visualization.png")
    rounded_rect(c, 35, H - 272, 200, 148, fill_color=SURFACE, stroke_color=BORDER)
    draw_image(c, img_c, 42, H - 268, 186, 138)
    label(c, 35, H - 280, "Milestone 2 sketch - directed chord diagram with regional crash flows", color=GREY)

    # Design box
    rounded_rect(c, 248, H - 272, W - 283, 148, fill_color=SURFACE, stroke_color=BORDER)
    accent_bar(c, 248, H - 272, h=148, w=3, color=ACCENT2)
    c.setFont("Helvetica-Bold", 8.5)
    c.setFillColor(ACCENT2)
    c.drawString(258, H - 140, "Design overview")
    body_text(c, 258, H - 154,
              "World regions are placed as segments on a circle. Directed chords "
              "connect origin to destination, thickness encoding crash-flow volume. "
              "D3 chord layout handles angular positioning from the flow matrix. "
              "Colors follow the continent scheme used in Viz 3.",
              size=7.5, color=GREY, max_width=W - 298, line_height=11)

    subheading(c, 35, H - 296, "Implementation details", size=9, color=ACCENT2)

    impl_notes = [
        ("Node count",
         "Finding the right number of nodes took some trial and error. Too many "
         "made the chart unreadable, too few lost geographic detail. Grouping by "
         "continent gave a clean layout while keeping the flows meaningful."),
        ("Self-connecting arcs",
         "Crashes where origin and destination fall in the same region produced "
         "self-connecting arcs that cluttered the center of the diagram. We "
         "removed them since intra-region flows are less interesting to show."),
        ("Data pipeline",
         "Python script cross-references crash records with OpenFlights to assign "
         "each crash to an origin and destination region, then builds the flow "
         "matrix fed into the D3 chord layout."),
        ("Arc direction",
         "The thicker end of each arc marks the origin region, the thinner end "
         "the destination. Region label colors carry over to the arcs so flows "
         "are easy to trace across the diagram."),
        ("GitHub Pages",
         "The SVG rendering of the chord diagram looked fine locally but some "
         "arc gradients were dropped on GitHub Pages. Switching from CSS gradients "
         "to plain SVG fill colors kept the chart consistent across environments."),
    ]
    ny = H - 318
    for title, text in impl_notes:
        c.setFillColor(HexColor("#f0f9ff"))
        c.rect(35, ny - 28, W - 70, 30, fill=1, stroke=0)
        c.setStrokeColor(ACCENT2)
        c.setLineWidth(0.4)
        c.line(35, ny + 2, 35, ny - 26)
        c.setFont("Helvetica-Bold", 7.5)
        c.setFillColor(ACCENT2)
        c.drawString(42, ny - 2, title)
        body_text(c, 42, ny - 14, text, size=7, color=GREY,
                  max_width=W - 80, line_height=10)
        ny -= 36


# ═══════════════════════════════════════════════════════════════════════════
# PAGE 9 – PEER ASSESSMENT & CONTRIBUTIONS
# ═══════════════════════════════════════════════════════════════════════════
def page_contributions(c):
    fill_bg(c)
    footer_rule(c)
    page_number(c, 9)

    badge(c, 35, H - 38, "/ 08  TEAM & PEER ASSESSMENT", color=ACCENT)
    heading(c, 35, H - 68, "Who built what", size=22)
    divider(c, 35, H - 76, W - 70)

    members = [
        {
            "name": "Roméo Maignal",
            "sciper": "360568",
            "colour": ACCENT,
            "tasks": [
                ("Website skeleton & CI/CD",
                 "Set up the React + Vite + TailwindCSS project and the GitHub Pages "
                 "pipeline. Getting everything to render properly on Pages was tricky: "
                 "Vite's base path had to be configured manually or all asset URLs broke "
                 "on deploy while working fine locally."),
                ("Visualization 1 - Manufacturer bar chart",
                 "Grouped bar chart with D3 scaleBand, dropdown filters and animated "
                 "transitions. GitHub Pages kept serving cached JSON so we added "
                 "cache-busting to the data fetch to make sure the latest file "
                 "was always loaded."),
                ("Visualization 2 - Airline bubble chart",
                 "D3 force-simulation bubble chart with year slider and glow-on-hover. "
                 "The navbar backdrop-blur worked on the dev server but broke on "
                 "GitHub Pages, so we used a solid background for the deployed version."),
                ("Process Book",
                 "Wrote and generated the Process Book PDF for Milestone 3 using "
                 "ReportLab, documenting all six visualizations, design decisions, "
                 "challenges, and team contributions."),
            ]
        },
        {
            "name": "Jakub Kielar",
            "sciper": "423372",
            "colour": ACCENT2,
            "tasks": [
                ("Visualization 3 - Heatmap + Treemap",
                 "Mercator choropleth with custom latitude clipping linked to a treemap "
                 "with cross-highlighting. The TopoJSON bundle was large enough to "
                 "cause a blank map on GitHub Pages, fixed by lazy-loading the file "
                 "and showing a loading state in the meantime."),
                ("Visualization 4 - Interactive Globe",
                 "3D orthographic globe with arc drawing, auto-rotate and drag. "
                 "On GitHub Pages the globe sometimes started spinning before assets "
                 "finished loading, showing blank frames. Waiting for all files "
                 "before starting the animation fixed it."),
            ]
        },
        {
            "name": "Nicolas Karmolinski",
            "sciper": "316655",
            "colour": ACCENT3,
            "tasks": [
                ("Visualization 5 - Poisson distribution model",
                 "Dropped the airline filter since too many carriers are discontinued, "
                 "making results hard to read. Used decade presets instead of single "
                 "years for more useful estimates. Cached log-factorials to avoid "
                 "floating-point overflow for large k values."),
                ("Visualization 6 - Directed chord diagram",
                 "Finding the right number of nodes took trial and error to keep the "
                 "chart readable without losing too much detail. Removed self-connecting "
                 "arcs as they looked cluttered. Arc width is proportional to "
                 "crash-flow volume between regions."),
                ("Screencast",
                 "Recorded and edited the screencast for Milestone 3, demonstrating "
                 "all six visualizations and the interactive features of the website."),
            ]
        },
    ]

    my = H - 105
    for m in members:
        col = m["colour"]
        nh = 28 + len(m["tasks"]) * 52
        rounded_rect(c, 35, my - nh, W - 70, nh, fill_color=SURFACE, stroke_color=col, stroke_width=0.8)
        accent_bar(c, 35, my - nh, h=nh, w=4, color=col)

        # Avatar
        c.setFillColor(HexColor("#ede9fe"))
        c.circle(58, my - 14, 12, fill=1, stroke=0)
        c.setFont("Helvetica-Bold", 11)
        c.setFillColor(col)
        init = m["name"][0]
        iw = c.stringWidth(init, "Helvetica-Bold", 11)
        c.drawString(58 - iw / 2, my - 18, init)

        # Name & SCIPER
        c.setFont("Helvetica-Bold", 11)
        c.setFillColor(WHITE)
        c.drawString(76, my - 10, m["name"])
        c.setFont("Helvetica", 7.5)
        c.setFillColor(GREY)
        c.drawString(76, my - 22, f"SCIPER {m['sciper']}")

        # Tasks
        ty = my - 40
        for task_title, task_desc in m["tasks"]:
            c.setFillColor(HexColor("#fafafa"))
            c.rect(46, ty - 26, W - 90, 30, fill=1, stroke=0)
            c.setFont("Helvetica-Bold", 7.5)
            c.setFillColor(col)
            c.drawString(52, ty - 4, f"▸  {task_title}")
            body_text(c, 52, ty - 15, task_desc, size=7, color=GREY,
                      max_width=W - 102, line_height=10)
            ty -= 36

        my -= nh + 10

    # Overall contribution split — vertical layout so all three names stay within the box
    rounded_rect(c, 35, 40, W - 70, 62, fill_color=SURFACE, stroke_color=BORDER)
    c.setFont("Helvetica-Bold", 7.5)
    c.setFillColor(ACCENT)
    c.drawString(46, 92, "Contribution split (estimated):")
    divider(c, 46, 86, W - 92, color=BORDER, thickness=0.3)
    splits = [
        ("Roméo Maignal",      "≈ 34 %  ·  skeleton + Viz 1 & 2", ACCENT),
        ("Jakub Kielar",       "≈ 33 %  ·  Viz 3 & 4",            ACCENT2),
        ("Nicolas Karmolinski","≈ 33 %  ·  Viz 5 & 6",            ACCENT3),
    ]
    sy = 78
    for name, pct, col in splits:
        c.setFont("Helvetica-Bold", 7)
        c.setFillColor(col)
        c.drawString(46, sy, f"■  {name}:")
        nw = c.stringWidth(f"■  {name}:", "Helvetica-Bold", 7)
        c.setFont("Helvetica", 7)
        c.setFillColor(GREY)
        c.drawString(46 + nw + 5, sy, pct)
        sy -= 11


# ═══════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════
def main():
    out = os.path.join(os.path.dirname(__file__), "Process-Book.pdf")
    c = canvas.Canvas(out, pagesize=A4)
    c.setTitle("Flight Inspectors – Process Book")
    c.setAuthor("Roméo Maignal, Nicolas Karmolinski, Jakub Kielar")
    c.setSubject("COM-480 Data Visualization · EPFL · 2026")

    pages = [
        page_cover,
        page_overview,
        page_planning,
        page_website_foundation,
        page_viz12,
        page_viz34,
        page_viz5,
        page_viz6,
        page_contributions,
    ]
    for fn in pages:
        fn(c)
        c.showPage()

    c.save()
    print(f"PDF written to {out}")


if __name__ == "__main__":
    main()

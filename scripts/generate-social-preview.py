#!/usr/bin/env python3
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "assets"
OUT_PATH = OUT_DIR / "social-preview.png"
WIDTH = 1280
HEIGHT = 640
BG = "#0b1220"
PANEL = "#121b2e"
PANEL_ALT = "#0f1728"
TEXT = "#f3f6fb"
MUTED = "#aab6cc"
ACCENT = "#7c5cff"
ACCENT_2 = "#2dd4bf"
ACCENT_3 = "#38bdf8"


def load_font(size: int, bold: bool = False):
    candidates = []
    if bold:
        candidates.extend(
            [
                "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
                "/System/Library/Fonts/Supplemental/Helvetica.ttc",
                "/Library/Fonts/Arial Bold.ttf",
            ]
        )
    else:
        candidates.extend(
            [
                "/System/Library/Fonts/Supplemental/Arial.ttf",
                "/System/Library/Fonts/Supplemental/Helvetica.ttc",
                "/Library/Fonts/Arial.ttf",
            ]
        )
    for candidate in candidates:
        path = Path(candidate)
        if path.exists():
            return ImageFont.truetype(str(path), size=size)
    return ImageFont.load_default()


def rounded_box(draw: ImageDraw.ImageDraw, box, radius, fill, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def measure_text(draw, text, font):
    left, top, right, bottom = draw.textbbox((0, 0), text, font=font)
    return right - left, bottom - top


def draw_label(draw, x, y, text, font, fill):
    draw.text((x, y), text, font=font, fill=fill)


def wrap_text(draw, text, font, max_width):
    words = text.split()
    lines = []
    current = []
    for word in words:
        candidate = " ".join(current + [word])
        width, _ = measure_text(draw, candidate, font)
        if current and width > max_width:
            lines.append(" ".join(current))
            current = [word]
        else:
            current.append(word)
    if current:
        lines.append(" ".join(current))
    return "\n".join(lines)


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    image = Image.new("RGB", (WIDTH, HEIGHT), BG)
    draw = ImageDraw.Draw(image)

    title_font = load_font(64, bold=True)
    subtitle_font = load_font(28, bold=False)
    small_font = load_font(24, bold=False)
    badge_font = load_font(20, bold=True)
    card_title_font = load_font(34, bold=True)
    card_body_font = load_font(20, bold=False)

    rounded_box(draw, (56, 56, WIDTH - 56, HEIGHT - 56), 36, PANEL_ALT, outline="#1d2a45", width=2)
    rounded_box(draw, (72, 72, 708, HEIGHT - 72), 28, PANEL)
    rounded_box(draw, (730, 72, WIDTH - 72, HEIGHT - 72), 28, "#0d1526")

    rounded_box(draw, (104, 108, 220, 146), 18, "#17233a")
    draw_label(draw, 124, 116, "GEMINI-FIRST", badge_font, ACCENT_2)

    draw_label(draw, 104, 184, "Gemini UI", title_font, TEXT)
    draw_label(draw, 104, 252, "Workbench", title_font, TEXT)
    draw_label(draw, 104, 334, "UI review • pack gating • authenticated capture", subtitle_font, MUTED)
    draw_label(draw, 104, 386, "Tools for Gemini-first frontend workflows", small_font, TEXT)

    line_y = 468
    draw.rounded_rectangle((104, line_y, 580, line_y + 6), radius=3, fill="#1e2d4f")
    draw.rounded_rectangle((104, line_y, 260, line_y + 6), radius=3, fill=ACCENT)

    blocks = [
        ("Review", "Persist design sessions and inspect implementation packs.", ACCENT),
        ("Gate", "Check file maps, imports, path bounds, and overwrite safety.", ACCENT_2),
        ("Capture", "Take authenticated screenshots against synthetic or live apps.", ACCENT_3),
    ]

    left = 770
    top = 126
    block_w = 438
    block_h = 118
    gap = 26

    for index, (title, body, accent) in enumerate(blocks):
        y0 = top + index * (block_h + gap)
        rounded_box(draw, (left, y0, left + block_w, y0 + block_h), 24, "#111c31", outline="#21304f", width=2)
        draw.rounded_rectangle((left + 24, y0 + 24, left + 36, y0 + 94), radius=6, fill=accent)
        draw_label(draw, left + 60, y0 + 22, title, card_title_font, TEXT)
        wrapped = wrap_text(draw, body, card_body_font, max_width=block_w - 92)
        draw.multiline_text((left + 60, y0 + 62), wrapped, font=card_body_font, fill=MUTED, spacing=6)

    connector_x = 734
    connector_y = 192
    for index, accent in enumerate([ACCENT, ACCENT_2, ACCENT_3]):
        y = connector_y + index * (block_h + gap)
        draw.line((connector_x, y, 748, y), fill=accent, width=4)
        draw.ellipse((724, y - 10, 744, y + 10), fill=accent)

    footer = "github.com/mbosley/gemini-ui-workbench"
    footer_w, footer_h = measure_text(draw, footer, small_font)
    draw_label(draw, WIDTH - 90 - footer_w, HEIGHT - 92, footer, small_font, MUTED)

    image.save(OUT_PATH, format="PNG")
    print(OUT_PATH)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Render `docs/test-output.txt` as a terminal-style PNG."""

import re
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).parent
SRC = ROOT / "test-output.txt"
OUT = ROOT / "tests-passing.png"

BG = (24, 25, 33)
FG = (220, 223, 228)
GREEN = (152, 195, 121)
DIM = (160, 165, 175)
HEADER = (231, 197, 113)

CANDIDATE_FONTS = [
    "/System/Library/Fonts/Menlo.ttc",
    "/System/Library/Fonts/SFMono-Regular.otf",
    "/System/Library/Fonts/Monaco.dfont",
    "/Library/Fonts/Andale Mono.ttf",
]


def load_font(size: int):
    for path in CANDIDATE_FONTS:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def color_for(line: str):
    stripped = line.lstrip()
    if stripped.startswith("✔"):
        return GREEN
    if "passing" in stripped:
        return GREEN
    if re.match(r"^(amm|initialize|deposit|swap|withdraw|lock / unlock)$", stripped):
        return HEADER
    if stripped.startswith("$") or stripped.startswith("Running") or stripped.startswith("Found"):
        return DIM
    if stripped.startswith("Done in") or stripped.startswith("yarn"):
        return DIM
    return FG


def main():
    raw_lines = SRC.read_text().splitlines()
    # Filter out warnings, blank padding at top/bottom
    keep = []
    skip_patterns = (
        "Reparsing",
        "MODULE_TYPELESS_PACKAGE_JSON",
        "To eliminate this warning",
        "Use `node --trace-warnings",
        "Finished",
        "Running unittests",
    )
    for ln in raw_lines:
        if any(p in ln for p in skip_patterns):
            continue
        keep.append(ln)

    # Trim leading / trailing blank lines
    while keep and not keep[0].strip():
        keep.pop(0)
    while keep and not keep[-1].strip():
        keep.pop()

    font_size = 16
    font = load_font(font_size)
    line_h = font_size + 8
    pad_x = 32
    pad_y = 28
    width = 1000
    height = pad_y * 2 + line_h * len(keep)

    img = Image.new("RGB", (width, height), BG)
    draw = ImageDraw.Draw(img)

    # Window chrome (three macOS-style dots)
    for i, dot_color in enumerate(((255, 95, 86), (255, 189, 46), (39, 201, 63))):
        cx = 22 + i * 22
        cy = 18
        r = 7
        draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=dot_color)

    y = pad_y + 6
    for ln in keep:
        draw.text((pad_x, y), ln, fill=color_for(ln), font=font)
        y += line_h

    img.save(OUT)
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()

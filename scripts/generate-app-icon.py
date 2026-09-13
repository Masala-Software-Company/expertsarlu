#!/usr/bin/env python3
"""Génère l'icône eXpert adaptée aux conventions desktop.

- macOS / Windows / Linux : pastille squircle (rayon ~22.37 %), coins transparents
- Source : logo/IMG_5731.jpg (blanc sur bleu #144EB9)
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
LOGO = ROOT / "logo" / "IMG_5731.jpg"
OUT_DIR = ROOT / "frontend" / "src-tauri" / "icons"
ASSETS = ROOT / "frontend" / "src" / "assets" / "logos"
PUBLIC = ROOT / "frontend" / "public"

MAC_CORNER_RATIO = 0.2237
BRAND_BLUE = (20, 78, 185, 255)
SAFE_MARGIN = 0.16


def squircle_mask(size: int, ratio: float = MAC_CORNER_RATIO) -> Image.Image:
    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle(
        (0, 0, size - 1, size - 1),
        radius=size * ratio,
        fill=255,
    )
    return mask


def build_master(size: int = 1024) -> Image.Image:
    logo = Image.open(LOGO).convert("RGBA")

    # Fond bleu plein, wordmark centré avec safe-zone
    base = Image.new("RGBA", (size, size), BRAND_BLUE)
    margin = int(size * SAFE_MARGIN)
    max_w, max_h = size - 2 * margin, size - 2 * margin
    w, h = logo.size
    scale = min(max_w / w, max_h / h)
    nw, nh = max(1, int(w * scale)), max(1, int(h * scale))
    logo_r = logo.resize((nw, nh), Image.Resampling.LANCZOS)
    x = (size - nw) // 2
    y = (size - nh) // 2
    base.paste(logo_r, (x, y))

    # Appliquer le masque squircle (coins 100 % transparents)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(base, (0, 0))
    out.putalpha(squircle_mask(size))
    return out


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    ASSETS.mkdir(parents=True, exist_ok=True)
    PUBLIC.mkdir(parents=True, exist_ok=True)

    master = build_master(1024)
    master.save(OUT_DIR / "app-icon-1024.png", "PNG")
    master.save(OUT_DIR / "icon-source.png", "PNG")
    master.save(ASSETS / "app-icon.png", "PNG")
    master.save(PUBLIC / "app-icon.png", "PNG")
    print(f"OK → {OUT_DIR / 'icon-source.png'}")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Color-safe embedding/export helper.

Use cases:
- Preserve original ICC profile while exporting
- Convert to a target ICC profile using LCMS (via Pillow ImageCms)
"""

from __future__ import annotations

import argparse
import pathlib
import sys
from typing import Optional, Tuple


def _load_pillow_modules():
    try:
        from PIL import Image, ImageCms  # type: ignore
        return Image, ImageCms
    except Exception as exc:  # pragma: no cover
        print(
            "Fehler: Pillow/ImageCms nicht verfuegbar. Bitte installieren mit:\n"
            "  python3 -m pip install -r requirements.txt",
            file=sys.stderr,
        )
        raise SystemExit(2) from exc


def _read_bytes(path: Optional[pathlib.Path]) -> Optional[bytes]:
    if path is None:
        return None
    return path.read_bytes()


def _ensure_jpeg_compatible(image, background_rgb: Tuple[int, int, int]):
    """Convert alpha modes to RGB (white/selected background), keep others if possible."""
    if image.mode in ("RGB", "L", "CMYK"):
        return image

    if "A" in image.mode:
        base = image.convert("RGBA")
        bg = image.__class__.new("RGBA", base.size, (*background_rgb, 255))
        flattened = image.__class__.alpha_composite(bg, base)
        return flattened.convert("RGB")

    return image.convert("RGB")


def _convert_profile(image, image_cms, source_icc: bytes, target_icc_path: pathlib.Path):
    src_profile = image_cms.ImageCmsProfile(source_icc)
    dst_profile = image_cms.getOpenProfile(str(target_icc_path))

    # Convert into a mode that JPEG can encode safely.
    out_mode = "RGB" if image.mode not in ("L", "CMYK") else image.mode
    return image_cms.profileToProfile(
        image,
        src_profile,
        dst_profile,
        outputMode=out_mode,
        renderingIntent=0,
    )


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Farbsicherer Bildexport mit ICC-Profil-Steuerung"
    )
    parser.add_argument("--input", required=True, help="Pfad zur Quelldatei")
    parser.add_argument("--output", required=True, help="Pfad zur Zieldatei (.jpg/.jpeg/.tif/.tiff/.png)")
    parser.add_argument(
        "--mode",
        choices=["preserve", "convert"],
        default="preserve",
        help="preserve = Quellprofil einbetten; convert = in Zielprofil konvertieren und dieses einbetten",
    )
    parser.add_argument(
        "--target-icc",
        default=None,
        help="Pfad zum Ziel-ICC (nur fuer --mode convert)",
    )
    parser.add_argument(
        "--fallback-icc",
        default=None,
        help="ICC verwenden, falls die Quelldatei kein Profil enthaelt",
    )
    parser.add_argument(
        "--quality",
        type=int,
        default=98,
        help="JPEG-Qualitaet (1-100), Standard 98",
    )
    parser.add_argument(
        "--subsampling",
        choices=["keep", "444", "422", "420"],
        default="444",
        help="JPEG Chroma-Subsampling: 444 minimiert Farbdifferenzen",
    )
    parser.add_argument(
        "--bg",
        default="255,255,255",
        help="RGB-Hintergrund bei Alpha (z.B. 255,255,255)",
    )
    return parser


def _parse_bg(text: str) -> Tuple[int, int, int]:
    parts = [p.strip() for p in text.split(",")]
    if len(parts) != 3:
        raise ValueError("--bg muss als R,G,B angegeben werden")
    values = tuple(max(0, min(255, int(p))) for p in parts)
    return values  # type: ignore[return-value]


def main() -> int:
    parser = _build_parser()
    args = parser.parse_args()

    Image, ImageCms = _load_pillow_modules()

    in_path = pathlib.Path(args.input)
    out_path = pathlib.Path(args.output)

    if not in_path.exists():
        print(f"Fehler: Eingabedatei nicht gefunden: {in_path}", file=sys.stderr)
        return 2

    target_icc_path = pathlib.Path(args.target_icc) if args.target_icc else None
    fallback_icc_path = pathlib.Path(args.fallback_icc) if args.fallback_icc else None

    if args.mode == "convert" and target_icc_path is None:
        print("Fehler: --target-icc ist bei --mode convert erforderlich", file=sys.stderr)
        return 2

    if target_icc_path and not target_icc_path.exists():
        print(f"Fehler: Ziel-ICC nicht gefunden: {target_icc_path}", file=sys.stderr)
        return 2

    if fallback_icc_path and not fallback_icc_path.exists():
        print(f"Fehler: Fallback-ICC nicht gefunden: {fallback_icc_path}", file=sys.stderr)
        return 2

    background_rgb = _parse_bg(args.bg)

    with Image.open(in_path) as source:
        source_icc = source.info.get("icc_profile")
        fallback_icc = _read_bytes(fallback_icc_path)
        selected_icc = source_icc if source_icc else fallback_icc

        working = source.copy()

        if args.mode == "convert":
            if not selected_icc:
                print(
                    "Fehler: Keine Quellprofil-Information vorhanden und kein --fallback-icc gesetzt.",
                    file=sys.stderr,
                )
                return 2
            working = _convert_profile(working, ImageCms, selected_icc, target_icc_path)
            out_icc = _read_bytes(target_icc_path)
        else:
            out_icc = selected_icc

        ext = out_path.suffix.lower()
        save_kwargs = {}

        if ext in (".jpg", ".jpeg"):
            working = _ensure_jpeg_compatible(working, background_rgb)
            save_kwargs.update(
                {
                    "format": "JPEG",
                    "quality": max(1, min(100, int(args.quality))),
                    "optimize": True,
                    "progressive": True,
                }
            )
            if args.subsampling != "keep":
                save_kwargs["subsampling"] = args.subsampling
        elif ext in (".tif", ".tiff"):
            save_kwargs.update({"format": "TIFF", "compression": "tiff_lzw"})
        elif ext == ".png":
            save_kwargs.update({"format": "PNG", "compress_level": 6})
        else:
            print(
                "Fehler: Nicht unterstuetztes Zielformat. Nutze .jpg/.jpeg/.tif/.tiff/.png",
                file=sys.stderr,
            )
            return 2

        if out_icc:
            save_kwargs["icc_profile"] = out_icc

        out_path.parent.mkdir(parents=True, exist_ok=True)
        working.save(out_path, **save_kwargs)

        profile_state = "eingebettet" if out_icc else "kein Profil eingebettet"
        print(f"OK: {out_path} ({profile_state}, Modus: {args.mode})")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

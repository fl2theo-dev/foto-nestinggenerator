# Color-Safe Embedder

Kleines CLI-Tool fuer farbsicheren Export mit ICC-Profil-Steuerung.

## Ziel
- Quellprofil beim Export beibehalten (wenn vorhanden)
- Optional in ein Zielprofil konvertieren und dieses einbetten
- JPEG mit 4:4:4 exportieren, um Farbabweichungen durch Subsampling zu minimieren

## Installation

```bash
cd tools/color-safe-embedder
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -U pip
python -m pip install -r requirements.txt
```

## Nutzung

### 1) Quellprofil erhalten (preserve)

```bash
python embed_color_safe.py \
  --input /pfad/input.jpg \
  --output /pfad/output.jpg \
  --mode preserve \
  --fallback-icc ../../app/assets/AdobeRGB1998.icc
```

Hinweis:
- Wenn das Input ein eingebettetes Profil hat, wird dieses genutzt.
- Wenn kein Profil enthalten ist, wird `--fallback-icc` verwendet (falls gesetzt).

### 2) In Zielprofil konvertieren (convert)

```bash
python embed_color_safe.py \
  --input /pfad/input.jpg \
  --output /pfad/output.jpg \
  --mode convert \
  --target-icc ../../app/assets/sRGB.icc \
  --fallback-icc ../../app/assets/AdobeRGB1998.icc
```

## Wichtige Parameter
- `--quality 98`: JPEG-Qualitaet
- `--subsampling 444`: minimiert Chroma-Verluste
- `--bg 255,255,255`: Hintergrund fuer alpha-haltige Inputs bei JPEG

## Empfehlung fuer Proof-nahe Ergebnisse
- Wenn moeglich TIFF statt JPEG nutzen.
- Falls JPEG noetig: `--subsampling 444`, hohe Qualitaet, nur ein Save-Schritt.
- Immer im gleichen farbverwalteten Viewer pruefen.

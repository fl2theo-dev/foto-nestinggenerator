# Foto-Nestinggenerator

Projekt fuer automatisches Foto-Nesting auf Rollenmaterial mit Regmarks und dualem Export:

- Druckdatei: Motive + Regmarks
- Konturdatei: Regmarks + Schneidekontur

## Aktueller Stand

- Konzept und UI-Dummy in [docs/index.html](docs/index.html)
- Erster App-MVP in [app/index.html](app/index.html)
- Lokale Versionierung via Git

## Entwicklungsstart

1. Projekt oeffnen.
2. Einmal `npm install` ausfuehren (lokale jsPDF-Datei).
2. [app/index.html](app/index.html) im Browser starten (MVP-App).
3. Optional: [docs/index.html](docs/index.html) fuer Konzept/Versionierung oeffnen.
4. Aenderungen in kleinen Commits versionieren.

## Hochwertiger Druck (lokal, mit ICC)

1. In der App `Druck-PDF` erzeugen.
2. Passendes ICC-Profil bereitstellen (z. B. vom RIP/Druckdienstleister).
3. Mit Ghostscript konvertieren:

```bash
npm run pdfx:convert -- --in druck_motive_regmarks.pdf --out druck_pdfx.pdf --icc ./profiles/DEIN_PROFIL.icc
```

Hinweis: Die finale PDF/X-Konformitaet sollte immer im RIP/Preflight geprueft werden.

## Release-Eintrag automatisieren

Beispiel:

```bash
npm run release:add -- --version 0.1.4 --date 2026-05-21 --summary "Neue Funktion" --change "Punkt 1" --change "Punkt 2"
```

Das Script schreibt den Eintrag direkt in `docs/versions.json` an erster Stelle.

# Foto-Nestinggenerator

Projekt fuer automatisches Foto-Nesting auf Rollenmaterial mit Regmarks und dualem Export:

- Druckdatei: JPEG (Motive + Regmarks, ICC-Profil aus Import bzw. AdobeRGB-Fallback)
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

## Standalone-Desktop (empfohlen)

Die App kann als Desktop-Anwendung gestartet werden und bietet dann zusaetzlich
den nativen Button `Druckfertig (Desktop)` fuer einen robusteren Produktions-Export.

```bash
npm run desktop:dev
```

Installer bauen (macOS/Windows/Linux):

```bash
npm run desktop:build
```

## Neue Kernfunktionen

- Mehrseiten-Nesting (automatische Verteilung auf Seite 1..n)
- Projekt speichern/laden als JSON (inkl. Layout)
- Hotfolder-Export direkt aus der App (wo Browser-API verfuegbar)
- Ubuntu-Setup-Skript: `scripts/setup-ubuntu.sh`
- Barcode wird als Code mit zusaetzlichem `X` dargestellt (Dateiname der Kontur bleibt ohne `X`)
- Profilhinweis pro Motiv in der Liste
- Weissrandmodus mit separater Zielgroesse (Bildgroesse + Zielbreite/Zielhoehe)

## Ubuntu Schnellsetup

```bash
./scripts/setup-ubuntu.sh
```

Optional mit Auto-Installation:

```bash
./scripts/setup-ubuntu.sh --install
```

## Hochwertiger Druck (lokal, mit ICC)

1. In der App `Druck-JPEG` erzeugen (Profil wird aus Import uebernommen, Fallback: AdobeRGB nur ohne eingebettetes Profil).
2. Bei gemischten Profilen auf demselben Bogen bricht der Export absichtlich ab; Profile bitte vorab vereinheitlichen.
3. Falls ein PDF/X-Workflow notwendig ist: zunaechst aus JPEG/Pipeline ein PDF erzeugen und dann mit passendem ICC-Profil konvertieren.
4. Fuer bestehende PDF-Konvertierung via Ghostscript:

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

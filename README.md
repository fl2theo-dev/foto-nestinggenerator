# Foto-Nestinggenerator

Projekt fuer automatisches Foto-Nesting auf Rollenmaterial mit Regmarks und dualem Export:

- Druckdatei: Motive + Regmarks
- Konturdatei: Regmarks + Schneidekontur

## Aktueller Stand

- Konzept und UI-Dummy in [docs/index.html](docs/index.html)
- Lokale Versionierung via Git

## Entwicklungsstart

1. Projekt oeffnen.
2. [docs/index.html](docs/index.html) im Browser starten.
3. Aenderungen in kleinen Commits versionieren.

## Release-Eintrag automatisieren

Beispiel:

```bash
npm run release:add -- --version 0.1.4 --date 2026-05-21 --summary "Neue Funktion" --change "Punkt 1" --change "Punkt 2"
```

Das Script schreibt den Eintrag direkt in `docs/versions.json` an erster Stelle.

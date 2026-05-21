# Changelog

Alle nennenswerten Aenderungen an diesem Projekt werden hier dokumentiert.

## [0.2.1] - 2026-05-21

### Changed

- Nesting in `app/main.js` von einfacher Zeilenplatzierung auf MaxRects (BSSF) umgestellt.
- Regmark-Footprint wird beim Packen als reale Flaechenreserve beruecksichtigt.
- Freiflaechen-Splitting und Contained-Pruning fuer stabilere Layout-Ergebnisse ergaenzt.

## [0.2.0] - 2026-05-21

### Added

- Erster lauffaehiger App-MVP unter `app/index.html` angelegt.
- Upload mehrerer Fotos, Rollenbreite/Max-Hoehe und Nesting-Start implementiert.
- Regmark-Generierung (4 Punkte je Motiv, 5 mm Durchmesser, 3 mm Abstand) in Vorschau und Export integriert.
- Export von Druck-SVG und Kontur-SVG auf Basis derselben Geometriedaten umgesetzt.

## [0.1.3] - 2026-05-21

### Added

- Zweiter Button in der Versionierungsansicht, der einen CLI-Befehl erzeugt und kopiert.
- Neues Script `scripts/add-release.js` fuer direktes Schreiben in `docs/versions.json`.
- `package.json` mit `npm run release:add` fuer den lokalen Release-Workflow.

## [0.1.2] - 2026-05-21

### Added

- Release-Template-Generator in der Versionierungsansicht von `docs/index.html` hinzugefuegt.
- Eingabemaske fuer Version, Datum, Summary und Aenderungspunkte integriert.
- JSON-Template-Ausgabe mit Copy-Button fuer schnelle Pflege von `docs/versions.json` umgesetzt.

## [0.1.1] - 2026-05-21

### Added

- Automatische Versionierungsdarstellung in `docs/index.html` eingebaut.
- Neue Datenquelle `docs/versions.json` fuer den Release-Verlauf angelegt.
- Fallback-Rendering fuer lokale/offline Nutzung (z. B. `file://`) integriert.

## [0.1.0] - 2026-05-21

### Added

- Projektordner `foto-nestinggenerator` erstellt.
- Konzeptseite als formatierte HTML unter `docs/index.html` angelegt.
- Interaktiver UI-Dummy fuer Nesting-Vorschau integriert.
- Versionierungsbereich in der Konzept-HTML ergaenzt.
- Git-Repository fuer nachvollziehbare Entwicklung vorbereitet.

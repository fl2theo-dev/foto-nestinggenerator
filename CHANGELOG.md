# Changelog

Alle nennenswerten Aenderungen an diesem Projekt werden hier dokumentiert.

## [0.3.4] - 2026-05-22

### Changed

- Barcode zeigt jetzt den Code mit angehaengtem `X`; der Dateiname der Konturdatei bleibt ohne `X`.
- Profilhandling geschaerft: vorhandene ICC-Profile werden beibehalten; bei gemischten Profilen auf einem Bogen bricht der Export mit Hinweis ab.
- Motivliste zeigt pro Bild den Hinweis auf das erkannte Farbprofil.
- Weissrand erweitert um Zielgroessenmodus (Bildgroesse separat von Zielbreite/Zielhoehe, Bild wird im Zielbereich zentriert platziert).
- Fix fuer Zielgroessenmodus: Komma-Eingaben werden korrekt uebernommen und die automatische Ratio-Kopplung ueberschreibt im Zielmodus keine Werte mehr.
- App- und Paketversion auf 0.3.4 angehoben.

## [0.3.3] - 2026-05-22

### Changed

- Druckexport in der App von Druck-PDF auf Druck-JPEG pro Seite umgestellt.
- ICC-Profilfuehrung im Druck-JPEG verbindlich gemacht: Importprofil wird beibehalten, sonst AdobeRGB1998 als Fallback.
- Hotfolder-Export auf Druck-JPEG plus Kontur-PDF aktualisiert.
- App-Version in der UI auf Foto NG [0.3.3] angehoben.

## [0.3.0] - 2026-05-21

### Added

- Mehrseiten-Nesting in der App inklusive Seitennavigation.
- Projekt speichern/laden als JSON-Datei.
- Hotfolder-Export (Druck-/Kontur-PDF direkt in ausgewaehltes Verzeichnis, falls Browser-API verfuegbar).
- Ubuntu-Setup-Skript `scripts/setup-ubuntu.sh`.

### Changed

- App-Layout auf unabhaengig scrollbare drei Bereiche umgestellt (links Steuerung, Mitte Vorschau, rechts Fotoliste).

## [0.2.3] - 2026-05-21

### Added

- Lokale jsPDF-Nutzung (ohne CDN) in der App.
- Neues Script `scripts/make-pdfx.js` fuer ICC-basierten High-Quality-Postprozess via Ghostscript.
- NPM-Skript `pdfx:convert` fuer reproduzierbaren lokalen Produktionsworkflow.

### Changed

- PDF-Export in `app/main.js` auf hohe Qualitaet (keine Kompression, hohe Praezision) angepasst.

## [0.2.2] - 2026-05-21

### Changed

- Bilddarstellung bei Rotation in `app/main.js` auf verzerrungsfreie Darstellung angepasst.
- Export in der App auf `Druck-PDF` und `Kontur-PDF` umgestellt.

### Added

- Manuelle Eingriffe ins Nesting: Auswahl per Canvas-Klick, Verschieben, Rotation und Zurueck-in-Liste.
- Kollisions- und Bounds-Checks fuer manuelle Bewegungen und Rotationen.

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

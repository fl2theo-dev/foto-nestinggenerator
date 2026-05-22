# Foto NG Desktop

Electron-Standalone fuer den operativen Workflow mit nativer Druckausgabe.

## Entwicklung starten

```bash
npm install
npm run desktop:dev
```

## Installer bauen

```bash
npm run desktop:build
```

## Was neu ist

- Renderer (bestehende UI) bleibt fuer Nesting und Bedienung.
- "Druckfertig (Desktop)" rendert Seiten nativ per Sharp im Mainprozess.
- Profilmodus folgt dem UI-Schalter:
  - `none`
  - `srgb`
  - `source` (fällt auf AdobeRGB zurueck, wenn kein eingebettetes Profil vorhanden ist)

Hinweis:
- Fuer den Desktop-Export werden Originaldateipfade benoetigt. Bei geladenen Projektdateien ohne Quellpfad muss das Motiv neu geladen werden.

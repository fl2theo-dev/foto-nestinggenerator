#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const args = { changes: [] };

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--version') {
      args.version = argv[++i];
    } else if (token === '--date') {
      args.date = argv[++i];
    } else if (token === '--summary') {
      args.summary = argv[++i];
    } else if (token === '--change') {
      args.changes.push(argv[++i]);
    } else if (token === '--allow-duplicate') {
      args.allowDuplicate = true;
    } else if (token === '--help' || token === '-h') {
      args.help = true;
    } else {
      throw new Error(`Unbekannter Parameter: ${token}`);
    }
  }

  return args;
}

function usage() {
  return [
    'Verwendung:',
    '  node scripts/add-release.js --version 0.1.3 --date 2026-05-21 --summary "Kurztext" --change "Punkt 1" --change "Punkt 2"',
    '',
    'Optionen:',
    '  --allow-duplicate   Erlaubt doppelte Versionsnummern (standard: aus).',
    '  --help, -h          Zeigt diese Hilfe an.'
  ].join('\n');
}

function ensureString(value, fieldName) {
  if (!value || typeof value !== 'string' || !value.trim()) {
    throw new Error(`Pflichtfeld fehlt: ${fieldName}`);
  }
  return value.trim();
}

function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
      console.log(usage());
      process.exit(0);
    }

    const version = ensureString(args.version, '--version');
    const date = ensureString(args.date, '--date');
    const summary = ensureString(args.summary, '--summary');
    const changes = Array.isArray(args.changes)
      ? args.changes.map((c) => String(c || '').trim()).filter(Boolean)
      : [];

    if (changes.length === 0) {
      throw new Error('Mindestens ein --change Eintrag ist erforderlich.');
    }

    const filePath = path.resolve(__dirname, '..', 'docs', 'versions.json');
    const raw = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(raw);

    if (!Array.isArray(data.releases)) {
      throw new Error('Ungueltiges JSON: releases muss ein Array sein.');
    }

    if (!args.allowDuplicate && data.releases.some((r) => r && r.version === version)) {
      throw new Error(`Version ${version} existiert bereits. Nutze neue Version oder --allow-duplicate.`);
    }

    const entry = { version, date, summary, changes };
    data.releases.unshift(entry);

    fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
    console.log(`Release ${version} wurde in docs/versions.json eingetragen.`);
  } catch (error) {
    console.error(`Fehler: ${error.message}`);
    console.error('');
    console.error(usage());
    process.exit(1);
  }
}

main();

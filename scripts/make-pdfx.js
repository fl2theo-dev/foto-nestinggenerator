#!/usr/bin/env node

const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--in') args.input = argv[++i];
    else if (t === '--out') args.output = argv[++i];
    else if (t === '--icc') args.icc = argv[++i];
    else if (t === '--help' || t === '-h') args.help = true;
    else throw new Error(`Unbekannter Parameter: ${t}`);
  }
  return args;
}

function usage() {
  return [
    'Verwendung:',
    '  node scripts/make-pdfx.js --in druck_motive_regmarks.pdf --out druck_pdfx.pdf --icc ./profiles/ISOcoated_v2_eci.icc',
    '',
    'Hinweis:',
    '  - Ghostscript (gs) muss installiert sein.',
    '  - Das ICC-Profil muss zum Druckprozess passen (mit Druckerei/RIP abstimmen).'
  ].join('\n');
}

function ensureFile(filePath, label) {
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error(`${label} nicht gefunden: ${filePath || '(leer)'}`);
  }
}

function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
      console.log(usage());
      process.exit(0);
    }

    ensureFile(args.input, 'Input-PDF');
    ensureFile(args.icc, 'ICC-Profil');

    const out = args.output || path.resolve(process.cwd(), 'druck_pdfx.pdf');

    const gsArgs = [
      '-dBATCH',
      '-dNOPAUSE',
      '-dSAFER',
      '-sDEVICE=pdfwrite',
      '-dPDFSETTINGS=/prepress',
      '-dAutoRotatePages=/None',
      '-dColorConversionStrategy=/CMYK',
      '-dProcessColorModel=/DeviceCMYK',
      '-dEmbedAllFonts=true',
      '-dSubsetFonts=true',
      `-sOutputFile=${out}`,
      `-sOutputICCProfile=${path.resolve(args.icc)}`,
      path.resolve(args.input)
    ];

    const result = spawnSync('gs', gsArgs, { stdio: 'inherit' });
    if (result.error) {
      throw result.error;
    }
    if (result.status !== 0) {
      throw new Error(`Ghostscript endete mit Exit-Code ${result.status}`);
    }

    console.log(`PDF/X-nahe Ausgabedatei erstellt: ${out}`);
    console.log('Wichtig: finale PDF/X-Konformitaet im RIP/Preflight pruefen.');
  } catch (error) {
    console.error(`Fehler: ${error.message}`);
    console.error('');
    console.error(usage());
    process.exit(1);
  }
}

main();

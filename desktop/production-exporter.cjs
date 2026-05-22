const fs = require('fs/promises');
const path = require('path');
const sharp = require('sharp');

const MM_PER_INCH = 25.4;
const JPEG_ICC_CHUNK_DATA_MAX_BYTES = 65519;

const CODE39_PATTERNS = {
  '0': 'nnnwwnwnn',
  '1': 'wnnwnnnnw',
  '2': 'nnwwnnnnw',
  '3': 'wnwwnnnnn',
  '4': 'nnnwwnnnw',
  '5': 'wnnwwnnnn',
  '6': 'nnwwwnnnn',
  '7': 'nnnwnnwnw',
  '8': 'wnnwnnwnn',
  '9': 'nnwwnnwnn',
  A: 'wnnnnwnnw',
  B: 'nnwnnwnnw',
  C: 'wnwnnwnnn',
  D: 'nnnnwwnnw',
  E: 'wnnnwwnnn',
  F: 'nnwnwwnnn',
  G: 'nnnnnwwnw',
  H: 'wnnnnwwnn',
  I: 'nnwnnwwnn',
  J: 'nnnnwwwnn',
  K: 'wnnnnnnww',
  L: 'nnwnnnnww',
  M: 'wnwnnnnwn',
  N: 'nnnnwnnww',
  O: 'wnnnwnnwn',
  P: 'nnwnwnnwn',
  Q: 'nnnnnnwww',
  R: 'wnnnnnwwn',
  S: 'nnwnnnwwn',
  T: 'nnnnwnwwn',
  U: 'wwnnnnnnw',
  V: 'nwwnnnnnw',
  W: 'wwwnnnnnn',
  X: 'nwnnwnnnw',
  Y: 'wwnnwnnnn',
  Z: 'nwwnwnnnn',
  '-': 'nwnnnnwnw',
  '.': 'wwnnnnwnn',
  ' ': 'nwwnnnwnn',
  '$': 'nwnwnwnnn',
  '/': 'nwnwnnnwn',
  '+': 'nwnnnwnwn',
  '%': 'nnnwnwnwn',
  '*': 'nwnnwnwnn'
};

function mmToPx(mm, pxPerMm) {
  return Math.max(0, Math.round(mm * pxPerMm));
}

function estimateCode39Modules(value, wideFactor = 2.5) {
  const encoded = `*${String(value || '').toUpperCase()}*`;
  let modules = 0;
  for (let i = 0; i < encoded.length; i += 1) {
    const pattern = CODE39_PATTERNS[encoded[i]] || CODE39_PATTERNS['*'];
    for (const token of pattern) {
      modules += token === 'w' ? wideFactor : 1;
    }
    if (i < encoded.length - 1) modules += 1;
  }
  return modules;
}

function escapeXml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildOverlaySvg(page, pxPerMm) {
  const widthPx = Math.max(1, mmToPx(page.widthMm, pxPerMm));
  const heightPx = Math.max(1, mmToPx(page.heightMm, pxPerMm));

  const circles = (page.regmarks || [])
    .map((reg) => {
      const cx = reg.cxMm * pxPerMm;
      const cy = reg.cyMm * pxPerMm;
      const r = reg.rMm * pxPerMm;
      return `<circle cx=\"${cx}\" cy=\"${cy}\" r=\"${r}\" fill=\"#000\" />`;
    })
    .join('');

  const barcode = page.barcode || null;
  let barcodeMarkup = '';
  if (barcode && barcode.text) {
    const value = String(barcode.text || '').toUpperCase();
    const encoded = `*${value}*`;
    const wideFactor = 2.5;
    const modules = estimateCode39Modules(value, wideFactor);
    const textGapMm = 1.5;
    const fontPx = Math.max(9, Math.round(6 * pxPerMm * 1.25));
    const estimatedTextWidthMm = value.length * 1.6;
    const availableBarcodeWidthMm = Math.max(8, barcode.maxWidthMm - textGapMm - estimatedTextWidthMm);
    const moduleWidthMm = Math.max(0.18, Math.min(0.6, availableBarcodeWidthMm / Math.max(1, modules)));
    const barcodeWidthMm = modules * moduleWidthMm;
    const totalWidthMm = barcodeWidthMm + textGapMm + estimatedTextWidthMm;
    const startMm = barcode.xMm + Math.max(0, (barcode.maxWidthMm - totalWidthMm) / 2);
    const yMm = barcode.yMm;

    let cursorMm = startMm;
    const bars = [];
    for (let i = 0; i < encoded.length; i += 1) {
      const pattern = CODE39_PATTERNS[encoded[i]] || CODE39_PATTERNS['*'];
      for (let j = 0; j < pattern.length; j += 1) {
        const widthMm = (pattern[j] === 'w' ? wideFactor : 1) * moduleWidthMm;
        if (j % 2 === 0) {
          bars.push(
            `<rect x=\"${cursorMm * pxPerMm}\" y=\"${yMm * pxPerMm}\" width=\"${Math.max(1, widthMm * pxPerMm)}\" height=\"${barcode.barHeightMm * pxPerMm}\" fill=\"#000\" />`
          );
        }
        cursorMm += widthMm;
      }
      if (i < encoded.length - 1) {
        cursorMm += moduleWidthMm;
      }
    }

    const textX = (startMm + barcodeWidthMm + textGapMm) * pxPerMm;
    const textY = (yMm + barcode.barHeightMm * 0.78) * pxPerMm;
    barcodeMarkup = `${bars.join('')}<text x=\"${textX}\" y=\"${textY}\" fill=\"#000\" font-family=\"Arial, sans-serif\" font-size=\"${fontPx}\">${escapeXml(value)}</text>`;
  }

  return Buffer.from(
    `<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"${widthPx}\" height=\"${heightPx}\" viewBox=\"0 0 ${widthPx} ${heightPx}\">${circles}${barcodeMarkup}</svg>`
  );
}

function hasIccSegmentSignature(bytes, start) {
  const signature = [
    0x49, 0x43, 0x43, 0x5f, 0x50, 0x52, 0x4f, 0x46, 0x49, 0x4c, 0x45, 0x00
  ];
  if (start + signature.length > bytes.length) return false;
  for (let i = 0; i < signature.length; i += 1) {
    if (bytes[start + i] !== signature[i]) return false;
  }
  return true;
}

function concatUint8Arrays(parts) {
  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function removeIccApp2Segments(jpegBytes) {
  const kept = [jpegBytes.slice(0, 2)];
  let offset = 2;

  while (offset + 1 < jpegBytes.length) {
    if (jpegBytes[offset] !== 0xff) {
      kept.push(jpegBytes.slice(offset));
      break;
    }

    const marker = jpegBytes[offset + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      kept.push(jpegBytes.slice(offset, offset + 2));
      offset += 2;
      continue;
    }

    if (marker === 0xda || marker === 0xd9) {
      kept.push(jpegBytes.slice(offset));
      break;
    }

    if (offset + 4 > jpegBytes.length) {
      kept.push(jpegBytes.slice(offset));
      break;
    }

    const segmentLength = (jpegBytes[offset + 2] << 8) | jpegBytes[offset + 3];
    if (segmentLength < 2) {
      kept.push(jpegBytes.slice(offset));
      break;
    }

    const segmentEnd = offset + 2 + segmentLength;
    if (segmentEnd > jpegBytes.length) {
      kept.push(jpegBytes.slice(offset));
      break;
    }

    const isIccSegment = marker === 0xe2 && segmentLength >= 16 && hasIccSegmentSignature(jpegBytes, offset + 4);
    if (!isIccSegment) {
      kept.push(jpegBytes.slice(offset, segmentEnd));
    }

    offset = segmentEnd;
  }

  return concatUint8Arrays(kept);
}

function buildIccApp2Segments(iccProfileBytes) {
  const bytes = iccProfileBytes instanceof Uint8Array ? iccProfileBytes : new Uint8Array(iccProfileBytes || []);
  const chunkCount = Math.max(1, Math.ceil(bytes.length / JPEG_ICC_CHUNK_DATA_MAX_BYTES));
  const chunks = [];

  for (let i = 0; i < chunkCount; i += 1) {
    const chunkStart = i * JPEG_ICC_CHUNK_DATA_MAX_BYTES;
    const chunkEnd = Math.min(bytes.length, chunkStart + JPEG_ICC_CHUNK_DATA_MAX_BYTES);
    const chunk = bytes.slice(chunkStart, chunkEnd);
    const payloadLength = 14 + chunk.length;
    const segmentLength = payloadLength + 2;
    const segment = new Uint8Array(4 + payloadLength);

    segment[0] = 0xff;
    segment[1] = 0xe2;
    segment[2] = (segmentLength >> 8) & 0xff;
    segment[3] = segmentLength & 0xff;

    segment.set([
      0x49, 0x43, 0x43, 0x5f, 0x50, 0x52, 0x4f, 0x46, 0x49, 0x4c, 0x45, 0x00
    ], 4);
    segment[16] = i + 1;
    segment[17] = chunkCount;
    segment.set(chunk, 18);

    chunks.push(segment);
  }

  return chunks;
}

function embedIccProfileIntoJpegBytes(jpegBytes, iccProfileBytes) {
  const cleanJpeg = removeIccApp2Segments(jpegBytes);
  const iccSegments = buildIccApp2Segments(iccProfileBytes);
  return concatUint8Arrays([cleanJpeg.slice(0, 2), ...iccSegments, cleanJpeg.slice(2)]);
}

async function resolveOutputIcc(profileMode, page, appRoot) {
  if (profileMode === 'none') {
    return { bytes: null, label: 'none' };
  }

  if (profileMode === 'srgb') {
    const srgbPath = path.join(appRoot, 'app', 'assets', 'sRGB.icc');
    const bytes = await fs.readFile(srgbPath);
    return { bytes, label: 'srgb' };
  }

  const sourcePaths = page.items.map((it) => it.sourcePath).filter(Boolean);
  const iccs = [];
  for (const sourcePath of sourcePaths) {
    const meta = await sharp(sourcePath).metadata();
    if (meta.icc) {
      iccs.push(Buffer.from(meta.icc));
    }
  }

  if (iccs.length > 0) {
    return { bytes: iccs[0], label: 'source' };
  }

  const fallbackPath = path.join(appRoot, 'app', 'assets', 'AdobeRGB1998.icc');
  const bytes = await fs.readFile(fallbackPath);
  return { bytes, label: 'fallback-adobe-rgb' };
}

async function renderSinglePage(page, dpi, outputIccBytes) {
  const pxPerMm = dpi / MM_PER_INCH;
  const widthPx = Math.max(1, mmToPx(page.widthMm, pxPerMm));
  const heightPx = Math.max(1, mmToPx(page.heightMm, pxPerMm));

  const composites = [];

  for (const item of page.items) {
    if (!item.sourcePath) {
      throw new Error(`Fehlender Quellpfad bei ${item.name || item.id}`);
    }

    const targetW = Math.max(1, mmToPx(item.drawMm.w, pxPerMm));
    const targetH = Math.max(1, mmToPx(item.drawMm.h, pxPerMm));

    let img = sharp(item.sourcePath).extract({
      left: Math.max(0, item.cropPx.sx),
      top: Math.max(0, item.cropPx.sy),
      width: Math.max(1, item.cropPx.sw),
      height: Math.max(1, item.cropPx.sh)
    });

    if (item.rotated) {
      img = img.rotate(90);
    }

    const input = await img
      .resize(targetW, targetH, { fit: 'fill', kernel: 'lanczos3' })
      .toBuffer();

    composites.push({
      input,
      left: mmToPx(item.drawMm.x, pxPerMm),
      top: mmToPx(item.drawMm.y, pxPerMm)
    });
  }

  composites.push({ input: buildOverlaySvg(page, pxPerMm), left: 0, top: 0 });

  const pageBuffer = await sharp({
    create: {
      width: widthPx,
      height: heightPx,
      channels: 3,
      background: { r: 255, g: 255, b: 255 }
    }
  })
    .composite(composites)
    .jpeg({ quality: 98, chromaSubsampling: '4:4:4', progressive: true })
    .toBuffer();

  if (!outputIccBytes) {
    return pageBuffer;
  }

  const embedded = embedIccProfileIntoJpegBytes(new Uint8Array(pageBuffer), new Uint8Array(outputIccBytes));
  return Buffer.from(embedded);
}

async function renderProductionJob(job, outputDir, appRoot) {
  const files = [];
  const dpi = Number(job.dpi) || 300;
  const profileMode = String(job.profileMode || 'none');

  for (let i = 0; i < job.pages.length; i += 1) {
    const page = job.pages[i];
    const outProfile = await resolveOutputIcc(profileMode, page, appRoot);
    const jpeg = await renderSinglePage(page, dpi, outProfile.bytes);
    const pageNo = String(page.pageNumber || (i + 1)).padStart(2, '0');
    const filename = `druckfertig_${job.barcodeId}_seite-${pageNo}.jpg`;
    const outPath = path.join(outputDir, filename);
    await fs.writeFile(outPath, jpeg);
    files.push(outPath);
  }

  return {
    files,
    profileMode
  };
}

module.exports = {
  renderProductionJob
};

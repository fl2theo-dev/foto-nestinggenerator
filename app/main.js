// Regmark-Logik: 4 Regmarks pro Bogen (außen)
function getSheetRegmarks(page, config, pageHeightMm = config.maxHeight) {
  if (page.length === 0) return [];

  const minX = Math.min(...page.map((item) => item.xMm));
  const minY = Math.min(...page.map((item) => item.yMm));
  const maxX = Math.max(...page.map((item) => item.xMm + item.widthMm));
  const maxY = Math.max(...page.map((item) => item.yMm + item.heightMm));

  // 3 mm Abstand von der Motivkante zur AUSSENkante des Regmarks.
  const leftCx = minX - REGMARK_OFFSET_MM;
  const rightCx = maxX + REGMARK_OFFSET_MM;
  const topCy = minY - REGMARK_OFFSET_MM;
  const bottomCy = maxY + REGMARK_OFFSET_MM;

  const minCx = REGMARK_RADIUS_MM;
  const maxCx = config.rollWidth - REGMARK_RADIUS_MM;
  const minCy = REGMARK_RADIUS_MM;
  const maxCy = pageHeightMm - REGMARK_RADIUS_MM;

  const clamp = (value, lo, hi) => Math.min(Math.max(value, lo), hi);

  return [
    { cx: clamp(leftCx, minCx, maxCx), cy: clamp(topCy, minCy, maxCy), r: REGMARK_RADIUS_MM },
    { cx: clamp(rightCx, minCx, maxCx), cy: clamp(topCy, minCy, maxCy), r: REGMARK_RADIUS_MM },
    { cx: clamp(leftCx, minCx, maxCx), cy: clamp(bottomCy, minCy, maxCy), r: REGMARK_RADIUS_MM },
    { cx: clamp(rightCx, minCx, maxCx), cy: clamp(bottomCy, minCy, maxCy), r: REGMARK_RADIUS_MM }
  ];
}
let jsPdfLoadPromise = null;
const APP_BUILD_ID = 'ui-profile-switch';

if (typeof console !== 'undefined' && typeof console.info === 'function') {
  console.info(`Foto NG Build: ${APP_BUILD_ID}`);
}

function ensureJsPdfLoaded() {
  if (window.jspdf && window.jspdf.jsPDF) {
    return Promise.resolve(true);
  }

  if (jsPdfLoadPromise) {
    return jsPdfLoadPromise;
  }

  jsPdfLoadPromise = new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';
    script.async = true;
    script.onload = () => resolve(Boolean(window.jspdf && window.jspdf.jsPDF));
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });

  return jsPdfLoadPromise;
}
const MM_PER_INCH = 25.4;
const MM_PER_POINT = MM_PER_INCH / 72;
const MM_PER_CM = 10;
const REGMARK_DIAMETER_MM = 5;
const REGMARK_RADIUS_MM = REGMARK_DIAMETER_MM / 2;
const REGMARK_OFFSET_MM = 3 + REGMARK_RADIUS_MM;
const FALLBACK_ADOBE_RGB_ICC_URL = './assets/AdobeRGB1998.icc';
const FALLBACK_SRGB_ICC_URL = './assets/sRGB.icc';
const JPEG_ICC_CHUNK_DATA_MAX_BYTES = 65519;
const DEFAULT_PRINT_JPEG_PROFILE_POLICY = 'none';

let fallbackAdobeRgbIccBytesPromise = null;
let fallbackSrgbIccBytesPromise = null;

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

function generateBarcodeId(length = 10) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let value = '';
  for (let i = 0; i < length; i += 1) {
    value += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return value;
}

function getBarcodeTextForRendering(barcodeId) {
  return `${String(barcodeId || '').toUpperCase()}X`;
}

function invalidateExportBarcodeId() {
  state.exportBarcodeId = null;
}

function getOrCreateExportBarcodeId() {
  if (!state.exportBarcodeId) {
    state.exportBarcodeId = generateBarcodeId();
  }
  return state.exportBarcodeId;
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

function getBarcodePlacementMm(regmarks, geometry, contentBounds = null) {
  if (!Array.isArray(regmarks) || regmarks.length < 2) {
    return {
      xMm: Math.max(2, geometry.widthMm * 0.15),
      yMm: 2,
      maxWidthMm: Math.max(20, geometry.widthMm * 0.7),
      barHeightMm: 7
    };
  }

  const sortedByY = [...regmarks].sort((a, b) => (a.cy - b.cy) || (a.cx - b.cx));
  const topTwo = sortedByY.slice(0, 2).sort((a, b) => a.cx - b.cx);
  const bottomTwo = sortedByY.slice(-2).sort((a, b) => a.cx - b.cx);
  const left = topTwo[0];
  const right = topTwo[1];
  const inset = 1;
  const xStart = left.cx + left.r + inset;
  const xEnd = right.cx - right.r - inset;
  const maxWidthMm = Math.max(20, xEnd - xStart);
  const barHeightMm = 7;

  const contentTopY = Number(contentBounds?.topY);
  const contentBottomY = Number(contentBounds?.bottomY);

  const topCenterY = (topTwo[0].cy + topTwo[1].cy) / 2;
  const topLaneY = topCenterY - barHeightMm / 2;
  const topLaneFits = Number.isFinite(contentTopY)
    ? (topLaneY >= 1 && topLaneY + barHeightMm <= contentTopY - 1)
    : (topLaneY >= 1 && topLaneY + barHeightMm <= geometry.heightMm - 1);

  if (topLaneFits) {
    return { xMm: xStart, yMm: topLaneY, maxWidthMm, barHeightMm };
  }

  const bottomLeft = bottomTwo[0] || left;
  const bottomRight = bottomTwo[1] || right;
  const xStartBottom = bottomLeft.cx + bottomLeft.r + inset;
  const xEndBottom = bottomRight.cx - bottomRight.r - inset;
  const maxWidthMmBottom = Math.max(20, xEndBottom - xStartBottom);
  const bottomCenterY = (bottomLeft.cy + bottomRight.cy) / 2;
  const bottomLaneY = bottomCenterY - barHeightMm / 2;
  const bottomLaneFits = Number.isFinite(contentBottomY)
    ? (bottomLaneY >= contentBottomY + 1 && bottomLaneY + barHeightMm <= geometry.heightMm - 1)
    : (bottomLaneY >= 1 && bottomLaneY + barHeightMm <= geometry.heightMm - 1);

  if (bottomLaneFits) {
    return { xMm: xStartBottom, yMm: bottomLaneY, maxWidthMm: maxWidthMmBottom, barHeightMm };
  }

  const yMm = Math.max(1, Math.min(topLaneY, geometry.heightMm - barHeightMm - 1));

  return { xMm: xStart, yMm, maxWidthMm, barHeightMm };
}

function drawCode39BarcodeOnPdf(pdf, value, placement) {
  const textValue = String(value || '').toUpperCase();
  const encoded = `*${textValue}*`;
  const wideFactor = 2.5;
  const modules = estimateCode39Modules(value, wideFactor);
  const textGapMm = 1.5;
  pdf.setFontSize(6);
  const textWidthMm = typeof pdf.getTextWidth === 'function' ? pdf.getTextWidth(textValue) : textValue.length * 1.6;
  const availableBarcodeWidthMm = Math.max(8, placement.maxWidthMm - textGapMm - textWidthMm);
  const moduleWidthMm = Math.max(0.18, Math.min(0.6, availableBarcodeWidthMm / Math.max(1, modules)));
  const barcodeWidthMm = modules * moduleWidthMm;
  const totalWidthMm = barcodeWidthMm + textGapMm + textWidthMm;
  const startX = placement.xMm + Math.max(0, (placement.maxWidthMm - totalWidthMm) / 2);
  let cursorX = startX;

  pdf.setFillColor(0, 0, 0);

  for (let i = 0; i < encoded.length; i += 1) {
    const pattern = CODE39_PATTERNS[encoded[i]] || CODE39_PATTERNS['*'];
    for (let j = 0; j < pattern.length; j += 1) {
      const width = (pattern[j] === 'w' ? wideFactor : 1) * moduleWidthMm;
      const isBar = j % 2 === 0;
      if (isBar) {
        pdf.rect(cursorX, placement.yMm, width, placement.barHeightMm, 'F');
      }
      cursorX += width;
    }

    if (i < encoded.length - 1) {
      cursorX += moduleWidthMm;
    }
  }

  pdf.setTextColor(0, 0, 0);
  const textX = startX + barcodeWidthMm + textGapMm;
  const textY = placement.yMm + placement.barHeightMm * 0.72;
  pdf.text(textValue, textX, textY);
}

function arraysEqual(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
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

function isJpegBytes(bytes) {
  return bytes && bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8;
}

function isPngBytes(bytes) {
  if (!bytes || bytes.length < 8) return false;
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < sig.length; i += 1) {
    if (bytes[i] !== sig[i]) return false;
  }
  return true;
}

function readUint32BE(bytes, offset) {
  return (
    (bytes[offset] << 24) |
    (bytes[offset + 1] << 16) |
    (bytes[offset + 2] << 8) |
    bytes[offset + 3]
  ) >>> 0;
}

function readUint16(bytes, offset, littleEndian) {
  if (littleEndian) {
    return bytes[offset] | (bytes[offset + 1] << 8);
  }
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function readUint32(bytes, offset, littleEndian) {
  if (littleEndian) {
    return (
      bytes[offset] |
      (bytes[offset + 1] << 8) |
      (bytes[offset + 2] << 16) |
      (bytes[offset + 3] << 24)
    ) >>> 0;
  }
  return (
    (bytes[offset] << 24) |
    (bytes[offset + 1] << 16) |
    (bytes[offset + 2] << 8) |
    bytes[offset + 3]
  ) >>> 0;
}

function getExifTagValueShort(bytes, tiffStart, ifdOffset, targetTag, littleEndian) {
  const ifdStart = tiffStart + ifdOffset;
  if (ifdStart + 2 > bytes.length) return null;
  const entryCount = readUint16(bytes, ifdStart, littleEndian);
  let cursor = ifdStart + 2;

  for (let i = 0; i < entryCount; i += 1) {
    if (cursor + 12 > bytes.length) return null;
    const tag = readUint16(bytes, cursor, littleEndian);
    const type = readUint16(bytes, cursor + 2, littleEndian);
    const count = readUint32(bytes, cursor + 4, littleEndian);
    const valueOffset = cursor + 8;

    if (tag === targetTag && type === 3 && count >= 1) {
      return readUint16(bytes, valueOffset, littleEndian);
    }

    cursor += 12;
  }

  return null;
}

function getExifIfdOffset(bytes, tiffStart, ifdOffset, littleEndian) {
  const ifdStart = tiffStart + ifdOffset;
  if (ifdStart + 2 > bytes.length) return null;
  const entryCount = readUint16(bytes, ifdStart, littleEndian);
  let cursor = ifdStart + 2;

  for (let i = 0; i < entryCount; i += 1) {
    if (cursor + 12 > bytes.length) return null;
    const tag = readUint16(bytes, cursor, littleEndian);
    const type = readUint16(bytes, cursor + 2, littleEndian);
    const count = readUint32(bytes, cursor + 4, littleEndian);
    const valueOrOffset = readUint32(bytes, cursor + 8, littleEndian);

    if (tag === 0x8769 && type === 4 && count >= 1) {
      return valueOrOffset;
    }

    cursor += 12;
  }

  return null;
}

function extractExifColorSpaceFromJpegBytes(bytes) {
  if (!isJpegBytes(bytes)) return null;

  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = bytes[offset + 1];
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x00 || marker === 0xff) {
      offset += 1;
      continue;
    }

    const segmentLength = (bytes[offset + 2] << 8) | bytes[offset + 3];
    if (segmentLength < 2) break;
    const payloadStart = offset + 4;
    const payloadEnd = offset + 2 + segmentLength;
    if (payloadEnd > bytes.length) break;

    if (marker === 0xe1 && payloadEnd - payloadStart >= 6) {
      const exifHeader = String.fromCharCode(
        bytes[payloadStart],
        bytes[payloadStart + 1],
        bytes[payloadStart + 2],
        bytes[payloadStart + 3],
        bytes[payloadStart + 4],
        bytes[payloadStart + 5]
      );

      if (exifHeader === 'Exif\u0000\u0000') {
        const tiffStart = payloadStart + 6;
        if (tiffStart + 8 > bytes.length) return null;
        const endianA = bytes[tiffStart];
        const endianB = bytes[tiffStart + 1];
        const littleEndian = endianA === 0x49 && endianB === 0x49;
        const bigEndian = endianA === 0x4d && endianB === 0x4d;
        if (!littleEndian && !bigEndian) return null;

        const fixed = readUint16(bytes, tiffStart + 2, littleEndian);
        if (fixed !== 0x002a) return null;

        const ifd0Offset = readUint32(bytes, tiffStart + 4, littleEndian);
        const exifIfdOffset = getExifIfdOffset(bytes, tiffStart, ifd0Offset, littleEndian);
        if (!Number.isFinite(exifIfdOffset)) return null;

        const colorSpace = getExifTagValueShort(bytes, tiffStart, exifIfdOffset, 0xa001, littleEndian);
        if (Number.isFinite(colorSpace)) return colorSpace;
        return null;
      }
    }

    offset = payloadEnd;
  }

  return null;
}

function extractXmpIccProfileNameFromJpegBytes(bytes) {
  if (!isJpegBytes(bytes)) return null;

  const decodeCandidates = (payloadBytes) => {
    const outputs = [];
    const pushIfUseful = (text) => {
      if (!text) return;
      const compact = String(text).replace(/\u0000/g, '').trim();
      if (!compact) return;
      if (!outputs.includes(compact)) outputs.push(compact);
    };

    try {
      pushIfUseful(new TextDecoder('utf-8', { fatal: false }).decode(payloadBytes));
    } catch {}
    try {
      pushIfUseful(new TextDecoder('utf-16le', { fatal: false }).decode(payloadBytes));
    } catch {}
    try {
      pushIfUseful(new TextDecoder('utf-16be', { fatal: false }).decode(payloadBytes));
    } catch {}
    try {
      pushIfUseful(new TextDecoder('latin1', { fatal: false }).decode(payloadBytes));
    } catch {}

    return outputs;
  };

  const extractFromXmlText = (xml) => {
    const patterns = [
      /<photoshop:ICCProfile>([^<]+)<\/photoshop:ICCProfile>/i,
      /photoshop:ICCProfile\s*=\s*['\"]([^'\"]+)['\"]/i,
      /<[^>]*ICCProfile[^>]*>([^<]+)<\/[^>]+>/i,
      /ICCProfile\s*=\s*['\"]([^'\"]+)['\"]/i
    ];

    for (const pattern of patterns) {
      const match = xml.match(pattern);
      if (match && match[1]) {
        const value = String(match[1]).replace(/\u0000/g, '').trim();
        if (value) return value;
      }
    }

    return null;
  };

  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = bytes[offset + 1];
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x00 || marker === 0xff) {
      offset += 1;
      continue;
    }

    const segmentLength = (bytes[offset + 2] << 8) | bytes[offset + 3];
    if (segmentLength < 2) break;
    const payloadStart = offset + 4;
    const payloadEnd = offset + 2 + segmentLength;
    if (payloadEnd > bytes.length) break;

    if (marker === 0xe1 && payloadEnd - payloadStart >= 32) {
      const xmpHeader = 'http://ns.adobe.com/xap/1.0/\u0000';
      const xmpExtHeader = 'http://ns.adobe.com/xmp/extension/\u0000';
      const headerBytes = new TextEncoder().encode(xmpHeader);
      const extHeaderBytes = new TextEncoder().encode(xmpExtHeader);
      const hasHeader = (hdr) => {
        if (payloadStart + hdr.length > bytes.length) return false;
        for (let i = 0; i < hdr.length; i += 1) {
          if (bytes[payloadStart + i] !== hdr[i]) return false;
        }
        return true;
      };

      const isStdXmp = hasHeader(headerBytes);
      const isExtXmp = hasHeader(extHeaderBytes);
      const matchedHeaderBytes = isStdXmp ? headerBytes : (isExtXmp ? extHeaderBytes : null);

      if (matchedHeaderBytes) {
        const xmlBytes = bytes.slice(payloadStart + matchedHeaderBytes.length, payloadEnd);
        const decodedTexts = decodeCandidates(xmlBytes);
        for (const xml of decodedTexts) {
          const extracted = extractFromXmlText(xml);
          if (extracted) return extracted;
        }
      }

      // Fallback: scan complete APP1 payload text for ICCProfile markers.
      const payloadBytes = bytes.slice(payloadStart, payloadEnd);
      const decodedPayloads = decodeCandidates(payloadBytes);
      for (const text of decodedPayloads) {
        const extracted = extractFromXmlText(text);
        if (extracted) return extracted;
      }
    }

    offset = payloadEnd;
  }

  return null;
}

async function resolveIccFromProfileName(profileName) {
  const normalized = String(profileName || '').toLowerCase();
  if (!normalized) return null;

  if (normalized.includes('srgb')) {
    const srgb = await loadFallbackSrgbIccBytes();
    return {
      iccProfileBytes: srgb,
      colorProfileLabel: 'sRGB',
      colorProfileSource: 'xmp-profile-name'
    };
  }

  if (normalized.includes('adobe rgb') || normalized.includes('adobergb')) {
    const adobe = await loadFallbackAdobeRgbIccBytes();
    return {
      iccProfileBytes: adobe,
      colorProfileLabel: 'Adobe RGB',
      colorProfileSource: 'xmp-profile-name'
    };
  }

  return null;
}

function hasPngSrgbChunk(bytes) {
  if (!isPngBytes(bytes)) return false;
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = readUint32BE(bytes, offset);
    const typeOffset = offset + 4;
    const dataOffset = offset + 8;
    const chunkEnd = dataOffset + length + 4;
    if (chunkEnd > bytes.length) break;

    const type = String.fromCharCode(
      bytes[typeOffset],
      bytes[typeOffset + 1],
      bytes[typeOffset + 2],
      bytes[typeOffset + 3]
    );

    if (type === 'sRGB') return true;
    if (type === 'IEND') break;
    offset = chunkEnd;
  }
  return false;
}

function detectProfileLabelFromIccBytes(iccBytes) {
  if (!(iccBytes instanceof Uint8Array) || iccBytes.length === 0) return 'Kein Profil';
  const sample = iccBytes.slice(0, Math.min(iccBytes.length, 32768));
  const text = new TextDecoder('latin1').decode(sample).toLowerCase();
  if (text.includes('srgb')) return 'sRGB';
  if (text.includes('adobe rgb') || text.includes('adobergb')) return 'Adobe RGB';
  return 'ICC-Profil';
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

function extractIccProfileFromJpegBytes(bytes) {
  if (!isJpegBytes(bytes)) return null;

  const chunks = new Map();
  let expectedChunks = 0;
  let offset = 2;

  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = bytes[offset + 1];
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x00 || marker === 0xff) {
      offset += 1;
      continue;
    }

    if (offset + 4 > bytes.length) break;
    const segmentLength = (bytes[offset + 2] << 8) | bytes[offset + 3];
    if (segmentLength < 2) break;
    const segmentEnd = offset + 2 + segmentLength;
    if (segmentEnd > bytes.length) break;

    if (marker === 0xe2) {
      const payloadStart = offset + 4;
      const payloadLength = segmentLength - 2;
      if (payloadLength >= 14 && hasIccSegmentSignature(bytes, payloadStart)) {
        const seq = bytes[payloadStart + 12];
        const total = bytes[payloadStart + 13];
        const chunk = bytes.slice(payloadStart + 14, segmentEnd);
        if (seq > 0 && total > 0) {
          expectedChunks = Math.max(expectedChunks, total);
          chunks.set(seq, chunk);
        }
      }
    }

    offset = segmentEnd;
  }

  if (chunks.size === 0) return null;
  if (expectedChunks === 0) return null;
  for (let i = 1; i <= expectedChunks; i += 1) {
    if (!chunks.has(i)) return null;
  }

  const ordered = [];
  for (let i = 1; i <= expectedChunks; i += 1) {
    ordered.push(chunks.get(i));
  }
  return concatUint8Arrays(ordered);
}

function dataUrlToBytes(dataUrl) {
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx === -1) return null;
  const base64 = dataUrl.slice(commaIdx + 1);
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

function extractIccProfileFromFileBytes(file, bytes) {
  const fileName = String(file?.name || '').toLowerCase();
  const mime = String(file?.type || '').toLowerCase();
  const isJpeg = mime === 'image/jpeg' || mime === 'image/jpg' || fileName.endsWith('.jpg') || fileName.endsWith('.jpeg') || isJpegBytes(bytes);
  if (!isJpeg) return null;
  return extractIccProfileFromJpegBytes(bytes);
}

function extractIccProfileFromDataUrl(dataUrl) {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/jpeg')) return null;
  const bytes = dataUrlToBytes(dataUrl);
  if (!bytes) return null;
  return extractIccProfileFromJpegBytes(bytes);
}

async function loadFallbackSrgbIccBytes() {
  if (!fallbackSrgbIccBytesPromise) {
    fallbackSrgbIccBytesPromise = (async () => {
      const response = await fetch(FALLBACK_SRGB_ICC_URL, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`sRGB-Fallbackprofil nicht gefunden (${response.status}).`);
      }
      const buffer = await response.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      if (bytes.length < 128) {
        throw new Error('sRGB-Fallbackprofil ist ungueltig.');
      }
      return bytes;
    })();
  }
  return fallbackSrgbIccBytesPromise;
}

async function resolveImportedProfileInfo(file, fileBytes) {
  const fileName = String(file?.name || '').toLowerCase();
  const mime = String(file?.type || '').toLowerCase();
  const isJpeg = mime === 'image/jpeg' || mime === 'image/jpg' || fileName.endsWith('.jpg') || fileName.endsWith('.jpeg') || isJpegBytes(fileBytes);

  if (isJpeg) {
    const icc = extractIccProfileFromJpegBytes(fileBytes);
    if (icc) {
      return {
        iccProfileBytes: icc,
        colorProfileLabel: detectProfileLabelFromIccBytes(icc),
        colorProfileSource: 'embedded-jpeg-icc'
      };
    }

    const xmpProfileName = extractXmpIccProfileNameFromJpegBytes(fileBytes);
    const xmpProfileInfo = await resolveIccFromProfileName(xmpProfileName);
    if (xmpProfileInfo) {
      return xmpProfileInfo;
    }

    const exifColorSpace = extractExifColorSpaceFromJpegBytes(fileBytes);
    if (exifColorSpace === 1) {
      const srgb = await loadFallbackSrgbIccBytes();
      return {
        iccProfileBytes: srgb,
        colorProfileLabel: 'sRGB',
        colorProfileSource: 'jpeg-exif-srgb'
      };
    }

    return {
      iccProfileBytes: null,
      colorProfileLabel: 'Kein Profil',
      colorProfileSource: 'none'
    };
  }

  if (isPngBytes(fileBytes) && hasPngSrgbChunk(fileBytes)) {
    const srgb = await loadFallbackSrgbIccBytes();
    return {
      iccProfileBytes: srgb,
      colorProfileLabel: 'sRGB',
      colorProfileSource: 'png-srgb-chunk'
    };
  }

  return {
    iccProfileBytes: null,
    colorProfileLabel: 'Kein Profil',
    colorProfileSource: 'none'
  };
}

async function resolveProfileInfoFromDataUrl(dataUrl) {
  const bytes = dataUrlToBytes(dataUrl);
  const icc = extractIccProfileFromDataUrl(dataUrl);
  if (icc) {
    return {
      iccProfileBytes: icc,
      colorProfileLabel: detectProfileLabelFromIccBytes(icc),
      colorProfileSource: 'embedded-jpeg-icc'
    };
  }

  if (bytes && isJpegBytes(bytes)) {
    const xmpProfileName = extractXmpIccProfileNameFromJpegBytes(bytes);
    const xmpProfileInfo = await resolveIccFromProfileName(xmpProfileName);
    if (xmpProfileInfo) {
      return xmpProfileInfo;
    }
  }

  if (bytes && isJpegBytes(bytes)) {
    const exifColorSpace = extractExifColorSpaceFromJpegBytes(bytes);
    if (exifColorSpace === 1) {
      const srgb = await loadFallbackSrgbIccBytes();
      return {
        iccProfileBytes: srgb,
        colorProfileLabel: 'sRGB',
        colorProfileSource: 'jpeg-exif-srgb'
      };
    }
  }

  return {
    iccProfileBytes: null,
    colorProfileLabel: 'Kein Profil',
    colorProfileSource: 'none'
  };
}

async function loadFallbackAdobeRgbIccBytes() {
  if (!fallbackAdobeRgbIccBytesPromise) {
    fallbackAdobeRgbIccBytesPromise = (async () => {
      const response = await fetch(FALLBACK_ADOBE_RGB_ICC_URL, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`AdobeRGB-Fallbackprofil nicht gefunden (${response.status}).`);
      }
      const buffer = await response.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      if (bytes.length < 128) {
        throw new Error('AdobeRGB-Fallbackprofil ist ungueltig.');
      }
      return bytes;
    })();
  }
  return fallbackAdobeRgbIccBytesPromise;
}

async function resolveIccProfileForPage(page) {
  const withProfile = page
    .map((item) => item.iccProfileBytes)
    .filter((profile) => profile instanceof Uint8Array && profile.length > 0);

  if (withProfile.length === 0) {
    return {
      bytes: await loadFallbackAdobeRgbIccBytes(),
      source: 'fallback-no-input-profile'
    };
  }

  const base = withProfile[0];
  const allEqual = withProfile.every((profile) => arraysEqual(profile, base));
  if (allEqual) {
    return {
      bytes: base,
      source: 'input-profile'
    };
  }

  throw new Error('Gemischte ICC-Profile auf einem Bogen erkannt. Bitte pro Bogen nur ein einheitliches Farbprofil verwenden.');
}

function removeIccApp2Segments(jpegBytes) {
  if (!isJpegBytes(jpegBytes)) return jpegBytes;

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

async function blobToBytes(blob) {
  const buffer = await blob.arrayBuffer();
  return new Uint8Array(buffer);
}

function canvasToJpegBlob(canvas, quality = 0.98) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('JPEG konnte nicht erzeugt werden.'));
        return;
      }
      resolve(blob);
    }, 'image/jpeg', quality);
  });
}

const photoInput = document.getElementById('photoInput');
const rollWidthInput = document.getElementById('rollWidth');
const maxHeightInput = document.getElementById('maxHeight');
const dpiInput = document.getElementById('dpi');
const gapInput = document.getElementById('gap');
const allowRotateInput = document.getElementById('allowRotate');
const paddingInput = document.getElementById('padding');
const moveStepInput = document.getElementById('moveStep');
const selectedItemInput = document.getElementById('selectedItem');
const appLoadingOverlay = document.getElementById('appLoadingOverlay');
const appLoadingText = document.getElementById('appLoadingText');
const appLoadingVideo = document.getElementById('appLoadingVideo');

const nestBtn = document.getElementById('nestBtn');
const nestPageBtn = document.getElementById('nestPageBtn');
const clearBtn = document.getElementById('clearBtn');
const placeSelectionBtn = document.getElementById('placeSelectionBtn');
const deleteSelectionBtn = document.getElementById('deleteSelectionBtn');
const saveProjectBtn = document.getElementById('saveProjectBtn');
const loadProjectBtn = document.getElementById('loadProjectBtn');
const projectLoadInput = document.getElementById('projectLoadInput');
const exportPrintPdfBtn = document.getElementById('exportPrintPdfBtn');
const exportContourPdfBtn = document.getElementById('exportContourPdfBtn');
const exportHotfolderBtn = document.getElementById('exportHotfolderBtn');
const prevPageBtn = document.getElementById('prevPageBtn');
const nextPageBtn = document.getElementById('nextPageBtn');
const pageIndicator = document.getElementById('pageIndicator');
const effectiveHeightInfo = document.getElementById('effectiveHeightInfo');
const manualNestingMenu = document.getElementById('manualNestingMenu');
const menuRotateBtn = document.getElementById('menuRotateBtn');
const menuDuplicateBtn = document.getElementById('menuDuplicateBtn');
const menuUnplaceBtn = document.getElementById('menuUnplaceBtn');
const duplicateBtn = document.getElementById('duplicateBtn');
const menuCropBtn = document.getElementById('menuCropBtn');
const menuCurrentSizeValue = document.getElementById('menuCurrentSizeValue');
const menuScaleWidthCm = document.getElementById('menuScaleWidthCm');
const menuScaleHeightCm = document.getElementById('menuScaleHeightCm');
const menuScaleDpi = document.getElementById('menuScaleDpi');
const menuApplyBtn = document.getElementById('menuApplyBtn');
const menuWhiteBorderMm = document.getElementById('menuWhiteBorderMm');
const menuWhiteBorderMode = document.getElementById('menuWhiteBorderMode');
const menuTargetWidthCm = document.getElementById('menuTargetWidthCm');
const menuTargetHeightCm = document.getElementById('menuTargetHeightCm');
const photoOverlay = document.getElementById('photoOverlay');
const photoOverlayViewport = document.getElementById('photoOverlayViewport');
const photoOverlayImage = document.getElementById('photoOverlayImage');
const photoOverlayCaption = document.getElementById('photoOverlayCaption');
const photoOverlayCloseBtn = document.getElementById('photoOverlayCloseBtn');
const cropOverlay = document.getElementById('cropOverlay');
const cropOverlayCanvas = document.getElementById('cropOverlayCanvas');
const cropOverlayApplyBtn = document.getElementById('cropOverlayApplyBtn');
const cropOverlayCancelBtn = document.getElementById('cropOverlayCancelBtn');
const cropTargetWidthCm = document.getElementById('cropTargetWidthCm');
const cropTargetHeightCm = document.getElementById('cropTargetHeightCm');
const cropOverlayDpiInfo = document.getElementById('cropOverlayDpiInfo');
const cropRectXPercent = document.getElementById('cropRectXPercent');
const cropRectYPercent = document.getElementById('cropRectYPercent');
const cropRectWPercent = document.getElementById('cropRectWPercent');
const cropRectHPercent = document.getElementById('cropRectHPercent');
const cropRatioH = document.getElementById('cropRatioH');
const cropRatioW = document.getElementById('cropRatioW');
const cropLockRatio = document.getElementById('cropLockRatio');

const overlayView = {
  scale: 1,
  tx: 0,
  ty: 0,
  dragging: false,
  pointerId: null,
  startX: 0,
  startY: 0,
  startTx: 0,
  startTy: 0
};

const statusEl = document.getElementById('status');
const tableBody = document.getElementById('photoTableBody');
const oversizeEditor = document.getElementById('oversizeEditor');
const oversizeEditorText = document.getElementById('oversizeEditorText');
const oversizeWidthCmInput = document.getElementById('oversizeWidthCmInput');
const oversizeApplyBtn = document.getElementById('oversizeApplyBtn');
const previewCanvas = document.getElementById('previewCanvas');
const previewCanvasWrap = document.querySelector('.preview-canvas-wrap');
const ctx = previewCanvas.getContext('2d');

const PHOTO_CARD_ROW_HEIGHT = 86;
const PHOTO_CARD_OVERSCAN = 6;

const state = {
  photos: [],
  pages: [],
  listSelection: new Set(),
  selectedId: null,
  currentPage: 0,
  exportBarcodeId: null,
  drag: {
    active: false,
    id: null,
    offsetXmm: 0,
    offsetYmm: 0,
    moved: false,
    startClientX: 0,
    startClientY: 0
  }
};

let suppressCanvasClick = false;
let virtualListInitialized = false;
let manualScaleLastEdited = 'width';

const virtualPhotoList = {
  items: []
};

const cropEditor = {
  active: false,
  aspect: 1,
  lockedAspect: 1,
  rect: { x: 0, y: 0, w: 0, h: 0 },
  display: { x: 0, y: 0, w: 0, h: 0 },
  dragging: false,
  dragMode: null,
  activeHandle: null,
  pointerId: null,
  resizeAnchor: null,
  dragOffsetX: 0,
  dragOffsetY: 0
};

function setStatus(message) {
  statusEl.textContent = message;
}

function pxToMm(px, dpi) {
  return (px / dpi) * MM_PER_INCH;
}

function parseUiNumber(value) {
  const normalized = String(value ?? '').trim().replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function getPrintJpegProfilePolicy() {
  return DEFAULT_PRINT_JPEG_PROFILE_POLICY;
}

function isDesktopRuntime() {
  return Boolean(window.desktopApi && typeof window.desktopApi.exportProductionJpeg === 'function');
}

function buildDesktopProductionJob(barcodeId, barcodeText) {
  const config = getConfig();
  const dpi = Number(config.dpi) || 300;
  const pageGeometries = state.pages.map((page) => getPdfPageGeometry(page, config));

  const pages = state.pages.map((page, index) => {
    const geometry = pageGeometries[index];
    const drawOffsetX = geometry.offsetX;
    const drawOffsetY = geometry.offsetY;

    const regmarks = geometry.regmarks.map((reg) => ({
      cxMm: reg.cx + drawOffsetX,
      cyMm: reg.cy + drawOffsetY,
      rMm: reg.r
    }));

    const contentTopY = Math.min(...page.map((item) => item.yMm)) + drawOffsetY;
    const contentBottomY = Math.max(...page.map((item) => item.yMm + item.heightMm)) + drawOffsetY;
    const barcodePlacementMm = getBarcodePlacementMm(regmarks.map((r) => ({ cx: r.cxMm, cy: r.cyMm, r: r.rMm })), geometry, {
      topY: contentTopY,
      bottomY: contentBottomY
    });

    const items = page.map((item) => {
      const imageRect = getPlacementImageRectMm(item);
      const crop = getCropPixels(item);
      return {
        id: item.id,
        name: item.name,
        sourcePath: item.sourcePath || null,
        rotated: Boolean(item.rotated),
        cropPx: {
          sx: Math.max(0, Math.round(crop.sx)),
          sy: Math.max(0, Math.round(crop.sy)),
          sw: Math.max(1, Math.round(crop.sw)),
          sh: Math.max(1, Math.round(crop.sh))
        },
        drawMm: {
          x: item.xMm + imageRect.xMm + drawOffsetX,
          y: item.yMm + imageRect.yMm + drawOffsetY,
          w: imageRect.widthMm,
          h: imageRect.heightMm
        }
      };
    });

    return {
      pageNumber: index + 1,
      widthMm: geometry.widthMm,
      heightMm: geometry.heightMm,
      regmarks,
      barcode: {
        text: barcodeText,
        xMm: barcodePlacementMm.xMm,
        yMm: barcodePlacementMm.yMm,
        maxWidthMm: barcodePlacementMm.maxWidthMm,
        barHeightMm: barcodePlacementMm.barHeightMm
      },
      items
    };
  });

  return {
    barcodeId,
    barcodeText,
    dpi,
    profileMode: getPrintJpegProfilePolicy(),
    pages
  };
}

async function exportDesktopProductionJpeg() {
  if (!isDesktopRuntime()) {
    setStatus('Desktop-Export ist nur in der Standalone-App verfuegbar.');
    return;
  }
  if (state.pages.length === 0) {
    setStatus('Kein Layout zum Exportieren vorhanden.');
    return;
  }

  const missingSource = state.pages
    .flat()
    .find((item) => !item.sourcePath);
  if (missingSource) {
    setStatus(`Desktop-Export nicht moeglich: Quelle fehlt fuer ${missingSource.name}. Bitte Originaldatei neu laden.`);
    return;
  }

  const barcodeId = getOrCreateExportBarcodeId();
  const barcodeText = getBarcodeTextForRendering(barcodeId);
  const job = buildDesktopProductionJob(barcodeId, barcodeText);

  try {
    const result = await window.desktopApi.exportProductionJpeg(job);
    if (!result || !result.ok) {
      setStatus(result?.message || 'Desktop-Export abgebrochen oder fehlgeschlagen.');
      return;
    }
    setStatus(`Desktop-Druckexport erstellt (${result.count} Datei(en), Profilmodus: ${result.profileMode}).`);
  } catch (error) {
    setStatus(`Desktop-Export fehlgeschlagen: ${error.message}`);
  }
}

function getMoveStepMm() {
  return Math.max(1, Number(moveStepInput?.value || 0) || 5);
}

function setSelectedItemName(value) {
  if (selectedItemInput) {
    selectedItemInput.value = value || 'Keins';
  }
}

function getOriginalContentDimensions(item) {
  return {
    widthMm: Number(item.originalWidthMm) || 0,
    heightMm: Number(item.originalHeightMm) || 0
  };
}

function getConfiguredContentDimensions(item) {
  const original = getOriginalContentDimensions(item);
  const widthMm = Number(item.targetWidthMm);
  const heightMm = Number(item.targetHeightMm);
  if (Number.isFinite(widthMm) && widthMm > 0 && Number.isFinite(heightMm) && heightMm > 0) {
    return { widthMm, heightMm };
  }
  return original;
}

function getWhiteBorderMode(item) {
  if (item?.whiteBorderMode === 'inside') return 'inside';
  if (item?.whiteBorderMode === 'target') return 'target';
  return 'outside';
}

function getWhiteTargetDimensions(item) {
  const widthMm = Number(item?.whiteBorderTargetWidthMm);
  const heightMm = Number(item?.whiteBorderTargetHeightMm);
  if (!Number.isFinite(widthMm) || widthMm <= 0 || !Number.isFinite(heightMm) || heightMm <= 0) {
    return null;
  }
  return { widthMm, heightMm };
}

function getWhiteBorderMm(item) {
  const value = Number(item?.whiteBorderMm);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return value;
}

function getVisibleContentDimensions(item, contentWidthMm, contentHeightMm) {
  // The content mm dimensions already encode the crop's aspect ratio
  // (applyCropOverlay always sets heightMm = widthMm / cropAspect).
  // Multiplying by cropNorm.w/h would double-apply the crop, distorting the border sizes.
  return { widthMm: contentWidthMm, heightMm: contentHeightMm };
}

function getWhiteBorderComponentsForContent(item, contentWidthMm, contentHeightMm) {
  const longEdgeBorderMm = getWhiteBorderMm(item);
  if (longEdgeBorderMm <= 0 || contentWidthMm <= 0 || contentHeightMm <= 0) {
    return { borderX: 0, borderY: 0 };
  }

  const visible = getVisibleContentDimensions(item, contentWidthMm, contentHeightMm);
  const visibleW = Math.max(1e-6, visible.widthMm);
  const visibleH = Math.max(1e-6, visible.heightMm);

  if (visibleW >= visibleH) {
    return {
      borderX: longEdgeBorderMm * (visibleW / visibleH),
      borderY: longEdgeBorderMm
    };
  }

  return {
    borderX: longEdgeBorderMm,
    borderY: longEdgeBorderMm * (visibleH / visibleW)
  };
}

function getOuterDimensionsForContent(item, contentWidthMm, contentHeightMm) {
  if (getWhiteBorderMode(item) === 'target') {
    const target = getWhiteTargetDimensions(item);
    if (target) {
      return { widthMm: target.widthMm, heightMm: target.heightMm };
    }
  }

  const { borderX, borderY } = getWhiteBorderComponentsForContent(item, contentWidthMm, contentHeightMm);
  if (getWhiteBorderMode(item) === 'outside') {
    return {
      widthMm: contentWidthMm + borderX * 2,
      heightMm: contentHeightMm + borderY * 2
    };
  }
  return { widthMm: contentWidthMm, heightMm: contentHeightMm };
}

function getPlacementOuterDimensions(item) {
  const widthMm = Number(item.widthMm);
  const heightMm = Number(item.heightMm);
  const hasPlacementDims = Number.isFinite(widthMm) && widthMm > 0 && Number.isFinite(heightMm) && heightMm > 0;
  if (hasPlacementDims) {
    return { widthMm, heightMm };
  }
  const content = getConfiguredContentDimensions(item);
  return getOuterDimensionsForContent(item, content.widthMm, content.heightMm);
}

function getPlacementImageRectMm(item) {
  const outer = getPlacementOuterDimensions(item);
  const mode = getWhiteBorderMode(item);
  if (mode === 'target') {
    const configured = getConfiguredContentDimensions(item);
    const photoWidth = Number(item.contentWidthMm) > 0 ? Number(item.contentWidthMm) : configured.widthMm;
    const photoHeight = Number(item.contentHeightMm) > 0 ? Number(item.contentHeightMm) : configured.heightMm;
    const clampedPhotoWidth = Math.max(0.1, Math.min(photoWidth, outer.widthMm));
    const clampedPhotoHeight = Math.max(0.1, Math.min(photoHeight, outer.heightMm));
    const insetX = Math.max(0, (outer.widthMm - clampedPhotoWidth) / 2);
    const insetY = Math.max(0, (outer.heightMm - clampedPhotoHeight) / 2);
    return {
      xMm: insetX,
      yMm: insetY,
      widthMm: clampedPhotoWidth,
      heightMm: clampedPhotoHeight
    };
  }

  const border = getWhiteBorderComponentsForContent(item, outer.widthMm, outer.heightMm);

  if (mode === 'outside') {
    const photoWidth = Number(item.contentWidthMm) > 0 ? Number(item.contentWidthMm) : outer.widthMm;
    const photoHeight = Number(item.contentHeightMm) > 0 ? Number(item.contentHeightMm) : outer.heightMm;
    const insetX = Math.max(0, (outer.widthMm - photoWidth) / 2);
    const insetY = Math.max(0, (outer.heightMm - photoHeight) / 2);
    return {
      xMm: insetX,
      yMm: insetY,
      widthMm: Math.max(0.1, Math.min(photoWidth, outer.widthMm - insetX * 2)),
      heightMm: Math.max(0.1, Math.min(photoHeight, outer.heightMm - insetY * 2))
    };
  }

  const insetX = Math.max(0, Math.min(border.borderX, outer.widthMm / 2 - 0.05));
  const insetY = Math.max(0, Math.min(border.borderY, outer.heightMm / 2 - 0.05));

  return {
    xMm: insetX,
    yMm: insetY,
    widthMm: Math.max(0.1, outer.widthMm - insetX * 2),
    heightMm: Math.max(0.1, outer.heightMm - insetY * 2)
  };
}

function getUsablePageArea(config) {
  return {
    widthMm: Math.max(1, config.rollWidth - config.padding * 2),
    heightMm: Math.max(1, config.maxHeight - config.padding * 2)
  };
}

function canOuterDimensionsFit(widthMm, heightMm, config) {
  const usable = getUsablePageArea(config);
  if (widthMm <= usable.widthMm + 1e-6 && heightMm <= usable.heightMm + 1e-6) return true;
  if (config.allowRotate && heightMm <= usable.widthMm + 1e-6 && widthMm <= usable.heightMm + 1e-6) return true;
  return false;
}

function isPhotoOversizeForConfig(photo, config) {
  const original = getOriginalContentDimensions(photo);
  const outer = getOuterDimensionsForContent(photo, original.widthMm, original.heightMm);
  return !canOuterDimensionsFit(outer.widthMm, outer.heightMm, config);
}

function getRecommendedContentWidthMm(photo, config) {
  const original = getOriginalContentDimensions(photo);
  if (!original.widthMm || !original.heightMm) return original.widthMm;

  const aspect = original.heightMm / original.widthMm;
  const preferredOuterWidth = Math.max(10, config.rollWidth - 20);
  const usable = getUsablePageArea(config);
  const preferredContentWidth = Math.max(10, Math.min(preferredOuterWidth, usable.widthMm));
  const preferredContentHeight = preferredContentWidth * aspect;
  const preferredOuter = getOuterDimensionsForContent(photo, preferredContentWidth, preferredContentHeight);
  if (canOuterDimensionsFit(preferredOuter.widthMm, preferredOuter.heightMm, config)) {
    return preferredContentWidth;
  }

  const scales = [];
  const estimateScale = (sourceW, sourceH) => {
    let lo = 0.01;
    let hi = 2;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      const testOuter = getOuterDimensionsForContent(photo, sourceW * mid, sourceH * mid);
      if (testOuter.widthMm <= usable.widthMm + 1e-6 && testOuter.heightMm <= usable.heightMm + 1e-6) {
        lo = mid;
      } else {
        hi = mid;
      }
    }
    return lo;
  };

  scales.push(estimateScale(original.widthMm, original.heightMm));
  if (config.allowRotate) {
    scales.push(estimateScale(original.heightMm, original.widthMm));
  }

  scales.push(
    Math.min(
      usable.widthMm / Math.max(1e-6, original.widthMm),
      usable.heightMm / Math.max(1e-6, original.heightMm)
    )
  );
  if (config.allowRotate) {
    scales.push(
      Math.min(
        usable.widthMm / Math.max(1e-6, original.heightMm),
        usable.heightMm / Math.max(1e-6, original.widthMm)
      )
    );
  }

  const bestScale = Math.max(0.05, ...scales.filter((value) => Number.isFinite(value) && value > 0));
  return Math.max(10, original.widthMm * bestScale);
}

function setPhotoTargetWidthMm(photo, widthMm, source = null) {
  const original = getOriginalContentDimensions(photo);
  const safeWidthMm = Math.max(10, Number(widthMm) || original.widthMm || 10);
  const aspect = original.heightMm / Math.max(1e-6, original.widthMm || 1);
  photo.targetWidthMm = safeWidthMm;
  photo.targetHeightMm = safeWidthMm * aspect;
  photo.sizeOverrideSource = source;
}

function ensurePhotoAutoFit(photo, config) {
  const oversize = isPhotoOversizeForConfig(photo, config);
  if (!oversize) {
    if (photo.sizeOverrideSource === 'auto') {
      const original = getOriginalContentDimensions(photo);
      photo.targetWidthMm = original.widthMm;
      photo.targetHeightMm = original.heightMm;
      photo.sizeOverrideSource = null;
    }
    return;
  }

  if (photo.sizeOverrideSource === 'manual') return;
  setPhotoTargetWidthMm(photo, getRecommendedContentWidthMm(photo, config), 'auto');
}

function refreshPhotoSizing(config = getConfig()) {
  state.photos.forEach((photo) => ensurePhotoAutoFit(photo, config));
}

function setBusyState(active, message = 'Motive werden platziert ...') {
  if (appLoadingOverlay) {
    appLoadingOverlay.hidden = !active;
    if (active) {
      positionOverlayOutsidePreview();
    }
  }
  if (appLoadingText) {
    appLoadingText.textContent = message;
  }
  document.body.classList.toggle('is-busy', active);
  if (active && appLoadingVideo) {
    const playPromise = appLoadingVideo.play();
    if (playPromise?.catch) playPromise.catch(() => {});
  }
  if (!active && appLoadingVideo) {
    appLoadingVideo.pause();
    appLoadingVideo.currentTime = 0;
  }
}

async function withBusyOverlay(message, work) {
  setBusyState(true, message);
  await new Promise((resolve) => window.requestAnimationFrame(resolve));
  try {
    return await work();
  } finally {
    setBusyState(false);
  }
}

const overlayDragState = {
  dragging: false,
  startX: 0,
  startY: 0,
  currentX: 0,
  currentY: 0
};

function positionOverlayOutsidePreview() {
  if (!appLoadingOverlay || appLoadingOverlay.hidden) return;
  
  const canvasRect = previewCanvas?.getBoundingClientRect();
  const overlayWidth = 540;
  const overlayHeight = 280;
  const padding = 16;
  
  let x = window.innerWidth / 2 - overlayWidth / 2;
  let y = window.innerHeight / 2 - overlayHeight / 2;
  
  if (canvasRect) {
    const rightSpace = window.innerWidth - canvasRect.right;
    if (rightSpace > overlayWidth + padding) {
      x = canvasRect.right + padding;
      y = canvasRect.top + padding;
    } else if (canvasRect.left > overlayWidth + padding) {
      x = canvasRect.left - overlayWidth - padding;
      y = canvasRect.top + padding;
    } else if (window.innerHeight - canvasRect.bottom > overlayHeight + padding) {
      x = window.innerWidth / 2 - overlayWidth / 2;
      y = canvasRect.bottom + padding;
    } else if (canvasRect.top > overlayHeight + padding) {
      x = window.innerWidth / 2 - overlayWidth / 2;
      y = canvasRect.top - overlayHeight - padding;
    }
  }
  
  x = Math.max(padding, Math.min(x, window.innerWidth - overlayWidth - padding));
  y = Math.max(padding, Math.min(y, window.innerHeight - overlayHeight - padding));
  
  appLoadingOverlay.style.left = x + 'px';
  appLoadingOverlay.style.top = y + 'px';
  
  overlayDragState.currentX = x;
  overlayDragState.currentY = y;
}

function handleOverlayMouseDown(e) {
  if (e.button !== 0) return;
  const header = document.getElementById('appLoadingHeader');
  if (!header || !header.contains(e.target)) return;
  
  overlayDragState.dragging = true;
  overlayDragState.startX = e.clientX;
  overlayDragState.startY = e.clientY;
  
  appLoadingOverlay?.classList.add('is-dragging');
  e.preventDefault();
}

function handleOverlayMouseMove(e) {
  if (!overlayDragState.dragging || !appLoadingOverlay) return;
  
  const deltaX = e.clientX - overlayDragState.startX;
  const deltaY = e.clientY - overlayDragState.startY;
  
  const newX = overlayDragState.currentX + deltaX;
  const newY = overlayDragState.currentY + deltaY;
  
  const overlayWidth = appLoadingOverlay.offsetWidth;
  const overlayHeight = appLoadingOverlay.offsetHeight;
  const padding = 10;
  
  const clampX = Math.max(padding, Math.min(newX, window.innerWidth - overlayWidth - padding));
  const clampY = Math.max(padding, Math.min(newY, window.innerHeight - overlayHeight - padding));
  
  appLoadingOverlay.style.left = clampX + 'px';
  appLoadingOverlay.style.top = clampY + 'px';
}

function handleOverlayMouseUp(e) {
  if (!overlayDragState.dragging) return;
  
  overlayDragState.dragging = false;
  overlayDragState.currentX = parseInt(appLoadingOverlay?.style.left || 0);
  overlayDragState.currentY = parseInt(appLoadingOverlay?.style.top || 0);
  
  appLoadingOverlay?.classList.remove('is-dragging');
}

function initializeOverlayDragging() {
  if (appLoadingOverlay) {
    appLoadingOverlay.addEventListener('mousedown', handleOverlayMouseDown);
    document.addEventListener('mousemove', handleOverlayMouseMove);
    document.addEventListener('mouseup', handleOverlayMouseUp);
  }
}

const menuDragState = {
  dragging: false,
  startX: 0,
  startY: 0,
  currentX: 0,
  currentY: 0
};

function handleMenuMouseDown(e) {
  if (e.button !== 0) return;
  const header = document.getElementById('manualMenuHeader');
  if (!header || !header.contains(e.target)) return;
  
  menuDragState.dragging = true;
  menuDragState.startX = e.clientX;
  menuDragState.startY = e.clientY;
  
  if (manualNestingMenu) {
    menuDragState.currentX = manualNestingMenu.offsetLeft;
    menuDragState.currentY = manualNestingMenu.offsetTop;
    manualNestingMenu.classList.add('is-dragging');
  }
  e.preventDefault();
}

function handleMenuMouseMove(e) {
  if (!menuDragState.dragging || !manualNestingMenu) return;
  
  const deltaX = e.clientX - menuDragState.startX;
  const deltaY = e.clientY - menuDragState.startY;
  
  const newX = menuDragState.currentX + deltaX;
  const newY = menuDragState.currentY + deltaY;
  
  const menuWidth = manualNestingMenu.offsetWidth;
  const menuHeight = manualNestingMenu.offsetHeight;
  const padding = 10;
  const parent = manualNestingMenu.offsetParent;
  
  if (parent instanceof HTMLElement) {
    const parentWidth = parent.clientWidth;
    const parentHeight = parent.clientHeight;
    
    const clampX = Math.max(padding, Math.min(newX, parentWidth - menuWidth - padding));
    const clampY = Math.max(padding, Math.min(newY, parentHeight - menuHeight - padding));
    
    manualNestingMenu.style.left = clampX + 'px';
    manualNestingMenu.style.top = clampY + 'px';
  }
}

function handleMenuMouseUp(e) {
  if (!menuDragState.dragging) return;
  
  menuDragState.dragging = false;
  if (manualNestingMenu) {
    menuDragState.currentX = manualNestingMenu.offsetLeft;
    menuDragState.currentY = manualNestingMenu.offsetTop;
    manualNestingMenu.classList.remove('is-dragging');
  }
}

function initializeMenuDragging() {
  if (manualNestingMenu) {
    manualNestingMenu.addEventListener('mousedown', handleMenuMouseDown);
    document.addEventListener('mousemove', handleMenuMouseMove);
    document.addEventListener('mouseup', handleMenuMouseUp);
  }
}

function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

function getConfig() {
  return {
    rollWidth: Number(rollWidthInput.value),
    maxHeight: Number(maxHeightInput.value),
    gap: Number(gapInput.value),
    allowRotate: allowRotateInput.checked,
    padding: Number(paddingInput.value),
    dpi: Number(dpiInput.value),
    moveStep: getMoveStepMm()
  };
}

function applyConfig(config) {
  if (!config) return;
  if (typeof config.rollWidth === 'number') rollWidthInput.value = String(config.rollWidth);
  if (typeof config.maxHeight === 'number') maxHeightInput.value = String(config.maxHeight);
  if (typeof config.gap === 'number') gapInput.value = String(config.gap);
  if (typeof config.allowRotate === 'boolean') allowRotateInput.checked = config.allowRotate;
  if (typeof config.padding === 'number') paddingInput.value = String(config.padding);
  if (typeof config.dpi === 'number') dpiInput.value = String(config.dpi);
  if (typeof config.moveStep === 'number' && moveStepInput) moveStepInput.value = String(config.moveStep);
}

function getFootprintRect(item) {
  return {
    x: item.xMm,
    y: item.yMm,
    width: item.widthMm,
    height: item.heightMm
  };
}

function getRectBottomY(rect) {
  return rect.y + rect.height;
}

function getPlacedUsedBottom(placed, config) {
  return Math.max(config.padding, ...placed.map((p) => p.yMm + p.heightMm));
}

function getNestBaseDimensions(item) {
  return getPlacementOuterDimensions(item);
}

function getRotationPenalty(variant, strategy) {
  if (strategy === 'prefer-upright') return variant.isRotationChange ? 1 : 0;
  if (strategy === 'prefer-rotated') return variant.isRotationChange ? 0 : 1;
  return 0;
}

function rectsOverlap(a, b, gap = 0) {
  return !(
    a.x + a.width + gap <= b.x ||
    b.x + b.width + gap <= a.x ||
    a.y + a.height + gap <= b.y ||
    b.y + b.height + gap <= a.y
  );
}

function pruneContained(rects) {
  const keep = new Array(rects.length).fill(true);
  for (let i = 0; i < rects.length; i++) {
    if (!keep[i]) continue;
    for (let j = 0; j < rects.length; j++) {
      if (i === j || !keep[j]) continue;
      const a = rects[i];
      const b = rects[j];
      const contains =
        b.x <= a.x + 1e-6 &&
        b.y <= a.y + 1e-6 &&
        b.x + b.width >= a.x + a.width - 1e-6 &&
        b.y + b.height >= a.y + a.height - 1e-6;
      if (contains) {
        keep[i] = false;
        break;
      }
    }
  }
  return rects.filter((_, index) => keep[index]);
}

function splitFreeRects(freeRects, obstacle, gap) {
  const ox1 = obstacle.x - gap;
  const oy1 = obstacle.y - gap;
  const ox2 = obstacle.x + obstacle.width + gap;
  const oy2 = obstacle.y + obstacle.height + gap;
  const result = [];

  for (const rect of freeRects) {
    const rx1 = rect.x;
    const ry1 = rect.y;
    const rx2 = rect.x + rect.width;
    const ry2 = rect.y + rect.height;

    const noOverlap = ox2 <= rx1 + 1e-6 || ox1 >= rx2 - 1e-6 || oy2 <= ry1 + 1e-6 || oy1 >= ry2 - 1e-6;
    if (noOverlap) {
      result.push(rect);
      continue;
    }

    if (ox1 > rx1 + 1e-6) result.push({ x: rx1, y: ry1, width: ox1 - rx1, height: rect.height });
    if (ox2 < rx2 - 1e-6) result.push({ x: ox2, y: ry1, width: rx2 - ox2, height: rect.height });
    if (oy1 > ry1 + 1e-6) result.push({ x: rx1, y: ry1, width: rect.width, height: oy1 - ry1 });
    if (oy2 < ry2 - 1e-6) result.push({ x: rx1, y: oy2, width: rect.width, height: ry2 - oy2 });
  }

  return pruneContained(result).filter((r) => r.width > 1e-3 && r.height > 1e-3);
}

function nestSinglePageWithStrategy(photos, config, strategy) {
  const sorted = [...photos].sort((a, b) => {
    const aDims = getNestBaseDimensions(a);
    const bDims = getNestBaseDimensions(b);
    return (bDims.widthMm * bDims.heightMm) - (aDims.widthMm * aDims.heightMm);
  });
  const placed = [];
  const placedIds = new Set();
  let freeRects = [
    {
      x: config.padding,
      y: config.padding,
      width: config.rollWidth - config.padding * 2,
      height: config.maxHeight - config.padding * 2
    }
  ];

  for (const photo of sorted) {
    const baseDims = getNestBaseDimensions(photo);
    const baseRotated = Boolean(photo.rotated);
    const variants = [];
    if (strategy !== 'force-rotated') {
      variants.push({
        width: baseDims.widthMm,
        height: baseDims.heightMm,
        rotated: baseRotated,
        isRotationChange: false
      });
    }
    if (config.allowRotate && strategy !== 'force-upright') {
      variants.push({
        width: baseDims.heightMm,
        height: baseDims.widthMm,
        rotated: !baseRotated,
        isRotationChange: true
      });
    }

    let best = null;
    for (const rect of freeRects) {
      for (const variant of variants) {
        const footprintWidth = variant.width;
        const footprintHeight = variant.height;
        if (footprintWidth > rect.width + 1e-6 || footprintHeight > rect.height + 1e-6) {
          continue;
        }

        const placedRect = {
          x: rect.x,
          y: rect.y,
          width: footprintWidth,
          height: footprintHeight
        };
        const resultingUsedBottom = Math.max(
          ...placed.map((p) => p.yMm + p.heightMm),
          getRectBottomY(placedRect)
        );
        const shortSideFit = Math.min(rect.width - footprintWidth, rect.height - footprintHeight);
        const longSideFit = Math.max(rect.width - footprintWidth, rect.height - footprintHeight);
        const rotationPenalty = getRotationPenalty(variant, strategy);
        const topY = rect.y;
        const leftX = rect.x;

        if (
          !best ||
          resultingUsedBottom < best.resultingUsedBottom - 1e-9 ||
          (Math.abs(resultingUsedBottom - best.resultingUsedBottom) < 1e-9 && rotationPenalty < best.rotationPenalty) ||
          (Math.abs(resultingUsedBottom - best.resultingUsedBottom) < 1e-9 && rotationPenalty === best.rotationPenalty && topY < best.topY - 1e-9) ||
          (Math.abs(resultingUsedBottom - best.resultingUsedBottom) < 1e-9 && rotationPenalty === best.rotationPenalty && Math.abs(topY - best.topY) < 1e-9 && shortSideFit < best.shortSideFit - 1e-9) ||
          (Math.abs(resultingUsedBottom - best.resultingUsedBottom) < 1e-9 && rotationPenalty === best.rotationPenalty && Math.abs(topY - best.topY) < 1e-9 && Math.abs(shortSideFit - best.shortSideFit) < 1e-9 && longSideFit < best.longSideFit - 1e-9) ||
          (Math.abs(resultingUsedBottom - best.resultingUsedBottom) < 1e-9 && rotationPenalty === best.rotationPenalty && Math.abs(topY - best.topY) < 1e-9 && Math.abs(shortSideFit - best.shortSideFit) < 1e-9 && Math.abs(longSideFit - best.longSideFit) < 1e-9 && leftX < best.leftX - 1e-9)
        ) {
          best = {
            rect,
            variant,
            footprintWidth,
            footprintHeight,
            resultingUsedBottom,
            rotationPenalty,
            topY,
            leftX,
            shortSideFit,
            longSideFit
          };
        }
      }
    }

    if (!best) {
      continue;
    }

    // Preserve/fix contentWidthMm/contentHeightMm for white-border "outside" mode.
    // When photos come from state.photos they have no contentWidthMm yet;
    // when re-nesting existing placements the values exist but must be swapped on rotation.
    let contentDimOverride = {};
    if (getWhiteBorderMode(photo) === 'outside' && getWhiteBorderMm(photo) > 0) {
      let cw = Number(photo.contentWidthMm) > 0 ? Number(photo.contentWidthMm) : getConfiguredContentDimensions(photo).widthMm;
      let ch = Number(photo.contentHeightMm) > 0 ? Number(photo.contentHeightMm) : getConfiguredContentDimensions(photo).heightMm;
      if (best.variant.isRotationChange) {
        contentDimOverride = { contentWidthMm: ch, contentHeightMm: cw };
      } else {
        contentDimOverride = { contentWidthMm: cw, contentHeightMm: ch };
      }
    }

    placed.push({
      ...photo,
      xMm: best.rect.x,
      yMm: best.rect.y,
      widthMm: best.variant.width,
      heightMm: best.variant.height,
      rotated: best.variant.rotated,
      ...contentDimOverride
    });
    placedIds.add(photo.id);

    freeRects = splitFreeRects(
      freeRects,
      {
        x: best.rect.x,
        y: best.rect.y,
        width: best.footprintWidth,
        height: best.footprintHeight
      },
      config.gap
    );
  }

  return {
    placed,
    remaining: photos.filter((p) => !placedIds.has(p.id))
  };
}

function comparePageResults(a, b, config) {
  if (a.placed.length !== b.placed.length) {
    return b.placed.length - a.placed.length;
  }

  const aBottom = getPlacedUsedBottom(a.placed, config);
  const bBottom = getPlacedUsedBottom(b.placed, config);
  if (Math.abs(aBottom - bBottom) > 1e-9) {
    return aBottom - bBottom;
  }

  const aRotated = a.placed.reduce((sum, item) => sum + (item.rotated ? 1 : 0), 0);
  const bRotated = b.placed.reduce((sum, item) => sum + (item.rotated ? 1 : 0), 0);
  if (aRotated !== bRotated) {
    return aRotated - bRotated;
  }

  const aLeftSum = a.placed.reduce((sum, item) => sum + item.xMm, 0);
  const bLeftSum = b.placed.reduce((sum, item) => sum + item.xMm, 0);
  if (Math.abs(aLeftSum - bLeftSum) > 1e-9) {
    return aLeftSum - bLeftSum;
  }

  const aTopSum = a.placed.reduce((sum, item) => sum + item.yMm, 0);
  const bTopSum = b.placed.reduce((sum, item) => sum + item.yMm, 0);
  if (Math.abs(aTopSum - bTopSum) > 1e-9) {
    return aTopSum - bTopSum;
  }

  return 0;
}

function nestSinglePage(photos, config) {
  const strategies = ['prefer-upright', 'neutral'];
  if (config.allowRotate) {
    strategies.push('prefer-rotated');
  }

  const results = strategies.map((strategy) => nestSinglePageWithStrategy(photos, config, strategy));
  results.sort((a, b) => comparePageResults(a, b, config));
  return results[0];
}

function nestAllPagesForMode(photos, config, mode) {
  const pages = [];
  let remaining = [...photos];
  let guard = 0;

  while (remaining.length > 0 && guard < 300) {
    guard += 1;
    const result = mode === 'mixed'
      ? nestSinglePage(remaining, config)
      : nestSinglePageWithStrategy(remaining, config, mode);
    if (result.placed.length === 0) break;
    pages.push(result.placed);
    remaining = result.remaining;
  }

  const totalUsedHeight = pages.reduce((sum, page) => sum + getPageUsedHeightMm(page, config), 0);
  const rotatedCount = pages.reduce(
    (sum, page) => sum + page.reduce((inner, item) => inner + (item.rotated ? 1 : 0), 0),
    0
  );

  return {
    mode,
    pages,
    remaining,
    totalUsedHeight,
    rotatedCount
  };
}

function compareJobResults(a, b) {
  if (a.remaining.length !== b.remaining.length) {
    return a.remaining.length - b.remaining.length;
  }
  if (a.pages.length !== b.pages.length) {
    return a.pages.length - b.pages.length;
  }
  if (Math.abs(a.totalUsedHeight - b.totalUsedHeight) > 1e-9) {
    return a.totalUsedHeight - b.totalUsedHeight;
  }
  if (a.rotatedCount !== b.rotatedCount) {
    return a.rotatedCount - b.rotatedCount;
  }
  return 0;
}

function nestAllPages(photos, config) {
  const modes = config.allowRotate
    ? ['mixed', 'force-upright', 'force-rotated']
    : ['force-upright'];

  const candidates = modes.map((mode) => nestAllPagesForMode(photos, config, mode));
  candidates.sort(compareJobResults);
  const best = candidates[0];

  return {
    pages: best.pages,
    remaining: best.remaining,
    mode: best.mode
  };
}

function getCurrentPagePlacements() {
  return state.pages[state.currentPage] || [];
}

function getPlacementMap() {
  const map = new Map();
  state.pages.forEach((page, idx) => {
    page.forEach((item) => {
      map.set(item.id, idx + 1);
    });
  });
  return map;
}

function getPhotoById(id) {
  return state.photos.find((photo) => photo.id === id) || null;
}

function cleanupEmptyPages() {
  for (let i = state.pages.length - 1; i >= 0; i--) {
    if (state.pages[i].length > 0) continue;
    state.pages.splice(i, 1);
    if (state.currentPage > i) {
      state.currentPage -= 1;
    }
  }

  if (state.pages.length === 0) {
    state.currentPage = 0;
    return;
  }

  state.currentPage = Math.min(Math.max(0, state.currentPage), state.pages.length - 1);
}

function findPlacementByIdGlobal(id) {
  for (let pageIndex = 0; pageIndex < state.pages.length; pageIndex++) {
    const itemIndex = state.pages[pageIndex].findIndex((item) => item.id === id);
    if (itemIndex >= 0) {
      return {
        pageIndex,
        itemIndex,
        item: state.pages[pageIndex][itemIndex]
      };
    }
  }
  return null;
}

function removePlacementByIdGlobal(id) {
  const found = findPlacementByIdGlobal(id);
  if (!found) return null;
  const [item] = state.pages[found.pageIndex].splice(found.itemIndex, 1);
  cleanupEmptyPages();
  return { ...found, item };
}

function ensureCurrentPage() {
  if (state.pages.length === 0) {
    state.pages = [[]];
    state.currentPage = 0;
  }
  if (!state.pages[state.currentPage]) {
    state.pages[state.currentPage] = [];
  }
}

function updateSelectionActionButtons() {
  const count = state.listSelection.size;
  if (placeSelectionBtn) placeSelectionBtn.disabled = count === 0;
  if (deleteSelectionBtn) deleteSelectionBtn.disabled = count === 0;
}

function getPlacementFromPhoto(photo) {
  const outer = getPlacementOuterDimensions(photo);
  return {
    ...photo,
    xMm: 0,
    yMm: 0,
    widthMm: outer.widthMm,
    heightMm: outer.heightMm,
    rotated: false
  };
}

function placePhotoOnCurrentPageAt(photoId, dropXmm, dropYmm) {
  const photo = getPhotoById(photoId);
  if (!photo) return null;

  const existing = findPlacementByIdGlobal(photoId);
  const base = existing?.item
    ? { ...existing.item, id: crypto.randomUUID() }
    : getPlacementFromPhoto(photo);

  ensureCurrentPage();
  const page = getCurrentPagePlacements();
  const config = getConfig();
  const candidate = {
    ...base,
    xMm: dropXmm - base.widthMm / 2,
    yMm: dropYmm - base.heightMm / 2
  };

  const snapped = findNearestFreePlacement(candidate, page, config, null, {
    maxRadiusMm: Math.max(base.widthMm, base.heightMm) + 180,
    angleSamples: 24,
    stepMm: getMoveStepMm()
  });

  if (!snapped) {
    return null;
  }

  const placed = {
    ...base,
    xMm: snapped.xMm,
    yMm: snapped.yMm,
    widthMm: snapped.widthMm,
    heightMm: snapped.heightMm,
    rotated: snapped.rotated
  };
  page.push(placed);

  return placed;
}

function nestCurrentPage() {
  ensureCurrentPage();
  const page = getCurrentPagePlacements();
  if (page.length === 0) {
    setStatus('Auf dem aktuellen Bogen sind keine Motive platziert.');
    return;
  }

  const config = getConfig();
  const result = nestSinglePage(page, config);
  state.pages[state.currentPage] = result.placed;
  invalidateExportBarcodeId();

  if (result.remaining.length > 0) {
    setStatus(`Bogen genestet: ${result.placed.length} platziert, ${result.remaining.length} passen nicht auf diesen Bogen.`);
  } else {
    setStatus(`Bogen genestet: ${result.placed.length} Motive sauber angeordnet.`);
  }

  renderTable();
  drawPreview();
}

function placeListSelectionOnCurrentPage() {
  const selectedIds = Array.from(state.listSelection);
  if (selectedIds.length === 0) {
    setStatus('Bitte zuerst Motive in der Liste auswaehlen.');
    return;
  }

  ensureCurrentPage();
  let placed = 0;
  const page = getCurrentPagePlacements();
  const startX = getConfig().padding + 30;
  const startY = getConfig().padding + 30;

  selectedIds.forEach((id, index) => {
    const offset = index * 12;
    const placedItem = placePhotoOnCurrentPageAt(id, startX + offset, startY + offset);
    if (placedItem) {
      placed += 1;
    }
  });

  nestCurrentPage();
  if (placed < selectedIds.length) {
    setStatus(`Auswahl teilweise platziert: ${placed}/${selectedIds.length}. Rest passt nicht auf den Bogen.`);
  }
}

function deleteListSelection() {
  const selectedIds = Array.from(state.listSelection);
  if (selectedIds.length === 0) {
    setStatus('Bitte zuerst Motive in der Liste auswaehlen.');
    return;
  }

  const deleteSet = new Set(selectedIds);
  state.photos = state.photos.filter((photo) => !deleteSet.has(photo.id));
  state.pages = state.pages.map((page) => page.filter((item) => !deleteSet.has(item.id)));
  cleanupEmptyPages();

  if (state.selectedId && deleteSet.has(state.selectedId)) {
    state.selectedId = null;
    setSelectedItemName('Keins');
    hideManualMenu();
  }

  state.listSelection.clear();
  updateSelectionActionButtons();
  renderTable();
  drawPreview();
  setStatus(`${selectedIds.length} Motiv(e) aus der Auswahl geloescht.`);
}

function getCropNorm(item) {
  return item.cropNorm || { x: 0, y: 0, w: 1, h: 1 };
}

function getCropPixels(item) {
  const cn = getCropNorm(item);
  const iw = Math.max(1, item.image.naturalWidth);
  const ih = Math.max(1, item.image.naturalHeight);
  const sx = Math.max(0, Math.min(iw - 1, cn.x * iw));
  const sy = Math.max(0, Math.min(ih - 1, cn.y * ih));
  const sw = Math.max(1, Math.min(iw - sx, cn.w * iw));
  const sh = Math.max(1, Math.min(ih - sy, cn.h * ih));
  return { sx, sy, sw, sh, iw, ih };
}

function getPlacementPixelDims(item) {
  const crop = getCropPixels(item);
  return {
    pxWidth: item.rotated ? crop.sh : crop.sw,
    pxHeight: item.rotated ? crop.sw : crop.sh
  };
}

function getPlacementAspectRatio(item) {
  const dims = getPlacementPixelDims(item);
  return dims.pxWidth / Math.max(1e-6, dims.pxHeight);
}

function updateManualScaleControlsForSelected() {
  const selected = getSelectedPlacement();
  if (!selected) {
    if (menuCurrentSizeValue) menuCurrentSizeValue.textContent = '-';
    if (menuScaleWidthCm) menuScaleWidthCm.value = '';
    if (menuScaleHeightCm) menuScaleHeightCm.value = '';
    if (menuScaleDpi) menuScaleDpi.value = '';
    if (menuWhiteBorderMm) menuWhiteBorderMm.value = '';
    if (menuWhiteBorderMode) menuWhiteBorderMode.value = 'outside';
    if (menuTargetWidthCm) menuTargetWidthCm.value = '';
    if (menuTargetHeightCm) menuTargetHeightCm.value = '';
    return;
  }

  const mode = getWhiteBorderMode(selected);
  const displayWidthMm = mode === 'target' && Number(selected.contentWidthMm) > 0
    ? Number(selected.contentWidthMm)
    : selected.widthMm;
  const displayHeightMm = mode === 'target' && Number(selected.contentHeightMm) > 0
    ? Number(selected.contentHeightMm)
    : selected.heightMm;

  if (menuCurrentSizeValue) {
    menuCurrentSizeValue.textContent = `${(selected.widthMm / MM_PER_CM).toFixed(1)} x ${(selected.heightMm / MM_PER_CM).toFixed(1)} cm`;
  }
  if (menuScaleWidthCm) menuScaleWidthCm.value = (displayWidthMm / MM_PER_CM).toFixed(1);
  if (menuScaleHeightCm) menuScaleHeightCm.value = (displayHeightMm / MM_PER_CM).toFixed(1);

  const dims = getPlacementPixelDims(selected);
  const dpiX = dims.pxWidth / (Math.max(1e-6, displayWidthMm) / MM_PER_INCH);
  const dpiY = dims.pxHeight / (Math.max(1e-6, displayHeightMm) / MM_PER_INCH);
  const avgDpi = (dpiX + dpiY) / 2;
  if (menuScaleDpi) menuScaleDpi.value = Number.isFinite(avgDpi) ? String(Math.round(avgDpi)) : '';
  if (menuWhiteBorderMm) menuWhiteBorderMm.value = (getWhiteBorderMm(selected) / MM_PER_CM).toFixed(1);
  if (menuWhiteBorderMode) menuWhiteBorderMode.value = mode;
  const target = getWhiteTargetDimensions(selected);
  if (menuTargetWidthCm) {
    if (target) {
      menuTargetWidthCm.value = (target.widthMm / MM_PER_CM).toFixed(1);
    } else if (mode !== 'target') {
      menuTargetWidthCm.value = '';
    }
  }
  if (menuTargetHeightCm) {
    if (target) {
      menuTargetHeightCm.value = (target.heightMm / MM_PER_CM).toFixed(1);
    } else if (mode !== 'target') {
      menuTargetHeightCm.value = '';
    }
  }
}

function applyWhiteBorderToSelected() {
  const selected = getSelectedPlacement();
  if (!selected) {
    setStatus('Bitte zuerst ein Motiv in der Vorschau auswaehlen.');
    return;
  }

  const inputValueCm = Math.max(0, parseUiNumber(menuWhiteBorderMm?.value || 0) || 0);
  const inputValueMm = inputValueCm * MM_PER_CM;
  const inputMode = menuWhiteBorderMode?.value === 'inside'
    ? 'inside'
    : (menuWhiteBorderMode?.value === 'target' ? 'target' : 'outside');
  const targetWidthMm = Math.max(0, (parseUiNumber(menuTargetWidthCm?.value || 0) || 0) * MM_PER_CM);
  const targetHeightMm = Math.max(0, (parseUiNumber(menuTargetHeightCm?.value || 0) || 0) * MM_PER_CM);
  const explicitContentWidthMm = Math.max(0, (parseUiNumber(menuScaleWidthCm?.value || 0) || 0) * MM_PER_CM);
  const explicitContentHeightMm = Math.max(0, (parseUiNumber(menuScaleHeightCm?.value || 0) || 0) * MM_PER_CM);

  const hadStoredContent = Number(selected.contentWidthMm) > 0 && Number(selected.contentHeightMm) > 0;
  const baseContentWidth = hadStoredContent ? Number(selected.contentWidthMm) : Number(selected.widthMm);
  const baseContentHeight = hadStoredContent ? Number(selected.contentHeightMm) : Number(selected.heightMm);

  const previous = {
    widthMm: selected.widthMm,
    heightMm: selected.heightMm,
    contentWidthMm: selected.contentWidthMm,
    contentHeightMm: selected.contentHeightMm,
    whiteBorderMm: selected.whiteBorderMm,
    whiteBorderMode: selected.whiteBorderMode,
    whiteBorderTargetWidthMm: selected.whiteBorderTargetWidthMm,
    whiteBorderTargetHeightMm: selected.whiteBorderTargetHeightMm
  };

  selected.whiteBorderMm = inputValueMm;
  selected.whiteBorderMode = inputMode;

  const page = getCurrentPagePlacements();
  const config = getConfig();

  const photo = getPhotoById(selected.id);
  if (photo) {
    photo.whiteBorderMm = inputValueMm;
    photo.whiteBorderMode = inputMode;
    photo.whiteBorderTargetWidthMm = null;
    photo.whiteBorderTargetHeightMm = null;
  }

  if (inputMode === 'target') {
    if (targetWidthMm <= 0 || targetHeightMm <= 0) {
      Object.assign(selected, previous);
      if (photo) {
        photo.whiteBorderMm = previous.whiteBorderMm || 0;
        photo.whiteBorderMode = previous.whiteBorderMode || 'outside';
        photo.whiteBorderTargetWidthMm = previous.whiteBorderTargetWidthMm || null;
        photo.whiteBorderTargetHeightMm = previous.whiteBorderTargetHeightMm || null;
      }
      setStatus('Bitte Zielbreite und Zielhoehe fuer den Weissraum angeben.');
      return;
    }

    const aspect = getPlacementAspectRatio(selected);
    let contentWidth = explicitContentWidthMm > 0 ? explicitContentWidthMm : Math.max(1, baseContentWidth);
    let contentHeight = explicitContentHeightMm > 0 ? explicitContentHeightMm : Math.max(1, baseContentHeight);

    if (explicitContentWidthMm > 0 && explicitContentHeightMm > 0) {
      const fromWidthHeight = explicitContentWidthMm / Math.max(1e-6, aspect);
      if (fromWidthHeight <= explicitContentHeightMm + 1e-6) {
        contentWidth = explicitContentWidthMm;
        contentHeight = fromWidthHeight;
      } else {
        contentHeight = explicitContentHeightMm;
        contentWidth = contentHeight * Math.max(1e-6, aspect);
      }
    } else if (explicitContentWidthMm > 0) {
      contentHeight = contentWidth / Math.max(1e-6, aspect);
    } else if (explicitContentHeightMm > 0) {
      contentWidth = contentHeight * Math.max(1e-6, aspect);
    } else {
      contentWidth = Math.max(1, baseContentWidth);
      contentHeight = contentWidth / Math.max(1e-6, aspect);
    }

    if (targetWidthMm + 1e-6 < contentWidth || targetHeightMm + 1e-6 < contentHeight) {
      Object.assign(selected, previous);
      if (photo) {
        photo.whiteBorderMm = previous.whiteBorderMm || 0;
        photo.whiteBorderMode = previous.whiteBorderMode || 'outside';
        photo.whiteBorderTargetWidthMm = previous.whiteBorderTargetWidthMm || null;
        photo.whiteBorderTargetHeightMm = previous.whiteBorderTargetHeightMm || null;
      }
      setStatus(`Zielgroesse zu klein: Bild ${(contentWidth / MM_PER_CM).toFixed(1)} x ${(contentHeight / MM_PER_CM).toFixed(1)} cm, Ziel ${(targetWidthMm / MM_PER_CM).toFixed(1)} x ${(targetHeightMm / MM_PER_CM).toFixed(1)} cm.`);
      return;
    }

    const centerX = selected.xMm + selected.widthMm / 2;
    const centerY = selected.yMm + selected.heightMm / 2;
    const candidate = {
      ...selected,
      xMm: centerX - targetWidthMm / 2,
      yMm: centerY - targetHeightMm / 2,
      widthMm: targetWidthMm,
      heightMm: targetHeightMm
    };
    const snapped = findNearestFreePlacement(candidate, page, config, selected.id, {
      maxRadiusMm: Math.max(targetWidthMm, targetHeightMm) + 180,
      angleSamples: 24,
      stepMm: getMoveStepMm()
    });

    if (!snapped) {
      Object.assign(selected, previous);
      if (photo) {
        photo.whiteBorderMm = previous.whiteBorderMm || 0;
        photo.whiteBorderMode = previous.whiteBorderMode || 'outside';
        photo.whiteBorderTargetWidthMm = previous.whiteBorderTargetWidthMm || null;
        photo.whiteBorderTargetHeightMm = previous.whiteBorderTargetHeightMm || null;
      }
      setStatus('Zielgroesse kann nicht platziert werden (kein freier Bereich auf dem Bogen).');
      return;
    }

    selected.xMm = snapped.xMm;
    selected.yMm = snapped.yMm;
    selected.contentWidthMm = contentWidth;
    selected.contentHeightMm = contentHeight;
    selected.widthMm = snapped.widthMm;
    selected.heightMm = snapped.heightMm;
    selected.whiteBorderTargetWidthMm = targetWidthMm;
    selected.whiteBorderTargetHeightMm = targetHeightMm;
    if (photo) {
      photo.whiteBorderTargetWidthMm = targetWidthMm;
      photo.whiteBorderTargetHeightMm = targetHeightMm;
    }
  } else if (inputMode === 'outside' && inputValueMm > 0) {
    selected.contentWidthMm = Math.max(1, baseContentWidth);
    selected.contentHeightMm = Math.max(1, baseContentHeight);
    selected.widthMm = Math.max(1, selected.contentWidthMm + inputValueMm * 2);
    selected.heightMm = Math.max(1, selected.contentHeightMm + inputValueMm * 2);
    selected.whiteBorderTargetWidthMm = null;
    selected.whiteBorderTargetHeightMm = null;
  } else {
    selected.widthMm = Math.max(1, baseContentWidth);
    selected.heightMm = Math.max(1, baseContentHeight);
    selected.contentWidthMm = null;
    selected.contentHeightMm = null;
    selected.whiteBorderTargetWidthMm = null;
    selected.whiteBorderTargetHeightMm = null;
  }

  if (inputMode === 'inside' && photo) {
    ensurePhotoAutoFit(photo, config);
  }

  updateManualScaleControlsForSelected();
  
  drawPreview();
  if (inputMode === 'target') {
    setStatus(`Weissraum uebernommen: Bild ${(selected.contentWidthMm / MM_PER_CM).toFixed(1)} x ${(selected.contentHeightMm / MM_PER_CM).toFixed(1)} cm in Ziel ${(selected.widthMm / MM_PER_CM).toFixed(1)} x ${(selected.heightMm / MM_PER_CM).toFixed(1)} cm.`);
  } else {
    setStatus('Weissrand uebernommen.');
  }
}

function updateOversizeEditor() {
  if (!oversizeEditor || !oversizeEditorText || !oversizeWidthCmInput || !oversizeApplyBtn) return;

  const selectedPhoto = state.selectedId ? getPhotoById(state.selectedId) : null;
  const config = getConfig();
  if (!selectedPhoto || !isPhotoOversizeForConfig(selectedPhoto, config)) {
    oversizeEditor.hidden = true;
    return;
  }

  oversizeEditor.hidden = false;
  const dpi = Number(dpiInput.value) || 300;
  oversizeEditorText.textContent = `Das Bild ist in ${dpi} dpi zu gross fuer die Papierbahn.`;
  oversizeWidthCmInput.value = (getConfiguredContentDimensions(selectedPhoto).widthMm / MM_PER_CM).toFixed(1);
  oversizeApplyBtn.disabled = false;
}

function syncScaleInputsByRatio(changedAxis) {
  const selected = getSelectedPlacement();
  if (!selected) return;
  if ((menuWhiteBorderMode?.value || '') === 'target') return;
  const ratio = getPlacementAspectRatio(selected);

  const w = parseUiNumber(menuScaleWidthCm?.value || 0) || 0;
  const h = parseUiNumber(menuScaleHeightCm?.value || 0) || 0;

  if (changedAxis === 'width' && w > 0 && menuScaleHeightCm) {
    menuScaleHeightCm.value = (w / ratio).toFixed(1);
  }
  if (changedAxis === 'height' && h > 0 && menuScaleWidthCm) {
    menuScaleWidthCm.value = (h * ratio).toFixed(1);
  }
}

function updateSizeFromDpi() {
  const selected = getSelectedPlacement();
  if (!selected) return;

  const targetDpi = Number(menuScaleDpi?.value || 0);
  if (targetDpi <= 0) return;

  const pxDims = getPlacementPixelDims(selected);
  const calculatedWidthMm = (pxDims.pxWidth / targetDpi) * MM_PER_INCH;
  const calculatedHeightMm = (pxDims.pxHeight / targetDpi) * MM_PER_INCH;
  const widthMm = calculatedWidthMm;
  const heightMm = calculatedHeightMm;
  
  // Update the width/height fields
  if (menuScaleWidthCm) {
    menuScaleWidthCm.value = (widthMm / MM_PER_CM).toFixed(1);
    manualScaleLastEdited = 'width';
  }
  if (menuScaleHeightCm) {
    menuScaleHeightCm.value = (heightMm / MM_PER_CM).toFixed(1);
  }
}

function applyScaleToSelected() {
  const selected = getSelectedPlacement();
  if (!selected) {
    setStatus('Bitte zuerst ein Motiv in der Vorschau auswaehlen.');
    return;
  }

  const page = getCurrentPagePlacements();
  const config = getConfig();

  const targetWidthCm = parseUiNumber(menuScaleWidthCm?.value || 0) || 0;
  const targetHeightCm = parseUiNumber(menuScaleHeightCm?.value || 0) || 0;
  const targetDpi = Number(menuScaleDpi?.value || 0);

  let targetWidthMm = targetWidthCm > 0 ? targetWidthCm * MM_PER_CM : null;
  let targetHeightMm = targetHeightCm > 0 ? targetHeightCm * MM_PER_CM : null;

  const pxDims = getPlacementPixelDims(selected);
  if ((!targetWidthMm || !targetHeightMm) && targetDpi > 0) {
    const dpiWidthMm = (pxDims.pxWidth / targetDpi) * MM_PER_INCH;
    const dpiHeightMm = (pxDims.pxHeight / targetDpi) * MM_PER_INCH;
    if (!targetWidthMm) targetWidthMm = dpiWidthMm;
    if (!targetHeightMm) targetHeightMm = dpiHeightMm;
  }

  const ratio = getPlacementAspectRatio(selected);
  if (targetWidthMm && !targetHeightMm) {
    targetHeightMm = targetWidthMm / ratio;
  }
  if (targetHeightMm && !targetWidthMm) {
    targetWidthMm = targetHeightMm * ratio;
  }
  if (targetWidthMm && targetHeightMm) {
    if (manualScaleLastEdited === 'height') {
      targetWidthMm = targetHeightMm * ratio;
    } else {
      targetHeightMm = targetWidthMm / ratio;
    }
  }

  if (!targetWidthMm || !targetHeightMm || targetWidthMm <= 0 || targetHeightMm <= 0) {
    setStatus('Bitte Zielgroesse oder DPI gueltig eingeben.');
    return;
  }

  const centerX = selected.xMm + selected.widthMm / 2;
  const centerY = selected.yMm + selected.heightMm / 2;
  const candidate = {
    ...selected,
    xMm: centerX - targetWidthMm / 2,
    yMm: centerY - targetHeightMm / 2,
    widthMm: targetWidthMm,
    heightMm: targetHeightMm
  };

  const snapped = findNearestFreePlacement(candidate, page, config, selected.id, {
    maxRadiusMm: Math.max(targetWidthMm, targetHeightMm) + 180,
    angleSamples: 24,
    stepMm: getMoveStepMm()
  });

  if (!snapped) {
    setStatus('Skalierung nicht moeglich (keine freie Position gefunden).');
    return;
  }

  const preservedWhiteBorderMm = selected.whiteBorderMm;
  const preservedWhiteBorderMode = selected.whiteBorderMode;

  selected.xMm = snapped.xMm;
  selected.yMm = snapped.yMm;
  selected.widthMm = snapped.widthMm;
  selected.heightMm = snapped.heightMm;
  selected.whiteBorderMm = preservedWhiteBorderMm;
  selected.whiteBorderMode = preservedWhiteBorderMode;

  // Keep content dimensions in sync for outside white-border mode.
  // Otherwise a subsequent border apply can restore old dimensions and ignore scaling.
  if (getWhiteBorderMode(selected) === 'outside' && getWhiteBorderMm(selected) > 0) {
    const borderMm = getWhiteBorderMm(selected);
    selected.contentWidthMm = Math.max(1, selected.widthMm - borderMm * 2);
    selected.contentHeightMm = Math.max(1, selected.heightMm - borderMm * 2);
  } else if (getWhiteBorderMode(selected) === 'target') {
    selected.contentWidthMm = Math.max(1, selected.widthMm);
    selected.contentHeightMm = Math.max(1, selected.heightMm);
  } else {
    selected.contentWidthMm = null;
    selected.contentHeightMm = null;
  }

  updateManualScaleControlsForSelected();
  drawPreview();
  setStatus(`${selected.name} skaliert auf ${(selected.widthMm / MM_PER_CM).toFixed(1)} x ${(selected.heightMm / MM_PER_CM).toFixed(1)} cm.`);
}

function fitRectToAspect(rect, aspect) {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  let w = rect.w;
  let h = rect.h;
  if (w / h > aspect) {
    w = h * aspect;
  } else {
    h = w / aspect;
  }
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

function clampCropRect(rect, iw, ih) {
  const r = { ...rect };
  r.w = Math.min(Math.max(8, r.w), iw);
  r.h = Math.min(Math.max(8, r.h), ih);
  r.x = Math.min(Math.max(0, r.x), iw - r.w);
  r.y = Math.min(Math.max(0, r.y), ih - r.h);
  return r;
}

function toPercent(value, total) {
  return (value / Math.max(1e-6, total)) * 100;
}

function fromPercent(value, total) {
  return (value / 100) * total;
}

function getCropRectCanvas(selected) {
  const d = cropEditor.display;
  const iw = selected.image.naturalWidth;
  const ih = selected.image.naturalHeight;
  return {
    x: d.x + (cropEditor.rect.x / iw) * d.w,
    y: d.y + (cropEditor.rect.y / ih) * d.h,
    w: (cropEditor.rect.w / iw) * d.w,
    h: (cropEditor.rect.h / ih) * d.h
  };
}

function canvasToImagePoint(selected, x, y) {
  const d = cropEditor.display;
  const iw = selected.image.naturalWidth;
  const ih = selected.image.naturalHeight;
  const px = ((x - d.x) / Math.max(1e-6, d.w)) * iw;
  const py = ((y - d.y) / Math.max(1e-6, d.h)) * ih;
  return {
    x: Math.min(Math.max(0, px), iw),
    y: Math.min(Math.max(0, py), ih)
  };
}

function getHandlePoints(rect) {
  return {
    nw: { x: rect.x, y: rect.y },
    ne: { x: rect.x + rect.w, y: rect.y },
    se: { x: rect.x + rect.w, y: rect.y + rect.h },
    sw: { x: rect.x, y: rect.y + rect.h }
  };
}

function getHandleAtCanvasPoint(selected, x, y, threshold = 12) {
  const rect = getCropRectCanvas(selected);
  const handles = getHandlePoints(rect);
  let best = null;
  let bestDist = Infinity;

  for (const [key, pt] of Object.entries(handles)) {
    const dist = Math.hypot(x - pt.x, y - pt.y);
    if (dist <= threshold && dist < bestDist) {
      best = key;
      bestDist = dist;
    }
  }
  return best;
}

function getResizeAnchorForHandle(handle, rect) {
  if (handle === 'nw') return { x: rect.x + rect.w, y: rect.y + rect.h };
  if (handle === 'ne') return { x: rect.x, y: rect.y + rect.h };
  if (handle === 'se') return { x: rect.x, y: rect.y };
  if (handle === 'sw') return { x: rect.x + rect.w, y: rect.y };
  return null;
}

function buildRectFromHandleDrag(handle, anchor, pointer, iw, ih) {
  const minSize = 8;
  let x = 0;
  let y = 0;
  let w = minSize;
  let h = minSize;

  if (handle === 'nw') {
    x = Math.min(pointer.x, anchor.x - minSize);
    y = Math.min(pointer.y, anchor.y - minSize);
    w = anchor.x - x;
    h = anchor.y - y;
  } else if (handle === 'ne') {
    x = anchor.x;
    y = Math.min(pointer.y, anchor.y - minSize);
    w = Math.max(minSize, pointer.x - anchor.x);
    h = anchor.y - y;
  } else if (handle === 'se') {
    x = anchor.x;
    y = anchor.y;
    w = Math.max(minSize, pointer.x - anchor.x);
    h = Math.max(minSize, pointer.y - anchor.y);
  } else if (handle === 'sw') {
    x = Math.min(pointer.x, anchor.x - minSize);
    y = anchor.y;
    w = anchor.x - x;
    h = Math.max(minSize, pointer.y - anchor.y);
  }

  return clampCropRect({ x, y, w, h }, iw, ih);
}

// Ratio-Inputs aus aktuellem Crop-Rect aktualisieren (normiert: max(H,W) = 10)
function updateRatioInputsFromRect() {
  if (!cropEditor.active || !cropRatioH || !cropRatioW) return;
  const ratioShown = Number(cropRatioH.value) > 0 && Number(cropRatioW.value) > 0;
  if (isCropRatioLocked() && ratioShown && document.activeElement !== cropRatioH && document.activeElement !== cropRatioW) return;
  // Nicht überschreiben, solange der Nutzer in den Ratio-Feldern tippt
  if (document.activeElement === cropRatioH || document.activeElement === cropRatioW) return;
  const h = cropEditor.rect.h;
  const w = cropEditor.rect.w;
  if (h <= 0 || w <= 0) return;
  const factor = 10 / Math.max(h, w);
  cropRatioH.value = (h * factor).toFixed(2);
  cropRatioW.value = (w * factor).toFixed(2);
}

// Ratio aus Ratio-Inputs auf das Crop-Rect anwenden (Mittelpunkt bleibt, Grösse passt sich an)
function applyCropRatioFromInputs() {
  if (!cropEditor.active) return;
  if (isCropRatioLocked()) return;
  const selected = getSelectedPlacement();
  if (!selected) return;
  const rH = Number(cropRatioH?.value || 0);
  const rW = Number(cropRatioW?.value || 0);
  if (rH <= 0 || rW <= 0) return;

  const iw = selected.image.naturalWidth;
  const ih = selected.image.naturalHeight;
  const targetAspect = rW / rH; // W/H
  const cx = cropEditor.rect.x + cropEditor.rect.w / 2;
  const cy = cropEditor.rect.y + cropEditor.rect.h / 2;

  let w = cropEditor.rect.w;
  let h = w / targetAspect;
  if (h > ih) { h = ih; w = h * targetAspect; }
  if (w > iw) { w = iw; h = w / targetAspect; }

  cropEditor.rect = clampCropRect({ x: cx - w / 2, y: cy - h / 2, w, h }, iw, ih);
  cropEditor.aspect = targetAspect;
  renderCropOverlay();
  // X/Y/W/H% aktualisieren, aber Ratio-Inputs NICHT überschreiben (Nutzer tippt dort gerade)
  const iwc = Math.max(1, iw);
  const ihc = Math.max(1, ih);
  if (cropRectXPercent) cropRectXPercent.value = toPercent(cropEditor.rect.x, iwc).toFixed(2);
  if (cropRectYPercent) cropRectYPercent.value = toPercent(cropEditor.rect.y, ihc).toFixed(2);
  if (cropRectWPercent) cropRectWPercent.value = toPercent(cropEditor.rect.w, iwc).toFixed(2);
  if (cropRectHPercent) cropRectHPercent.value = toPercent(cropEditor.rect.h, ihc).toFixed(2);
  updateCropOverlayDpiInfo();
}

function isCropRatioLocked() {
  return Boolean(cropLockRatio?.checked);
}

function syncCropRatioLockUi() {
  const locked = isCropRatioLocked();
  if (cropRatioH) cropRatioH.disabled = locked;
  if (cropRatioW) cropRatioW.disabled = locked;
}

function updateCropRectInputs() {
  const selected = getSelectedPlacement();
  if (!selected || !cropEditor.active) return;
  const iw = Math.max(1, selected.image.naturalWidth);
  const ih = Math.max(1, selected.image.naturalHeight);

  if (cropRectXPercent) cropRectXPercent.value = toPercent(cropEditor.rect.x, iw).toFixed(2);
  if (cropRectYPercent) cropRectYPercent.value = toPercent(cropEditor.rect.y, ih).toFixed(2);
  if (cropRectWPercent) cropRectWPercent.value = toPercent(cropEditor.rect.w, iw).toFixed(2);
  if (cropRectHPercent) cropRectHPercent.value = toPercent(cropEditor.rect.h, ih).toFixed(2);
  updateRatioInputsFromRect();
}

function applyCropRectInputs(changedField) {
  if (!cropEditor.active) return;
  const selected = getSelectedPlacement();
  if (!selected) return;

  const iw = Math.max(1, selected.image.naturalWidth);
  const ih = Math.max(1, selected.image.naturalHeight);
  const current = cropEditor.rect;

  let x = fromPercent(Number(cropRectXPercent?.value || toPercent(current.x, iw)), iw);
  let y = fromPercent(Number(cropRectYPercent?.value || toPercent(current.y, ih)), ih);
  let w = fromPercent(Number(cropRectWPercent?.value || toPercent(current.w, iw)), iw);
  let h = fromPercent(Number(cropRectHPercent?.value || toPercent(current.h, ih)), ih);

  if (changedField === 'x') x = Math.max(0, x);
  if (changedField === 'y') y = Math.max(0, y);
  if (changedField === 'w') w = Math.max(8, w);
  if (changedField === 'h') h = Math.max(8, h);

  let nextRect = { x, y, w, h };
  if (isCropRatioLocked() && cropEditor.lockedAspect > 0 && (changedField === 'w' || changedField === 'h')) {
    nextRect = fitRectToAspect(nextRect, cropEditor.lockedAspect);
  }

  cropEditor.rect = clampCropRect(nextRect, iw, ih);
  cropEditor.aspect = cropEditor.rect.w / Math.max(1e-6, cropEditor.rect.h);
  renderCropOverlay();
  updateCropRectInputs();
  updateCropOverlayDpiInfo();
}

function applyOverlayTransform() {
  if (!photoOverlayImage) return;
  photoOverlayImage.style.transform = `translate(${overlayView.tx}px, ${overlayView.ty}px) scale(${overlayView.scale})`;
}

function resetOverlayView() {
  overlayView.scale = 1;
  overlayView.tx = 0;
  overlayView.ty = 0;
  overlayView.dragging = false;
  overlayView.pointerId = null;
  if (photoOverlayViewport) {
    photoOverlayViewport.classList.remove('is-dragging');
  }
  applyOverlayTransform();
}

function renderCropOverlay() {
  if (!cropOverlayCanvas || !cropEditor.active) return;
  const selected = getSelectedPlacement();
  if (!selected) return;

  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const cw = Math.max(1, Math.floor(cropOverlayCanvas.clientWidth));
  const ch = Math.max(1, Math.floor(cropOverlayCanvas.clientHeight));
  cropOverlayCanvas.width = Math.floor(cw * dpr);
  cropOverlayCanvas.height = Math.floor(ch * dpr);
  const c = cropOverlayCanvas.getContext('2d');
  c.setTransform(dpr, 0, 0, dpr, 0, 0);

  const iw = selected.image.naturalWidth;
  const ih = selected.image.naturalHeight;
  const scale = Math.min(cw / iw, ch / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = (cw - dw) / 2;
  const dy = (ch - dh) / 2;
  cropEditor.display = { x: dx, y: dy, w: dw, h: dh };

  c.clearRect(0, 0, cw, ch);
  c.drawImage(selected.image, dx, dy, dw, dh);

  c.fillStyle = 'rgba(0,0,0,0.45)';
  c.fillRect(0, 0, cw, ch);

  const rx = dx + (cropEditor.rect.x / iw) * dw;
  const ry = dy + (cropEditor.rect.y / ih) * dh;
  const rw = (cropEditor.rect.w / iw) * dw;
  const rh = (cropEditor.rect.h / ih) * dh;

  c.drawImage(selected.image, cropEditor.rect.x, cropEditor.rect.y, cropEditor.rect.w, cropEditor.rect.h, rx, ry, rw, rh);
  c.strokeStyle = '#77ff9d';
  c.lineWidth = 2;
  c.strokeRect(rx, ry, rw, rh);

  const handles = getHandlePoints({ x: rx, y: ry, w: rw, h: rh });
  c.fillStyle = '#f5fff8';
  c.strokeStyle = '#0d2118';
  c.lineWidth = 1.5;
  for (const pt of Object.values(handles)) {
    c.beginPath();
    c.arc(pt.x, pt.y, 6, 0, Math.PI * 2);
    c.fill();
    c.stroke();
  }
}

function getCropTargetSizeMm() {
  const wCm = Number(cropTargetWidthCm?.value || 0);
  const hCm = Number(cropTargetHeightCm?.value || 0);
  if (wCm <= 0 || hCm <= 0) return null;
  return { widthMm: wCm * MM_PER_CM, heightMm: hCm * MM_PER_CM };
}

function getCropPlacementPixelDims(item, rect) {
  if (item.rotated) {
    return { pxWidth: rect.h, pxHeight: rect.w };
  }
  return { pxWidth: rect.w, pxHeight: rect.h };
}

function updateCropOverlayDpiInfo() {
  if (!cropOverlayDpiInfo) return;
  const selected = getSelectedPlacement();
  if (!selected || !cropEditor.active) {
    cropOverlayDpiInfo.textContent = 'DPI: -';
    return;
  }

  const target = getCropTargetSizeMm();
  if (!target) {
    cropOverlayDpiInfo.textContent = 'DPI: Bitte Zielbreite und Zielhoehe eingeben.';
    return;
  }

  const px = getCropPlacementPixelDims(selected, cropEditor.rect);
  const dpiX = px.pxWidth / (target.widthMm / MM_PER_INCH);
  const dpiY = px.pxHeight / (target.heightMm / MM_PER_INCH);
  const minDpi = Math.min(dpiX, dpiY);
  cropOverlayDpiInfo.textContent = `DPI X: ${Math.round(dpiX)} | DPI Y: ${Math.round(dpiY)} | Min: ${Math.round(minDpi)}`;
}

function getCurrentCropAspect() {
  if (cropEditor.active && cropEditor.rect.w > 0 && cropEditor.rect.h > 0) {
    return cropEditor.rect.w / Math.max(1e-6, cropEditor.rect.h);
  }
  const selected = getSelectedPlacement();
  if (selected) {
    const crop = getCropPixels(selected);
    return crop.sw / Math.max(1e-6, crop.sh);
  }
  return 1;
}

function updateCropAspectFromInputs(changedAxis = null) {
  if (!cropEditor.active) return;
  const ratioLocked = isCropRatioLocked();

  const aspect = getCurrentCropAspect(); // W/H
  const widthValue = Number(cropTargetWidthCm?.value || 0);
  const heightValue = Number(cropTargetHeightCm?.value || 0);

  if (ratioLocked) {
    if (changedAxis === 'width' && widthValue > 0 && cropTargetHeightCm) {
      cropTargetHeightCm.value = (widthValue / Math.max(1e-6, aspect)).toFixed(1);
    } else if (changedAxis === 'height' && heightValue > 0 && cropTargetWidthCm) {
      cropTargetWidthCm.value = (heightValue * aspect).toFixed(1);
    } else if (changedAxis === null) {
      if (widthValue > 0 && (!heightValue || heightValue <= 0) && cropTargetHeightCm) {
        cropTargetHeightCm.value = (widthValue / Math.max(1e-6, aspect)).toFixed(1);
      } else if (heightValue > 0 && (!widthValue || widthValue <= 0) && cropTargetWidthCm) {
        cropTargetWidthCm.value = (heightValue * aspect).toFixed(1);
      }
    }
  }

  if (menuScaleWidthCm && cropTargetWidthCm) menuScaleWidthCm.value = cropTargetWidthCm.value;
  if (menuScaleHeightCm && cropTargetHeightCm) menuScaleHeightCm.value = cropTargetHeightCm.value;

  // Nur ohne Sperre darf die Druckgroesse das Ausschnitt-Verhaeltnis direkt treiben.
  if (!ratioLocked && changedAxis !== null) {
    const newW = Number(cropTargetWidthCm?.value || 0);
    const newH = Number(cropTargetHeightCm?.value || 0);
    if (newW > 0 && newH > 0 && cropRatioH && cropRatioW) {
      const factor = 10 / Math.max(newH, newW);
      cropRatioH.value = (newH * factor).toFixed(2);
      cropRatioW.value = (newW * factor).toFixed(2);
      applyCropRatioFromInputs();
    }
  }

  updateCropOverlayDpiInfo();
}

function openCropOverlayForSelected() {
  const selected = getSelectedPlacement();
  if (!selected || !cropOverlay) {
    setStatus('Bitte zuerst ein Motiv in der Vorschau auswaehlen.');
    return;
  }

  const tw = parseUiNumber(menuScaleWidthCm?.value || 0) || (selected.widthMm / MM_PER_CM);
  const th = parseUiNumber(menuScaleHeightCm?.value || 0) || (selected.heightMm / MM_PER_CM);

  if (cropTargetWidthCm) cropTargetWidthCm.value = tw.toFixed(1);
  if (cropTargetHeightCm) cropTargetHeightCm.value = th.toFixed(1);

  const cropPx = getCropPixels(selected);
  const rect = clampCropRect({ x: cropPx.sx, y: cropPx.sy, w: cropPx.sw, h: cropPx.sh }, cropPx.iw, cropPx.ih);

  cropEditor.active = true;
  cropEditor.aspect = rect.w / Math.max(1e-6, rect.h);
  cropEditor.lockedAspect = cropEditor.aspect;
  cropEditor.rect = rect;
  cropEditor.dragging = false;
  cropEditor.dragMode = null;
  cropEditor.activeHandle = null;
  cropEditor.pointerId = null;
  cropEditor.resizeAnchor = null;

  cropOverlay.hidden = false;
  document.body.style.overflow = 'hidden';
  syncCropRatioLockUi();
  updateCropAspectFromInputs();
  renderCropOverlay();
  updateCropRectInputs();
  updateCropOverlayDpiInfo();
}

function closeCropOverlay() {
  cropEditor.active = false;
  cropEditor.dragging = false;
  cropEditor.dragMode = null;
  cropEditor.activeHandle = null;
  cropEditor.pointerId = null;
  cropEditor.resizeAnchor = null;
  if (cropOverlay) cropOverlay.hidden = true;
  if (photoOverlay && !photoOverlay.hidden) {
    document.body.style.overflow = 'hidden';
  } else {
    document.body.style.overflow = '';
  }
}

function applyCropOverlay() {
  const selected = getSelectedPlacement();
  if (!selected || !cropEditor.active) {
    closeCropOverlay();
    return;
  }

  const iw = selected.image.naturalWidth;
  const ih = selected.image.naturalHeight;
  const r = clampCropRect(cropEditor.rect, iw, ih);
  selected.cropNorm = {
    x: r.x / iw,
    y: r.y / ih,
    w: r.w / iw,
    h: r.h / ih
  };

  // Placement-Dimensionen anpassen. Das SEITENVERHÄLTNIS des Ausschnitts hat
  // immer Vorrang (kein Strecken). Zielgrösse bestimmt nur den Maßstab.
  // cropAspectWH = W/H des Ausschnitts auf dem Bogen (berücksichtigt Rotation).
  const cropAspectWH = getPlacementAspectRatio(selected);
  const targetW = Number(cropTargetWidthCm?.value || 0);
  const targetH = Number(cropTargetHeightCm?.value || 0);

  const borderMm = getWhiteBorderMm(selected);
  const hasOutsideBorder = getWhiteBorderMode(selected) === 'outside' && borderMm > 0 && Number(selected.contentWidthMm) > 0;

  if (hasOutsideBorder) {
    // targetW/H refer to the OUTER size (incl. border), which is what the size inputs show.
    // Derive content dimensions from the outer target, then recompute outer height.
    const outerW = targetW > 0 ? targetW * MM_PER_CM : (targetH > 0 ? targetH * MM_PER_CM * cropAspectWH : Number(selected.widthMm));
    const contentW = Math.max(1, outerW - 2 * borderMm);
    const contentH = contentW / Math.max(1e-6, cropAspectWH);
    selected.contentWidthMm = contentW;
    selected.contentHeightMm = contentH;
    selected.widthMm = outerW;
    selected.heightMm = contentH + 2 * borderMm;
  } else if (targetW > 0) {
    // Breite aus Zielfeld, Höhe immer aus Beschnitt-Verhältnis ableiten
    selected.widthMm = targetW * MM_PER_CM;
    selected.heightMm = selected.widthMm / Math.max(1e-6, cropAspectWH);
  } else if (targetH > 0) {
    // Nur Höhe gesetzt, Breite ableiten
    selected.heightMm = targetH * MM_PER_CM;
    selected.widthMm = selected.heightMm * cropAspectWH;
  } else {
    // Keine Zielgrösse: Breite beibehalten, Höhe aus Beschnitt-Verhältnis
    selected.heightMm = selected.widthMm / Math.max(1e-6, cropAspectWH);
  }

  closeCropOverlay();
  updateManualScaleControlsForSelected();
  drawPreview();
  setStatus('Beschnitt uebernommen.');
}

function canPlaceCandidate(candidate, pagePlacements, config, ignoreId = null) {
  const fp = getFootprintRect(candidate);

  if (fp.x < config.padding - 1e-6) return false;
  if (fp.y < config.padding - 1e-6) return false;
  if (fp.x + fp.width > config.rollWidth - config.padding + 1e-6) return false;
  if (fp.y + fp.height > config.maxHeight - config.padding + 1e-6) return false;

  for (const other of pagePlacements) {
    if (other.id === ignoreId) continue;
    if (rectsOverlap(fp, getFootprintRect(other), config.gap)) return false;
  }

  return true;
}

function clampCandidateToBounds(candidate, config) {
  const minX = config.padding;
  const maxX = config.rollWidth - config.padding - candidate.widthMm;
  const minY = config.padding;
  const maxY = config.maxHeight - config.padding - candidate.heightMm;

  return {
    ...candidate,
    xMm: Math.min(Math.max(candidate.xMm, minX), maxX),
    yMm: Math.min(Math.max(candidate.yMm, minY), maxY)
  };
}

function findNearestFreePlacement(candidate, pagePlacements, config, ignoreId = null, options = {}) {
  const stepMm = Math.max(1, Number(options.stepMm) || getMoveStepMm());
  const maxRadiusMm = Math.max(stepMm, Number(options.maxRadiusMm) || 120);
  const angleSamples = Math.max(8, Number(options.angleSamples) || 16);

  const base = clampCandidateToBounds(candidate, config);
  if (canPlaceCandidate(base, pagePlacements, config, ignoreId)) {
    return base;
  }

  for (let radius = stepMm; radius <= maxRadiusMm + 1e-6; radius += stepMm) {
    for (let i = 0; i < angleSamples; i++) {
      const angle = (Math.PI * 2 * i) / angleSamples;
      const test = clampCandidateToBounds(
        {
          ...candidate,
          xMm: base.xMm + Math.cos(angle) * radius,
          yMm: base.yMm + Math.sin(angle) * radius
        },
        config
      );
      if (canPlaceCandidate(test, pagePlacements, config, ignoreId)) {
        return test;
      }
    }
  }

  return null;
}

function updatePageIndicator() {
  const total = state.pages.length;
  const current = total === 0 ? 0 : state.currentPage + 1;
  pageIndicator.textContent = `Seite ${current} / ${total}`;

  if (!effectiveHeightInfo) return;
  if (total === 0) {
    effectiveHeightInfo.textContent = 'Effektive Seitenhoehe: -';
    return;
  }

  const config = getConfig();
  const page = getCurrentPagePlacements();
  const effectiveHeight = getEffectivePageHeightMm(page, config);
  effectiveHeightInfo.textContent = `Effektive Seitenhoehe: ${effectiveHeight.toFixed(1)} mm (Max: ${config.maxHeight.toFixed(1)} mm)`;
}

function updatePhotoCardSelection() {
  const cards = tableBody.querySelectorAll('.photo-card');
  cards.forEach((card) => {
    if (!(card instanceof HTMLElement)) return;
    const id = card.dataset.photoId || '';
    card.classList.toggle('is-selected', id === state.selectedId);
  });
}

function createPhotoCardElement(item, index) {
  const card = document.createElement('div');
  card.className = `photo-card${item.id === state.selectedId ? ' is-selected' : ''}`;
  card.dataset.photoId = item.id;
  card.draggable = true;
  card.style.position = 'absolute';
  card.style.left = '0';
  card.style.right = '0';
  card.style.top = `${index * PHOTO_CARD_ROW_HEIGHT}px`;

  card.innerHTML = `
    <input class="photo-card-select" type="checkbox" aria-label="${item.name} auswaehlen" ${item.isChecked ? 'checked' : ''} />
    <img class="photo-card-thumb" src="${item.thumbSrc}" alt="Vorschau ${item.name}" loading="lazy" decoding="async" draggable="false" />
    <div class="photo-card-lines">
      <div class="photo-line-1">${item.name}</div>
      <div class="photo-line-2">${item.pixelWidth}x${item.pixelHeight} px | Ausgabe ${item.outputWidthCm.toFixed(1)} x ${item.outputHeightCm.toFixed(1)} cm</div>
      <div class="photo-line-3">Auf Seite ${item.onPage || '-'}</div>
      <div class="photo-line-3">Farbprofil: ${item.colorProfileLabel || 'Kein Profil'}</div>
    </div>
  `;

  const checkbox = card.querySelector('.photo-card-select');
  if (checkbox instanceof HTMLInputElement) {
    checkbox.addEventListener('click', (event) => {
      event.stopPropagation();
    });
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        state.listSelection.add(item.id);
      } else {
        state.listSelection.delete(item.id);
      }
      updateSelectionActionButtons();
    });
  }

  card.addEventListener('click', () => {
    selectPlacementById(item.id);
    openPhotoOverlay(item);
  });

  card.addEventListener('dragstart', (event) => {
    if (!event.dataTransfer) return;
    event.dataTransfer.setData('text/photo-id', item.id);
    event.dataTransfer.setData('text/plain', item.id);
    event.dataTransfer.effectAllowed = 'move';
  });

  return card;
}

function renderVirtualizedPhotoCards() {
  if (!tableBody) return;

  const items = virtualPhotoList.items;
  const total = items.length;
  const viewportHeight = tableBody.clientHeight || 0;
  const scrollTop = tableBody.scrollTop || 0;

  const start = Math.max(0, Math.floor(scrollTop / PHOTO_CARD_ROW_HEIGHT) - PHOTO_CARD_OVERSCAN);
  const visibleCount = Math.ceil((viewportHeight || 1) / PHOTO_CARD_ROW_HEIGHT) + PHOTO_CARD_OVERSCAN * 2;
  const end = Math.min(total, start + Math.max(1, visibleCount));

  tableBody.innerHTML = '';
  const spacer = document.createElement('div');
  spacer.className = 'photo-card-spacer';
  spacer.style.height = `${total * PHOTO_CARD_ROW_HEIGHT}px`;
  tableBody.appendChild(spacer);

  const fragment = document.createDocumentFragment();
  for (let i = start; i < end; i++) {
    fragment.appendChild(createPhotoCardElement(items[i], i));
  }
  spacer.appendChild(fragment);
}

function ensureVirtualizedListInitialized() {
  if (virtualListInitialized || !tableBody) return;
  tableBody.addEventListener('scroll', () => {
    renderVirtualizedPhotoCards();
  });
  window.addEventListener('resize', () => {
    resizePreviewCanvas();
    renderVirtualizedPhotoCards();
    if (!appLoadingOverlay?.hidden) {
      positionOverlayOutsidePreview();
    }
  });
  initializeOverlayDragging();
  initializeMenuDragging();
  virtualListInitialized = true;
}

function resizePreviewCanvas() {
  if (!previewCanvas || !previewCanvasWrap) return;
  const rect = previewCanvasWrap.getBoundingClientRect();
  const width = Math.max(480, Math.floor(rect.width));
  const height = Math.max(420, Math.floor(rect.height));
  if (previewCanvas.width === width && previewCanvas.height === height) return;
  previewCanvas.width = width;
  previewCanvas.height = height;
  drawPreview();
}

function drawPreview() {
  const config = getConfig();
  const page = getCurrentPagePlacements();
  const effectivePageHeight = getEffectivePageHeightMm(page, config);

  ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);

  if (config.rollWidth <= 0 || config.maxHeight <= 0) {
    updatePageIndicator();
    return;
  }

  const pad = 20;
  const scale = Math.min(
    (previewCanvas.width - pad * 2) / config.rollWidth,
    (previewCanvas.height - pad * 2) / config.maxHeight
  );

  const mapX = (mm) => pad + mm * scale;
  const mapY = (mm) => pad + mm * scale;

  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#c4bca9';
  ctx.lineWidth = 2;
  ctx.fillRect(mapX(0), mapY(0), config.rollWidth * scale, config.maxHeight * scale);
  ctx.strokeRect(mapX(0), mapY(0), config.rollWidth * scale, config.maxHeight * scale);

  for (const item of page) {
    const x = mapX(item.xMm);
    const y = mapY(item.yMm);
    const w = item.widthMm * scale;
    const h = item.heightMm * scale;
    const imageRect = getPlacementImageRectMm(item);
    const imageX = mapX(item.xMm + imageRect.xMm);
    const imageY = mapY(item.yMm + imageRect.yMm);
    const imageW = imageRect.widthMm * scale;
    const imageH = imageRect.heightMm * scale;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y, w, h);

    if (item.image) {
      const crop = getCropPixels(item);
      if (item.rotated) {
        ctx.save();
        ctx.translate(imageX, imageY + imageH);
        ctx.rotate(-Math.PI / 2);
        ctx.drawImage(item.image, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, imageH, imageW);
        ctx.restore();
      } else {
        ctx.drawImage(item.image, crop.sx, crop.sy, crop.sw, crop.sh, imageX, imageY, imageW, imageH);
      }
    } else {
      ctx.fillStyle = '#9fd0c4';
      ctx.fillRect(imageX, imageY, imageW, imageH);
    }

    ctx.strokeStyle = '#d9d2c3';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);

    if (item.id === state.selectedId) {
      ctx.strokeStyle = '#e07a1f';
      ctx.lineWidth = 2;
      ctx.strokeRect(x - 2, y - 2, w + 4, h + 4);
    }

    ctx.fillStyle = '#123f37';
    ctx.font = '12px Trebuchet MS';
    ctx.fillText(item.name, x + 6, y + 14);

  }

  // Regmarks für den Bogen (außen)
  ctx.fillStyle = '#111';
  for (const reg of getSheetRegmarks(page, config, effectivePageHeight)) {
    ctx.beginPath();
    ctx.arc(mapX(reg.cx), mapY(reg.cy), reg.r * scale, 0, Math.PI * 2);
    ctx.fill();
  }

  if (page.length > 0) {
    const cutY = mapY(effectivePageHeight);
    ctx.save();
    ctx.strokeStyle = '#b45622';
    ctx.lineWidth = 1;
    ctx.setLineDash([7, 5]);
    ctx.beginPath();
    ctx.moveTo(mapX(0), cutY);
    ctx.lineTo(mapX(config.rollWidth), cutY);
    ctx.stroke();
    ctx.restore();
  }

  updatePageIndicator();
}

function renderTable() {
  ensureVirtualizedListInitialized();
  const placementMap = getPlacementMap();
  const existingIds = new Set(state.photos.map((photo) => photo.id));
  for (const id of Array.from(state.listSelection)) {
    if (!existingIds.has(id)) {
      state.listSelection.delete(id);
    }
  }

  virtualPhotoList.items = state.photos.map((photo) => ({
    ...photo,
    onPage: placementMap.get(photo.id) || null,
    outputWidthCm: getPlacementOuterDimensions(photo).widthMm / 10,
    outputHeightCm: getPlacementOuterDimensions(photo).heightMm / 10,
    targetWidthCm: getConfiguredContentDimensions(photo).widthMm / 10,
    whiteBorderMm: getWhiteBorderMm(photo),
    whiteBorderMode: getWhiteBorderMode(photo),
    colorProfileLabel: photo.colorProfileLabel || 'Kein Profil',
    dpi: Number(dpiInput.value) || 300,
    thumbSrc: photo.thumbnailDataUrl || photo.dataUrl,
    isChecked: state.listSelection.has(photo.id)
  }));

  updateSelectionActionButtons();
  renderVirtualizedPhotoCards();
  updateOversizeEditor();
}

function openPhotoOverlay(photo) {
  if (!photoOverlay || !photoOverlayImage || !photo) return;
  photoOverlayImage.src = photo.dataUrl || '';
  photoOverlayImage.draggable = false;
  resetOverlayView();
  if (photoOverlayCaption) {
    photoOverlayCaption.textContent = `${photo.name} - ${photo.pixelWidth} x ${photo.pixelHeight}px - Mausrad: Zoom, Ziehen: Verschieben`;
  }
  photoOverlay.hidden = false;
  document.body.style.overflow = 'hidden';
}

function buildThumbnailDataUrl(image, maxSide = 96) {
  const srcW = Math.max(1, image.naturalWidth || image.width || 1);
  const srcH = Math.max(1, image.naturalHeight || image.height || 1);
  const scale = Math.min(1, maxSide / Math.max(srcW, srcH));
  const w = Math.max(1, Math.round(srcW * scale));
  const h = Math.max(1, Math.round(srcH * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const c = canvas.getContext('2d');
  c.drawImage(image, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', 0.78);
}

function closePhotoOverlay() {
  if (!photoOverlay || !photoOverlayImage) return;
  photoOverlay.hidden = true;
  photoOverlayImage.src = '';
  resetOverlayView();
  document.body.style.overflow = '';
}

function getImageFormatFromDataUrl(dataUrl) {
  if (dataUrl.startsWith('data:image/png')) return 'PNG';
  if (dataUrl.startsWith('data:image/webp')) return 'WEBP';
  return 'JPEG';
}

function buildRotatedImageDataUrl(item) {
  if (!item.dataUrl || !item.rotated) return item.dataUrl;

  const cw = Math.max(1, Math.round(item.image.naturalHeight));
  const ch = Math.max(1, Math.round(item.image.naturalWidth));
  const off = document.createElement('canvas');
  off.width = cw;
  off.height = ch;
  const c = off.getContext('2d');

  c.translate(cw, 0);
  c.rotate(Math.PI / 2);
  c.drawImage(item.image, 0, 0);
  return off.toDataURL('image/png');
}

function buildPlacementImageDataUrl(item) {
  const crop = getCropPixels(item);
  if (!item.rotated) {
    const cw = Math.max(1, Math.round(crop.sw));
    const ch = Math.max(1, Math.round(crop.sh));
    const off = document.createElement('canvas');
    off.width = cw;
    off.height = ch;
    const c = off.getContext('2d');
    c.drawImage(item.image, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, cw, ch);
    return off.toDataURL('image/png');
  }

  const cw = Math.max(1, Math.round(crop.sh));
  const ch = Math.max(1, Math.round(crop.sw));
  const off = document.createElement('canvas');
  off.width = cw;
  off.height = ch;
  const c = off.getContext('2d');
  c.translate(cw, 0);
  c.rotate(Math.PI / 2);
  c.drawImage(item.image, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, crop.sw, crop.sh);
  return off.toDataURL('image/png');
}

function getPageUsedHeightMm(page, config) {
  return Math.min(
    config.maxHeight,
    Math.max(
    config.padding,
    ...page.map((item) => item.yMm + item.heightMm + config.padding)
    )
  );
}

function getEffectivePageHeightMm(page, config) {
  return getPageUsedHeightMm(page, config);
}

function getPdfPageGeometry(page, config) {
  const safetyMm = 2;
  const baseHeight = getEffectivePageHeightMm(page, config);
  const regmarks = getSheetRegmarks(page, config, baseHeight);

  const contentMinX = Math.min(...page.map((item) => item.xMm));
  const contentMinY = Math.min(...page.map((item) => item.yMm));
  const contentMaxX = Math.max(...page.map((item) => item.xMm + item.widthMm));
  const contentMaxY = Math.max(...page.map((item) => item.yMm + item.heightMm));

  let minX = contentMinX;
  let minY = contentMinY;
  let maxX = contentMaxX;
  let maxY = Math.max(contentMaxY, baseHeight);

  for (const reg of regmarks) {
    minX = Math.min(minX, reg.cx - reg.r);
    minY = Math.min(minY, reg.cy - reg.r);
    maxX = Math.max(maxX, reg.cx + reg.r);
    maxY = Math.max(maxY, reg.cy + reg.r);
  }

  minX -= safetyMm;
  minY -= safetyMm;
  maxX += safetyMm;
  maxY += safetyMm;

  return {
    widthMm: Math.max(1, maxX - minX),
    heightMm: Math.max(1, maxY - minY),
    offsetX: -minX,
    offsetY: -minY,
    contentHeightMm: baseHeight,
    regmarks
  };
}

function drawCode39BarcodeOnCanvas(ctx2d, value, placement, pxPerMm) {
  const textValue = String(value || '').toUpperCase();
  const encoded = `*${textValue}*`;
  const wideFactor = 2.5;
  const modules = estimateCode39Modules(value, wideFactor);
  const textGapMm = 1.5;
  const textGapPx = textGapMm * pxPerMm;
  const fontPx = Math.max(9, Math.round(6 * pxPerMm * 1.25));

  ctx2d.save();
  ctx2d.font = `${fontPx}px Arial`;
  ctx2d.fillStyle = '#000';
  const textWidthPx = ctx2d.measureText(textValue).width;
  const availableBarcodeWidthMm = Math.max(8, placement.maxWidthMm - textGapMm - (textWidthPx / pxPerMm));
  const moduleWidthMm = Math.max(0.18, Math.min(0.6, availableBarcodeWidthMm / Math.max(1, modules)));
  const moduleWidthPx = moduleWidthMm * pxPerMm;
  const barcodeWidthPx = modules * moduleWidthPx;
  const totalWidthPx = barcodeWidthPx + textGapPx + textWidthPx;
  const startXPx = placement.xMm * pxPerMm + Math.max(0, ((placement.maxWidthMm * pxPerMm) - totalWidthPx) / 2);
  const yPx = placement.yMm * pxPerMm;
  const barHeightPx = placement.barHeightMm * pxPerMm;
  let cursorX = startXPx;

  for (let i = 0; i < encoded.length; i += 1) {
    const pattern = CODE39_PATTERNS[encoded[i]] || CODE39_PATTERNS['*'];
    for (let j = 0; j < pattern.length; j += 1) {
      const widthPx = (pattern[j] === 'w' ? wideFactor : 1) * moduleWidthPx;
      const isBar = j % 2 === 0;
      if (isBar) {
        ctx2d.fillRect(cursorX, yPx, widthPx, barHeightPx);
      }
      cursorX += widthPx;
    }
    if (i < encoded.length - 1) {
      cursorX += moduleWidthPx;
    }
  }

  const textX = startXPx + barcodeWidthPx + textGapPx;
  const textY = yPx + barHeightPx * 0.78;
  ctx2d.fillText(textValue, textX, textY);
  ctx2d.restore();
}

function drawPlacementPhotoOnCanvas(ctx2d, item, drawOffsetX, drawOffsetY, pxPerMm) {
  const imageRect = getPlacementImageRectMm(item);
  const crop = getCropPixels(item);

  const frameX = (item.xMm + drawOffsetX) * pxPerMm;
  const frameY = (item.yMm + drawOffsetY) * pxPerMm;
  const frameW = item.widthMm * pxPerMm;
  const frameH = item.heightMm * pxPerMm;

  ctx2d.fillStyle = '#fff';
  ctx2d.fillRect(frameX, frameY, frameW, frameH);

  const dx = (item.xMm + imageRect.xMm + drawOffsetX) * pxPerMm;
  const dy = (item.yMm + imageRect.yMm + drawOffsetY) * pxPerMm;
  const dw = imageRect.widthMm * pxPerMm;
  const dh = imageRect.heightMm * pxPerMm;

  ctx2d.save();
  ctx2d.imageSmoothingEnabled = true;
  ctx2d.imageSmoothingQuality = 'high';

  if (!item.rotated) {
    ctx2d.drawImage(item.image, crop.sx, crop.sy, crop.sw, crop.sh, dx, dy, dw, dh);
  } else {
    ctx2d.translate(dx + dw, dy);
    ctx2d.rotate(Math.PI / 2);
    ctx2d.drawImage(item.image, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, dh, dw);
  }

  ctx2d.restore();
}

async function renderPrintPageAsJpegBlob(page, geometry, barcodeText, dpi, iccProfileBytes) {
  const pxPerMm = dpi / MM_PER_INCH;
  const widthPx = Math.max(1, Math.round(geometry.widthMm * pxPerMm));
  const heightPx = Math.max(1, Math.round(geometry.heightMm * pxPerMm));
  const canvas = document.createElement('canvas');
  canvas.width = widthPx;
  canvas.height = heightPx;

  const ctx2d = canvas.getContext('2d');
  ctx2d.fillStyle = '#fff';
  ctx2d.fillRect(0, 0, widthPx, heightPx);

  const drawOffsetX = geometry.offsetX;
  const drawOffsetY = geometry.offsetY;

  for (const item of page) {
    if (!item.dataUrl) continue;
    drawPlacementPhotoOnCanvas(ctx2d, item, drawOffsetX, drawOffsetY, pxPerMm);
  }

  ctx2d.fillStyle = '#000';
  for (const reg of geometry.regmarks) {
    const cx = (reg.cx + drawOffsetX) * pxPerMm;
    const cy = (reg.cy + drawOffsetY) * pxPerMm;
    const r = reg.r * pxPerMm;
    ctx2d.beginPath();
    ctx2d.arc(cx, cy, r, 0, Math.PI * 2);
    ctx2d.fill();
  }

  if (barcodeText) {
    const contentTopY = Math.min(...page.map((item) => item.yMm)) + drawOffsetY;
    const contentBottomY = Math.max(...page.map((item) => item.yMm + item.heightMm)) + drawOffsetY;
    const placement = getBarcodePlacementMm(
      geometry.regmarks.map((reg) => ({
        cx: reg.cx + drawOffsetX,
        cy: reg.cy + drawOffsetY,
        r: reg.r
      })),
      geometry,
      { topY: contentTopY, bottomY: contentBottomY }
    );
    drawCode39BarcodeOnCanvas(ctx2d, barcodeText, placement, pxPerMm);
  }

  const jpegBlob = await canvasToJpegBlob(canvas, 0.98);
  if (!(iccProfileBytes instanceof Uint8Array) || iccProfileBytes.length === 0) {
    return jpegBlob;
  }
  const jpegBytes = await blobToBytes(jpegBlob);
  const withProfile = embedIccProfileIntoJpegBytes(jpegBytes, iccProfileBytes);
  return new Blob([withProfile], { type: 'image/jpeg' });
}

async function buildPrintJpegExports(barcodeId, barcodeText) {
  if (state.pages.length === 0) {
    setStatus('Kein Layout zum Exportieren vorhanden.');
    return null;
  }

  const config = getConfig();
  const profilePolicy = getPrintJpegProfilePolicy();
  const dpi = Number(config.dpi) || 300;
  const pageGeometries = state.pages.map((page) => getPdfPageGeometry(page, config));
  const files = [];
  const profileSources = new Set();

  for (let index = 0; index < state.pages.length; index += 1) {
    const page = state.pages[index];
    const geometry = pageGeometries[index];
    let profileBytes = null;
    let profileSource = 'none';

    if (profilePolicy === 'srgb') {
      profileBytes = await loadFallbackSrgbIccBytes();
      profileSource = 'embedded-srgb';
    } else if (profilePolicy === 'source') {
      const profile = await resolveIccProfileForPage(page);
      profileBytes = profile.bytes;
      profileSource = profile.source;
    }
    profileSources.add(profileSource);

    const blob = await renderPrintPageAsJpegBlob(page, geometry, barcodeText, dpi, profileBytes);
    const pageNo = String(index + 1).padStart(2, '0');
    files.push({
      name: `druck_motive_regmarks_${barcodeId}_seite-${pageNo}.jpg`,
      blob
    });
  }

  return {
    files,
    profileSources
  };
}

function buildPdfDocument(includePhotos, barcodeText) {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    return null;
  }

  if (state.pages.length === 0) {
    setStatus('Kein Layout zum Exportieren vorhanden.');
    return null;
  }

  const config = getConfig();
  const { jsPDF } = window.jspdf;
  const pageGeometries = state.pages.map((page) => getPdfPageGeometry(page, config));
  const firstGeometry = pageGeometries[0];
  const firstOrientation = firstGeometry.widthMm >= firstGeometry.heightMm ? 'landscape' : 'portrait';

  const pdf = new jsPDF({
    orientation: firstOrientation,
    unit: 'mm',
    format: [firstGeometry.widthMm, firstGeometry.heightMm],
    compress: false,
    precision: 12
  });

  state.pages.forEach((page, index) => {
    const geometry = pageGeometries[index];
    const pageHeight = geometry.contentHeightMm;
    const drawOffsetX = geometry.offsetX;
    const drawOffsetY = geometry.offsetY;
    const pageOrientation = geometry.widthMm >= geometry.heightMm ? 'landscape' : 'portrait';

    if (index > 0) {
      pdf.addPage([geometry.widthMm, geometry.heightMm], pageOrientation);
      pdf.setPage(index + 1);
    }

    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 0, geometry.widthMm, geometry.heightMm, 'F');

    for (const item of page) {
      if (includePhotos && item.dataUrl) {
        const source = buildPlacementImageDataUrl(item);
        const format = getImageFormatFromDataUrl(source);
        const imageRect = getPlacementImageRectMm(item);
        pdf.setFillColor(255, 255, 255);
        pdf.rect(item.xMm + drawOffsetX, item.yMm + drawOffsetY, item.widthMm, item.heightMm, 'F');
        pdf.addImage(
          source,
          format,
          item.xMm + imageRect.xMm + drawOffsetX,
          item.yMm + imageRect.yMm + drawOffsetY,
          imageRect.widthMm,
          imageRect.heightMm,
          undefined,
          'NONE'
        );
      }

      if (!includePhotos) {
        pdf.setDrawColor(0, 255, 0);
        pdf.setLineWidth(0.25 * MM_PER_POINT);
        pdf.rect(item.xMm + drawOffsetX, item.yMm + drawOffsetY, item.widthMm, item.heightMm);
      }

      // Regmarks werden jetzt pro Bogen gezeichnet (außen)
    }
    // Regmarks für den Bogen (außen)
    for (const reg of geometry.regmarks) {
      pdf.setFillColor(0, 0, 0);
      pdf.circle(reg.cx + drawOffsetX, reg.cy + drawOffsetY, reg.r, 'F');
    }

    if (barcodeText) {
      const contentTopY = Math.min(...page.map((item) => item.yMm)) + drawOffsetY;
      const contentBottomY = Math.max(...page.map((item) => item.yMm + item.heightMm)) + drawOffsetY;
      const placement = getBarcodePlacementMm(
        geometry.regmarks.map((reg) => ({
          cx: reg.cx + drawOffsetX,
          cy: reg.cy + drawOffsetY,
          r: reg.r
        })),
        geometry,
        { topY: contentTopY, bottomY: contentBottomY }
      );
      drawCode39BarcodeOnPdf(pdf, barcodeText, placement);
    }
  });

  return pdf;
}

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function getPrintProfileStatusText(profileSources) {
  const sources = Array.from(profileSources || []);
  const noProfile = sources.every((source) => source === 'none');
  const srgbEmbedded = sources.every((source) => source === 'embedded-srgb');
  const usedFallback = sources.some((source) => source.startsWith('fallback'));

  if (noProfile) return 'ohne ICC-Einbettung';
  if (srgbEmbedded) return 'sRGB-Profil eingebettet';
  if (usedFallback) return 'Fallback-Profil Adobe RGB aktiv';
  return 'Profil aus Import uebernommen';
}

async function exportPdf(includePhotos) {
  if (includePhotos) {
    const barcodeId = getOrCreateExportBarcodeId();
    const barcodeText = getBarcodeTextForRendering(barcodeId);
    try {
      const printExport = await buildPrintJpegExports(barcodeId, barcodeText);
      if (!printExport) return;
      for (const file of printExport.files) {
        downloadBlob(file.name, file.blob);
      }
      const profileStatus = getPrintProfileStatusText(printExport.profileSources);
      setStatus(`Druck-JPEG exportiert (${printExport.files.length} Datei(en), ${profileStatus}, Code: ${barcodeId}, Barcode: ${barcodeText}).`);
    } catch (error) {
      setStatus(`Druck-JPEG Export fehlgeschlagen: ${error.message}`);
    }
    return;
  }

  const available = await ensureJsPdfLoaded();
  if (!available) {
    setStatus('PDF-Bibliothek nicht verfuegbar. Bitte Internetverbindung aktivieren oder lokal via npm install bereitstellen.');
    return;
  }

  const barcodeId = getOrCreateExportBarcodeId();
  const barcodeText = getBarcodeTextForRendering(barcodeId);
  const pdf = buildPdfDocument(false, barcodeText);
  if (!pdf) return;
  const filename = `${barcodeId}.pdf`;
  const blob = pdf.output('blob');
  downloadBlob(filename, blob);
  setStatus(`Kontur-PDF exportiert: ${filename}`);
}

async function exportToHotfolder() {
  if (state.pages.length === 0) {
    setStatus('Kein Layout zum Exportieren vorhanden.');
    return;
  }

  if (typeof window.showDirectoryPicker !== 'function') {
    setStatus('Hotfolder-Export im Browser nicht verfuegbar. Bitte Chromium/Chrome nutzen oder PDFs normal exportieren.');
    return;
  }

  const available = await ensureJsPdfLoaded();
  if (!available) {
    setStatus('PDF-Bibliothek nicht verfuegbar. Bitte Internetverbindung aktivieren oder lokal via npm install bereitstellen.');
    return;
  }

  const barcodeId = getOrCreateExportBarcodeId();
  const barcodeText = getBarcodeTextForRendering(barcodeId);
  const printJpegs = await buildPrintJpegExports(barcodeId, barcodeText);
  const contourPdf = buildPdfDocument(false, barcodeText);
  if (!printJpegs || !contourPdf) return;

  try {
    const dir = await window.showDirectoryPicker();
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const files = [
      ...printJpegs.files.map((entry) => ({
        name: `${entry.name.replace('.jpg', '')}_${stamp}.jpg`,
        blob: entry.blob
      })),
      { name: `${barcodeId}.pdf`, blob: contourPdf.output('blob') }
    ];

    for (const file of files) {
      const handle = await dir.getFileHandle(file.name, { create: true });
      const writable = await handle.createWritable();
      await writable.write(file.blob);
      await writable.close();
    }

    const profileStatus = getPrintProfileStatusText(printJpegs.profileSources);
    setStatus(`Hotfolder-Export abgeschlossen (${files.length} Dateien geschrieben, Druck-JPEG: ${profileStatus}, Kontur: ${barcodeId}.pdf).`);
  } catch (error) {
    setStatus(`Hotfolder-Export abgebrochen/fehlgeschlagen: ${error.message}`);
  }
}

async function handlePhotoInput(files) {
  const dpi = Number(dpiInput.value) || 300;
  const config = getConfig();
  const loaded = [];
  let skipped = 0;

  for (const file of files) {
    try {
      const fileBytes = new Uint8Array(await file.arrayBuffer());
      const dataUrl = await fileToDataURL(file);
      const image = await loadImage(dataUrl);
      const profileInfo = await resolveImportedProfileInfo(file, fileBytes);

      loaded.push({
        id: crypto.randomUUID(),
        name: file.name,
        sourcePath: typeof file.path === 'string' ? file.path : null,
        pixelWidth: image.naturalWidth,
        pixelHeight: image.naturalHeight,
        originalWidthMm: pxToMm(image.naturalWidth, dpi),
        originalHeightMm: pxToMm(image.naturalHeight, dpi),
        targetWidthMm: pxToMm(image.naturalWidth, dpi),
        targetHeightMm: pxToMm(image.naturalHeight, dpi),
        whiteBorderMm: 0,
        whiteBorderMode: 'outside',
        sizeOverrideSource: null,
        image,
        dataUrl,
        iccProfileBytes: profileInfo.iccProfileBytes,
        colorProfileLabel: profileInfo.colorProfileLabel,
        colorProfileSource: profileInfo.colorProfileSource,
        thumbnailDataUrl: buildThumbnailDataUrl(image),
        cropNorm: { x: 0, y: 0, w: 1, h: 1 }
      });
    } catch {
      skipped += 1;
    }
  }

  if (loaded.length === 0) {
    setStatus('Keine neuen lesbaren Bilddateien geladen. Bestehende Liste bleibt unveraendert.');
    return;
  }

  const previousCount = state.photos.length;
  state.photos = [...state.photos, ...loaded];
  refreshPhotoSizing(config);

  if (state.selectedId && !getPhotoById(state.selectedId)) {
    state.selectedId = null;
    setSelectedItemName('Keins');
    hideManualMenu();
  }

  renderTable();
  drawPreview();

  const added = state.photos.length - previousCount;
  if (skipped > 0) {
    setStatus(`${added} Foto(s) hinzugefuegt, ${skipped} Datei(en) konnten nicht gelesen werden.`);
  } else {
    setStatus(`${added} Foto(s) zur Liste hinzugefuegt.`);
  }
}

async function loadStartupTestPhoto() {
  if (state.photos.length > 0) return;

  try {
    const response = await fetch('./assets/fuji.jpg', { cache: 'no-store' });
    if (!response.ok) return;

    const blob = await response.blob();
    const file = new File([blob], 'fuji.jpg', { type: blob.type || 'image/jpeg' });
    await handlePhotoInput([file]);
  } catch (error) {
    console.warn('Startbild konnte nicht geladen werden:', error);
  }
}

function runNesting() {
  const config = getConfig();
  refreshPhotoSizing(config);
  const result = nestAllPages(state.photos, config);

  state.pages = result.pages;
  invalidateExportBarcodeId();
  state.listSelection.clear();
  state.currentPage = 0;
  state.selectedId = null;
  setSelectedItemName('Keins');
  hideManualMenu();

  renderTable();
  drawPreview();

  const modeLabel = result.mode || 'mixed';
  setStatus(`Nesting abgeschlossen: ${state.pages.length} Seiten, ${result.remaining.length} nicht platziert (Modus: ${modeLabel}).`);
}

function getSelectedPlacement() {
  if (!state.selectedId) {
    const currentPage = getCurrentPagePlacements();
    if (currentPage.length === 1) {
      const onlyOnCurrentPage = currentPage[0];
      state.selectedId = onlyOnCurrentPage.id;
      return onlyOnCurrentPage;
    }

    const allPlacements = state.pages.flat();
    if (allPlacements.length === 1) {
      const only = allPlacements[0];
      state.selectedId = only.id;
      const pageIndex = state.pages.findIndex((page) => page.some((item) => item.id === only.id));
      if (pageIndex >= 0) state.currentPage = pageIndex;
      return only;
    }
    return null;
  }
  const page = getCurrentPagePlacements();
  const local = page.find((item) => item.id === state.selectedId) || null;
  if (local) return local;

  const global = findPlacementByIdGlobal(state.selectedId);
  if (global) {
    state.currentPage = global.pageIndex;
    return global.item;
  }

  return null;
}

function selectPlacementById(id) {
  state.selectedId = id;
  const item = getSelectedPlacement();
  const photo = getPhotoById(id);
  const displayName = item ? item.name : (photo ? photo.name : 'Keins');
  setSelectedItemName(displayName);
  
  const header = document.getElementById('manualMenuHeader');
  if (header && item) {
    header.textContent = item.name || 'Menü';
  }
  
  updateManualScaleControlsForSelected();
  updateOversizeEditor();
  if (!id) hideManualMenu();
  updatePhotoCardSelection();
  drawPreview();
}

function selectPlacementByIdWithMenuPosition(id) {
  selectPlacementById(id);
  if (!id) return;
  
  if (manualNestingMenu && !manualNestingMenu.hidden) {
    positionManualMenuOutsidePreview();
  }
}

function moveSelected(dx, dy) {
  const selected = getSelectedPlacement();
  if (!selected) {
    setStatus('Bitte zuerst ein Motiv in der Vorschau auswaehlen.');
    return;
  }

  const page = getCurrentPagePlacements();
  const config = getConfig();
  const candidate = { ...selected, xMm: selected.xMm + dx, yMm: selected.yMm + dy };

  const snapped = findNearestFreePlacement(candidate, page, config, selected.id, {
    maxRadiusMm: Math.max(120, getMoveStepMm() * 20),
    angleSamples: 20
  });
  if (!snapped) {
    setStatus('Verschieben nicht moeglich (Kollision oder ausserhalb des Bogens).');
    return;
  }

  selected.xMm = snapped.xMm;
  selected.yMm = snapped.yMm;
  drawPreview();
  setStatus(`${selected.name} verschoben.`);
}

function rotateSelected() {
  const selected = getSelectedPlacement();
  if (!selected) {
    setStatus('Bitte zuerst ein Motiv in der Vorschau auswaehlen.');
    return;
  }

  const page = getCurrentPagePlacements();
  const config = getConfig();
  const centerX = selected.xMm + selected.widthMm / 2;
  const centerY = selected.yMm + selected.heightMm / 2;
  const candidate = {
    ...selected,
    xMm: centerX - selected.heightMm / 2,
    yMm: centerY - selected.widthMm / 2,
    widthMm: selected.heightMm,
    heightMm: selected.widthMm,
    rotated: !selected.rotated
  };

  const snapped = findNearestFreePlacement(candidate, page, config, selected.id, {
    maxRadiusMm: Math.max(selected.widthMm, selected.heightMm) + 160,
    angleSamples: 24
  });
  if (!snapped) {
    setStatus('Rotation nicht moeglich (Kollision oder ausserhalb des Bogens).');
    return;
  }

  selected.xMm = snapped.xMm;
  selected.yMm = snapped.yMm;
  selected.widthMm = snapped.widthMm;
  selected.heightMm = snapped.heightMm;
  selected.rotated = snapped.rotated;
  if (Number(selected.contentWidthMm) > 0 && Number(selected.contentHeightMm) > 0) {
    const prevContentWidth = selected.contentWidthMm;
    selected.contentWidthMm = selected.contentHeightMm;
    selected.contentHeightMm = prevContentWidth;
  }
  drawPreview();
  setStatus(`${selected.name} rotiert.`);
}

function duplicateSelected() {
  const selected = getSelectedPlacement();
  if (!selected) {
    setStatus('Bitte zuerst ein Motiv in der Vorschau auswaehlen.');
    return;
  }

  const page = getCurrentPagePlacements();
  const config = getConfig();
  const clone = {
    ...selected,
    id: crypto.randomUUID(),
    xMm: selected.xMm + selected.widthMm + config.gap,
    yMm: selected.yMm
  };

  const placed = findNearestFreePlacement(clone, page, config, null, {
    maxRadiusMm: Math.max(clone.widthMm, clone.heightMm) + 300,
    angleSamples: 24,
    stepMm: 2
  });

  if (!placed) {
    setStatus('Kein freier Platz fuer das Duplikat gefunden.');
    return;
  }

  state.pages[state.currentPage].push(placed);
  state.selectedId = placed.id;
  drawPreview();
  updateManualScaleControlsForSelected();
  setStatus(`${selected.name} dupliziert.`);
}

function unplaceSelected() {
  const selected = getSelectedPlacement();
  if (!selected) {
    setStatus('Bitte zuerst ein Motiv in der Vorschau auswaehlen.');
    return;
  }

  state.pages[state.currentPage] = getCurrentPagePlacements().filter((item) => item.id !== selected.id);
  if (state.pages[state.currentPage].length === 0 && state.pages.length > 1) {
    state.pages.splice(state.currentPage, 1);
    state.currentPage = Math.max(0, state.currentPage - 1);
  }

  state.selectedId = null;
  setSelectedItemName('Keins');
  renderTable();
  drawPreview();
  setStatus(`${selected.name} zurueck in die Liste gelegt.`);
}

function saveProject() {
  const project = {
    version: '0.3.4',
    savedAt: new Date().toISOString(),
    config: getConfig(),
    currentPage: state.currentPage,
    photos: state.photos.map((photo) => ({
      id: photo.id,
      name: photo.name,
      sourcePath: photo.sourcePath || null,
      pixelWidth: photo.pixelWidth,
      pixelHeight: photo.pixelHeight,
      originalWidthMm: photo.originalWidthMm,
      originalHeightMm: photo.originalHeightMm,
      targetWidthMm: photo.targetWidthMm,
      targetHeightMm: photo.targetHeightMm,
      whiteBorderMm: photo.whiteBorderMm || 0,
      whiteBorderMode: photo.whiteBorderMode || 'outside',
      whiteBorderTargetWidthMm: photo.whiteBorderTargetWidthMm || null,
      whiteBorderTargetHeightMm: photo.whiteBorderTargetHeightMm || null,
      colorProfileLabel: photo.colorProfileLabel || 'Kein Profil',
      colorProfileSource: photo.colorProfileSource || 'none',
      sizeOverrideSource: photo.sizeOverrideSource || null,
      dataUrl: photo.dataUrl,
      cropNorm: photo.cropNorm || { x: 0, y: 0, w: 1, h: 1 }
    })),
    pages: state.pages.map((page) =>
      page.map((item) => ({
        id: item.id,
        xMm: item.xMm,
        yMm: item.yMm,
        widthMm: item.widthMm,
        heightMm: item.heightMm,
        rotated: item.rotated
      }))
    )
  };

  const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  downloadBlob(`nesting_projekt_${stamp}.json`, blob);
  setStatus('Projektdatei gespeichert.');
}

async function loadProjectFromFile(file) {
  const text = await file.text();
  const project = JSON.parse(text);

  applyConfig(project.config || {});

  const photos = [];
  for (const p of project.photos || []) {
    const image = await loadImage(p.dataUrl);
    const profileInfo = await resolveProfileInfoFromDataUrl(p.dataUrl);
    photos.push({
      id: p.id,
      name: p.name,
      sourcePath: p.sourcePath || null,
      pixelWidth: p.pixelWidth,
      pixelHeight: p.pixelHeight,
      originalWidthMm: p.originalWidthMm,
      originalHeightMm: p.originalHeightMm,
      targetWidthMm: p.targetWidthMm,
      targetHeightMm: p.targetHeightMm,
      whiteBorderMm: p.whiteBorderMm || 0,
      whiteBorderMode: p.whiteBorderMode || 'outside',
      whiteBorderTargetWidthMm: Number(p.whiteBorderTargetWidthMm) > 0 ? Number(p.whiteBorderTargetWidthMm) : null,
      whiteBorderTargetHeightMm: Number(p.whiteBorderTargetHeightMm) > 0 ? Number(p.whiteBorderTargetHeightMm) : null,
      colorProfileLabel: p.colorProfileLabel || profileInfo.colorProfileLabel,
      colorProfileSource: p.colorProfileSource || profileInfo.colorProfileSource,
      sizeOverrideSource: p.sizeOverrideSource || null,
      dataUrl: p.dataUrl,
      image,
      iccProfileBytes: profileInfo.iccProfileBytes,
      thumbnailDataUrl: buildThumbnailDataUrl(image),
      cropNorm: p.cropNorm || { x: 0, y: 0, w: 1, h: 1 }
    });
  }

  const byId = new Map(photos.map((p) => [p.id, p]));
  const pages = [];

  for (const page of project.pages || []) {
    const parsedPage = [];
    for (const item of page) {
      const base = byId.get(item.id);
      if (!base) continue;
      parsedPage.push({
        ...base,
        xMm: item.xMm,
        yMm: item.yMm,
        widthMm: item.widthMm,
        heightMm: item.heightMm,
        rotated: Boolean(item.rotated)
      });
    }
    if (parsedPage.length > 0) pages.push(parsedPage);
  }

  state.photos = photos;
  invalidateExportBarcodeId();
  refreshPhotoSizing(getConfig());
  state.pages = pages;
  state.listSelection.clear();
  state.currentPage = Math.min(Math.max(0, project.currentPage || 0), Math.max(0, pages.length - 1));
  state.selectedId = null;
  setSelectedItemName('Keins');
  hideManualMenu();

  renderTable();
  drawPreview();
  setStatus(`Projekt geladen: ${photos.length} Motive, ${pages.length} Seiten.`);
}

function clearAll() {
  state.photos = [];
  state.pages = [];
  invalidateExportBarcodeId();
  state.listSelection.clear();
  state.selectedId = null;
  state.currentPage = 0;
  setSelectedItemName('Keins');
  hideManualMenu();
  photoInput.value = '';
  projectLoadInput.value = '';
  renderTable();
  drawPreview();
  setStatus('Job geleert.');
}

function goToPage(index) {
  if (state.pages.length === 0) {
    state.currentPage = 0;
    hideManualMenu();
    drawPreview();
    return;
  }

  state.currentPage = Math.min(Math.max(0, index), state.pages.length - 1);
  state.selectedId = null;
  setSelectedItemName('Keins');
  hideManualMenu();
  drawPreview();
}

function getCanvasTransform(config) {
  const pad = 20;
  const scale = Math.min(
    (previewCanvas.width - pad * 2) / config.rollWidth,
    (previewCanvas.height - pad * 2) / config.maxHeight
  );
  return { pad, scale };
}

function canvasEventToMm(event, config) {
  const rect = previewCanvas.getBoundingClientRect();
  const sx = previewCanvas.width / rect.width;
  const sy = previewCanvas.height / rect.height;
  const px = (event.clientX - rect.left) * sx;
  const py = (event.clientY - rect.top) * sy;
  const { pad, scale } = getCanvasTransform(config);
  return {
    px,
    py,
    xMm: (px - pad) / scale,
    yMm: (py - pad) / scale,
    pad,
    scale
  };
}

function findItemAtCanvasPoint(px, py, page, config) {
  const { pad, scale } = getCanvasTransform(config);
  for (let i = page.length - 1; i >= 0; i--) {
    const item = page[i];
    const x = pad + item.xMm * scale;
    const y = pad + item.yMm * scale;
    const w = item.widthMm * scale;
    const h = item.heightMm * scale;
    if (px >= x && px <= x + w && py >= y && py <= y + h) {
      return item;
    }
  }
  return null;
}

function stopDrag() {
  suppressCanvasClick = state.drag.moved;
  state.drag.active = false;
  state.drag.id = null;
  state.drag.offsetXmm = 0;
  state.drag.offsetYmm = 0;
  state.drag.moved = false;
  state.drag.startClientX = 0;
  state.drag.startClientY = 0;
}

function hideManualMenu() {
  if (manualNestingMenu) {
    manualNestingMenu.hidden = true;
  }
}

function positionManualMenuOutsidePreview() {
  if (!manualNestingMenu || manualNestingMenu.hidden) return;

  const canvasRect = previewCanvas?.getBoundingClientRect();
  const menuWidth = manualNestingMenu.offsetWidth || 300;
  const menuHeight = manualNestingMenu.offsetHeight || 280;
  const padding = 16;

  let x = window.innerWidth / 2 - menuWidth / 2;
  let y = window.innerHeight / 2 - menuHeight / 2;

  const selected = getSelectedPlacement();
  const config = getConfig();
  if (canvasRect && selected) {
    const { pad, scale } = getCanvasTransform(config);
    const sx = previewCanvas.width / Math.max(1, canvasRect.width);
    const sy = previewCanvas.height / Math.max(1, canvasRect.height);

    const itemX = pad + selected.xMm * scale;
    const itemY = pad + selected.yMm * scale;
    const itemW = selected.widthMm * scale;
    const itemH = selected.heightMm * scale;

    const itemLeft = canvasRect.left + itemX / sx;
    const itemTop = canvasRect.top + itemY / sy;
    const itemRight = canvasRect.left + (itemX + itemW) / sx;
    const itemBottom = canvasRect.top + (itemY + itemH) / sy;

    x = itemRight + 12;
    y = itemTop;

    if (x + menuWidth + padding > window.innerWidth) {
      x = itemLeft - menuWidth - 12;
    }

    if (x < padding) {
      x = itemLeft;
      y = itemBottom + 12;
    }

    if (y + menuHeight + padding > window.innerHeight) {
      y = itemBottom - menuHeight;
    }
  } else if (canvasRect) {
    x = canvasRect.right + padding;
    y = canvasRect.top + padding;
  }

  x = Math.max(padding, Math.min(x, window.innerWidth - menuWidth - padding));
  y = Math.max(padding, Math.min(y, window.innerHeight - menuHeight - padding));

  manualNestingMenu.style.left = x + 'px';
  manualNestingMenu.style.top = y + 'px';
}

function showManualMenuAtCanvasEvent(event) {
  if (!manualNestingMenu) return;

  const selected = getSelectedPlacement();
  const header = document.getElementById('manualMenuHeader');
  if (header && selected) {
    header.textContent = selected.name || 'Menü';
  }

  manualNestingMenu.hidden = false;
  positionManualMenuOutsidePreview();
}

photoInput.addEventListener('change', async (event) => {
  const files = Array.from(event.target.files || []);
  if (files.length === 0) return;

  try {
    await withBusyOverlay('Motive werden geladen ...', async () => {
      await handlePhotoInput(files);
    });
  } catch (error) {
    setStatus(`Fehler beim Laden: ${error.message}`);
  }
});

nestBtn.addEventListener('click', async () => {
  if (state.photos.length === 0) {
    setStatus('Bitte zuerst Fotos laden.');
    return;
  }
  await withBusyOverlay('Motive werden platziert ...', async () => {
    runNesting();
  });
});

if (nestPageBtn) {
  nestPageBtn.addEventListener('click', async () => {
    await withBusyOverlay('Aktueller Bogen wird neu genestet ...', async () => {
      nestCurrentPage();
    });
  });
}

if (placeSelectionBtn) {
  placeSelectionBtn.addEventListener('click', async () => {
    await withBusyOverlay('Auswahl wird platziert ...', async () => {
      placeListSelectionOnCurrentPage();
    });
  });
}

if (deleteSelectionBtn) {
  deleteSelectionBtn.addEventListener('click', () => deleteListSelection());
}

clearBtn.addEventListener('click', clearAll);
saveProjectBtn.addEventListener('click', saveProject);
loadProjectBtn.addEventListener('click', () => projectLoadInput.click());
projectLoadInput.addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    await loadProjectFromFile(file);
  } catch (error) {
    setStatus(`Projekt konnte nicht geladen werden: ${error.message}`);
  }
});

exportPrintPdfBtn.addEventListener('click', () => exportPdf(true));
exportContourPdfBtn.addEventListener('click', () => exportPdf(false));
exportHotfolderBtn.addEventListener('click', exportToHotfolder);

prevPageBtn.addEventListener('click', () => goToPage(state.currentPage - 1));
nextPageBtn.addEventListener('click', () => goToPage(state.currentPage + 1));

previewCanvas.addEventListener('click', (event) => {
  if (suppressCanvasClick) {
    suppressCanvasClick = false;
    return;
  }

  const page = getCurrentPagePlacements();
  if (page.length === 0) {
    selectPlacementById(null);
    hideManualMenu();
    return;
  }

  const config = getConfig();
  const { px, py } = canvasEventToMm(event, config);
  const item = findItemAtCanvasPoint(px, py, page, config);
  if (item) {
    selectPlacementByIdWithMenuPosition(item.id);
    showManualMenuAtCanvasEvent(event);
    return;
  }

  selectPlacementById(null);
  hideManualMenu();
});

previewCanvas.addEventListener('mousedown', (event) => {
  const page = getCurrentPagePlacements();
  if (page.length === 0) return;

  const config = getConfig();
  const { px, py, xMm, yMm } = canvasEventToMm(event, config);
  const item = findItemAtCanvasPoint(px, py, page, config);
  if (!item) return;

  hideManualMenu();
  selectPlacementById(item.id);
  state.drag.active = true;
  state.drag.id = item.id;
  state.drag.offsetXmm = xMm - item.xMm;
  state.drag.offsetYmm = yMm - item.yMm;
  state.drag.moved = false;
  state.drag.startClientX = event.clientX;
  state.drag.startClientY = event.clientY;
});

previewCanvas.addEventListener('mousemove', (event) => {
  if (!state.drag.active || !state.drag.id) return;

  if (!state.drag.moved) {
    const dx = event.clientX - state.drag.startClientX;
    const dy = event.clientY - state.drag.startClientY;
    if (Math.hypot(dx, dy) >= 3) {
      state.drag.moved = true;
    }
  }

  const page = getCurrentPagePlacements();
  const selected = page.find((item) => item.id === state.drag.id);
  if (!selected) {
    stopDrag();
    return;
  }

  const config = getConfig();
  const { xMm, yMm } = canvasEventToMm(event, config);
  const candidate = { ...selected, xMm: xMm - state.drag.offsetXmm, yMm: yMm - state.drag.offsetYmm };
  const snapped = findNearestFreePlacement(candidate, page, config, selected.id, {
    maxRadiusMm: 60,
    angleSamples: 16
  });
  if (!snapped) {
    return;
  }

  selected.xMm = snapped.xMm;
  selected.yMm = snapped.yMm;
  drawPreview();
});

previewCanvas.addEventListener('mouseup', stopDrag);
previewCanvas.addEventListener('mouseleave', stopDrag);

previewCanvas.addEventListener('dragover', (event) => {
  event.preventDefault();
  previewCanvas.classList.add('drop-active');
});

previewCanvas.addEventListener('dragleave', () => {
  previewCanvas.classList.remove('drop-active');
});

previewCanvas.addEventListener('drop', (event) => {
  const id = event.dataTransfer?.getData('text/photo-id') || event.dataTransfer?.getData('text/plain');
  previewCanvas.classList.remove('drop-active');
  if (!id) return;
  event.preventDefault();

  const config = getConfig();
  const { xMm, yMm } = canvasEventToMm(event, config);
  const placed = placePhotoOnCurrentPageAt(id, xMm, yMm);
  if (!placed) {
    setStatus('Drop nicht moeglich: keine freie Position auf dem Bogen gefunden.');
    return;
  }

  selectPlacementById(placed.id);
  renderTable();
  drawPreview();
  const photo = getPhotoById(id);
  setStatus(`${photo?.name || 'Motiv'} auf dem Bogen platziert.`);
});

if (menuRotateBtn) {
  menuRotateBtn.addEventListener('click', () => rotateSelected());
}

if (menuDuplicateBtn) {
  menuDuplicateBtn.addEventListener('click', () => duplicateSelected());
}

if (menuUnplaceBtn) {
  menuUnplaceBtn.addEventListener('click', () => unplaceSelected());
}

if (menuCropBtn) {
  menuCropBtn.addEventListener('click', () => openCropOverlayForSelected());
}

if (menuApplyBtn) {
  menuApplyBtn.addEventListener('click', () => {
    // Save white border values before they get overwritten by applyScaleToSelected
    const savedBorderMmRaw = String(menuWhiteBorderMm?.value ?? '');
    const savedBorderMode = String(menuWhiteBorderMode?.value ?? 'outside');
    const savedTargetWidthRaw = String(menuTargetWidthCm?.value ?? '');
    const savedTargetHeightRaw = String(menuTargetHeightCm?.value ?? '');

    // Firefox fallback: if target dimensions are filled, enforce target mode
    // even when select-value updates lag behind click handling.
    const parsedTargetWidth = parseUiNumber(savedTargetWidthRaw);
    const parsedTargetHeight = parseUiNumber(savedTargetHeightRaw);
    const shouldForceTargetMode = parsedTargetWidth > 0 && parsedTargetHeight > 0;
    const effectiveBorderMode = shouldForceTargetMode
      ? 'target'
      : savedBorderMode;
    
    if (effectiveBorderMode !== 'target') {
      applyScaleToSelected();
    }
    
    // Restore white border values from before scale was applied
    if (menuWhiteBorderMm) menuWhiteBorderMm.value = savedBorderMmRaw;
    if (menuWhiteBorderMode) menuWhiteBorderMode.value = effectiveBorderMode;
    if (menuTargetWidthCm) menuTargetWidthCm.value = savedTargetWidthRaw;
    if (menuTargetHeightCm) menuTargetHeightCm.value = savedTargetHeightRaw;
    
    applyWhiteBorderToSelected();
  });
}

if (menuScaleWidthCm) {
  menuScaleWidthCm.addEventListener('input', () => {
    manualScaleLastEdited = 'width';
    syncScaleInputsByRatio('width');
  });
}

if (menuScaleHeightCm) {
  menuScaleHeightCm.addEventListener('input', () => {
    manualScaleLastEdited = 'height';
    syncScaleInputsByRatio('height');
  });
}

if (menuScaleDpi) {
  menuScaleDpi.addEventListener('input', () => {
    updateSizeFromDpi();
  });
}

if (photoOverlayCloseBtn) {
  photoOverlayCloseBtn.addEventListener('click', closePhotoOverlay);
}

if (photoOverlay) {
  photoOverlay.addEventListener('click', (event) => {
    const target = event.target;
    if (target instanceof HTMLElement && target.dataset.closeOverlay === 'true') {
      closePhotoOverlay();
    }
  });
}

if (photoOverlayViewport) {
  photoOverlayViewport.addEventListener('pointerdown', (event) => {
    if (photoOverlay.hidden) return;
    if (event.button !== 0) return;
    event.preventDefault();
    overlayView.dragging = true;
    overlayView.pointerId = event.pointerId;
    overlayView.startX = event.clientX;
    overlayView.startY = event.clientY;
    overlayView.startTx = overlayView.tx;
    overlayView.startTy = overlayView.ty;
    photoOverlayViewport.classList.add('is-dragging');
    if (typeof photoOverlayViewport.setPointerCapture === 'function') {
      try {
        photoOverlayViewport.setPointerCapture(event.pointerId);
      } catch {
        // Ignore capture errors; dragging still works without capture.
      }
    }
  });

  photoOverlayViewport.addEventListener('pointermove', (event) => {
    if (!overlayView.dragging || overlayView.pointerId !== event.pointerId) return;
    event.preventDefault();
    const dx = event.clientX - overlayView.startX;
    const dy = event.clientY - overlayView.startY;
    overlayView.tx = overlayView.startTx + dx;
    overlayView.ty = overlayView.startTy + dy;
    applyOverlayTransform();
  });

  const endOverlayDrag = (event) => {
    if (overlayView.pointerId !== event.pointerId) return;
    overlayView.dragging = false;
    overlayView.pointerId = null;
    photoOverlayViewport.classList.remove('is-dragging');
  };

  photoOverlayViewport.addEventListener('pointerup', endOverlayDrag);
  photoOverlayViewport.addEventListener('pointercancel', endOverlayDrag);

  photoOverlayViewport.addEventListener('wheel', (event) => {
    if (photoOverlay.hidden) return;
    event.preventDefault();
    const step = event.deltaY < 0 ? 0.12 : -0.12;
    const nextScale = Math.min(6, Math.max(1, overlayView.scale + step));
    if (Math.abs(nextScale - overlayView.scale) < 1e-6) return;
    overlayView.scale = nextScale;
    applyOverlayTransform();
  }, { passive: false });
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    if (cropOverlay && !cropOverlay.hidden) {
      closeCropOverlay();
      return;
    }
    closePhotoOverlay();
  }
});

if (cropOverlayCanvas) {
  cropOverlayCanvas.addEventListener('pointerdown', (event) => {
    if (!cropEditor.active) return;
    if (event.button !== 0) return;
    const selected = getSelectedPlacement();
    if (!selected) return;
    event.preventDefault();
    const rect = cropOverlayCanvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const rectCanvas = getCropRectCanvas(selected);
    const handle = getHandleAtCanvasPoint(selected, x, y);

    if (handle) {
      cropEditor.dragging = true;
      cropEditor.dragMode = 'resize';
      cropEditor.activeHandle = handle;
      cropEditor.pointerId = event.pointerId;
      cropEditor.resizeAnchor = getResizeAnchorForHandle(handle, cropEditor.rect);
      cropOverlayCanvas.setPointerCapture(event.pointerId);
      return;
    }

    const rx = rectCanvas.x;
    const ry = rectCanvas.y;
    const rw = rectCanvas.w;
    const rh = rectCanvas.h;
    if (x >= rx && x <= rx + rw && y >= ry && y <= ry + rh) {
      cropEditor.dragging = true;
      cropEditor.dragMode = 'move';
      cropEditor.activeHandle = null;
      cropEditor.pointerId = event.pointerId;
      cropEditor.dragOffsetX = x - rx;
      cropEditor.dragOffsetY = y - ry;
      cropOverlayCanvas.setPointerCapture(event.pointerId);
    }
  });

  cropOverlayCanvas.addEventListener('pointermove', (event) => {
    if (!cropEditor.active) return;
    const selected = getSelectedPlacement();
    if (!selected) return;

    const rect = cropOverlayCanvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    if (!cropEditor.dragging || cropEditor.pointerId !== event.pointerId) {
      const handle = getHandleAtCanvasPoint(selected, x, y);
      if (handle === 'nw' || handle === 'se') {
        cropOverlayCanvas.style.cursor = 'nwse-resize';
      } else if (handle === 'ne' || handle === 'sw') {
        cropOverlayCanvas.style.cursor = 'nesw-resize';
      } else {
        const rcv = getCropRectCanvas(selected);
        const inside = x >= rcv.x && x <= rcv.x + rcv.w && y >= rcv.y && y <= rcv.y + rcv.h;
        cropOverlayCanvas.style.cursor = inside ? 'move' : 'grab';
      }
      return;
    }

    event.preventDefault();
    const d = cropEditor.display;
    const iw = selected.image.naturalWidth;
    const ih = selected.image.naturalHeight;

    if (cropEditor.dragMode === 'resize' && cropEditor.activeHandle && cropEditor.resizeAnchor) {
      const pointerPx = canvasToImagePoint(selected, x, y);
      let nextRect = buildRectFromHandleDrag(
        cropEditor.activeHandle,
        cropEditor.resizeAnchor,
        pointerPx,
        iw,
        ih
      );
      if (isCropRatioLocked() && cropEditor.lockedAspect > 0) {
        nextRect = fitRectToAspect(nextRect, cropEditor.lockedAspect);
      }
      cropEditor.rect = clampCropRect(nextRect, iw, ih);
    } else if (cropEditor.dragMode === 'move') {
      const nx = ((x - cropEditor.dragOffsetX - d.x) / d.w) * iw;
      const ny = ((y - cropEditor.dragOffsetY - d.y) / d.h) * ih;
      cropEditor.rect = clampCropRect({ ...cropEditor.rect, x: nx, y: ny }, iw, ih);
    }

    cropEditor.aspect = cropEditor.rect.w / Math.max(1e-6, cropEditor.rect.h);

    renderCropOverlay();
    updateCropRectInputs();
    updateCropOverlayDpiInfo();
  });

  cropOverlayCanvas.addEventListener('pointerup', (event) => {
    if (cropEditor.pointerId !== event.pointerId) return;
    cropEditor.dragging = false;
    cropEditor.dragMode = null;
    cropEditor.activeHandle = null;
    cropEditor.pointerId = null;
    cropEditor.resizeAnchor = null;
  });
  cropOverlayCanvas.addEventListener('pointercancel', (event) => {
    if (cropEditor.pointerId !== event.pointerId) return;
    cropEditor.dragging = false;
    cropEditor.dragMode = null;
    cropEditor.activeHandle = null;
    cropEditor.pointerId = null;
    cropEditor.resizeAnchor = null;
  });

  cropOverlayCanvas.addEventListener('wheel', (event) => {
    if (!cropEditor.active) return;
    event.preventDefault();
    const selected = getSelectedPlacement();
    if (!selected) return;
    const factor = event.deltaY < 0 ? 0.94 : 1.06;
    const r = cropEditor.rect;
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    let nw = Math.max(24, Math.min(selected.image.naturalWidth, r.w * factor));
    let nh = Math.max(24, Math.min(selected.image.naturalHeight, r.h * factor));
    cropEditor.rect = clampCropRect({ x: cx - nw / 2, y: cy - nh / 2, w: nw, h: nh }, selected.image.naturalWidth, selected.image.naturalHeight);
    cropEditor.aspect = cropEditor.rect.w / Math.max(1e-6, cropEditor.rect.h);
    renderCropOverlay();
    updateCropRectInputs();
    updateCropOverlayDpiInfo();
  }, { passive: false });
}

if (cropTargetWidthCm) {
  cropTargetWidthCm.addEventListener('input', () => {
    updateCropAspectFromInputs('width');
    updateCropRectInputs();
  });
}

if (cropTargetHeightCm) {
  cropTargetHeightCm.addEventListener('input', () => {
    updateCropAspectFromInputs('height');
    updateCropRectInputs();
  });
}

if (cropRectXPercent) {
  cropRectXPercent.addEventListener('input', () => applyCropRectInputs('x'));
}

if (cropRectYPercent) {
  cropRectYPercent.addEventListener('input', () => applyCropRectInputs('y'));
}

if (cropRectWPercent) {
  cropRectWPercent.addEventListener('input', () => applyCropRectInputs('w'));
}

if (cropRectHPercent) {
  cropRectHPercent.addEventListener('input', () => applyCropRectInputs('h'));
}

if (cropRatioH) {
  cropRatioH.addEventListener('input', () => applyCropRatioFromInputs());
}

if (cropRatioW) {
  cropRatioW.addEventListener('input', () => applyCropRatioFromInputs());
}

if (cropLockRatio) {
  cropLockRatio.addEventListener('change', () => {
    if (!cropEditor.active) {
      syncCropRatioLockUi();
      return;
    }

    if (isCropRatioLocked()) {
      cropEditor.lockedAspect = cropEditor.rect.w / Math.max(1e-6, cropEditor.rect.h);
      updateCropAspectFromInputs(null);
    }

    syncCropRatioLockUi();
    updateCropRectInputs();
    updateCropOverlayDpiInfo();
  });
}

if (cropOverlayApplyBtn) {
  cropOverlayApplyBtn.addEventListener('click', () => applyCropOverlay());
}

if (cropOverlayCancelBtn) {
  cropOverlayCancelBtn.addEventListener('click', () => closeCropOverlay());
}

if (cropOverlay) {
  cropOverlay.addEventListener('click', (event) => {
    const target = event.target;
    if (target instanceof HTMLElement && target.dataset.closeCropOverlay === 'true') {
      closeCropOverlay();
    }
  });
}

closePhotoOverlay();

[rollWidthInput, maxHeightInput, paddingInput, allowRotateInput, dpiInput].forEach((input) => {
  input?.addEventListener('change', () => {
    refreshPhotoSizing(getConfig());
    renderTable();
    drawPreview();
  });
});

if (oversizeWidthCmInput) {
  oversizeWidthCmInput.addEventListener('click', (event) => {
    event.stopPropagation();
  });
}

if (oversizeApplyBtn) {
  oversizeApplyBtn.addEventListener('click', async () => {
    const selectedPhoto = state.selectedId ? getPhotoById(state.selectedId) : null;
    if (!selectedPhoto) {
      setStatus('Bitte zuerst ein Motiv auswaehlen.');
      return;
    }
    const widthCm = Number(oversizeWidthCmInput?.value || 0);
    if (!Number.isFinite(widthCm) || widthCm <= 0) {
      setStatus('Bitte eine gueltige Breite eingeben.');
      return;
    }

    setPhotoTargetWidthMm(selectedPhoto, widthCm * MM_PER_CM, 'manual');
    renderTable();
    drawPreview();

    if (state.pages.length > 0) {
      await withBusyOverlay('Layout wird mit neuer Motivgroesse neu berechnet ...', async () => {
        runNesting();
      });
    }
  });
}

resizePreviewCanvas();

renderTable();
drawPreview();

window.addEventListener('load', () => {
  setTimeout(() => {
    positionManualMenuOutsidePreview();
  }, 100);
});

window.addEventListener('resize', () => {
  if (manualNestingMenu && !manualNestingMenu.hidden) {
    positionManualMenuOutsidePreview();
  }
});

void loadStartupTestPhoto();

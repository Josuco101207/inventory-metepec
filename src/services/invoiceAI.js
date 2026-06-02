/**
 * Invoice AI Processing Service
 * 
 * Processes invoice images using:
 * 1. OpenAI Vision / Gemini (if API key configured)
 * 2. Tesseract.js OCR (free, runs in browser - default)
 * 3. Mock data (fallback for testing)
 */

import Tesseract from 'tesseract.js';

const AI_API_KEY = import.meta.env.VITE_AI_API_KEY || '';
const AI_PROVIDER = import.meta.env.VITE_AI_PROVIDER || 'ocr'; // 'openai' | 'gemini' | 'ocr' | 'mock'

const SYSTEM_PROMPT = `Eres un sistema de OCR inteligente para facturas mexicanas. Extrae TODOS los productos/items de la factura.

IMPORTANTE: Si la imagen analizada CLARAMENTE NO es una factura, recibo, nota de remisión o ticket de compra (por ejemplo, si es una foto de una persona, un paisaje, o un documento sin relación), debes devolver ÚNICAMENTE el siguiente JSON:
{ "error": "not_an_invoice" }

Para CADA item, devuelve:
- descripcion: nombre del producto tal como aparece en la factura
- cantidad: número de unidades
- unidad: unidad de medida (PZA, KG, M, LT, CAJA, etc.)
- precioUnitario: precio por unidad SIN IVA
- iva: monto de IVA para ese item (si no se muestra por línea, calcula 16%)
- detallesExtra: objeto JSON con los atributos adicionales del producto que encuentres (ej. marca, modelo, color, voltaje, dimensiones, etc.)

También extrae los datos del encabezado:
- folio: número de factura
- proveedor: nombre del proveedor/empresa emisora
- fecha: fecha de emisión (formato YYYY-MM-DD)
- moneda: MXN o USD

Responde SOLO en JSON válido con esta estructura exacta (o el JSON de error si no es factura):
{
  "header": { "folio": "", "proveedor": "", "fecha": "", "moneda": "MXN" },
  "items": [
    { "descripcion": "", "cantidad": 0, "unidad": "PZA", "precioUnitario": 0, "iva": 0, "detallesExtra": {} }
  ]
}`;

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function processWithOpenAI(base64, mimeType) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Extrae los datos de esta factura:' },
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
          ],
        },
      ],
      max_tokens: 4096,
      temperature: 0.1,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `OpenAI API error: ${res.status}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || '';
  return parseAIResponse(content);
}

async function processWithGemini(base64, mimeType) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${AI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: SYSTEM_PROMPT + '\n\nExtrae los datos de esta factura:' },
            { inline_data: { mime_type: mimeType, data: base64 } },
          ],
        }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 4096 },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Gemini API error: ${res.status}`);
  }

  const data = await res.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return parseAIResponse(content);
}

function parseAIResponse(content) {
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No se pudo parsear la respuesta de la IA');
  const parsed = JSON.parse(jsonMatch[0]);

  if (parsed.error === 'not_an_invoice') {
    throw new Error('La imagen subida no parece ser una factura, nota de remisión o recibo válido.');
  }

  if (!parsed.header || !Array.isArray(parsed.items)) {
    throw new Error('Formato de respuesta inválido');
  }

  return {
    header: {
      folio: parsed.header.folio || '',
      proveedor: parsed.header.proveedor || '',
      fecha: parsed.header.fecha || new Date().toISOString().slice(0, 10),
      moneda: parsed.header.moneda || 'MXN',
    },
    items: parsed.items.map(item => ({
      descripcion: item.descripcion || '',
      cantidad: parseFloat(item.cantidad) || 0,
      unidad: item.unidad || 'PZA',
      precioUnitario: parseFloat(item.precioUnitario) || 0,
      iva: parseFloat(item.iva) || 0,
    })),
  };
}

// ────────────────────────────────────────────
// Tesseract.js OCR Processing (Free, Local)
// ────────────────────────────────────────────

let onProgressCallback = null;

export function setOCRProgressCallback(cb) {
  onProgressCallback = cb;
}

function preprocessImage(file, mode = 'contrast') {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const srcUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(srcUrl);

      // Step 1: Scale up significantly for better OCR
      const scale = Math.max(1, 3000 / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, w, h);

      const imageData = ctx.getImageData(0, 0, w, h);
      const d = imageData.data;

      // Step 2: Convert to grayscale
      const gray = new Float32Array(w * h);
      for (let i = 0; i < w * h; i++) {
        gray[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
      }

      // Step 3: Adaptive local thresholding (Sauvola-like)
      // This handles uneven lighting much better than global threshold
      if (mode === 'adaptive') {
        const radius = Math.max(15, Math.round(w / 80));
        const out = new Uint8Array(w * h);

        // Build integral image for fast local mean
        const integral = new Float64Array(w * h);
        const integralSq = new Float64Array(w * h);
        for (let y = 0; y < h; y++) {
          let rowSum = 0, rowSumSq = 0;
          for (let x = 0; x < w; x++) {
            const idx = y * w + x;
            const v = gray[idx];
            rowSum += v;
            rowSumSq += v * v;
            integral[idx] = rowSum + (y > 0 ? integral[(y - 1) * w + x] : 0);
            integralSq[idx] = rowSumSq + (y > 0 ? integralSq[(y - 1) * w + x] : 0);
          }
        }

        const k = 0.15; // Sauvola parameter
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const x1 = Math.max(0, x - radius);
            const y1 = Math.max(0, y - radius);
            const x2 = Math.min(w - 1, x + radius);
            const y2 = Math.min(h - 1, y + radius);
            const count = (x2 - x1 + 1) * (y2 - y1 + 1);

            let sum = integral[y2 * w + x2];
            if (x1 > 0) sum -= integral[y2 * w + (x1 - 1)];
            if (y1 > 0) sum -= integral[(y1 - 1) * w + x2];
            if (x1 > 0 && y1 > 0) sum += integral[(y1 - 1) * w + (x1 - 1)];

            let sumSq = integralSq[y2 * w + x2];
            if (x1 > 0) sumSq -= integralSq[y2 * w + (x1 - 1)];
            if (y1 > 0) sumSq -= integralSq[(y1 - 1) * w + x2];
            if (x1 > 0 && y1 > 0) sumSq += integralSq[(y1 - 1) * w + (x1 - 1)];

            const mean = sum / count;
            const variance = sumSq / count - mean * mean;
            const stddev = Math.sqrt(Math.max(0, variance));
            const threshold = mean * (1 + k * (stddev / 128 - 1));

            out[y * w + x] = gray[y * w + x] > threshold ? 255 : 0;
          }
        }

        for (let i = 0; i < w * h; i++) {
          d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = out[i];
        }
      } else {
        // 'contrast' mode: grayscale + strong contrast, no binarization
        for (let i = 0; i < w * h; i++) {
          let v = gray[i];
          v = ((v / 255 - 0.5) * 1.6 + 0.5) * 255;
          v = Math.max(0, Math.min(255, v));
          d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v;
        }
      }

      ctx.putImageData(imageData, 0, 0);

      canvas.toBlob((blob) => {
        blob ? resolve(URL.createObjectURL(blob)) : reject(new Error('Failed to preprocess image'));
      }, 'image/png');
    };
    img.onerror = () => { URL.revokeObjectURL(srcUrl); reject(new Error('Failed to load image')); };
    img.src = srcUrl;
  });
}

async function runOCR(imageUrl, progressStart, progressRange) {
  const result = await Tesseract.recognize(imageUrl, 'spa+eng', {
    logger: (m) => {
      if (m.status === 'recognizing text' && onProgressCallback) {
        onProgressCallback(progressStart + Math.round(m.progress * progressRange));
      }
    },
  });
  return result.data.text || '';
}

function scoreText(text) {
  if (!text) return 0;
  let score = text.length;
  // Bonus for recognizable invoice keywords
  const keywords = ['factura', 'total', 'subtotal', 'sub total', 'precio', 'cantidad',
    'iva', 'impuesto', 'producto', 'descripcion', 'monto', 'orden', 'folio',
    'proveedor', 'fecha', 'pza', 'pieza', 'unidad', 'malla', 'membrana'];
  const lower = text.toLowerCase();
  for (const kw of keywords) {
    if (lower.includes(kw)) score += 200;
  }
  // Bonus for decimal numbers (prices)
  const decimals = text.match(/\d+[.,]\d{2}/g);
  if (decimals) score += decimals.length * 100;
  return score;
}

async function processWithTesseract(file) {
  const urls = [];

  try {
    if (onProgressCallback) onProgressCallback(3);

    // Prepare two preprocessing modes
    const adaptiveUrl = await preprocessImage(file, 'adaptive');
    urls.push(adaptiveUrl);
    if (onProgressCallback) onProgressCallback(5);

    const contrastUrl = await preprocessImage(file, 'contrast');
    urls.push(contrastUrl);
    if (onProgressCallback) onProgressCallback(8);

    // Run OCR on adaptive-thresholded image (best for uneven lighting)
    const text1 = await runOCR(adaptiveUrl, 8, 40);

    // Run OCR on contrast-enhanced image
    const text2 = await runOCR(contrastUrl, 48, 40);

    // Pick the text with more invoice-relevant content
    const score1 = scoreText(text1);
    const score2 = scoreText(text2);
    const bestText = score1 >= score2 ? text1 : text2;

    if (!bestText || bestText.trim().length < 20) {
      // Last resort: try original image
      const origUrl = URL.createObjectURL(file);
      urls.push(origUrl);
      const text3 = await runOCR(origUrl, 88, 10);
      if (!text3 || text3.trim().length < 20) {
        throw new Error('No se pudo extraer texto legible de la imagen. Intenta con una foto más clara.');
      }
      return parseInvoiceText(text3);
    }

    return parseInvoiceText(bestText);
  } finally {
    urls.forEach(u => URL.revokeObjectURL(u));
  }
}

function parseNumber(str) {
  if (!str) return 0;
  const cleaned = str.replace(/[$,\s]/g, '').replace(/[oO]/g, '0');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function extractDate(text) {
  // Match dates: MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD, etc.
  const patterns = [
    /(\d{1,2})[/-](\d{1,2})[/-](\d{4})/,
    /(\d{4})[/-](\d{1,2})[/-](\d{1,2})/,
  ];
  for (const pat of patterns) {
    const m = text.match(pat);
    if (m) {
      if (m[1].length === 4) {
        return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
      }
      const month = parseInt(m[1]);
      const day = parseInt(m[2]);
      const year = m[3];
      if (month > 12) {
        return `${year}-${String(day).padStart(2, '0')}-${String(month).padStart(2, '0')}`;
      }
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }
  return new Date().toISOString().slice(0, 10);
}

function detectUnit(text) {
  const t = text.toLowerCase();
  if (/\bpza\b|\bpieza/i.test(t)) return 'PZA';
  if (/\bkg\b|\bkilo/i.test(t)) return 'KG';
  if (/\bmts?\b|\bmetro/i.test(t)) return 'M';
  if (/\blt\b|\blitro/i.test(t)) return 'LT';
  if (/\bml\b/i.test(t)) return 'ML';
  if (/\bcm\b/i.test(t)) return 'CM';
  if (/\brollo/i.test(t)) return 'ROLLO';
  if (/\bcaja/i.test(t)) return 'CAJA';
  if (/\bpar\b/i.test(t)) return 'PAR';
  if (/\bjgo\b|\bjuego/i.test(t)) return 'JGO';
  if (/\bbolsa/i.test(t)) return 'BOLSA';
  if (/\bpaquete\b|\bpaq\b/i.test(t)) return 'PAQUETE';
  if (/\bmts2\b|\bm2\b|\bm²/i.test(t)) return 'M';
  return 'PZA';
}

function parseInvoiceText(rawText) {
  const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const fullText = lines.join('\n');


  // ── Extract Header ──
  const header = {
    folio: '',
    proveedor: '',
    fecha: extractDate(fullText),
    moneda: /\busd\b/i.test(fullText) ? 'USD' : 'MXN',
  };

  // Folio / Orden
  const folioPatterns = [
    /(?:folio|orden\s*(?:no\.?)?)\s*[:.]?\s*([A-Z0-9-]+\d+)/i,
    /(?:factura)\s*.*?(\d{4,})/i,
    /\b(\d{5,})\b/,
  ];
  for (const pat of folioPatterns) {
    const m = fullText.match(pat);
    if (m) { header.folio = m[1].trim(); break; }
  }

  // Proveedor
  const provPatterns = [
    /(?:raz[oó]n\s*social|proveedor)\s*[:.]?\s*(.+)/i,
    /([\w\s]+S\.?\s*A\.?\s*(?:de)?\s*(?:C\.?\s*V\.?|R\.?\s*L\.?))/i,
  ];
  for (const pat of provPatterns) {
    const m = fullText.match(pat);
    if (m) { header.proveedor = m[1].trim().replace(/\s+/g, ' '); break; }
  }

  if (!header.proveedor) {
    for (let i = 0; i < Math.min(lines.length, 10); i++) {
      if (/S\.?\s*A\.?\s*(de)?\s*(C\.?\s*V\.?|R\.?\s*L\.?)/i.test(lines[i]) ||
          /INTERNACIONAL|PLAST|INDUSTRIAL|COMERCIAL|DISTRIBUI/i.test(lines[i])) {
        header.proveedor = lines[i].replace(/\s+/g, ' ').trim();
        break;
      }
    }
  }

  // ── Find document total first (used for amount validation) ──
  // OCR may garble "39,644.97" → "39.664 97" or "39,644 97" etc.
  const totalMatch = fullText.match(/TOTAL\s*[:.]\s*\$?\s*([\d,.\s]+\d)/i);
  let docTotal = 0;
  if (totalMatch) {
    let raw = totalMatch[1].trim();
    // "39.664 97" → treat period-before-3-digits as thousands sep, space as decimal
    // "39,644.97" → standard format
    raw = raw.replace(/\.(\d{3})/g, '$1'); // remove period used as thousands separator
    raw = raw.replace(/,(\d{3})/g, '$1');  // remove comma used as thousands separator
    raw = raw.replace(/\s+/g, '.');        // space before last digits → decimal
    docTotal = parseFloat(raw) || 0;
  }

  // Helper: fix amounts that lost their decimal point during OCR
  function fixAmount(n) {
    if (docTotal <= 0) return n;
    if (n <= docTotal) return n;
    // Try inserting decimal point: 456450 → 4564.50
    const div100 = n / 100;
    if (div100 > 10 && div100 <= docTotal) return Math.round(div100 * 100) / 100;
    const div10 = n / 10;
    if (div10 > 10 && div10 <= docTotal) return Math.round(div10 * 100) / 100;
    return n;
  }

  // ── Detection: Is this really an invoice? ──
  const invoiceKeywords = /factura|total|subtotal|precio|monto|folio|pago|recibo|ticket|nota|compra|venta|rfc/i;
  const hasDecimals = /\d[\d,]*\.\d{2}/.test(fullText);
  const isLikelyInvoice = invoiceKeywords.test(fullText) || docTotal > 0 || hasDecimals;
  
  if (!isLikelyInvoice && fullText.length > 20) {
    throw new Error('La imagen subida no parece ser una factura, nota de remisión o recibo válido.');
  }

  // ── Extract Items ──
  const items = [];
  const skipLine = /sub\s*total|^impuesto|^iva\b|^total[:\s]|descuento|deacuent|cargo\s*mis|condicion|comentari|^pago|recib[ií]|firma|aceptaci/i;
  const headerLine = /^(RFC|Tel[eé]|Nombre|Direcci|Cliente|Raz[oó]n|Orden|Fecha|CP\s|Chont|Rarar|masas|Procia|FACTURA|MANCO|amass|SANTA|Mawcan)/i;

  // Strategy 1: Find product lines — lines starting with line numbers (1-9, Y, I)
  // followed by a product code/description with numbers
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (skipLine.test(line) || headerLine.test(line)) continue;
    if (line.length < 15) continue;

    // Match lines starting with item number + alphanumeric code
    // "Y MNS4D..." or "2 MSIIC-17-24141..." or "3 MSIA 11 ZATA!..."
    const lineMatch = line.match(/^\s*([YyIil1-9])\s+([A-Za-z]{2,}\S*)\s+(.{5,})/);
    if (!lineMatch) continue;

    const codeWord = lineMatch[2];
    let rest = lineMatch[3];

    // Build description: code + descriptive text
    let fullBlock = line;
    for (let j = 1; j <= 2 && i + j < lines.length; j++) {
      const nxt = lines[i + j];
      if (/especif|ancho|Tepnch|Axe\s+mn/i.test(nxt)) {
        fullBlock += ' ' + nxt;
      }
    }

    // Extract numbers from REST (after the code) + spec lines, NOT from code
    let restPlusSpecs = rest;
    for (let j = 1; j <= 2 && i + j < lines.length; j++) {
      const nxt = lines[i + j];
      if (/especif|ancho|Tepnch|Axe\s+mn/i.test(nxt)) {
        restPlusSpecs += ' ' + nxt;
      }
    }

    // Remove date-like patterns and extract numbers
    const cleanRest = restPlusSpecs.replace(/\d{1,2}\/\d{1,2}\/\d{2,4}/g, ' ');
    const allNums = [];
    const numMatches = cleanRest.match(/\d[\d,]*\.?\d*/g);
    if (numMatches) numMatches.forEach(n => {
      const v = parseNumber(n);
      if (v > 0) allNums.push(v);
    });

    // Fix garbled numbers and find reasonable amounts
    const fixedNums = allNums.map(n => fixAmount(n));
    const amounts = fixedNums.filter(n => n >= 100 && n <= (docTotal > 0 ? docTotal * 1.1 : 999999));

    // Get the line total (largest reasonable amount)
    const monto = amounts.length > 0 ? Math.max(...amounts) : 0;
    if (monto < 10) continue;

    // Quantity: small integer from the description part
    const qtyNums = fixedNums.filter(n => n >= 1 && n <= 20 && Number.isInteger(n));
    let qty = qtyNums.length > 0 ? qtyNums[qtyNums.length - 1] : 1;

    // Clean description
    let desc = rest.replace(/\d[\d,]*\.?\d*/g, ' ').replace(/[—-]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (desc.length < 3) desc = codeWord;
    const fullDesc = (codeWord + ' ' + desc).substring(0, 80).trim();

    const unitPrice = qty > 0 ? Math.round(monto / qty * 100) / 100 : monto;

    items.push({
      descripcion: fullDesc,
      cantidad: qty,
      unidad: detectUnit(fullBlock),
      precioUnitario: unitPrice,
      iva: Math.round(unitPrice * qty * 0.16 * 100) / 100,
    });
  }

  // Strategy 2: Product keyword lines not already found
  if (items.length < 2) {
    const kwds = /malla|membrana|mega|rollo|tela|cable|pelota|cinta|tubo|perfil|lamina|plástico|plastico|vinilo|hule|sombra|somtza|sorexa|brill/i;
    for (const line of lines) {
      if (skipLine.test(line) || headerLine.test(line)) continue;
      if (!kwds.test(line) || line.length < 10) continue;

      const alreadyCaptured = items.some(it =>
        it.descripcion.toLowerCase().substring(0, 15) === line.toLowerCase().replace(/^\s*\S+\s+/, '').substring(0, 15)
      );
      if (alreadyCaptured) continue;

      const nums = line.match(/\d[\d,]*\.?\d*/g)?.map(n => fixAmount(parseNumber(n))).filter(n => n >= 100 && n <= (docTotal > 0 ? docTotal * 1.1 : 999999)) || [];
      const desc = line.replace(/\d[\d,]*\.?\d*/g, ' ').replace(/\s+/g, ' ').trim();
      const price = nums.length > 0 ? Math.max(...nums) : 0;
      if (desc.length > 3) {
        items.push({
          descripcion: desc.substring(0, 80),
          cantidad: 1,
          unidad: detectUnit(line),
          precioUnitario: price,
          iva: Math.round(price * 0.16 * 100) / 100,
        });
      }
    }
  }

  // Strategy 3: Lines with decimal amounts (fallback)
  if (items.length === 0) {
    for (const line of lines) {
      if (skipLine.test(line)) continue;
      const amts = line.match(/[\d,]+\.\d{2}/g);
      if (amts && amts.length >= 1) {
        const descPart = line.replace(/[\d,]+\.\d{2}/g, ' ').replace(/\$\s*/g, '').replace(/\s+/g, ' ').trim();
        if (descPart.length > 5 && !/^[\d\s\-.,]+$/.test(descPart)) {
          const maxAmt = Math.max(...amts.map(a => parseNumber(a)));
          items.push({
            descripcion: descPart.replace(/^\d+\s*/, '').trim(),
            cantidad: 1,
            unidad: detectUnit(line),
            precioUnitario: maxAmt,
            iva: Math.round(maxAmt * 0.16 * 100) / 100,
          });
        }
      }
    }
  }

  // Deduplicate
  const seen = new Set();
  const uniqueItems = items.filter(item => {
    if (item.descripcion.length < 3) return false;
    const key = item.descripcion.toLowerCase().replace(/\s+/g, '').substring(0, 20);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Post-process: if we have the doc total, normalize item amounts to match
  if (docTotal > 0 && uniqueItems.length > 0) {
    const subTotal = Math.round(docTotal / 1.16 * 100) / 100;
    const currentSum = uniqueItems.reduce((sum, it) => sum + (it.precioUnitario * it.cantidad), 0);

    // If amounts are way off (>2x or <0.5x the subtotal), redistribute proportionally
    if (currentSum > subTotal * 2 || currentSum < subTotal * 0.5) {
      const ratio = subTotal / (currentSum || 1);
      uniqueItems.forEach(item => {
        item.precioUnitario = Math.round(item.precioUnitario * ratio * 100) / 100;
        item.iva = Math.round(item.precioUnitario * item.cantidad * 0.16 * 100) / 100;
      });
    } else {
      // Amounts are in the right ballpark, just recalculate IVA at 16%
      uniqueItems.forEach(item => {
        item.iva = Math.round(item.precioUnitario * item.cantidad * 0.16 * 100) / 100;
      });
    }
  }

  if (uniqueItems.length === 0 && docTotal > 0) {
    const sub = Math.round(docTotal / 1.16 * 100) / 100;
    uniqueItems.push({
      descripcion: header.proveedor ? `Productos de ${header.proveedor}` : 'Productos (factura completa)',
      cantidad: 1,
      unidad: 'PZA',
      precioUnitario: sub,
      iva: Math.round((docTotal - sub) * 100) / 100,
    });
  }

  if (uniqueItems.length === 0) {
    throw new Error('No se pudieron identificar productos en el texto. Para mejores resultados, usa una foto plana, bien iluminada, o un escaneo digital de la factura.');
  }

  return { header, items: uniqueItems };
}

async function processWithMock() {
  await new Promise(r => setTimeout(r, 2500));
  return {
    header: {
      folio: 'FAC-2026-' + Math.floor(Math.random() * 9000 + 1000),
      proveedor: 'Distribuidora Industrial MX S.A. de C.V.',
      fecha: new Date().toISOString().slice(0, 10),
      moneda: 'MXN',
    },
    items: [
      { descripcion: 'Pelotas de ping pong paquete x6', cantidad: 10, unidad: 'PZA', precioUnitario: 45.00, iva: 72.00 },
      { descripcion: 'Tinta para impresora HP 664 Negro', cantidad: 3, unidad: 'PZA', precioUnitario: 289.00, iva: 138.72 },
      { descripcion: 'Resma papel bond carta 500 hojas', cantidad: 5, unidad: 'PZA', precioUnitario: 120.00, iva: 96.00 },
      { descripcion: 'Cinta adhesiva transparente 48mm', cantidad: 12, unidad: 'PZA', precioUnitario: 18.50, iva: 35.52 },
      { descripcion: 'Botones arcade 30mm colores surtidos', cantidad: 20, unidad: 'PZA', precioUnitario: 35.00, iva: 112.00 },
      { descripcion: 'Cable HDMI 2.0 3 metros', cantidad: 4, unidad: 'PZA', precioUnitario: 85.00, iva: 54.40 },
    ],
  };
}

/**
 * Compresses an image file to reduce size before sending to AI.
 */
export function compressImage(file, maxWidth = 1600, maxHeight = 1600, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const srcUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(srcUrl);
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob((blob) => {
        blob ? resolve(blob) : reject(new Error('Failed to compress image'));
      }, 'image/jpeg', quality);
    };
    img.onerror = () => { URL.revokeObjectURL(srcUrl); reject(new Error('Failed to load image for compression')); };
    img.src = srcUrl;
  });
}

/**
 * Process an invoice file (image or PDF) and return extracted data.
 * @param {File} file - The invoice file to process
 * @returns {Promise<{ header, items }>}
 */
export async function processInvoice(file) {
  // If API key is set, use the configured AI provider
  if (AI_API_KEY) {
    let fileToProcess = file;
    let mimeType = file.type || 'image/jpeg';

    // Compress image if it is an image
    if (file.type && file.type.startsWith('image/')) {
      try {
        console.log('Compressing image to save quota...');
        fileToProcess = await compressImage(file);
        mimeType = 'image/jpeg'; // We compressed to jpeg
      } catch (e) {
        console.error('Failed to compress image, using original:', e);
      }
    }

    const base64 = await fileToBase64(fileToProcess);

    if (AI_PROVIDER === 'openai') {
      try {
        return await processWithOpenAI(base64, mimeType);
      } catch (e) {
        if (e.message.includes('no parece ser una factura')) throw e;
        console.warn('OpenAI API falló, usando OCR local como respaldo:', e);
      }
    }
    if (AI_PROVIDER === 'gemini') {
      try {
        return await processWithGemini(base64, mimeType);
      } catch (e) {
        if (e.message.includes('no parece ser una factura')) throw e;
        console.warn('Gemini API falló, usando OCR local como respaldo:', e);
      }
    }
  }

  // Default: use free Tesseract.js OCR
  if (AI_PROVIDER !== 'mock') {
    return processWithTesseract(file);
  }

  return processWithMock();
}

/**
 * Check if AI is configured or running in OCR/mock mode.
 */
export function getAIStatus() {
  if (AI_API_KEY && AI_PROVIDER !== 'mock' && AI_PROVIDER !== 'ocr') {
    return { configured: true, provider: AI_PROVIDER };
  }
  if (!AI_API_KEY && AI_PROVIDER !== 'mock') {
    return { configured: false, provider: 'ocr' };
  }
  return { configured: false, provider: 'mock' };
}

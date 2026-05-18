/**
 * Invoice AI Processing Service
 * 
 * Processes invoice images/PDFs using AI (OpenAI Vision / Claude / Gemini)
 * to extract structured line items.
 * 
 * When no API key is configured, it uses a mock that returns realistic data
 * so the full UI flow can be tested.
 */

const AI_API_KEY = import.meta.env.VITE_AI_API_KEY || '';
const AI_PROVIDER = import.meta.env.VITE_AI_PROVIDER || 'mock'; // 'openai' | 'gemini' | 'mock'

const SYSTEM_PROMPT = `Eres un sistema de OCR inteligente para facturas mexicanas. Extrae TODOS los productos/items de la factura.

Para CADA item, devuelve:
- descripcion: nombre del producto tal como aparece en la factura
- cantidad: número de unidades
- unidad: unidad de medida (PZA, KG, M, LT, CAJA, etc.)
- precioUnitario: precio por unidad SIN IVA
- iva: monto de IVA para ese item (si no se muestra por línea, calcula 16%)

También extrae los datos del encabezado:
- folio: número de factura
- proveedor: nombre del proveedor/empresa emisora
- fecha: fecha de emisión (formato YYYY-MM-DD)
- moneda: MXN o USD

Responde SOLO en JSON válido con esta estructura exacta:
{
  "header": { "folio": "", "proveedor": "", "fecha": "", "moneda": "MXN" },
  "items": [
    { "descripcion": "", "cantidad": 0, "unidad": "PZA", "precioUnitario": 0, "iva": 0 }
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
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${AI_API_KEY}`,
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
 * Process an invoice file (image or PDF) and return extracted data.
 * @param {File} file - The invoice file to process
 * @returns {Promise<{ header, items }>}
 */
export async function processInvoice(file) {
  const provider = AI_API_KEY ? AI_PROVIDER : 'mock';

  if (provider === 'mock') {
    return processWithMock();
  }

  const base64 = await fileToBase64(file);
  const mimeType = file.type || 'image/jpeg';

  if (provider === 'openai') {
    return processWithOpenAI(base64, mimeType);
  }
  if (provider === 'gemini') {
    return processWithGemini(base64, mimeType);
  }

  return processWithMock();
}

/**
 * Check if AI is configured or running in mock mode.
 */
export function getAIStatus() {
  if (AI_API_KEY && AI_PROVIDER !== 'mock') {
    return { configured: true, provider: AI_PROVIDER };
  }
  return { configured: false, provider: 'mock' };
}

/**
 * Sube la foto/archivo de factura a Supabase Storage.
 * - Las imágenes se comprimen a máx 1200px y calidad 0.75 antes de subir.
 * - Los PDFs se suben tal cual (ya son compactos).
 * - Devuelve la URL pública del archivo subido.
 *
 * Bucket requerido en Supabase: "facturas" (público o con policy de lectura autenticada)
 */

import { supabase } from '../lib/supabase';
import { compressImage } from './invoiceAI';

const BUCKET = 'Facturas';

/**
 * Genera un nombre único para el archivo.
 * Formato: facturas/{año}/{mes}/{timestamp}-{random}.{ext}
 */
function buildPath(file) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const ts = now.getTime();
  const rand = Math.random().toString(36).slice(2, 7);
  const ext = file.type === 'application/pdf' ? 'pdf' : 'jpg';
  return `${year}/${month}/${ts}-${rand}.${ext}`;
}

/**
 * Sube la factura a Supabase Storage con compresión previa si es imagen.
 * @param {File} file
 * @returns {Promise<string>} URL pública del archivo
 */
export async function uploadFactura(file) {
  let fileToUpload = file;
  let contentType = file.type;

  // Comprimir imágenes: máx 1600px, calidad 85% (mejor calidad para auditorías)
  if (file.type.startsWith('image/')) {
    try {
      const blob = await compressImage(file, 1600, 1600, 0.85);
      fileToUpload = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' });
      contentType = 'image/jpeg';
    } catch (e) {
      console.warn('[uploadFactura] Compresión falló, usando original:', e.message);
    }
  }

  const path = buildPath(fileToUpload);

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(path, fileToUpload, {
      contentType,
      upsert: false,
    });

  if (error) throw new Error(`Error al subir factura: ${error.message}`);

  // Obtener URL pública
  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
  return urlData.publicUrl;
}

import { supabase } from '../lib/supabase';
import { compressImage } from './invoiceAI';

const BUCKET = 'productos';

/**
 * Genera un nombre único para el archivo.
 * Formato: {año}/{mes}/{timestamp}-{random}.jpg
 */
function buildPath(file) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const ts = now.getTime();
  const rand = Math.random().toString(36).slice(2, 7);
  return `${year}/${month}/${ts}-${rand}.jpg`;
}

/**
 * Sube la foto del producto a Supabase Storage con compresión previa.
 * @param {File} file
 * @returns {Promise<string>} URL pública del archivo
 */
export async function uploadProductPhoto(file) {
  let fileToUpload = file;
  let contentType = file.type;

  // Comprimir imágenes: máx 1200px, calidad 80% (buen balance tamaño/calidad)
  if (file.type.startsWith('image/')) {
    try {
      const blob = await compressImage(file, 1200, 1200, 0.80);
      fileToUpload = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' });
      contentType = 'image/jpeg';
    } catch (e) {
      console.warn('[uploadProductPhoto] Compresión falló, usando original:', e.message);
    }
  }

  const path = buildPath(fileToUpload);

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(path, fileToUpload, {
      contentType,
      upsert: false,
    });

  if (error) throw new Error(`Error al subir foto: ${error.message}`);

  // Obtener URL pública
  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
  return urlData.publicUrl;
}

import emailjs from '@emailjs/browser';

/**
 * Envía una alerta de stock crítico usando EmailJS
 * @param {string} itemName Nombre del artículo
 * @param {number} currentQty Cantidad actual
 * @param {number} threshold Límite mínimo
 */
export const sendCriticalStockAlert = async (itemName, currentQty, threshold) => {
  // Estas variables deben existir en el archivo .env
  const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
  const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
  const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

  if (!serviceId || !templateId || !publicKey) {
    console.warn('⚠️ No se envió el correo de alerta: Faltan las credenciales de EmailJS en las variables de entorno (.env).');
    return false;
  }

  try {
    const templateParams = {
      item_name: itemName,
      current_qty: currentQty,
      threshold: threshold,
      date: new Date().toLocaleString('es-MX')
    };

    const response = await emailjs.send(
      serviceId,
      templateId,
      templateParams,
      publicKey
    );

    console.log('✅ Alerta de stock crítico enviada por correo', response.status, response.text);
    return true;
  } catch (error) {
    console.error('❌ Error al enviar la alerta por correo:', error);
    return false;
  }
};

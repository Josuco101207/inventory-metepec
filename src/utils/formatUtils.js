/**
 * Parses movement details stored in the database.
 * Extracts text, factura URL, supervisor name, and whether it was an approval.
 * 
 * @param {string} details - The raw details string from the DB.
 * @returns {Object} { text, facturaUrl, supervisorName, isApproval }
 */
export const parseMovDetails = (details) => {
  if (!details) return { text: null, facturaUrl: null, supervisorName: null, isApproval: false };
  
  const urlMatch = details.match(/(?:factura_url:|factura:\s*)(https?:\/\/\S+)/i);
  const facturaUrl = urlMatch ? urlMatch[1] : null;
  
  const supervisorMatch = details.match(/autorizado_por:([^|]+)/);
  const supervisorName = supervisorMatch ? supervisorMatch[1].trim() : null;
  
  const isApproval = /approval_id:/.test(details);
  
  let text = details
    .replace(/\s*\|?\s*_originalValues:\{[^}]*\}/g, '')
    .replace(/\s*\|?\s*item_id:[\w-]+/g, '')
    .replace(/\s*\|?\s*(?:factura_url:|factura:\s*)https?:\/\/\S+/gi, '')
    .replace(/\s*\|?\s*factura_id:[\w-]+/g, '')
    .replace(/\s*\|?\s*approval_id:[\w-]+/g, '')
    .replace(/\s*\|?\s*supervisor_id:[\w-]+/g, '')
    .replace(/\s*\|?\s*autorizado_por:[^|]+/g, '');
    
  if (text.includes('Cambios:')) {
    text = text.replace(/Cambios:\s*(.*)/, (_, p1) => {
      const changes = p1.split(', ').map(c => {
        const parts = c.split(': ');
        if (parts.length === 2) {
          const vals = parts[1].split(' -> ');
          if (vals.length === 2) return `${parts[0]} de ${vals[0].replace(/"/g, '').replace(/null/g, 'nada')} a ${vals[1].replace(/"/g, '').replace(/null/g, 'nada')}`;
        }
        return c.replace(/"/g, '').replace(/null/g, 'nada');
      });
      return `Se modificó: ${changes.join(', ')}`;
    });
  }
  
  text = text.replace(/Artículo editado \(sin cambios detectados\)/, 'Se editó sin modificar valores');
  text = text.replace(/^\s*\|\s*|\s*\|\s*$/g, '').replace(/\s*\|\s*\|\s*/g, ' | ').trim() || null;
  
  return { text, facturaUrl, supervisorName, isApproval };
};

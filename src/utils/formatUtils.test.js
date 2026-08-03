import { describe, it, expect } from 'vitest';
import { parseMovDetails } from './formatUtils';

describe('formatUtils - parseMovDetails', () => {
  it('should return nulls for empty details', () => {
    const result = parseMovDetails(null);
    expect(result).toEqual({ text: null, facturaUrl: null, supervisorName: null, isApproval: false });
  });

  it('should extract facturaUrl correctly', () => {
    const result = parseMovDetails('Item added | factura_url:https://example.com/factura.pdf');
    expect(result.facturaUrl).toBe('https://example.com/factura.pdf');
    expect(result.text).toBe('Item added');
  });

  it('should extract supervisorName correctly', () => {
    const result = parseMovDetails('Item removed | autorizado_por:Juan Perez | other info');
    expect(result.supervisorName).toBe('Juan Perez');
    expect(result.text.replace(/\s+/g, '')).toBe('Itemremoved|otherinfo');
  });

  it('should detect if it is an approval', () => {
    const result = parseMovDetails('Stock check | approval_id:12345');
    expect(result.isApproval).toBe(true);
    expect(result.text).toBe('Stock check');
  });

  it('should clean up internal tags like _originalValues and item_id', () => {
    const result = parseMovDetails('Item edited | _originalValues:{"stock":10} | item_id:abc-123');
    expect(result.text).toBe('Item edited');
  });

  it('should format Cambios correctly', () => {
    const result = parseMovDetails('Cambios: stock: 10 -> 15, location: "A1" -> "B2"');
    expect(result.text).toBe('Se modificó: stock de 10 a 15, location de A1 a B2');
  });
});

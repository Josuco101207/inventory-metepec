import { describe, it, expect } from 'vitest';
import { similarity, findBestMatches, suggestCategory } from './textSimilarity';

describe('textSimilarity', () => {
  describe('similarity', () => {
    it('returns 0 if either string is empty', () => {
      expect(similarity('', 'hello')).toBe(0);
      expect(similarity('hello', null)).toBe(0);
    });

    it('returns high score for identical strings', () => {
      expect(similarity('hello', 'hello')).toBeGreaterThan(0.9);
      expect(similarity('Peluche Mario', 'peluche mario')).toBeGreaterThan(0.9);
    });

    it('handles minor typos and normalizes accents', () => {
      const score = similarity('botón rojo', 'boton rooj');
      expect(score).toBeGreaterThan(0.6);
    });

    it('detects substring matches strongly', () => {
      const score = similarity('joystick', 'joystick arcade verde');
      expect(score).toBeGreaterThanOrEqual(0.9);
    });
  });

  describe('findBestMatches', () => {
    const catalog = [
      { name: 'Cinta Canela 50mm' },
      { name: 'Cinta Adhesiva Transparente' },
      { name: 'Tinta Epson Negra' },
      { name: 'Pelota de goma' }
    ];

    it('returns exact match first', () => {
      const matches = findBestMatches('cinta canela 50mm', catalog);
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].item.name).toBe('Cinta Canela 50mm');
      expect(matches[0].isExact).toBe(true);
    });

    it('filters out results below threshold', () => {
      const matches = findBestMatches('cinta canela', catalog, 0.8);
      expect(matches.length).toBe(1);
      expect(matches[0].item.name).toBe('Cinta Canela 50mm');
    });

    it('returns empty array if nothing matches', () => {
      const matches = findBestMatches('joystick sanwa', catalog, 0.5);
      expect(matches.length).toBe(0);
    });
  });

  describe('suggestCategory', () => {
    it('suggests "Insumos y Papelería" as default', () => {
      expect(suggestCategory('objeto misterioso')).toBe('Insumos y Papelería');
    });

    it('suggests "Repuestos Arcades" for joysticks', () => {
      expect(suggestCategory('joystick sanwa JLF')).toBe('Repuestos Arcades');
    });

    it('suggests "Alimentos y Dulcería" for candy', () => {
      expect(suggestCategory('Gomitas de osito 1kg')).toBe('Alimentos y Dulcería');
    });
  });
});

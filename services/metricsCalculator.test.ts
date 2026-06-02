/**
 * Tests para calculateTotalLeadsInPipeline.
 * Uso: npx tsx services/metricsCalculator.test.ts
 */
import assert from 'node:assert/strict';
import { calculateTotalLeadsInPipeline } from './metricsCalculator.js';

// 1) Excluye "Venta Cerrada" (LeadStatus.CLOSED_WON)
{
  const counts = { 'Nuevo': 5, 'Contactado': 3, 'Venta Cerrada': 10 };
  assert.equal(calculateTotalLeadsInPipeline(counts), 8, 'debe excluir Venta Cerrada');
}

// 2) Excluye "Venta Perdida" (LeadStatus.CLOSED_LOST)
{
  const counts = { 'Nuevo': 4, 'Interesado': 2, 'Venta Perdida': 7 };
  assert.equal(calculateTotalLeadsInPipeline(counts), 6, 'debe excluir Venta Perdida');
}

// 3) Excluye ambos estados cerrados a la vez
{
  const counts = {
    'Nuevo': 10,
    'Contactado': 5,
    'Interesado': 3,
    'Venta Cerrada': 20,
    'Venta Perdida': 15,
  };
  assert.equal(calculateTotalLeadsInPipeline(counts), 18, 'debe excluir Venta Cerrada y Venta Perdida');
}

// 4) Conteos vacíos devuelven 0
{
  assert.equal(calculateTotalLeadsInPipeline({}), 0, 'pipeline vacío = 0');
}

// 5) Solo estados abiertos — los cuenta todos
{
  const counts = { 'Nuevo': 7, 'Contactado': 2, 'Interesado': 1, 'Otro': 4 };
  assert.equal(calculateTotalLeadsInPipeline(counts), 14, 'debe contar todos los estados abiertos');
}

// 6) Solo estados cerrados — devuelve 0
{
  const counts = { 'Venta Cerrada': 8, 'Venta Perdida': 3 };
  assert.equal(calculateTotalLeadsInPipeline(counts), 0, 'solo cerrados = pipeline 0');
}

console.log('✓ calculateTotalLeadsInPipeline OK');

import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidSlug, normalizePhoneE164, validateLead } from '../worker/lib/validate.js';

test('valida slug e reservados', () => {
  assert.equal(isValidSlug('ana-sousa'), true);
  assert.equal(isValidSlug('Ana Sousa'), false);
  assert.equal(isValidSlug('painel'), false);
  assert.equal(isValidSlug('ab'), false);
});

test('normaliza telefones internacionais', () => {
  for (const [input, expected] of [
    ['+55 11 99999-9999', '+5511999999999'],
    ['+351 912 345 678', '+351912345678'],
    ['+44 7700 900123', '+447700900123'],
    ['0035191234567', '+35191234567'],
  ]) assert.equal(normalizePhoneE164(input), expected);
  for (const input of ['', '912345678', '+0123', '+351abc']) assert.equal(normalizePhoneE164(input), null);
});

test('valida lead, consentimento e UTM', () => {
  const result = validateLead({
    slug: 'ana-sousa',
    intencao: 'arrendamento',
    sub_intencao: 'procuro_casa',
    nome: 'João Silva',
    email: 'joao@example.com',
    whatsapp: '+351 912 345 678',
    consent: true,
    utm: { utm_source: 'x', nope: 'descartar', utm_campaign: 'a'.repeat(120) },
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.utm, { utm_source: 'x', utm_campaign: 'a'.repeat(100) });
  assert.equal(validateLead({ ...result.value, consent: false }).ok, false);
  assert.equal(validateLead({ ...result.value, intencao: 'invalida' }).ok, false);
});

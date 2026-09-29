import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidSlug, normalizePhoneE164, validateLead } from '../worker/lib/validate.js';

const ENVIO_ID = '11111111-1111-4111-8111-111111111111';

function base(overrides = {}) {
  return {
    slug: 'ana-sousa',
    envio_id: ENVIO_ID,
    intencao: 'arrendamento',
    sub_intencao: 'procuro_casa',
    nome: 'João Silva',
    email: 'joao@example.com',
    whatsapp: '+351 912 345 678',
    consent: true,
    ...overrides,
  };
}

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
  const result = validateLead(base({
    utm: { utm_source: 'x', nope: 'descartar', utm_campaign: 'a'.repeat(120) },
  }));
  assert.equal(result.ok, true);
  assert.equal(result.value.envio_id, ENVIO_ID);
  assert.deepEqual(result.utm, { utm_source: 'x', utm_campaign: 'a'.repeat(100) });
  assert.equal(validateLead(base({ consent: false })).ok, false);
  assert.equal(validateLead(base({ intencao: 'invalida' })).ok, false);
});

test('exige envio_id UUID válido', () => {
  const missing = validateLead(base({ envio_id: undefined }));
  assert.equal(missing.ok, false);
  assert.equal(missing.erros.envio_id, 'Identificador de envio inválido.');

  const invalid = validateLead(base({ envio_id: 'nao-e-uuid' }));
  assert.equal(invalid.ok, false);
  assert.equal(invalid.erros.envio_id, 'Identificador de envio inválido.');

  const ok = validateLead(base({ envio_id: 'ABCDEF01-2345-6789-abcd-ef0123456789' }));
  assert.equal(ok.ok, true);
  assert.equal(ok.value.envio_id, 'abcdef01-2345-6789-abcd-ef0123456789');
});

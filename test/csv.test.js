import test from 'node:test';
import assert from 'node:assert/strict';
import { leadsToCsv } from '../worker/lib/csv.js';

test('gera CSV UTF-8 com BOM, separador, aspas e fórmula neutralizada', () => {
  const csv = leadsToCsv([{
    created_at: '2026-09-30T10:00:00.000Z',
    nome: '=João',
    email: 'joao@example.com',
    whatsapp_e164: '+351912345678',
    intencao: 'arrendamento',
    sub_intencao: 'Procuro; casa',
    status: 'novo',
    mensagem: 'Disse "olá"',
  }]);
  assert.equal(csv.charCodeAt(0), 0xfeff);
  assert.match(csv, /data;nome;email;whatsapp;intencao;detalhe;status;mensagem/);
  assert.match(csv, /"'=?João"|"'=João"/);
  assert.match(csv, /"Procuro; casa"/);
  assert.match(csv, /"Disse ""olá"""/);
  assert.match(csv, /\r\n$/);
});

test('neutraliza todos os prefixos de fórmula e aceita lista vazia', () => {
  const csv = leadsToCsv([
    { nome: '+soma' },
    { nome: '-conta' },
    { nome: '@referência' },
  ], new Map());
  assert.match(csv, /"'\+soma"/);
  assert.match(csv, /"'-conta"/);
  assert.match(csv, /"'@referência"/);
  assert.equal(leadsToCsv([]), '\ufeffdata;nome;email;whatsapp;intencao;detalhe;status;mensagem\r\n');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { escapeAttr, escapeHtml, safeUrl, vcardEscape } from '../worker/lib/escape.js';

test('escapa HTML e atributos', () => {
  assert.equal(escapeHtml('<script>"&'), '&lt;script&gt;&quot;&amp;');
  assert.equal(escapeAttr('a"b&c'), 'a&quot;b&amp;c');
  assert.equal(vcardEscape('a,b;c\\nd'), 'a\\,b\\;c\\\\nd');
});

test('safeUrl recusa esquemas perigosos', () => {
  assert.equal(safeUrl('javascript:alert(1)'), null);
  assert.equal(safeUrl('data:text/html,hi'), null);
  assert.equal(safeUrl(' JaVaScRiPt:alert(1)'), null);
  assert.equal(safeUrl('https://example.com'), 'https://example.com');
});

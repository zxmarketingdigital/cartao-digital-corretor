#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  RESERVED_SLUGS,
  isValidEmail,
  isValidSlug,
  normalizePhoneE164,
} from '../../../../worker/lib/validate.js';

export { normalizePhoneE164 };

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(SCRIPT_PATH);
const SLUG_PATTERN = /^[a-z0-9-]{3,40}$/;
const PHONE_FIELDS = new Set([
  'telefone_e164',
  'whatsapp_e164',
  'notify_whatsapp_e164',
]);

// Estas são as colunas de cards que a skill pode escrever. Identificadores e
// timestamps ficam fora para impedir que a CLI altere metadados do banco.
export const CARD_FIELDS = Object.freeze([
  'slug', 'status', 'nome', 'cargo', 'agencia', 'ami', 'bio', 'foto_url',
  'telefone_e164', 'whatsapp_e164', 'email', 'morada', 'maps_url', 'instagram',
  'facebook', 'tiktok', 'linkedin', 'site', 'reviews_url', 'agenda_url',
  'servicos', 'links', 'notify_email', 'notify_whatsapp_e164', 'chat_enabled',
  'locale', 'owner_user_id', 'order_id',
]);

const CARD_FIELD_SET = new Set(CARD_FIELDS);
const DANGEROUS_FIELDS = new Set([
  'id', 'created_at', 'updated_at', 'deleted_at', 'consent_at',
]);
const COMMANDS = new Set(['criar', 'editar', 'ver', 'listar', 'suspender', 'ativar']);

export class CartaoError extends Error {
  constructor(message, code = 'erro') {
    super(message);
    this.name = 'CartaoError';
    this.code = code;
  }
}

function findRepoRoot(startDir = SCRIPT_DIR) {
  let current = path.resolve(startDir);
  while (true) {
    if (fs.existsSync(path.join(current, 'package.json'))) return current;
    const parent = path.dirname(current);
    if (parent === current) {
      throw new CartaoError('Não foi possível localizar a raiz do repositório.', 'config');
    }
    current = parent;
  }
}

function stripInlineComment(value) {
  let quote = null;
  for (let i = 0; i < value.length; i += 1) {
    const char = value[i];
    if ((char === '"' || char === "'") && value[i - 1] !== '\\') {
      quote = quote === char ? null : (quote || char);
    } else if (char === '#' && !quote && (i === 0 || /\s/.test(value[i - 1]))) {
      return value.slice(0, i).trimEnd();
    }
  }
  return value.trim();
}

function unquoteEnvValue(value) {
  const trimmed = stripInlineComment(value).trim();
  if (trimmed.length >= 2) {
    const first = trimmed[0];
    const last = trimmed.at(-1);
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      const inner = trimmed.slice(1, -1);
      return first === '"' ? inner.replace(/\\([\\"nrt])/g, (_, char) => ({
        '\\': '\\', '"': '"', n: '\n', r: '\r', t: '\t',
      }[char])) : inner;
    }
  }
  return trimmed;
}

export function parseDotEnv(contents) {
  const values = {};
  for (const rawLine of String(contents).split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    values[match[1]] = unquoteEnvValue(match[2]);
  }
  return values;
}

export function loadEnv({ rootDir = findRepoRoot(), environ = process.env } = {}) {
  const envPath = path.join(rootDir, '.env');
  let fileValues = {};
  try {
    fileValues = parseDotEnv(fs.readFileSync(envPath, 'utf8'));
  } catch (error) {
    if (error?.code !== 'ENOENT') throw new CartaoError('Não foi possível ler o .env.', 'config');
  }
  // Variáveis já exportadas podem substituir o arquivo sem obrigar a gravar
  // credenciais no disco; os valores nunca são incluídos em erros ou saídas.
  return { ...fileValues, ...environ };
}

function requireConfig(env) {
  const base = String(env.SUPABASE_URL || '').trim().replace(/\/$/, '');
  const key = String(env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!base || !key) throw new CartaoError(
    'Configuração incompleta: defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.',
    'config',
  );
  let parsed;
  try {
    parsed = new URL(base);
  } catch {
    throw new CartaoError('SUPABASE_URL inválida no .env.', 'config');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new CartaoError('SUPABASE_URL inválida no .env.', 'config');
  }
  return { base, key };
}

function authHeaders(key, extra = {}) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'content-type': 'application/json',
    ...extra,
  };
}

async function responseJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function request({ env, fetchImpl = globalThis.fetch, pathname, method = 'GET', body, headers = {} }) {
  const { base, key } = requireConfig(env);
  let response;
  try {
    response = await fetchImpl(`${base}${pathname}`, {
      method,
      headers: authHeaders(key, headers),
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    throw new CartaoError('Não foi possível comunicar com o Supabase.', 'rede');
  }
  const data = await responseJson(response);
  if (!response.ok) {
    const error = new CartaoError(`Supabase recusou a operação (HTTP ${response.status}).`, 'http');
    error.status = response.status;
    throw error;
  }
  return data;
}

function requireSlug(value) {
  const slug = typeof value === 'string' ? value.trim() : '';
  // isValidSlug é a fonte única da regex e da lista RESERVED_SLUGS. O teste
  // explícito mantém a mensagem clara e garante que a forma do contrato não
  // seja alargada acidentalmente nesta CLI.
  if (!SLUG_PATTERN.test(slug) || !isValidSlug(slug) || RESERVED_SLUGS.has(slug)) {
    throw new CartaoError('Slug inválido ou reservado.', 'validacao');
  }
  return slug;
}

function normalizePhoneField(field, value) {
  if (value === null || value === undefined || value === '') return null;
  const normalized = normalizePhoneE164(String(value));
  if (!normalized) throw new CartaoError(`Telefone inválido no campo ${field}.`, 'validacao');
  return normalized;
}

function coerceValue(field, value) {
  if (PHONE_FIELDS.has(field)) return normalizePhoneField(field, value);
  if (field === 'slug') return requireSlug(value);
  if (field === 'email' || field === 'notify_email') {
    if (value === null || value === undefined || value === '') return null;
    const email = String(value).trim();
    if (!isValidEmail(email)) throw new CartaoError(`E-mail inválido no campo ${field}.`, 'validacao');
    return email;
  }
  if (field === 'status' && !['ativo', 'suspenso'].includes(String(value))) {
    throw new CartaoError('status deve ser ativo ou suspenso.', 'validacao');
  }
  if (field === 'locale' && !['pt-PT', 'pt-BR'].includes(String(value))) {
    throw new CartaoError('locale deve ser pt-PT ou pt-BR.', 'validacao');
  }
  if (field === 'chat_enabled') {
    if (typeof value === 'boolean') return value;
    if (value === 'true' || value === '1') return true;
    if (value === 'false' || value === '0') return false;
    throw new CartaoError('chat_enabled deve ser true ou false.', 'validacao');
  }
  if (field === 'servicos' || field === 'links') {
    if (!Array.isArray(value)) throw new CartaoError(`${field} deve ser uma lista JSON.`, 'validacao');
    return value;
  }
  return value;
}

export function parseFieldValue(field, raw) {
  if (typeof raw !== 'string') return coerceValue(field, raw);
  const value = raw.trim();
  if ((value.startsWith('[') && value.endsWith(']'))
    || (value.startsWith('{') && value.endsWith('}'))
    || value === 'null' || value === 'true' || value === 'false') {
    try {
      return coerceValue(field, JSON.parse(value));
    } catch (error) {
      if (error instanceof CartaoError) throw error;
      throw new CartaoError(`Valor inválido no campo ${field}.`, 'validacao');
    }
  }
  return coerceValue(field, raw);
}

export function sanitizeCardInput(input, { allowSlug = true } = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new CartaoError('Os dados do cartão devem ser um objeto JSON.', 'validacao');
  }
  const result = {};
  for (const [rawField, rawValue] of Object.entries(input)) {
    const field = rawField.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
    const canonical = field.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`);
    if (DANGEROUS_FIELDS.has(rawField) || DANGEROUS_FIELDS.has(canonical)) {
      throw new CartaoError(`Campo não permitido: ${rawField}.`, 'validacao');
    }
    const name = CARD_FIELD_SET.has(rawField) ? rawField : canonical;
    if (!CARD_FIELD_SET.has(name) || (!allowSlug && name === 'slug')) {
      throw new CartaoError(`Campo não permitido: ${rawField}.`, 'validacao');
    }
    result[name] = coerceValue(name, rawValue);
  }
  if (result.slug !== undefined) result.slug = requireSlug(result.slug);
  if (result.nome !== undefined && (typeof result.nome !== 'string' || !result.nome.trim())) {
    throw new CartaoError('nome é obrigatório e não pode ficar vazio.', 'validacao');
  }
  return result;
}

function rowsOrObject(data) {
  if (Array.isArray(data)) return data;
  return data == null ? [] : [data];
}

function firstRow(data) {
  return Array.isArray(data) ? (data[0] || null) : data;
}

export function cardUrl(env, slug) {
  const base = String(env.PUBLIC_BASE_URL || '').trim().replace(/\/$/, '');
  return `${base}/c/${slug}`;
}

export async function createOwnerUser(email, { env, fetchImpl = globalThis.fetch } = {}) {
  if (!isValidEmail(email)) throw new CartaoError('E-mail do dono inválido.', 'validacao');
  const { base, key } = requireConfig(env);
  let response;
  try {
    response = await fetchImpl(`${base}/auth/v1/admin/users`, {
      method: 'POST',
      headers: authHeaders(key),
      body: JSON.stringify({ email, email_confirm: true }),
    });
  } catch {
    throw new CartaoError('Não foi possível comunicar com o Supabase Auth.', 'rede');
  }
  const created = await responseJson(response);
  if (response.ok && (created?.id || created?.user?.id)) return created.id || created.user.id;
  if (!response.ok && ![400, 409, 422].includes(response.status)) {
    throw new CartaoError(`Supabase recusou a criação do utilizador (HTTP ${response.status}).`, 'http');
  }

  const found = await request({
    env,
    fetchImpl,
    pathname: '/rest/v1/rpc/user_id_by_email',
    method: 'POST',
    body: { p_email: email },
  });
  const value = Array.isArray(found) ? found[0] : found;
  const id = typeof value === 'string' ? value : value?.user_id || value?.id;
  if (!id) throw new CartaoError('Não foi possível obter o utilizador do dono.', 'dados');
  return id;
}

export async function createCard(input, { env, fetchImpl = globalThis.fetch, emailDono } = {}) {
  const data = sanitizeCardInput(input);
  if (!data.slug) throw new CartaoError('slug é obrigatório.', 'validacao');
  if (!data.nome) throw new CartaoError('nome é obrigatório.', 'validacao');
  if (emailDono) data.owner_user_id = await createOwnerUser(emailDono, { env, fetchImpl });
  if (data.status === undefined) data.status = 'ativo';
  if (data.chat_enabled === undefined) data.chat_enabled = true;
  if (data.locale === undefined) data.locale = 'pt-PT';
  if (data.servicos === undefined) data.servicos = [];
  if (data.links === undefined) data.links = [];
  const response = await request({
    env, fetchImpl, pathname: '/rest/v1/cards', method: 'POST', body: data,
    headers: { Prefer: 'return=representation' },
  });
  const card = firstRow(response);
  return { ok: true, card, url: cardUrl(env, data.slug) };
}

export async function getCard(slug, { env, fetchImpl = globalThis.fetch } = {}) {
  const validSlug = requireSlug(slug);
  const data = await request({
    env, fetchImpl,
    pathname: `/rest/v1/cards?slug=eq.${encodeURIComponent(validSlug)}&select=*&limit=1`,
  });
  return firstRow(data);
}

export async function listCards({ env, fetchImpl = globalThis.fetch } = {}) {
  const data = await request({
    env, fetchImpl,
    pathname: '/rest/v1/cards?select=*&order=created_at.desc',
  });
  return rowsOrObject(data);
}

export async function editCard(slug, changes, { env, fetchImpl = globalThis.fetch } = {}) {
  const validSlug = requireSlug(slug);
  const data = sanitizeCardInput(changes, { allowSlug: false });
  if (!Object.keys(data).length) throw new CartaoError('Indique pelo menos um campo para editar.', 'validacao');
  delete data.status;
  const response = await request({
    env, fetchImpl,
    pathname: `/rest/v1/cards?slug=eq.${encodeURIComponent(validSlug)}`,
    method: 'PATCH', body: data,
    headers: { Prefer: 'return=representation' },
  });
  const card = firstRow(response);
  if (!card) throw new CartaoError('Cartão não encontrado.', 'nao_encontrado');
  return { ok: true, card, url: cardUrl(env, validSlug) };
}

export async function setCardStatus(slug, status, { env, fetchImpl = globalThis.fetch } = {}) {
  const validSlug = requireSlug(slug);
  const response = await request({
    env, fetchImpl,
    pathname: `/rest/v1/cards?slug=eq.${encodeURIComponent(validSlug)}`,
    method: 'PATCH', body: { status },
    headers: { Prefer: 'return=representation' },
  });
  const card = firstRow(response);
  if (!card) throw new CartaoError('Cartão não encontrado.', 'nao_encontrado');
  return { ok: true, card, url: cardUrl(env, validSlug) };
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  if (!command || command === '--help' || command === '-h') return { help: true };
  if (!COMMANDS.has(command)) throw new CartaoError(`Subcomando desconhecido: ${command}.`, 'uso');
  const args = { command, fields: {} };
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (arg === '--json') {
      args.json = rest[++i];
    } else if (arg === '--slug') {
      args.slug = rest[++i];
    } else if (arg === '--email-dono') {
      args.emailDono = rest[++i];
    } else if (arg === '--campo') {
      const assignment = rest[++i];
      if (!assignment) throw new CartaoError('--campo exige campo=valor.', 'uso');
      const separator = assignment.indexOf('=');
      if (separator >= 1) {
        args.fields[assignment.slice(0, separator)] = assignment.slice(separator + 1);
      } else {
        const value = rest[++i];
        if (value === undefined || value.startsWith('--')) {
          throw new CartaoError('--campo deve usar campo=valor ou --campo nome valor.', 'uso');
        }
        args.fields[assignment] = value;
      }
    } else if (arg.startsWith('--') && arg.length > 2) {
      const rawField = arg.slice(2);
      const field = rawField.replace(/-([a-z])/g, (_, char) => char.toUpperCase())
        .replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`);
      if (!CARD_FIELD_SET.has(field)) throw new CartaoError(`Campo não permitido: ${rawField}.`, 'validacao');
      args.fields[field] = rest[++i];
    } else {
      throw new CartaoError(`Argumento desconhecido: ${arg}.`, 'uso');
    }
  }
  return args;
}

function readJsonFile(fileName, rootDir) {
  const filePath = path.resolve(process.cwd(), fileName);
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    throw new CartaoError('Não foi possível ler o JSON indicado.', 'dados');
  }
}

function mergeCliFields(json, fields, { allowSlug = true } = {}) {
  const parsed = { ...(json || {}) };
  for (const [rawField, rawValue] of Object.entries(fields)) {
    const field = rawField.replace(/-([a-z])/g, (_, char) => char.toUpperCase())
      .replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`);
    if (!CARD_FIELD_SET.has(field)) throw new CartaoError(`Campo não permitido: ${rawField}.`, 'validacao');
    parsed[field] = parseFieldValue(field, rawValue);
  }
  return sanitizeCardInput(parsed, { allowSlug });
}

export function helpText() {
  return [
    'Uso: node .claude/skills/criar-cartao-visita/scripts/cartao.mjs <subcomando> [opções]',
    '',
    'Subcomandos: criar, editar, ver, listar, suspender, ativar',
    'criar --json arquivo.json [--email-dono email] [--campo campo=valor]',
    'editar --slug slug --campo campo=valor',
    'ver|suspender|ativar --slug slug',
    'As credenciais são lidas exclusivamente do .env da raiz do repositório.',
  ].join('\n');
}

export async function run(argv = process.argv.slice(2), options = {}) {
  const args = parseArgs(argv);
  if (args.help) return { help: helpText() };
  const rootDir = options.rootDir || findRepoRoot();
  const env = options.env || loadEnv({ rootDir, environ: options.environ || process.env });
  const fetchImpl = options.fetchImpl || globalThis.fetch;

  if (args.command === 'criar') {
    const json = args.json ? readJsonFile(args.json, rootDir) : {};
    const fields = { ...args.fields };
    if (args.slug !== undefined) fields.slug = args.slug;
    return createCard(mergeCliFields(json, fields), { env, fetchImpl, emailDono: args.emailDono });
  }
  if (args.command === 'listar') return { ok: true, cards: await listCards({ env, fetchImpl }) };
  if (!args.slug) throw new CartaoError('--slug é obrigatório.', 'uso');
  if (args.command === 'ver') return { ok: true, card: await getCard(args.slug, { env, fetchImpl }) };
  if (args.command === 'editar') {
    return editCard(args.slug, mergeCliFields({}, args.fields, { allowSlug: false }), { env, fetchImpl });
  }
  if (Object.keys(args.fields).length) throw new CartaoError('Este subcomando não aceita campos.', 'uso');
  return setCardStatus(args.slug, args.command === 'suspender' ? 'suspenso' : 'ativo', { env, fetchImpl });
}

export function isMain(moduleUrl = import.meta.url, argvPath = process.argv[1]) {
  return Boolean(argvPath) && pathToFileURL(path.resolve(argvPath)).href === moduleUrl;
}

if (isMain()) {
  run().then((result) => {
    if (result.help) console.log(result.help);
    else console.log(JSON.stringify(result));
  }).catch((error) => {
    const message = error instanceof CartaoError ? error.message : 'Falha inesperada na operação.';
    console.error(`Erro: ${message}`);
    process.exitCode = 1;
  });
}

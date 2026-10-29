'use strict';

// Server-only photo estimate function. It accepts neither provider URLs nor
// secrets from the browser, and never logs or persists descriptions or photos.
const SB_URL = 'https://jvmvzfshgcekwocffdtv.supabase.co';
const SB_KEY = 'sb_publishable_vhNt3ZJkdWyyITrVwx3x4Q_leYix_Gq';
const cloudflare = require('./crm-quote-cloudflare');
const MAX_BODY_BYTES = 3_200_000;
const MAX_PHOTO_BYTES = 750_000;
const MAX_PHOTOS = 3;
const MAX_RATES = 50;
const MAX_ANSWERS = 18;
const MAX_PRICE_CENTS = 99_999_999_999;

class QuoteError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const reject = (status, message) => { throw new QuoteError(status, message); };
const keysAre = (o, keys) => o && typeof o === 'object' && !Array.isArray(o) &&
  Object.keys(o).length === keys.length && keys.every(k => Object.prototype.hasOwnProperty.call(o, k));
const singleLine = (s, max) => typeof s === 'string' && !!s.trim() && s.length <= max && !/[\x00-\x1f\x7f]/.test(s);

function jsonResponse(res, status, data) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Vary', 'Authorization');
  return res.status(status).json(data);
}

async function authenticate(req, fetchFn) {
  const match = /^Bearer ([A-Za-z0-9._~-]{1,8192})$/.exec(String(req.headers.authorization || ''));
  if (!match) reject(401, 'Sign in to the CRM before using photo estimates.');
  let response;
  try {
    response = await fetchFn(SB_URL + '/auth/v1/user', {
      method: 'GET', headers: { apikey: SB_KEY, Authorization: 'Bearer ' + match[1] },
      cache: 'no-store', signal: AbortSignal.timeout(7000),
    });
  } catch (_) { reject(503, 'Could not verify your CRM session. Check your connection and try again.'); }
  if (!response || !response.ok) {
    if (response && [400, 401, 403].includes(response.status)) reject(401, 'Your CRM session expired. Sign in again.');
    reject(503, 'Could not verify your CRM session. Try again.');
  }
  let user;
  try { user = await response.json(); } catch (_) { reject(503, 'Could not verify your CRM session. Try again.'); }
  if (!user || typeof user.id !== 'string' || !user.id || user.role !== 'authenticated' ||
      user.aud !== 'authenticated' || user.is_anonymous === true) {
    reject(401, 'Sign in to the CRM before using photo estimates.');
  }
}

function readBody(req) {
  const length = Number(req.headers['content-length']);
  if (Number.isFinite(length) && length > MAX_BODY_BYTES) reject(413, 'Photos are too large. Choose smaller photos.');
  let body = req.body;
  try {
    const raw = typeof body === 'string' ? body : JSON.stringify(body);
    if (typeof raw !== 'string') reject(400, 'Invalid request.');
    if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) reject(413, 'Photos are too large. Choose smaller photos.');
    if (typeof body === 'string') body = JSON.parse(body);
  } catch (e) {
    if (e instanceof QuoteError) throw e;
    reject(400, 'Invalid JSON request.');
  }
  if (!keysAre(body, ['consent', 'service', 'description', 'photos', 'rates', 'answers', 'extra'])) reject(400, 'Invalid photo estimate request.');
  if (body.consent !== true) reject(400, 'Agree to the Cloudflare photo disclosure before generating.');
  if (!singleLine(body.service, 100)) reject(400, 'Choose a service.');
  if (typeof body.description !== 'string' || body.description.trim().length < 5 || body.description.length > 2000 ||
      /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(body.description)) reject(400, 'Enter a work description of 5 to 2,000 characters.');
  if (!Array.isArray(body.photos) || body.photos.length < 1 || body.photos.length > MAX_PHOTOS) reject(400, 'Choose 1 to 3 photos.');
  const photos = body.photos.map(photo => {
    if (typeof photo !== 'string' || photo.length > Math.ceil(MAX_PHOTO_BYTES / 3) * 4 + 23) reject(400, 'A photo is too large. Choose a smaller photo.');
    const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/.exec(photo);
    if (!match) reject(400, 'Each prepared photo must be a JPEG.');
    const bytes = Buffer.from(match[1], 'base64');
    if (bytes.length < 4 || bytes.length > MAX_PHOTO_BYTES || bytes.toString('base64') !== match[1] ||
        bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff || bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== 0xd9) {
      reject(400, 'A prepared photo is invalid or too large.');
    }
    return photo;
  });
  if (!Array.isArray(body.rates) || body.rates.length > MAX_RATES) reject(400, 'Use no more than 50 rate names.');
  const ids = new Set();
  const rates = body.rates.map(rate => {
    if (!keysAre(rate, ['id', 'name']) || !Number.isInteger(rate.id) || rate.id < 0 || rate.id >= MAX_RATES ||
        ids.has(rate.id) || !singleLine(rate.name, 200) || /\|/.test(rate.name)) reject(400, 'A rate name is invalid. Review the rate card.');
    ids.add(rate.id);
    return { id: rate.id, name: rate.name.trim() };
  });
  if (!Array.isArray(body.answers) || body.answers.length > MAX_ANSWERS) reject(400, 'Use no more than 18 answers.');
  const questions = new Set();
  const answers = body.answers.map(item => {
    if (!keysAre(item, ['question', 'answer']) || !singleLine(item.question, 250) ||
        typeof item.answer !== 'string' || !item.answer.trim() || item.answer.length > 500 ||
        /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(item.answer)) reject(400, 'An answer is invalid or too long.');
    const question = item.question.trim(), key = question.toLowerCase();
    if (questions.has(key)) reject(400, 'Answer each question only once.');
    questions.add(key);
    return { question, answer: item.answer.trim() };
  });
  if (typeof body.extra !== 'string' || body.extra.length > 1000 ||
      /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(body.extra)) reject(400, 'Additional details are invalid or too long.');
  return { service: body.service.trim(), description: body.description.trim(), photos, rates, answers, extra: body.extra.trim() };
}

const RESPONSE_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    summary: { type: 'string' },
    ballpark: { type: 'object', additionalProperties: false, properties: {
      low: { type: ['string', 'number', 'null'] }, high: { type: ['string', 'number', 'null'] }, basis: { type: 'string' },
    }, required: ['low', 'high', 'basis'] },
    lines: { type: 'array', items: {
      type: 'object', additionalProperties: false,
      properties: {
        description: { type: 'string' }, quantity: { type: ['string', 'null'] },
        rate_id: { type: ['integer', 'null'] }, basis: { type: 'string' },
      },
      required: ['description', 'quantity', 'rate_id', 'basis'],
    } },
    questions: { type: 'array', items: { type: 'string' } },
    cautions: { type: 'array', items: { type: 'string' } },
  },
  required: ['summary', 'ballpark', 'lines', 'questions', 'cautions'],
};

// The model's prices are unverified guesses, never the company's rate card.
// Convert accepted decimal strings/numbers to cents without floating-point math.
function priceCents(value, fail) {
  if (!(typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value)))) fail();
  const text = String(value).trim();
  if (!/^\$?(?:(?:\d{1,9}|\d{1,3}(?:,\d{3}){1,2})(?:\.\d{1,2})?|\.\d{1,2})$/.test(text)) fail();
  const [dollars, fraction = ''] = text.replace(/^\$/, '').replace(/,/g, '').split('.');
  const cents = Number(dollars || '0') * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents) || cents > MAX_PRICE_CENTS) fail();
  return cents;
}
const centsText = cents => String(Math.floor(cents / 100)) + '.' + String(cents % 100).padStart(2, '0');

function cleanResult(draft, rates, suppliedDetails) {
  const fail = () => reject(502, 'Cloudflare returned an incomplete draft. No estimate was saved.');
  const hasBallpark = draft && Object.prototype.hasOwnProperty.call(draft, 'ballpark');
  if (!(keysAre(draft, ['summary', 'ballpark', 'lines', 'questions', 'cautions']) ||
        keysAre(draft, ['summary', 'lines', 'questions', 'cautions'])) || !singleLine(draft.summary, 800) ||
      !Array.isArray(draft.lines) || draft.lines.length < 1 || draft.lines.length > 8 ||
      !Array.isArray(draft.questions) || draft.questions.length > 6 ||
      !Array.isArray(draft.cautions) || draft.cautions.length > 6 ||
      !draft.questions.every(x => singleLine(x, 250)) || !draft.cautions.every(x => singleLine(x, 250))) fail();
  // Match only text actually supplied by the person, not model-generated
  // questions. Even a matching number may have the wrong unit or meaning.
  const describedNumbers = new Set((suppliedDetails.match(/(?:\d+(?:\.\d+)?|\.\d+)/g) || []).map(Number));
  const safeNarrative = (text, fallback) => {
    const numbers = text.match(/(?:\d+(?:\.\d+)?|\.\d+)/g) || [];
    return numbers.some(number => !describedNumbers.has(Number(number))) ? fallback : text.trim();
  };
  // A malformed or omitted price must never become a fake amount. Preserve an
  // otherwise valid draft and its questions so the user can add details.
  let ballpark = { low: null, high: null, basis: 'The AI did not provide a valid total price. Add details or enter a price manually.' };
  const b = hasBallpark && draft.ballpark;
  if (keysAre(b, ['low', 'high', 'basis']) && singleLine(b.basis, 250) && ((b.low === null) === (b.high === null))) {
    const priceBasis = safeNarrative(b.basis, 'Price basis included unconfirmed numbers; verify the work and pricing.');
    if (b.low === null) ballpark = { low: null, high: null, basis: priceBasis };
    else {
      try {
        const invalidPrice = () => { throw new Error('invalid price'); };
        const low = priceCents(b.low, invalidPrice), high = priceCents(b.high, invalidPrice);
        if (low > high || high === 0) invalidPrice();
        ballpark = { low: centsText(low), high: centsText(high), basis: priceBasis };
      } catch (_) { /* Keep the range unavailable; do not guess or retry. */ }
    }
  }
  const ids = new Set(rates.map(rate => rate.id));
  const lines = draft.lines.map((line, index) => {
    if (!keysAre(line, ['description', 'quantity', 'rate_id', 'basis']) || !singleLine(line.description, 200) ||
        /[|$€£]/.test(line.description) || /\bUSD\b/i.test(line.description) || !singleLine(line.basis, 250) ||
        !(line.rate_id === null || (Number.isInteger(line.rate_id) && ids.has(line.rate_id)))) fail();
    if (line.quantity !== null && (typeof line.quantity !== 'string' ||
        !/^(?:\d{1,9}(?:\.\d{1,3})?|\.\d{1,3})$/.test(line.quantity) || Number(line.quantity) <= 0)) fail();
    const unconfirmed = line.quantity !== null && !describedNumbers.has(Number(line.quantity));
    const description = safeNarrative(line.description, `Work item ${index + 1} — verify details`);
    const scopeUnconfirmed = description !== line.description.trim();
    return { description, quantity: unconfirmed || scopeUnconfirmed ? null : line.quantity, rate_id: scopeUnconfirmed ? null : line.rate_id,
      basis: scopeUnconfirmed ? 'Unconfirmed numerical details were omitted; verify the scope and price.' :
        unconfirmed ? 'Quantity was not confirmed in your description or answers; measure or enter it manually.' : safeNarrative(line.basis, 'Numerical details were not provided; verify the scope and measurements.') };
  });
  return { summary: safeNarrative(draft.summary, 'Review the suggested work and confirm missing details.'), ballpark, lines,
    questions: draft.questions.map(x => x.trim()), cautions: draft.cautions.map(x => safeNarrative(x, 'Review unconfirmed details and possible conditions.')) };
}

function createHandler(options = {}) {
  const env = options.env || process.env;
  const fetchFn = options.fetch || globalThis.fetch;
  return async function handler(req, res) {
    let providerAttempted = false;
    try {
      if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); reject(405, 'Use POST for photo estimates.'); }
      if (!/^application\/json(?:\s*;|\s*$)/i.test(String(req.headers['content-type'] || ''))) reject(415, 'Use a JSON request.');
      await authenticate(req, fetchFn);
      const input = readBody(req);
      const account = cloudflare.configuredAccount(env);
      if (!account) reject(503, 'Photo estimates are not enabled yet. Ask the administrator to finish Cloudflare Free setup.');
      let response;
      try {
        providerAttempted = true;
        response = await fetchFn(cloudflare.endpoint(account.accountId), {
          method: 'POST', headers: { Authorization: 'Bearer ' + account.token, 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(cloudflare.buildRequest(input, RESPONSE_SCHEMA)), cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(40000),
        });
      } catch (_) { reject(503, 'Could not confirm the Cloudflare request. It may have used some daily allowance; check usage before trying again.'); }
      if (!response || !response.ok) {
        if (response && response.status === 429) reject(429, 'Cloudflare is busy or its daily allowance or rate limit was reached. Check Workers AI usage and try later.');
        if (response && [401, 403].includes(response.status)) reject(503, 'Photo estimates are not configured correctly. Check the Cloudflare Free setup.');
        if (response && [400, 422].includes(response.status)) reject(422, 'Cloudflare could not process this request. No estimate was saved.');
        reject(503, 'Cloudflare is temporarily unavailable. Check Workers AI usage before trying again.');
      }
      let data, draft;
      try { data = await response.json(); } catch (_) { reject(502, 'Cloudflare returned an unreadable draft. No estimate was saved.'); }
      try { draft = cloudflare.extractDraft(data); }
      catch (e) {
        if (e && e.code === 'refused') reject(422, 'Cloudflare could not prepare a draft for these photos. No estimate was saved.');
        reject(502, 'Cloudflare did not return a complete draft. No estimate was saved.');
      }
      const suppliedDetails = [input.description, ...input.answers.map(item => item.answer), input.extra].join('\n');
      return jsonResponse(res, 200, { draft: cleanResult(draft, input.rates, suppliedDetails) });
    } catch (e) {
      const safe = e instanceof QuoteError ? e : new QuoteError(500, 'Could not prepare a photo estimate. No estimate was saved.');
      return jsonResponse(res, safe.status, { error: safe.message, providerAttempted });
    }
  };
}

module.exports = { createHandler };

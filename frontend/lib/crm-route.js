'use strict';

// This module is used only by the server-side Vercel function. It never accepts
// provider URLs or API keys from the browser and does not log request bodies.
const SB_URL = 'https://jvmvzfshgcekwocffdtv.supabase.co';
const SB_KEY = 'sb_publishable_vhNt3ZJkdWyyITrVwx3x4Q_leYix_Gq';
const GEOCODIO_URL = 'https://api.geocod.io/v2/geocode?limit=3';
const ROUTING_URL = 'https://api.simplerouting.io/vroom/';
const MAX_STOPS = 100;
const MAX_ADDRESSES = MAX_STOPS + 1; // Each stop plus an optional start.
const MAX_BODY_BYTES = 64 * 1024;

class RouteError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const reject = (status, message) => { throw new RouteError(status, message); };
const point = p => Array.isArray(p) && p.length === 2 &&
  p.every(n => typeof n === 'number' && Number.isFinite(n)) &&
  Math.abs(p[0]) <= 90 && Math.abs(p[1]) <= 180;
const longitudeFirst = p => [p[1], p[0]];
const keysAre = (o, allowed) => o && typeof o === 'object' && !Array.isArray(o) &&
  Object.keys(o).every(k => allowed.includes(k));

function jsonResponse(res, status, data) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Vary', 'Authorization');
  res.status(status).json(data);
}

function readBody(req) {
  const length = Number(req.headers['content-length']);
  if (Number.isFinite(length) && length > MAX_BODY_BYTES) reject(413, 'Request is too large.');
  let body = req.body;
  try {
    const raw = typeof body === 'string' ? body : JSON.stringify(body);
    if (typeof raw !== 'string') reject(400, 'Invalid request.');
    if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) reject(413, 'Request is too large.');
    if (typeof body === 'string') body = JSON.parse(body);
  } catch (e) {
    if (e instanceof RouteError) throw e;
    reject(400, 'Invalid JSON request.');
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) reject(400, 'Invalid request.');
  return body;
}

async function authenticate(req, fetchFn) {
  const auth = String(req.headers.authorization || '');
  const match = /^Bearer ([A-Za-z0-9._~-]{1,8192})$/.exec(auth);
  if (!match) reject(401, 'Sign in to the CRM before routing.');
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
    reject(401, 'Sign in to the CRM before routing.');
  }
}

async function providerJson(fetchFn, url, key, body, provider) {
  let response;
  try {
    response = await fetchFn(url, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body), cache: 'no-store', signal: AbortSignal.timeout(25000),
    });
  } catch (_) { reject(503, 'Could not reach ' + provider + '. Please try again.'); }
  if (!response || !response.ok) {
    if (response && response.status === 429) reject(429, provider + ' has reached a rate or daily limit. Try again later.');
    if (response && [401, 403].includes(response.status)) reject(503, provider + ' is not configured correctly. Check its server-side API key.');
    if (response && [400, 422].includes(response.status)) reject(422, provider + ' could not process these locations. Check them and try again.');
    reject(503, provider + ' is temporarily unavailable. Try again later.');
  }
  try { return await response.json(); } catch (_) { reject(502, provider + ' returned an unreadable response. No route was changed.'); }
}

function geocodeInput(body) {
  if (!keysAre(body, ['action', 'addresses']) || !Array.isArray(body.addresses) ||
      body.addresses.length < 1 || body.addresses.length > MAX_ADDRESSES) reject(400, 'Choose between 1 and 101 addresses.');
  return body.addresses.map(a => {
    if (typeof a !== 'string') reject(400, 'Each address must be text.');
    const trimmed = a.trim();
    if (!trimmed || trimmed.length > 500 || /[\x00-\x1f\x7f]/.test(trimmed)) reject(400, 'An address is empty, too long, or contains unsupported characters.');
    return trimmed;
  });
}

function cleanMatches(data, count) {
  if (!data || !Array.isArray(data.results) || data.results.length !== count) reject(502, 'Geocodio returned an incomplete response. No route was changed.');
  return data.results.map(row => {
    const results = row && row.response && row.response.results;
    if (!Array.isArray(results)) reject(502, 'Geocodio returned an incomplete response. No route was changed.');
    if (!results.length) return { location: null };
    const first = results[0], location = first && first.location && [first.location.lat, first.location.lng];
    if (!point(location) || typeof first.formatted_address !== 'string' || !first.formatted_address.trim()) {
      return { location: null };
    }
    const accuracy = typeof first.accuracy === 'number' && Number.isFinite(first.accuracy) && first.accuracy >= 0 && first.accuracy <= 1 ? first.accuracy : null;
    const next = results[1];
    const ambiguous = !!(next && typeof next.accuracy === 'number' && accuracy !== null &&
      next.accuracy >= accuracy - 0.05 && next.formatted_address !== first.formatted_address);
    return {
      location, formatted: first.formatted_address.replace(/[\x00-\x1f\x7f]/g, ' ').slice(0, 600),
      accuracy, accuracyType: typeof first.accuracy_type === 'string' ? first.accuracy_type.slice(0, 60) : '', ambiguous,
    };
  });
}

function optimizeInput(body) {
  if (!keysAre(body, ['action', 'start', 'stops', 'fixedFirst', 'returnToStart']) ||
      !point(body.start) || !Array.isArray(body.stops) || body.stops.length < 2 ||
      body.stops.length > MAX_STOPS || !body.stops.every(point) ||
      typeof body.fixedFirst !== 'boolean' || typeof body.returnToStart !== 'boolean') {
    reject(400, 'Provide a start and 2 to 100 valid GPS stops.');
  }
  if (body.fixedFirst && (body.returnToStart || body.start[0] !== body.stops[0][0] || body.start[1] !== body.stops[0][1])) {
    reject(400, 'The fixed first stop must match the start, without a return trip.');
  }
  const vehicle = { id: 1, start: longitudeFirst(body.start) };
  if (body.returnToStart) vehicle.end = longitudeFirst(body.start);
  const jobs = body.stops.map((p, i) => ({ id: i + 1, location: longitudeFirst(p) }));
  if (body.fixedFirst) jobs.shift();
  return { vehicles: [vehicle], jobs };
}

function cleanOrder(data, expectedJobs, fixedFirst) {
  if (!data || data.code !== 0 || !Array.isArray(data.unassigned) || data.unassigned.length ||
      !Array.isArray(data.routes) || data.routes.length !== 1 || !data.routes[0] || data.routes[0].vehicle !== 1 ||
      !Array.isArray(data.routes[0].steps) ||
      (Array.isArray(data.routes[0].violations) && data.routes[0].violations.length)) {
    reject(422, 'Simple Routing could not include every stop. No route was changed.');
  }
  const allowed = new Set(expectedJobs.map(j => j.id)), seen = new Set(), indices = [];
  for (const step of data.routes[0].steps) {
    if (!step || !['start', 'end', 'job'].includes(step.type)) reject(502, 'Simple Routing returned an unexpected route. No route was changed.');
    if (step.type !== 'job') continue;
    const id = step.job === undefined ? step.id : step.job;
    if (!Number.isInteger(id) || !allowed.has(id) || seen.has(id) ||
        (step.id !== undefined && step.id !== id)) reject(502, 'Simple Routing returned an incomplete route. No route was changed.');
    seen.add(id); indices.push(id - 1);
  }
  if (indices.length !== allowed.size) reject(502, 'Simple Routing returned an incomplete route. No route was changed.');
  return fixedFirst ? [0, ...indices] : indices;
}

function createHandler(options = {}) {
  const env = options.env || process.env;
  const fetchFn = options.fetch || globalThis.fetch;
  return async function handler(req, res) {
    try {
      if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        reject(405, 'Use POST for CRM routing.');
      }
      if (!/^application\/json(?:\s*;|\s*$)/i.test(String(req.headers['content-type'] || ''))) reject(415, 'Use a JSON request.');
      await authenticate(req, fetchFn);
      const body = readBody(req);
      if (body.action === 'geocode') {
        const addresses = geocodeInput(body);
        if (!env.SIMPLEROUTING_API_KEY || !env.GEOCODIO_API_KEY) reject(503, 'Driving routes need both API keys configured on the server before looking up addresses.');
        const result = await providerJson(fetchFn, GEOCODIO_URL, env.GEOCODIO_API_KEY, addresses, 'Geocodio');
        return jsonResponse(res, 200, { matches: cleanMatches(result, addresses.length) });
      }
      if (body.action === 'optimize') {
        const input = optimizeInput(body);
        if (!env.SIMPLEROUTING_API_KEY) reject(503, 'Driving routes need the Simple Routing API key configured on the server.');
        const result = await providerJson(fetchFn, ROUTING_URL, env.SIMPLEROUTING_API_KEY, input, 'Simple Routing');
        return jsonResponse(res, 200, { order: cleanOrder(result, input.jobs, body.fixedFirst) });
      }
      reject(400, 'Unknown routing action.');
    } catch (e) {
      const safe = e instanceof RouteError ? e : new RouteError(500, 'Could not prepare a driving route. No route was changed.');
      return jsonResponse(res, safe.status, { error: safe.message });
    }
  };
}

module.exports = { createHandler };

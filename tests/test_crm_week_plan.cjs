// Pure weekly planner tests: fictional locations only, no network or CRM data.
const test = require('node:test');
const assert = require('node:assert/strict');
const week = require('../frontend/public/crm-week.js');
const days = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06'];
const any = location => ({ location, dateRequirement: 'any', requiredDate: '' });
const deadline = (location, requiredDate) => ({ location, dateRequirement: 'deadline', requiredDate });
const exact = (location, requiredDate) => ({ location, dateRequirement: 'exact', requiredDate });

test('Sunday suggests the next Monday; date calculations cross month and year boundaries', () => {
  assert.equal(week.defaultMonday('2026-10-31'), '2026-11-02');
  assert.equal(week.defaultMonday('2026-11-01'), '2026-11-02');
  assert.deepEqual(week.defaultFlags('2026-11-02', '2026-11-04'), [false, false, true, true, true, false, false]);
  assert.deepEqual(week.defaultFlags('2026-11-02', '2026-11-01'), [true, true, true, true, true, false, false]);
  assert.equal(week.defaultMonday('2026-11-04'), '2026-11-02');
  assert.equal(week.defaultMonday('2027-01-03'), '2027-01-04');
  assert.equal(week.addDays('2026-12-28', 6), '2027-01-03');
  assert.deepEqual(week.workDates('2026-11-02', [true, false, true, true, false, false, true]), ['2026-11-02', '2026-11-04', '2026-11-05', '2026-11-08']);
  assert.throws(() => week.workDates('2026-11-03', Array(7).fill(true)), /Monday/);
  assert.throws(() => week.workDates('2026-11-02', Array(7).fill(false)), /at least one/);
  assert.equal(week.validDate('2026-02-29'), false);
  assert.equal(week.validDate('2028-02-29'), true);
});

test('text lists support optional explicit deadlines and exact days, retaining duplicate work orders', () => {
  const parsed = week.parseText('\ufeff100 Example St, Austin, TX 78701\r\n100 Example St, Austin, TX 78701 | due 2026-11-04\n30.2, -97.1 | exact 2026-11-05\n');
  assert.deepEqual(parsed, [any('100 Example St, Austin, TX 78701'), deadline('100 Example St, Austin, TX 78701', '2026-11-04'), exact('30.2, -97.1', '2026-11-05')]);
  assert.throws(() => week.parseText('A | due tomorrow'), /YYYY-MM-DD/);
  assert.throws(() => week.parseText('A | exact 2026-02-30'), /invalid required date/);
  assert.throws(() => week.parseText('A\tB'), /without tabs/);
  assert.throws(() => week.parseText('A\u0001'), /control character/);
  assert.throws(() => week.parseText(Array(1001).fill('100 Example St').join('\n')), /up to 1000/);
});

test('lookup batches preserve order and stay under provider count and server byte limits', () => {
  const addresses = Array.from({ length: 260 }, (_, i) => `${i} ${'界"\\\\'.repeat(100)}`);
  const batches = week.lookupBatches(addresses);
  assert.deepEqual(batches.flat(), addresses);
  assert.ok(batches.length > 3);
  for (const batch of batches) {
    assert.ok(batch.length <= 101);
    assert.ok(Buffer.byteLength(JSON.stringify({ action: 'geocode', addresses: batch }), 'utf8') <= 60000);
  }
  assert.deepEqual(week.lookupBatches([]), []);
  assert.throws(() => week.lookupBatches(['x'.repeat(501)]), /Invalid address/);
});

test('exact days and deadlines are hard constraints; unspecified jobs stay within selected days', () => {
  const entries = [any('Flexible'), deadline('Early', '2026-11-03'), exact('Must Wednesday', '2026-11-04'), deadline('After this week', '2026-12-01')];
  const result = week.suggest(entries, days, {}, [[30.0, -97.0], [30.5, -97.1], [30.2, -97.2], [30.3, -97.1]]);
  assert.deepEqual(result.unassigned, []);
  assert.ok(days.includes(result.assignments[0]));
  assert.ok(result.assignments[1] <= '2026-11-03');
  assert.equal(result.assignments[2], '2026-11-04');
  assert.ok(days.includes(result.assignments[3]));
  const invalid = week.suggest([exact('Saturday', '2026-11-07'), deadline('Already due', '2026-11-01')], days, {});
  assert.deepEqual(invalid.assignments, [null, null]);
  assert.deepEqual(invalid.unassigned.map(x => x.index), [0, 1]);
  assert.throws(() => week.suggest([deadline('Missing date', '')], days, {}), /valid required date/);
});

test('workload accounts for existing stops and never exceeds 100 per day', () => {
  const entries = Array.from({ length: 8 }, (_, i) => any('Fictional ' + i));
  const result = week.suggest(entries, days.slice(0, 2), { [days[0]]: 98, [days[1]]: 95 });
  assert.equal(result.assignments.filter(d => d === days[0]).length, 2);
  assert.equal(result.assignments.filter(d => d === days[1]).length, 5);
  assert.equal(result.unassigned.length, 1);
  assert.equal(result.counts[days[0]], 100);
  assert.equal(result.counts[days[1]], 100);
  const overfull = week.suggest([any('A')], [days[0]], { [days[0]]: 101 });
  assert.deepEqual(overfull.assignments, [null]);
  assert.equal(overfull.unassigned.length, 1);
});

test('flexible work is balanced by total stop count and tries to group nearby locations', () => {
  const entries = Array.from({ length: 8 }, (_, i) => any('Job ' + i));
  const points = [[30.00, -97], [30.01, -97], [30.02, -97], [30.03, -97], [30.9, -97], [30.91, -97], [30.92, -97], [30.93, -97]];
  const result = week.suggest(entries, days.slice(0, 2), {}, points);
  assert.deepEqual(Object.values(result.counts), [4, 4]);
  assert.equal(new Set(result.assignments.slice(0, 4)).size, 1);
  assert.equal(new Set(result.assignments.slice(4)).size, 1);
  assert.notEqual(result.assignments[0], result.assignments[4]);
  assert.throws(() => week.suggest(entries, days, {}, [[500, 1]]), /valid reviewed location/);
});

test('assignment never reports a feasible small deadline/fixed-day schedule as impossible', () => {
  // Exhaustive feasibility oracle for a deterministic variety of capacity,
  // exact-day, due-by and flexible combinations. Counts of 98/99/100 mean
  // that a three-day search remains tiny while exercising actual route limits.
  const ds = days.slice(0, 3);
  let seed = 123456;
  const rand = n => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed % n; };
  const feasible = (entries, capacity, i = 0) => {
    if (i === entries.length) return true;
    return week.eligibleDays(entries[i], ds).some(day => {
      const k = ds.indexOf(day); if (!capacity[k]) return false;
      capacity[k]--; const ok = feasible(entries, capacity, i + 1); capacity[k]++; return ok;
    });
  };
  for (let trial = 0; trial < 1200; trial++) {
    const base = Object.fromEntries(ds.map(d => [d, 98 + rand(3)]));
    const entries = Array.from({ length: 1 + rand(6) }, (_, i) => {
      const kind = rand(3), date = ds[rand(3)];
      return kind === 0 ? any(String(i)) : kind === 1 ? deadline(String(i), date) : exact(String(i), date);
    });
    const possible = feasible(entries, ds.map(d => 100 - base[d]));
    const result = week.suggest(entries, ds, base);
    assert.equal(result.unassigned.length === 0, possible, JSON.stringify({ base, entries, result }));
  }
});

test('a large week preserves every job and explicitly reports any overflow', () => {
  const entries = Array.from({ length: 550 }, (_, i) => any('Fictional ' + i));
  const points = entries.map((_, i) => [30 + (i % 50) / 1000, -97 - (i % 40) / 1000]);
  const result = week.suggest(entries, days, {}, points);
  assert.equal(result.assignments.filter(Boolean).length, 500);
  assert.equal(result.unassigned.length, 50);
  assert.deepEqual(Object.values(result.counts), [100, 100, 100, 100, 100]);
});

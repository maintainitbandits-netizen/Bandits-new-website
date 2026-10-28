/* Local workweek suggestions. This file contains no provider keys and makes no
   network requests. The CRM explicitly geocodes/optimizes after user consent. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.WeeklyPlanner = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const MAX_JOBS = 1000, MAX_STOPS_PER_DAY = 100, MAX_TEXT = 1024 * 1024;
  const RULES = ['any', 'deadline', 'exact'];
  const validDate = s => {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    const d = new Date(s + 'T12:00:00Z');
    return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === s;
  };
  function addDays(s, n) {
    if (!validDate(s) || !Number.isInteger(n)) throw new Error('Choose a valid week date.');
    const d = new Date(s + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }
  function defaultMonday(localToday) {
    if (!validDate(localToday)) throw new Error('Choose a valid week date.');
    const day = new Date(localToday + 'T12:00:00Z').getUTCDay();
    return addDays(localToday, day === 0 ? 1 : day === 6 ? 2 : 1 - day);
  }
  function defaultFlags(monday, localToday) {
    if (!validDate(monday) || !validDate(localToday)) throw new Error('Choose a valid week date.');
    return Array.from({ length: 7 }, (_, i) => i < 5 && addDays(monday, i) >= localToday);
  }
  function workDates(monday, flags) {
    if (!validDate(monday) || new Date(monday + 'T12:00:00Z').getUTCDay() !== 1) {
      throw new Error('Choose a Monday for the start of the week.');
    }
    if (!Array.isArray(flags) || flags.length !== 7 || flags.some(v => typeof v !== 'boolean')) {
      throw new Error('Choose your workdays for the week.');
    }
    const days = flags.map((on, i) => on ? addDays(monday, i) : null).filter(Boolean);
    if (!days.length) throw new Error('Choose at least one workday.');
    return days;
  }
  function parseText(text) {
    text = String(text == null ? '' : text).replace(/^\uFEFF/, '');
    if (text.length > MAX_TEXT) throw new Error('Use a text list smaller than 1 MB.');
    if (text.includes('\t')) throw new Error('Use one complete address per line, without tabs.');
    const lines = text.split(/\r\n|\r|\n/).map((line, i) => ({ line: line.trim(), row: i + 1 })).filter(x => x.line);
    if (!lines.length) throw new Error('Paste at least one address or choose a text file.');
    if (lines.length > MAX_JOBS) throw new Error('Plan up to ' + MAX_JOBS + ' addresses at a time. Split larger lists.');
    return lines.map(({ line, row }) => {
      if (/[\x00-\x1f\x7f]/.test(line)) throw new Error('Line ' + row + ' contains an unsupported control character.');
      let location = line, dateRequirement = 'any', requiredDate = '';
      const pipe = line.indexOf('|');
      if (pipe !== -1) {
        location = line.slice(0, pipe).trim();
        const marker = /^\s*(due|exact|on)\s+(\d{4}-\d{2}-\d{2})\s*$/i.exec(line.slice(pipe + 1));
        if (!marker) throw new Error('Line ' + row + ': use | due YYYY-MM-DD or | exact YYYY-MM-DD, or set the date in the next step.');
        dateRequirement = marker[1].toLowerCase() === 'due' ? 'deadline' : 'exact';
        requiredDate = marker[2];
        if (!validDate(requiredDate)) throw new Error('Line ' + row + ' has an invalid required date.');
      }
      location = location.replace(/[ ]+/g, ' ').trim();
      if (!location || location.length > 500) throw new Error('Line ' + row + ' needs an address of at most 500 characters.');
      return { location, dateRequirement, requiredDate };
    });
  }
  function lookupBatches(addresses) {
    if (!Array.isArray(addresses) || addresses.length > MAX_JOBS + 1 || addresses.some(a => typeof a !== 'string' || !a || a.length > 500)) {
      throw new Error('Invalid address lookup list.');
    }
    const bytes = s => typeof TextEncoder === 'function' ? new TextEncoder().encode(s).length : s.length * 3;
    const fits = batch => batch.length <= 101 && bytes(JSON.stringify({ action: 'geocode', addresses: batch })) <= 60000;
    const batches = []; let batch = [];
    for (const address of addresses) {
      if (!fits(batch.concat([address]))) { if (!batch.length) throw new Error('An address is too large for lookup.'); batches.push(batch); batch = []; }
      batch.push(address);
      if (!fits(batch)) throw new Error('An address is too large for lookup.');
    }
    if (batch.length) batches.push(batch);
    return batches;
  }
  const point = p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite) && Math.abs(p[0]) <= 90 && Math.abs(p[1]) <= 180;
  function eligibleDays(entry, dates) {
    const rule = entry.dateRequirement || 'any';
    if (!RULES.includes(rule)) throw new Error('Choose a valid date requirement.');
    if (rule !== 'any' && !validDate(entry.requiredDate)) throw new Error('Choose a valid required date for every deadline or exact day.');
    return dates.filter(day => rule === 'any' || (rule === 'deadline' ? day <= entry.requiredDate : day === entry.requiredDate));
  }
  function miles(a, b) {
    const rad = x => x * Math.PI / 180, lat = rad(b[0] - a[0]), lon = rad(b[1] - a[1]);
    const h = Math.sin(lat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(lon / 2) ** 2;
    return 7917.6 * Math.asin(Math.sqrt(Math.max(0, Math.min(1, h))));
  }
  // Constrained jobs are assigned first. A soft per-day target balances existing
  // and new stop counts; geographic centroids are only a heuristic, not a
  // driving-time estimate. Exact dates and deadlines are never relaxed.
  function suggest(entries, dates, existing, points) {
    if (!Array.isArray(entries) || !entries.length || entries.length > MAX_JOBS) throw new Error('Choose 1 to ' + MAX_JOBS + ' jobs.');
    if (!Array.isArray(dates) || !dates.length || dates.length > 7 || dates.some(d => !validDate(d)) ||
        new Set(dates).size !== dates.length || dates.some((d, i) => i && dates[i - 1] >= d)) throw new Error('Choose valid workdays in order.');
    if (points !== undefined && (!Array.isArray(points) || points.length !== entries.length || !points.every(point))) {
      throw new Error('Every address needs a valid reviewed location.');
    }
    existing = existing || {};
    const counts = Object.fromEntries(dates.map(d => {
      const n = existing[d] == null ? 0 : existing[d];
      if (!Number.isSafeInteger(n) || n < 0) throw new Error('Existing stop counts are invalid.');
      return [d, n];
    }));
    const capacity = t => dates.reduce((sum, d) => sum + Math.max(0, Math.min(MAX_STOPS_PER_DAY, t) - counts[d]), 0);
    let target = 0; while (target < MAX_STOPS_PER_DAY && capacity(target) < entries.length) target++;
    const groups = new Map(), unassigned = [], assignments = Array(entries.length).fill(null);
    entries.forEach((entry, i) => {
      const eligible = eligibleDays(entry, dates);
      if (!eligible.length) { unassigned.push({ index: i, reason: 'No selected workday meets this date requirement.' }); return; }
      const task = { i, eligible };
      if (!groups.has(eligible.length)) groups.set(eligible.length, []);
      groups.get(eligible.length).push(task);
    });
    const centers = Object.fromEntries(dates.map(d => [d, { lat: 0, lon: 0, n: 0 }]));
    const center = d => [centers[d].lat / centers[d].n, centers[d].lon / centers[d].n];
    const remaining = () => dates.some(d => counts[d] < MAX_STOPS_PER_DAY && !centers[d].n);
    for (const size of [...groups.keys()].sort((a, b) => a - b)) {
      const tasks = groups.get(size);
      while (tasks.length) {
        let pick = 0;
        // Select geographically distinct seeds for empty days when possible.
        if (points && remaining()) {
          let best = -1;
          for (let k = 0; k < tasks.length; k++) {
            const task = tasks[k], empty = task.eligible.some(d => counts[d] < MAX_STOPS_PER_DAY && !centers[d].n);
            if (!empty) continue;
            const seeded = task.eligible.filter(d => centers[d].n);
            const distance = seeded.length ? Math.min(...seeded.map(d => miles(points[task.i], center(d)))) : 0;
            if (distance > best) { best = distance; pick = k; }
          }
        }
        const task = tasks.splice(pick, 1)[0];
        let choices = task.eligible.filter(d => counts[d] < MAX_STOPS_PER_DAY);
        if (!choices.length) { unassigned.push({ index: task.i, reason: 'All suitable days already have 100 stops.' }); continue; }
        const underTarget = choices.filter(d => counts[d] < target);
        if (underTarget.length) choices = underTarget;
        if (points) {
          const empty = choices.filter(d => !centers[d].n);
          if (empty.length) choices = empty;
          choices.sort((a, b) => {
            const da = centers[a].n ? miles(points[task.i], center(a)) : 0;
            const db = centers[b].n ? miles(points[task.i], center(b)) : 0;
            return da - db || counts[a] - counts[b] || a.localeCompare(b);
          });
        } else choices.sort((a, b) => counts[a] - counts[b] || a.localeCompare(b));
        const chosen = choices[0]; assignments[task.i] = chosen; counts[chosen]++;
        if (points) { centers[chosen].lat += points[task.i][0]; centers[chosen].lon += points[task.i][1]; centers[chosen].n++; }
      }
    }
    return { assignments, unassigned: unassigned.sort((a, b) => a.index - b.index), counts, target };
  }
  return { MAX_JOBS, MAX_STOPS_PER_DAY, MAX_TEXT, validDate, addDays, defaultMonday, defaultFlags, workDates, parseText, lookupBatches, eligibleDays, suggest };
});

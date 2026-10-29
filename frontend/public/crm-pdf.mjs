/* AppFolio work-order PDF text extraction. The PDF bytes never leave the
   browser; only explicitly reviewed job records are later sent to the CRM. */
export const PDF_FILE_LIMIT = 5 * 1024 * 1024;
export const PDF_PAGE_LIMIT = 25;
export const PDF_TEXT_LIMIT = 50000;
let pdfLibrary;

async function library() {
  if (!pdfLibrary) {
    pdfLibrary = import('/crm-pdfjs/pdf.min.mjs').then(pdfjs => {
      pdfjs.GlobalWorkerOptions.workerSrc = '/crm-pdfjs/pdf.worker.min.mjs';
      return pdfjs;
    }).catch(error => { pdfLibrary = null; throw error; });
  }
  return pdfLibrary;
}

// PDF text comes as positioned fragments rather than paragraphs. Keep lines in
// the document's extraction order, preserving separate columns where possible.
export function textItemsToLines(items) {
  const lines = [];
  let line = '', lastY = null, right = null, length = 0;
  const flush = () => {
    const value = line.replace(/[ \t]+$/g, '').trim();
    if (value) lines.push(value);
    line = ''; lastY = null; right = null;
  };
  for (const item of items || []) {
    if (!item || typeof item.str !== 'string') continue;
    const value = item.str.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '').replace(/[\r\n]+/g, ' ');
    length += value.length;
    if (length > PDF_TEXT_LIMIT) throw new Error('This PDF has too much text. Use a work-order PDF with no more than 50,000 characters.');
    const x = Array.isArray(item.transform) ? item.transform[4] : null;
    const y = Array.isArray(item.transform) ? item.transform[5] : null;
    if (line && Number.isFinite(y) && Number.isFinite(lastY) && Math.abs(y - lastY) > 3) flush();
    if (value) {
      if (line && !/\s$/.test(line) && !/^\s/.test(value)) {
        line += Number.isFinite(x) && Number.isFinite(right) && x - right > 24 ? '  ' : ' ';
      }
      line += value;
      if (Number.isFinite(y)) lastY = y;
      if (Number.isFinite(x)) right = x + (Number.isFinite(item.width) ? item.width : 0);
    }
    if (item.hasEOL) flush();
  }
  flush();
  return lines;
}

const clean = value => String(value == null ? '' : value).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '').trim();
const numberValue = value => {
  const token = clean(value).replace(/^#\s*/, '');
  return token.length <= 100 && /\d/.test(token) && /^[a-z0-9][a-z0-9./_-]*$/i.test(token) ? token : '';
};

// PDF drawing order can put an entire value column before its labels. Group
// horizontal fragments by their visible position, without using the PDF's
// embedded scripts, annotations, form values, or network resources.
function positionedRows(items) {
  const fragments = []; let complete = true;
  for (const item of items || []) {
    if (!item || typeof item.str !== 'string') continue;
    const raw = item.str.replace(/[\r\n]+/g, ' '), text = clean(raw);
    if (!text) continue;
    const x = Array.isArray(item.transform) ? item.transform[4] : null;
    const y = Array.isArray(item.transform) ? item.transform[5] : null;
    if (!Number.isFinite(x) || !Number.isFinite(y)) { complete = false; continue; }
    fragments.push({ text, x, y, leading: /^\s/.test(raw), trailing: /\s$/.test(raw), right: x + (Number.isFinite(item.width) ? Math.max(0, item.width) : 0) });
  }
  fragments.sort((a, b) => b.y - a.y || a.x - b.x);
  const rows = [];
  for (const fragment of fragments) {
    let row = rows[rows.length - 1];
    if (!row || Math.abs(row.y - fragment.y) > 2.5) { row = { y: fragment.y, fragments: [] }; rows.push(row); }
    row.fragments.push(fragment);
  }
  for (const row of rows) {
    row.fragments.sort((a, b) => a.x - b.x);
    row.segments = [];
    for (const fragment of row.fragments) {
      const previous = row.segments[row.segments.length - 1], gap = previous ? fragment.x - previous.right : Infinity;
      if (!previous || gap > 20) row.segments.push({ text: fragment.text, x: fragment.x, right: fragment.right, trailing: fragment.trailing });
      else {
        previous.text += (fragment.leading || previous.trailing || gap > 1 ? ' ' : '') + fragment.text;
        previous.right = Math.max(previous.right, fragment.right); previous.trailing = fragment.trailing;
      }
    }
    delete row.fragments;
  }
  return { rows, complete };
}

// Recognize the column layout in the supplied, representative work order.
// It is deliberately narrow: unfamiliar layouts fall back to text suggestions
// and manual review rather than assigning values from unrelated columns.
export function suggestPositionedWorkOrderFields(items) {
  const { rows, complete } = positionedRows(items);
  const find = regex => {
    const found = [];
    rows.forEach((row, index) => row.segments.forEach(segment => { if (regex.test(segment.text)) found.push({ row, index, segment }); }));
    return found.length === 1 ? found[0] : null;
  };
  const order = find(/^work\s*order\s*(?:#|no\.?|number)\s*:?$/i);
  const site = find(/^job\s*site\s*:?$/i);
  const description = find(/^(?:job\s+)?description\s*:?$/i);
  if (!order || !site || !description || Math.abs(order.segment.x - site.segment.x) > 24 ||
      site.row.y >= order.row.y || description.row.y >= site.row.y || description.segment.x >= site.segment.x - 30) return null;
  const rightOf = (row, segment) => row.segments.filter(other => other.x >= segment.right + 8).sort((a, b) => a.x - b.x);
  const number = numberValue((rightOf(order.row, order.segment)[0] || {}).text);
  let location = '';
  const first = rightOf(site.row, site.segment)[0];
  if (first && !/^(?:--+|n\/?a)$/i.test(first.text)) {
    const parts = [], seen = new Set(); let lastY = site.row.y;
    for (let i = site.index; i < rows.length; i++) {
      const row = rows[i];
      if (site.row.y - row.y > 110) break;
      if (i > site.index && row.segments.some(s => Math.abs(s.x - site.segment.x) <= 6)) break;
      const text = row.segments.filter(s => s.x >= first.x - 4).map(s => s.text).join(' ').trim();
      if (!text) continue;
      if (lastY - row.y > 24 || /^(?:--+|n\/?a)$/i.test(text)) break;
      const key = text.replace(/\s+/g, ' ').toLowerCase();
      if (!seen.has(key)) { seen.add(key); parts.push(text); }
      lastY = row.y;
    }
    const joined = [];
    for (const part of parts) {
      if (joined.length && /(?:\bunit|\bapt\.?|\bapartment|\bsuite|\bste\.?|#)\s*$/i.test(joined[joined.length - 1]) && /^#?[a-z0-9][a-z0-9/-]{0,30}$/i.test(part)) joined[joined.length - 1] += ' ' + part;
      else joined.push(part);
    }
    const value = joined.join(', ');
    if (value.length <= 500) location = value;
  }
  const detailLines = []; let previousY = description.row.y;
  for (let i = description.index + 1; i < rows.length && detailLines.length < 100; i++) {
    const row = rows[i], text = row.segments.filter(s => s.x >= description.segment.x - 4).map(s => s.text).join('  ').trim();
    if (!text) continue;
    if (previousY - row.y > (detailLines.length ? 20 : 32) || /^(?:created|approved|scheduled|completed|assigned|invoice)\s+(?:by|on|#)\s*:/i.test(text) || /^(?:--+|n\/?a)$/i.test(text)) break;
    detailLines.push(text); previousY = row.y;
  }
  const detail = detailLines.join('\n');
  return { number, location, description: detail.length <= 10000 ? detail : '', rows, complete };
}

// These are cautious suggestions, not claims about an official PDF layout.
// The whole extracted text is shown for review, and the user can correct every
// suggested field. Dates and AppFolio statuses are never inferred here.
export function suggestWorkOrderFields(text) {
  const lines = String(text || '').split(/\r?\n/).map(clean).filter(Boolean);
  let number = '', location = '', description = '', locationLine = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!number) {
      let m = line.match(/^(?:work\s*order|w\.?\s*o\.?)\s*(?:number|no\.?|#|id)\s*[:#.]?\s*([#]?[a-z0-9][a-z0-9./_-]*)/i);
      if (!m) m = line.match(/^work\s*order\s*[:#]?\s*(#?\d[a-z0-9./_-]*)\s*$/i);
      if (m) number = numberValue(m[1]);
      if (!number && /^(?:work\s*order|w\.?\s*o\.?)(?:\s*(?:number|no\.?|#|id))?\s*[:#.]?\s*$/i.test(line) && i + 1 < lines.length) {
        number = numberValue(lines[i + 1]);
      }
    }
    if (!location) {
      const m = line.match(/^(?:service\s+(?:address|location)|property\s+(?:address|location)|property\s*\/\s*unit|unit\s+address|property|location)\s*:\s*(.*)$/i);
      if (m) {
        let value = clean(m[1]);
        if (!value && i + 1 < lines.length && !/^[a-z][a-z /-]{1,35}\s*:/i.test(lines[i + 1])) { value = lines[i + 1]; locationLine = i + 1; }
        else locationLine = i;
        // Do not include another clearly labelled column as part of the address.
        value = value.split(/\s{2,}(?=(?:status|priority|vendor|contact|work\s*order|date)\s*:)/i)[0].trim();
        if (value && value.length <= 500) location = value;
      }
    }
    if (!description) {
      const m = line.match(/^(?:(?:job|work(?:\s*order)?)\s+)?description\s*:\s*(.*)$/i);
      if (m) {
        let value = clean(m[1]);
        if (!value && i + 1 < lines.length && !/^[a-z][a-z /-]{1,35}\s*:/i.test(lines[i + 1])) value = lines[i + 1];
        value = value.split(/\s{2,}(?=(?:status|priority|vendor|contact|work\s*order|date)\s*:)/i)[0].trim();
        if (value && value.length <= 10000) description = value;
      }
    }
  }
  if (location && locationLine >= 0 && locationLine + 1 < lines.length) {
    const next = lines[locationLine + 1];
    if (/^[a-z][a-z .'-]*,\s*[a-z]{2}\s+\d{5}(?:-\d{4})?$/i.test(next) && !location.includes(next)) location += ', ' + next;
  }
  return { number, location, description };
}

export async function readWorkOrderPdf(file, isCancelled = () => false) {
  if (!file || !/\.pdf$/i.test(String(file.name || ''))) throw new Error('Choose a PDF file.');
  if (!Number.isFinite(file.size) || file.size < 1 || file.size > PDF_FILE_LIMIT) throw new Error('PDF must be nonempty and no larger than 5 MB.');
  if (typeof file.arrayBuffer !== 'function') throw new Error('This device could not read the PDF. Try a newer browser.');
  let task;
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (isCancelled()) throw new Error('Import was closed.');
    const pdfjs = await library();
    if (isCancelled()) throw new Error('Import was closed.');
    task = pdfjs.getDocument({
      data: bytes,
      disableFontFace: true,
      useSystemFonts: false,
      useWasm: false,
      isEvalSupported: false,
      enableScripting: false,
      enableXfa: false,
      stopAtErrors: true,
      verbosity: pdfjs.VerbosityLevel.ERRORS,
    });
    const doc = await task.promise;
    if (isCancelled()) throw new Error('Import was closed.');
    if (!doc.numPages || doc.numPages > PDF_PAGE_LIMIT) throw new Error('Use a PDF with 1–25 pages for each work order.');
    const pages = []; let characters = 0, pagesWithoutText = 0, positioned = null;
    for (let n = 1; n <= doc.numPages; n++) {
      if (isCancelled()) throw new Error('Import was closed.');
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      let text = textItemsToLines(content.items).join('\n');
      const layout = suggestPositionedWorkOrderFields(content.items);
      if (layout) {
        if (!positioned) positioned = { number: layout.number, location: layout.location, description: layout.description };
        // Keep the original extraction order if any text had no coordinates;
        // otherwise the visible row order is easier to review for this layout.
        if (layout.complete) text = layout.rows.map(row => row.segments.map(s => s.text).join('  ')).join('\n');
      }
      page.cleanup();
      if (!text.trim()) pagesWithoutText++;
      characters += text.length;
      if (characters > PDF_TEXT_LIMIT) throw new Error('This PDF has too much text. Use a work-order PDF with no more than 50,000 characters.');
      if (text.trim()) pages.push(text);
    }
    const text = pages.join('\n\n').trim();
    if (!text) throw new Error('No selectable text found. Image-only or scanned PDFs need OCR; enter the job manually instead.');
    const guessed = suggestWorkOrderFields(text);
    return { text, pages: doc.numPages, pagesWithoutText,
      number: positioned && positioned.number || guessed.number,
      location: positioned && positioned.location || guessed.location,
      description: positioned && positioned.description || guessed.description };
  } catch (error) {
    if (error && error.name === 'PasswordException') throw new Error('This PDF is password-protected. Unlock it on your device before importing.');
    if (error && (error.name === 'InvalidPDFException' || error.name === 'FormatError')) throw new Error('This file could not be read as a PDF. Download it again and try.');
    throw error;
  } finally {
    if (task) { try { await task.destroy(); } catch (_) {} }
  }
}

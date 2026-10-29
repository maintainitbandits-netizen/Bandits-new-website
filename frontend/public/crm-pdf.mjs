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
    const pages = []; let characters = 0, pagesWithoutText = 0;
    for (let n = 1; n <= doc.numPages; n++) {
      if (isCancelled()) throw new Error('Import was closed.');
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      const text = textItemsToLines(content.items).join('\n');
      page.cleanup();
      if (!text.trim()) pagesWithoutText++;
      characters += text.length;
      if (characters > PDF_TEXT_LIMIT) throw new Error('This PDF has too much text. Use a work-order PDF with no more than 50,000 characters.');
      if (text.trim()) pages.push(text);
    }
    const text = pages.join('\n\n').trim();
    if (!text) throw new Error('No selectable text found. Image-only or scanned PDFs need OCR; enter the job manually instead.');
    return { text, pages: doc.numPages, pagesWithoutText, ...suggestWorkOrderFields(text) };
  } catch (error) {
    if (error && error.name === 'PasswordException') throw new Error('This PDF is password-protected. Unlock it on your device before importing.');
    if (error && (error.name === 'InvalidPDFException' || error.name === 'FormatError')) throw new Error('This file could not be read as a PDF. Download it again and try.');
    throw error;
  } finally {
    if (task) { try { await task.destroy(); } catch (_) {} }
  }
}

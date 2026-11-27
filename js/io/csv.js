// A small CSV parser (no packages). Owner: Stephen (Part A).
// Handles a UTF-8 BOM, quoted fields, "" escapes, commas and line breaks inside quotes, and \n, \r\n or \r line ends.

/** Parse CSV text into a list of rows, each a list of strings. Blank lines are skipped. */
export function parseCsv(text) {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  const endRow = () => {
    row.push(field);
    field = '';
    if (!(row.length === 1 && row[0] === '')) rows.push(row);
    row = [];
  };

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c !== '"') field += c;
      else if (src[i + 1] === '"') { field += '"'; i++; }
      else inQuotes = false;
    } else if (c === '"' && field === '') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      endRow();
    } else {
      field += c;
    }
  }
  if (inQuotes) throw new Error('The file ends inside a quoted text, so it looks damaged.');
  if (field !== '' || row.length) endRow();
  return rows;
}

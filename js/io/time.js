// Small date helpers for the Data screen. Owner: Stephen (Part A).
const pad = (n) => String(n).padStart(2, '0');

/** Local date as YYYY-MM-DD (not UTC, so a backup made after midnight gets today's date). */
export const localDate = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** An ISO time as local "YYYY-MM-DD HH:MM", or null. */
export const when = (iso) => {
  const d = iso ? new Date(iso) : null;
  return d && !Number.isNaN(d.getTime()) ? `${localDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}` : null;
};

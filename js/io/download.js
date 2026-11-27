// Hand a text file to the browser as a download. Works in Chrome and in the installed app (the file lands in Downloads).
// Owner: Stephen (Part A).
import { h } from '../core/dom.js';

export function download(name, text, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = h('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

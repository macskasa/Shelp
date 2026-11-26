// Small DOM helpers so every part writes UI the same way. Owner: Tony (lead).

/**
 * Create an element: h('button', { class: 'btn', onclick: fn }, 'Save')
 * - props starting with "on" become event listeners
 * - class, style (string), dataset (object) and any other attribute are supported
 * - children: strings, numbers, nodes, arrays, null/false (skipped)
 */
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props ?? {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k === 'class') el.className = v;
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, children);
  return el;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Same as h() for SVG elements: s('rect', { x: 0, y: 0, width: 10, height: 5 }) */
export function s(tag, attrs = {}, ...children) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v);
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export function clear(el) {
  while (el.firstChild) el.firstChild.remove();
  return el;
}

/** Short message at the bottom of the screen: toast('Saved'), toast(err.message, { error: true }) */
export function toast(text, { error = false, ms = 3500 } = {}) {
  const el = h('div', { class: `toast${error ? ' toast-error' : ''}`, role: 'status' }, text);
  document.body.append(el);
  setTimeout(() => el.remove(), ms);
}

const loaded = new Set();

/** Load a part's stylesheet once: loadCss(new URL('./map.css', import.meta.url)) */
export function loadCss(url) {
  const href = String(url);
  if (loaded.has(href)) return;
  loaded.add(href);
  document.head.append(h('link', { rel: 'stylesheet', href }));
}

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

// ---- Panels and the Android back button -------------------------------------------------
// On Android (the main target) the back gesture must close an open panel, not leave the screen.
// showPanel() pushes a history entry for each open panel and closes the top panel on Back.
// Closing a panel any other way (button, Esc) removes its history entry again.
// Navigating with go() / showOnMap() while panels are open closes them all first (closePanels).
const panels = [];
let ignorePops = 0;
let wired = false;

function wirePanels() {
  if (wired) return;
  wired = true;
  window.addEventListener('popstate', () => {
    if (ignorePops > 0) {
      ignorePops--;
      return;
    }
    const top = panels.at(-1);
    if (top) {
      top.how = 'back';
      top.dlg.close();
    }
  });
  window.addEventListener('hashchange', () => {
    for (const p of [...panels].reverse()) {
      p.how = 'nav';
      p.dlg.close();
    }
  });
}

/**
 * Show a <dialog> as a modal panel that the Back button closes. The dialog is removed on close.
 * Use it for every panel and sheet: showPanel(h('dialog', { class: 'panel' }, …))
 */
export function showPanel(dlg) {
  wirePanels();
  if (!dlg.isConnected) document.body.append(dlg);
  const entry = { dlg, how: null };
  panels.push(entry);
  history.pushState({ shelpPanel: panels.length }, '');
  dlg.showModal();
  dlg.addEventListener('close', () => {
    const i = panels.indexOf(entry);
    if (i >= 0) panels.splice(i, 1);
    if (!entry.how && history.state?.shelpPanel) {
      ignorePops++;
      history.back();
    }
    dlg.remove();
  }, { once: true });
  return dlg;
}

/**
 * Close every open panel and drop their history entries, then call done().
 * The router's go() uses this, so navigating from inside a panel never leaves stray Back steps.
 */
export function closePanels(done = () => {}) {
  const n = panels.length;
  if (!n) {
    done();
    return;
  }
  for (const p of [...panels].reverse()) {
    p.how = 'nav';
    p.dlg.close();
  }
  if (history.state?.shelpPanel) {
    ignorePops++;
    window.addEventListener('popstate', () => done(), { once: true });
    history.go(-n);
  } else {
    done();
  }
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

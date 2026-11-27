// CSV parser. Run from the repo root:  node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv } from '../js/io/csv.js';

test('plain rows, \\n and \\r\\n and a missing final newline', () => {
  assert.deepEqual(parseCsv('a,b\n1,2\n'), [['a', 'b'], ['1', '2']]);
  assert.deepEqual(parseCsv('a,b\r\n1,2'), [['a', 'b'], ['1', '2']]);
  assert.deepEqual(parseCsv('a\rb'), [['a'], ['b']]);
});

test('quoted fields: commas, line breaks and "" escapes', () => {
  assert.deepEqual(parseCsv('x,"a,b","line1\nline2","say ""hi"""\n'), [['x', 'a,b', 'line1\nline2', 'say "hi"']]);
});

test('empty fields and blank lines', () => {
  assert.deepEqual(parseCsv('a,,c\n\n,,\n'), [['a', '', 'c'], ['', '', '']]);
  assert.deepEqual(parseCsv(''), []);
});

test('a UTF-8 BOM is dropped and accents survive', () => {
  assert.deepEqual(parseCsv('﻿objectname,own\nJégvarázs „Elsa”,1'), [['objectname', 'own'], ['Jégvarázs „Elsa”', '1']]);
});

test('a quote in the middle of a field is plain text', () => {
  assert.deepEqual(parseCsv('5" box,1'), [['5" box', '1']]);
});

test('an unterminated quote is an error', () => {
  assert.throws(() => parseCsv('a,"oops\n1,2'), /damaged/);
});

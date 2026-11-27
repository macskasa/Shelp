// Part A – Game details panel: box sizes, categories, expansions inside a box. Owner: Stephen. Stories A3, A5, B1.
import { provide } from '../core/contracts.js';
import { openPanel } from './panel.js';

export function init() {
  provide('openGame', openPanel);
}

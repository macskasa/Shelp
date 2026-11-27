// Part C – Free space at a glance (story D3). Owner: Peter.
//   logic.js   texts, totals and bar fractions without DOM (tested)
//   view.js    the Free space screen
import { mountSpace } from './view.js';

export const screens = [
  {
    id: 'space',
    title: 'Free space',
    order: 15,
    mount(el) {
      return mountSpace(el);
    },
  },
];

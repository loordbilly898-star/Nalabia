import { sanitizeFirestoreData } from './types';

const obj = {
  a: 1,
  b: function() { return 2; },
  c: {
    d: 3,
    e: () => 4
  },
  f: [5, function() { return 6; }]
};

console.log(JSON.stringify(sanitizeFirestoreData(obj)));

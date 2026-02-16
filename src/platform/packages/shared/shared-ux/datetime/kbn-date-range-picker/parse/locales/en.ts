/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import type { ParserLocale, TimeUnit } from '../../types';

/** English locale for the date range parser */
export const en: ParserLocale = {
  now: 'now',

  delimiters: ['to', 'until'],

  namedRanges: {
    today: { start: 'now/d', end: 'now/d' },
    yesterday: { start: 'now-1d/d', end: 'now-1d/d' },
    tomorrow: { start: 'now+1d/d', end: 'now+1d/d' },
    'this week': { start: 'now/w', end: 'now/w' },
    'this month': { start: 'now/M', end: 'now/M' },
    'this year': { start: 'now/y', end: 'now/y' },
    'last week': { start: 'now-1w/w', end: 'now-1w/w' },
    'last month': { start: 'now-1M/M', end: 'now-1M/M' },
    'last year': { start: 'now-1y/y', end: 'now-1y/y' },
  },

  unitAliases: {
    // Standard datemath units
    ms: 'ms',
    s: 's',
    m: 'm',
    h: 'h',
    d: 'd',
    w: 'w',
    M: 'M',
    y: 'y',
    // Aliases
    min: 'm',
    mins: 'm',
    mos: 'M',
  } satisfies Record<string, TimeUnit>,

  naturalDuration: {
    past: ['last {count} {unit}'],
    future: ['next {count} {unit}'],
  },

  naturalInstant: {
    past: ['{count} {unit} ago'],
    future: ['{count} {unit} from now', 'in {count} {unit}'],
  },

  absoluteFormats: [
    'MMM D YYYY, HH:mm',
    'MMM D, HH:mm',
    'MMM D YYYY',
    'MMM D, YYYY',
    'MMM D',
    'ddd, DD MMM YYYY HH:mm:ss ZZ', // RFC 2822
  ],
};

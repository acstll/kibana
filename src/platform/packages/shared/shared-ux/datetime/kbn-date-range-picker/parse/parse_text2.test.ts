/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { textToTimeRange } from './parse_text';
import { DATE_TYPE_ABSOLUTE, DATE_TYPE_NOW, DATE_TYPE_RELATIVE } from '../constants';

describe('textToTimeRange — parsing spec', () => {
  // -------------------------------------------------------------------------
  // Shorthand
  // -------------------------------------------------------------------------

  describe('shorthand', () => {
    it.each([
      ['7', 'now-7m', 'now', 'no sign, no unit → past minutes'],
      ['-7', 'now-7m', 'now', 'negative sign, no unit → past minutes'],
      ['+7', 'now', 'now+7m', 'positive sign, no unit → future minutes'],
      ['7d', 'now-7d', 'now', 'no sign + unit → past'],
      ['-7d', 'now-7d', 'now', 'negative sign + unit → past'],
      ['+7d', 'now', 'now+7d', 'positive sign + unit → future'],
      ['now-7d', 'now-7d', 'now', 'explicit now prefix → past'],
      ['now+7d', 'now', 'now+7d', 'explicit now prefix → future'],
    ])('parses "%s" → start=%s end=%s (%s)', (text, expectedStart, expectedEnd) => {
      const range = textToTimeRange(text);
      expect(range.start).toBe(expectedStart);
      expect(range.end).toBe(expectedEnd);
      expect(range.isInvalid).toBe(false);
    });

    it.each([
      ['500ms', 'now-500ms', 'ms unit'],
      ['7min', 'now-7m', 'min alias → m'],
      ['3mos', 'now-3M', 'mos alias → M'],
      ['7mins', 'now-7m', 'mins alias → m'],
    ])('resolves unit alias "%s" → %s (%s)', (text, expectedStart) => {
      const range = textToTimeRange(text);
      expect(range.start).toBe(expectedStart);
      expect(range.end).toBe('now');
      expect(range.isInvalid).toBe(false);
    });

    it('supports rounding in shorthand', () => {
      const range = textToTimeRange('-7d/d');
      expect(range.start).toBe('now-7d/d');
      expect(range.end).toBe('now');
      expect(range.isInvalid).toBe(false);
    });

    it('supports rounding with explicit now prefix', () => {
      const range = textToTimeRange('now-7d/d');
      expect(range.start).toBe('now-7d/d');
      expect(range.end).toBe('now');
      expect(range.isInvalid).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Natural instant
  // -------------------------------------------------------------------------

  describe('natural instant', () => {
    it.each([
      ['7 minutes ago', 'now-7m', 'now', 'past suffix'],
      ['30 seconds ago', 'now-30s', 'now', 'past with seconds'],
      ['1 day ago', 'now-1d', 'now', 'past singular unit'],
    ])('parses past "%s" → start=%s end=%s (%s)', (text, expectedStart, expectedEnd) => {
      const range = textToTimeRange(text);
      expect(range.start).toBe(expectedStart);
      expect(range.end).toBe(expectedEnd);
      expect(range.isInvalid).toBe(false);
    });

    it.each([
      ['7 minutes from now', 'now', 'now+7m', 'future suffix'],
      ['3 days from now', 'now', 'now+3d', 'future plural'],
    ])('parses future suffix "%s" → start=%s end=%s (%s)', (text, expectedStart, expectedEnd) => {
      const range = textToTimeRange(text);
      expect(range.start).toBe(expectedStart);
      expect(range.end).toBe(expectedEnd);
      expect(range.isInvalid).toBe(false);
    });

    it.each([
      ['in 7 minutes', 'now', 'now+7m', 'future prefix'],
      ['in 3 days', 'now', 'now+3d', 'future prefix plural'],
    ])('parses future prefix "%s" → start=%s end=%s (%s)', (text, expectedStart, expectedEnd) => {
      const range = textToTimeRange(text);
      expect(range.start).toBe(expectedStart);
      expect(range.end).toBe(expectedEnd);
      expect(range.isInvalid).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Natural duration
  // -------------------------------------------------------------------------

  describe('natural duration', () => {
    it.each([
      ['last 7 minutes', 'now-7m', 'now'],
      ['last 30 seconds', 'now-30s', 'now'],
      ['last 1 hour', 'now-1h', 'now'],
      ['last 24 hours', 'now-24h', 'now'],
    ])('parses past "%s" → start=%s end=%s', (text, expectedStart, expectedEnd) => {
      const range = textToTimeRange(text);
      expect(range.start).toBe(expectedStart);
      expect(range.end).toBe(expectedEnd);
      expect(range.isNaturalLanguage).toBe(true);
      expect(range.isInvalid).toBe(false);
    });

    it.each([
      ['next 7 days', 'now', 'now+7d'],
      ['next 1 hour', 'now', 'now+1h'],
    ])('parses future "%s" → start=%s end=%s', (text, expectedStart, expectedEnd) => {
      const range = textToTimeRange(text);
      expect(range.start).toBe(expectedStart);
      expect(range.end).toBe(expectedEnd);
      expect(range.isNaturalLanguage).toBe(true);
      expect(range.isInvalid).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Named ranges
  // -------------------------------------------------------------------------

  describe('named ranges', () => {
    it.each([
      ['today', 'now/d', 'now/d'],
      ['yesterday', 'now-1d/d', 'now-1d/d'],
      ['tomorrow', 'now+1d/d', 'now+1d/d'],
      ['this week', 'now/w', 'now/w'],
      ['this month', 'now/M', 'now/M'],
      ['this year', 'now/y', 'now/y'],
      ['last week', 'now-1w/w', 'now-1w/w'],
      ['last month', 'now-1M/M', 'now-1M/M'],
      ['last year', 'now-1y/y', 'now-1y/y'],
    ])('parses "%s" → start=%s end=%s', (text, expectedStart, expectedEnd) => {
      const range = textToTimeRange(text);
      expect(range.start).toBe(expectedStart);
      expect(range.end).toBe(expectedEnd);
      expect(range.isNaturalLanguage).toBe(true);
      expect(range.isInvalid).toBe(false);
    });

    it('is case-insensitive', () => {
      const range = textToTimeRange('Today');
      expect(range.start).toBe('now/d');
      expect(range.end).toBe('now/d');
      expect(range.isInvalid).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Absolute dates
  // -------------------------------------------------------------------------

  describe('absolute dates', () => {
    it.each([
      ['2025-02-03', 'ISO date'],
      ['2025-02-03T14:30', 'ISO date + time'],
      ['2025-02-03T14:30:00Z', 'ISO date + time + Z'],
      ['2025-02-03T14:30:00.000Z', 'ISO date + time + ms + Z'],
    ])('parses ISO 8601 "%s" (%s)', (text) => {
      const range = textToTimeRange(text);
      expect(range.start).toBe(text);
      expect(range.end).toBe('now');
      expect(range.type[0]).toBe(DATE_TYPE_ABSOLUTE);
      expect(range.isInvalid).toBe(false);
    });

    it.each([
      ['Feb 3 2016, 19:00', 'MMM D YYYY, HH:mm'],
      ['Feb 3, 19:00', 'MMM D, HH:mm'],
      ['Feb 3 2016', 'MMM D YYYY'],
      ['Feb 3, 2016', 'MMM D, YYYY'],
    ])('parses locale format "%s" (%s)', (text) => {
      const range = textToTimeRange(text);
      expect(range.start).toBe(text);
      expect(range.end).toBe('now');
      expect(range.type[0]).toBe(DATE_TYPE_ABSOLUTE);
      expect(range.isInvalid).toBe(false);
    });

    it('parses unix timestamp in seconds (10 digits)', () => {
      const range = textToTimeRange('1707955200');
      expect(range.type[0]).toBe(DATE_TYPE_ABSOLUTE);
      expect(range.startDate).toEqual(new Date(1707955200 * 1000));
      expect(range.isInvalid).toBe(false);
    });

    it('parses unix timestamp in milliseconds (13 digits)', () => {
      const range = textToTimeRange('1707955200000');
      expect(range.type[0]).toBe(DATE_TYPE_ABSOLUTE);
      expect(range.startDate).toEqual(new Date(1707955200000));
      expect(range.isInvalid).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Range type combinations
  // -------------------------------------------------------------------------

  describe('range type combinations', () => {
    it('now - relative', () => {
      const range = textToTimeRange('now - now+7d');
      expect(range.type).toEqual([DATE_TYPE_NOW, DATE_TYPE_RELATIVE]);
      expect(range.isInvalid).toBe(false);
    });

    it('relative - now', () => {
      const range = textToTimeRange('now-7d - now');
      expect(range.type).toEqual([DATE_TYPE_RELATIVE, DATE_TYPE_NOW]);
      expect(range.isInvalid).toBe(false);
    });

    it('now - absolute', () => {
      const range = textToTimeRange('now - 2099-12-31');
      expect(range.type).toEqual([DATE_TYPE_NOW, DATE_TYPE_ABSOLUTE]);
      expect(range.isInvalid).toBe(false);
    });

    it('absolute - now', () => {
      const range = textToTimeRange('2020-01-01 - now');
      expect(range.type).toEqual([DATE_TYPE_ABSOLUTE, DATE_TYPE_NOW]);
      expect(range.isInvalid).toBe(false);
    });

    it('relative - relative', () => {
      const range = textToTimeRange('-7d - now-1d');
      expect(range.type).toEqual([DATE_TYPE_RELATIVE, DATE_TYPE_RELATIVE]);
      expect(range.isInvalid).toBe(false);
    });

    it('absolute - absolute', () => {
      const range = textToTimeRange('2020-01-01 - 2025-12-31');
      expect(range.type).toEqual([DATE_TYPE_ABSOLUTE, DATE_TYPE_ABSOLUTE]);
      expect(range.isInvalid).toBe(false);
    });

    it('relative - absolute', () => {
      const range = textToTimeRange('now-7d - 2099-12-31');
      expect(range.type).toEqual([DATE_TYPE_RELATIVE, DATE_TYPE_ABSOLUTE]);
      expect(range.isInvalid).toBe(false);
    });

    it('absolute - relative', () => {
      const range = textToTimeRange('2020-01-01 - now+7d');
      expect(range.type).toEqual([DATE_TYPE_ABSOLUTE, DATE_TYPE_RELATIVE]);
      expect(range.isInvalid).toBe(false);
    });

    it('accepts "to" as delimiter (English locale)', () => {
      const range = textToTimeRange('2020-01-01 to 2025-12-31');
      expect(range.type).toEqual([DATE_TYPE_ABSOLUTE, DATE_TYPE_ABSOLUTE]);
      expect(range.isInvalid).toBe(false);
    });

    it('accepts "until" as delimiter (English locale)', () => {
      const range = textToTimeRange('now-1d until now');
      expect(range.type).toEqual([DATE_TYPE_RELATIVE, DATE_TYPE_NOW]);
      expect(range.isInvalid).toBe(false);
    });

    it('accepts custom delimiter via options', () => {
      const range = textToTimeRange('now-1d thru now', { delimiter: 'thru' });
      expect(range.type).toEqual([DATE_TYPE_RELATIVE, DATE_TYPE_NOW]);
      expect(range.isInvalid).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // DateOffset population
  // -------------------------------------------------------------------------

  describe('DateOffset', () => {
    it('populates startOffset for relative start', () => {
      const range = textToTimeRange('-7d');
      expect(range.startOffset).toEqual({ amount: -7, unit: 'd' });
      expect(range.endOffset).toBeNull();
    });

    it('populates endOffset for relative end', () => {
      const range = textToTimeRange('+7d');
      expect(range.startOffset).toBeNull();
      expect(range.endOffset).toEqual({ amount: 7, unit: 'd' });
    });

    it('populates both offsets for relative-relative range', () => {
      const range = textToTimeRange('now-7d - now-1d');
      expect(range.startOffset).toEqual({ amount: -7, unit: 'd' });
      expect(range.endOffset).toEqual({ amount: -1, unit: 'd' });
    });

    it('includes roundTo when rounding is present', () => {
      const range = textToTimeRange('-7d/d');
      expect(range.startOffset).toEqual({ amount: -7, unit: 'd', roundTo: 'd' });
    });

    it('returns null offset for absolute dates', () => {
      const range = textToTimeRange('2025-02-03');
      expect(range.startOffset).toBeNull();
    });

    it('returns null offset for "now"', () => {
      const range = textToTimeRange('now - 2099-12-31');
      expect(range.startOffset).toBeNull();
    });

    it('populates offset for ms unit', () => {
      const range = textToTimeRange('500ms');
      expect(range.startOffset).toEqual({ amount: -500, unit: 'ms' });
    });

    it('populates offset for named ranges', () => {
      const range = textToTimeRange('yesterday');
      expect(range.startOffset).toEqual({ amount: -1, unit: 'd', roundTo: 'd' });
      expect(range.endOffset).toEqual({ amount: -1, unit: 'd', roundTo: 'd' });
    });

    it('populates offset for natural duration', () => {
      const range = textToTimeRange('last 7 minutes');
      expect(range.startOffset).toEqual({ amount: -7, unit: 'm' });
      expect(range.endOffset).toBeNull();
    });

    it('populates offset for natural instant', () => {
      const range = textToTimeRange('7 minutes ago');
      expect(range.startOffset).toEqual({ amount: -7, unit: 'm' });
      expect(range.endOffset).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Presets
  // -------------------------------------------------------------------------

  describe('presets', () => {
    const presets = [
      { label: 'Last 15 Minutes', start: 'now-15m', end: 'now' },
      { label: 'Last 24 Hours', start: 'now-24h', end: 'now' },
    ];

    it('matches preset labels case-insensitively', () => {
      const range = textToTimeRange('last 15 minutes', { presets });
      expect(range.isNaturalLanguage).toBe(true);
      expect(range.start).toBe('now-15m');
      expect(range.end).toBe('now');
      expect(range.isInvalid).toBe(false);
    });

    it('prioritizes preset over natural duration', () => {
      const range = textToTimeRange('Last 24 Hours', { presets });
      expect(range.isNaturalLanguage).toBe(true);
      expect(range.start).toBe('now-24h');
      expect(range.end).toBe('now');
    });
  });

  // -------------------------------------------------------------------------
  // Invalid inputs
  // -------------------------------------------------------------------------

  describe('invalid inputs', () => {
    it.each([
      ['', 'empty string'],
      ['  ', 'whitespace only'],
      ['not a date', 'garbage text'],
      ['foo - bar', 'garbage range'],
    ])('returns invalid for "%s" (%s)', (text) => {
      const range = textToTimeRange(text);
      expect(range.isInvalid).toBe(true);
    });

    it('returns invalid for reversed ranges', () => {
      const range = textToTimeRange('2026-02-03 - 2016-02-03');
      expect(range.isInvalid).toBe(true);
      expect(range.start).toBe('2026-02-03');
      expect(range.end).toBe('2016-02-03');
    });

    it('preserves original value in invalid result', () => {
      const range = textToTimeRange('  ');
      expect(range.value).toBe('  ');
      expect(range.startOffset).toBeNull();
      expect(range.endOffset).toBeNull();
    });
  });
});

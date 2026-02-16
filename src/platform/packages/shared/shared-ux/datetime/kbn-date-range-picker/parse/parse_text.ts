/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import dateMath from '@elastic/datemath';
import moment from 'moment';

import {
  DATE_TYPE_ABSOLUTE,
  DATE_TYPE_NOW,
  DATE_TYPE_RELATIVE,
  UNIT_FULL_TO_SHORT_MAP,
} from '../constants';
import type {
  DateType,
  DateString,
  DateOffset,
  TimeUnit,
  TimeRange,
  TimeRangeTransformOptions,
  TimeRangeBoundsPreset,
  ParserLocale,
} from '../types';
import { isValidTimeRange } from '../utils';
import { en } from './locales/en';

// ---------------------------------------------------------------------------
// Universal constants (always accepted, regardless of locale)
// ---------------------------------------------------------------------------

/** Universal delimiter, always accepted for range splitting */
const UNIVERSAL_DELIMITER = '-';

/** ISO 8601 formats always accepted for absolute dates */
const UNIVERSAL_ABSOLUTE_FORMATS = [
  'YYYY-MM-DD',
  'YYYY-MM-DDTHH:mm:ss.SSSZ',
  'YYYY-MM-DDTHH:mm:ssZ',
  'YYYY-MM-DDTHH:mm',
];

// ---------------------------------------------------------------------------
// Unit resolution
// ---------------------------------------------------------------------------

/**
 * Resolves a user-typed unit string to a canonical TimeUnit.
 * Checks locale aliases first, then falls back to the universal full-name map
 * (e.g., "minute" -> "m", "minutes" -> "m").
 */
const resolveUnit = (raw: string, locale: ParserLocale): TimeUnit | undefined =>
  locale.unitAliases[raw] ??
  locale.unitAliases[raw.toLowerCase()] ??
  (UNIT_FULL_TO_SHORT_MAP[raw.toLowerCase()] as TimeUnit | undefined);

// ---------------------------------------------------------------------------
// Regex & template helpers
// ---------------------------------------------------------------------------

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Builds a regex for a delimiter, requiring whitespace on both sides.
 * E.g., delimiter "to" -> `/^(.+?)\s+to\s+(.+)$/`
 */
const buildDelimiterRegex = (delimiter: string): RegExp =>
  new RegExp(`^(.+?)\\s+${escapeRegExp(delimiter)}\\s+(.+)$`);

/**
 * Tries to split text using any of the given delimiters.
 * Returns the first successful match as [startText, endText], or null.
 */
const splitByDelimiter = (
  text: string,
  delimiters: string[]
): { startText: string; endText: string } | null => {
  for (const delimiter of delimiters) {
    const match = text.match(buildDelimiterRegex(delimiter));
    if (match) {
      return { startText: match[1].trim(), endText: match[2].trim() };
    }
  }
  return null;
};

interface TemplateMatch {
  count: string;
  unit: string;
}

/**
 * Builds a regex from a natural language template containing `{count}` and `{unit}` placeholders,
 * and extracts the capture group indices for each placeholder.
 */
const buildTemplateRegex = (
  template: string
): { regex: RegExp; countIndex: number; unitIndex: number } => {
  const parts = template.split(/(\{count\}|\{unit\})/);
  let pattern = '^';
  let groupIndex = 0;
  let countIndex = -1;
  let unitIndex = -1;

  for (const part of parts) {
    if (part === '{count}') {
      groupIndex++;
      countIndex = groupIndex;
      pattern += '(\\d+)';
    } else if (part === '{unit}') {
      groupIndex++;
      unitIndex = groupIndex;
      pattern += '(\\w+)';
    } else if (part) {
      pattern += escapeRegExp(part).replace(/\s+/g, '\\s+');
    }
  }
  pattern += '$';
  return { regex: new RegExp(pattern, 'i'), countIndex, unitIndex };
};

/**
 * Tries to match text against an array of templates.
 * Returns the extracted {count} and {unit} on the first match, or null.
 */
const matchTemplates = (text: string, templates: string[]): TemplateMatch | null => {
  for (const template of templates) {
    const { regex, countIndex, unitIndex } = buildTemplateRegex(template);
    const match = text.match(regex);
    if (match) {
      return { count: match[countIndex], unit: match[unitIndex] };
    }
  }
  return null;
};

// ---------------------------------------------------------------------------
// Shorthand regex builder
// ---------------------------------------------------------------------------

/**
 * Builds a shorthand regex from the locale's unit alias keys.
 *
 * Accepts forms like:
 * - `now-7d`, `now+7d/d` (standard datemath with optional now prefix)
 * - `-7d`, `+7d` (sign + count + unit)
 * - `7d`, `7` (bare count + optional unit; defaults: sign = past, unit = minutes)
 * - `500ms`, `7min`, `3mos` (multi-char unit aliases)
 */
const buildShorthandRegex = (locale: ParserLocale): RegExp => {
  const unitKeys = Object.keys(locale.unitAliases)
    .sort((a, b) => b.length - a.length) // longest first for greedy matching
    .map(escapeRegExp)
    .join('|');

  return new RegExp(
    `^(?:${escapeRegExp(locale.now)})?([+-])?(\\d+)(${unitKeys})?(?:\\/(${unitKeys}))?$`,
    'i'
  );
};

// ---------------------------------------------------------------------------
// Date resolution (single place for moment + dateMath usage)
// ---------------------------------------------------------------------------

/**
 * Resolves a DateString to a Date object.
 * This is the single consolidated place for moment format matching and dateMath parsing.
 */
const resolveDateString = (
  dateString: DateString,
  allFormats: string[],
  options?: { roundUp?: boolean }
): Date | null => {
  // Try locale + universal absolute formats
  const parsedWithFormat = moment(dateString, allFormats, true);
  if (parsedWithFormat.isValid()) {
    return parsedWithFormat.toDate();
  }

  // Try dateMath (handles datemath expressions, ISO 8601, RFC 2822, etc.)
  return dateMath.parse(dateString, options)?.toDate() ?? null;
};

// ---------------------------------------------------------------------------
// Type classification
// ---------------------------------------------------------------------------

/** Determines the DateType of a date string */
const dateStringToDateType = (dateString: DateString): DateType => {
  if (dateString === 'now') return DATE_TYPE_NOW;
  if (dateString.includes('now')) return DATE_TYPE_RELATIVE;
  return DATE_TYPE_ABSOLUTE;
};

// ---------------------------------------------------------------------------
// DateOffset extraction
// ---------------------------------------------------------------------------

/** Datemath pattern to extract offset parts: `now-7d`, `now+3M/M`, `now-500ms` */
const DATEMATH_OFFSET_REGEX = /^now([+-])(\d+)(ms|[smhdwMy])(\/(?:ms|[smhdwMy]))?$/;

/**
 * Extracts a DateOffset from a datemath string if it represents a relative offset.
 * Returns null for "now", absolute dates, or unrecognized patterns.
 */
const dateStringToOffset = (dateString: DateString): DateOffset | null => {
  const match = dateString.match(DATEMATH_OFFSET_REGEX);
  if (!match) return null;
  const [, operator, count, unit, roundPart] = match;
  const amount = operator === '-' ? -Number(count) : Number(count);
  const roundTo = roundPart ? (roundPart.slice(1) as TimeUnit) : undefined;
  return { amount, unit: unit as TimeUnit, roundTo };
};

// ---------------------------------------------------------------------------
// TimeRange builder
// ---------------------------------------------------------------------------

/** Creates a TimeRange, automatically computing `isInvalid` from the range fields. */
const buildTimeRange = (fields: Omit<TimeRange, 'isInvalid'>): TimeRange => {
  const range: TimeRange = { ...fields, isInvalid: true };
  range.isInvalid = !isValidTimeRange(range);
  return range;
};

/** Builds an invalid TimeRange preserving the original input value */
const buildInvalidResult = (text: string): TimeRange => ({
  value: text,
  start: '',
  end: '',
  startDate: null,
  endDate: null,
  startOffset: null,
  endOffset: null,
  type: [DATE_TYPE_ABSOLUTE, DATE_TYPE_ABSOLUTE],
  isNaturalLanguage: false,
  isInvalid: true,
});

// ---------------------------------------------------------------------------
// Unix timestamp support
// ---------------------------------------------------------------------------

/** Detects bare unix timestamps by digit count and converts to ISO 8601 */
const tryUnixTimestamp = (text: string): DateString | null => {
  if (!/^\d{10,13}$/.test(text)) return null;
  const num = Number(text);
  const ms = text.length <= 10 ? num * 1000 : num;
  const date = new Date(ms);
  if (isNaN(date.getTime())) return null;
  return date.toISOString();
};

// ---------------------------------------------------------------------------
// Preset matching
// ---------------------------------------------------------------------------

/**
 * Matches text against preset labels (case-insensitive).
 * Returns the matched preset or undefined.
 */
const matchPreset = (
  text: string,
  presets: TimeRangeBoundsPreset[]
): TimeRangeBoundsPreset | undefined => {
  const normalized = text.trim().toLowerCase();
  return presets.find((preset) => preset.label.toLowerCase() === normalized);
};

// ---------------------------------------------------------------------------
// Instant parsing (single date/time value)
// ---------------------------------------------------------------------------

interface ParsedInstant {
  dateString: DateString;
  offset: DateOffset | null;
}

/**
 * Parses a text fragment into a single date instant: DateString + optional DateOffset.
 * Handles: "now", shorthand, natural instant, absolute dates (locale + universal + unix).
 */
const parseInstant = (
  text: string,
  locale: ParserLocale,
  allFormats: string[]
): ParsedInstant | null => {
  const trimmed = text.trim();
  const normalized = trimmed.toLowerCase();

  // "now" (locale-aware)
  if (normalized === locale.now.toLowerCase()) {
    return { dateString: 'now', offset: null };
  }

  // Unix timestamp (universal): bare 10-digit or 13-digit numbers
  // Checked early to avoid matching large numbers as shorthand
  const unixResult = tryUnixTimestamp(trimmed);
  if (unixResult) {
    return { dateString: unixResult, offset: null };
  }

  // Shorthand: "7", "-7", "7d", "+7d", "now-7d", "now+7d/d", "500ms", "7min", "3mos"
  const shorthandRegex = buildShorthandRegex(locale);
  const shorthandMatch = trimmed.match(shorthandRegex);
  if (shorthandMatch) {
    const [, sign, count, rawUnit, rawRound] = shorthandMatch;
    const operator = sign === '+' ? '+' : '-'; // default: past
    const resolvedUnit = rawUnit ? resolveUnit(rawUnit, locale) : ('m' as TimeUnit); // default: minutes
    if (!resolvedUnit) return null;
    const roundUnit = rawRound ? resolveUnit(rawRound, locale) : undefined;
    const roundSuffix = roundUnit ? `/${roundUnit}` : '';
    const dateString = `now${operator}${count}${resolvedUnit}${roundSuffix}`;
    const amount = operator === '-' ? -Number(count) : Number(count);
    return {
      dateString,
      offset: { amount, unit: resolvedUnit, ...(roundUnit ? { roundTo: roundUnit } : {}) },
    };
  }

  // Natural instant (past): "7 minutes ago"
  const pastMatch = matchTemplates(normalized, locale.naturalInstant.past);
  if (pastMatch) {
    const unit = resolveUnit(pastMatch.unit, locale);
    if (unit) {
      const dateString = `now-${pastMatch.count}${unit}`;
      return { dateString, offset: { amount: -Number(pastMatch.count), unit } };
    }
  }

  // Natural instant (future): "7 minutes from now", "in 7 minutes"
  const futureMatch = matchTemplates(normalized, locale.naturalInstant.future);
  if (futureMatch) {
    const unit = resolveUnit(futureMatch.unit, locale);
    if (unit) {
      const dateString = `now+${futureMatch.count}${unit}`;
      return { dateString, offset: { amount: Number(futureMatch.count), unit } };
    }
  }

  // Absolute date: try locale formats, then universal ISO formats
  const parsedWithFormat = moment(trimmed, allFormats, true);
  if (parsedWithFormat.isValid()) {
    return { dateString: trimmed, offset: null };
  }

  // Fallback: try dateMath.parse for anything that looks like it could be datemath or ISO
  if (/^(now|[+-]|\d)/.test(trimmed)) {
    const parsed = dateMath.parse(trimmed);
    if (parsed?.isValid()) {
      return { dateString: trimmed, offset: dateStringToOffset(trimmed) };
    }
  }

  return null;
};

// ---------------------------------------------------------------------------
// Main parser
// ---------------------------------------------------------------------------

/**
 * Main parsing function to transform text into a time range.
 *
 * Parsing priority:
 * 1. Preset label match (case-insensitive)
 * 2. Named range (from locale)
 * 3. Natural duration ("last 7 minutes", "next 7 days")
 * 4. Single instant (shorthand, natural instant, absolute)
 * 5. Range with delimiter ("start - end", "start to end")
 */
export function textToTimeRange(text: string, options?: TimeRangeTransformOptions): TimeRange {
  const trimmed = text.trim();
  const locale = options?.locale ?? en;
  const allFormats = [...locale.absoluteFormats, ...UNIVERSAL_ABSOLUTE_FORMATS];

  if (!trimmed) {
    return buildInvalidResult(text);
  }

  // Collect all accepted delimiters: universal + locale + options override
  const delimiters = [UNIVERSAL_DELIMITER, ...locale.delimiters];
  if (options?.delimiter && !delimiters.includes(options.delimiter)) {
    delimiters.push(options.delimiter);
  }

  // (1) Check preset labels
  const { presets = [] } = options ?? {};
  const preset = matchPreset(trimmed, presets);
  if (preset) {
    return buildTimeRange({
      value: text,
      start: preset.start,
      end: preset.end,
      startDate: resolveDateString(preset.start, allFormats),
      endDate: resolveDateString(preset.end, allFormats, { roundUp: true }),
      startOffset: dateStringToOffset(preset.start),
      endOffset: dateStringToOffset(preset.end),
      type: [dateStringToDateType(preset.start), dateStringToDateType(preset.end)],
      isNaturalLanguage: true,
    });
  }

  // (2) Named ranges from locale (case-insensitive)
  const namedRange = locale.namedRanges[trimmed.toLowerCase()];
  if (namedRange) {
    return buildTimeRange({
      value: text,
      start: namedRange.start,
      end: namedRange.end,
      startDate: resolveDateString(namedRange.start, allFormats),
      endDate: resolveDateString(namedRange.end, allFormats, { roundUp: true }),
      startOffset: dateStringToOffset(namedRange.start),
      endOffset: dateStringToOffset(namedRange.end),
      type: [dateStringToDateType(namedRange.start), dateStringToDateType(namedRange.end)],
      isNaturalLanguage: true,
    });
  }

  // (3) Natural duration ("last 7 minutes", "next 7 days")
  const normalizedForDuration = trimmed.toLowerCase();
  const pastDuration = matchTemplates(normalizedForDuration, locale.naturalDuration.past);
  if (pastDuration) {
    const unit = resolveUnit(pastDuration.unit, locale);
    if (unit) {
      const start = `now-${pastDuration.count}${unit}`;
      const endStr = 'now';
      return buildTimeRange({
        value: text,
        start,
        end: endStr,
        startDate: resolveDateString(start, allFormats),
        endDate: resolveDateString(endStr, allFormats, { roundUp: true }),
        startOffset: { amount: -Number(pastDuration.count), unit },
        endOffset: null,
        type: [DATE_TYPE_RELATIVE, DATE_TYPE_NOW],
        isNaturalLanguage: true,
      });
    }
  }

  const futureDuration = matchTemplates(normalizedForDuration, locale.naturalDuration.future);
  if (futureDuration) {
    const unit = resolveUnit(futureDuration.unit, locale);
    if (unit) {
      const startStr = 'now';
      const end = `now+${futureDuration.count}${unit}`;
      return buildTimeRange({
        value: text,
        start: startStr,
        end,
        startDate: resolveDateString(startStr, allFormats),
        endDate: resolveDateString(end, allFormats, { roundUp: true }),
        startOffset: null,
        endOffset: { amount: Number(futureDuration.count), unit },
        type: [DATE_TYPE_NOW, DATE_TYPE_RELATIVE],
        isNaturalLanguage: true,
      });
    }
  }

  // (4) Try splitting by delimiter first, before single-instant
  const delimiterSplit = splitByDelimiter(trimmed, delimiters);
  if (delimiterSplit && delimiterSplit.startText && delimiterSplit.endText) {
    const startInstant = parseInstant(delimiterSplit.startText, locale, allFormats);
    const endInstant = parseInstant(delimiterSplit.endText, locale, allFormats);

    if (startInstant && endInstant) {
      return buildTimeRange({
        value: text,
        start: startInstant.dateString,
        end: endInstant.dateString,
        startDate: resolveDateString(startInstant.dateString, allFormats),
        endDate: resolveDateString(endInstant.dateString, allFormats, { roundUp: true }),
        startOffset: startInstant.offset,
        endOffset: endInstant.offset,
        type: [
          dateStringToDateType(startInstant.dateString),
          dateStringToDateType(endInstant.dateString),
        ],
        isNaturalLanguage: false,
      });
    }
  }

  // (5) Single instant (treat as start with end = now, or now to future)
  const singleInstant = parseInstant(trimmed, locale, allFormats);
  if (singleInstant) {
    const { dateString, offset } = singleInstant;
    const isFuture = offset && offset.amount > 0;

    if (isFuture) {
      return buildTimeRange({
        value: text,
        start: 'now',
        end: dateString,
        startDate: new Date(),
        endDate: resolveDateString(dateString, allFormats),
        startOffset: null,
        endOffset: offset,
        type: [DATE_TYPE_NOW, dateStringToDateType(dateString)],
        isNaturalLanguage: false,
      });
    }

    return buildTimeRange({
      value: text,
      start: dateString,
      end: 'now',
      startDate: resolveDateString(dateString, allFormats),
      endDate: new Date(),
      startOffset: offset,
      endOffset: null,
      type: [dateStringToDateType(dateString), DATE_TYPE_NOW],
      isNaturalLanguage: false,
    });
  }

  return buildInvalidResult(text);
}

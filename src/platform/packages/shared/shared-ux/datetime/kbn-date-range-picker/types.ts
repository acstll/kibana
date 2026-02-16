/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import type { DATE_TYPE_ABSOLUTE, DATE_TYPE_RELATIVE, DATE_TYPE_NOW } from './constants';

export type DateType = typeof DATE_TYPE_ABSOLUTE | typeof DATE_TYPE_RELATIVE | typeof DATE_TYPE_NOW;

/** Elastic dataMath string or ISO 8601 yyyy-MM-ddTHH:mm:ss.SSSZ e.g. 2025-12-23T08:15:13Z */
export type DateString = string;

/** Supported time units, matching @elastic/datemath Unit */
export type TimeUnit = 'ms' | 's' | 'm' | 'h' | 'd' | 'w' | 'M' | 'y';

/** Structured representation of a relative offset from "now" */
export interface DateOffset {
  /** Signed offset from now. Negative = past, positive = future. */
  amount: number;
  /** Time unit for the offset */
  unit: TimeUnit;
  /** Optional rounding unit (the `/d` in `now-1d/d`) */
  roundTo?: TimeUnit;
}

/**
 * Locale definition for the parser. Defines language-specific vocabulary for
 * parsing text into time ranges. The parser always supports these universally:
 * - Delimiter: `'-'` (with surrounding spaces)
 * - Absolute formats: ISO 8601, unix timestamps
 *
 * The locale adds additional, language-specific vocabulary on top.
 *
 * Templates use `{count}` and `{unit}` placeholders. The parser converts them
 * to regex capture groups, so arbitrary word order across languages is supported.
 */
export interface ParserLocale {
  /** The keyword for "now" in input text (e.g., "now") */
  now: string;
  /** Additional locale-specific delimiters (e.g., ['to', 'until']). '-' is always accepted. */
  delimiters: string[];
  /** Named ranges: label -> datemath bounds (e.g., "today" -> { start: 'now/d', end: 'now/d' }) */
  namedRanges: Record<string, { start: string; end: string }>;
  /** Maps user-typed unit strings to canonical TimeUnit */
  unitAliases: Record<string, TimeUnit>;
  /** Natural language duration patterns with {count} and {unit} placeholders */
  naturalDuration: {
    past: string[];
    future: string[];
  };
  /** Natural language instant patterns with {count} and {unit} placeholders */
  naturalInstant: {
    past: string[];
    future: string[];
  };
  /** Additional locale-specific absolute date formats (moment.js format strings). ISO 8601 and unix timestamps are always accepted. */
  absoluteFormats: string[];
}

export interface TimeRangeBounds {
  end: DateString;
  start: DateString;
}

export interface TimeRangeBoundsPreset extends TimeRangeBounds {
  label: string;
}

export interface TimeRangeTransformOptions {
  /** Presets to match against (e.g., "Last 15 minutes") */
  presets?: TimeRangeBoundsPreset[];
  /** Parser locale. @default English */
  locale?: ParserLocale;
  /** Additional delimiter to accept for range parsing */
  delimiter?: string;
  /** Date format for display */
  dateFormat?: string;
}

export interface TimeRange {
  value: string;
  start: DateString;
  end: DateString;
  startDate: Date | null;
  endDate: Date | null;
  /** Structured offset for start, non-null only when type[0] is RELATIVE */
  startOffset: DateOffset | null;
  /** Structured offset for end, non-null only when type[1] is RELATIVE */
  endOffset: DateOffset | null;
  type: [DateType, DateType];
  isNaturalLanguage: boolean;
  isInvalid: boolean;
}

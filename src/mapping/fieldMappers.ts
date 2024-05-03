import {
  AirtableTypeString, FromAirtableTypeString, FromTsTypeString, TsTypeString,
} from './typeUtils';

type Mapper = {
  [T in TsTypeString]?: {
    [A in AirtableTypeString]?: {
      toAirtable: (value: FromTsTypeString<T>) => FromAirtableTypeString<A>,
      fromAirtable: (value: FromAirtableTypeString<A> | null | undefined) => FromTsTypeString<T>,
    }
  }
};

const required = <T>(value: T): NonNullable<T> => {
  if (value === null || value === undefined) {
    throw new Error('[airtable-ts] Missing required value');
  }
  return value;
};

const fallbackMapperPair = <T, F1, F2>(toFallback: F1, fromFallback: F2) => ({
  toAirtable: (value: T | null | undefined) => value ?? toFallback,
  fromAirtable: (value: T | null | undefined) => value ?? fromFallback,
});

const requiredMapperPair = {
  toAirtable: <T>(value: T | null | undefined) => required(value),
  fromAirtable: <T>(value: T | null | undefined) => required(value),
};

export const fieldMappers: Mapper = {
  string: {
    url: fallbackMapperPair('', ''),
    email: fallbackMapperPair('', ''),
    phoneNumber: fallbackMapperPair('', ''),
    singleLineText: fallbackMapperPair('', ''),
    multilineText: fallbackMapperPair('', ''),
    richText: fallbackMapperPair('', ''),
    singleSelect: fallbackMapperPair('', ''),
    externalSyncSource: {
      toAirtable: () => { throw new Error('[airtable-ts] externalSyncSource type field is readonly'); },
      fromAirtable: (value) => value ?? '',
    },
    multipleSelects: {
      toAirtable: (value) => {
        return [value];
      },
      fromAirtable: (value) => {
        if (!value) {
          throw new Error('[airtable-ts] Failed to coerce multipleSelects type field to a single string, as it was blank');
        }
        if (value.length !== 1) {
          throw new Error(`[airtable-ts] Can't coerce multipleSelects to a single string, as there were ${value?.length} entries`);
        }
        return value[0]!;
      },
    },
    multipleRecordLinks: {
      toAirtable: (value) => {
        return [value];
      },
      fromAirtable: (value) => {
        if (!value) {
          throw new Error('[airtable-ts] Failed to coerce multipleRecordLinks type field to a single string, as it was blank');
        }
        if (value.length !== 1) {
          throw new Error(`[airtable-ts] Can't coerce multipleRecordLinks to a single string, as there were ${value?.length} entries`);
        }
        return value[0]!;
      },
    },
    date: {
      toAirtable: (value) => {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
          throw new Error('[airtable-ts] Invalid date string');
        }
        return date.toJSON().slice(0, 10);
      },
      fromAirtable: (value) => {
        const date = new Date(value ?? '');
        if (Number.isNaN(date.getTime())) {
          throw new Error('[airtable-ts] Invalid date string');
        }
        return date.toJSON();
      },
    },
    dateTime: {
      toAirtable: (value) => {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
          throw new Error('[airtable-ts] Invalid dateTime string');
        }
        return date.toJSON();
      },
      fromAirtable: (value) => {
        const date = new Date(value ?? '');
        if (Number.isNaN(date.getTime())) {
          throw new Error('[airtable-ts] Invalid dateTime string');
        }
        return date.toJSON();
      },
    },
    multipleLookupValues: {
      toAirtable: () => { throw new Error('[airtable-ts] lookup type field is readonly'); },
      fromAirtable: (value) => {
        if (!value) {
          throw new Error('[airtable-ts] Failed to coerce lookup type field to a single string, as it was blank');
        }
        if (value.length !== 1) {
          throw new Error(`[airtable-ts] Can't coerce lookup to a single string, as there were ${value?.length} entries`);
        }
        if (typeof value[0] !== 'string') {
          throw new Error(`[airtable-ts] Can't coerce singular lookup to a single string, as it was of type ${typeof value[0]}`);
        }
        return value[0];
      },
    },
    rollup: {
      toAirtable: () => { throw new Error('[airtable-ts] rollup type field is readonly'); },
      fromAirtable: (value) => {
        if (typeof value === 'string') return value;
        if (value === undefined || value === null) return '';
        throw new Error(`[airtable-ts] Can't coerce rollup to a string, as it was of type ${typeof value}`);
      },
    },
    formula: {
      toAirtable: () => { throw new Error('[airtable-ts] formula type field is readonly'); },
      fromAirtable: (value) => {
        if (typeof value === 'string') return value;
        if (value === undefined || value === null) return '';
        throw new Error(`[airtable-ts] Can't coerce formula to a string, as it was of type ${typeof value}`);
      },
    },
  },
  'string | null': {
    url: fallbackMapperPair(null, null),
    email: fallbackMapperPair(null, null),
    phoneNumber: fallbackMapperPair(null, null),
    singleLineText: fallbackMapperPair(null, null),
    multilineText: fallbackMapperPair(null, null),
    richText: fallbackMapperPair(null, null),
    singleSelect: fallbackMapperPair(null, null),
    externalSyncSource: {
      toAirtable: () => { throw new Error('[airtable-ts] externalSyncSource type field is readonly'); },
      fromAirtable: (value) => value ?? null,
    },
    multipleSelects: {
      toAirtable: (value) => {
        return value ? [value] : [];
      },
      fromAirtable: (value) => {
        if (!value || value.length === 0) {
          return null;
        }
        if (value.length !== 1) {
          throw new Error(`[airtable-ts] Can't coerce multipleSelects to a single string, as there were ${value?.length} entries`);
        }
        return value[0]!;
      },
    },
    multipleRecordLinks: {
      toAirtable: (value) => {
        return value ? [value] : [];
      },
      fromAirtable: (value) => {
        if (!value || value.length === 0) {
          return null;
        }
        if (value.length !== 1) {
          throw new Error(`[airtable-ts] Can't coerce multipleRecordLinks to a single string, as there were ${value?.length} entries`);
        }
        return value[0]!;
      },
    },
    date: {
      toAirtable: (value) => {
        if (value === null) return null;
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
          throw new Error('[airtable-ts] Invalid date');
        }
        return date.toJSON().slice(0, 10);
      },
      fromAirtable: (value) => {
        if (value === null || value === undefined) return null;
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
          throw new Error('[airtable-ts] Invalid date');
        }
        return date.toJSON();
      },
    },
    dateTime: {
      toAirtable: (value) => {
        if (value === null) return null;
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
          throw new Error('[airtable-ts] Invalid dateTime');
        }
        return date.toJSON();
      },
      fromAirtable: (value) => {
        if (value === null || value === undefined) return null;
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
          throw new Error('[airtable-ts] Invalid dateTime');
        }
        return date.toJSON();
      },
    },
    multipleLookupValues: {
      toAirtable: () => { throw new Error('[airtable-ts] lookup type field is readonly'); },
      fromAirtable: (value) => {
        if (!value || value.length === 0) {
          return null;
        }
        if (value.length !== 1) {
          throw new Error(`[airtable-ts] Can't coerce lookup to a single string, as there were ${value?.length} entries`);
        }
        if (typeof value[0] !== 'string') {
          throw new Error(`[airtable-ts] Can't coerce singular lookup to a single string, as it was of type ${typeof value[0]}`);
        }
        return value[0];
      },
    },
    rollup: {
      toAirtable: () => { throw new Error('[airtable-ts] rollup type field is readonly'); },
      fromAirtable: (value) => {
        if (typeof value === 'string') return value;
        if (value === undefined || value === null) return null;
        throw new Error(`[airtable-ts] Can't coerce rollup to a string, as it was of type ${typeof value}`);
      },
    },
    formula: {
      toAirtable: () => { throw new Error('[airtable-ts] formula type field is readonly'); },
      fromAirtable: (value) => {
        if (typeof value === 'string') return value;
        if (value === undefined || value === null) return null;
        throw new Error(`[airtable-ts] Can't coerce formula to a string, as it was of type ${typeof value}`);
      },
    },
  },
  boolean: {
    checkbox: fallbackMapperPair(false, false),
    multipleLookupValues: {
      toAirtable: () => { throw new Error('[airtable-ts] lookup type field is readonly'); },
      fromAirtable: (value) => {
        if (!value) {
          throw new Error('[airtable-ts] Failed to coerce lookup type field to a single boolean, as it was blank');
        }
        if (value.length !== 1) {
          throw new Error(`[airtable-ts] Can't coerce lookup to a single boolean, as there were ${value?.length} entries`);
        }
        if (typeof value[0] !== 'boolean') {
          throw new Error(`[airtable-ts] Can't coerce singular lookup to a single boolean, as it was of type ${typeof value[0]}`);
        }
        return value[0];
      },
    },
  },
  'boolean | null': {
    checkbox: fallbackMapperPair(null, null),
    multipleLookupValues: {
      toAirtable: () => { throw new Error('[airtable-ts] lookup type field is readonly'); },
      fromAirtable: (value) => {
        if (!value || value.length === 0) {
          return null;
        }
        if (value.length !== 1) {
          throw new Error(`[airtable-ts] Can't coerce lookup to a single boolean, as there were ${value?.length} entries`);
        }
        if (typeof value[0] !== 'boolean') {
          throw new Error(`[airtable-ts] Can't coerce singular lookup to a single boolean, as it was of type ${typeof value[0]}`);
        }
        return value[0];
      },
    },
  },
  number: {
    number: requiredMapperPair,
    rating: requiredMapperPair,
    duration: requiredMapperPair,
    currency: requiredMapperPair,
    percent: requiredMapperPair,
    count: {
      toAirtable: () => { throw new Error('[airtable-ts] count type field is readonly'); },
      fromAirtable: (value) => required(value),
    },
    autoNumber: {
      toAirtable: () => { throw new Error('[airtable-ts] autoNumber type field is readonly'); },
      fromAirtable: (value) => required(value),
    },
    // Number assumed to be unix time in seconds
    date: {
      toAirtable: (value) => {
        const date = new Date(value * 1000);
        if (Number.isNaN(date.getTime())) {
          throw new Error('[airtable-ts] Invalid date');
        }
        return date.toJSON().slice(0, 10);
      },
      fromAirtable: (value) => {
        const date = new Date(value ?? '');
        if (Number.isNaN(date.getTime())) {
          throw new Error('[airtable-ts] Invalid date');
        }
        return Math.floor(date.getTime() / 1000);
      },
    },
    // Number assumed to be unix time in seconds
    dateTime: {
      toAirtable: (value) => {
        const date = new Date(value * 1000);
        if (Number.isNaN(date.getTime())) {
          throw new Error('[airtable-ts] Invalid dateTime');
        }
        return date.toJSON();
      },
      fromAirtable: (value) => {
        const date = new Date(value ?? '');
        if (Number.isNaN(date.getTime())) {
          throw new Error('[airtable-ts] Invalid dateTime');
        }
        return Math.floor(date.getTime() / 1000);
      },
    },
    multipleLookupValues: {
      toAirtable: () => { throw new Error('[airtable-ts] lookup type field is readonly'); },
      fromAirtable: (value) => {
        if (!value) {
          throw new Error('[airtable-ts] Failed to coerce lookup type field to a single number, as it was blank');
        }
        if (value.length !== 1) {
          throw new Error(`[airtable-ts] Can't coerce lookup to a single number, as there were ${value?.length} entries`);
        }
        if (typeof value[0] !== 'number') {
          throw new Error(`[airtable-ts] Can't coerce singular lookup to a single number, as it was of type ${typeof value[0]}`);
        }
        return value[0];
      },
    },
    rollup: {
      toAirtable: () => { throw new Error('[airtable-ts] rollup type field is readonly'); },
      fromAirtable: (value) => {
        if (typeof value === 'number') return value;
        throw new Error(`[airtable-ts] Can't coerce rollup to a number, as it was of type ${typeof value}`);
      },
    },
    formula: {
      toAirtable: () => { throw new Error('[airtable-ts] formula type field is readonly'); },
      fromAirtable: (value) => {
        if (typeof value === 'number') return value;
        throw new Error(`[airtable-ts] Can't coerce formula to a number, as it was of type ${typeof value}`);
      },
    },
  },
  'number | null': {
    number: fallbackMapperPair(null, null),
    rating: fallbackMapperPair(null, null),
    duration: fallbackMapperPair(null, null),
    currency: fallbackMapperPair(null, null),
    percent: fallbackMapperPair(null, null),
    count: {
      fromAirtable: (value) => value ?? null,
      toAirtable: () => { throw new Error('[airtable-ts] count type field is readonly'); },
    },
    autoNumber: {
      fromAirtable: (value) => value ?? null,
      toAirtable: () => { throw new Error('[airtable-ts] autoNumber field is readonly'); },
    },
    // Number assumed to be unix time in seconds
    date: {
      toAirtable: (value) => {
        if (value === null) return null;
        const date = new Date(value * 1000);
        if (Number.isNaN(date.getTime())) {
          throw new Error('[airtable-ts] Invalid date');
        }
        return date.toJSON().slice(0, 10);
      },
      fromAirtable: (value) => {
        if (value === null || value === undefined) return null;
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
          throw new Error('[airtable-ts] Invalid date');
        }
        return Math.floor(date.getTime() / 1000);
      },
    },
    // Number assumed to be unix time in seconds
    dateTime: {
      toAirtable: (value) => {
        if (value === null) return null;
        const date = new Date(value * 1000);
        if (Number.isNaN(date.getTime())) {
          throw new Error('[airtable-ts] Invalid dateTime');
        }
        return date.toJSON();
      },
      fromAirtable: (value) => {
        if (value === null || value === undefined) return null;
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
          throw new Error('[airtable-ts] Invalid dateTime');
        }
        return Math.floor(date.getTime() / 1000);
      },
    },
    multipleLookupValues: {
      toAirtable: () => { throw new Error('[airtable-ts] lookup type field is readonly'); },
      fromAirtable: (value) => {
        if (!value || value.length === 0) {
          return null;
        }
        if (value.length !== 1) {
          throw new Error(`[airtable-ts] Can't coerce lookup to a single number, as there were ${value?.length} entries`);
        }
        if (typeof value[0] !== 'number') {
          throw new Error(`[airtable-ts] Can't coerce singular lookup to a single number, as it was of type ${typeof value[0]}`);
        }
        return value[0];
      },
    },
    rollup: {
      toAirtable: () => { throw new Error('[airtable-ts] rollup type field is readonly'); },
      fromAirtable: (value) => {
        if (typeof value === 'number') return value;
        if (value === null || value === undefined) return null;
        throw new Error(`[airtable-ts] Can't coerce rollup to a number, as it was of type ${typeof value}`);
      },
    },
    formula: {
      toAirtable: () => { throw new Error('[airtable-ts] formula type field is readonly'); },
      fromAirtable: (value) => {
        if (typeof value === 'number') return value;
        if (value === null || value === undefined) return null;
        throw new Error(`[airtable-ts] Can't coerce formula to a number, as it was of type ${typeof value}`);
      },
    },
  },
  'string[]': {
    multipleSelects: fallbackMapperPair([], []),
    multipleRecordLinks: fallbackMapperPair([], []),
    multipleLookupValues: {
      toAirtable: () => { throw new Error('[airtable-ts] lookup type field is readonly'); },
      fromAirtable: (value) => {
        if (!Array.isArray(value)) {
          throw new Error('[airtable-ts] Failed to coerce lookup type field to a string array, as it was not an array');
        }
        if (value.some((v) => typeof v !== 'string')) {
          throw new Error('[airtable-ts] Can\'t coerce lookup to a string array, as it had non string type');
        }
        return value as string[];
      },
    },
    formula: {
      toAirtable: () => { throw new Error('[airtable-ts] formula type field is readonly'); },
      fromAirtable: (value) => {
        if (!Array.isArray(value)) {
          throw new Error('[airtable-ts] Failed to coerce formula type field to a string array, as it was not an array');
        }
        if (value.some((v) => typeof v !== 'string')) {
          throw new Error('[airtable-ts] Can\'t coerce formula to a string array, as it had non string type');
        }
        return value as string[];
      },
    },
  },
  'string[] | null': {
    multipleSelects: fallbackMapperPair(null, null),
    multipleRecordLinks: fallbackMapperPair(null, null),
    multipleLookupValues: {
      toAirtable: () => { throw new Error('[airtable-ts] lookup type field is readonly'); },
      fromAirtable: (value) => {
        if (!value && !Array.isArray(value)) {
          return null;
        }
        if (!Array.isArray(value)) {
          throw new Error('[airtable-ts] Failed to coerce lookup type field to a string array, as it was not an array');
        }
        if (value.some((v) => typeof v !== 'string')) {
          throw new Error('[airtable-ts] Can\'t coerce lookup to a string array, as it had non string type');
        }
        return value as string[];
      },
    },
    formula: {
      toAirtable: () => { throw new Error('[airtable-ts] formula type field is readonly'); },
      fromAirtable: (value) => {
        if (!value && !Array.isArray(value)) {
          return null;
        }
        if (!Array.isArray(value)) {
          throw new Error('[airtable-ts] Failed to coerce formula type field to a string array, as it was not an array');
        }
        if (value.some((v) => typeof v !== 'string')) {
          throw new Error('[airtable-ts] Can\'t coerce formula to a string array, as it had non string type');
        }
        return value as string[];
      },
    },
  },
};

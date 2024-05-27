import {
  AirtableTypeString, FromAirtableTypeString, FromTsTypeString, TsTypeString,
  parseType,
} from './typeUtils';

type Mapper = {
  [T in TsTypeString]?: {
    [A in AirtableTypeString | 'unknown']?: {
      toAirtable: (value: FromTsTypeString<T>) => FromAirtableTypeString<A>,
      fromAirtable: (value: FromAirtableTypeString<A> | null | undefined) => FromTsTypeString<T>,
    }
  }
};

const fallbackMapperPair = <T, F1, F2>(toFallback: F1, fromFallback: F2) => ({
  toAirtable: (value: T | null | undefined) => value ?? toFallback,
  fromAirtable: (value: T | null | undefined) => value ?? fromFallback,
});

const dateTimeMapperPair = {
  // Number assumed to be unix time in seconds
  toAirtable: (value: string | number | null) => {
    if (value === null) return null;
    const date = new Date(typeof value === 'number' ? value * 1000 : value);
    if (Number.isNaN(date.getTime())) {
      throw new Error('[airtable-ts] Invalid dateTime');
    }
    return date.toJSON();
  },
  fromAirtable: (value: string | null | undefined) => {
    if (value === null || value === undefined) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new Error('[airtable-ts] Invalid dateTime');
    }
    return date.toJSON();
  },
};

const readonly = (airtableType: AirtableTypeString) => () => { throw new Error(`[airtable-ts] ${airtableType} type field is readonly`); };
const coerce = <T extends TsTypeString>(airtableType: AirtableTypeString | 'unknown', tsType: T) => (value: unknown): FromTsTypeString<T> => {
  const parsedType = parseType(tsType);

  if (!parsedType.array && typeof value === parsedType.single) {
    return value as FromTsTypeString<T>;
  }

  if (parsedType.array && Array.isArray(value) && value.every((v) => typeof v === parsedType.single)) {
    return value as FromTsTypeString<T>;
  }

  if (parsedType.nullable && (value === undefined || value === null || (Array.isArray(value) && value.length === 0))) {
    return null as FromTsTypeString<T>;
  }

  if (parsedType.array && typeof value === parsedType.single) {
    return [value] as FromTsTypeString<T>;
  }

  if (!parsedType.array && Array.isArray(value) && value.length === 1 && typeof value[0] === parsedType.single) {
    return value[0] as FromTsTypeString<T>;
  }

  if (!parsedType.array && Array.isArray(value) && value.length !== 1) {
    throw new Error(`[airtable-ts] Can't coerce ${airtableType} to a ${tsType}, as there were ${value.length} array entries`);
  }

  throw new Error(`[airtable-ts] Can't coerce ${airtableType} to a ${tsType}, as it was of type ${typeof value}`);
};

const stringOrNull: Mapper = {
  'string | null': {
    url: fallbackMapperPair(null, null),
    email: fallbackMapperPair(null, null),
    phoneNumber: fallbackMapperPair(null, null),
    singleLineText: fallbackMapperPair(null, null),
    multilineText: fallbackMapperPair(null, null),
    richText: fallbackMapperPair(null, null),
    singleSelect: fallbackMapperPair(null, null),
    multipleSelects: {
      toAirtable: (value) => (value ? [value] : []),
      fromAirtable: coerce('multipleSelects', 'string | null'),
    },
    multipleRecordLinks: {
      toAirtable: (value) => (value ? [value] : []),
      fromAirtable: coerce('multipleRecordLinks', 'string | null'),
    },
    date: {
      toAirtable: (value) => dateTimeMapperPair.toAirtable(value)?.slice(0, 10) ?? null,
      fromAirtable: dateTimeMapperPair.fromAirtable,
    },
    dateTime: dateTimeMapperPair,
    createdTime: dateTimeMapperPair,
    lastModifiedTime: dateTimeMapperPair,
    multipleLookupValues: {
      toAirtable: readonly('multipleLookupValues'),
      fromAirtable: coerce('multipleLookupValues', 'string | null'),
    },
    externalSyncSource: {
      toAirtable: readonly('externalSyncSource'),
      fromAirtable: coerce('externalSyncSource', 'string | null'),
    },
    rollup: {
      toAirtable: readonly('rollup'),
      fromAirtable: coerce('rollup', 'string | null'),
    },
    formula: {
      toAirtable: readonly('formula'),
      fromAirtable: coerce('formula', 'string | null'),
    },
    unknown: {
      toAirtable: (value) => value,
      fromAirtable: coerce('unknown', 'string | null'),
    },
  },
};

const booleanOrNull: Mapper = {
  'boolean | null': {
    checkbox: fallbackMapperPair(null, null),
    multipleLookupValues: {
      toAirtable: readonly('multipleLookupValues'),
      fromAirtable: coerce('multipleLookupValues', 'boolean | null'),
    },
    unknown: {
      toAirtable: (value) => value,
      fromAirtable: coerce('unknown', 'boolean | null'),
    },
  },
};

const numberOrNull: Mapper = {
  'number | null': {
    number: fallbackMapperPair(null, null),
    rating: fallbackMapperPair(null, null),
    duration: fallbackMapperPair(null, null),
    currency: fallbackMapperPair(null, null),
    percent: fallbackMapperPair(null, null),
    count: {
      fromAirtable: (value) => value ?? null,
      toAirtable: readonly('count'),
    },
    autoNumber: {
      fromAirtable: (value) => value ?? null,
      toAirtable: readonly('autoNumber'),
    },
    date: {
      toAirtable: (value) => dateTimeMapperPair.toAirtable(value)?.slice(0, 10) ?? null,
      fromAirtable: (value) => {
        const nullableValue = dateTimeMapperPair.fromAirtable(value);
        if (nullableValue === null) return null;
        const date = new Date(nullableValue);
        if (Number.isNaN(date.getTime())) {
          throw new Error('[airtable-ts] Invalid date');
        }
        return Math.floor(date.getTime() / 1000);
      },
    },
    dateTime: {
      toAirtable: dateTimeMapperPair.toAirtable,
      fromAirtable: (value) => {
        const nullableValue = dateTimeMapperPair.fromAirtable(value);
        if (nullableValue === null) return null;
        const date = new Date(nullableValue);
        if (Number.isNaN(date.getTime())) {
          throw new Error('[airtable-ts] Invalid date');
        }
        return Math.floor(date.getTime() / 1000);
      },
    },
    createdTime: {
      toAirtable: dateTimeMapperPair.toAirtable,
      fromAirtable: (value) => {
        const nullableValue = dateTimeMapperPair.fromAirtable(value);
        if (nullableValue === null) return null;
        const date = new Date(nullableValue);
        if (Number.isNaN(date.getTime())) {
          throw new Error('[airtable-ts] Invalid date');
        }
        return Math.floor(date.getTime() / 1000);
      },
    },
    lastModifiedTime: {
      toAirtable: dateTimeMapperPair.toAirtable,
      fromAirtable: (value) => {
        const nullableValue = dateTimeMapperPair.fromAirtable(value);
        if (nullableValue === null) return null;
        const date = new Date(nullableValue);
        if (Number.isNaN(date.getTime())) {
          throw new Error('[airtable-ts] Invalid date');
        }
        return Math.floor(date.getTime() / 1000);
      },
    },
    multipleLookupValues: {
      toAirtable: readonly('multipleLookupValues'),
      fromAirtable: coerce('multipleLookupValues', 'number | null'),
    },
    rollup: {
      toAirtable: readonly('rollup'),
      fromAirtable: coerce('rollup', 'number | null'),
    },
    formula: {
      toAirtable: readonly('formula'),
      fromAirtable: coerce('formula', 'number | null'),
    },
    unknown: {
      toAirtable: (value) => value,
      fromAirtable: coerce('unknown', 'number | null'),
    },
  },
};

const stringArrayOrNull: Mapper = {
  'string[] | null': {
    multipleSelects: fallbackMapperPair([], []),
    multipleRecordLinks: fallbackMapperPair([], []),
    multipleLookupValues: {
      toAirtable: () => { throw new Error('[airtable-ts] lookup type field is readonly'); },
      fromAirtable: coerce('multipleLookupValues', 'string[] | null'),
    },
    formula: {
      toAirtable: () => { throw new Error('[airtable-ts] formula type field is readonly'); },
      fromAirtable: coerce('multipleLookupValues', 'string[] | null'),
    },
    unknown: {
      toAirtable: (value) => value,
      fromAirtable: coerce('unknown', 'string[] | null'),
    },
  },
};

export const fieldMappers: Mapper = {
  ...stringOrNull,
  string: {
    ...Object.fromEntries(Object.entries(stringOrNull['string | null']!).map(([airtableType, nullablePair]) => {
      return [airtableType, {
        toAirtable: nullablePair.toAirtable,
        fromAirtable: (value: null) => {
          const nullableValue = nullablePair.fromAirtable(value);
          if (nullableValue === null && ['multipleRecordLinks', 'dateTime', 'createdTime', 'lastModifiedTime'].includes(airtableType)) {
            throw new Error(`[airtable-ts] Expected non-null or non-empty value to map to string for field type ${airtableType}`);
          }
          return nullableValue ?? '';
        },
      }];
    })),
  },

  ...booleanOrNull,
  boolean: {
    ...Object.fromEntries(Object.entries(booleanOrNull['boolean | null']!).map(([airtableType, nullablePair]) => {
      return [airtableType, {
        toAirtable: nullablePair.toAirtable,
        fromAirtable: (value: null) => nullablePair.fromAirtable(value) ?? false,
      }];
    })),
  },

  ...numberOrNull,
  number: {
    ...Object.fromEntries(Object.entries(numberOrNull['number | null']!).map(([airtableType, nullablePair]) => {
      return [airtableType, {
        toAirtable: nullablePair.toAirtable,
        fromAirtable: (value: null) => {
          const nullableValue = nullablePair.fromAirtable(value);
          if (nullableValue === null) {
            throw new Error(`[airtable-ts] Expected non-null or non-empty value to map to number for field type ${airtableType}`);
          }
          return nullableValue;
        },
      }];
    })),
  },

  ...stringArrayOrNull,
  'string[]': {
    ...Object.fromEntries(Object.entries(stringArrayOrNull['string[] | null']!).map(([airtableType, nullablePair]) => {
      return [airtableType, {
        toAirtable: nullablePair.toAirtable,
        fromAirtable: (value: null) => nullablePair.fromAirtable(value) ?? [],
      }];
    })),
  },
};

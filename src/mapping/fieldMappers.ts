import {
  AirtableTypeString, FromAirtableTypeString, FromTsTypeString, TsTypeString,
  parseType,
} from './typeUtils';
import { AirtableTsError } from '../AirtableTsError';

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

const readonly = (airtableType: AirtableTypeString) => () => { throw new AirtableTsError(`${airtableType} type field is readonly`); };
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
    throw new AirtableTsError(`Can't coerce ${airtableType} to a ${tsType}, as there were ${value.length} array entries`);
  }

  throw new AirtableTsError(`Can't coerce ${airtableType} to a ${tsType}, as it was of type ${typeof value}`);
};

const dateTimeMapperPair = {
  // Number assumed to be unix time in seconds
  toAirtable: (value: string | number | null) => {
    if (value === null) return null;
    const date = new Date(typeof value === 'number' ? value * 1000 : value);
    if (Number.isNaN(date.getTime())) {
      throw new AirtableTsError('Invalid dateTime');
    }
    return date.toJSON();
  },
  fromAirtable: (value: string | null | undefined) => {
    if (value === null || value === undefined) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new AirtableTsError('Invalid dateTime');
    }
    return date.toJSON();
  },
};

const aiTextMapperPair = {
  toAirtable: readonly('aiText'),
  fromAirtable: (obj: object | null | undefined) => {
    if (!obj || typeof obj !== 'object' || !('value' in obj) || typeof obj.value !== 'string') return null;
    return obj.value;
  },
};

const barcodeMapperPair = {
  toAirtable: (value: string | null) => ({ text: value }),
  fromAirtable: (obj: object | null | undefined) => {
    if (!obj || typeof obj !== 'object' || !('text' in obj) || typeof obj.text !== 'string') return null;
    return obj.text;
  },
};

const collaboratorMapperPair = {
  toAirtable: (value: string | null) => ({ id: value }),
  fromAirtable: (obj: object | null | undefined) => {
    if (!obj || typeof obj !== 'object' || !('id' in obj) || typeof obj.id !== 'string') return null;
    return obj.id;
  },
};

const multipleCollaboratorsMapperPair = {
  toAirtable: (value: string[] | null) => value as unknown as object[],
  fromAirtable: (obj: object[] | null | undefined) => {
    return obj?.map((v) => ('id' in v && typeof v.id === 'string' ? v.id : null!)).filter(Boolean) ?? null;
  },
};

const multipleAttachmentsMapperPair = {
  toAirtable: readonly('multipleAttachments'),
  fromAirtable: (obj: object[] | null | undefined) => {
    return obj?.map((v) => ('url' in v && typeof v.url === 'string' ? v.url : null!)).filter(Boolean) ?? null;
  },
};

const buttonMapperPair = {
  toAirtable: readonly('button'),
  fromAirtable: (obj: object | null | undefined) => {
    if (!obj || typeof obj !== 'object' || !('label' in obj) || typeof obj.label !== 'string') return null;
    return obj.label;
  },
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
    aiText: aiTextMapperPair,
    barcode: barcodeMapperPair,
    button: buttonMapperPair,
    singleCollaborator: collaboratorMapperPair,
    multipleCollaborators: {
      toAirtable: (value) => (value ? multipleCollaboratorsMapperPair.toAirtable([value]) : []),
      fromAirtable: (value) => coerce('multipleCollaborators', 'string | null')(multipleCollaboratorsMapperPair.fromAirtable(value)),
    },
    createdBy: {
      toAirtable: readonly('createdBy'),
      fromAirtable: collaboratorMapperPair.fromAirtable,
    },
    lastModifiedBy: {
      toAirtable: readonly('lastModifiedBy'),
      fromAirtable: collaboratorMapperPair.fromAirtable,
    },
    multipleAttachments: {
      toAirtable: readonly('multipleAttachments'),
      fromAirtable: (value) => coerce('multipleAttachments', 'string | null')(multipleAttachmentsMapperPair.fromAirtable(value)),
    },
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
          throw new AirtableTsError('Invalid date');
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
          throw new AirtableTsError('Invalid date');
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
          throw new AirtableTsError('Invalid date');
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
          throw new AirtableTsError('Invalid date');
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
    multipleCollaborators: multipleCollaboratorsMapperPair,
    multipleAttachments: multipleAttachmentsMapperPair,
    multipleLookupValues: {
      toAirtable: () => { throw new AirtableTsError('lookup type field is readonly'); },
      fromAirtable: coerce('multipleLookupValues', 'string[] | null'),
    },
    formula: {
      toAirtable: () => { throw new AirtableTsError('formula type field is readonly'); },
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
            throw new AirtableTsError(`Expected non-null or non-empty value to map to string for field type ${airtableType}`);
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
            throw new AirtableTsError(`Expected non-null or non-empty value to map to number for field type ${airtableType}`);
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

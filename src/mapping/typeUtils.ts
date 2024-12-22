// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TsTypeString = NonNullToString<any> | ToTsTypeString<any>;

type NonNullToString<T> =
  T extends string ? 'string' :
    T extends number ? 'number' :
      T extends boolean ? 'boolean' :
        T extends number[] ? 'number[]' :
          T extends string[] ? 'string[]' :
            T extends boolean[] ? 'boolean[]' :
              never;

export type ToTsTypeString<T> =
  null extends T ? `${NonNullToString<T>} | null` : NonNullToString<T>;

export type FromTsTypeString<T> =
  T extends 'string' ? string :
    T extends 'string | null' ? string | null :
      T extends 'number' ? number :
        T extends 'number | null' ? number | null :
          T extends 'boolean' ? boolean :
            T extends 'boolean | null' ? boolean | null :
              T extends 'string[]' ? string[] :
                T extends 'string[] | null' ? string[] | null :
                  T extends 'number[]' ? number[] :
                    T extends 'number[] | null' ? number[] | null :
                      T extends 'boolean[]' ? boolean[] :
                        T extends 'boolean[] | null' ? boolean[] | null :
                          never;

export type AirtableTypeString =
  | 'aiText'
  | 'autoNumber'
  | 'barcode'
  | 'button'
  | 'checkbox'
  | 'count'
  | 'createdBy'
  | 'createdTime'
  | 'currency'
  | 'date'
  | 'dateTime'
  | 'duration'
  | 'email'
  | 'externalSyncSource'
  | 'formula'
  | 'lastModifiedBy'
  | 'lastModifiedTime'
  | 'lookup'
  | 'multipleLookupValues'
  | 'multilineText'
  | 'multipleAttachments'
  | 'multipleCollaborators'
  | 'multipleRecordLinks'
  | 'multipleSelects'
  | 'number'
  | 'percent'
  | 'phoneNumber'
  | 'rating'
  | 'richText'
  | 'rollup'
  | 'singleCollaborator'
  | 'singleLineText'
  | 'singleSelect'
  | 'url';

// Should map an AirtableTypeString to its cell format, as per
// https://airtable.com/developers/web/api/field-model
export type FromAirtableTypeString<T extends AirtableTypeString | 'unknown'> =
  // All Airtable types are actually nullable
  | null
  | (
    T extends
    | 'url'
    | 'email'
    | 'phoneNumber'
    | 'singleLineText'
    | 'multilineText'
    | 'richText'
    | 'singleSelect'
    | 'externalSyncSource'
    | 'date'
    | 'dateTime'
    | 'createdTime'
    | 'lastModifiedTime'
      ? string :
      T extends
      | 'multipleRecordLinks'
      | 'multipleSelects'
        ? string[] :
        T extends
        | 'number'
        | 'rating'
        | 'duration'
        | 'currency'
        | 'percent'
        | 'count'
        | 'autoNumber'
          ? number :
          T extends
          | 'checkbox'
            ? boolean :
            T extends
            | 'lookup'
            | 'multipleLookupValues'
            | 'rollup'
            | 'formula'
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ? FromAirtableTypeString<any>[] :
              T extends
              | 'aiText'
              | 'barcode'
              | 'singleCollaborator'
              | 'createdBy'
              | 'modifiedBy'
              | 'button'
                ? object :
                T extends
                | 'multipleCollaborators'
                | 'multipleAttachments'
                  ? object[] :
                  T extends
                  | 'unknown'
                    ? unknown
                    : never);

interface TypeDef {
  single: 'string' | 'number' | 'boolean',
  array: boolean,
  nullable: boolean,
}

export const parseType = (t: TsTypeString): TypeDef => {
  if (t.endsWith('[] | null')) {
    return {
      single: t.slice(0, -('[] | null'.length)) as TypeDef['single'],
      array: true,
      nullable: true,
    };
  }

  if (t.endsWith('[]')) {
    return {
      single: t.slice(0, -('[]'.length)) as TypeDef['single'],
      array: true,
      nullable: false,
    };
  }

  if (t.endsWith(' | null')) {
    return {
      single: t.slice(0, -(' | null'.length)) as TypeDef['single'],
      array: false,
      nullable: true,
    };
  }

  return {
    single: t as TypeDef['single'],
    array: false,
    nullable: false,
  };
};

/**
 * Verifies whether the given value is assignable to the given type
 *
 * @param value
 * @example [1, 2, 3]
 *
 * @param tsType
 * @example 'number[]'
 *
 * @returns
 * @example true
 */
export const matchesType = (value: unknown, tsType: TsTypeString): boolean => {
  const expectedType = parseType(tsType);

  if (expectedType.nullable && value === null) {
    return true;
  }

  if (!expectedType.array && typeof value === expectedType.single) {
    return true;
  }

  return (
    expectedType.array
    && Array.isArray(value)
    && (value as unknown[]).every((entry) => typeof entry === expectedType.single)
  );
};

/**
 * Returns a single type for an array type
 *
 * @param tsType
 * @example 'string[]'
 *
 * @returns
 * @example 'string'
 */
const arrayToSingleType = (tsType: TsTypeString): TsTypeString => {
  if (tsType.endsWith('[] | null')) {
    // This results in:
    // string[] | null -> string | null
    // Going the other way might not work - e.g. we'd get (string | null)[]
    return `${tsType.slice(0, -'[] | null'.length)} | null` as TsTypeString;
  }
  if (tsType.endsWith('[]')) {
    return tsType.slice(0, -'[]'.length) as TsTypeString;
  }
  throw new Error(`[airtable-ts] Not an array type: ${tsType}`);
};

/**
 * Constructs a TypeScript object type definition given a table definition
 *
 * @param table Table definition
 * @example {
 *            schema: { someProp: 'string', otherProps: 'number[]', another: 'boolean' },
 *            mappings: { someProp: 'Some_Airtable_Field', otherProps: ['Field1', 'Field2'], another: 'another' },
 *            ...
 *          }
 *
 * @returns The TypeScript object type we expect the Airtable record to coerce to
 * @example {
 *            Some_Airtable_Field: 'string',
 *            Field1: 'number',
 *            Field2: 'number',
 *            another: 'boolean',
 *          }
 */
export const airtableFieldNameTsTypes = <T extends Item>(table: Table<T>): Record<string, TsTypeString> => {
  const schemaEntries = Object.entries(table.schema) as [keyof Omit<T, 'id'>, TsTypeString][];

  return Object.fromEntries(
    schemaEntries.map(([outputFieldName, tsType]) => {
      const mappingToAirtable = table.mappings?.[outputFieldName];
      if (!mappingToAirtable) {
        return [[outputFieldName, tsType]];
      }

      if (Array.isArray(mappingToAirtable)) {
        return mappingToAirtable.map((airtableFieldName) => [airtableFieldName, arrayToSingleType(tsType)]);
      }

      return [[mappingToAirtable, tsType]];
    }).flat(1),
  );
};

// Value for possible field mapping
// For arrays, this may be:
// - an array of field names or field ids (each holding a single value of the array type); or
// - one field name or field id (holding an array of values of the correct type)
// Otherwise this must be a single field name
export type MappingValue<T> = T extends unknown[] ? string | string[] : string;

export interface Item {
  /** Represents the Airtable record id, @example "rec1234" */
  id: string
}

export interface Table<T extends Item> {
  /** A simple name for the entities in this table, to be used in error messages @example "person" */
  name: string,
  /** The base id for this table. You can get this from the URL when accessing the table in the web UI. @example "app1234" */
  baseId: string,
  /** The table id for this table. You can get this from the URL when accessing the table in the web UI. @example "tbl1234" */
  tableId: string,
  /** The schema. We need to define this as a real object (rather than a type) because we do checks at run-time. You should usually be able to just take the autocomplete suggestions (provided you gave a TypeScript type already). */
  schema: { [k in keyof Omit<T, 'id'>]: ToTsTypeString<T[k]> },
  /**
   * Optional name mappings. This allows you to detach the schema names from the names you want to use in your code.
   * @example
   * export const personTable: Table<{ id: string, firstName: string }> = {
   *   name: 'person', baseId: 'app1234', tableId: 'tbl1234',
   *   schema: { firstName: 'string' },
   *   // The field is named '[core] First Name' in the base. If this ever changes, we just need to update it here.
   *   mappings: { firstName: '[core] First Name' },
   * };
   * const people = await db.scan(studentTable);
   * const firstPersonsFirstName = people[0].firstName;
   * */
  mappings?: { [k in keyof Omit<T, 'id'>]: MappingValue<T[k]> }
}

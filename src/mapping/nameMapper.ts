import {
  Item, Table, FromTsTypeString, TsTypeString,
} from './typeUtils';

/**
 * Maps a TS object (matching table.mappings) to another TS object (matching table.schema),
 * mapping columns based on the table definition.
 *
 * @param table Table definition
 * @example {
 *            schema: { someProp: 'string', otherProps: 'number[]', another: 'boolean' },
 *            mappings: { someProp: 'Some_Airtable_Field', otherProps: ['Field1', 'Field2'], another: 'another' },
 *            ...
 *          }
 *
 * @param tsRecord The TS object to map
 * @example {
 *            Some_Airtable_Field: 'abcd',
 *            Field1: 314,
 *            Field2: 159,
 *            another: true,
 *          }
 *
 * @returns The TS object mapped via the table.mappings
 * @example {
 *            someProp: 'abcd',
 *            otherProps: [314, 159],
 *            another: true,
 *          }
 */
export const mapRecordFieldNamesAirtableToTs = <T extends Item>(table: Table<T>, tsRecord: Record<string, FromTsTypeString<TsTypeString>>): T => {
  const schemaEntries = Object.entries(table.schema) as [keyof Omit<T, 'id'> & string, TsTypeString][];

  const item = Object.fromEntries(
    schemaEntries.map(([outputFieldName]) => {
      const mappingToAirtable = table.mappings?.[outputFieldName];
      if (!mappingToAirtable) {
        return [outputFieldName, tsRecord[outputFieldName]];
      }

      if (Array.isArray(mappingToAirtable)) {
        return [outputFieldName, mappingToAirtable.map((airtableFieldName) => tsRecord[airtableFieldName])];
      }

      return [outputFieldName, tsRecord[mappingToAirtable as string]];
    }),
  );

  return Object.assign(item, { id: tsRecord['id'] });
};

/**
 * Maps a TS object (matching table.schema) to another TS object (matching table.mappings),
 * mapping columns based on the table definition.
 *
 * @param table Table definition
 * @example {
 *            schema: { someProp: 'string', otherProps: 'number[]', another: 'boolean' },
 *            mappings: { someProp: 'Some_Airtable_Field', otherProps: ['Field1', 'Field2'] },
 *            ...
 *          }
 *
 * @param item The TS object to map
 * @example {
 *            someProp: 'abcd',
 *            otherProps: [314, 159],
 *            another: true,
 *          }
 *
 * @returns The TS object mapped via the table.mappings
 * @example {
 *            Some_Airtable_Field: 'abcd',
 *            Field1: 314,
 *            Field2: 159,
 *            another: true,
 *          }
 */
export const mapRecordFieldNamesTsToAirtable = <T extends Item>(table: Table<T>, item: Partial<T>): Record<string, FromTsTypeString<TsTypeString>> => {
  const schemaEntries = Object.entries(table.schema) as [keyof Omit<T, 'id'> & string, TsTypeString][];

  const tsRecord = Object.fromEntries(
    schemaEntries.map(([outputFieldName, tsType]) => {
      const mappingToAirtable = table.mappings?.[outputFieldName];
      if (!(outputFieldName in item)) {
        // If we don't have the field, just skip: this allows us to support partial updates
        return [];
      }
      const value = item[outputFieldName];

      if (!mappingToAirtable) {
        return [[outputFieldName, value]];
      }

      if (Array.isArray(mappingToAirtable)) {
        if (value === null) {
          if (tsType.endsWith('| null')) {
            return mappingToAirtable.map((airtableFieldName) => [airtableFieldName, null]);
          }

          // This should be unreachable because of our types
          throw new Error(`[airtable-ts] Expected field ${table.name}.${outputFieldName} to match type \`${tsType}\` but got null. This should never happen in normal operation as it should be caught before this point.`);
        }

        if (!Array.isArray(value)) {
          throw new Error(`[airtable-ts] Got non-array type ${typeof value} for ${table.name}.${outputFieldName}, but expected ${table.schema[outputFieldName]}.`);
        }

        if (value.length !== mappingToAirtable.length) {
          throw new Error(`[airtable-ts] Got ${value.length} values for ${table.name}.${outputFieldName}, but ${mappingToAirtable.length} mappings. Expected these to be the same.`);
        }

        return mappingToAirtable.map((airtableFieldName, index) => [airtableFieldName, value[index]]);
      }

      return [[mappingToAirtable, value]];
    }).flat(1),
  );

  return Object.assign(tsRecord, { id: item.id });
};

import { FieldSet } from 'airtable';
import { AirtableRecord, AirtableTable } from '../types';
import { fieldMappers } from './fieldMappers';
import { mapRecordFieldNamesAirtableToTs, mapRecordFieldNamesTsToAirtable } from './nameMapper';
import {
  airtableFieldNameTsTypes, AirtableTypeString, FromTsTypeString, Item, matchesType, Table, TsTypeString,
} from './typeUtils';
import { AirtableTsError } from '../AirtableTsError';

const getMapper = (tsType: TsTypeString, airtableType: string) => {
  const tsMapper = fieldMappers[tsType];

  if (!tsMapper) {
    throw new AirtableTsError(`No mappers for ts type ${tsType}`);
  }

  if (tsMapper[airtableType as AirtableTypeString]) {
    return tsMapper[airtableType as AirtableTypeString]!;
  }

  if (tsMapper.unknown) {
    console.warn(`[airtable-ts] Unknown airtable type ${airtableType}. This is not fully supported and exact mapping behaviour may change in a future release.`);
    return tsMapper.unknown;
  }

  throw new AirtableTsError(`Expected to be able to map to ts type ${tsType}, but got airtable type ${airtableType} which can't.`);
};

/**
 * This function coerces an Airtable record to a TypeScript object, given an
 * object type definition.  It will do this using the field mappers on each
 * field, based on the tsTypes and Airtable table schema (via the record).
 * It does NOT change any property names.
 *
 * @param tsTypes TypeScript types for the record.
 * @example { a: 'string', b: 'number', c: 'boolean', d: 'string' }
 *
 * @param record The Airtable record to convert.
 * @example { id: 'rec012', a: 'Some text', b: 123, d: ['rec345'] } // (c is an un-ticked checkbox, d is a multipleRecordLinks)
 *
 * @returns An object matching the TypeScript type passed in, based on the Airtable record. Throws if cannot coerce to requested type.
 * @example { id: 'rec012', a: 'Some text', b: 123, c: false, d: 'rec345' }
 */
const mapRecordTypeAirtableToTs = <
  T extends { [fieldNameOrId: string]: TsTypeString },
>(
    tsTypes: T,
    record: AirtableRecord,
  ): ({ [F in keyof T]: FromTsTypeString<T[F]> } & { id: string }) => {
  const item = {} as { [F in keyof T]: FromTsTypeString<T[F]> };

  (Object.entries(tsTypes) as [keyof T & string, TsTypeString][]).forEach(([fieldNameOrId, tsType]) => {
    // eslint-disable-next-line no-underscore-dangle
    const fieldDefinition = record._table.fields.find((f) => f.id === fieldNameOrId || f.name === fieldNameOrId);
    if (!fieldDefinition) {
      throw new AirtableTsError(`Failed to get Airtable field ${fieldNameOrId}`);
    }

    const value = record.fields[fieldDefinition.name];

    try {
      const { fromAirtable } = getMapper(tsType, fieldDefinition.type);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      item[fieldNameOrId] = fromAirtable(value as any) as FromTsTypeString<T[keyof T]>;
    } catch (error) {
      if (error instanceof Error) {
        // eslint-disable-next-line no-underscore-dangle
        error.message = `Failed to map field ${record._table.name}.${fieldNameOrId}: ${error.message}`;
        // eslint-disable-next-line no-underscore-dangle
        error.stack = `Error: Failed to map field ${record._table.name}.${fieldNameOrId}: ${error.stack?.startsWith('Error: ') ? error.stack.slice('Error: '.length) : error.stack}`;
      }
      throw error;
    }
  });

  return Object.assign(item, { id: record.id });
};

/**
 * This function coerces a TypeScript object to a Airtable record, given an
 * Airtable table. It will do this using the field mappers on each field, based
 * on the tsTypes and Airtable table schema.
 * It does NOT change any property names.
 *
 * @param tsTypes TypeScript types for the record (necessary to handle nullables).
 * @example { a: 'string', b: 'number', c: 'boolean', d: 'string' }
 *
 * @param tsRecord TypeScript object to convert.
 * @example { a: 'Some text', b: 123, c: false, d: 'rec123' }
 *
 * @param airtableTable An Airtable table.
 * @example { fields: { a: 'singleLineText', b: 'number', c: 'checkbox', d: 'multipleRecordLinks' }, ... }
 *
 * @returns An Airtable FieldSet. Throws if cannot coerce to requested type.
 * @example { a: 'Some text', b: 123, d: ['rec123'] } // (c is an un-ticked checkbox, d is a multipleRecordLinks)
 */
const mapRecordTypeTsToAirtable = <
  T extends { [fieldNameOrId: string]: TsTypeString },
  R extends { [K in keyof T]?: FromTsTypeString<T[K]> } & { id?: string },
>(
    tsTypes: T,
    tsRecord: R,
    airtableTable: AirtableTable,
  ): FieldSet => {
  const item = {} as FieldSet;

  (Object.entries(tsTypes) as [keyof T & string, TsTypeString][]).forEach(([fieldNameOrId, tsType]) => {
    const value = tsRecord[fieldNameOrId];

    if (!(fieldNameOrId in tsRecord)) {
      // If we don't have the field, just skip: this allows us to support partial updates
      return;
    }

    if (!matchesType(value, tsType)) {
      // This should be unreachable because of our types
      throw new AirtableTsError(`Expected field ${airtableTable.name}.${fieldNameOrId} to match type \`${tsType}\` but got value \`${JSON.stringify(value)}\`. This should never happen in normal operation as it should be caught before this point.`);
    }

    // eslint-disable-next-line no-underscore-dangle
    const fieldDefinition = airtableTable.fields.find((f) => f.id === fieldNameOrId || f.name === fieldNameOrId);
    if (!fieldDefinition) {
      throw new AirtableTsError(`Failed to get Airtable field ${fieldNameOrId}`);
    }

    try {
      const { toAirtable } = getMapper(tsType, fieldDefinition.type);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      item[fieldNameOrId] = (toAirtable as any)(value);
    } catch (error) {
      if (error instanceof Error) {
        // eslint-disable-next-line no-underscore-dangle
        error.message = `Failed to map field ${airtableTable.name}.${fieldNameOrId}: ${error.message}`;
        // eslint-disable-next-line no-underscore-dangle
        error.stack = `Error: Failed to map field ${airtableTable.name}.${fieldNameOrId}: ${error.stack?.startsWith('Error: ') ? error.stack.slice('Error: '.length) : error.stack}`;
      }
      throw error;
    }
  });

  return Object.assign(item, { id: tsRecord.id });
};

export const mapRecordFromAirtable = <T extends Item>(
  table: Table<T>,
  record: AirtableRecord,
) => {
  const tsTypes = airtableFieldNameTsTypes(table);
  const tsRecord = mapRecordTypeAirtableToTs(tsTypes, record);
  const mappedRecord = mapRecordFieldNamesAirtableToTs(table, tsRecord);
  return mappedRecord;
};

export const mapRecordToAirtable = <T extends Item>(
  table: Table<T>,
  item: Partial<T>,
  airtableTable: AirtableTable,
): FieldSet => {
  const mappedItem = mapRecordFieldNamesTsToAirtable(table, item);
  const tsTypes = airtableFieldNameTsTypes(table);
  const fieldSet = mapRecordTypeTsToAirtable(tsTypes, mappedItem, airtableTable);
  return fieldSet;
};

export const visibleForTesting = {
  mapRecordTypeAirtableToTs,
  mapRecordTypeTsToAirtable,
};

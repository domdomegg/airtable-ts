import {
	type Item, type Table, type FromTsTypeString, type TsTypeString,
} from './typeUtils';
import {AirtableTsError, ErrorType} from '../AirtableTsError';

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

	const item = Object.fromEntries(schemaEntries.map(([outputFieldName]) => {
		const mappingToAirtable = table.mappings?.[outputFieldName];
		if (!mappingToAirtable) {
			return [outputFieldName, tsRecord[outputFieldName]];
		}

		if (Array.isArray(mappingToAirtable)) {
			return [outputFieldName, mappingToAirtable.map((airtableFieldName) => tsRecord[airtableFieldName])];
		}

		// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
		return [outputFieldName, tsRecord[mappingToAirtable as keyof typeof tsRecord]];
	}));

	return Object.assign(item, {id: tsRecord.id});
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

	const tsRecord = Object.fromEntries(schemaEntries.map(([outputFieldName, tsType]) => {
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
				throw new AirtableTsError({
					message: `Received null for non-nullable field '${outputFieldName}' (${JSON.stringify(mappingToAirtable)}) with type '${tsType}' in table '${table.name}' (${table.tableId}). This should never happen in normal operation as it should be caught before this point.`,
					type: ErrorType.SCHEMA_VALIDATION,
				});
			}

			if (!Array.isArray(value)) {
				throw new AirtableTsError({
					message: `Expected an array for field '${outputFieldName}' (${JSON.stringify(mappingToAirtable)}) in table '${table.name}' (${table.tableId}), but received ${typeof value}.`,
					type: ErrorType.SCHEMA_VALIDATION,
				});
			}

			if (value.length !== mappingToAirtable.length) {
				throw new AirtableTsError({
					message: `Array length mismatch for field '${outputFieldName}' (${JSON.stringify(mappingToAirtable)}) in table '${table.name}' (${table.tableId}): received ${value.length} values but had mappings for ${mappingToAirtable.length}.`,
					type: ErrorType.SCHEMA_VALIDATION,
					suggestion: 'Ensure the array length matches the number of mapped fields in your table definition.',
				});
			}

			return mappingToAirtable.map((airtableFieldName, index) => [airtableFieldName, value[index]]);
		}

		return [[mappingToAirtable, value]];
	}).flat(1));

	return Object.assign(tsRecord, {id: item.id});
};

import {
	describe, test, expect, vi,
} from 'vitest';
import {type AirtableRecord, type AirtableTsTable} from '../types';
import {mapRecordFromAirtable, mapRecordToAirtable, visibleForTesting} from './recordMapper';
import {type Table} from './typeUtils';

const {
	mapRecordTypeAirtableToTs,
	mapRecordTypeTsToAirtable,
} = visibleForTesting;

const mockTableDefinition: Table<{id: string; a: string; b: number; c: boolean; d: string}> = {
	name: 'example',
	baseId: 'app123',
	tableId: 'tbl456',
	schema: {
		a: 'string',
		b: 'number',
		c: 'boolean',
		d: 'string',
	},
	mappings: {
		a: 'fld123',
		b: 'fld456',
		c: 'fld789',
		d: 'fld012',
	},
};

const mockAirtableTsTable = {
	name: 'example',
	fields: [
		{id: 'fld123', name: 'a', type: 'singleLineText'},
		{id: 'fld456', name: 'b', type: 'number'},
		{id: 'fld789', name: 'c', type: 'checkbox'},
		{id: 'fld012', name: 'd', type: 'multipleRecordLinks'},
	],
} as unknown as AirtableTsTable;

describe('mapRecordFromAirtable', () => {
	test('should include table name, table ID, and record ID in error message when field mapping fails', () => {
		// GIVEN
		// Create a mock record with a field that doesn't exist in the table definition
		const mockRecord = {
			id: 'rec123',
			fields: {
				nonExistentField: 'value', // This field doesn't exist in the table definition
			},
			_table: {
				fields: [
					{id: 'nonExistentField', name: 'nonExistentField', type: 'singleLineText'},
				],
			},
		} as unknown as AirtableRecord;

		// WHEN
		const expr = () => mapRecordFromAirtable(mockTableDefinition, mockRecord);

		// THEN
		expect(expr).toThrow(/Failed to map record from Airtable format for table 'example' \(tbl456\) and record rec123: Field 'fld123' does not exist in the table definition/);
	});

	test('should include details of why mapping failed when available', () => {
		// GIVEN
		const tableWithCustomMapping: Table<{id: string; someNumber: number | null}> = {
			name: 'example',
			baseId: 'app123',
			tableId: 'tbl456',
			schema: {
				someNumber: 'number | null',
			},
			mappings: {
				someNumber: 'fld123',
			},
		};

		// Create a record with a field that doesn't exist in the table
		const mockRecord = {
			id: 'rec123',
			fields: {
				someText: 'value', // This should be a number, not a string
			},
			_table: {
				fields: [
					{id: 'fld123', name: 'someText', type: 'singleLineText'},
				],
			},
		} as unknown as AirtableRecord;

		// WHEN
		const expr = () => mapRecordFromAirtable(tableWithCustomMapping, mockRecord);

		// THEN
		expect(expr).toThrow(/Failed to map record from Airtable format for table 'example' \(tbl456\) and record rec123: Failed to map field someNumber \(fld123\) from Airtable: Cannot convert value from airtable type 'unknown' to 'number \| null', as the Airtable API provided a 'string'/);
	});

	describe('`readValidation` set to \'warning\'', () => {
		const exampleTableDeletedFieldPresent: Table<{
			id: string;
			field1: string;
			field2: string;
			deletedField: string | null;
		}> = {
			name: 'example',
			baseId: 'appExample123',
			tableId: 'tblExample456',
			schema: {
				field1: 'string',
				field2: 'string',
				deletedField: 'string | null',
			},
			mappings: {
				field1: 'fldAbc123',
				field2: 'fldDef456',
				deletedField: 'fldDeleted789', // This field was deleted from Airtable
			},
		};

		const mockRecordDeletedFieldMissing = {
			id: 'recExample001',
			fields: {
				field1: 'value1',
				field2: 'value2',
				// deletedField is not present
			},
			_table: {
				fields: [
					{id: 'fldAbc123', name: 'field1', type: 'singleLineText'},
					{id: 'fldDef456', name: 'field2', type: 'singleLineText'},
					// No fldDeleted789
				],
			},
		} as unknown as AirtableRecord;

		const exampleTableBooleanFieldPresent: Table<{
			id: string;
			textField: string;
			booleanField: boolean | null; // Schema expects boolean (checkbox)
		}> = {
			name: 'example',
			baseId: 'appExample123',
			tableId: 'tblExample789',
			schema: {
				textField: 'string',
				booleanField: 'boolean | null',
			},
			mappings: {
				textField: 'fldText123',
				booleanField: 'fldBool456', // This field's type changed in Airtable
			},
		};

		const mockRecordBooleanFieldReturnsNumber = {
			id: 'recExample002',
			fields: {
				textField: 'some text',
				booleanField: 1, // Type changed to number in Airtable
			},
			_table: {
				fields: [
					{id: 'fldText123', name: 'textField', type: 'singleLineText'},
					{id: 'fldBool456', name: 'booleanField', type: 'number'}, // Type changed to number
				],
			},
		} as unknown as AirtableRecord;

		test('should gracefully continue if field is deleted from Airtable but still in schema, and call `onWarning` with the error', () => {
			// GIVEN
			// `exampleTableDeletedFieldPresent` and `mockRecordDeletedFieldMissing` defined above
			const warnings: unknown[] = [];
			const onWarning = (error: unknown) => {
				warnings.push(error);
			};

			// WHEN
			// Use warning mode with onWarning callback
			const result = mapRecordFromAirtable(exampleTableDeletedFieldPresent, mockRecordDeletedFieldMissing, {
				readValidation: 'warning',
				onWarning,
			});

			// THEN
			// Should return partial record with available data and default value for deleted field
			expect(result).toEqual({
				id: 'recExample001',
				field1: 'value1',
				field2: 'value2',
				deletedField: null, // Nullable type defaults to null
			});

			expect(warnings).toHaveLength(1);
			expect(warnings[0]).toMatchObject({
				message: expect.stringContaining('Field \'fldDeleted789\' does not exist in the table definition'),
			});
		});

		test('should gracefully continue if field type is different between Airtable and the schema, and call `onWarning` with the error', () => {
		// GIVEN
		// `exampleTableBooleanFieldPresent` and `mockRecordBooleanFieldReturnsNumber` defined above
			const warnings: unknown[] = [];
			const onWarning = (error: unknown) => {
				warnings.push(error);
			};

			// WHEN
			// Use warning mode with onWarning callback
			const result = mapRecordFromAirtable(exampleTableBooleanFieldPresent, mockRecordBooleanFieldReturnsNumber, {
				readValidation: 'warning',
				onWarning,
			});

			// THEN
			expect(result).toEqual({
				id: 'recExample002',
				textField: 'some text',
				booleanField: null, // Nullable type defaults to null
			});

			// Should have called onWarning with an error about the type mismatch
			expect(warnings).toHaveLength(1);
			expect(warnings[0]).toMatchObject({
				message: expect.stringContaining('Failed to map field booleanField (fldBool456) from Airtable'),
			});
		});

		test('should silently proceed on validation errors if there is no `onWarning` callback', () => {
			// GIVEN
			// `exampleTableDeletedFieldPresent` and `mockRecordDeletedFieldMissing` defined above

			// WHEN
			// Use warning mode WITHOUT onWarning callback
			const result = mapRecordFromAirtable(exampleTableDeletedFieldPresent, mockRecordDeletedFieldMissing, {
				readValidation: 'warning',
			});

			// THEN
			// Should return partial record without throwing
			expect(result).toEqual({
				id: 'recExample001',
				field1: 'value1',
				field2: 'value2',
				deletedField: null, // Nullable type defaults to null
			});
		});

		test('should silently proceed if there are errors in the `onWarning` callback itself', () => {
			// GIVEN
			// `exampleTableDeletedFieldPresent` and `mockRecordDeletedFieldMissing` defined above

			const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
			const onWarning = () => {
				throw new Error('onWarning callback failed!');
			};

			// WHEN
			// Use warning mode with a throwing onWarning callback
			const result = mapRecordFromAirtable(exampleTableDeletedFieldPresent, mockRecordDeletedFieldMissing, {
				readValidation: 'warning',
				onWarning,
			});

			// THEN
			expect(result).toEqual({
				id: 'recExample001',
				field1: 'value1',
				field2: 'value2',
				deletedField: null, // Nullable type defaults to null
			});

			expect(consoleErrorSpy).toHaveBeenCalledWith(
				'[airtable-ts] Error in onWarning callback:',
				expect.objectContaining({message: 'onWarning callback failed!'}),
			);

			consoleErrorSpy.mockRestore();
		});

		test('should return appropriate default values for different types when validation fails', () => {
			// GIVEN - Table with multiple field types
			const multiTypeTable: Table<{
				id: string;
				stringField: string;
				nullableStringField: string | null;
				numberField: number;
				nullableNumberField: number | null;
				booleanField: boolean;
				nullableBooleanField: boolean | null;
				arrayField: string[];
				nullableArrayField: string[] | null;
			}> = {
				name: 'multiType',
				baseId: 'appMulti123',
				tableId: 'tblMulti456',
				schema: {
					stringField: 'string',
					nullableStringField: 'string | null',
					numberField: 'number',
					nullableNumberField: 'number | null',
					booleanField: 'boolean',
					nullableBooleanField: 'boolean | null',
					arrayField: 'string[]',
					nullableArrayField: 'string[] | null',
				},
				mappings: {
					stringField: 'fldStr1',
					nullableStringField: 'fldStr2',
					numberField: 'fldNum1',
					nullableNumberField: 'fldNum2',
					booleanField: 'fldBool1',
					nullableBooleanField: 'fldBool2',
					arrayField: 'fldArr1',
					nullableArrayField: 'fldArr2',
				},
			};

			// Record with all fields deleted from Airtable (simulating validation failures)
			const mockRecordWithNoFields = {
				id: 'recMulti001',
				fields: {},
				_table: {
					fields: [],
				},
			} as unknown as AirtableRecord;

			// WHEN
			const result = mapRecordFromAirtable(multiTypeTable, mockRecordWithNoFields, {
				readValidation: 'warning',
			});

			// THEN Each field should have its type-appropriate default value
			expect(result).toEqual({
				id: 'recMulti001',
				stringField: '',
				nullableStringField: null,
				numberField: 0,
				nullableNumberField: null,
				booleanField: false,
				nullableBooleanField: null,
				arrayField: [],
				nullableArrayField: null,
			});
		});
	});
});

describe('mapRecordToAirtable', () => {
	test('should include table name and table ID in error message when field mapping fails', () => {
		// GIVEN
		const invalidItem = {
			a: 'Some text',
			b: 'not a number', // This will cause a type error
			c: false,
			d: 'rec345',
		};

		// WHEN
		// @ts-expect-error: We're intentionally passing an invalid item to test error handling
		const expr = () => mapRecordToAirtable(mockTableDefinition, invalidItem, mockAirtableTsTable);

		// THEN
		expect(expr).toThrow(/Failed to map record to Airtable format for table 'example' \(tbl456\): Type mismatch for field 'fld456': expected number but got a string/);
	});

	test('should handle non-existent field errors with table details', () => {
		// GIVEN
		// Create a table definition with a field that doesn't exist in the Airtable table
		const tableWithNonExistentField: Table<{id: string; nonExistent: string}> = {
			name: 'missing-field-example',
			baseId: 'app123',
			tableId: 'tbl101',
			schema: {
				nonExistent: 'string',
			},
			mappings: {
				nonExistent: 'fld123',
			},
		};

		const emptyAirtableTsTable = {
			name: 'missing-field-example',
			fields: [], // No fields defined
		} as unknown as AirtableTsTable;

		// WHEN
		const expr = () => mapRecordToAirtable(
			tableWithNonExistentField,
			{nonExistent: 'test'},
			emptyAirtableTsTable,
		);

		// THEN
		expect(expr).toThrow(/Failed to map record to Airtable format for table 'missing-field-example' \(tbl101\): Field nonExistent \(fld123\) does not exist in the Airtable table/);
	});
});

describe('mapRecordTypeAirtableToTs', () => {
	test('example', () => {
		// GIVEN
		const tsTypes = {
			a: 'string',
			b: 'number',
			c: 'boolean',
			d: 'string',
		} as const;
		const airtableRecord = {
			id: 'rec012',
			fields: {
				a: 'Some text',
				b: 123,
				// c is an un-ticked checkbox
				d: ['rec345'],
			},
			_table: mockAirtableTsTable,
		} as unknown as AirtableRecord;

		// WHEN
		const result = mapRecordTypeAirtableToTs(mockTableDefinition, tsTypes, airtableRecord);

		// THEN
		expect(result).toEqual({
			id: 'rec012',
			a: 'Some text',
			b: 123,
			c: false,
			d: 'rec345',
		});
	});
});

describe('mapRecordTypeTsToAirtable', () => {
	test('example with id', () => {
		// GIVEN
		const tsTypes = {
			a: 'string',
			b: 'number',
			c: 'boolean',
			d: 'string',
		} as const;
		const tsRecord = {
			id: 'rec012',
			a: 'Some text',
			b: 123,
			c: false,
			d: 'rec345',
		};

		// WHEN
		const result = mapRecordTypeTsToAirtable(mockTableDefinition, tsTypes, tsRecord, mockAirtableTsTable);

		// THEN
		expect(result).toEqual({
			id: 'rec012',
			a: 'Some text',
			b: 123,
			c: false,
			d: ['rec345'],
		});
	});

	test('example without id', () => {
		// GIVEN
		const tsTypes = {
			a: 'string',
			b: 'number',
			c: 'boolean',
			d: 'string',
		} as const;
		const tsRecord = {
			a: 'Some text',
			b: 123,
			c: false,
			d: 'rec345',
		};

		// WHEN
		const result = mapRecordTypeTsToAirtable(mockTableDefinition, tsTypes, tsRecord, mockAirtableTsTable);

		// THEN
		expect(result).toEqual({
			a: 'Some text',
			b: 123,
			c: false,
			d: ['rec345'],
		});
	});

	test('example with partial', () => {
		// GIVEN
		const tsTypes = {
			a: 'string',
			b: 'number',
			c: 'boolean',
			d: 'string',
		} as const;
		const tsRecord = {
			id: 'rec012',
			c: false,
			d: 'rec345',
		};

		// WHEN
		const result = mapRecordTypeTsToAirtable(mockTableDefinition, tsTypes, tsRecord, mockAirtableTsTable);

		// THEN
		expect(result).toEqual({
			id: 'rec012',
			c: false,
			d: ['rec345'],
		});
	});

	test('example with array', () => {
		// GIVEN
		const tsTypes = {
			a: 'string',
			b: 'number',
			c: 'boolean',
			d: 'string[]',
		} as const;
		const tsRecord = {
			id: 'rec012',
			d: ['rec123', 'rec456'],
		};

		// WHEN
		const result = mapRecordTypeTsToAirtable(mockTableDefinition, tsTypes, tsRecord, mockAirtableTsTable);

		// THEN
		expect(result).toEqual({
			id: 'rec012',
			d: ['rec123', 'rec456'],
		});
	});

	test('example with missing number', () => {
		// GIVEN
		const tsTypes = {
			a: 'string',
			b: 'number',
			c: 'boolean',
			d: 'string',
		} as const;
		const tsRecord = {
			id: 'rec012',
			b: null,
			c: false,
			d: 'rec345',
		};

		// WHEN
		// @ts-expect-error: as this correctly detects tsRecord is not compatible with tsTypes
		const expr = () => mapRecordTypeTsToAirtable(mockTableDefinition, tsTypes, tsRecord, mockAirtableTsTable);

		// THEN
		expect(expr).toThrow();
	});

	test('example with bad primitive value', () => {
		// GIVEN
		const tsTypes = {
			a: 'string',
			b: 'number',
			c: 'boolean',
			d: 'string',
		} as const;
		const tsRecord = {
			id: 'rec012',
			a: 123,
		};

		// WHEN
		// @ts-expect-error: as this correctly detects tsRecord is not compatible with tsTypes
		const expr = () => mapRecordTypeTsToAirtable(mockTableDefinition, tsTypes, tsRecord, mockAirtableTsTable);

		// THEN
		expect(expr).toThrow();
	});

	test('example with bad array value', () => {
		// GIVEN
		const tsTypes = {
			a: 'string',
			b: 'number',
			c: 'boolean',
			d: 'string[]',
		} as const;
		const tsRecord = {
			id: 'rec012',
			d: ['rec123', 456],
		};

		// WHEN
		// @ts-expect-error: as this correctly detects tsRecord is not compatible with tsTypes
		const expr = () => mapRecordTypeTsToAirtable(mockTableDefinition, tsTypes, tsRecord, mockAirtableTsTable);

		// THEN
		expect(expr).toThrow();
	});
});

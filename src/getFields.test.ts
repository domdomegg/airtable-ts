import {describe, test, expect} from 'vitest';
import {getFields} from './getFields';
import {type Table} from './mapping/typeUtils';
import {type AirtableTsTable} from './types';

describe('getFields', () => {
	test('returns field names from schema when no mappings are defined', () => {
		const table: Table<{id: string; name: string; age: number}> = {
			name: 'users',
			baseId: 'appTest',
			tableId: 'tblTest',
			schema: {name: 'string', age: 'number'},
		};

		const airtableTsTable = {
			fields: [
				{id: 'fldName', name: 'name', type: 'singleLineText'},
				{id: 'fldAge', name: 'age', type: 'number'},
			],
		} as AirtableTsTable;

		const result = getFields(table, airtableTsTable);

		expect(result).toEqual(['name', 'age']);
	});

	test('returns field IDs/names from mappings when defined', () => {
		const table: Table<{id: string; firstName: string; lastName: string}> = {
			name: 'users',
			baseId: 'appTest',
			tableId: 'tblTest',
			schema: {firstName: 'string', lastName: 'string'},
			mappings: {firstName: 'fldFirst', lastName: 'fldLast'},
		};

		const airtableTsTable = {
			fields: [
				{id: 'fldFirst', name: 'First Name', type: 'singleLineText'},
				{id: 'fldLast', name: 'Last Name', type: 'singleLineText'},
			],
		} as AirtableTsTable;

		const result = getFields(table, airtableTsTable);

		expect(result).toEqual(['fldFirst', 'fldLast']);
	});

	test('filters out fields deleted from Airtable but still in schema', () => {
		const table: Table<{
			id: string;
			name: string;
			deletedField: string;
			anotherDeletedField: number;
		}> = {
			name: 'records',
			baseId: 'appTest',
			tableId: 'tblTest',
			schema: {
				name: 'string',
				deletedField: 'string',
				anotherDeletedField: 'number',
			},
			mappings: {
				name: 'fldName',
				deletedField: 'fldDeleted',
				anotherDeletedField: 'fldAnotherDeleted',
			},
		};

		const airtableTsTable = {
			fields: [
				{id: 'fldName', name: 'Name', type: 'singleLineText'},
				// fldDeleted and fldAnotherDeleted have been deleted from Airtable
			],
		} as AirtableTsTable;

		const result = getFields(table, airtableTsTable);

		// Only fields that exist in Airtable should be included
		expect(result).toEqual(['fldName']);
	});
});


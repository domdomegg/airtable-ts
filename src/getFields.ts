import {type Item, type Table} from './mapping/typeUtils';
import {type AirtableTsTable} from './types';

/**
 * Returns field IDs (e.g., 'fldXXX') if mappings are defined, otherwise returns field names from the schema.
 */
export const getFields = (table: Table<Item>, airtableTsTable: AirtableTsTable): string[] => {
	const allFields = table.mappings
		? Object.values(table.mappings).flat() as string[]
		: Object.keys(table.schema);

	// Filter out fields that have been deleted from Airtable but still exist in the schema.
	// These may trigger validation errors later, but this function is intended not to throw any errors.
	return allFields.filter((fieldNameOrId) => {
		const field = airtableTsTable.fields.find((f) => f.name === fieldNameOrId || f.id === fieldNameOrId);

		return Boolean(field);
	});
};

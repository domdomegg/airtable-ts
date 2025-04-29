import {
	matchesType, type TsTypeString, type Item, type Table,
} from './mapping/typeUtils';
import {AirtableTsError, ErrorType} from './AirtableTsError';

/**
 * In theory, this should never catch stuff because our type mapping logic should
 * verify the types are compatible.
 *
 * "In theory, there is no difference between theory and practice. But in practice, there is."
 *   ~ Benjamin Brewster, probably: https://quoteinvestigator.com/2018/04/14/theory/
 *
 * @param table
 * @param data
 */
export function assertMatchesSchema<T extends Item>(
	table: Table<T>,
	data: unknown,
	mode: 'full' | 'partial' = 'partial',
): asserts data is T {
	if (typeof data !== 'object' || data === null) {
		throw new AirtableTsError({
			message: `Data passed in to airtable-ts should be an object but received ${data === null ? 'null' : typeof data}.`,
			type: ErrorType.SCHEMA_VALIDATION,
		});
	}

	(Object.entries(table.schema) as ([keyof T & string, TsTypeString])[]).forEach(([fieldName, type]) => {
		const value = data[fieldName as keyof typeof data];

		if (value === undefined) {
			if (mode === 'partial') {
				return;
			}

			throw new AirtableTsError({
				message: `Data passed in to airtable-ts is missing required field '${fieldName}' in table '${table.name}' (expected type: ${type}).`,
				type: ErrorType.SCHEMA_VALIDATION,
			});
		}

		if (!matchesType(value, type)) {
			throw new AirtableTsError({
				message: `Invalid value passed in to airtable-ts for field '${fieldName}' in table '${table.name}' (received type: ${typeof value}, expected type: ${type}).`,
				type: ErrorType.SCHEMA_VALIDATION,
			});
		}
	});
}

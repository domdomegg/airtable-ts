import {type FieldSet} from 'airtable';
import {
	type AirtableRecord, type AirtableTsTable, type CompleteAirtableTsOptions,
} from '../types';
import {fieldMappers} from './fieldMappers';
import {mapRecordFieldNamesAirtableToTs, mapRecordFieldNamesTsToAirtable} from './nameMapper';
import {
	airtableFieldNameTsTypes, type AirtableTypeString, type FromTsTypeString, type Item, matchesType, type Table, type TsTypeString,
} from './typeUtils';
import {AirtableTsError, ErrorType, prependError} from '../AirtableTsError';

type ValidationContext = Pick<CompleteAirtableTsOptions, 'readValidation' | 'onWarning'> & {
	warnings: unknown[];
};

const getMapper = (tsType: TsTypeString, airtableType: string) => {
	const tsMapper = fieldMappers[tsType];

	if (!tsMapper) {
		throw new AirtableTsError({
			message: `No mapper exists for TypeScript type '${tsType}'.`,
			type: ErrorType.SCHEMA_VALIDATION,
			suggestion: 'Check that you are using a supported TypeScript type in your schema definition.',
		});
	}

	if (tsMapper[airtableType as AirtableTypeString]) {
		return tsMapper[airtableType as AirtableTypeString]!;
	}

	if (tsMapper.unknown) {
		console.warn(`[airtable-ts] Unknown airtable type ${airtableType} for tsType ${tsType}. This is not fully supported and exact mapping behaviour may change in a future release.`);
		return tsMapper.unknown;
	}

	throw new AirtableTsError({
		message: `Cannot map Airtable type '${airtableType}' to TypeScript type '${tsType}'.`,
		type: ErrorType.SCHEMA_VALIDATION,
		suggestion: 'Check that your schema definition uses TypeScript types that are compatible with the Airtable field types.',
	});
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
	T extends Record<string, TsTypeString>,
>(
	table: Table<Item>,
	tsTypes: T,
	record: AirtableRecord,
	validationContext?: ValidationContext,
): ({[F in keyof T]: FromTsTypeString<T[F]>} & {id: string}) => {
	const item = {} as {[F in keyof T]: FromTsTypeString<T[F]>};

	(Object.entries(tsTypes) as [keyof T & string, TsTypeString][]).forEach(([fieldNameOrId, tsType]) => {
		const fieldDefinition = record._table.fields.find((f) => f.id === fieldNameOrId || f.name === fieldNameOrId);
		if (!fieldDefinition) {
			// This should not happen normally, as we should only be trying to map fields that are in the table definition.
			// If it does happen this often indicates that the field has been deleted from Airtable without updating the schema.
			const validationError = new AirtableTsError({
				message: `Field '${fieldNameOrId}' does not exist in the table definition. This error should not happen in normal operation.`,
				type: ErrorType.SCHEMA_VALIDATION,
			});

			if (validationContext?.readValidation === 'warning') {
				validationContext.warnings.push(validationError);
				item[fieldNameOrId] = undefined as unknown as FromTsTypeString<T[keyof T]>;
				return;
			}

			throw validationError;
		}

		const value = record.fields[fieldDefinition.name];

		try {
			const {fromAirtable} = getMapper(tsType, fieldDefinition.type);

			item[fieldNameOrId] = fromAirtable(value as any) as FromTsTypeString<T[keyof T]>;
		} catch (error) {
			const tsName = table.mappings ? Object.entries(table.mappings).find((e) => e[1] === fieldNameOrId)?.[0] : undefined;
			const validationError = prependError(error, `Failed to map field ${tsName ? `${tsName} (${fieldNameOrId})` : fieldNameOrId} from Airtable`);

			if (validationContext?.readValidation === 'warning') {
				validationContext.warnings.push(validationError);
				item[fieldNameOrId] = undefined as unknown as FromTsTypeString<T[keyof T]>;
				return;
			}

			throw validationError;
		}
	});

	return Object.assign(item, {id: record.id});
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
 * @param airtableTsTable An Airtable table.
 * @example { fields: { a: 'singleLineText', b: 'number', c: 'checkbox', d: 'multipleRecordLinks' }, ... }
 *
 * @returns An Airtable FieldSet. Throws if cannot coerce to requested type.
 * @example { a: 'Some text', b: 123, d: ['rec123'] } // (c is an un-ticked checkbox, d is a multipleRecordLinks)
 */
const mapRecordTypeTsToAirtable = <
	T extends Record<string, TsTypeString>,
	R extends {[K in keyof T]?: FromTsTypeString<T[K]>} & {id?: string},
>(
	table: Table<Item>,
	tsTypes: T,
	tsRecord: R,
	airtableTsTable: AirtableTsTable,
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
			throw new AirtableTsError({
				message: `Type mismatch for field '${fieldNameOrId}': expected ${tsType} but got a ${typeof value}.`,
				type: ErrorType.SCHEMA_VALIDATION,
				suggestion: 'Ensure the value matches the expected type in your schema definition.',
			});
		}

		const fieldDefinition = airtableTsTable.fields.find((f) => f.id === fieldNameOrId || f.name === fieldNameOrId);
		if (!fieldDefinition) {
			const tsName = table.mappings ? Object.entries(table.mappings).find((e) => e[1] === fieldNameOrId)?.[0] : undefined;
			throw new AirtableTsError({
				message: `Field ${tsName ? `${tsName} (${fieldNameOrId})` : fieldNameOrId} does not exist in the Airtable table.`,
				type: ErrorType.RESOURCE_NOT_FOUND,
				suggestion: 'Verify that the field exists in your Airtable base and that you are using the correct field name or ID.',
			});
		}

		try {
			const {toAirtable} = getMapper(tsType, fieldDefinition.type);

			item[fieldNameOrId] = (toAirtable as any)(value);
		} catch (error) {
			const tsName = table.mappings ? Object.entries(table.mappings).find((e) => e[1] === fieldNameOrId)?.[0] : undefined;
			throw prependError(error, `Failed to map field ${tsName ? `${tsName} (${fieldNameOrId})` : fieldNameOrId} to Airtable`);
		}
	});

	return Object.assign(item, {id: tsRecord.id});
};

export const mapRecordFromAirtable = <T extends Item>(
	table: Table<T>,
	record: AirtableRecord,
	options?: Pick<CompleteAirtableTsOptions, 'readValidation' | 'onWarning'>,
) => {
	const qualifyError = (error: unknown) => prependError(error, `Failed to map record from Airtable format for table '${table.name}' (${table.tableId}) and record ${record.id}`);

	const validationContext: ValidationContext = {
		onWarning: options?.onWarning,
		readValidation: options?.readValidation ?? 'error',
		warnings: [],
	};

	try {
		const tsTypes = airtableFieldNameTsTypes(table);
		const tsRecord = mapRecordTypeAirtableToTs(table, tsTypes, record, validationContext);

		// Handle warnings from `mapRecordTypeAirtableToTs`
		if (validationContext.onWarning) {
			validationContext.warnings.forEach((err) => {
				void (async () => {
					try {
						await validationContext.onWarning?.(qualifyError(err));
					} catch (error: unknown) {
						console.error('[airtable-ts] Error in onWarning callback:', error);
					}
				})();
			});
		}

		const mappedRecord = mapRecordFieldNamesAirtableToTs(table, tsRecord);

		return mappedRecord;
	} catch (error) {
		throw qualifyError(error);
	}
};

export const mapRecordToAirtable = <T extends Item>(
	table: Table<T>,
	item: Partial<T>,
	airtableTsTable: AirtableTsTable,
): FieldSet => {
	try {
		const mappedItem = mapRecordFieldNamesTsToAirtable(table, item);
		const tsTypes = airtableFieldNameTsTypes(table);
		const fieldSet = mapRecordTypeTsToAirtable(table, tsTypes, mappedItem, airtableTsTable);
		return fieldSet;
	} catch (error) {
		throw prependError(error, `Failed to map record to Airtable format for table '${table.name}' (${table.tableId})`);
	}
};

export const visibleForTesting = {
	mapRecordTypeAirtableToTs,
	mapRecordTypeTsToAirtable,
};

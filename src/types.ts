import type {
	FieldSet, Table as AirtableSdkTable, Record as AirtableSdkRecord, AirtableOptions,
} from 'airtable';
import {type QueryParams} from 'airtable/lib/query_params';
import {type Item, type Table} from './mapping/typeUtils';

export type AirtableRecord = Omit<AirtableSdkRecord<FieldSet>, '_table'> & {
	_table: AirtableTsTable;
};

export type AirtableTsTable<T extends Item = Item> = AirtableSdkTable<FieldSet> & {
	fields: {id: string; name: string; type: string}[];
	tsDefinition: Table<T>;
	__brand?: T;
};

type AirtableTsSpecificOptions = {
	/** The Airtable base schema is used to determine the appropriate type mapper for the field type (for example converting a number to a string representing a date is different to converting a number to a singleLineText). For performance reasons, airtable-ts caches base schemas so we don't refetch it for every request. Note that we always still do validation against the expected type at runtime so the library is always type-safe. @default 120_000 */
	baseSchemaCacheDurationMs?: number;
	/**
	 * How to handle validation failures when reading from Airtable. 'error' throws (default). 'warning' sets failing fields to undefined
	 * and optionally calls `onWarning`.
	 *
	 * NOTE: Setting this to 'warning' breaks type safety, as fields may be undefined even though their type doesn't allow this.
	 */
	readValidation?: 'error' | 'warning';
	/** Callback for validation failures when `readValidation` is set to 'warning' */
	onWarning?: ((warning: unknown) => void | Promise<void>) | undefined;
};

export type AirtableTsOptions = AirtableOptions & AirtableTsSpecificOptions;
export type CompleteAirtableTsOptions = AirtableTsOptions & Required<Pick<AirtableTsSpecificOptions, 'baseSchemaCacheDurationMs' | 'readValidation'>>;

export type ScanParams = Omit<QueryParams<unknown>, 'fields' | 'cellFormat' | 'method' | 'returnFieldsByFieldId' | 'pageSize' | 'offset'>;

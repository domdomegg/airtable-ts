import type Airtable from 'airtable';
import {type Item, type Table} from './mapping/typeUtils';
import {type AirtableTsTable, type CompleteAirtableTsOptions} from './types';
import {AirtableTsError, ErrorType} from './AirtableTsError';

export const getAirtableTsTable = async <T extends Item>(airtable: Airtable, table: Table<T>, options: CompleteAirtableTsOptions): Promise<AirtableTsTable<T>> => {
	const airtableTable = airtable.base(table.baseId).table(table.tableId);

	// We need the schema so we know which type mapper to use.
	// Even if we were inferring a type mapper from the schema, we'd still have to
	// do this as otherwise we can't distinguish a column with all null values from
	// a column that is missing entirely. We'd like to do that as for safety, we'd
	// rather throw an error if the column is missing entirely; this suggests a
	// misconfiguration. But an all-null column is okay. The particular case that
	// this is likely for is checkbox columns.
	const baseSchema = await getAirtableBaseSchema(table.baseId, options);
	const tableDefinition = baseSchema.find((t) => t.id === table.tableId);
	if (!tableDefinition) {
		throw new AirtableTsError({
			message: `Table '${table.name}' (${table.tableId}) does not exist in base ${table.baseId}.`,
			type: ErrorType.RESOURCE_NOT_FOUND,
			suggestion: 'Verify that the base ID and table ID are correct.',
		});
	}

	return Object.assign(
		airtableTable,
		{
			fields: tableDefinition.fields,
			tsDefinition: table,
		},
	);
};

type BaseSchema = {id: string; fields: AirtableTsTable['fields']}[];

const baseSchemaCache = new Map</* baseId */ string, {at: number; data: BaseSchema}>();

/**
 * Get the schemas from the cache or Airtable API for the tables in the given base.
 * @see https://airtable.com/developers/web/api/get-base-schema
 * @param baseId The base id to get the schemas for
 */
const getAirtableBaseSchema = async (baseId: string, options: CompleteAirtableTsOptions): Promise<BaseSchema> => {
	const fromCache = baseSchemaCache.get(baseId);
	if (fromCache && Date.now() - fromCache.at < options.baseSchemaCacheDurationMs) {
		return fromCache.data;
	}

	if (!options.apiKey) {
		throw new AirtableTsError({
			message: 'API key is required but was not provided.',
			type: ErrorType.INVALID_PARAMETER,
			suggestion: 'Provide a valid Airtable API key when initializing AirtableTs.',
		});
	}

	const baseURL = options.endpointUrl ?? 'https://api.airtable.com';
	const url = `${baseURL}/v0/meta/bases/${baseId}/tables`;

	const controller = new AbortController();
	const timeoutId = options.requestTimeout ? setTimeout(() => controller.abort(), options.requestTimeout) : undefined;

	const response = await fetch(url, {
		signal: controller.signal,
		headers: {
			Authorization: `Bearer ${options.apiKey}`,
			...options.customHeaders,
		},
	});

	if (timeoutId) clearTimeout(timeoutId);

	if (!response.ok) {
		const errorData = await response.text();
		throw new AirtableTsError({
			message: `Failed to get base schema: Status: ${response.status}. Data: ${errorData}`,
			type: ErrorType.API_ERROR,
			suggestion: 'Ensure the API token is correct, and has `schema.bases:read` permission to the target base.',
		});
	}

	const data = await response.json() as {tables: BaseSchema};
	const baseSchema = data.tables;

	if (baseSchemaCache.size > 100) {
		baseSchemaCache.clear();
		// If you're seeing this warning, then we probably either need to:
		// - Update the maximum limit before clearing the cache, provided we have memory headroom; or
		// - Use a last recently used cache or similar
		console.warn('[airtable-ts] baseSchemaCache cleared to avoid a memory leak: this code is not currently optimized for accessing over 100 different bases from a single instance');
	}

	baseSchemaCache.set(baseId, {at: Date.now(), data: baseSchema});

	return baseSchema;
};

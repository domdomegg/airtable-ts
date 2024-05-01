import Airtable from 'airtable';
import axios from 'axios';
import { Item, Table } from './mapping/typeUtils';
import { AirtableTable, CompleteAirtableTsOptions } from './types';

export const getAirtableTable = async <T extends Item>(airtable: Airtable, table: Table<T>, options: CompleteAirtableTsOptions): Promise<AirtableTable> => {
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
    throw new Error(`[airtable-ts] Failed to find table ${table.tableId} in base ${table.baseId}`);
  }

  return Object.assign(
    airtableTable,
    { fields: tableDefinition.fields },
  );
};

type BaseSchema = { id: string, fields: AirtableTable['fields'] }[];

const baseSchemaCache = new Map</* baseId */ string, { at: number, data: BaseSchema }>();

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

  // eslint-disable-next-line no-underscore-dangle
  if (!options.apiKey) {
    throw new Error('[airtable-ts] Missing API key');
  }
  const res = await axios<{ tables: BaseSchema }>({
    baseURL: options.endpointUrl ?? 'https://api.airtable.com',
    url: `/v0/meta/bases/${baseId}/tables`,
    ...(options.requestTimeout ? { timeout: options.requestTimeout } : {}),
    headers: {
      // eslint-disable-next-line no-underscore-dangle
      Authorization: `Bearer ${options.apiKey}`,
      ...options.customHeaders,
    },
  });
  const baseSchema = res.data.tables;

  if (baseSchemaCache.size > 100) {
    baseSchemaCache.clear();
    // If you're seeing this warning, then we probably either need to:
    // - Update the maximum limit before clearing the cache, provided we have memory headroom; or
    // - Use a last recently used cache or similar
    console.warn('[airtable-ts] baseSchemaCache cleared to avoid a memory leak: this code is not currently optimized for accessing over 100 different bases from a single instance');
  }
  baseSchemaCache.set(baseId, { at: Date.now(), data: baseSchema });

  return baseSchema;
};

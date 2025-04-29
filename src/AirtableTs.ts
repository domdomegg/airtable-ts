import Airtable from 'airtable';
import { getAirtableTsTable } from './getAirtableTsTable';
import { assertMatchesSchema } from './assertMatchesSchema';
import { mapRecordFromAirtable, mapRecordToAirtable } from './mapping/recordMapper';
import { Item, Table } from './mapping/typeUtils';
import {
  AirtableRecord, AirtableTsTable, AirtableTsOptions, CompleteAirtableTsOptions, ScanParams,
} from './types';
import { getFields } from './getFields';
import { wrapToCatchAirtableErrors } from './wrapToCatchAirtableErrors';
import { AirtableTsError, ErrorType } from './AirtableTsError';

export class AirtableTs {
  public airtable: Airtable;

  private options: CompleteAirtableTsOptions;

  constructor(options: AirtableTsOptions) {
    this.airtable = new Airtable(options);
    this.options = {
      ...Airtable.default_config(),
      ...options,
      baseSchemaCacheDurationMs: options.baseSchemaCacheDurationMs ?? 120_000,
    };
  }

  async get<T extends Item>(table: Table<T>, id: string): Promise<T> {
    if (!id) {
      throw new AirtableTsError({
        message: `The record ID must be supplied when getting a record. This was thrown when trying to get a '${table.name}' (${table.tableId}) record.`,
        type: ErrorType.INVALID_PARAMETER,
        suggestion: 'Provide a valid record ID when calling the get method.',
      });
    }
    const airtableTsTable = await getAirtableTsTable(this.airtable, table, this.options);
    const record = await airtableTsTable.find(id) as AirtableRecord;
    if (!record) {
      throw new AirtableTsError({
        message: `No record with ID '${id}' exists in table '${table.name}'.`,
        type: ErrorType.RESOURCE_NOT_FOUND,
        suggestion: 'Verify that the record ID is correct and that the record exists in the table.',
      });
    }
    return mapRecordFromAirtable(table, record);
  }

  async scan<T extends Item>(table: Table<T>, params?: ScanParams): Promise<T[]> {
    const airtableTsTable = await getAirtableTsTable(this.airtable, table, this.options);
    const records = await airtableTsTable.select({
      fields: getFields(table),
      ...params,
    }).all() as AirtableRecord[];
    return records.map((record) => mapRecordFromAirtable(table, record));
  }

  async insert<T extends Item>(table: Table<T>, data: Partial<Omit<T, 'id'>>): Promise<T> {
    assertMatchesSchema(table, { ...data, id: 'placeholder' });
    const airtableTsTable = await getAirtableTsTable(this.airtable, table, this.options);
    const record = await airtableTsTable.create(mapRecordToAirtable(table, data as Partial<T>, airtableTsTable)) as AirtableRecord;
    return mapRecordFromAirtable(table, record);
  }

  async update<T extends Item>(table: Table<T>, data: Partial<T> & { id: string }): Promise<T> {
    assertMatchesSchema(table, { ...data });
    const { id, ...withoutId } = data;
    const airtableTsTable = await getAirtableTsTable(this.airtable, table, this.options);
    const record = await airtableTsTable.update(data.id, mapRecordToAirtable(table, withoutId as Partial<T>, airtableTsTable)) as AirtableRecord;
    return mapRecordFromAirtable(table, record);
  }

  async remove<T extends Item>(table: Table<T>, id: string): Promise<{ id: string }> {
    if (!id) {
      throw new AirtableTsError({
        message: `The record ID must be supplied when removing a record. This was thrown when trying to get a '${table.name}' (${table.tableId}) record.`,
        type: ErrorType.INVALID_PARAMETER,
        suggestion: 'Provide a valid record ID when calling the remove method.',
      });
    }
    const airtableTsTable = await getAirtableTsTable(this.airtable, table, this.options);
    const record = await airtableTsTable.destroy(id);
    return { id: record.id };
  }

  async table<T extends Item>(table: Table<T>): Promise<AirtableTsTable<T>> {
    return getAirtableTsTable(this.airtable, table, this.options);
  }
}

// Wrap all methods of AirtableTs with error handling
// See https://github.com/Airtable/airtable.js/issues/294
wrapToCatchAirtableErrors(AirtableTs);

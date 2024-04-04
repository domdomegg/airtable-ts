import Airtable from 'airtable';
import type { QueryParams } from 'airtable/lib/query_params';
import { getAirtableTable } from './getAirtableTable';
import { assertMatchesSchema } from './assertMatchesSchema';
import { mapRecordFromAirtable, mapRecordToAirtable } from './mapping/recordMapper';
import { Item, Table } from './mapping/typeUtils';
import { AirtableRecord, AirtableTsOptions, CompleteAirtableTsOptions } from './types';
import { getFields } from './getFields';

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
      throw new Error(`[airtable-ts] Tried to get record in ${table.name} with no id`);
    }
    const airtableTable = await getAirtableTable(this.airtable, table, this.options);
    const record = await airtableTable.find(id) as AirtableRecord;
    if (!record) {
      throw new Error(`[airtable-ts] Failed to find record in ${table.name} with key ${id}`);
    }
    return mapRecordFromAirtable(table, record);
  }

  async scan<T extends Item>(table: Table<T>, params?: ScanParams): Promise<T[]> {
    const airtableTable = await getAirtableTable(this.airtable, table, this.options);
    const records = await airtableTable.select({
      fields: getFields(table),
      ...params,
    }).all() as AirtableRecord[];
    return records.map((record) => mapRecordFromAirtable(table, record));
  }

  async insert<T extends Item>(table: Table<T>, data: Omit<T, 'id'>): Promise<T> {
    assertMatchesSchema(table, { ...data, id: 'placeholder' });
    const airtableTable = await getAirtableTable(this.airtable, table, this.options);
    const record = await airtableTable.create(mapRecordToAirtable(table, data as Partial<T>, airtableTable)) as AirtableRecord;
    return mapRecordFromAirtable(table, record);
  }

  async update<T extends Item>(table: Table<T>, data: Partial<T> & { id: string }): Promise<T> {
    assertMatchesSchema(table, { ...data }, 'partial');
    const { id, ...withoutId } = data;
    const airtableTable = await getAirtableTable(this.airtable, table, this.options);
    const record = await airtableTable.update(data.id, mapRecordToAirtable(table, withoutId as Partial<T>, airtableTable)) as AirtableRecord;
    return mapRecordFromAirtable(table, record);
  }

  async remove<T extends Item>(table: Table<T>, id: string): Promise<T> {
    if (!id) {
      throw new Error(`[airtable-ts] Tried to remove record in ${table.name} with no id`);
    }
    const airtableTable = await getAirtableTable(this.airtable, table, this.options);
    const record = await airtableTable.destroy(id) as AirtableRecord;
    return mapRecordFromAirtable(table, record);
  }
}

export type ScanParams = Omit<QueryParams<unknown>, 'fields' | 'cellFormat' | 'method' | 'returnFieldsByFieldId' | 'pageSize' | 'offset'>;

export type { AirtableTsOptions } from './types';
export type { Item, Table } from './mapping/typeUtils';

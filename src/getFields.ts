import { Item, Table } from './mapping/typeUtils';

export const getFields = (table: Table<Item>): string[] => {
  if (table.mappings) {
    return Object.values(table.mappings).flat() as string[];
  }

  return Object.keys(table.schema);
};

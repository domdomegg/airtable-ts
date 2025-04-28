import {
  matchesType, TsTypeString, Item, Table,
} from './mapping/typeUtils';
import { AirtableTsError } from './AirtableTsError';

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
    throw new AirtableTsError(`Item for ${table.name} is not an object`);
  }

  (Object.entries(table.schema) as ([keyof T & string, TsTypeString])[]).forEach(([fieldName, type]) => {
    const value = data[fieldName as keyof typeof data];

    if (value === undefined) {
      if (mode === 'partial') {
        return;
      }

      throw new AirtableTsError(`Item for ${table.name} table is missing field '${fieldName}' (expected ${type})`);
    }

    if (!matchesType(value, type)) {
      throw new AirtableTsError(`Item for ${table.name} table has invalid value for field '${fieldName}' (actual type ${typeof value}, but expected ${type})`);
    }
  });
}

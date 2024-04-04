import { describe, expect, test } from 'vitest';
import { airtableFieldNameTsTypes, matchesType, Table } from './typeUtils';

describe('matchesType', () => {
  test.each([
    ['hello', 'string'],
    ['some string', 'string'],
    ['hello', 'string | null'],
    [null, 'string | null'],
    ['123', 'string'],
    [123, 'number'],
    [123, 'number | null'],
    [null, 'number | null'],
    [true, 'boolean'],
    [false, 'boolean'],
    [true, 'boolean | null'],
    [false, 'boolean | null'],
    [null, 'boolean | null'],
    [[true, false, true], 'boolean[] | null'],
    [[true, true], 'boolean[] | null'],
    [[], 'boolean[] | null'],
    [null, 'boolean[] | null'],
    [['hello'], 'string[] | null'],
    [['hello', 'world'], 'string[] | null'],
    [null, 'string[] | null'],
  ] as const)('%j is %s: true', (value, tsType) => {
    expect(matchesType(value, tsType)).toBe(true);
  });

  test.each([
    ['hello', 'number'],
    ['some string', 'number'],
    ['hello', 'number | null'],
    ['123', 'number'],
    [123, 'string'],
    [123, 'string | null'],
    [undefined, 'string | null'],
    [undefined, 'number | null'],
    [1, 'boolean'],
    [0, 'boolean'],
    [1, 'boolean | null'],
    [0, 'boolean | null'],
    [undefined, 'boolean | null'],
    [[true, false, 'hello'], 'boolean[] | null'],
    [[true, false, 1], 'boolean[] | null'],
    [[true, null], 'boolean[] | null'],
    [[null], 'boolean[] | null'],
    [[true, null, true], 'boolean[] | null'],
    [[true, undefined, true], 'boolean[] | null'],
    [['123'], 'number[] | null'],
    [['hello', 'world', null], 'string[] | null'],
  ] as const)('%j is %s: false', (value, tsType) => {
    expect(matchesType(value, tsType)).toBe(false);
  });
});

describe('airtableFieldNameTsTypes', () => {
  type MockItem = {
    id: string,
    someProp: string,
    otherProps: number[],
    another: boolean,
  };

  const mockTable: Table<MockItem> = {
    baseId: 'app123',
    tableId: 'tbl456',
    name: 'Mock',
    schema: { someProp: 'string', otherProps: 'number[]', another: 'boolean' },
  };

  const mockTableWithMappings: Table<MockItem> = {
    ...mockTable,
    mappings: { someProp: 'Some_Airtable_Field', otherProps: ['Field1', 'Field2'], another: 'another' },
  };

  test('example without mappings', () => {
    expect(airtableFieldNameTsTypes(mockTable)).toEqual({
      someProp: 'string',
      otherProps: 'number[]',
      another: 'boolean',
    });
  });

  test('example with mappings', () => {
    expect(airtableFieldNameTsTypes(mockTableWithMappings)).toEqual({
      Some_Airtable_Field: 'string',
      Field1: 'number',
      Field2: 'number',
      another: 'boolean',
    });
  });
});

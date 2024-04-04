import { describe, expect, test } from 'vitest';
import { mapRecordFieldNamesAirtableToTs, mapRecordFieldNamesTsToAirtable } from './nameMapper';
import { Table } from './typeUtils';

type MockItem = {
  id: string,
  someProp: string,
  otherProps: number[],
  another: boolean,
};

const mockItem: MockItem = {
  id: 'rec789',
  someProp: 'abcd',
  otherProps: [314, 159],
  another: true,
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

const mockRecordWithMappings = {
  id: 'rec789',
  Some_Airtable_Field: 'abcd',
  Field1: 314,
  Field2: 159,
  another: true,
};

type MockItemWithNullable = {
  id: string,
  someProp: string,
  otherProps: number[] | null,
  another: boolean,
};

const mockTableWithNullableAndMapping: Table<MockItemWithNullable> = {
  ...mockTableWithMappings,
  schema: {
    ...mockTableWithMappings.schema,
    otherProps: 'number[] | null',
  },
};

const mockItemWithNullable: MockItemWithNullable = {
  ...mockItem,
  otherProps: null,
};

const mockRecordWithNullable = {
  ...mockRecordWithMappings,
  Field1: null,
  Field2: null,
};

describe('mapRecordFieldNamesAirtableToTs', () => {
  test('example without mappings', () => {
    expect(mapRecordFieldNamesAirtableToTs(mockTable, mockItem)).toEqual(mockItem);
  });

  test('example with mappings', () => {
    expect(mapRecordFieldNamesAirtableToTs(mockTableWithMappings, mockRecordWithMappings)).toEqual(mockItem);
  });
});

describe('mapRecordFieldNamesTsToAirtable', () => {
  test('example without mappings', () => {
    expect(mapRecordFieldNamesTsToAirtable(mockTable, mockItem)).toEqual(mockItem);
  });

  test('example with mappings', () => {
    expect(mapRecordFieldNamesTsToAirtable(mockTableWithMappings, mockItem)).toEqual(mockRecordWithMappings);
  });

  test('example with mismatched value and mapping array lengths', () => {
    expect(() => mapRecordFieldNamesTsToAirtable(mockTableWithMappings, {
      ...mockItem,
      otherProps: [123, 456, 789],
    })).toThrow('Got 3 values for Mock.otherProps, but 2 mappings');
  });

  test('example with nullable mapped array type', () => {
    expect(mapRecordFieldNamesTsToAirtable(mockTableWithNullableAndMapping, mockItemWithNullable)).toEqual(mockRecordWithNullable);
  });

  // test of types only
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const typeTests = () => {
    mapRecordFieldNamesTsToAirtable(mockTableWithMappings, {
      ...mockItem,
      // @ts-expect-error: this doesn't match the table definition
      otherProps: ['123', '456'],
    });

    mapRecordFieldNamesTsToAirtable(mockTableWithMappings, {
      ...mockItem,
      // @ts-expect-error: this doesn't match the table definition
      otherProps: [null, null],
    });

    mapRecordFieldNamesTsToAirtable(mockTableWithMappings, {
      ...mockItem,
      // @ts-expect-error: this doesn't match the table definition
      otherProps: 123,
    });

    mapRecordFieldNamesTsToAirtable(mockTableWithMappings, {
      ...mockItem,
      // @ts-expect-error: this doesn't match the table definition
      otherProps: null,
    });
  };
});

import {
  describe, test, expect,
} from 'vitest';
import { AirtableRecord, AirtableTable } from '../types';
import { mapRecordFromAirtable, mapRecordToAirtable, visibleForTesting } from './recordMapper';
import { Table } from './typeUtils';

const {
  mapRecordTypeAirtableToTs,
  mapRecordTypeTsToAirtable,
} = visibleForTesting;

const mockTableDefinition: Table<{ id: string, a: string; b: number; c: boolean; d: string }> = {
  name: 'example',
  baseId: 'app123',
  tableId: 'tbl456',
  schema: {
    a: 'string',
    b: 'number',
    c: 'boolean',
    d: 'string',
  },
  mappings: {
    a: 'fld123',
    b: 'fld456',
    c: 'fld789',
    d: 'fld012',
  },
};

const mockAirtableTable = {
  name: 'example',
  fields: [
    { id: 'fld123', name: 'a', type: 'singleLineText' },
    { id: 'fld456', name: 'b', type: 'number' },
    { id: 'fld789', name: 'c', type: 'checkbox' },
    { id: 'fld012', name: 'd', type: 'multipleRecordLinks' },
  ],
} as unknown as AirtableTable;

describe('mapRecordFromAirtable', () => {
  test('should include table name, table ID, and record ID in error message when field mapping fails', () => {
    // GIVEN
    // Create a mock record with a field that doesn't exist in the table definition
    const mockRecord = {
      id: 'rec123',
      fields: {
        nonExistentField: 'value', // This field doesn't exist in the table definition
      },
      _table: {
        fields: [
          { id: 'nonExistentField', name: 'nonExistentField', type: 'singleLineText' },
        ],
      },
    } as unknown as AirtableRecord;

    // WHEN
    const expr = () => mapRecordFromAirtable(mockTableDefinition, mockRecord);

    // THEN
    expect(expr).toThrow(/Failed to map record from Airtable format for table 'example' \(tbl456\) and record rec123: Field 'fld123' does not exist in the table definition/);
  });

  test('should include details of why mapping failed when available', () => {
    // GIVEN
    const tableWithCustomMapping: Table<{ id: string, someNumber: number | null }> = {
      name: 'example',
      baseId: 'app123',
      tableId: 'tbl456',
      schema: {
        someNumber: 'number | null',
      },
      mappings: {
        someNumber: 'fld123',
      },
    };

    // Create a record with a field that doesn't exist in the table
    const mockRecord = {
      id: 'rec123',
      fields: {
        someText: 'value', // This should be a number, not a string
      },
      _table: {
        fields: [
          { id: 'fld123', name: 'someText', type: 'singleLineText' },
        ],
      },
    } as unknown as AirtableRecord;

    // WHEN
    const expr = () => mapRecordFromAirtable(tableWithCustomMapping, mockRecord);

    // THEN
    expect(expr).toThrow(/Failed to map record from Airtable format for table 'example' \(tbl456\) and record rec123: Failed to map field someNumber \(fld123\) from Airtable: Cannot convert value from airtable type 'unknown' to 'number \| null', as the Airtable API provided a 'string'/);
  });
});

describe('mapRecordToAirtable', () => {
  test('should include table name and table ID in error message when field mapping fails', () => {
    // GIVEN
    const invalidItem = {
      a: 'Some text',
      b: 'not a number', // This will cause a type error
      c: false,
      d: 'rec345',
    };

    // WHEN
    // @ts-expect-error: We're intentionally passing an invalid item to test error handling
    const expr = () => mapRecordToAirtable(mockTableDefinition, invalidItem, mockAirtableTable);

    // THEN
    expect(expr).toThrow(/Failed to map record to Airtable format for table 'example' \(tbl456\): Type mismatch for field 'fld456': expected number but got a string/);
  });

  test('should handle non-existent field errors with table details', () => {
    // GIVEN
    // Create a table definition with a field that doesn't exist in the Airtable table
    const tableWithNonExistentField: Table<{ id: string, nonExistent: string }> = {
      name: 'missing-field-example',
      baseId: 'app123',
      tableId: 'tbl101',
      schema: {
        nonExistent: 'string',
      },
      mappings: {
        nonExistent: 'fld123',
      },
    };

    const emptyAirtableTable = {
      name: 'missing-field-example',
      fields: [], // No fields defined
    } as unknown as AirtableTable;

    // WHEN
    const expr = () => mapRecordToAirtable(
      tableWithNonExistentField,
      { nonExistent: 'test' },
      emptyAirtableTable,
    );

    // THEN
    expect(expr).toThrow(/Failed to map record to Airtable format for table 'missing-field-example' \(tbl101\): Field nonExistent \(fld123\) does not exist in the Airtable table/);
  });
});

describe('mapRecordTypeAirtableToTs', () => {
  test('example', () => {
    // GIVEN
    const tsTypes = {
      a: 'string',
      b: 'number',
      c: 'boolean',
      d: 'string',
    } as const;
    const airtableRecord = {
      id: 'rec012',
      fields: {
        a: 'Some text',
        b: 123,
        // c is an un-ticked checkbox
        d: ['rec345'],
      },
      _table: mockAirtableTable,
    } as unknown as AirtableRecord;

    // WHEN
    const result = mapRecordTypeAirtableToTs(mockTableDefinition, tsTypes, airtableRecord);

    // THEN
    expect(result).toEqual({
      id: 'rec012',
      a: 'Some text',
      b: 123,
      c: false,
      d: 'rec345',
    });
  });
});

describe('mapRecordTypeTsToAirtable', () => {
  test('example with id', () => {
    // GIVEN
    const tsTypes = {
      a: 'string',
      b: 'number',
      c: 'boolean',
      d: 'string',
    } as const;
    const tsRecord = {
      id: 'rec012',
      a: 'Some text',
      b: 123,
      c: false,
      d: 'rec345',
    };

    // WHEN
    const result = mapRecordTypeTsToAirtable(mockTableDefinition, tsTypes, tsRecord, mockAirtableTable);

    // THEN
    expect(result).toEqual({
      id: 'rec012',
      a: 'Some text',
      b: 123,
      c: false,
      d: ['rec345'],
    });
  });

  test('example without id', () => {
    // GIVEN
    const tsTypes = {
      a: 'string',
      b: 'number',
      c: 'boolean',
      d: 'string',
    } as const;
    const tsRecord = {
      a: 'Some text',
      b: 123,
      c: false,
      d: 'rec345',
    };

    // WHEN
    const result = mapRecordTypeTsToAirtable(mockTableDefinition, tsTypes, tsRecord, mockAirtableTable);

    // THEN
    expect(result).toEqual({
      a: 'Some text',
      b: 123,
      c: false,
      d: ['rec345'],
    });
  });

  test('example with partial', () => {
    // GIVEN
    const tsTypes = {
      a: 'string',
      b: 'number',
      c: 'boolean',
      d: 'string',
    } as const;
    const tsRecord = {
      id: 'rec012',
      c: false,
      d: 'rec345',
    };

    // WHEN
    const result = mapRecordTypeTsToAirtable(mockTableDefinition, tsTypes, tsRecord, mockAirtableTable);

    // THEN
    expect(result).toEqual({
      id: 'rec012',
      c: false,
      d: ['rec345'],
    });
  });

  test('example with array', () => {
    // GIVEN
    const tsTypes = {
      a: 'string',
      b: 'number',
      c: 'boolean',
      d: 'string[]',
    } as const;
    const tsRecord = {
      id: 'rec012',
      d: ['rec123', 'rec456'],
    };

    // WHEN
    const result = mapRecordTypeTsToAirtable(mockTableDefinition, tsTypes, tsRecord, mockAirtableTable);

    // THEN
    expect(result).toEqual({
      id: 'rec012',
      d: ['rec123', 'rec456'],
    });
  });

  test('example with missing number', () => {
    // GIVEN
    const tsTypes = {
      a: 'string',
      b: 'number',
      c: 'boolean',
      d: 'string',
    } as const;
    const tsRecord = {
      id: 'rec012',
      b: null,
      c: false,
      d: 'rec345',
    };

    // WHEN
    // @ts-expect-error: as this correctly detects tsRecord is not compatible with tsTypes
    const expr = () => mapRecordTypeTsToAirtable(mockTableDefinition, tsTypes, tsRecord, mockAirtableTable);

    // THEN
    expect(expr).toThrow();
  });

  test('example with bad primitive value', () => {
    // GIVEN
    const tsTypes = {
      a: 'string',
      b: 'number',
      c: 'boolean',
      d: 'string',
    } as const;
    const tsRecord = {
      id: 'rec012',
      a: 123,
    };

    // WHEN
    // @ts-expect-error: as this correctly detects tsRecord is not compatible with tsTypes
    const expr = () => mapRecordTypeTsToAirtable(mockTableDefinition, tsTypes, tsRecord, mockAirtableTable);

    // THEN
    expect(expr).toThrow();
  });

  test('example with bad array value', () => {
    // GIVEN
    const tsTypes = {
      a: 'string',
      b: 'number',
      c: 'boolean',
      d: 'string[]',
    } as const;
    const tsRecord = {
      id: 'rec012',
      d: ['rec123', 456],
    };

    // WHEN
    // @ts-expect-error: as this correctly detects tsRecord is not compatible with tsTypes
    const expr = () => mapRecordTypeTsToAirtable(mockTableDefinition, tsTypes, tsRecord, mockAirtableTable);

    // THEN
    expect(expr).toThrow();
  });
});

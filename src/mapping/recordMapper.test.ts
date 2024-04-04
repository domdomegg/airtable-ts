import { describe, test, expect } from 'vitest';
import { AirtableRecord, AirtableTable } from '../types';
import { visibleForTesting } from './recordMapper';

const {
  mapRecordTypeAirtableToTs,
  mapRecordTypeTsToAirtable,
} = visibleForTesting;

const mockAirtableTable = {
  name: 'example',
  fields: [
    { name: 'a', type: 'singleLineText' },
    { name: 'b', type: 'number' },
    { name: 'c', type: 'checkbox' },
    { name: 'd', type: 'multipleRecordLinks' },
  ],
} as unknown as AirtableTable;

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
    const result = mapRecordTypeAirtableToTs(tsTypes, airtableRecord);

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
    const result = mapRecordTypeTsToAirtable(tsTypes, tsRecord, mockAirtableTable);

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
    const result = mapRecordTypeTsToAirtable(tsTypes, tsRecord, mockAirtableTable);

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
    const result = mapRecordTypeTsToAirtable(tsTypes, tsRecord, mockAirtableTable);

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
    const result = mapRecordTypeTsToAirtable(tsTypes, tsRecord, mockAirtableTable);

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
    const expr = () => mapRecordTypeTsToAirtable(tsTypes, tsRecord, mockAirtableTable);

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
    const expr = () => mapRecordTypeTsToAirtable(tsTypes, tsRecord, mockAirtableTable);

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
    const expr = () => mapRecordTypeTsToAirtable(tsTypes, tsRecord, mockAirtableTable);

    // THEN
    expect(expr).toThrow();
  });
});

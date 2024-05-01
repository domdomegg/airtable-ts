import { expect, test } from 'vitest';
import { AirtableTs, Table } from '.';

const apiKey = process.env['INTEGRATION_TEST_PAT'] ?? '';

interface Task {
  id: string,
  name: string,
  status: string,
  dueAt: number,
  isOptional: boolean
}

// Run me with:
// INTEGRATION_TEST_PAT=pat1234.5678 npm run test -- 'src/index.test.ts'
(apiKey ? test : test.skip)('integration test', async () => {
  // GIVEN
  const db = new AirtableTs({ apiKey });
  const taskTableWithFieldIds: Table<Task> = {
    name: 'task',
    baseId: 'app1cNCe6lBFLFgbM',
    tableId: 'tblPysVSIVe6FkXo4',
    mappings: {
      name: 'fldDurNuW6GxdcCGf',
      status: 'fldlUhn1W0hqbtcJ4',
      dueAt: 'fldqEgYbKcbJBj0gs',
      isOptional: 'fld7ZM4XEtrDxdJp7',
    },
    schema: {
      name: 'string',
      status: 'string',
      dueAt: 'number',
      isOptional: 'boolean',
    },
  };
  const taskTableWithFieldNames: Table<Task> = {
    name: 'task',
    baseId: 'app1cNCe6lBFLFgbM',
    tableId: 'tblPysVSIVe6FkXo4',
    mappings: {
      name: 'fldDurNuW6GxdcCGf',
      status: 'fldlUhn1W0hqbtcJ4',
      dueAt: 'fldqEgYbKcbJBj0gs',
      isOptional: 'fld7ZM4XEtrDxdJp7',
    },
    schema: {
      name: 'string',
      status: 'string',
      dueAt: 'number',
      isOptional: 'boolean',
    },
  };

  // WHEN
  const records1 = await db.scan(taskTableWithFieldIds);
  const records2 = await db.scan(taskTableWithFieldNames);

  // THEN
  const expected = [
    {
      id: 'recD0KglUuj0CkEVW',
      name: 'First task',
      status: 'In progress',
      dueAt: 1717118580,
      isOptional: false,
    },
    {
      id: 'recnFWM2RsVGobKCp',
      name: 'Second task',
      status: 'Todo',
      dueAt: 1717204980,
      isOptional: true,
    },
  ];
  expect(records1).toEqual(expected);
  expect(records2).toEqual(expected);
});

import { expect, test } from 'vitest';
import { AirtableTs, Table } from '.';

const apiKey = process.env['INTEGRATION_TEST_PAT'] ?? '';

// Run me with:
// INTEGRATION_TEST_PAT=pat1234.5678 npm run test -- 'src/index.test.ts'
(apiKey ? test : test.skip)('integration test', async () => {
  const db = new AirtableTs({
    apiKey,
  });

  const taskTable: Table<{ id: string, name: string, status: string, dueAt: number, isOptional: boolean }> = {
    name: 'task',
    baseId: 'app1cNCe6lBFLFgbM',
    tableId: 'tblPysVSIVe6FkXo4',
    mappings: {
      name: 'Name',
      status: 'Status',
      dueAt: 'Due at',
      isOptional: 'Is optional',
    },
    schema: {
      name: 'string',
      status: 'string',
      dueAt: 'number',
      isOptional: 'boolean',
    },
  };

  const records = await db.scan(taskTable);

  expect(records).toMatchInlineSnapshot([
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
  ]);
});

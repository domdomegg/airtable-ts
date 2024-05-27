import { expect, test } from 'vitest';
import { AirtableTs, Table } from '.';

interface Task {
  id: string,
  name: string,
  status: string,
  dueAt: number,
  isOptional: boolean,
  project: string[],
  projectOwner: string | null,
}

interface Project {
  id: string,
  name: string,
  tasks: string[],
  pendingTasks: number | null,
  owner: string,
  formattedSummary: string | null,
}

// Run me with:
// AIRTABLE_API_KEY=pat1234.abcd RUN_INTEGRATION=TRUE npm run test -- 'src/index.test.ts'
(process.env['RUN_INTEGRATION'] ? test : test.skip)('integration test', async () => {
  // GIVEN
  const db = new AirtableTs({ apiKey: process.env['AIRTABLE_API_KEY'] ?? '' });
  const taskTableWithFieldIds: Table<Task> = {
    name: 'task',
    baseId: 'app1cNCe6lBFLFgbM',
    tableId: 'tblPysVSIVe6FkXo4',
    mappings: {
      name: 'fldDurNuW6GxdcCGf',
      status: 'fldlUhn1W0hqbtcJ4',
      dueAt: 'fldqEgYbKcbJBj0gs',
      isOptional: 'fld7ZM4XEtrDxdJp7',
      project: 'fldlfUsb3gDXiHyFc',
      projectOwner: 'fldPkTg3m2M5RDaHD',
    },
    schema: {
      name: 'string',
      status: 'string',
      dueAt: 'number',
      isOptional: 'boolean',
      project: 'string[]',
      projectOwner: 'string | null',
    },
  };
  const taskTableWithFieldNames: Table<Task> = {
    name: 'task',
    baseId: 'app1cNCe6lBFLFgbM',
    tableId: 'tblPysVSIVe6FkXo4',
    mappings: {
      name: 'Name',
      status: 'Status',
      dueAt: 'Due at',
      isOptional: 'Is optional',
      project: 'Project',
      projectOwner: 'Project owner',
    },
    schema: {
      name: 'string',
      status: 'string',
      dueAt: 'number',
      isOptional: 'boolean',
      project: 'string[]',
      projectOwner: 'string | null',
    },
  };
  const projectsTable: Table<Project> = {
    name: 'Projects',
    baseId: 'app1cNCe6lBFLFgbM',
    tableId: 'tblPc12aaUF3Mpu7s',
    mappings: {
      name: 'fldUim4lZYuWEyc0g',
      tasks: 'fldpdyj8j7f6lTe9p',
      pendingTasks: 'fldRf8ErknYDd7HcW',
      owner: 'fldGhhmVUIFBZ9DsA',
      formattedSummary: 'fldbn7SppGDdcjM4V',
    },
    schema: {
      name: 'string',
      tasks: 'string[]',
      pendingTasks: 'number | null',
      owner: 'string',
      formattedSummary: 'string | null',
    },
  };

  // PREPARE: Delete any orphaned test projects created by failed past runs
  const toDelete = (await db.scan(projectsTable)).filter((p) => p.name === 'Project test');
  await Promise.all(toDelete.map((p) => db.remove(projectsTable, p.id)));

  // WHEN
  const records1 = await db.scan(taskTableWithFieldIds);
  const records2 = await db.scan(taskTableWithFieldNames);
  const projects = await db.scan(projectsTable);

  // THEN
  const expectedTasks: Task[] = [
    {
      id: 'recD0KglUuj0CkEVW',
      name: 'First task',
      status: 'In progress',
      dueAt: 1717118580,
      isOptional: false,
      project: ['recLUUmrS706HP1Yb'],
      projectOwner: 'Alice',
    },
    {
      id: 'recnFWM2RsVGobKCp',
      name: 'Second task',
      status: 'Todo',
      dueAt: 1717204980,
      isOptional: true,
      project: [],
      projectOwner: null,
    },
  ];
  const expectedProjects: Project[] = [
    {
      id: 'recLUUmrS706HP1Yb',
      name: 'Project A',
      tasks: ['recD0KglUuj0CkEVW'],
      pendingTasks: 1,
      owner: 'Alice',
      formattedSummary: 'Alice has 1 task(s) to complete.',
    },
    {
      id: 'recsdy9ZkhokdbUMN',
      name: 'Project B',
      tasks: [],
      pendingTasks: 0,
      owner: 'Bob',
      formattedSummary: 'Bob has 0 task(s) to complete.',
    },
  ];
  expect(records1).toEqual(expectedTasks);
  expect(records2).toEqual(expectedTasks);
  expect(projects).toEqual(expectedProjects);

  const newProject = await db.insert(projectsTable, {
    name: 'Project test',
    owner: 'Adam',
  });
  expect(newProject).toEqual({
    formattedSummary: 'Adam has 0 task(s) to complete.',
    id: expect.stringMatching(/^rec[A-Za-z0-9]{14}$/),
    name: 'Project test',
    owner: 'Adam',
    pendingTasks: 0,
    tasks: [],
  });
  await db.remove(projectsTable, newProject.id);
});

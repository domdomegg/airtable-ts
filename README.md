# airtable-ts

🗄️🧱 A type-safe Airtable SDK that makes developing apps on top of Airtable a breeze. We use it in multiple production applications and have found compared to the original SDK it:
- enables us to develop new applications faster
- significantly reduces mean time to detect and resolve issues
- helps us avoid footguns with the Airtable SDK, as well as eliminates boilerplate code

If you've ever tried to build applications on top of the Airtable API, you know it can be a pain. The default SDK leads to:
- apps silently breaking when colleagues edit field definitions in your base
- an error-prone and difficult coding experience with no type safety or editor hints
- unintuitive API behavior, like not being able to distinguish between a non-existent field and a field with unticked checkboxes
- awkward code as each AirtableRecord is a class with many helper methods, so you can't safely stringify them or use [Object.entries()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object#static_methods) etc.

All of these problems are solved with airtable-ts.

In development, you'll define the expected types for different fields: enabling you to leverage type hints in your code editor. After deployment, if people make breaking changes to your base schema you'll get clear runtime errors that pinpoint the problem (rather than your app silently failing, or worse: doing something dangerous!) We also fix unintuitive API behavior, like not being able to tell whether a checkbox field has been deleted or the values are just unticked.

## Related libraries

- [airtable-ts-codegen](https://github.com/domdomegg/airtable-ts-codegen): Autogenerate TypeScript definitions for your Airtable base, with perfect compatibility with airtable-ts
- [airtable-ts-formula](https://github.com/domdomegg/airtable-ts-formula): Type-safe, securely-escaped and rename-robust formulae for Airtable (e.g. for `filterByFormula`)

## Example

Install it with `npm install airtable-ts`. Then, use it like:

```ts
import { AirtableTs, Table } from 'airtable-ts';

const db = new AirtableTs({
  // Create your own at https://airtable.com/create/tokens
  // Recommended scopes: schema.bases:read, data.records:read, data.records:write
  apiKey: 'pat1234.abcdef',
});

// Tip: use airtable-ts-codegen to autogenerate these from your Airtable base
export const studentTable: Table<{ id: string, firstName: string, classes: string[] }> = {
  name: 'student',
  baseId: 'app1234',
  tableId: 'tbl1234',
  schema: { firstName: 'string', classes: 'string[]' },
  // optional: use mappings with field ids to prevent renamings breaking your app,
  //           or with field names to make handling renamings easy
  mappings: { firstName: 'fld1234', classes: 'Classes student is enrolled in' },
};

export const classTable: Table<{ id: string, title: string }> = {
  name: 'class',
  baseId: 'app1234',
  tableId: 'tbl4567',
  schema: { title: 'string' },
};

// Now we can get all the records in a table (a scan)
const classes = await db.scan(classTable);

// Get, update and delete specific records:
const student = await db.get(studentTable, 'rec1234');
await db.update(studentTable, { id: 'rec1234', firstName: 'Adam' });
await db.remove(studentTable, 'rec5678');

// Or for a more involved example:
async function prefixTitleOfFirstClassOfFirstStudent(prefix: string) {
  const students = await db.scan(studentTable);
  if (!students[0]) throw new Error('There are no students');
  if (!students[0].classes[0]) throw new Error('First student does not have a class');

  const currentClass = await db.get(classTable, students[0].classes[0]);
  const newTitle = prefix + currentClass.title;
  await db.update(classTable, { id: currentClass.id, title: newTitle });
}

// And should you ever need it, access to the raw Airtable JS SDK
const rawSdk: Airtable = db.airtable;
```

## AirtableTs Class Reference

The `AirtableTs` class provides several methods to interact with your Airtable base:

### Constructor

```ts
new AirtableTs(options: AirtableTsOptions)
```

Creates a new instance of the AirtableTs client.

**Parameters:**
- `options`: Configuration options
  - `apiKey`: Your Airtable API key (required)
    - Create one at https://airtable.com/create/tokens
    - Recommended scopes: schema.bases:read, data.records:read, data.records:write
  - `baseSchemaCacheDurationMs`: Duration in milliseconds to cache base schema (default: 120,000ms = 2 minutes)
  - Other options from Airtable.js are supported, including: `apiVersion`, `customHeaders`, `endpointUrl`, `noRetryIfRateLimited`, `requestTimeout`

**Example:**
```ts
const db = new AirtableTs({
  apiKey: 'pat1234.abcdef',
  baseSchemaCacheDurationMs: 300000, // 5 minutes
});
```

### get

```ts
async get<T extends Item>(table: Table<T>, id: string): Promise<T>
```

Retrieves a single record from a table by its ID.

**Parameters:**
- `table`: Table definition object
- `id`: The ID of the record to retrieve

**Example:**
```ts
const student = await db.get(studentTable, 'rec1234');
console.log(student.firstName); // Access fields with type safety
```

### scan

```ts
async scan<T extends Item>(table: Table<T>, params?: ScanParams): Promise<T[]>
```

Retrieves all records from a table, with optional filtering parameters.

**Parameters:**
- `table`: Table definition object
- `params` (optional): Parameters for filtering, sorting, and limiting results
  - `filterByFormula`: An Airtable formula to filter records
    - Tip: use [airtable-ts-formula](https://github.com/domdomegg/airtable-ts-formula) for type-safe, securely-escaped and rename-robust formulae!
  - `sort`: Array of sort objects (e.g., `[{field: 'firstName', direction: 'asc'}]`)
  - `maxRecords`: Maximum number of records to return
  - `view`: Name of a view to use for record selection
  - `timeZone`: Timezone for interpreting date values
  - `userLocale`: Locale for formatting date values

**Example:**
```ts
// Get all records
const allStudents = await db.scan(studentTable);

// Get records with filtering and sorting
const topStudents = await db.scan(studentTable, {
  filterByFormula: '{grade} >= 90',
  sort: [{field: 'grade', direction: 'desc'}],
  maxRecords: 10
});
```

### insert

```ts
async insert<T extends Item>(table: Table<T>, data: Partial<Omit<T, 'id'>>): Promise<T>
```

Creates a new record in a table. Returns the new record.

**Parameters:**
- `table`: Table definition object
- `data`: The data for the new record (without an ID, as Airtable will generate one)

**Example:**
```ts
const newStudent = await db.insert(studentTable, {
  firstName: 'Jane',
  classes: ['rec5678', 'rec9012']
});
console.log(newStudent.id); // The new record ID generated by Airtable
```

### update

```ts
async update<T extends Item>(table: Table<T>, data: Partial<T> & { id: string }): Promise<T>
```

Updates an existing record in a table. Returns the updated record.

**Parameters:**
- `table`: Table definition object
- `data`: The data to update, must include the record ID

**Example:**
```ts
const updatedStudent = await db.update(studentTable, {
  id: 'rec1234',
  firstName: 'John',
  // Only include fields you want to update
});
```

### remove

```ts
async remove<T extends Item>(table: Table<T>, id: string): Promise<{ id: string }>
```

Deletes a record from a table.

**Parameters:**
- `table`: Table definition object
- `id`: The ID of the record to delete

**Example:**
```ts
await db.remove(studentTable, 'rec1234');
```

### table

```ts
async table<T extends Item>(table: Table<T>): Promise<AirtableTsTable<T>>
```

Retrieves the AirtableTsTable object for the given table definition. This is the Airtable.js table, enriched with a `fields` key that includes details of the Airtable schema for this table.

This is useful for advanced use cases where you need direct access to the Airtable table object.

**Parameters:**
- `table`: Table definition object

**Example:**
```ts
const airtableTsTable = await db.table(studentTable);
// Now you can use the raw Airtable table object with field information
console.log(airtableTsTable.fields); // Access the table's field definitions
```

### airtable

The underlying Airtable.js SDK is exposed in the `airtable` property.

```ts
const rawSdk: Airtable = db.airtable;
```

## Contributing

Pull requests are welcomed on GitHub! To get started:

1. Install Git and Node.js
2. Clone the repository
3. Install dependencies with `npm install`
4. Run `npm run test` to run tests
5. Build with `npm run build`

## Releases

Versions follow the [semantic versioning spec](https://semver.org/).

To release:

1. Use `npm version <major | minor | patch>` to bump the version
2. Run `git push --follow-tags` to push with tags
3. Wait for GitHub Actions to publish to the NPM registry.

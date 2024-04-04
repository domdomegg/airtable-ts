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

## Usage

Install it with `npm install airtable-ts`. Then, use it like:

```ts
import { AirtableTs, Table } from 'airtable-ts';

const db = new AirtableTs({
  // Create your own at https://airtable.com/create/tokens
  apiKey: 'pat1234.abcdef',
});

export const studentTable: Table<{ id: string, name: string, classes: string[] }> = {
  name: 'student',
  baseId: 'app1234',
  tableId: 'tbl1234',
  schema: { name: 'string', classes: 'string[]' },
};

export const classTable: Table<{ id: string, name: string }> = {
  name: 'class',
  baseId: 'app1234',
  tableId: 'tbl4567',
  schema: { name: 'string' },
};

// Now we can get all the records in a table (a scan)
const classes = await db.scan(classTable);

// Get, update and delete specific records:
const student = await db.get(studentTable, 'rec1234');
await db.update(studentTable, { id: 'rec1234', name: 'Adam' });
await db.remove(studentTable, 'rec5678');

// Or for a more involved example:
async function prefixNameOfFirstClassOfFirstStudent(namePrefix: string) {
  const students = await db.scan(studentTable);
  if (!students[0]) throw new Error('There are no students');
  if (!students[0].classes[0]) throw new Error('First student does not have a class');

  const currentClass = await db.get(classTable, students[0].classes[0]);
  const newName = namePrefix + currentClass.name;
  await db.update(classTable, { id: currentClass.id, name: newName });
}

// And should you ever need it, access to the raw Airtable JS SDK
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

import {describe, test, expect} from 'vitest';
import {fieldMappers} from './fieldMappers';

describe('string', () => {
	test.each([
		['singleLineText'],
		['email'],
		['url'],
		['multilineText'],
		['richText'],
		['phoneNumber'],
		['singleSelect'],
	] as const)('%s', (airtableType) => {
		const mapperPair = fieldMappers.string?.[airtableType];
		if (!mapperPair) {
			throw new Error(`Expected mapper pair for [string, ${airtableType}]`);
		}

		expect(mapperPair.fromAirtable('Some text from Airtable!')).toBe('Some text from Airtable!');
		expect(mapperPair.fromAirtable(null)).toBe('');
		expect(mapperPair.fromAirtable(undefined)).toBe('');

		expect(mapperPair.toAirtable('Some text to Airtable!')).toBe('Some text to Airtable!');
	});

	test('multipleRecordLinks', () => {
		const mapperPair = fieldMappers.string?.multipleRecordLinks;
		if (!mapperPair) {
			throw new Error('Expected mapper pair for [string, multipleRecordLinks]');
		}

		expect(mapperPair.fromAirtable(['rec123'])).toBe('rec123');
		expect(() => mapperPair.fromAirtable(null)).toThrow();
		expect(() => mapperPair.fromAirtable(undefined)).toThrow();
		expect(() => mapperPair.fromAirtable([])).toThrow();
		expect(() => mapperPair.fromAirtable(['rec123', 'rec456'])).toThrow();

		expect(mapperPair.toAirtable('rec789')).toEqual(['rec789']);
	});

	test.each(['dateTime', 'createdTime', 'lastModifiedTime'] as const)('%s', (airtableType) => {
		const mapperPair = fieldMappers.string?.[airtableType];
		if (!mapperPair) {
			throw new Error(`Expected mapper pair for [string, ${airtableType}]`);
		}

		const validDateTimeString = '2023-04-09T12:34:56.789Z';
		const validDateTimeStringAlt1 = 'Sun Apr 09 2023 13:34:56.789 GMT+0100 (British Summer Time)';
		const validDateTimeStringAlt2 = '2023-04-09T13:34:56.789+0100';
		const invalidDateTimeString = 'invalid date time string';

		expect(mapperPair.fromAirtable(validDateTimeString)).toBe(validDateTimeString);
		expect(() => mapperPair.fromAirtable(invalidDateTimeString)).toThrow();
		expect(() => mapperPair.fromAirtable(null)).toThrow();
		expect(() => mapperPair.fromAirtable(undefined)).toThrow();

		expect(mapperPair.toAirtable(validDateTimeString)).toBe(validDateTimeString);
		expect(mapperPair.toAirtable(validDateTimeStringAlt1)).toBe(validDateTimeString);
		expect(mapperPair.toAirtable(validDateTimeStringAlt2)).toBe(validDateTimeString);
		expect(() => mapperPair.toAirtable(invalidDateTimeString)).toThrow();
	});
});

describe('string | null', () => {
	test.each([
		['singleLineText'],
		['email'],
		['url'],
		['multilineText'],
		['richText'],
		['phoneNumber'],
		['singleSelect'],
	] as const)('%s', (airtableType) => {
		const mapperPair = fieldMappers['string | null']?.[airtableType];
		if (!mapperPair) {
			throw new Error(`Expected mapper pair for [string | null, ${airtableType}]`);
		}

		expect(mapperPair.fromAirtable('Some text from Airtable!')).toBe('Some text from Airtable!');
		expect(mapperPair.fromAirtable(null)).toBe(null);
		expect(mapperPair.fromAirtable(undefined)).toBe(null);

		expect(mapperPair.toAirtable('Some text to Airtable!')).toBe('Some text to Airtable!');
		expect(mapperPair.toAirtable(null)).toBe(null);
	});

	test('multipleRecordLinks', () => {
		const mapperPair = fieldMappers['string | null']?.multipleRecordLinks;
		if (!mapperPair) {
			throw new Error('Expected mapper pair for [string | null, multipleRecordLinks]');
		}

		expect(mapperPair.fromAirtable(['rec123'])).toBe('rec123');
		expect(mapperPair.fromAirtable(null)).toBe(null);
		expect(mapperPair.fromAirtable(undefined)).toBe(null);
		expect(mapperPair.fromAirtable([])).toBe(null);
		expect(() => mapperPair.fromAirtable(['rec123', 'rec456'])).toThrow();

		expect(mapperPair.toAirtable('rec789')).toEqual(['rec789']);
		expect(mapperPair.toAirtable(null)).toEqual([]);
	});
});

describe('boolean', () => {
	test('checkbox', () => {
		const mapperPair = fieldMappers.boolean?.checkbox;
		if (!mapperPair) {
			throw new Error('Expected mapper pair for [boolean, checkbox]');
		}

		expect(mapperPair.fromAirtable(true)).toBe(true);
		expect(mapperPair.fromAirtable(false)).toBe(false);
		expect(mapperPair.fromAirtable(null)).toBe(false);
		expect(mapperPair.fromAirtable(undefined)).toBe(false);

		expect(mapperPair.toAirtable(true)).toBe(true);
		expect(mapperPair.toAirtable(false)).toBe(false);
	});
});

describe('number', () => {
	test.each([
		['number'],
		['percent'],
		['currency'],
		['rating'],
		['duration'],
	] as const)('%s', (airtableType) => {
		const mapperPair = fieldMappers.number?.[airtableType];
		if (!mapperPair) {
			throw new Error(`Expected mapper pair for [number, ${airtableType}]`);
		}

		expect(mapperPair.fromAirtable(123)).toBe(123);
		expect(() => mapperPair.fromAirtable(null)).toThrow('non-null');
		expect(() => mapperPair.fromAirtable(undefined)).toThrow('non-null');

		expect(mapperPair.toAirtable(123)).toBe(123);
	});

	test.each([
		['count'],
		['autoNumber'],
	] as const)('%s', (airtableType) => {
		const mapperPair = fieldMappers.number?.[airtableType];
		if (!mapperPair) {
			throw new Error(`Expected mapper pair for [number, ${airtableType}]`);
		}

		expect(mapperPair.fromAirtable(123)).toBe(123);
		expect(() => mapperPair.fromAirtable(null)).toThrow('non-null');
		expect(() => mapperPair.fromAirtable(undefined)).toThrow('non-null');

		expect(() => mapperPair.toAirtable(123)).toThrow('read-only');
	});

	test('dateTime', () => {
		const mapperPair = fieldMappers.number?.dateTime;
		if (!mapperPair) {
			throw new Error('Expected mapper pair for [number, dateTime]');
		}

		const validDateTimeString = '2023-04-09T12:34:56.000Z';
		const validUnixTime = 1681043696;
		const invalidDateTimeString = 'invalid unix time';

		expect(mapperPair.fromAirtable(validDateTimeString)).toBe(validUnixTime);
		expect(() => mapperPair.fromAirtable(invalidDateTimeString)).toThrow();
		expect(() => mapperPair.fromAirtable(null)).toThrow();
		expect(() => mapperPair.fromAirtable(undefined)).toThrow();

		expect(mapperPair.toAirtable(1681043696)).toBe(validDateTimeString);
	});
});

describe('string[]', () => {
	test('multipleRecordLinks', () => {
		const mapperPair = fieldMappers['string[]']?.multipleRecordLinks;
		if (!mapperPair) {
			throw new Error('Expected mapper pair for [string[], multipleRecordLinks]');
		}

		expect(mapperPair.fromAirtable(['rec123'])).toEqual(['rec123']);
		expect(mapperPair.fromAirtable(null)).toEqual([]);
		expect(mapperPair.fromAirtable(undefined)).toEqual([]);
		expect(mapperPair.fromAirtable([])).toEqual([]);
		expect(mapperPair.fromAirtable(['rec123', 'rec456'])).toEqual(['rec123', 'rec456']);

		expect(mapperPair.toAirtable([])).toEqual([]);
		expect(mapperPair.toAirtable(['rec789'])).toEqual(['rec789']);
		expect(mapperPair.toAirtable(['rec789', 'rec012'])).toEqual(['rec789', 'rec012']);
	});

	test('multipleLookupValues', () => {
		const mapperPair = fieldMappers['string[]']?.multipleLookupValues;
		if (!mapperPair) {
			throw new Error('Expected mapper pair for [string[], multipleLookupValues]');
		}

		expect(mapperPair.fromAirtable(['value1', 'value2'])).toEqual(['value1', 'value2']);
		expect(mapperPair.fromAirtable(null)).toEqual([]);
		expect(mapperPair.fromAirtable(undefined)).toEqual([]);
		expect(mapperPair.fromAirtable([])).toEqual([]);
		expect(() => mapperPair.fromAirtable([1, 2, 3])).toThrow();

		expect(() => mapperPair.toAirtable(['value1', 'value2'])).toThrow('read-only');
	});

	test('formula', () => {
		const mapperPair = fieldMappers['string[]']?.formula;
		if (!mapperPair) {
			throw new Error('Expected mapper pair for [string[], formula]');
		}

		expect(mapperPair.fromAirtable(['value1', 'value2'])).toEqual(['value1', 'value2']);
		expect(mapperPair.fromAirtable(null)).toEqual([]);
		expect(mapperPair.fromAirtable(undefined)).toEqual([]);
		expect(mapperPair.fromAirtable([])).toEqual([]);
		expect(() => mapperPair.fromAirtable([1, 2, 3])).toThrow();

		expect(() => mapperPair.toAirtable(['value1', 'value2'])).toThrow('read-only');
	});
});

describe('unknown', () => {
	test.each([
		['string', 'example'],
		['string | null', 'example'],
		['string | null', null],
		['boolean', true],
		['boolean | null', true],
		['boolean | null', null],
		['number', 123],
		['number | null', 123],
		['number | null', null],
		['string[]', []],
		['string[]', ['rec123']],
		['string[]', ['rec123', 'rec456']],
		['string[] | null', []],
		['string[] | null', ['rec123']],
		['string[] | null', ['rec123', 'rec456']],
		['string[] | null', null],
	] as const)('unknown airtable type for %s maps same type successfully', (tsType, value) => {
		const mapperPair = fieldMappers[tsType]?.unknown;
		if (!mapperPair) {
			throw new Error(`Expected mapper pair for [${tsType}, unknown]`);
		}

		expect(mapperPair.fromAirtable(value)).toEqual(value);
	});

	test.each([
		['string', ['example']],
		['string | null', ['example']],
		['boolean', [true]],
		['boolean | null', [true]],
		['number', [123]],
		['number | null', [123]],
	] as const)('unknown airtable type for %s maps singleton array of same type successfully', (tsType, value) => {
		const mapperPair = fieldMappers[tsType]?.unknown;
		if (!mapperPair) {
			throw new Error(`Expected mapper pair for [${tsType}, unknown]`);
		}

		expect(mapperPair.fromAirtable(value)).toEqual(value[0]);
	});

	test.each([
		['string', 'array with >1 element', ['example1', 'example2']],
		['string', 'number', 123],
		['string', 'number array', [123]],
		['string', 'null array', [null]],
	] as const)('unknown airtable type for %s throws for invalid types: %s', (tsType, _desc, value) => {
		const mapperPair = fieldMappers[tsType]?.unknown;
		if (!mapperPair) {
			throw new Error(`Expected mapper pair for [${tsType}, unknown]`);
		}

		expect(() => mapperPair.fromAirtable(value)).toThrow();
	});

	test.each([
		['string', 'empty array', '', []],
		['string', 'null', '', null],
		['boolean', 'empty array', false, []],
		['boolean', 'null', false, null],
	] as const)('unknown airtable type for %s casts %s to default (%s)', (tsType, _desc, toValue, fromValue) => {
		const mapperPair = fieldMappers[tsType]?.unknown;
		if (!mapperPair) {
			throw new Error(`Expected mapper pair for [${tsType}, unknown]`);
		}

		expect(mapperPair.fromAirtable(fromValue)).toEqual(toValue);
	});
});

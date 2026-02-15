import {
	type AirtableTypeString, type FromAirtableTypeString, type FromTsTypeString, type TsTypeString, type Attachment,
	parseType,
} from './typeUtils';
import {AirtableTsError, ErrorType} from '../AirtableTsError';

type Mapper = {
	[T in TsTypeString]?: {
		[A in AirtableTypeString | 'unknown']?: {
			toAirtable: (value: FromTsTypeString<T>) => FromAirtableTypeString<A>;
			fromAirtable: (value: FromAirtableTypeString<A> | null | undefined) => FromTsTypeString<T>;
		}
	}
};

const fallbackMapperPair = <T, F1, F2>(toFallback: F1, fromFallback: F2) => ({
	toAirtable: (value: T | null | undefined) => value ?? toFallback,
	fromAirtable: (value: T | null | undefined) => value ?? fromFallback,
});

const readonly = (airtableType: AirtableTypeString) => () => {
	throw new AirtableTsError({
		message: `Cannot modify a field of type '${airtableType}' as it is read-only.`,
		type: ErrorType.SCHEMA_VALIDATION,
	});
};

const coerce = <T extends TsTypeString>(airtableType: AirtableTypeString | 'unknown', tsType: T) => (value: unknown): FromTsTypeString<T> => {
	const parsedType = parseType(tsType);

	if (!parsedType.array && typeof value === parsedType.single) {
		return value as FromTsTypeString<T>;
	}

	if (parsedType.array && Array.isArray(value) && value.every((v) => typeof v === parsedType.single)) {
		return value as FromTsTypeString<T>;
	}

	if (parsedType.nullable && (value === undefined || value === null || (Array.isArray(value) && value.length === 0))) {
		return null as FromTsTypeString<T>;
	}

	// ISO date strings (e.g. from date lookup/rollup fields) coerced to Unix timestamps
	if (parsedType.single === 'number' && !parsedType.array && typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
		const date = new Date(value);
		if (!Number.isNaN(date.getTime())) {
			return Math.floor(date.getTime() / 1000) as FromTsTypeString<T>;
		}
	}

	if (parsedType.single === 'number' && parsedType.array && Array.isArray(value) && value.every((v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v))) {
		const timestamps = value.map((v) => {
			const date = new Date(v as string);
			if (Number.isNaN(date.getTime())) {
				throw new AirtableTsError({
					message: `Invalid date value '${v as string}' in array from airtable type '${airtableType}'.`,
					type: ErrorType.SCHEMA_VALIDATION,
				});
			}

			return Math.floor(date.getTime() / 1000);
		});
		return timestamps as FromTsTypeString<T>;
	}

	if (parsedType.array && typeof value === parsedType.single) {
		return [value] as FromTsTypeString<T>;
	}

	if (!parsedType.array && Array.isArray(value) && value.length === 1 && typeof value[0] === parsedType.single) {
		return value[0] as FromTsTypeString<T>;
	}

	// { specialValue: 'NaN' }
	if (parsedType.nullable && typeof value === 'object' && value !== null && 'specialValue' in value && value.specialValue === 'NaN') {
		return null as FromTsTypeString<T>;
	}

	// { error: '#ERROR!' }
	if (parsedType.nullable && typeof value === 'object' && value !== null && 'error' in value && value.error === '#ERROR!') {
		return null as FromTsTypeString<T>;
	}

	// [{ error: '#ERROR!' }]
	if (parsedType.nullable && Array.isArray(value) && value.length === 1 && typeof value[0] === 'object' && value[0] !== null && 'error' in value[0] && value[0].error === '#ERROR!') {
		return null as FromTsTypeString<T>;
	}

	if (!parsedType.array && Array.isArray(value) && value.length !== 1) {
		throw new AirtableTsError({
			message: `Cannot convert array with ${value.length} entries from airtable type '${airtableType} to TypeScript type '${tsType}'.`,
			type: ErrorType.SCHEMA_VALIDATION,
			suggestion: `Change the type from '${tsType}' to '${tsType}[]' in your table definition.`,
		});
	}

	throw new AirtableTsError({
		message: `Cannot convert value from airtable type '${airtableType}' to '${tsType}', as the Airtable API provided a '${typeof value}'.`,
		type: ErrorType.SCHEMA_VALIDATION,
		suggestion: 'Update the types in your table definition to compatible types for your Airtable base.',
	});
};

const dateTimeMapperPair = {
	// Number assumed to be unix time in seconds
	// String: ambiguous strings (no timezone) passed through, others converted to UTC
	// Per Airtable spec: ambiguous strings like "2020-09-05T07:00:00" are interpreted
	// in the field's timezone, while non-ambiguous strings with offsets are converted
	toAirtable(value: string | number | null) {
		if (value === null) {
			return null;
		}

		if (typeof value === 'string') {
			// Validation: ensure it's parseable as a date
			const parsedDate = new Date(value);
			if (Number.isNaN(parsedDate.getTime())) {
				throw new AirtableTsError({
					message: 'Invalid date/time string provided.',
					type: ErrorType.SCHEMA_VALIDATION,
				});
			}

			// Check if this is an ISO 8601-like format (YYYY-MM-DD...)
			// These are the only formats where we distinguish ambiguous vs non-ambiguous
			const isIso8601Like = /^\d{4}-\d{2}-\d{2}/.test(value.trim());

			if (isIso8601Like) {
				// For ISO 8601 formats, check if "ambiguous" (no timezone offset)
				// Ambiguous: "2020-09-05T07:00:00", "2020-09-08"
				// Non-ambiguous: "2020-09-05T07:00:00.000Z", "2020-09-08T00:00:00-07:00"
				const hasTimezoneOffset = /[Zz]$|[+-]\d{2}:?\d{2}$/.test(value.trim());

				if (!hasTimezoneOffset) {
					// Ambiguous ISO 8601 - pass through for field timezone interpretation
					return value;
				}
			}

			// Non-ambiguous or non-ISO 8601 format - convert to UTC ISO 8601
			return parsedDate.toJSON();
		}

		// Number: treat as Unix timestamp in seconds
		const date = new Date(value * 1000);
		if (Number.isNaN(date.getTime())) {
			throw new AirtableTsError({
				message: 'Invalid date/time value provided.',
				type: ErrorType.SCHEMA_VALIDATION,
			});
		}

		return date.toJSON();
	},
	fromAirtable(value: string | null | undefined) {
		if (value === null || value === undefined) {
			return null;
		}

		const date = new Date(value);
		if (Number.isNaN(date.getTime())) {
			throw new AirtableTsError({
				message: 'Invalid date/time value received from Airtable.',
				type: ErrorType.SCHEMA_VALIDATION,
			});
		}

		return date.toJSON();
	},
};

const aiTextMapperPair = {
	toAirtable: readonly('aiText'),
	fromAirtable(obj: object | null | undefined) {
		if (!obj || typeof obj !== 'object' || !('value' in obj) || typeof obj.value !== 'string') {
			return null;
		}

		return obj.value;
	},
};

const barcodeMapperPair = {
	toAirtable: (value: string | null) => ({text: value}),
	fromAirtable(obj: object | null | undefined) {
		if (!obj || typeof obj !== 'object' || !('text' in obj) || typeof obj.text !== 'string') {
			return null;
		}

		return obj.text;
	},
};

const collaboratorMapperPair = {
	toAirtable: (value: string | null) => ({id: value}),
	fromAirtable(obj: object | null | undefined) {
		if (!obj || typeof obj !== 'object' || !('id' in obj) || typeof obj.id !== 'string') {
			return null;
		}

		return obj.id;
	},
};

const multipleCollaboratorsMapperPair = {
	toAirtable: (value: string[] | null) => value as unknown as object[],
	fromAirtable(obj: object[] | null | undefined) {
		return obj?.map((v) => ('id' in v && typeof v.id === 'string' ? v.id : null!)).filter(Boolean) ?? null;
	},
};

const multipleAttachmentsMapperPair = {
	toAirtable: readonly('multipleAttachments'),
	fromAirtable(obj: object[] | null | undefined) {
		return obj?.map((v) => ('url' in v && typeof v.url === 'string' ? v.url : null!)).filter(Boolean) ?? null;
	},
};

const multipleAttachmentsWithMetadataMapperPair = {
	toAirtable: readonly('multipleAttachments'),
	fromAirtable(obj: object[] | null | undefined): Attachment[] | null {
		if (!obj) {
			return null;
		}

		return obj
			.filter((v): v is Record<string, unknown> =>
				typeof v === 'object'
				&& v !== null
				&& 'url' in v
				&& typeof (v as Record<string, unknown>).url === 'string')
			.map((v) => {
				const attachment: Attachment = {
					id: typeof v.id === 'string' ? v.id : '',
					url: v.url as string,
					filename: typeof v.filename === 'string' ? v.filename : '',
					size: typeof v.size === 'number' ? v.size : 0,
					type: typeof v.type === 'string' ? v.type : '',
				};

				// Optional width/height for images
				if (typeof v.width === 'number') {
					attachment.width = v.width;
				}

				if (typeof v.height === 'number') {
					attachment.height = v.height;
				}

				// Optional thumbnails
				if (typeof v.thumbnails === 'object' && v.thumbnails !== null) {
					const thumbs = v.thumbnails as Record<string, unknown>;
					const thumbnails: Attachment['thumbnails'] = {};

					for (const size of ['small', 'large', 'full'] as const) {
						const thumb = thumbs[size];
						if (
							typeof thumb === 'object'
							&& thumb !== null
							&& 'url' in thumb
							&& typeof (thumb as Record<string, unknown>).url === 'string'
							&& 'width' in thumb
							&& typeof (thumb as Record<string, unknown>).width === 'number'
							&& 'height' in thumb
							&& typeof (thumb as Record<string, unknown>).height === 'number'
						) {
							thumbnails[size] = {
								url: (thumb as Record<string, unknown>).url as string,
								width: (thumb as Record<string, unknown>).width as number,
								height: (thumb as Record<string, unknown>).height as number,
							};
						}
					}

					if (Object.keys(thumbnails).length > 0) {
						attachment.thumbnails = thumbnails;
					}
				}

				return attachment;
			});
	},
};

const buttonMapperPair = {
	toAirtable: readonly('button'),
	fromAirtable(obj: object | null | undefined) {
		if (!obj || typeof obj !== 'object' || !('label' in obj) || typeof obj.label !== 'string') {
			return null;
		}

		return obj.label;
	},
};

const stringOrNull: Mapper = {
	'string | null': {
		url: fallbackMapperPair(null, null),
		email: fallbackMapperPair(null, null),
		phoneNumber: fallbackMapperPair(null, null),
		singleLineText: fallbackMapperPair(null, null),
		multilineText: fallbackMapperPair(null, null),
		richText: fallbackMapperPair(null, null),
		singleSelect: fallbackMapperPair(null, null),
		aiText: aiTextMapperPair,
		barcode: barcodeMapperPair,
		button: buttonMapperPair,
		singleCollaborator: collaboratorMapperPair,
		multipleCollaborators: {
			toAirtable: (value) => (value ? multipleCollaboratorsMapperPair.toAirtable([value]) : []),
			fromAirtable: (value) => coerce('multipleCollaborators', 'string | null')(multipleCollaboratorsMapperPair.fromAirtable(value)),
		},
		createdBy: {
			toAirtable: readonly('createdBy'),
			fromAirtable: collaboratorMapperPair.fromAirtable,
		},
		lastModifiedBy: {
			toAirtable: readonly('lastModifiedBy'),
			fromAirtable: collaboratorMapperPair.fromAirtable,
		},
		multipleAttachments: {
			toAirtable: readonly('multipleAttachments'),
			fromAirtable: (value) => coerce('multipleAttachments', 'string | null')(multipleAttachmentsMapperPair.fromAirtable(value)),
		},
		multipleSelects: {
			toAirtable: (value) => (value ? [value] : []),
			fromAirtable: coerce('multipleSelects', 'string | null'),
		},
		multipleRecordLinks: {
			toAirtable: (value) => (value ? [value] : []),
			fromAirtable: coerce('multipleRecordLinks', 'string | null'),
		},
		date: {
			toAirtable: (value) => dateTimeMapperPair.toAirtable(value)?.slice(0, 10) ?? null,
			fromAirtable: dateTimeMapperPair.fromAirtable,
		},
		dateTime: dateTimeMapperPair,
		createdTime: dateTimeMapperPair,
		lastModifiedTime: dateTimeMapperPair,
		multipleLookupValues: {
			toAirtable: readonly('multipleLookupValues'),
			fromAirtable: coerce('multipleLookupValues', 'string | null'),
		},
		externalSyncSource: {
			toAirtable: readonly('externalSyncSource'),
			fromAirtable: coerce('externalSyncSource', 'string | null'),
		},
		rollup: {
			toAirtable: readonly('rollup'),
			fromAirtable: coerce('rollup', 'string | null'),
		},
		formula: {
			toAirtable: readonly('formula'),
			fromAirtable: coerce('formula', 'string | null'),
		},
		unknown: {
			toAirtable: (value) => value,
			fromAirtable: coerce('unknown', 'string | null'),
		},
	},
};

const booleanOrNull: Mapper = {
	'boolean | null': {
		checkbox: fallbackMapperPair(null, null),
		multipleLookupValues: {
			toAirtable: readonly('multipleLookupValues'),
			fromAirtable: coerce('multipleLookupValues', 'boolean | null'),
		},
		unknown: {
			toAirtable: (value) => value,
			fromAirtable: coerce('unknown', 'boolean | null'),
		},
	},
};

const numberOrNull: Mapper = {
	'number | null': {
		number: fallbackMapperPair(null, null),
		rating: fallbackMapperPair(null, null),
		duration: fallbackMapperPair(null, null),
		currency: fallbackMapperPair(null, null),
		percent: fallbackMapperPair(null, null),
		count: {
			fromAirtable: (value) => value ?? null,
			toAirtable: readonly('count'),
		},
		autoNumber: {
			fromAirtable: (value) => value ?? null,
			toAirtable: readonly('autoNumber'),
		},
		date: {
			toAirtable: (value) => dateTimeMapperPair.toAirtable(value)?.slice(0, 10) ?? null,
			fromAirtable(value) {
				const nullableValue = dateTimeMapperPair.fromAirtable(value);
				if (nullableValue === null) {
					return null;
				}

				const date = new Date(nullableValue);
				if (Number.isNaN(date.getTime())) {
					throw new AirtableTsError({
						message: 'Invalid date/time value received from Airtable.',
						type: ErrorType.SCHEMA_VALIDATION,
					});
				}

				return Math.floor(date.getTime() / 1000);
			},
		},
		dateTime: {
			toAirtable: dateTimeMapperPair.toAirtable,
			fromAirtable(value) {
				const nullableValue = dateTimeMapperPair.fromAirtable(value);
				if (nullableValue === null) {
					return null;
				}

				const date = new Date(nullableValue);
				if (Number.isNaN(date.getTime())) {
					throw new AirtableTsError({
						message: 'Invalid date/time value received from Airtable.',
						type: ErrorType.SCHEMA_VALIDATION,
					});
				}

				return Math.floor(date.getTime() / 1000);
			},
		},
		createdTime: {
			toAirtable: dateTimeMapperPair.toAirtable,
			fromAirtable(value) {
				const nullableValue = dateTimeMapperPair.fromAirtable(value);
				if (nullableValue === null) {
					return null;
				}

				const date = new Date(nullableValue);
				if (Number.isNaN(date.getTime())) {
					throw new AirtableTsError({
						message: 'Invalid date/time value received from Airtable.',
						type: ErrorType.SCHEMA_VALIDATION,
					});
				}

				return Math.floor(date.getTime() / 1000);
			},
		},
		lastModifiedTime: {
			toAirtable: dateTimeMapperPair.toAirtable,
			fromAirtable(value) {
				const nullableValue = dateTimeMapperPair.fromAirtable(value);
				if (nullableValue === null) {
					return null;
				}

				const date = new Date(nullableValue);
				if (Number.isNaN(date.getTime())) {
					throw new AirtableTsError({
						message: 'Invalid date/time value received from Airtable.',
						type: ErrorType.SCHEMA_VALIDATION,
					});
				}

				return Math.floor(date.getTime() / 1000);
			},
		},
		multipleLookupValues: {
			toAirtable: readonly('multipleLookupValues'),
			fromAirtable: coerce('multipleLookupValues', 'number | null'),
		},
		rollup: {
			toAirtable: readonly('rollup'),
			fromAirtable: coerce('rollup', 'number | null'),
		},
		formula: {
			toAirtable: readonly('formula'),
			fromAirtable: coerce('formula', 'number | null'),
		},
		unknown: {
			toAirtable: (value) => value,
			fromAirtable: coerce('unknown', 'number | null'),
		},
	},
};

const stringArrayOrNull: Mapper = {
	'string[] | null': {
		multipleSelects: fallbackMapperPair([], []),
		multipleRecordLinks: fallbackMapperPair([], []),
		multipleCollaborators: multipleCollaboratorsMapperPair,
		multipleAttachments: multipleAttachmentsMapperPair,
		multipleLookupValues: {
			toAirtable() {
				throw new AirtableTsError({
					message: 'Lookup fields are read-only and cannot be modified.',
					type: ErrorType.SCHEMA_VALIDATION,
				});
			},
			fromAirtable: coerce('multipleLookupValues', 'string[] | null'),
		},
		formula: {
			toAirtable() {
				throw new AirtableTsError({
					message: 'Formula fields are read-only and cannot be modified.',
					type: ErrorType.SCHEMA_VALIDATION,
				});
			},
			fromAirtable: coerce('multipleLookupValues', 'string[] | null'),
		},
		unknown: {
			toAirtable: (value) => value,
			fromAirtable: coerce('unknown', 'string[] | null'),
		},
	},
};

const numberArrayOrNull: Mapper = {
	'number[] | null': {
		multipleLookupValues: {
			toAirtable: readonly('multipleLookupValues'),
			fromAirtable: coerce('multipleLookupValues', 'number[] | null'),
		},
		rollup: {
			toAirtable: readonly('rollup'),
			fromAirtable: coerce('rollup', 'number[] | null'),
		},
		unknown: {
			toAirtable: (value) => value,
			fromAirtable: coerce('unknown', 'number[] | null'),
		},
	},
};

export const fieldMappers: Mapper = {
	...stringOrNull,
	string: {
		...Object.fromEntries(Object.entries(stringOrNull['string | null']!).map(([airtableType, nullablePair]) => {
			return [airtableType, {
				toAirtable: nullablePair.toAirtable,
				fromAirtable(value: null) {
					const nullableValue = nullablePair.fromAirtable(value);
					if (nullableValue === null && ['multipleRecordLinks', 'dateTime', 'createdTime', 'lastModifiedTime'].includes(airtableType)) {
						throw new AirtableTsError({
							message: `Cannot convert null value to string for field type '${airtableType}'.`,
							type: ErrorType.SCHEMA_VALIDATION,
							suggestion: 'Provide a non-null value for this field or update your schema to allow null values.',
						});
					}

					return nullableValue ?? '';
				},
			}];
		})),
	},

	...booleanOrNull,
	boolean: {
		...Object.fromEntries(Object.entries(booleanOrNull['boolean | null']!).map(([airtableType, nullablePair]) => {
			return [airtableType, {
				toAirtable: nullablePair.toAirtable,
				fromAirtable: (value: null) => nullablePair.fromAirtable(value) ?? false,
			}];
		})),
	},

	...numberOrNull,
	number: {
		...Object.fromEntries(Object.entries(numberOrNull['number | null']!).map(([airtableType, nullablePair]) => {
			return [airtableType, {
				toAirtable: nullablePair.toAirtable,
				fromAirtable(value: null) {
					const nullableValue = nullablePair.fromAirtable(value);
					if (nullableValue === null) {
						throw new AirtableTsError({
							message: `Cannot convert null value to number for field type '${airtableType}'.`,
							type: ErrorType.SCHEMA_VALIDATION,
							suggestion: 'Provide a non-null value for this field or update your schema to allow null values.',
						});
					}

					return nullableValue;
				},
			}];
		})),
	},

	...stringArrayOrNull,
	'string[]': {
		...Object.fromEntries(Object.entries(stringArrayOrNull['string[] | null']!).map(([airtableType, nullablePair]) => {
			return [airtableType, {
				toAirtable: nullablePair.toAirtable,
				fromAirtable: (value: null) => nullablePair.fromAirtable(value) ?? [],
			}];
		})),
	},

	...numberArrayOrNull,
	'number[]': {
		...Object.fromEntries(Object.entries(numberArrayOrNull['number[] | null']!).map(([airtableType, nullablePair]) => {
			return [airtableType, {
				toAirtable: nullablePair.toAirtable,
				fromAirtable: (value: null) => nullablePair.fromAirtable(value) ?? [],
			}];
		})),
	},

	'Attachment[] | null': {
		multipleAttachments: multipleAttachmentsWithMetadataMapperPair,
	},
	'Attachment[]': {
		multipleAttachments: {
			toAirtable: multipleAttachmentsWithMetadataMapperPair.toAirtable,
			fromAirtable: (value: object[] | null | undefined) => multipleAttachmentsWithMetadataMapperPair.fromAirtable(value) ?? [],
		},
	},
};

/**
 * Error types for categorizing different kinds of errors
 */
export enum ErrorType {
	SCHEMA_VALIDATION = 'SCHEMA_VALIDATION',
	RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
	INVALID_PARAMETER = 'INVALID_PARAMETER',
	API_ERROR = 'API_ERROR',
}

/**
 * Base error class for all airtable-ts errors
 */
export class AirtableTsError extends Error {
	/** Error type for categorization */
	type: ErrorType;

	constructor(options: {message: string; type: ErrorType; suggestion?: string}) {
		const {message, suggestion, type} = options;
		super(suggestion ? `${message} Suggestion: ${suggestion}` : message);
		this.type = type;
		this.name = 'AirtableTsError';
	}
}

export const prependError = (error: unknown, prefix: string) => {
	if (error instanceof AirtableTsError) {
		error.message = `${prefix}: ${error.message}`;

		error.stack = `Error: ${prefix}: ${error.stack?.startsWith('Error: ') ? error.stack.slice('Error: '.length) : error.stack}`;
	}

	return error;
};

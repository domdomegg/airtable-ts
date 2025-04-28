import AirtableError from 'airtable/lib/airtable_error';

export class WrappedAirtableError extends Error {
  /** The original error thrown by Airtable.js */
  originalError: AirtableError;

  /** The error type from Airtable.js */
  error?: string;

  /** The HTTP status code if applicable */
  statusCode?: number;

  constructor(originalError: AirtableError) {
    super(originalError.message);

    this.name = 'WrappedAirtableError';
    this.originalError = originalError;
    this.error = originalError.error;
    this.statusCode = originalError.statusCode;
  }
}

/**
 * Wraps any error thrown that isn't a proper Error object to ensure it has a stack trace for debugging.
 * @see https://github.com/Airtable/airtable.js/issues/294
 */
function wrapAirtableError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  if (error instanceof AirtableError) {
    return new WrappedAirtableError(error);
  }

  return new Error(String(error));
}

export const wrapToCatchAirtableErrors = <T extends { prototype: object }>(c: T): void => {
  // Cast to any to bypass TypeScript's type checking, as unfortunately this is too funky for TypeScript
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prototype = c.prototype as any;
  const methods = (Object.getOwnPropertyNames(prototype) as (keyof typeof prototype)[]).filter((prop) => {
    return prop !== 'constructor' && typeof prototype[prop] === 'function';
  });
  methods.forEach((method) => {
    const original = prototype[method];

    if (typeof original === 'function') {
      // eslint-disable-next-line func-names
      prototype[method] = function (...args: unknown[]) {
        try {
          const result = original.apply(this, args);

          if (result instanceof Promise) {
            return result.catch((error: unknown) => {
              throw wrapAirtableError(error);
            });
          }

          return result;
        } catch (error) {
          throw wrapAirtableError(error);
        }
      };
    }
  });
};

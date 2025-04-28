export class AirtableTsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AirtableTsError';
  }
}

export class UntrustedSqlAccessError extends Error {
  constructor(
    message = "untrusted caller cannot open a trusted SQL transaction"
  ) {
    super(message);
    this.name = "UntrustedSqlAccessError";
  }
}

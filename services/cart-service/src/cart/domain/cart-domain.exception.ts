export abstract class CartDomainException extends Error {
  protected constructor(
    message: string,
    public readonly errorCode: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

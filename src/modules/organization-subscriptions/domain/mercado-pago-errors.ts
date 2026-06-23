export class MercadoPagoNotConfiguredError extends Error {
  constructor() {
    super('Mercado Pago integration is not configured');
    this.name = 'MercadoPagoNotConfiguredError';
  }
}

export class MercadoPagoRequestError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'MercadoPagoRequestError';
  }
}


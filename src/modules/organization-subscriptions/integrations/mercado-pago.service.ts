import { Injectable } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../../../config/env.schema';
import {
  MercadoPagoNotConfiguredError,
  MercadoPagoRequestError,
} from '../domain/mercado-pago-errors';

interface CreatePreapprovalInput {
  reason: string;
  payerEmail: string;
  externalReference: string;
  amountInCents: number;
  currency: string;
  idempotencyKey: string;
}

export interface MercadoPagoPreapprovalResult {
  id: string;
  status: string | null;
  initPoint: string | null;
  sandboxInitPoint: string | null;
}

export interface MercadoPagoAuthorizedPaymentResult {
  id: string;
  paymentId: string | null;
  preapprovalId: string | null;
  status: string | null;
  statusDetail: string | null;
  transactionAmount: number | null;
  currency: string | null;
  payload: Record<string, unknown>;
}

interface MercadoPagoPreapprovalResponse {
  id?: string;
  status?: string;
  init_point?: string;
  sandbox_init_point?: string;
}

interface MercadoPagoAuthorizedPaymentResponse extends Record<string, unknown> {
  id?: string | number;
  payment_id?: string | number;
  preapproval_id?: string;
  status?: string;
  status_detail?: string;
  transaction_amount?: number;
  currency_id?: string;
}

@Injectable()
export class MercadoPagoService {
  private readonly baseUrl = 'https://api.mercadopago.com';

  async createPreapproval(
    input: CreatePreapprovalInput,
  ): Promise<MercadoPagoPreapprovalResult> {
    const response =
      await this.request<MercadoPagoPreapprovalResponse>('/preapproval', {
        method: 'POST',
        headers: {
          'X-Idempotency-Key': input.idempotencyKey,
        },
        body: JSON.stringify({
          reason: input.reason,
          external_reference: input.externalReference,
          payer_email: input.payerEmail,
          back_url: this.backUrl(),
          notification_url: this.webhookUrl(),
          auto_recurring: {
            frequency: 1,
            frequency_type: 'months',
            transaction_amount: input.amountInCents / 100,
            currency_id: input.currency,
          },
        }),
      });

    if (!response.id) {
      throw new MercadoPagoRequestError('Mercado Pago did not return preapproval id');
    }

    return {
      id: response.id,
      status: response.status ?? null,
      initPoint: response.init_point ?? null,
      sandboxInitPoint: response.sandbox_init_point ?? null,
    };
  }

  validateWebhookSignature(input: {
    xSignature?: string | string[];
    xRequestId?: string | string[];
    dataId?: string;
  }): boolean {
    if (!env.MERCADO_PAGO_WEBHOOK_SECRET) {
      return process.env.NODE_ENV !== 'production';
    }

    const signatureHeader = this.singleHeader(input.xSignature);
    const requestId = this.singleHeader(input.xRequestId);

    if (!signatureHeader || !requestId || !input.dataId) {
      return false;
    }

    const parts = Object.fromEntries(
      signatureHeader.split(',').map((part) => {
        const [key, value] = part.split('=');
        return [key?.trim(), value?.trim()];
      }),
    );

    const timestamp = parts.ts;
    const signature = parts.v1;

    if (!timestamp || !signature) {
      return false;
    }

    const manifest = `id:${input.dataId};request-id:${requestId};ts:${timestamp};`;
    const expected = createHmac('sha256', env.MERCADO_PAGO_WEBHOOK_SECRET)
      .update(manifest)
      .digest('hex');

    return this.safeEqual(signature, expected);
  }

  async getAuthorizedPayment(
    authorizedPaymentId: string,
  ): Promise<MercadoPagoAuthorizedPaymentResult> {
    const response =
      await this.request<MercadoPagoAuthorizedPaymentResponse>(
        `/authorized_payments/${authorizedPaymentId}`,
        { method: 'GET' },
      );

    return {
      id: String(response.id ?? authorizedPaymentId),
      paymentId: response.payment_id ? String(response.payment_id) : null,
      preapprovalId: response.preapproval_id ?? null,
      status: response.status ?? null,
      statusDetail: response.status_detail ?? null,
      transactionAmount: response.transaction_amount ?? null,
      currency: response.currency_id ?? null,
      payload: response,
    };
  }

  private async request<T>(
    path: string,
    init: RequestInit,
  ): Promise<T> {
    if (!env.MERCADO_PAGO_ACCESS_TOKEN) {
      throw new MercadoPagoNotConfiguredError();
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${env.MERCADO_PAGO_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
    });

    const body = (await response.json().catch(() => ({}))) as {
      message?: string;
    };

    if (!response.ok) {
      throw new MercadoPagoRequestError(
        body.message ?? 'Mercado Pago request failed',
        response.status,
      );
    }

    return body as T;
  }

  private backUrl() {
    return env.MERCADO_PAGO_BACK_URL ?? env.BETTER_AUTH_URL;
  }

  private webhookUrl() {
    return (
      env.MERCADO_PAGO_WEBHOOK_URL ??
      `${env.BETTER_AUTH_URL.replace(/\/$/, '')}/api/v1/billing/mercadopago/webhooks`
    );
  }

  private singleHeader(value?: string | string[]) {
    return Array.isArray(value) ? value[0] : value;
  }

  private safeEqual(received: string, expected: string) {
    const receivedBuffer = Buffer.from(received);
    const expectedBuffer = Buffer.from(expected);

    if (receivedBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return timingSafeEqual(receivedBuffer, expectedBuffer);
  }
}

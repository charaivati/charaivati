export type SendSmsOpts = {
  to: string;
  body: string;
  // optional unique id for idempotency/logging
  id?: string;
};
export type SendResult = {
  ok: boolean;
  provider?: string;
  providerId?: string;
  error?: string;
};

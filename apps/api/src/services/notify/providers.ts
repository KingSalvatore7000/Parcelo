/**
 * Message delivery providers. Each one sends a single message to one Indian mobile number.
 *
 * - console: prints the message (development, or until a provider is configured)
 * - whatsapp: WhatsApp Cloud API (Meta), using pre-approved message templates
 * - sms: MSG91 Flow API, using DLT-registered templates (required for SMS in India)
 *
 * Template variables are always passed in a fixed order, listed per message kind in messages.ts.
 */

export type Channel = 'console' | 'whatsapp' | 'sms';

export interface OutgoingMessage {
  /** E.164, e.g. +919876543210 */
  to: string;
  /** Plain text, used by the console provider and kept for the record */
  text: string;
  /** Provider template id or name for this kind of message */
  template?: string;
  /** Template variables, in the template's order */
  params: string[];
}

export interface Provider {
  channel: Channel;
  send(msg: OutgoingMessage): Promise<void>;
}

export class ProviderError extends Error {
  constructor(message: string, readonly retryable: boolean) {
    super(message);
  }
}

const TIMEOUT_MS = 10_000;

async function postJson(url: string, headers: Record<string, string>, body: unknown): Promise<void> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => '')).slice(0, 300);
      // 4xx (bad template, bad number, auth) will not fix itself; 429 and 5xx may
      const retryable = res.status === 429 || res.status >= 500;
      throw new ProviderError(`HTTP ${res.status}: ${detail}`, retryable);
    }
  } catch (err) {
    if (err instanceof ProviderError) throw err;
    throw new ProviderError(`network error: ${(err as Error).message}`, true);
  } finally {
    clearTimeout(timer);
  }
}

export class ConsoleProvider implements Provider {
  channel: Channel = 'console';
  async send(msg: OutgoingMessage) {
    console.log(`📨 [message to ${msg.to}] ${msg.text}`);
  }
}

export class WhatsAppCloudProvider implements Provider {
  channel: Channel = 'whatsapp';
  constructor(
    private token: string,
    private phoneNumberId: string,
    private language: string,
    private apiVersion = 'v20.0'
  ) {}

  async send(msg: OutgoingMessage) {
    if (!msg.template) throw new ProviderError('no WhatsApp template configured for this message', false);
    await postJson(
      `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/messages`,
      { Authorization: `Bearer ${this.token}` },
      {
        messaging_product: 'whatsapp',
        to: msg.to.replace(/^\+/, ''),
        type: 'template',
        template: {
          name: msg.template,
          language: { code: this.language },
          components: [{ type: 'body', parameters: msg.params.map((text) => ({ type: 'text', text })) }],
        },
      }
    );
  }
}

export class Msg91Provider implements Provider {
  channel: Channel = 'sms';
  constructor(private authKey: string) {}

  async send(msg: OutgoingMessage) {
    if (!msg.template) throw new ProviderError('no MSG91 template id configured for this message', false);
    const vars: Record<string, string> = {};
    msg.params.forEach((v, i) => (vars[`var${i + 1}`] = v));
    await postJson(
      'https://control.msg91.com/api/v5/flow',
      { authkey: this.authKey },
      { template_id: msg.template, short_url: '0', recipients: [{ mobiles: msg.to.replace(/^\+/, ''), ...vars }] }
    );
  }
}

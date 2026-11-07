import { describe, it, expect, vi, afterEach } from 'vitest';
import { WhatsAppCloudProvider, Msg91Provider, ProviderError } from '../src/services/notify/providers';

afterEach(() => vi.unstubAllGlobals());

function captureFetch(status = 200) {
  const calls: { url: string; init: RequestInit }[] = [];
  vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(status === 200 ? '{}' : '{"error":{"message":"bad"}}', { status });
  });
  return calls;
}

describe('WhatsApp Cloud API requests', () => {
  const wa = new WhatsAppCloudProvider('TOKEN', '1234567890', 'en');

  it('sends a template with body variables', async () => {
    const calls = captureFetch();
    await wa.send({ to: '+919876543210', text: 'x', template: 'parcel_arrived', params: ['Amazon', 'Tower A - 1204'] });
    expect(calls[0].url).toBe('https://graph.facebook.com/v20.0/1234567890/messages');
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe('Bearer TOKEN');
    expect(JSON.parse(String(calls[0].init.body))).toEqual({
      messaging_product: 'whatsapp',
      to: '919876543210',
      type: 'template',
      template: {
        name: 'parcel_arrived',
        language: { code: 'en' },
        components: [{ type: 'body', parameters: [{ type: 'text', text: 'Amazon' }, { type: 'text', text: 'Tower A - 1204' }] }],
      },
    });
  });

  it('adds the copy-code button for a sign-in code', async () => {
    const calls = captureFetch();
    await wa.send({ to: '+919876543210', text: 'x', template: 'login_code', params: ['482913'], otp: '482913' });
    const body = JSON.parse(String(calls[0].init.body));
    expect(body.template.components[1]).toEqual({
      type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: '482913' }],
    });
  });

  it('treats a 400 as final and a 503 as worth retrying', async () => {
    captureFetch(400);
    await expect(wa.send({ to: '+91', text: '', template: 't', params: [] })).rejects.toMatchObject({ retryable: false });
    captureFetch(503);
    await expect(wa.send({ to: '+91', text: '', template: 't', params: [] })).rejects.toBeInstanceOf(ProviderError);
  });

  it('refuses to send without a template name', async () => {
    await expect(wa.send({ to: '+91', text: '', params: [] })).rejects.toMatchObject({ retryable: false });
  });
});

describe('MSG91 requests', () => {
  it('maps variables to var1, var2 ...', async () => {
    const calls = captureFetch();
    await new Msg91Provider('KEY').send({ to: '+919876543210', text: 'x', template: 'tmpl-1', params: ['Amazon', 'A-1204'] });
    expect(JSON.parse(String(calls[0].init.body))).toEqual({
      template_id: 'tmpl-1', short_url: '0', recipients: [{ mobiles: '919876543210', var1: 'Amazon', var2: 'A-1204' }],
    });
  });
});

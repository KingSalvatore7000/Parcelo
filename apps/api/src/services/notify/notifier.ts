import { prisma } from '../../lib/prisma';
import { config } from '../../config/env';
import {
  Channel,
  ConsoleProvider,
  Msg91Provider,
  OutgoingMessage,
  Provider,
  ProviderError,
  WhatsAppCloudProvider,
} from './providers';

/**
 * Message kinds and their template variables, in order. Register templates with these
 * variables in WhatsApp Business Manager or MSG91 (DLT), then set their ids in the env.
 *
 *   OTP         1: the 6-digit code
 *   NEW_PARCEL  1: courier, 2: flat label
 *   REMINDER    1: courier, 2: flat label, 3: days waiting
 */
export type MessageKind = 'OTP' | 'NEW_PARCEL' | 'REMINDER';

export function messageText(kind: MessageKind, params: string[]): string {
  switch (kind) {
    case 'OTP':
      return `${params[0]} is your Parcelo sign-in code. It expires in 5 minutes. Do not share it.`;
    case 'NEW_PARCEL':
      return `Parcelo: a ${params[0]} parcel for ${params[1]} is at the gate. Open Parcelo to pick a pickup slot.`;
    case 'REMINDER':
      return `Parcelo: your ${params[0]} parcel for ${params[1]} has waited ${params[2]} days at the gate. Please pick a slot in Parcelo.`;
  }
}

function buildProvider(channel: Channel): Provider {
  const n = config.notify;
  if (channel === 'whatsapp') return new WhatsAppCloudProvider(n.whatsapp.token!, n.whatsapp.phoneNumberId!, n.whatsapp.language);
  if (channel === 'sms') return new Msg91Provider(n.msg91.authKey!);
  return new ConsoleProvider();
}

function templateFor(channel: Channel, kind: MessageKind): string | undefined {
  if (channel === 'whatsapp') return config.notify.whatsapp.templates[kind];
  if (channel === 'sms') return config.notify.msg91.templates[kind];
  return undefined;
}

const providers = new Map<Channel, Provider>();
function provider(channel: Channel): Provider {
  let p = providers.get(channel);
  if (!p) {
    p = buildProvider(channel);
    providers.set(channel, p);
  }
  return p;
}

/** Tests replace the provider for a channel to capture what would be sent */
export function setProviderForTests(channel: Channel, p: Provider) {
  providers.set(channel, p);
}

export function compose(channel: Channel, kind: MessageKind, to: string, params: string[]): OutgoingMessage {
  return { to, params, text: messageText(kind, params), template: templateFor(channel, kind) };
}

/** Send a login OTP right away (not through the outbox: it must arrive within its 5 minutes) */
export async function sendOtp(phone: string, otp: string): Promise<void> {
  const ch = config.notify.otpChannel;
  await provider(ch).send({ ...compose(ch, 'OTP', phone, [otp]), otp });
}

/** The database channel value for the configured notification channel */
export function dbChannel(): 'WHATSAPP' | 'SMS' | 'PUSH' {
  const ch = config.notify.channel;
  return ch === 'whatsapp' ? 'WHATSAPP' : ch === 'sms' ? 'SMS' : 'PUSH';
}

export const MAX_ATTEMPTS = 3;
const BATCH = 50;

/**
 * Send queued notifications. Each row is claimed by bumping its attempt count while it is still
 * PENDING, so two workers never send the same row. Failures stay PENDING for a retry, until the
 * third attempt or an error that cannot succeed (a bad template, an invalid number) marks them FAILED.
 */
export async function processOutbox(): Promise<{ sent: number; failed: number; retrying: number }> {
  const due = await prisma.notification.findMany({
    where: { status: 'PENDING', attempts: { lt: MAX_ATTEMPTS } },
    include: { user: { select: { phone: true } }, parcel: { include: { flat: true } } },
    orderBy: { createdAt: 'asc' },
    take: BATCH,
  });

  let sent = 0, failed = 0, retrying = 0;
  const ch = config.notify.channel;

  for (const n of due) {
    const claimed = await prisma.notification.updateMany({
      where: { id: n.id, status: 'PENDING', attempts: n.attempts },
      data: { attempts: { increment: 1 } },
    });
    if (claimed.count === 0) continue; // another worker took it

    const p = n.parcel;
    const flat = p ? `Tower ${p.flat.tower} - ${p.flat.number}` : 'your flat';
    const days = p ? String(Math.max(1, Math.floor((Date.now() - p.loggedAt.getTime()) / 86_400_000))) : '';
    const params = n.kind === 'REMINDER' ? [p?.courier ?? 'parcel', flat, days] : [p?.courier ?? 'parcel', flat];

    try {
      await provider(ch).send(compose(ch, n.kind, n.user.phone, params));
      await prisma.notification.update({
        where: { id: n.id },
        data: { status: 'SENT', sentAt: new Date(), lastError: null },
      });
      sent++;
    } catch (err) {
      const retryable = err instanceof ProviderError ? err.retryable : true;
      const final = !retryable || n.attempts + 1 >= MAX_ATTEMPTS;
      await prisma.notification.update({
        where: { id: n.id },
        data: { status: final ? 'FAILED' : 'PENDING', lastError: String((err as Error).message).slice(0, 500) },
      });
      if (final) failed++;
      else retrying++;
    }
  }
  return { sent, failed, retrying };
}

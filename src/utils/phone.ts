import { env } from '../config/env';

/**
 * Normalize a Pakistani phone number to international format without '+'.
 * Examples:
 *   "03001234567"   -> "923001234567"
 *   "3001234567"    -> "923001234567"
 *   "+92 300 123 4567" -> "923001234567"
 *   "0092-300-1234567" -> "923001234567"
 */
export function normalizePhone(raw: string, dialCode = env.defaultDialCode): string {
  let digits = (raw || '').replace(/[^\d]/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith(dialCode) && digits.length >= 11) return digits;
  if (digits.startsWith('0')) digits = digits.slice(1);
  return `${dialCode}${digits}`;
}

/** Build a wa.me click-to-chat link with a pre-filled message. */
export function buildWhatsAppLink(phone: string, message: string): string {
  const normalized = normalizePhone(phone);
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

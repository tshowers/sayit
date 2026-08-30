/**
 * Minimal stand-in for TODD's full Contact model. SayIt only needs a loose
 * shape here to satisfy types on interfaces it doesn't actually instantiate
 * (e.g. Email's queue/sent contact lists) — not the full CRM contact record.
 */
export interface Contact {
  id: string;
  [key: string]: any;
}

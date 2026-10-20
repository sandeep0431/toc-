/**
 * events.ts: Event definitions and symbolic classification.
 *
 * Formal Theory:
 * Intrusion detection reduces complex temporal and spatial security log streams
 * into discrete event symbols over an alphabet Σ_events:
 * - F: Failed authentication
 * - S: Successful authentication
 * - P: Port probe or connection refused
 * - R: Normal web request (2xx/3xx HTTP status)
 * - E: Error web request (4xx/5xx HTTP status)
 * - X: Payload intrusion pattern match (derived)
 */

export type EventSymbol = "F" | "S" | "P" | "R" | "E" | "X";

export type EventKind = "auth" | "web" | "firewall";

export interface Event {
  readonly lineNumber: number;
  readonly ts: number; // Milliseconds since Unix epoch
  readonly source: string;
  readonly kind: EventKind;
  readonly symbol: EventSymbol;
  readonly raw: string;
  readonly fields: Record<string, string>;
}

/**
 * A scan waiting to be handed to the translate screen.
 *
 * The Camera tab and the Translate tab are separate routes, so recognised text
 * has to cross between them. It is passed here rather than as a navigation
 * parameter: route params end up in navigation state and in anything that
 * inspects it, and this is the user's own words off a photograph.
 *
 * Deliberately tiny and one-shot. `consume` clears as it reads, so returning
 * to the translate screen later never re-applies an old scan, and nothing
 * accumulates. The same one-way-bridge shape as `active-preferences`.
 */

let pending: string | undefined;

export function setPendingScan(text: string): void {
  const trimmed = text.trim();
  pending = trimmed.length > 0 ? trimmed : undefined;
}

/** Reads and clears in one step; a scan is delivered exactly once. */
export function consumePendingScan(): string | undefined {
  const text = pending;
  pending = undefined;
  return text;
}

/** Test seam, and used when the camera flow is abandoned. */
export function clearPendingScan(): void {
  pending = undefined;
}

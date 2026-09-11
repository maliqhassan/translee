import type { ColorTokens } from './colors';
import type { Theme } from './theme';

/**
 * The colour a word or a glyph is actually drawn in.
 *
 * Almost every token means the same thing whether it fills a shape or paints a
 * letter. `primary` is the exception: the brand colour is a light sky blue
 * chosen so dark text reads well on top of it, which makes it a good fill and
 * a bad ink — as text on the app background it sits at roughly 1.6:1, well
 * under the 4.5:1 floor.
 *
 * Rather than making every call site remember that, `primary` resolves here to
 * the brand *ink*: the same hue, dark enough to read. Fills keep using
 * `theme.colors.primary` directly, which is what they want.
 */
export function resolveInk<K extends keyof ColorTokens>(theme: Theme, token: K): string {
  return token === 'primary' ? theme.colors.primaryStrong : theme.colors[token];
}

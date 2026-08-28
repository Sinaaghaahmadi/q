import type { Transition, Variants } from "framer-motion";

/**
 * One motion system, and the numbers in it are the ones the design brief names
 * (docs/design-master-prompt.md §4).
 *
 * Before this file every component invented its own transition: `duration: 0.25`
 * here, `0.3` there, `stiffness: 300, damping: 24` in a third place. None of
 * them were wrong on their own, and together they read as software rather than
 * as one product — the thing that separates a good app from Telegram is not any
 * single animation but that every animation agrees with every other one.
 *
 * Springs are declared with `visualDuration` + `bounce` rather than
 * stiffness/damping on purpose: those two describe what a person perceives (how
 * long it takes to arrive, how much it overshoots) instead of the physics that
 * produces it, so a designer's note translates to code without arithmetic.
 *
 * Every export here is a plain object. Reduced motion is *not* handled inside
 * them — a component must call `useReducedMotion()` and pass `INSTANT`, because
 * only the component knows which of its transitions carry meaning.
 */

/** Entry curve: fast out of the gate, settles gently. */
export const EASE_IN: Transition["ease"] = [0.22, 1, 0.36, 1];
/** Exit curve: leaves without ceremony. */
export const EASE_OUT: Transition["ease"] = [0.4, 0, 1, 1];

/** For `prefers-reduced-motion`. Not zero-length — zero still re-renders. */
export const INSTANT: Transition = { duration: 0 };

/**
 * Touch feedback. No bounce: a button that overshoots under the finger feels
 * loose, not lively.
 */
export const PRESS: Transition = { type: "spring", visualDuration: 0.15, bounce: 0 };

/** Sheets, popovers, dialogs — enough bounce to feel physical, not springy. */
export const SHEET: Transition = { type: "spring", visualDuration: 0.35, bounce: 0.2 };

/** Items changing place in a list (filter, sort, insert). */
export const LAYOUT: Transition = { type: "spring", visualDuration: 0.3, bounce: 0.15 };

/** Directional page change. */
export const PAGE: Transition = { duration: 0.2, ease: EASE_IN };

/** Content appearing in place (tab body, revealed panel). */
export const FADE: Transition = { duration: 0.2, ease: EASE_IN };

/** The press scale the brief specifies. Applied via `whileTap`. */
export const PRESS_SCALE = 0.97;

/** List entry: how far an item rises, and the gap between neighbours. */
export const LIST_RISE_PX = 8;
export const LIST_STAGGER_S = 0.035;
/**
 * Stagger dies after ten items. Beyond that the last row waits on a queue it
 * had no part in, which reads as lag rather than as choreography.
 */
export const LIST_STAGGER_MAX = 10;

/** Toast dwell before it leaves on its own. */
export const TOAST_MS = 3000;

/**
 * Variants for a list whose children rise into place.
 *
 * `custom` is the item's index; past `LIST_STAGGER_MAX` the delay stops growing
 * so a long list finishes with the screen rather than after it.
 */
export const listItem: Variants = {
  hidden: { opacity: 0, y: LIST_RISE_PX },
  shown: (index: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { ...FADE, delay: Math.min(index, LIST_STAGGER_MAX) * LIST_STAGGER_S },
  }),
};

/**
 * Variants for a page or panel that slides in the direction of travel.
 *
 * `custom` is the writing direction's sign: +1 for LTR, -1 for RTL. Forward is
 * always "further along the way you read", so in Persian the movement mirrors
 * without any component having to think about it.
 */
export const pageSlide: Variants = {
  hidden: (sign: number = 1) => ({ opacity: 0, x: LIST_RISE_PX * sign }),
  shown: { opacity: 1, x: 0, transition: PAGE },
  gone: (sign: number = 1) => ({
    opacity: 0,
    x: -LIST_RISE_PX * sign,
    transition: { duration: 0.15, ease: EASE_OUT },
  }),
};

/** +1 in LTR, -1 in RTL — the sign `pageSlide` wants. */
export function directionSign(locale: string): number {
  return locale === "fa" ? -1 : 1;
}

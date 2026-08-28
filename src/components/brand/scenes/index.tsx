/**
 * The Asaex illustration set (§2.6, §13).
 *
 * One rig — the tinted disc, the contact shadow, the rounded 3-unit stroke of
 * the logo, the coin silhouette of the currency icons — carried across every
 * moment the product has. SVG + Framer Motion rather than Lottie files: a few
 * KB each, theme-aware through CSS variables, and static under
 * `prefers-reduced-motion` by construction.
 *
 * Split by what the scene is *about* rather than by where it renders, because
 * the same drawing serves a customer screen and a staff panel: an order that
 * has been sent abroad looks the same to the person who sent it and to the
 * office that sent it.
 *
 *   core      the sign-in and KYC wizard, and the two universal outcomes
 *   identity  the verdicts that path returns, and the second factor
 *   money     the order machine, end to end
 *   banking   destination accounts, rails, limits
 *   market    rates, alerts, gold, the peer market
 *   rewards   tier and referral
 *   support   conversations and help
 *   staff     the exchange office and the platform console
 *   states    empty, missing, offline, and the other honest dead ends
 *
 * **Import the leaf, not this barrel, from product code.** Every module here
 * is a client module, so one name taken from the barrel drags all sixty-eight
 * scenes into that route's bundle — which is exactly how three admin routes
 * went over the performance budget the first time these were wired up. This
 * file exists for the design page, which shows all of them anyway.
 */
export * from "./core";
export * from "./identity";
export * from "./money";
export * from "./banking";
export * from "./market";
export * from "./rewards";
export * from "./support";
export * from "./staff";
export * from "./states";

"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useLocale } from "next-intl";
import * as React from "react";

/**
 * Page transition (§13): 200ms fade plus an 8px slide along the reading
 * direction. `template.tsx` rather than `layout.tsx` because a template
 * re-mounts on every navigation, which is exactly the lifecycle an entrance
 * animation needs.
 *
 * `x` is a physical translate, so the sign is flipped for RTL: content arrives
 * from the end of the line and settles, which reads the same way in both
 * scripts. Reduced motion collapses it to nothing, as §13 requires of
 * everything.
 */
export default function LocaleTemplate({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();
  const locale = useLocale();
  if (reduce) return <>{children}</>;

  return (
    <motion.div
      initial={{ opacity: 0, x: locale === "fa" ? -8 : 8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      style={{ transformBox: "border-box" }}
    >
      {children}
    </motion.div>
  );
}

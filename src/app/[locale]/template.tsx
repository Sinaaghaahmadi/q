"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useLocale } from "next-intl";
import * as React from "react";
import { directionSign, LIST_RISE_PX, PAGE } from "@/lib/motion";

/**
 * Page transition (§13): 200ms fade plus an 8px slide along the reading
 * direction. `template.tsx` rather than `layout.tsx` because a template
 * re-mounts on every navigation, which is exactly the lifecycle an entrance
 * animation needs.
 *
 * `x` is a physical translate, so the sign is flipped for RTL: content arrives
 * from the end of the line and settles, which reads the same way in both
 * scripts. Reduced motion collapses it to nothing, as §13 requires of
 * everything. The numbers come from `@/lib/motion` so this transition and every
 * other one in the app move at the same speed.
 */
export default function LocaleTemplate({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();
  const locale = useLocale();
  if (reduce) return <>{children}</>;

  return (
    <motion.div
      initial={{ opacity: 0, x: LIST_RISE_PX * directionSign(locale) }}
      animate={{ opacity: 1, x: 0 }}
      transition={PAGE}
      style={{ transformBox: "border-box" }}
    >
      {children}
    </motion.div>
  );
}

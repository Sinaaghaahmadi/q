import { CheckCircle2, ChevronLeft, type LucideIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import * as React from "react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export interface AttentionItem {
  key: string;
  href: string;
  icon: LucideIcon;
  count: number;
  /** How loudly this asks. `urgent` is somebody is waiting past a promise. */
  severity: "urgent" | "waiting" | "info";
}

/**
 * What is asking for the administrator right now.
 *
 * The old dashboard opened on five month-to-date totals, which answer "how did
 * we do" — a question worth asking once a week. The question somebody actually
 * opens a console for is "is anything wrong, and what do I do about it", and
 * nothing on the page answered it. Every count here is a queue with a name and
 * a link, ordered by how long somebody has been waiting rather than by which
 * table it came from.
 *
 * When every queue is empty it says so in one line. That is not filler: an
 * empty console that looks identical to a broken one sends people hunting, and
 * "nothing needs you" is a genuinely useful thing to be told.
 */
export async function Attention({ items }: { items: AttentionItem[] }) {
  const t = await getTranslations("admin.attention");

  const live = items
    .filter((item) => item.count > 0)
    .sort((a, b) => {
      const rank = { urgent: 0, waiting: 1, info: 2 } as const;
      return rank[a.severity] - rank[b.severity] || b.count - a.count;
    });

  if (live.length === 0) {
    return (
      <section className="flex items-center gap-3 rounded-2xl border border-up/30 bg-up/[0.04] px-4 py-3.5">
        <CheckCircle2 className="size-5 shrink-0 text-up" aria-hidden />
        <p className="text-sm font-medium">{t("allClear")}</p>
      </section>
    );
  }

  return (
    <section aria-labelledby="attention-heading" className="space-y-2.5">
      <h2 id="attention-heading" className="text-sm font-semibold">
        {t("title")}
      </h2>
      <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {live.map((item) => (
          <li key={item.key}>
            <Link
              href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-xl border p-3 transition-colors",
                item.severity === "urgent"
                  ? "border-down/35 bg-down/[0.05] hover:bg-down/10"
                  : item.severity === "waiting"
                    ? "border-warn/40 bg-warn/[0.05] hover:bg-warn/10"
                    : "border-ink-300/50 bg-surface hover:bg-ink-300/10",
              )}
            >
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-lg",
                  item.severity === "urgent"
                    ? "bg-down/15 text-down-ink"
                    : item.severity === "waiting"
                      ? "bg-warn/15 text-warn-ink"
                      : "bg-ink-300/25 text-ink-600",
                )}
              >
                <item.icon className="size-4.5" aria-hidden />
              </span>

              <span className="min-w-0 flex-1">
                {/* The count leads. "Seven waiting" is a different sentence
                    from "waiting: 7", and only one of them is read at a
                    glance from across a desk. */}
                <span className="num block text-lg leading-none font-bold">{item.count}</span>
                <span className="mt-1 block truncate text-xs text-ink-600">
                  {t(`item.${item.key}`)}
                </span>
              </span>

              <ChevronLeft
                className="size-4 shrink-0 text-ink-300 transition-transform group-hover:-translate-x-0.5 ltr:rotate-180 rtl:group-hover:translate-x-0.5"
                aria-hidden
              />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

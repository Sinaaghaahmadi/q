"use client";

import { Check, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { BankMark } from "@/components/banks/bank-mark";
import { Input } from "@/components/ui/input";
import { IRANIAN_BANKS } from "@/lib/validators";
import { cn } from "@/lib/utils";

/**
 * Pick a bank from all twenty.
 *
 * A `<select>` would have been a third of the code, and it is the wrong control
 * here: the person using it is an exchange-office clerk who knows their bank by
 * its colour and shape long before they can find its name in an alphabetical
 * list, and a native select on Android renders twenty identical rows of Persian
 * text. Tiles with the bank's own mark are found by eye in about a second.
 *
 * The search box is there for the other case — someone who does know the name
 * and would rather type four letters than scan a grid — and it matches the
 * localised name, so typing "ملت" works in Persian and "mellat" works in
 * English without either list needing to carry the other's spelling.
 */
export function BankPicker({
  value,
  onChange,
  /** Named from the sheba the operator pasted; shown as a nudge if it differs. */
  detected,
  disabled = false,
}: {
  value: string | null;
  onChange: (bankId: string) => void;
  detected?: string | null;
  disabled?: boolean;
}) {
  const t = useTranslations("settlement");
  const tb = useTranslations("banks");
  const [query, setQuery] = React.useState("");

  const needle = query.trim().toLowerCase();
  const banks = React.useMemo(() => {
    if (!needle) return IRANIAN_BANKS;
    return IRANIAN_BANKS.filter(
      (b) => tb(b.id).toLowerCase().includes(needle) || b.id.toLowerCase().includes(needle),
    );
  }, [needle, tb]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search
          className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-600"
          aria-hidden
        />
        <Input
          value={query}
          disabled={disabled}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("bank.search")}
          aria-label={t("bank.search")}
          className="ps-9"
        />
      </div>

      {banks.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-600">{t("bank.noMatch")}</p>
      ) : (
        <ul
          className="list-rise grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4"
          role="radiogroup"
          aria-label={t("bank.label")}
        >
          {banks.map((bank, i) => {
            const selected = bank.id === value;
            return (
              <li key={bank.id} style={{ "--i": i } as React.CSSProperties}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={disabled}
                  onClick={() => onChange(bank.id)}
                  className={cn(
                    "pressable glass glass-lift flex w-full items-center gap-2.5 p-2.5 text-start",
                    selected ? "ring-2 ring-brand-600" : "",
                    disabled ? "opacity-50" : "",
                  )}
                  style={{ "--glass-tint": bank.color } as React.CSSProperties}
                >
                  <BankMark bankId={bank.id} size={36} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium">{tb(bank.id)}</span>
                    {detected === bank.id ? (
                      <span className="block text-[0.65rem] text-ink-600">
                        {t("bank.detected")}
                      </span>
                    ) : null}
                  </span>
                  {selected ? (
                    <Check className="size-4 shrink-0 text-brand-600" aria-hidden />
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

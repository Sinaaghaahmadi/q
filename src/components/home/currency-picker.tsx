"use client";

import { ChevronDown, Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";
import { CoinIcon } from "@/components/brand/coin";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { CURRENCY_CODES, TOP_CORRIDORS, type CurrencyCode } from "@/lib/rates/catalog";
import { cn } from "@/lib/utils";

interface CurrencyPickerProps {
  value: CurrencyCode;
  onChange: (code: CurrencyCode) => void;
  /** Codes to exclude (e.g. the other leg's currency). */
  exclude?: CurrencyCode[];
  ariaLabel: string;
}

/** Bottom sheet on mobile, modal on desktop (§2.5), with 3D coins in the list. */
export function CurrencyPicker({ value, onChange, exclude = [], ariaLabel }: CurrencyPickerProps) {
  const t = useTranslations();
  const locale = useLocale();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  const codes = CURRENCY_CODES.filter((c) => !exclude.includes(c));
  const q = query.trim().toLowerCase();
  const filtered = q
    ? codes.filter(
        (c) => c.toLowerCase().includes(q) || t(`currencies.${c}`).toLowerCase().includes(q),
      )
    : codes;
  const popular = filtered.filter((c) => c === "IRT" || TOP_CORRIDORS.includes(c));
  const rest = filtered.filter((c) => c !== "IRT" && !TOP_CORRIDORS.includes(c));

  function select(code: CurrencyCode) {
    onChange(code);
    setOpen(false);
    setQuery("");
  }

  function Row({ code }: { code: CurrencyCode }) {
    const active = code === value;
    return (
      <button
        type="button"
        onClick={() => select(code)}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start transition-colors",
          active ? "bg-brand-50" : "hover:bg-ink-300/20",
          "pressable",
        )}
      >
        <CoinIcon code={code} size={32} />
        <span className="flex-1">
          <span className="block text-sm font-medium">{t(`currencies.${code}`)}</span>
          <span className="block text-xs text-ink-600" dir="ltr">
            {code}
          </span>
        </span>
        {active ? <span className="size-2 rounded-full bg-brand-600" aria-hidden /> : null}
      </button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel}
          className="pressable flex shrink-0 items-center gap-2 rounded-xl px-2.5 py-1.5 hover:bg-ink-300/20"
        >
          <CoinIcon code={value} size={30} />
          <span className="text-sm font-semibold" dir="ltr">
            {value}
          </span>
          <ChevronDown className="size-4 text-ink-600" aria-hidden />
        </button>
      </DialogTrigger>
      <DialogContent variant="sheet" className="p-0">
        <div className="border-b border-ink-300/40 p-4 pe-12">
          <DialogTitle className="text-base font-semibold">
            {t("converter.pickCurrency")}
          </DialogTitle>
          <div className="relative mt-3">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-600" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("converter.searchCurrency")}
              className="ps-9"
              autoFocus={false}
              dir={locale === "fa" ? "rtl" : "ltr"}
            />
          </div>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-3">
          {popular.length > 0 ? (
            <div>
              <p className="px-3 pb-1 text-xs font-medium text-ink-600">{t("converter.popular")}</p>
              {popular.map((code) => (
                <Row key={code} code={code} />
              ))}
            </div>
          ) : null}
          {rest.length > 0 ? (
            <div>
              <p className="px-3 pb-1 text-xs font-medium text-ink-600">{t("converter.all")}</p>
              {rest.map((code) => (
                <Row key={code} code={code} />
              ))}
            </div>
          ) : null}
          {filtered.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-ink-600">{t("converter.noResults")}</p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

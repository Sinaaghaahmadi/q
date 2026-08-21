import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import * as React from "react";
import { z } from "zod";
import { TransferQuote } from "@/components/transfer/transfer-quote";
import { CURRENCY_CODES, type CurrencyCode } from "@/lib/rates/catalog";
import { computeQuote, type QuoteDirection } from "@/lib/rates/pricing";
import { getSnapshot } from "@/lib/rates/service";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({
  from: z.enum(CURRENCY_CODES).catch("USD"),
  to: z.enum(CURRENCY_CODES).catch("IRT"),
  amount: z.coerce.number().positive().max(1e15).catch(1000),
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "transfer" });
  return { title: t("metaTitle") };
}

export default async function TransferNewPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const parsed = paramsSchema.parse({
    from: typeof sp.from === "string" ? sp.from.toUpperCase() : undefined,
    to: typeof sp.to === "string" ? sp.to.toUpperCase() : undefined,
    amount: typeof sp.amount === "string" && sp.amount !== "" ? sp.amount : undefined,
  });

  // Phase-1 corridor rule (§1): exactly one leg is IRT.
  let from: CurrencyCode = parsed.from;
  let to: CurrencyCode = parsed.to;
  if (from === to) {
    from = "USD";
    to = "IRT";
  } else if (from !== "IRT" && to !== "IRT") {
    to = "IRT";
  }

  const snapshot = await getSnapshot();
  const foreign = (from === "IRT" ? to : from) as Exclude<CurrencyCode, "IRT">;
  const mid = snapshot.rates[foreign]?.mid ?? 0;
  const direction: QuoteDirection = from === "IRT" ? "irt_to_foreign" : "foreign_to_irt";
  const quote = computeQuote({ direction, sendAmount: parsed.amount, midToman: mid });

  return <TransferQuote quote={quote} from={from} to={to} snapshot={snapshot} />;
}

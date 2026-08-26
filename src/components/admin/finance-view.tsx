import { CircleAlert, CircleCheck, Scale, TriangleAlert } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";
import { PanelSection } from "@/components/layout/panel-section";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { formatAmount, formatDate, formatNumber, type AppLocale } from "@/lib/money/format";
import { fromMinor } from "@/lib/money/minor";
import type { CurrencyCode } from "@/lib/rates/catalog";
import type { LedgerAccount, LedgerEntry } from "@/lib/supabase/types";

export type OwnerType = LedgerAccount["owner_type"];

/** One ledger account and where it stands: debits minus credits, in minor units. */
export type TrialRow = {
  id: string;
  ownerType: OwnerType;
  ownerId: string | null;
  ownerNameFa: string | null;
  ownerNameEn: string | null;
  code: string;
  currency: string;
  netMinor: number;
  entries: number;
};

/** `start` is the bucket's own first day, in the reader's calendar. */
export type FeeMonth = { start: string; netMinor: number };

export type OfficeFee = {
  officeId: string;
  nameFa: string | null;
  nameEn: string | null;
  netMinor: number;
};

/** `ownerType` is null when the entry's account row was not readable. */
export type TxnLine = Pick<
  LedgerEntry,
  "id" | "direction" | "amount_minor" | "currency" | "memo"
> & {
  code: string;
  ownerType: OwnerType | null;
  ownerId: string | null;
  ownerNameFa: string | null;
  ownerNameEn: string | null;
  reversal: boolean;
};

export type LedgerTxn = {
  id: string;
  at: string;
  orderId: string | null;
  orderRef: string | null;
  reversal: boolean;
  lines: TxnLine[];
};

/** Platform first, then the accounts that owe or are owed. */
const OWNER_ORDER: OwnerType[] = ["platform", "suspense", "office", "customer"];

/** Codes this build posts (§11); anything else is shown as the raw code. */
const KNOWN_CODES = ["irt_holding", "irt_payable", "irt_fees", "irt_settlement"];

/** Beyond this a group is a printout, not a screen; the remainder is summed. */
const ROWS_PER_GROUP = 25;

/**
 * The platform ledger (§4.3), read-only from top to bottom.
 *
 * Every figure on this page is derived from the same entry set, so the grand
 * total that claims to be zero is the sum of the rows printed underneath it
 * rather than a second, independently computed number that could agree by
 * accident.
 */
export function FinanceView({
  rows,
  months,
  officeFees,
  txns,
  scanned,
  truncated,
  failed,
}: {
  rows: TrialRow[];
  months: FeeMonth[];
  officeFees: OfficeFee[];
  txns: LedgerTxn[];
  scanned: number;
  truncated: boolean;
  failed: boolean;
}) {
  const t = useTranslations("admin.finance");
  const locale = useLocale() as AppLocale;

  const totals = new Map<string, number>();
  for (const row of rows) totals.set(row.currency, (totals.get(row.currency) ?? 0) + row.netMinor);
  // An empty ledger is not a balanced one — `every` over nothing is true, and
  // that would put a green tick on a page that checked no accounts at all.
  const balanced = totals.size > 0 && [...totals.values()].every((net) => net === 0);

  // The verdict is only worth stating when the sum ran over the whole ledger. A
  // partial or failed read makes a non-zero total the expected outcome, so the
  // banner below withholds its judgement instead of contradicting the notice
  // sitting right above it.
  const conclusive = !truncated && !failed;

  const escrow = rows.filter((row) => row.ownerType === "suspense" && row.code === "irt_holding");

  return (
    <div className="space-y-6">
      {failed ? (
        <Card className="flex items-start gap-3 border-down/50 p-5">
          <TriangleAlert className="mt-0.5 size-5 shrink-0 text-down" aria-hidden />
          <div>
            <p className="font-semibold">{t("failedTitle")}</p>
            <p className="mt-1 text-sm leading-relaxed text-ink-600">{t("failedBody")}</p>
          </div>
        </Card>
      ) : null}

      {truncated ? (
        <Card className="flex items-start gap-3 border-warn/40 p-5">
          <TriangleAlert className="mt-0.5 size-5 shrink-0 text-warn" aria-hidden />
          <div>
            <p className="font-semibold">{t("partialTitle")}</p>
            <p className="mt-1 text-sm leading-relaxed text-ink-600">
              {t("partialBody", { count: formatNumber(scanned, locale) })}
            </p>
          </div>
        </Card>
      ) : null}

      <BalanceBanner totals={totals} balanced={balanced} conclusive={conclusive} />

      {/* `post_order_funding` debits the holding account and nothing credits it
          back — the office withdrawal leg is not posted in this build — so a
          released, settled order still counts here. The figure is cumulative
          funding, and the copy says that rather than calling it escrow. */}
      <PanelSection title={t("escrow.title")} hint={t("escrow.hint")} bodyClassName="space-y-3">
        {escrow.length === 0 ? (
          <p className="text-sm text-ink-600">{t("escrow.empty")}</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {escrow.map((row) => (
              <p key={row.id} className="text-2xl font-bold tabular-nums">
                {money(row.netMinor, row.currency, locale)}
                <span className="ms-1.5 text-sm font-medium text-ink-600">{row.currency}</span>
              </p>
            ))}
          </div>
        )}
        <p className="text-xs leading-relaxed text-ink-600">{t("escrow.hint")}</p>
      </PanelSection>

      <TrialBalance rows={rows} />
      <FeeRevenue months={months} />
      <OfficeFees fees={officeFees} />
      <RecentTxns txns={txns} />
    </div>
  );
}

/**
 * The one number this page exists for. A double-entry ledger that does not sum
 * to zero is an incident, so the non-zero case gets the loud treatment and the
 * exact difference — rounding it to "≈ 0" would be the failure this screen is
 * meant to catch.
 *
 * A verdict is printed only when there is one to give. With no accounts open,
 * or over a read that was cut short or failed outright, the figure is stated
 * without a colour or a badge: calling a partial sum "out of balance" would
 * send someone chasing a difference the boundary made.
 */
function BalanceBanner({
  totals,
  balanced,
  conclusive,
}: {
  totals: Map<string, number>;
  balanced: boolean;
  conclusive: boolean;
}) {
  const t = useTranslations("admin.finance");
  const locale = useLocale() as AppLocale;
  const entries = [...totals.entries()].sort(([a], [b]) => a.localeCompare(b));
  const verdict = conclusive && entries.length > 0;

  return (
    <PanelSection
      icon={
        !verdict ? (
          <Scale className="size-4" aria-hidden />
        ) : balanced ? (
          <CircleCheck className="size-4 text-up" aria-hidden />
        ) : (
          <CircleAlert className="size-4 text-down" aria-hidden />
        )
      }
      title={
        verdict
          ? balanced
            ? t("balance.zeroTitle")
            : t("balance.brokenTitle")
          : entries.length === 0
            ? t("balance.emptyTitle")
            : t("balance.unknownTitle")
      }
      hint={t("balance.hint")}
      actions={
        verdict ? (
          <Badge variant={balanced ? "up" : "down"}>
            {balanced ? t("balance.zeroBadge") : t("balance.brokenBadge")}
          </Badge>
        ) : null
      }
      className={verdict && !balanced ? "[--glass-tint:var(--down)]" : undefined}
      bodyClassName="space-y-3"
    >
      {entries.length === 0 ? (
        <p className="text-sm text-ink-600">{t("balance.empty")}</p>
      ) : (
        <>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {entries.map(([currency, net]) => (
              <div key={currency}>
                <dt className="text-sm text-ink-600">{currency}</dt>
                <dd
                  className={`mt-1 text-3xl font-bold tabular-nums ${
                    !verdict ? "" : net === 0 ? "text-up" : "text-down"
                  }`}
                >
                  {money(net, currency, locale)}
                </dd>
              </div>
            ))}
          </dl>
          <p className="text-xs leading-relaxed text-ink-600">
            {verdict
              ? balanced
                ? t("balance.zeroBody")
                : t("balance.brokenBody")
              : t("balance.unknownBody")}
          </p>
        </>
      )}
    </PanelSection>
  );
}

/**
 * Accounts grouped the way the question arrives — whose money is it, in what
 * currency — with a subtotal per group. Long groups are capped and the tail is
 * summed into one remainder row rather than dropped, so the subtotals still add
 * up to the grand total above.
 */
function TrialBalance({ rows }: { rows: TrialRow[] }) {
  const t = useTranslations("admin.finance");
  const locale = useLocale() as AppLocale;

  const groups = OWNER_ORDER.map((ownerType) => {
    const mine = rows.filter((row) => row.ownerType === ownerType);
    const currencies = [...new Set(mine.map((row) => row.currency))].sort();
    return {
      ownerType,
      currencies: currencies.map((currency) => {
        const all = mine
          .filter((row) => row.currency === currency)
          .sort((a, b) => Math.abs(b.netMinor) - Math.abs(a.netMinor));
        const shown = all.slice(0, ROWS_PER_GROUP);
        const rest = all.slice(ROWS_PER_GROUP);
        return {
          currency,
          shown,
          restCount: rest.length,
          restMinor: rest.reduce((sum, row) => sum + row.netMinor, 0),
          subtotal: all.reduce((sum, row) => sum + row.netMinor, 0),
        };
      }),
    };
  }).filter((group) => group.currencies.length > 0);

  return (
    <PanelSection title={t("trial.title")} hint={t("trial.hint")} bodyClassName="space-y-6">
      {groups.length === 0 ? (
        <p className="text-sm text-ink-600">{t("balance.empty")}</p>
      ) : (
        groups.map((group) => (
          <section key={group.ownerType} className="space-y-3">
            <h3 className="text-sm font-semibold">{t(`owner.${group.ownerType}`)}</h3>
            {group.currencies.map((bucket) => (
              <div key={bucket.currency} className="overflow-x-auto">
                <table className="w-full min-w-[34rem] text-sm">
                  <caption className="pb-2 text-start text-xs font-medium text-ink-600">
                    {bucket.currency}
                  </caption>
                  <thead className="border-b border-ink-300/40 text-xs text-ink-600">
                    <tr>
                      <th className="px-3 py-2 text-start font-medium">{t("trial.col.account")}</th>
                      <th className="px-3 py-2 text-start font-medium">{t("trial.col.owner")}</th>
                      <th className="px-3 py-2 text-end font-medium">{t("trial.col.entries")}</th>
                      <th className="px-3 py-2 text-end font-medium">{t("trial.col.net")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bucket.shown.map((row) => (
                      <tr key={row.id} className="border-b border-ink-300/25">
                        <td className="px-3 py-2">{accountLabel(row.code, t)}</td>
                        <td className="px-3 py-2 text-ink-600">
                          {ownerLabel(row, locale, t("trial.noOwner"))}
                        </td>
                        <td className="px-3 py-2 text-end text-ink-600 tabular-nums">
                          {formatNumber(row.entries, locale, { maximumFractionDigits: 0 })}
                        </td>
                        <td className="px-3 py-2 text-end tabular-nums">
                          {money(row.netMinor, row.currency, locale)}
                        </td>
                      </tr>
                    ))}
                    {bucket.restCount > 0 ? (
                      <tr className="border-b border-ink-300/25 text-ink-600">
                        <td className="px-3 py-2" colSpan={3}>
                          {t("trial.remainder", {
                            count: formatNumber(bucket.restCount, locale, {
                              maximumFractionDigits: 0,
                            }),
                          })}
                        </td>
                        <td className="px-3 py-2 text-end tabular-nums">
                          {money(bucket.restMinor, bucket.currency, locale)}
                        </td>
                      </tr>
                    ) : null}
                    <tr className="font-semibold">
                      <td className="px-3 py-2" colSpan={3}>
                        {t("trial.subtotal")}
                      </td>
                      <td className="px-3 py-2 text-end tabular-nums">
                        {money(bucket.subtotal, bucket.currency, locale)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ))}
          </section>
        ))
      )}
      <p className="text-xs leading-relaxed text-ink-600">{t("trial.hint")}</p>
    </PanelSection>
  );
}

/** Twelve months of net platform fee, biggest month setting the scale. */
function FeeRevenue({ months }: { months: FeeMonth[] }) {
  const t = useTranslations("admin.finance");
  const locale = useLocale() as AppLocale;

  const total = months.reduce((sum, month) => sum + month.netMinor, 0);
  const max = months.reduce((best, month) => Math.max(best, month.netMinor), 0);

  return (
    <PanelSection
      title={t("fees.platformTitle")}
      hint={t("fees.platformHint")}
      bodyClassName="space-y-4"
    >
      <p className="text-2xl font-bold tabular-nums">
        {toman(total, locale)}
        <span className="ms-1.5 text-sm font-medium text-ink-600">{t("toman")}</span>
        <span className="ms-2 text-sm font-normal text-ink-600">{t("fees.total")}</span>
      </p>

      {max === 0 && total === 0 ? (
        <p className="text-sm text-ink-600">{t("fees.empty")}</p>
      ) : (
        <ol className="space-y-1.5">
          {months.map((month) => (
            <li key={month.start} className="flex items-center gap-3">
              <span className="w-14 shrink-0 text-xs text-ink-600">
                {formatDate(month.start, locale, { month: "short" })}
              </span>
              <span className="h-2.5 min-w-0 flex-1 rounded-full bg-ink-300/25">
                {/* A month that gave back more than it earned has no bar to
                      draw; the figure beside it carries the sign instead. */}
                <span
                  className="block h-full rounded-full bg-brand-600"
                  style={{
                    width: `${max > 0 ? (Math.max(month.netMinor, 0) / max) * 100 : 0}%`,
                  }}
                />
              </span>
              <span className="w-32 shrink-0 text-end text-sm tabular-nums">
                {toman(month.netMinor, locale)}
              </span>
            </li>
          ))}
        </ol>
      )}

      <p className="text-xs leading-relaxed text-ink-600">{t("fees.platformHint")}</p>
    </PanelSection>
  );
}

function OfficeFees({ fees }: { fees: OfficeFee[] }) {
  const t = useTranslations("admin.finance");
  const locale = useLocale() as AppLocale;

  return (
    <PanelSection
      title={t("fees.officeTitle")}
      hint={t("fees.officeHint")}
      href="/admin/exchanges"
      linkLabel={t("openOffices")}
      bodyClassName="space-y-3"
    >
      {fees.length === 0 ? (
        <p className="text-sm text-ink-600">{t("fees.officeEmpty")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[24rem] text-sm">
            <thead className="border-b border-ink-300/40 text-xs text-ink-600">
              <tr>
                <th className="px-3 py-2 text-start font-medium">{t("fees.col.office")}</th>
                <th className="px-3 py-2 text-end font-medium">{t("fees.col.fees")}</th>
              </tr>
            </thead>
            <tbody>
              {fees.map((office) => (
                <tr key={office.officeId} className="border-b border-ink-300/25 last:border-0">
                  <td className="px-3 py-2">
                    {(locale === "fa" ? office.nameFa : office.nameEn) ?? t("fees.unknownOffice")}
                  </td>
                  <td className="px-3 py-2 text-end tabular-nums">
                    {toman(office.netMinor, locale)} {t("toman")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs leading-relaxed text-ink-600">{t("fees.officeHint")}</p>
    </PanelSection>
  );
}

/**
 * Whole transactions rather than a flat entry list: an entry on its own says
 * nothing, and the pair it balances against is the thing a reconciliation reads.
 * Reversals carry a badge on the transaction and on each line, because a
 * compensating entry that reads as an ordinary movement double-counts the money.
 */
function RecentTxns({ txns }: { txns: LedgerTxn[] }) {
  const t = useTranslations("admin.finance");
  const locale = useLocale() as AppLocale;

  return (
    <PanelSection title={t("txn.title")} hint={t("txn.hint")} bodyClassName="space-y-3">
      {txns.length === 0 ? (
        <p className="text-sm text-ink-600">{t("txn.empty")}</p>
      ) : (
        <ol className="space-y-3">
          {txns.map((txn) => (
            <li
              key={txn.id}
              className={`rounded-xl border p-4 ${
                txn.reversal ? "border-warn/50 bg-warn/5" : "border-ink-300/40"
              }`}
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <span className="font-mono text-xs text-ink-600" dir="ltr">
                  {txn.id.slice(0, 8)}
                </span>
                {txn.reversal ? <Badge variant="warn">{t("txn.reversal")}</Badge> : null}
                {txn.orderId && txn.orderRef ? (
                  <Link
                    href={`/orders/${txn.orderId}`}
                    className="font-mono text-xs hover:text-brand-700"
                    dir="ltr"
                  >
                    {txn.orderRef}
                  </Link>
                ) : (
                  <span className="text-xs text-ink-600">{t("txn.noOrder")}</span>
                )}
                <span className="flex-1" />
                <time dateTime={txn.at} className="text-xs text-ink-600 tabular-nums">
                  {formatDate(txn.at, locale, { dateStyle: "short", timeStyle: "short" })}
                </time>
              </div>

              <ul className="mt-2 space-y-1.5">
                {txn.lines.map((line) => (
                  <li
                    key={line.id}
                    className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-ink-300/25 pt-2"
                  >
                    <span className="text-sm font-medium">{accountLabel(line.code, t)}</span>
                    <span className="text-xs text-ink-600">
                      {line.ownerType
                        ? ownerLabel(line, locale, t(`owner.${line.ownerType}`))
                        : t("txn.unknownOwner")}
                    </span>
                    <Badge variant={line.direction === "debit" ? "info" : "neutral"}>
                      {t(`txn.${line.direction}`)}
                    </Badge>
                    <span className="text-sm tabular-nums">
                      {money(line.amount_minor, line.currency, locale)} {line.currency}
                    </span>
                    {line.reversal ? <Badge variant="warn">{t("txn.reversalLine")}</Badge> : null}
                    <span className="min-w-0 flex-1 truncate text-xs text-ink-600">
                      {line.memo ?? t("txn.noMemo")}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
      <p className="text-xs leading-relaxed text-ink-600">{t("txn.hint")}</p>
      {txns.length > 0 ? (
        <p className="text-xs leading-relaxed text-ink-600">
          {t("txn.shown", {
            count: formatNumber(txns.length, locale, { maximumFractionDigits: 0 }),
          })}
        </p>
      ) : null}
    </PanelSection>
  );
}

function money(minor: number, currency: string, locale: AppLocale): string {
  const code = currency as CurrencyCode;
  return formatAmount(fromMinor(minor, code), code, locale);
}

function toman(minor: number, locale: AppLocale): string {
  return formatAmount(fromMinor(minor, "IRT"), "IRT", locale);
}

/** Unknown codes keep their raw name rather than borrowing a wrong label. */
function accountLabel(code: string, t: (key: string) => string): string {
  return KNOWN_CODES.includes(code) ? t(`code.${code}`) : code;
}

function ownerLabel(
  owner: Pick<TrialRow, "ownerNameFa" | "ownerNameEn" | "ownerId">,
  locale: AppLocale,
  fallback: string,
): string {
  const name = locale === "fa" ? owner.ownerNameFa : owner.ownerNameEn;
  if (name) return name;
  // A customer account is identified by a uuid nobody reads aloud; the first
  // segment is enough to tell two rows apart and to grep the ledger with.
  if (owner.ownerId) return owner.ownerId.slice(0, 8);
  return fallback;
}

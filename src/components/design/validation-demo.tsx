"use client";

import { CircleCheck, CircleX } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toLatinDigits } from "@/lib/money/format";
import { validateIranianCard, validateNationalCode, validateSheba } from "@/lib/validators";

/** Live demo of the real financial validators (§6) with bilingual errors. */
export function ValidationDemo() {
  const t = useTranslations("design.validation");
  const [sheba, setSheba] = React.useState("");
  const [card, setCard] = React.useState("");
  const [nid, setNid] = React.useState("");

  const shebaResult = sheba ? validateSheba(toLatinDigits(sheba)) : null;
  const cardResult = card ? validateIranianCard(toLatinDigits(card)) : null;
  const nidValid = nid ? validateNationalCode(toLatinDigits(nid)) : null;

  function StateLine({ ok, okText, errText }: { ok: boolean; okText: string; errText: string }) {
    return (
      <p className={`mt-1.5 flex items-center gap-1.5 text-xs ${ok ? "text-up" : "text-down"}`}>
        {ok ? <CircleCheck className="size-3.5" /> : <CircleX className="size-3.5" />}
        {ok ? okText : errText}
      </p>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card className="p-5">
        <label htmlFor="demo-sheba" className="text-sm font-medium">
          {t("sheba.label")}
        </label>
        <Input
          id="demo-sheba"
          dir="ltr"
          className="mt-2 font-mono text-xs"
          placeholder="IR06 0120 0000 0000 1234 5678 90"
          value={sheba}
          onChange={(e) => setSheba(e.target.value)}
          invalid={shebaResult ? !shebaResult.valid : false}
        />
        {shebaResult ? (
          <StateLine
            ok={shebaResult.valid}
            okText={t("sheba.ok")}
            errText={t(`sheba.err.${shebaResult.valid ? "format" : shebaResult.error}`)}
          />
        ) : (
          <p className="mt-1.5 text-xs text-ink-600">{t("sheba.hint")}</p>
        )}
      </Card>

      <Card className="p-5">
        <label htmlFor="demo-card" className="text-sm font-medium">
          {t("card.label")}
        </label>
        <Input
          id="demo-card"
          dir="ltr"
          className="mt-2 font-mono text-xs"
          placeholder="6037 9911 2345 6789"
          value={card}
          onChange={(e) => setCard(e.target.value)}
          invalid={cardResult ? !cardResult.valid : false}
        />
        {cardResult ? (
          cardResult.valid ? (
            <StateLine
              ok
              okText={
                cardResult.bankId
                  ? t("card.okBank", { bank: t(`banks.${cardResult.bankId}`) })
                  : t("card.ok")
              }
              errText=""
            />
          ) : (
            <StateLine ok={false} okText="" errText={t(`card.err.${cardResult.error}`)} />
          )
        ) : (
          <p className="mt-1.5 text-xs text-ink-600">{t("card.hint")}</p>
        )}
      </Card>

      <Card className="p-5">
        <label htmlFor="demo-nid" className="text-sm font-medium">
          {t("nid.label")}
        </label>
        <Input
          id="demo-nid"
          dir="ltr"
          className="mt-2 font-mono text-xs"
          placeholder="0012345678"
          value={nid}
          onChange={(e) => setNid(e.target.value)}
          invalid={nidValid === false}
        />
        {nidValid !== null ? (
          <StateLine ok={nidValid} okText={t("nid.ok")} errText={t("nid.err")} />
        ) : (
          <p className="mt-1.5 text-xs text-ink-600">{t("nid.hint")}</p>
        )}
      </Card>
    </div>
  );
}

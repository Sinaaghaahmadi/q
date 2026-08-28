"use client";

import { useTranslations } from "next-intl";
import * as React from "react";
import * as S from "@/components/brand/scenes";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/**
 * The whole illustration set, replayable so the motion can be judged.
 *
 * Grouped by what a scene is *about* rather than by which screen shows it,
 * because the same drawing serves both sides of the counter. The label under
 * each one is its component name rather than a translated caption: this page
 * is the reference somebody reads while deciding which scene a new screen
 * should carry, and the answer they need to copy is the name.
 */

type Group = {
  key: string;
  scenes: [string, React.ComponentType<{ size?: number; label?: string }>][];
};

const GROUPS: Group[] = [
  {
    key: "onboarding",
    scenes: [
      ["OtpScene", S.OtpScene],
      ["PhoneVerifiedScene", S.PhoneVerifiedScene],
      ["IdentityScene", S.IdentityScene],
      ["DocumentScene", S.DocumentScene],
      ["LivenessScene", S.LivenessScene],
      ["ReviewScene", S.ReviewScene],
      ["VerifiedScene", S.VerifiedScene],
      ["MoreInfoScene", S.MoreInfoScene],
      ["RejectedScene", S.RejectedScene],
      ["TwoFactorScene", S.TwoFactorScene],
    ],
  },
  {
    key: "order",
    scenes: [
      ["QuoteScene", S.QuoteScene],
      ["RateLockScene", S.RateLockScene],
      ["RateExpiredScene", S.RateExpiredScene],
      ["MatchingScene", S.MatchingScene],
      ["OfficeReviewScene", S.OfficeReviewScene],
      ["AwaitingDepositScene", S.AwaitingDepositScene],
      ["DepositHeldScene", S.DepositHeldScene],
      ["ForeignLegSentScene", S.ForeignLegSentScene],
      ["RecipientPaidScene", S.RecipientPaidScene],
      ["CashPickupScene", S.CashPickupScene],
      ["SuccessScene", S.SuccessScene],
      ["OrderCancelledScene", S.OrderCancelledScene],
      ["FailedLegScene", S.FailedLegScene],
      ["RefundScene", S.RefundScene],
      ["DisputeScene", S.DisputeScene],
    ],
  },
  {
    key: "banking",
    scenes: [
      ["IbanScene", S.IbanScene],
      ["BankCardScene", S.BankCardScene],
      ["AccountsScene", S.AccountsScene],
      ["BankRailsScene", S.BankRailsScene],
      ["LimitsScene", S.LimitsScene],
    ],
  },
  {
    key: "market",
    scenes: [
      ["RateBoardScene", S.RateBoardScene],
      ["ConversionScene", S.ConversionScene],
      ["TrendScene", S.TrendScene],
      ["RateAlertScene", S.RateAlertScene],
      ["AlertFiredScene", S.AlertFiredScene],
      ["GoldCoinScene", S.GoldCoinScene],
      ["GoldVaultScene", S.GoldVaultScene],
      ["P2POfferScene", S.P2POfferScene],
      ["P2PEscrowScene", S.P2PEscrowScene],
      ["ReputationScene", S.ReputationScene],
    ],
  },
  {
    key: "rewards",
    scenes: [
      ["TierScene", S.TierScene],
      ["TierUpScene", S.TierUpScene],
      ["SavingsScene", S.SavingsScene],
      ["ReferralScene", S.ReferralScene],
      ["RewardPaidScene", S.RewardPaidScene],
    ],
  },
  {
    key: "support",
    scenes: [
      ["ChatScene", S.ChatScene],
      ["WaitingScene", S.WaitingScene],
      ["TicketScene", S.TicketScene],
      ["TicketAnsweredScene", S.TicketAnsweredScene],
      ["HelpScene", S.HelpScene],
    ],
  },
  {
    key: "staff",
    scenes: [
      ["InboxScene", S.InboxScene],
      ["RateSheetScene", S.RateSheetScene],
      ["LiquidityScene", S.LiquidityScene],
      ["SettlementScene", S.SettlementScene],
      ["TeamScene", S.TeamScene],
      ["OnboardOfficeScene", S.OnboardOfficeScene],
      ["AuditScene", S.AuditScene],
      ["ComplianceScene", S.ComplianceScene],
      ["ImpersonationScene", S.ImpersonationScene],
    ],
  },
  {
    key: "states",
    scenes: [
      ["OrdersEmptyScene", S.OrdersEmptyScene],
      ["SearchEmptyScene", S.SearchEmptyScene],
      ["NotFoundScene", S.NotFoundScene],
      ["NoAccessScene", S.NoAccessScene],
      ["OfflineScene", S.OfflineScene],
      ["MaintenanceScene", S.MaintenanceScene],
      ["FrozenScene", S.FrozenScene],
      ["BlockedScene", S.BlockedScene],
      ["InstallScene", S.InstallScene],
      ["IosInstallScene", S.IosInstallScene],
    ],
  },
];

export function ScenesDemo() {
  const t = useTranslations("design.scenes");
  const [generation, setGeneration] = React.useState(0);
  const total = GROUPS.reduce((n, g) => n + g.scenes.length, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="soft" size="sm" onClick={() => setGeneration((g) => g + 1)}>
          {t("replay")}
        </Button>
        <span className="num text-xs text-ink-600">{t("count", { count: total })}</span>
      </div>

      {GROUPS.map((group) => (
        <section key={group.key} className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold">{t(`groups.${group.key}.title`)}</h3>
            <p className="mt-0.5 text-xs leading-relaxed text-ink-600">
              {t(`groups.${group.key}.body`)}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {group.scenes.map(([name, Component]) => (
              <Card key={name} className="flex flex-col items-center gap-2 p-3">
                <Component key={generation} size={104} label={name} />
                <code className="text-center font-mono text-[0.625rem] text-ink-600" dir="ltr">
                  {name.replace(/Scene$/, "")}
                </code>
              </Card>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

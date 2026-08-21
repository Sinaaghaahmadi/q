/**
 * Legal pages (§15): real, versioned, bilingual. Marked as draft v0.1 until
 * counsel review; acceptance-per-version lands with auth in Phase 2.
 * Copy rules per §18: native formal-but-warm Persian, plain numbers, no hype.
 */

export const LEGAL_SLUGS = ["terms", "privacy", "aml", "fees", "sla", "complaints"] as const;
export type LegalSlug = (typeof LEGAL_SLUGS)[number];

export interface LegalSection {
  h: string;
  ps: string[];
}

export interface LegalDoc {
  version: string;
  updated: string; // ISO date
  intro: string;
  sections: LegalSection[];
}

type Localized = Record<"fa" | "en", LegalDoc>;

const V = "0.1 (پیش‌نویس)";
const V_EN = "0.1 (draft)";
const UPDATED = "2026-08-21";

export const LEGAL_CONTENT: Record<LegalSlug, Localized> = {
  terms: {
    fa: {
      version: V,
      updated: UPDATED,
      intro:
        "این سند چارچوب استفاده از پلتفرم صرافی آسا را روشن می‌کند. آسا بازارگاهِ حواله میان صرافی‌های دارای مجوز است؛ کیف پول امانی نیست و سپرده‌ای نزد ما نگه‌داری نمی‌شود.",
      sections: [
        {
          h: "نقش آسا",
          ps: [
            "آسا درخواست حواله شما را به صرافی‌های دارای مجوز می‌رساند، روند تسویه دومرحله‌ای را نظارت می‌کند و سوابق هر مرحله را نگه می‌دارد. طرف قرارداد اجرای حواله، صرافی انتخاب‌شده است.",
            "استفاده از پلتفرم به معنای پذیرش همین سند، سیاست حریم خصوصی و سیاست مبارزه با پول‌شویی است. نسخه پذیرفته‌شده برای هر کاربر ثبت و نگه‌داری می‌شود.",
          ],
        },
        {
          h: "تعهدهای کاربر",
          ps: [
            "اطلاعات هویتی و حساب‌ها باید متعلق به خود شما و درست باشد. انتقال برای شخص ثالث فقط با اعلام صریح و تأیید انطباق ممکن است.",
            "هر درخواستی که خلاف قوانین ارزی ایران یا کشور مقصد باشد، بدون اجرا لغو می‌شود و ممکن است به مسدود شدن حساب بینجامد.",
          ],
        },
        {
          h: "نرخ، کارمزد و قفل نرخ",
          ps: [
            "نرخ نمایش‌داده‌شده پیش از ثبت، نرخ میان‌بازار است. نرخ نهایی هنگام ثبت درخواست برای ۱۵ دقیقه قفل می‌شود و اجزای آن — نرخ پایه، اسپرد و کارمزدها — به تفکیک نمایش داده می‌شود.",
          ],
        },
        {
          h: "لغو و استرداد",
          ps: [
            "تا پیش از واریز تومانی، لغو بدون هزینه است. پس از آن، استرداد طبق روال تسویه نظارت‌شده و با ثبت دلیل انجام می‌شود.",
          ],
        },
      ],
    },
    en: {
      version: V_EN,
      updated: UPDATED,
      intro:
        "These terms govern the use of the Asaex platform. Asaex is a remittance marketplace between licensed exchange offices; it is not a custodial wallet and holds no customer deposits.",
      sections: [
        {
          h: "Asaex's role",
          ps: [
            "Asaex routes your transfer request to licensed exchange offices, supervises the two-sided settlement flow, and keeps an auditable record of every step. The executing party of a transfer is the selected exchange office.",
            "Using the platform means accepting these terms, the privacy policy, and the AML policy. The accepted version is recorded per user.",
          ],
        },
        {
          h: "Your obligations",
          ps: [
            "Identity details and accounts must be yours and accurate. Third-party transfers require explicit declaration and compliance approval.",
            "Requests that conflict with Iranian currency regulations or destination-country law are cancelled without execution and may lead to account suspension.",
          ],
        },
        {
          h: "Rates, fees and the rate lock",
          ps: [
            "Rates shown before submission are mid-market. The final rate is locked for 15 minutes at submission, and its components — base rate, spread, and fees — are itemized.",
          ],
        },
        {
          h: "Cancellation and refunds",
          ps: [
            "Cancellation is free before the Toman leg is funded. After that, refunds follow the supervised settlement flow with a recorded reason.",
          ],
        },
      ],
    },
  },

  privacy: {
    fa: {
      version: V,
      updated: UPDATED,
      intro:
        "ما فقط داده‌ای را جمع می‌کنیم که برای احراز هویت، اجرای حواله و الزام‌های قانونی لازم است — نه بیشتر.",
      sections: [
        {
          h: "چه داده‌ای و چرا",
          ps: [
            "داده هویتی (نام، کد ملی، مدرک شناسایی) برای احراز هویت یک‌باره؛ داده حساب‌ها برای اجرای حواله؛ و سوابق سفارش برای پاسخ‌گویی و حل اختلاف نگه‌داری می‌شود.",
          ],
        },
        {
          h: "نگه‌داری و امنیت",
          ps: [
            "مدارک هویتی در فضای خصوصیِ رمزگذاری‌شده نگه‌داری می‌شود و دسترسی به آن فقط با لینک‌های کوتاه‌عمر و با ثبت کامل در گزارش ممیزی ممکن است. شماره‌های حساس در نمایش‌ها پوشیده (••••) نشان داده می‌شود.",
            "هیچ داده هویتی به سرویس‌های تبلیغاتی فروخته یا داده نمی‌شود.",
          ],
        },
        {
          h: "حقوق شما",
          ps: [
            "می‌توانید نسخه‌ای از داده‌های خود را دریافت کنید یا درخواست حذف بدهید. سوابق مالی تا پایان دوره نگه‌داری قانونی حفظ می‌شود و پس از آن حذف می‌گردد.",
          ],
        },
      ],
    },
    en: {
      version: V_EN,
      updated: UPDATED,
      intro:
        "We collect only what identity verification, transfer execution, and legal obligations require — nothing more.",
      sections: [
        {
          h: "What we collect and why",
          ps: [
            "Identity data (name, national code, ID document) for one-time KYC; account details for executing transfers; order records for accountability and dispute resolution.",
          ],
        },
        {
          h: "Storage and security",
          ps: [
            "Identity documents live in encrypted private storage, accessible only through short-lived signed links, with every access written to the audit log. Sensitive numbers are masked (••••) in list views.",
            "No identity data is ever sold or shared with advertising services.",
          ],
        },
        {
          h: "Your rights",
          ps: [
            "You can export a copy of your data or request deletion. Financial records are retained for the legally required period, then removed.",
          ],
        },
      ],
    },
  },

  aml: {
    fa: {
      version: V,
      updated: UPDATED,
      intro:
        "آسا فقط با صرافی‌های دارای مجوز کار می‌کند و برای پیشگیری از پول‌شویی، رویه‌های سخت‌گیرانه‌ای دارد.",
      sections: [
        {
          h: "احراز هویت و پایش",
          ps: [
            "هیچ حواله‌ای بدون احراز هویت کامل انجام نمی‌شود. سقف‌های روزانه و ماهانه بر اساس سطح ریسک هر کاربر اعمال می‌شود و تراکنش‌های غیرعادی — از جمله تقسیم مبالغ برای دور زدن سقف‌ها — به‌صورت خودکار علامت‌گذاری می‌شود.",
          ],
        },
        {
          h: "غربالگری",
          ps: [
            "نام‌ها هنگام تأیید هویت و در سفارش‌های بالاتر از آستانه، با فهرست‌های تحریمی و اشخاص در معرض ریسک مقایسه می‌شود. موارد مشکوک تا تعیین تکلیف متوقف می‌ماند.",
          ],
        },
        {
          h: "هدف انتقال",
          ps: [
            "برای هر حواله، هدف انتقال (شهریه، کمک به خانواده، درمان، تجارت و…) ثبت می‌شود. این داده فقط برای انطباق و رسید استفاده می‌شود.",
          ],
        },
      ],
    },
    en: {
      version: V_EN,
      updated: UPDATED,
      intro:
        "Asaex works exclusively with licensed exchange offices and enforces strict anti-money-laundering procedures.",
      sections: [
        {
          h: "Verification and monitoring",
          ps: [
            "No transfer executes without full KYC. Daily and monthly limits apply per risk tier, and unusual patterns — including structuring below thresholds — are flagged automatically.",
          ],
        },
        {
          h: "Screening",
          ps: [
            "Names are screened against sanctions and PEP lists at verification and for orders above the threshold. Flagged cases pause until resolved.",
          ],
        },
        {
          h: "Purpose of transfer",
          ps: [
            "Each transfer records its purpose (tuition, family support, medical, business, …), used only for compliance and receipts.",
          ],
        },
      ],
    },
  },

  fees: {
    fa: {
      version: V,
      updated: UPDATED,
      intro:
        "کارمزدها پیش از تأیید، به تفکیک نمایش داده می‌شود: نرخ پایه، اسپرد، کارمزد پلتفرم و کارمزد صرافی. هیچ هزینه پنهانی وجود ندارد.",
      sections: [
        {
          h: "ساختار فعلی (نمونه فاز ۱)",
          ps: [
            "کارمزد پلتفرم: ۰٫۲۵٪ از سمت تومانی، حداقل ۱۵۰٬۰۰۰ تومان. کارمزد صرافی: ۰٫۱۵٪، حداقل ۱۰۰٬۰۰۰ تومان. اسپرد کریدور: در مجموع حدود ۹۰ واحد در ده‌هزار (bps) که در «چرا این نرخ؟» به تفکیک لایه‌ها دیده می‌شود.",
            "با افزایش حجم معاملات، تخفیف سطح کاربری به‌صورت خودکار روی اسپرد اعمال می‌شود.",
          ],
        },
        {
          h: "قفل نرخ",
          ps: [
            "نرخ تأییدشده ۱۵ دقیقه معتبر می‌ماند. پس از انقضا، با یک لمس نرخ تازه می‌گیرید و تفاوت به‌روشنی نمایش داده می‌شود.",
          ],
        },
      ],
    },
    en: {
      version: V_EN,
      updated: UPDATED,
      intro:
        "Fees are itemized before you confirm: base rate, spread, platform fee, and office fee. There are no hidden costs.",
      sections: [
        {
          h: "Current structure (Phase-1 sample)",
          ps: [
            "Platform fee: 0.25% of the Toman leg, minimum 150,000 Toman. Office fee: 0.15%, minimum 100,000 Toman. Corridor spread: about 90 bps total, itemized per layer in “Why this rate?”.",
            "Volume-based tier discounts apply to the spread automatically.",
          ],
        },
        {
          h: "Rate lock",
          ps: [
            "A confirmed rate stays valid for 15 minutes. After expiry, a one-tap re-quote shows the delta clearly.",
          ],
        },
      ],
    },
  },

  sla: {
    fa: {
      version: V,
      updated: UPDATED,
      intro: "هدف ما تکمیل هر حواله در یک روز کاری است؛ تعهد قراردادی، حداکثر سه روز کاری است.",
      sections: [
        {
          h: "محاسبه زمان",
          ps: [
            "زمان‌ها بر اساس تقویم کاری ایران (شنبه تا چهارشنبه کامل، پنجشنبه نیمه‌وقت، جمعه تعطیل) و تقویم کشور مقصد محاسبه می‌شود. تعطیلات رسمی هر دو طرف لحاظ می‌شود.",
          ],
        },
        {
          h: "اگر دیر شود",
          ps: [
            "در ۶۰٪ زمان مجاز، به صرافی یادآوری خودکار می‌رود؛ در ۸۵٪ مدیر صرافی و تیم پلتفرم مطلع می‌شوند؛ با عبور از سقف، پرونده به وضعیت «نقض SLA» می‌رود، به تیم رسیدگی ارجاع می‌شود و جبران مصوب اعمال می‌گردد.",
          ],
        },
        {
          h: "استرداد",
          ps: [
            "اگر حواله انجام‌نشدنی شود، مبلغ تومانی طبق روال نظارت‌شده و با رسید کامل بازگردانده می‌شود.",
          ],
        },
      ],
    },
    en: {
      version: V_EN,
      updated: UPDATED,
      intro:
        "We target completion within one business day; the contractual commitment is three business days at most.",
      sections: [
        {
          h: "How time is counted",
          ps: [
            "Timelines follow the Iranian business calendar (Saturday–Wednesday full, Thursday half, Friday closed) and the destination country's calendar. Public holidays on both sides count.",
          ],
        },
        {
          h: "If a transfer runs late",
          ps: [
            "At 60% of the budget the office gets an automatic nudge; at 85% the office manager and the platform team are alerted; past the limit the order is flagged as an SLA breach, escalated, and the approved remedy applies.",
          ],
        },
        {
          h: "Refunds",
          ps: [
            "If a transfer becomes impossible, the Toman amount is returned through the supervised flow with a full receipt.",
          ],
        },
      ],
    },
  },

  complaints: {
    fa: {
      version: V,
      updated: UPDATED,
      intro: "اگر چیزی درست پیش نرفت، مسیر رسیدگی روشن است و پاسخ‌ها زمان‌بندی مشخص دارند.",
      sections: [
        {
          h: "مسیر رسیدگی",
          ps: [
            "۱) گفت‌وگو با صرافی در همان سفارش. ۲) در صورت نیاز، ثبت اختلاف — سفارش تا تعیین تکلیف مسدود می‌شود و مدارک هر دو طرف در یک صفحه بررسی می‌شود. ۳) تصمیم مکتوب با دلیل، حداکثر ظرف سه روز کاری.",
          ],
        },
        {
          h: "تماس",
          ps: [
            "از بخش پشتیبانی داخل برنامه پیام بدهید؛ هر گفت‌وگو شماره پیگیری دارد و تاریخچه کامل آن نگه‌داری می‌شود.",
          ],
        },
      ],
    },
    en: {
      version: V_EN,
      updated: UPDATED,
      intro: "If something goes wrong, the path is clear and responses have explicit timelines.",
      sections: [
        {
          h: "The process",
          ps: [
            "1) Talk to the office inside the order. 2) If needed, open a dispute — the order freezes and both sides' evidence is reviewed on one screen. 3) A written, reasoned decision within three business days.",
          ],
        },
        {
          h: "Contact",
          ps: [
            "Message us from in-app support; every conversation has a reference number and a full retained history.",
          ],
        },
      ],
    },
  },
};

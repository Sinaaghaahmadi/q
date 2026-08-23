/**
 * Legal pages (§15): real, versioned, bilingual.
 *
 * Still marked draft, and the marking is not a formality. These were written to
 * be genuinely usable — sixteen sections covering role, eligibility, AML, rate
 * lock, settlement-account responsibility, the P2P market, liability and
 * governing law — but they have not been reviewed by counsel in any
 * jurisdiction, and `docs/launch-checklist.md` blocks go-live on that review.
 *
 * One drafting rule worth stating, because it is tempting to break: the
 * liability section does *not* claim Asa bears no responsibility at all. Under
 * Iranian law the Electronic Commerce Act and the Consumer Protection Act
 * impose duties that cannot be contracted away, and a clause purporting to
 * disclaim everything is void in that part — and an obviously void clause
 * invites a reader to doubt the rest of the document. So liability is limited
 * to the maximum the law allows, and §11 says out loud where it cannot be.
 *
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

const V = "0.2 (پیش‌نویس)";
const V_EN = "0.2 (draft)";
const UPDATED = "2026-08-23";

export const LEGAL_CONTENT: Record<LegalSlug, Localized> = {
  terms: {
    fa: {
      version: V,
      updated: UPDATED,
      intro:
        "این سند، شرایط کامل استفاده از پلتفرم صرافی آسا را تعیین می‌کند. آسا بازارگاهِ حواله میان صرافی‌های دارای مجوز است؛ بانک، کیف پول امانی یا نگه‌دارندهٔ سپرده نیست. ورود به پلتفرم و هر یک از پنل‌های آن، به منزلهٔ پذیرش این شرایط است. لطفاً پیش از استفاده، آن را کامل بخوانید.",
      sections: [
        {
          h: "۱. تعاریف",
          ps: [
            "«پلتفرم» یا «آسا»: سامانهٔ صرافی آسا، شامل وب‌سایت، اپلیکیشن و پنل‌های آن.",
            "«صرافی»: شخص حقیقی یا حقوقی دارای مجوز فعالیت صرافی که از طریق پلتفرم، حواله را اجرا می‌کند. صرافی، طرف قرارداد اجرای حواله با کاربر است.",
            "«کاربر»: هر شخصی که در پلتفرم ثبت‌نام یا از خدمات آن استفاده می‌کند، اعم از فرستنده، گیرنده یا فعال بازار همتا.",
            "«حواله»: سفارش انتقال ارز که کاربر ثبت و صرافی اجرا می‌کند.",
            "«بازار همتا»: بخشی از پلتفرم که کاربران می‌توانند مستقیماً با یکدیگر ارز مبادله کنند و صرافی نقش تأییدکنندهٔ بی‌طرف را دارد.",
          ],
        },
        {
          h: "۲. ماهیت خدمت و نقش آسا",
          ps: [
            "آسا یک **بازارگاه** است، نه بانک، نه مؤسسهٔ اعتباری، نه کیف پول امانی و نه بازار اوراق بهادار. آسا هیچ سپرده‌ای از کاربران نگه‌داری نمی‌کند و مالک وجوه در جریان نیست.",
            "نقش آسا محدود است به: رساندن درخواست کاربر به صرافی‌های واجد شرایط، نگه‌داری سوابق هر مرحله، فراهم‌کردن بستر گفت‌وگو، و نظارت بر ترتیب تسویهٔ دومرحله‌ای.",
            "قرارداد اجرای حواله میان **کاربر و صرافی** منعقد می‌شود. آسا طرف آن قرارداد نیست و اجرای آن را تضمین نمی‌کند.",
            "استفاده از پلتفرم یا ورود به هر یک از پنل‌های آن، به منزلهٔ مطالعه و پذیرش کامل این سند، سیاست حریم خصوصی، سیاست مبارزه با پول‌شویی، تعرفهٔ کارمزدها، تعهد زمانی و رویهٔ رسیدگی به شکایات است. نسخهٔ پذیرفته‌شده برای هر کاربر با تاریخ ثبت و نگه‌داری می‌شود.",
          ],
        },
        {
          h: "۳. اهلیت و شرایط استفاده",
          ps: [
            "استفاده از خدمات، منوط به داشتن حداقل ۱۸ سال سن تمام و اهلیت قانونی برای انجام معامله است.",
            "هر شخص تنها مجاز به داشتن یک حساب کاربری است. حساب کاربری شخصی و غیرقابل انتقال است.",
            "کاربر متعهد است اطلاعات هویتی درست، کامل و به‌روز ارائه کند. ارائهٔ اطلاعات خلاف واقع، موجب تعلیق حساب و در صورت لزوم گزارش به مراجع صالح می‌شود.",
          ],
        },
        {
          h: "۴. احراز هویت و مبارزه با پول‌شویی",
          ps: [
            "احراز هویت کاربران و صرافی‌ها بر عهدهٔ مدیر پلتفرم است و تأیید یا رد آن، تصمیم پلتفرم محسوب می‌شود. مدارک ارائه‌شده رمزگذاری‌شده نگه‌داری می‌شود.",
            "پلتفرم مجاز است در هر زمان مدارک تکمیلی بخواهد، سقف انتقال را تغییر دهد، یا در صورت وجود نشانهٔ تخلف، حساب را موقتاً مسدود کند.",
            "هر درخواستی که مغایر قوانین ارزی جمهوری اسلامی ایران، مقررات کشور مقصد، یا فهرست‌های تحریمی بین‌المللی باشد، بدون اجرا لغو می‌شود.",
            "کاربر تصریح می‌کند که منشأ وجوه قانونی است و وجوه متعلق به خود اوست، مگر آنکه انتقال برای شخص ثالث را صریحاً اعلام و تأیید کرده باشد.",
          ],
        },
        {
          h: "۵. نرخ، کارمزد و قفل نرخ",
          ps: [
            "نرخ نمایش‌داده‌شده پیش از ثبت سفارش، نرخ میانگین بازار است و جنبهٔ اطلاع‌رسانی دارد.",
            "نرخ نهایی هنگام ثبت درخواست برای مدت اعلام‌شده قفل می‌شود و اجزای آن — نرخ پایه، تفاوت نرخ (اسپرد) و کارمزدها — پیش از تأیید نهایی، به تفکیک و به صورت کامل نمایش داده می‌شود. کاربر تا پیش از دیدن این تفکیک، هیچ تعهدی ندارد.",
            "پس از انقضای زمان قفل، نرخ تنها با تأیید مجدد کاربر به‌روزرسانی می‌شود.",
            "مبلغی که گیرنده دریافت می‌کند، همان عددی است که در پیش‌فاکتور نمایش داده شده، مگر در صورت تغییر مبلغ ارسالی توسط خود کاربر یا کسر کارمزد بانک واسط مقصد که خارج از کنترل پلتفرم و صرافی است و پیشاپیش اعلام می‌شود.",
          ],
        },
        {
          h: "۶. اجرای حواله و ترتیب تسویه",
          ps: [
            "تسویه دومرحله‌ای و نظارت‌شده است: ابتدا لگ تومانی تأمین می‌شود و در پایان، پس از تأیید دریافت توسط گیرنده، آزاد می‌گردد.",
            "تنها گیرنده می‌تواند دریافت وجه را تأیید کند. این تأیید، مبنای آزادسازی است.",
            "مسئولیت اجرای صحیح و به‌موقع حواله بر عهدهٔ صرافی پذیرنده است. آسا عملکرد صرافی‌ها را می‌سنجد و ثبت می‌کند، اما ضامن آن نیست.",
          ],
        },
        {
          h: "۷. حساب‌های تسویه و مسئولیت شمارهٔ حساب",
          ps: [
            "کاربر و صرافی موظف‌اند شمارهٔ کارت و شبای صحیح و متعلق به خود را وارد کنند. پلتفرم تا حد امکان، تطابق نام دارندهٔ حساب و کد ملی را بررسی می‌کند.",
            "**در صورتی که کاربر با وجود عدم تطابق نام یا کد ملی، بر ادامهٔ فرآیند اصرار کند، مسئولیت کامل انتقال — شامل هرگونه ضرر، تأخیر، مسدودی یا عدم بازگشت وجه — بر عهدهٔ شخص کاربر است.** پلتفرم این پذیرش را با زمان و هویت کاربر ثبت می‌کند و در چنین موردی هیچ مسئولیتی متوجه آسا یا صرافی نخواهد بود.",
            "واریز به حسابی که متعلق به شخص دیگری است، در حکم انتقال به شخص ثالث است و مشمول بررسی انطباق می‌شود.",
            "اشتباه در وارد کردن شمارهٔ حساب توسط کاربر، از مصادیق مسئولیت کاربر است. پلتفرم در بازگرداندن چنین وجوهی همکاری می‌کند اما تضمینی نمی‌دهد.",
          ],
        },
        {
          h: "۸. بازار همتا به همتا",
          ps: [
            "در بازار همتا، طرفین معامله خود کاربران‌اند. آسا بستر و سازوکار امانی را فراهم می‌کند و صرافی نقش تأییدکنندهٔ بی‌طرف را دارد.",
            "قیمت‌گذاری تا سقف اعلام‌شده نسبت به نرخ بازار آزاد است. آسا در تعیین قیمت میان کاربران دخالت نمی‌کند و قیمت توافقی را تضمین نمی‌کند.",
            "امتیاز و سابقهٔ کاربران بر پایهٔ معاملات تمام‌شده محاسبه می‌شود و صرفاً جنبهٔ اطلاع‌رسانی دارد؛ تضمین رفتار آیندهٔ طرف مقابل نیست.",
          ],
        },
        {
          h: "۹. لغو، استرداد و اختلاف",
          ps: [
            "تا پیش از تأمین لگ تومانی، لغو سفارش بدون هزینه است.",
            "پس از آن، استرداد از مسیر تسویهٔ نظارت‌شده و با ثبت دلیل انجام می‌شود و ممکن است مشمول کسر هزینه‌های انجام‌شده باشد.",
            "در صورت اختلاف، کاربر می‌تواند تیکت ثبت کند. اگر صرافی مسئول ظرف مهلت اعلام‌شده پاسخ ندهد، پرونده به پلتفرم ارجاع می‌شود. تصمیم پلتفرم در حدود اختیاراتش اتخاذ می‌شود و مانع مراجعهٔ کاربر به مراجع قانونی نیست.",
          ],
        },
        {
          h: "۱۰. تعهدات و مسئولیت کاربر",
          ps: [
            "کاربر مسئول حفظ محرمانگی اطلاعات ورود خود است. هر اقدامی که از طریق حساب کاربری انجام شود، منتسب به دارندهٔ حساب است، مگر آنکه خلاف آن با ادلهٔ کافی اثبات شود.",
            "کاربر مسئول صحت تمام اطلاعاتی است که وارد می‌کند: مبلغ، ارز، مشخصات گیرنده و شمارهٔ حساب مقصد.",
            "کاربر متعهد است از پلتفرم برای مقاصد نامشروع، پول‌شویی، تأمین مالی تروریسم، دور زدن تحریم یا هر فعالیت مجرمانهٔ دیگر استفاده نکند.",
            "کاربر مسئول رعایت قوانین مالیاتی و ارزی کشور محل اقامت خود است.",
          ],
        },
        {
          h: "۱۱. محدودیت مسئولیت پلتفرم",
          ps: [
            "آسا خدمات را «همان‌گونه که هست» ارائه می‌کند و در حدودی که قانون اجازه می‌دهد، مسئولیتی در قبال موارد زیر ندارد: اجرای نادرست یا تأخیر صرافی، نوسان نرخ ارز، اشتباه کاربر در ورود اطلاعات، قطعی شبکه یا زیرساخت بانکی، اقدامات بانک‌های واسط، تصمیم‌های مراجع نظارتی، و رویدادهای قهری.",
            "آسا مسئول خسارات غیرمستقیم، تبعی، عدم‌النفع یا از دست رفتن فرصت نیست.",
            "**تصریح می‌شود** که این محدودیت‌ها شامل مواردی که قانون آن‌ها را غیرقابل اسقاط دانسته است نمی‌شود؛ از جمله تکالیف مقرر در قانون تجارت الکترونیکی و قانون حمایت از حقوق مصرف‌کننده، و مسئولیت ناشی از تقصیر عمدی یا تقلب. شرطی که خلاف قواعد آمره باشد، در همان حد باطل است و به اعتبار سایر مفاد این سند لطمه نمی‌زند.",
            "در هر حال و در حدود مجاز قانونی، سقف مسئولیت آسا نسبت به هر سفارش، از مجموع کارمزدی که آسا بابت همان سفارش دریافت کرده است فراتر نمی‌رود.",
          ],
        },
        {
          h: "۱۲. حقوق شما بر پایهٔ قانون تجارت الکترونیکی",
          ps: [
            "پیش از هر معامله، هویت پلتفرم، مشخصات کامل خدمت، نرخ، کارمزدها و مبلغ نهایی به تفکیک به شما اعلام می‌شود.",
            "شرایط، مدت اعتبار پیشنهاد و رویهٔ فسخ پیش از تأیید در دسترس شماست و رونوشت آن برای شما نگه‌داری می‌شود.",
            "حق انصراف مقرر در قانون تجارت الکترونیکی، در مورد خدماتی که با رضایت صریح شما پیش از پایان مهلت انصراف آغاز و اجرا شده‌اند — مانند حواله‌ای که تأمین و اجرا شده — قابل اعمال نیست. تا پیش از تأمین لگ تومانی، لغو آزاد است.",
            "داده‌های شخصی شما بر پایهٔ سیاست حریم خصوصی پردازش می‌شود و بدون رضایت شما در اختیار اشخاص ثالث تجاری قرار نمی‌گیرد.",
          ],
        },
        {
          h: "۱۳. مالکیت فکری",
          ps: [
            "نام، نشان، طراحی، متن و نرم‌افزار پلتفرم متعلق به آسا است. هرگونه بهره‌برداری تجاری، تکثیر یا مهندسی معکوس بدون اجازهٔ کتبی ممنوع است.",
          ],
        },
        {
          h: "۱۴. تعلیق و خاتمه",
          ps: [
            "پلتفرم می‌تواند در صورت نقض این شرایط، وجود نشانهٔ تخلف، یا الزام مراجع قانونی، دسترسی کاربر را موقتاً یا دائم محدود کند.",
            "کاربر هر زمان می‌تواند درخواست حذف حساب دهد. سوابق مالی و مدارک احراز هویت، در حدی که قوانین مبارزه با پول‌شویی الزام کرده‌اند، نگه‌داری می‌شود.",
          ],
        },
        {
          h: "۱۵. تغییر شرایط",
          ps: [
            "هر نسخهٔ این سند شماره و تاریخ دارد. تغییرات با اعلام قبلی منتشر می‌شود و استفادهٔ پس از انتشار، به منزلهٔ پذیرش نسخهٔ تازه است. نسخه‌ای که هر کاربر پذیرفته، جداگانه ثبت می‌شود.",
          ],
        },
        {
          h: "۱۶. قانون حاکم و حل اختلاف",
          ps: [
            "قانون حاکم بر این سند، قوانین جمهوری اسلامی ایران است.",
            "طرفین می‌کوشند اختلاف را نخست از مسیر رسیدگی داخلی پلتفرم حل کنند. در صورت عدم حصول نتیجه، مرجع صالح، دادگاه‌های صالح تهران خواهد بود. این بند حق مراجعهٔ مصرف‌کننده به مراجع حمایتی مقرر در قانون را سلب نمی‌کند.",
          ],
        },
      ],
    },
    en: {
      version: V_EN,
      updated: UPDATED,
      intro:
        "This document sets out the full terms for using the Asaex platform. Asa is a remittance marketplace between licensed exchange offices; it is not a bank, not a custodial wallet, and holds no deposits. Signing in to the platform or any of its panels constitutes acceptance of these terms. Please read it in full before using the service.",
      sections: [
        {
          h: "1. Definitions",
          ps: [
            '"Platform" or "Asa": the Asaex system, including its website, application and panels.',
            '"Exchange office": a licensed natural or legal person who executes transfers through the platform. The exchange office is the user\'s counterparty for execution.',
            '"User": anyone who registers or uses the services, whether as sender, recipient or participant in the peer-to-peer market.',
            '"Transfer": a currency-transfer order placed by a user and executed by an exchange office.',
            '"Peer-to-peer market": the part of the platform where users exchange currency directly with one another, with an exchange office acting as neutral confirmer.',
          ],
        },
        {
          h: "2. What the service is, and Asa's role",
          ps: [
            "Asa is a **marketplace**. It is not a bank, not a credit institution, not a custodial wallet and not a securities market. Asa holds no customer deposits and does not own funds in transit.",
            "Asa's role is limited to: routing a user's request to eligible exchange offices, keeping a record of every step, providing the channel for conversation, and supervising the order of the two-sided settlement.",
            "The contract to execute a transfer is between the **user and the exchange office**. Asa is not a party to it and does not guarantee its performance.",
            "Using the platform, or signing in to any of its panels, means you have read and accepted this document in full, together with the privacy policy, the anti-money-laundering policy, the fee schedule, the time commitment and the complaints procedure. The version each user accepted is recorded with its date.",
          ],
        },
        {
          h: "3. Eligibility",
          ps: [
            "Use of the services requires being at least 18 years old and having legal capacity to contract.",
            "Each person may hold one account. An account is personal and not transferable.",
            "Users undertake to provide accurate, complete and current identity information. False information leads to suspension and, where required, a report to the competent authorities.",
          ],
        },
        {
          h: "4. Identity verification and anti-money-laundering",
          ps: [
            "Verification of users and exchange offices rests with the platform administrator; approval or refusal is the platform's decision. Submitted documents are stored encrypted.",
            "The platform may at any time request further documents, change transfer ceilings, or suspend an account where there are indications of wrongdoing.",
            "Any request contrary to the currency regulations of the Islamic Republic of Iran, the law of the destination country, or international sanctions lists is cancelled without execution.",
            "The user affirms that the source of funds is lawful and that the funds are their own, unless a third-party transfer has been expressly declared and approved.",
          ],
        },
        {
          h: "5. Rates, fees and the rate lock",
          ps: [
            "Rates shown before an order is placed are mid-market and informational.",
            "The final rate is locked at submission for the stated period, and its components — base rate, rate difference (spread) and fees — are itemised in full before final confirmation. The user is under no obligation until that breakdown has been seen.",
            "After the lock expires, the rate is updated only with the user's renewed acceptance.",
            "The amount the recipient receives is the amount shown on the quote, except where the user changes the amount sent, or where an intermediary bank at the destination deducts a charge outside the control of the platform and the office, which is disclosed in advance.",
          ],
        },
        {
          h: "6. Execution and the settlement order",
          ps: [
            "Settlement is two-sided and supervised: the Toman leg is funded first and released last, after the recipient confirms receipt.",
            "Only the recipient can confirm receipt. That confirmation is the basis for release.",
            "Correct and timely execution is the responsibility of the accepting exchange office. Asa measures and records office performance but does not guarantee it.",
          ],
        },
        {
          h: "7. Settlement accounts and responsibility for account numbers",
          ps: [
            "Users and exchange offices must enter correct card and IBAN numbers belonging to themselves. The platform checks the account holder's name and national ID for a match as far as it is able.",
            "**Where a user chooses to proceed despite a mismatch of name or national ID, full responsibility for the transfer — including any loss, delay, freeze or non-return of funds — rests with that user.** The platform records this acceptance with its time and the user's identity, and in such a case neither Asa nor the exchange office bears any responsibility.",
            "Paying into an account belonging to someone else is a third-party transfer and is subject to compliance review.",
            "An account number mistyped by the user is the user's responsibility. The platform will assist in seeking the return of such funds but gives no guarantee.",
          ],
        },
        {
          h: "8. The peer-to-peer market",
          ps: [
            "In the peer-to-peer market the counterparties are the users themselves. Asa provides the venue and the escrow mechanism, and an exchange office acts as neutral confirmer.",
            "Pricing is free within the published band around the market rate. Asa does not intervene in pricing between users and does not guarantee any agreed price.",
            "User ratings and history are computed from completed trades and are informational only; they are not a guarantee of a counterparty's future conduct.",
          ],
        },
        {
          h: "9. Cancellation, refunds and disputes",
          ps: [
            "Before the Toman leg is funded, cancellation is free.",
            "After that, refunds follow the supervised settlement path with a recorded reason, and may be subject to deduction of costs already incurred.",
            "In a dispute the user may open a ticket. If the responsible exchange office does not reply within the stated window, the case escalates to the platform. The platform decides within its authority, and that does not prevent the user from approaching the legal authorities.",
          ],
        },
        {
          h: "10. User obligations and responsibility",
          ps: [
            "Users are responsible for keeping their sign-in credentials confidential. Anything done through an account is attributed to its holder unless the contrary is proven with sufficient evidence.",
            "Users are responsible for the accuracy of everything they enter: amount, currency, recipient details and destination account number.",
            "Users undertake not to use the platform for unlawful purposes, money laundering, terrorist financing, sanctions circumvention or any other criminal activity.",
            "Users are responsible for complying with the tax and currency laws of their country of residence.",
          ],
        },
        {
          h: "11. Limitation of the platform's liability",
          ps: [
            'Asa provides the services "as is" and, to the extent the law permits, is not liable for: incorrect or delayed execution by an exchange office, currency fluctuation, user error in entering information, network or banking-infrastructure outages, the acts of intermediary banks, decisions of regulatory authorities, and force majeure.',
            "Asa is not liable for indirect, consequential or loss-of-profit damages.",
            "**It is expressly stated** that these limitations do not extend to matters the law has made non-waivable — including the duties imposed by the Electronic Commerce Act and the Consumer Protection Act, and liability arising from wilful misconduct or fraud. A term contrary to mandatory rules is void to that extent and does not affect the validity of the remainder of this document.",
            "In any event, and within what the law permits, Asa's liability for any one order does not exceed the total fee Asa received for that order.",
          ],
        },
        {
          h: "12. Your rights under the Electronic Commerce Act",
          ps: [
            "Before any transaction, the platform's identity, the full particulars of the service, the rate, the fees and the final amount are disclosed to you itemised.",
            "The terms, the validity period of the offer and the cancellation procedure are available to you before confirmation, and a copy is retained for you.",
            "The statutory right of withdrawal does not apply to services which, with your express consent, began and were performed before the withdrawal period ended — such as a transfer that has been funded and executed. Before the Toman leg is funded, cancellation is free.",
            "Your personal data is processed under the privacy policy and is not shared with commercial third parties without your consent.",
          ],
        },
        {
          h: "13. Intellectual property",
          ps: [
            "The platform's name, mark, design, text and software belong to Asa. Commercial exploitation, reproduction or reverse engineering without written permission is prohibited.",
          ],
        },
        {
          h: "14. Suspension and termination",
          ps: [
            "The platform may restrict access temporarily or permanently on breach of these terms, on indications of wrongdoing, or where required by legal authority.",
            "A user may request account deletion at any time. Financial records and identity documents are retained to the extent anti-money-laundering law requires.",
          ],
        },
        {
          h: "15. Changes to these terms",
          ps: [
            "Every version of this document carries a number and a date. Changes are published with prior notice, and use after publication constitutes acceptance of the new version. The version each user accepted is recorded separately.",
          ],
        },
        {
          h: "16. Governing law and dispute resolution",
          ps: [
            "This document is governed by the laws of the Islamic Republic of Iran.",
            "The parties will first seek to resolve a dispute through the platform's internal process. Failing that, the competent courts of Tehran have jurisdiction. This clause does not remove a consumer's right to approach the protective authorities provided for by law.",
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

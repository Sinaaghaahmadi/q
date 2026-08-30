/* ============================================================================
   بت آسا — حساب کاربری

   چه چیزی اینجا واقعی است و چه چیزی منتظر سرور می‌ماند:

   این اپ استاتیک است و سروری ندارد. پس هر چیزی که ذاتاً به سرور نیاز دارد
   — فرستادن پیامک، تأیید هویت گوگل، یکتا بودن یوزرنیم در کل سیستم، و
   پاداشِ سمتِ دعوت‌کننده — اینجا «انجام‌شده» وانمود نمی‌شود. به‌جایش:

     • درگاهِ ورود پشت یک واسط (`providers`) است. هر ارائه‌دهندهٔ واقعی که
       بعداً وصل شود، همان سه تابع را پیاده می‌کند و بقیهٔ اپ دست نمی‌خورد.
     • تا وقتی سروری نیست، ارائه‌دهندهٔ محلی کار می‌کند و خودش را صریحاً
       «آزمایشی» معرفی می‌کند؛ کد تأیید روی صفحه نشان داده می‌شود چون
       پیامکی در کار نیست.
     • پاداش دعوت‌کننده در صفی به نام `pendingCredits` می‌نشیند تا روزی که
       سرور بتواند آن را به حساب طرف مقابل بریزد. وانمود نمی‌کنیم پرداخت شد.

   و آنچه اینجا هرگز نیست: هیچ کیف پول ریالی، هیچ واریز، هیچ برداشت.
   ========================================================================== */

const KEY = "betasa-account";
const SESSION_KEY = "betasa-session";

/* ---------- ذخیره‌سازی ---------- */
function read(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* حالت خصوصی مرورگر */ }
}

/* ---------- مدل ---------- */
const listeners = new Set();
let current = read(KEY, null);

export function account() { return current; }
export function isSignedIn() { return !!current; }
export function onAccountChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

function commit(next) {
  current = next;
  if (next) write(KEY, next); else { try { localStorage.removeItem(KEY); } catch {} }
  for (const fn of listeners) { try { fn(current); } catch {} }
  return current;
}

/* ---------- کد دعوت ----------
   از حروفی ساخته می‌شود که با هم اشتباه نمی‌شوند: نه O و 0، نه I و 1.
   کسی باید بتواند این را از روی صفحهٔ گوشیِ دوستش بخواند و تایپ کند. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function normalizeInvite(raw) {
  return String(raw || "")
    .replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d))
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    /* الفبای کد نه O دارد نه 0، نه I نه 1؛ این‌ها فقط از بدخوانی می‌آیند. */
    .replace(/[OI01]/g, "");
}

function makeInviteCode() {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join("");
}

export function inviteLink(code) {
  const base = location.origin + location.pathname.replace(/[^/]*$/, "");
  return `${base}index.html?invite=${code}`;
}

/* ---------- یوزرنیم ----------
   یکتایی در کل سیستم فقط با سرور معنا دارد؛ اینجا فقط شکل را می‌سنجیم و
   صریح می‌گوییم که تأیید نهایی با سرور است. */
const USERNAME_RE = /^[a-z][a-z0-9_]{2,19}$/;
const RESERVED = new Set(["admin", "betasa", "support", "root", "system", "asa", "help"]);

export function checkUsername(raw) {
  const value = String(raw || "").trim().toLowerCase();
  if (!value) return { ok: false, reason: "یوزرنیم را بنویس." };
  if (value.length < 3) return { ok: false, reason: "دست‌کم ۳ نویسه." };
  if (value.length > 20) return { ok: false, reason: "حداکثر ۲۰ نویسه." };
  if (!USERNAME_RE.test(value)) {
    return { ok: false, reason: "فقط حروف کوچک انگلیسی، عدد و زیرخط؛ و با حرف شروع شود." };
  }
  if (RESERVED.has(value)) return { ok: false, reason: "این یوزرنیم رزرو شده است." };
  return { ok: true, value };
}

/* ---------- ارائه‌دهنده‌های ورود ---------- */
const PENDING_KEY = "betasa-otp";

export const providers = {
  /** شمارهٔ ایران را به شکل مرجع درمی‌آورد: ۰۹۱۲۳۴۵۶۷۸۹ → +989123456789 */
  normalizePhone(raw) {
    const digits = String(raw || "")
      .replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d))
      .replace(/[^\d+]/g, "");
    if (/^09\d{9}$/.test(digits)) return "+98" + digits.slice(1);
    if (/^9\d{9}$/.test(digits)) return "+98" + digits;
    if (/^\+989\d{9}$/.test(digits)) return digits;
    if (/^00989\d{9}$/.test(digits)) return "+98" + digits.slice(4);
    return null;
  },

  /** کد را می‌فرستد. بدون سرور، «فرستادن» یعنی نمایش دادن — و همین را می‌گوید. */
  async requestCode(phone) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    write(PENDING_KEY, { phone, code, at: Date.now() });
    return { delivered: false, demoCode: code };
  },

  async verifyCode(phone, code) {
    const pending = read(PENDING_KEY, null);
    if (!pending || pending.phone !== phone) return { ok: false, reason: "کد منقضی شده؛ دوباره بگیر." };
    if (Date.now() - pending.at > 5 * 60 * 1000) return { ok: false, reason: "کد منقضی شده؛ دوباره بگیر." };
    if (String(code).trim() !== pending.code) return { ok: false, reason: "کد درست نیست." };
    try { localStorage.removeItem(PENDING_KEY); } catch {}
    return { ok: true, identity: { kind: "phone", phone } };
  },

  /** هویت گوگل. بدون شناسهٔ کلاینت، اصلاً وانمود نمی‌کند که کار می‌کند. */
  googleReady() { return typeof window.BETASA_GOOGLE_CLIENT_ID === "string" && !!window.BETASA_GOOGLE_CLIENT_ID; },

  async signInWithGoogle() {
    if (!this.googleReady()) {
      return { ok: false, reason: "ورود با گوگل هنوز به سرور وصل نشده است." };
    }
    /* شناسهٔ کلاینت که تنظیم شد، Google Identity Services اینجا سوار می‌شود
       و توکنش برای تأیید به سرور می‌رود. تأیید هرگز سمت مرورگر نیست. */
    return { ok: false, reason: "ورود با گوگل هنوز به سرور وصل نشده است." };
  },
};

/* ---------- ورود و خروج ---------- */
export function signIn(identity) {
  const now = Date.now();
  const next = current || {
    id: crypto.randomUUID(),
    createdAt: now,
    inviteCode: makeInviteCode(),
    invitedBy: null,
    invitesAccepted: 0,
    pendingCredits: [],
    profile: { username: "", displayName: "", city: "" },
  };
  next.identity = identity;
  next.lastSignIn = now;
  write(SESSION_KEY, { at: now });
  return commit(next);
}

export function signOut() {
  try { localStorage.removeItem(SESSION_KEY); } catch {}
  return commit(null);
}

/** حساب و هر چه به آن بند است پاک می‌شود — کیف سکه دست‌نخورده می‌ماند. */
export function forgetAccount() {
  try { localStorage.removeItem(PENDING_KEY); } catch {}
  return signOut();
}

export function exportAccount() {
  return JSON.stringify({ account: current, exportedAt: new Date().toISOString() }, null, 2);
}

/* ---------- پروفایل ---------- */
export function saveProfile(patch) {
  if (!current) return null;
  const profile = { ...current.profile };
  if ("username" in patch) {
    const check = checkUsername(patch.username);
    if (!check.ok) return { error: check.reason };
    profile.username = check.value;
  }
  if ("displayName" in patch) profile.displayName = String(patch.displayName || "").trim().slice(0, 40);
  if ("city" in patch) profile.city = String(patch.city || "").trim().slice(0, 40);
  commit({ ...current, profile });
  return { ok: true, profile };
}

/* ---------- دعوت ----------
   سکهٔ مهمان همین‌جا و همین حالا ریخته می‌شود، چون کیف سکه محلی است.
   سکهٔ میزبان صف می‌شود: تا سروری نباشد، هیچ‌کس نمی‌تواند به کیف دستگاهِ
   دیگری چیزی اضافه کند، و ادعای خلافش دروغ است. */
export const INVITE_GUEST_BONUS = 2500;
export const INVITE_HOST_BONUS = 2500;

export function redeemInvite(rawCode, creditCoins) {
  if (!current) return { error: "اول وارد شو." };
  const code = normalizeInvite(rawCode);
  if (code.length !== 6 || [...code].some((ch) => !ALPHABET.includes(ch))) {
    return { error: "کد دعوت شش‌نویسه‌ای است (حروف بزرگ و عدد)." };
  }
  if (code === current.inviteCode) return { error: "کد خودت را نمی‌شود استفاده کرد." };
  if (current.invitedBy) return { error: "یک بار کد دعوت ثبت شده است." };

  const pending = [...(current.pendingCredits || []),
    { to: code, amount: INVITE_HOST_BONUS, reason: "invite", at: Date.now() }];
  commit({ ...current, invitedBy: code, pendingCredits: pending });
  creditCoins(INVITE_GUEST_BONUS);
  return { ok: true, granted: INVITE_GUEST_BONUS, queuedForHost: INVITE_HOST_BONUS };
}

/** کدی که در آدرس صفحهٔ اصلی آمده تا وقتی مصرف شود نگه داشته می‌شود. */
const CARRIED_KEY = "betasa-invite-carried";
export function carryInviteFromUrl() {
  const code = normalizeInvite(new URLSearchParams(location.search).get("invite"));
  if (code.length === 6) write(CARRIED_KEY, code);
  return read(CARRIED_KEY, "");
}
export function carriedInvite() { return read(CARRIED_KEY, ""); }
export function clearCarriedInvite() { try { localStorage.removeItem(CARRIED_KEY); } catch {} }

/* ---------- اشتراک‌گذاری ---------- */
export async function shareInvite(code) {
  const url = inviteLink(code);
  const text = `با کد دعوت ${code} وارد بت آسا شو — ${INVITE_GUEST_BONUS.toLocaleString("fa-IR")} سکهٔ مجازی هدیه می‌گیری.`;
  if (navigator.share) {
    try { await navigator.share({ title: "بت آسا", text, url }); return { ok: true, how: "share" }; }
    catch (e) { if (e && e.name === "AbortError") return { ok: false, aborted: true }; }
  }
  try { await navigator.clipboard.writeText(`${text}\n${url}`); return { ok: true, how: "clipboard" }; }
  catch { return { ok: false, reason: "کپی نشد؛ کد را دستی بردار." }; }
}

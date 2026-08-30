/* ============================================================================
   بت آسا — صفحه‌های ورود و پروفایل
   جدا از app.js نگه داشته شده‌اند چون منطقشان با منطق بازی هیچ اشتراکی ندارد.
   ========================================================================== */
import * as A from "../account.js";

/* هر چیزی که کاربر تایپ کرده پیش از رفتن به innerHTML بی‌خطر می‌شود */
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const el = (tag, cls, html) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
};

/* ============================ ورود ============================ */
export function renderSignIn(view, { toast, fmt }) {
  document.title = "بت آسا — ورود";
  const page = el("div", "game-page");
  page.innerHTML = `
    <div class="game-head">
      <button class="back" type="button">→ خانه</button>
      <h1>ورود به بت آسا</h1>
    </div>

    <div class="auth-card">
      <p class="muted auth-lead">
        ورود فقط برای این است که پروفایل و کد دعوتت جایی ثبت شود. هیچ پرداختی،
        هیچ کارتی و هیچ حساب بانکی‌ای در کار نیست.
      </p>

      <div class="auth-tabs" role="tablist">
        <button class="auth-tab" role="tab" aria-selected="true" data-pane="phone" type="button">شمارهٔ موبایل</button>
        <button class="auth-tab" role="tab" aria-selected="false" data-pane="google" type="button">حساب گوگل</button>
      </div>

      <form class="auth-pane" data-pane="phone" novalidate>
        <label class="field">
          <span>شمارهٔ موبایل</span>
          <input class="input phone" type="tel" inputmode="tel" autocomplete="tel"
                 placeholder="۰۹۱۲ ۰۰۰ ۰۰۰۰" dir="ltr">
        </label>
        <div class="code-row" hidden>
          <label class="field">
            <span>کد تأیید</span>
            <input class="input code" type="text" inputmode="numeric" autocomplete="one-time-code"
                   maxlength="6" placeholder="۶ رقم" dir="ltr">
          </label>
          <p class="demo-code muted" role="status"></p>
        </div>
        <button class="btn btn-gold submit" type="submit">فرستادن کد</button>
        <p class="auth-error" role="alert" hidden></p>
      </form>

      <div class="auth-pane" data-pane="google" hidden>
        <button class="btn btn-ghost google" type="button">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path fill="currentColor" d="M21.6 12.2c0-.7-.06-1.35-.18-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3z"/>
            <path fill="currentColor" d="M12 22c2.7 0 5-.9 6.6-2.5l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22z"/>
            <path fill="currentColor" d="M6.4 13.9a6 6 0 0 1 0-3.8V7.5H3.1a10 10 0 0 0 0 9z"/>
            <path fill="currentColor" d="M12 6.1c1.5 0 2.8.5 3.8 1.5l2.8-2.8A10 10 0 0 0 3.1 7.5l3.3 2.6C7.2 7.9 9.4 6.1 12 6.1z"/>
          </svg>
          ورود با حساب گوگل
        </button>
        <p class="muted google-note"></p>
      </div>
    </div>`;

  page.querySelector(".back").addEventListener("click", () => { location.hash = "#/"; });

  /* تب‌ها */
  const tabs = [...page.querySelectorAll(".auth-tab")];
  const panes = [...page.querySelectorAll(".auth-pane")];
  for (const tab of tabs) {
    tab.addEventListener("click", () => {
      for (const t of tabs) t.setAttribute("aria-selected", String(t === tab));
      for (const p of panes) p.hidden = p.dataset.pane !== tab.dataset.pane;
    });
  }

  /* گوگل */
  const googleBtn = page.querySelector(".google");
  const googleNote = page.querySelector(".google-note");
  if (!A.providers.googleReady()) {
    googleBtn.disabled = true;
    googleNote.textContent =
      "این دکمه تا وقتی سرورِ تأیید هویت وصل نشده کار نمی‌کند. تأیید توکن گوگل باید سمت سرور انجام شود، نه در مرورگر — پس دکمه‌ای که «انگار» کار کند اینجا نگذاشتیم.";
  } else {
    googleBtn.addEventListener("click", async () => {
      const res = await A.providers.signInWithGoogle();
      if (!res.ok) { toast(res.reason); return; }
      A.signIn(res.identity);
      location.hash = "#/profile";
    });
  }

  /* شمارهٔ موبایل */
  const form = page.querySelector('form[data-pane="phone"]');
  const phoneInput = form.querySelector(".phone");
  const codeRow = form.querySelector(".code-row");
  const codeInput = form.querySelector(".code");
  const demo = form.querySelector(".demo-code");
  const submit = form.querySelector(".submit");
  const error = form.querySelector(".auth-error");
  let stage = "phone", phone = null;

  const fail = (msg) => { error.textContent = msg; error.hidden = false; };
  const clear = () => { error.hidden = true; };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clear();
    if (stage === "phone") {
      phone = A.providers.normalizePhone(phoneInput.value);
      if (!phone) return fail("شمارهٔ موبایل ایران را کامل بنویس، مثل ۰۹۱۲۳۴۵۶۷۸۹.");
      const res = await A.providers.requestCode(phone);
      stage = "code";
      codeRow.hidden = false;
      submit.textContent = "تأیید و ورود";
      phoneInput.readOnly = true;
      codeInput.focus();
      demo.textContent = res.delivered
        ? "کد برایت پیامک شد."
        : `پیامکی فرستاده نشد — سروری در کار نیست. کد آزمایشی: ${res.demoCode}`;
      return;
    }
    const res = await A.providers.verifyCode(phone, codeInput.value);
    if (!res.ok) return fail(res.reason);
    A.signIn(res.identity);
    toast("خوش آمدی");
    location.hash = "#/profile";
  });

  view.appendChild(page);
}

/* ============================ پروفایل ============================ */
export function renderProfile(view, { toast, fmt, credit }) {
  const acc = A.account();
  if (!acc) { location.hash = "#/signin"; return; }
  document.title = "بت آسا — پروفایل";

  const page = el("div", "game-page");
  const who = acc.identity?.kind === "phone" ? acc.identity.phone : acc.identity?.email || "—";

  page.innerHTML = `
    <div class="game-head">
      <button class="back" type="button">→ خانه</button>
      <h1>پروفایل</h1>
    </div>

    <section class="auth-card">
      <h2 class="card-title">مشخصات</h2>
      <p class="muted" style="margin-top:0">وارد شده با <span class="ltr">${esc(who)}</span></p>
      <form class="profile-form" novalidate>
        <label class="field">
          <span>یوزرنیم</span>
          <input class="input username" dir="ltr" placeholder="mahdi_74" value="${esc(acc.profile.username)}">
          <small class="hint">حروف کوچک انگلیسی، عدد و زیرخط. همین اسم بالای صفحهٔ رکوردهایت می‌نشیند و وقتی حساب‌ها به سرور وصل شوند، نام عمومی‌ات همین است.</small>
        </label>
        <label class="field">
          <span>نام نمایشی</span>
          <input class="input displayName" placeholder="مهدی" value="${esc(acc.profile.displayName)}">
        </label>
        <label class="field">
          <span>شهر</span>
          <input class="input city" placeholder="تهران" value="${esc(acc.profile.city)}">
        </label>
        <button class="btn btn-gold save" type="submit">ذخیره</button>
        <p class="auth-error profile-error" role="alert" hidden></p>
      </form>
    </section>

    <section class="auth-card">
      <h2 class="card-title">کد دعوت تو</h2>
      <div class="invite-box">
        <code class="invite-code ltr">${esc(acc.inviteCode)}</code>
        <div class="invite-actions">
          <button class="btn btn-gold share" type="button">هم‌رسانی</button>
          <button class="btn btn-ghost copy" type="button">کپی کد</button>
        </div>
      </div>
      <p class="muted">
        هر کس با این کد وارد شود ${fmt(A.INVITE_GUEST_BONUS)} سکه هدیه می‌گیرد.
        سهم تو (${fmt(A.INVITE_HOST_BONUS)} سکه) در صف می‌نشیند تا سرورِ حساب‌ها وصل شود —
        چون بدون سرور هیچ دستگاهی نمی‌تواند به کیف دستگاه دیگری سکه اضافه کند.
      </p>
      <p class="invite-stat">دعوت‌های ثبت‌شده روی این دستگاه: <b class="mono">${fmt(acc.invitesAccepted || 0)}</b></p>
    </section>

    <section class="auth-card redeem-card">
      <h2 class="card-title">کد دعوت گرفتی؟</h2>
      <form class="redeem-form" novalidate>
        <label class="field">
          <span>کد دعوت</span>
          <input class="input redeem" dir="ltr" maxlength="8" placeholder="ABC234">
        </label>
        <button class="btn btn-gold" type="submit">ثبت کد</button>
        <p class="auth-error redeem-error" role="alert" hidden></p>
      </form>
    </section>

    <section class="auth-card">
      <h2 class="card-title">حساب</h2>
      <div class="account-actions">
        <button class="btn btn-ghost export" type="button">گرفتن نسخهٔ داده‌ها</button>
        <button class="btn btn-ghost signout" type="button">خروج</button>
      </div>
      <p class="muted">خروج فقط حساب را می‌بندد؛ کیف سکه و رکوردهایت روی همین مرورگر سر جایشان می‌مانند.</p>
    </section>`;

  page.querySelector(".back").addEventListener("click", () => { location.hash = "#/"; });

  /* ذخیرهٔ پروفایل */
  const pform = page.querySelector(".profile-form");
  const perr = page.querySelector(".profile-error");
  pform.addEventListener("submit", (e) => {
    e.preventDefault();
    perr.hidden = true;
    const res = A.saveProfile({
      username: pform.querySelector(".username").value,
      displayName: pform.querySelector(".displayName").value,
      city: pform.querySelector(".city").value,
    });
    if (res?.error) { perr.textContent = res.error; perr.hidden = false; return; }
    toast("ذخیره شد");
  });

  /* هم‌رسانی کد */
  page.querySelector(".share").addEventListener("click", async () => {
    const res = await A.shareInvite(acc.inviteCode);
    if (res.aborted) return;
    toast(res.ok ? (res.how === "share" ? "پنجرهٔ هم‌رسانی باز شد" : "متن دعوت کپی شد") : res.reason);
  });
  page.querySelector(".copy").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(acc.inviteCode); toast("کد کپی شد"); }
    catch { toast("کپی نشد؛ کد را دستی بردار."); }
  });

  /* ثبت کد دعوت */
  const rform = page.querySelector(".redeem-form");
  const rerr = page.querySelector(".redeem-error");
  const carried = A.carriedInvite();
  if (carried && !acc.invitedBy) rform.querySelector(".redeem").value = carried;
  if (acc.invitedBy) {
    page.querySelector(".redeem-card").innerHTML =
      `<h2 class="card-title">کد دعوت</h2><p class="muted">با کد <code class="ltr">${esc(acc.invitedBy)}</code> وارد شدی و سکه‌اش ریخته شد.</p>`;
  } else {
    rform.addEventListener("submit", (e) => {
      e.preventDefault();
      rerr.hidden = true;
      const res = A.redeemInvite(rform.querySelector(".redeem").value, credit);
      if (res.error) { rerr.textContent = res.error; rerr.hidden = false; return; }
      A.clearCarriedInvite();
      toast(`${fmt(res.granted)} سکه به کیفت اضافه شد`);
      renderRoute();
    });
  }

  /* حساب */
  page.querySelector(".export").addEventListener("click", () => {
    const blob = new Blob([A.exportAccount()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "betasa-account.json"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  page.querySelector(".signout").addEventListener("click", () => {
    A.signOut();
    toast("خارج شدی");
    location.hash = "#/";
  });

  view.appendChild(page);
}

/* روتر بیرون تزریق می‌شود تا این ماژول به app.js وابسته نشود */
let renderRoute = () => { location.hash = location.hash; };
export function setRouteRefresher(fn) { renderRoute = fn; }

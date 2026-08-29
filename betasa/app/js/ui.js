/* بت آسا — پریمیتیوهای دیزاین‌سیستم: قالب‌بندی عدد و کنترل شرط سکه‌ای.
   این ماژول عمداً هیچ کاری با DOM صفحه هنگام import انجام نمی‌دهد، تا
   صفحهٔ دیزاین‌سیستم بتواند کامپوننت‌ها و آیکون‌ها را بدون بالا آوردن اپ نشان دهد. */

const FA = "۰۱۲۳۴۵۶۷۸۹";

/** عدد را با ارقام فارسی و جداکنندهٔ هزارگان فارسی برمی‌گرداند. */
export function fmt(n) {
  const s = Math.round(n).toLocaleString("en-US").replace(/,/g, "٬");
  return s.replace(/[0-9]/g, (d) => FA[+d]);
}

/** ردیف کنترل شرط: ورودی مبلغ + چیپ‌های میان‌بر. */
export function betControls(defaultBet = 100) {
  const el = document.createElement("div");
  el.className = "bet-row";
  el.innerHTML = `
    <input class="bet-input mono" inputmode="numeric" value="${defaultBet}" aria-label="مبلغ سکه">
    <span class="chip-btns">
      <button class="chip-btn" type="button" data-v="100">۱۰۰</button>
      <button class="chip-btn" type="button" data-v="500">۵۰۰</button>
      <button class="chip-btn" type="button" data-v="1000">۱٬۰۰۰</button>
      <button class="chip-btn" type="button" data-mul="2">×۲</button>
      <button class="chip-btn" type="button" data-mul="0.5">½</button>
    </span>`;
  const input = el.querySelector(".bet-input");
  el.querySelectorAll(".chip-btn").forEach((b) =>
    b.addEventListener("click", () => {
      if (b.dataset.v) input.value = b.dataset.v;
      else input.value = Math.max(1, Math.floor((+input.value || 0) * +b.dataset.mul));
    })
  );
  return {
    el,
    amount: () => Math.floor(+input.value || 0),
    setDisabled(d) { el.querySelectorAll("input,button").forEach((n) => (n.disabled = d)); },
  };
}

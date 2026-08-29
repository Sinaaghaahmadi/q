/* Asa — تیکت: ورود با شماره، سپس دیدن وضعیت.
 *
 * این نسخه بدون سرور کار می‌کند: کد تأیید روی همان صفحه نشان داده می‌شود و
 * تیکت‌ها در همین مرورگر می‌مانند. برای اتصال به سرویس واقعی، فقط سه تابع
 * `api.*` پایین باید جای خود را به فراخوانی شبکه بدهند؛ بقیهٔ صفحه دست‌نخورده
 * می‌ماند.
 */
;(() => {
  const $ = (id) => document.getElementById(id)
  const KEY = 'asa.tickets.v1'
  const SESSION = 'asa.session.v1'
  const fa = (n) => String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d])

  const store = {
    read: () => {
      try { return JSON.parse(localStorage.getItem(KEY) || '{}') } catch { return {} }
    },
    write: (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)) } catch {} },
    session: () => { try { return localStorage.getItem(SESSION) } catch { return null } },
    signIn: (p) => { try { localStorage.setItem(SESSION, p) } catch {} },
    signOut: () => { try { localStorage.removeItem(SESSION) } catch {} },
  }

  /* ── جای اتصال به سرویس واقعی ─────────────────────────────────────── */
  let pending = null
  const api = {
    requestCode: async (phone) => {
      pending = { phone, code: String(Math.floor(100000 + Math.random() * 900000)) }
      return pending.code // در نسخهٔ واقعی: پیامک، و اینجا چیزی برنمی‌گردد
    },
    verify: async (code) => Boolean(pending) && code === pending.code,
    list: async (phone) => store.read()[phone] || [],
    create: async (phone, ticket) => {
      const all = store.read()
      all[phone] = [ticket, ...(all[phone] || [])]
      store.write(all)
    },
  }

  /* ── نمایش ────────────────────────────────────────────────────────── */
  const show = (id) => {
    ;['step-phone', 'step-code', 'step-list'].forEach((s) => { $(s).hidden = s !== id })
  }

  const STATES = {
    open: ['ثبت شد', 'open'],
    work: ['در حال انجام', 'work'],
    done: ['تحویل شد', 'done'],
  }

  const render = async (phone) => {
    $('who').textContent = phone
    const list = await api.list(phone)
    const box = $('tickets')
    box.innerHTML = ''
    $('empty').hidden = list.length > 0
    for (const t of list) {
      const [label, cls] = STATES[t.state] || STATES.open
      const el = document.createElement('article')
      el.className = 'tk'
      el.innerHTML = `
        <div class="top">
          <b></b>
          <span class="state ${cls}">${label}</span>
        </div>
        <p></p>
        <div class="when"></div>`
      el.querySelector('b').textContent = t.subject
      el.querySelector('p').textContent = t.body
      el.querySelector('.when').textContent =
        `${t.area} · شمارهٔ پیگیری ${fa(t.id)} · ${new Intl.DateTimeFormat('fa-IR', {
          dateStyle: 'medium', timeStyle: 'short',
        }).format(new Date(t.at))}`
      box.append(el)
    }
  }

  /* ── قدم‌ها ───────────────────────────────────────────────────────── */
  $('send-code').addEventListener('click', async () => {
    const raw = $('phone').value.replace(/[^\d]/g, '')
    if (!/^09\d{9}$/.test(raw)) {
      $('err-phone').textContent = 'شماره را با ۰۹ و یازده رقم بنویسید.'
      return
    }
    $('err-phone').textContent = ''
    const code = await api.requestCode(raw)
    $('phone-echo').textContent = raw
    $('demo-hint').textContent = `نسخهٔ نمایشی — کد شما: ${code}`
    show('step-code')
    $('code').focus()
  })

  $('back-phone').addEventListener('click', () => show('step-phone'))

  $('verify').addEventListener('click', async () => {
    const code = $('code').value.replace(/[^\d]/g, '')
    if (!(await api.verify(code))) {
      $('err-code').textContent = 'کد درست نیست. دوباره امتحان کنید.'
      return
    }
    $('err-code').textContent = ''
    store.signIn(pending.phone)
    show('step-list')
    render(pending.phone)
  })

  $('logout').addEventListener('click', () => {
    store.signOut()
    pending = null
    $('phone').value = ''
    $('code').value = ''
    show('step-phone')
  })

  $('create').addEventListener('click', async () => {
    const phone = store.session()
    const subject = $('subject').value.trim()
    const body = $('body').value.trim()
    if (!phone) return show('step-phone')
    if (subject.length < 3) {
      $('err-ticket').textContent = 'موضوع را کوتاه اما روشن بنویسید.'
      return
    }
    $('err-ticket').textContent = ''
    await api.create(phone, {
      id: Math.floor(1000 + Math.random() * 9000),
      subject,
      body,
      area: $('area').value,
      state: 'open',
      at: Date.now(),
    })
    $('subject').value = ''
    $('body').value = ''
    render(phone)
  })

  // هر بار که برگردید، همان‌جایی هستید که بودید
  const active = store.session()
  if (active) {
    show('step-list')
    render(active)
  } else {
    show('step-phone')
  }
})()

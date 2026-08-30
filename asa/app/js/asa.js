/* Asa — صفحهٔ معرفی: حرکت، تختهٔ کد زنده، و شاخص‌ها. */
;(() => {
  const $ = (s, r = document) => r.querySelector(s)
  const $$ = (s, r = document) => [...r.querySelectorAll(s)]
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
  const fine = matchMedia('(pointer: fine)').matches
  const fa = (n) => String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d])
  const C = window.AsaCode

  /* ── نوار بالا ────────────────────────────────────────────────── */
  const nav = $('#nav')
  const onScroll = () => nav.classList.toggle('is-scrolled', scrollY > 10)
  addEventListener('scroll', onScroll, { passive: true })
  onScroll()

  /* ── ورود تدریجی ─────────────────────────────────────────────── */
  const reveals = $$('.reveal')
  if (reduce || !('IntersectionObserver' in window)) {
    reveals.forEach((el) => el.classList.add('in'))
  } else {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e, i) => {
          if (!e.isIntersecting) return
          setTimeout(() => e.target.classList.add('in'), i * 60)
          io.unobserve(e.target)
        })
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.1 },
    )
    reveals.forEach((el) => io.observe(el))
  }

  /* ── مکان‌نما ─────────────────────────────────────────────────── */
  if (fine && !reduce) {
    const ring = $('.cursor')
    const dot = $('.cursor-dot')
    let rx = 0, ry = 0, tx = 0, ty = 0
    addEventListener('pointermove', (e) => {
      tx = e.clientX
      ty = e.clientY
      dot.style.transform = `translate(${tx - 2.5}px, ${ty - 2.5}px)`
      document.body.classList.add('has-cursor')
    })
    const trail = () => {
      rx += (tx - rx) * 0.16
      ry += (ty - ry) * 0.16
      ring.style.transform = `translate(${rx - 17}px, ${ry - 17}px)`
      requestAnimationFrame(trail)
    }
    trail()
    $$('a, button, .slab, .shot, .face-tile').forEach((el) => {
      el.addEventListener('pointerenter', () => document.body.classList.add('cursor-lg'))
      el.addEventListener('pointerleave', () => document.body.classList.remove('cursor-lg'))
    })
  }

  /* ── شبکهٔ نقطه‌ها در پس‌زمینه ─────────────────────────────────── */
  const cv = $('#field')
  if (cv && !reduce) {
    const ctx = cv.getContext('2d')
    let w, h, pts
    const dpr = Math.min(devicePixelRatio || 1, 2)
    const size = () => {
      w = cv.width = innerWidth * dpr
      h = cv.height = innerHeight * dpr
      const count = Math.min(90, Math.floor((innerWidth * innerHeight) / 18000))
      pts = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.18 * dpr,
        vy: (Math.random() - 0.5) * 0.18 * dpr,
      }))
    }
    size()
    addEventListener('resize', size)
    const draw = () => {
      ctx.clearRect(0, 0, w, h)
      for (const p of pts) {
        p.x += p.vx
        p.y += p.vy
        if (p.x < 0 || p.x > w) p.vx *= -1
        if (p.y < 0 || p.y > h) p.vy *= -1
      }
      const reach = 132 * dpr
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x
          const dy = pts[i].y - pts[j].y
          const d = Math.hypot(dx, dy)
          if (d > reach) continue
          ctx.strokeStyle = `rgba(212,175,90,${(1 - d / reach) * 0.16})`
          ctx.lineWidth = dpr
          ctx.beginPath()
          ctx.moveTo(pts[i].x, pts[i].y)
          ctx.lineTo(pts[j].x, pts[j].y)
          ctx.stroke()
        }
        ctx.fillStyle = 'rgba(212,175,90,.42)'
        ctx.beginPath()
        ctx.arc(pts[i].x, pts[i].y, 1.3 * dpr, 0, 7)
        ctx.fill()
      }
      requestAnimationFrame(draw)
    }
    draw()
  }

  /* ── واژهٔ چرخان در تیتر ──────────────────────────────────────── */
  const rot = $('.rotator')
  if (rot) {
    const words = ['بماند', 'کار کند', 'رشد کند', 'بفروشد']
    let wi = 0
    let ci = 0
    let del = false
    const tick = () => {
      const word = words[wi]
      ci += del ? -1 : 1
      rot.textContent = word.slice(0, ci)
      let wait = del ? 55 : 105
      if (!del && ci === word.length) {
        wait = 1900
        del = true
      } else if (del && ci === 0) {
        del = false
        wi = (wi + 1) % words.length
        wait = 320
      }
      setTimeout(tick, wait)
    }
    if (reduce) rot.textContent = words[0]
    else tick()
  }

  /* ── ویرایشگر قهرمان ─────────────────────────────────────────── */
  const heroCode = $('#hero-code')
  if (heroCode && C) {
    const heroTerm = $('#hero-term')
    const tabs = $$('.tab')
    let active = null
    const show = (i) => {
      tabs.forEach((t, k) => t.classList.toggle('on', k === i))
      if (active) active.stop()
      active = C.typer(heroCode, heroTerm, C.hero[i])
      if (reduce) active.full()
      else active.start(7)
    }
    tabs.forEach((t, i) => t.addEventListener('click', () => { auto = false; show(i) }))
    let auto = !reduce
    let idx = 0
    show(0)
    setInterval(() => {
      if (!auto) return
      idx = (idx + 1) % C.hero.length
      show(idx)
    }, 9000)
  }

  /* ── شمارنده‌ها ──────────────────────────────────────────────── */
  const countUp = (el) => {
    const to = Number(el.dataset.to)
    const suffix = el.dataset.suffix || ''
    if (reduce) { el.textContent = fa(to) + suffix; return }
    const t0 = performance.now()
    const dur = 1500
    const step = (t) => {
      const k = Math.min(1, (t - t0) / dur)
      const eased = 1 - Math.pow(1 - k, 3)
      el.textContent = fa(Math.round(to * eased)) + suffix
      if (k < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }
  const counters = $$('[data-to]')
  if ('IntersectionObserver' in window) {
    const cio = new IntersectionObserver(
      (es) => es.forEach((e) => { if (e.isIntersecting) { countUp(e.target); cio.unobserve(e.target) } }),
      { threshold: 0.4 },
    )
    counters.forEach((el) => cio.observe(el))
  } else counters.forEach(countUp)

  /* ── میله‌های رشد ─────────────────────────────────────────────── */
  const bars = $('#bars')
  if (bars) {
    const values = [34, 41, 38, 52, 61, 58, 70, 76, 84, 92, 97, 100]
    values.forEach((v) => {
      const i = document.createElement('i')
      i.dataset.h = v
      bars.append(i)
    })
    const grow = () =>
      $$('i', bars).forEach((el, k) =>
        setTimeout(() => { el.style.height = el.dataset.h + '%' }, reduce ? 0 : k * 70),
      )
    if ('IntersectionObserver' in window) {
      const bio = new IntersectionObserver(
        (es) => es.forEach((e) => { if (e.isIntersecting) { grow(); bio.disconnect() } }),
        { threshold: 0.3 },
      )
      bio.observe(bars)
    } else grow()
  }

  /* ── دیوار همکاران ───────────────────────────────────────────── */
  const crew = $('#crew')
  if (crew) {
    const roles = ['توسعه', 'هوش مصنوعی', 'داده', 'طراحی', 'محصول', 'پشتیبانی',
      'زیرساخت', 'محتوا', 'کسب‌وکار']
    const kit = (i) => {
      const hue = (i * 47) % 360
      const glass = i % 3 === 0
      const phones = i % 4 === 1
      const beard = i % 5 === 2
      const skin = ['#d8c39a', '#c8a97e', '#a97f57', '#e0cbaa', '#8d6247'][i % 5]
      const hair = ['#151d26', '#2b2119', '#3a2a1c', '#1b232c', '#4a3a2a'][(i * 3) % 5]
      return `<svg viewBox="0 0 64 64" aria-hidden="true">
        <defs><linearGradient id="g${i}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="hsl(${hue} 42% 26%)"/>
          <stop offset="1" stop-color="hsl(${(hue + 40) % 360} 38% 15%)"/>
        </linearGradient></defs>
        <rect width="64" height="64" fill="url(#g${i})"/>
        <circle cx="32" cy="26" r="11" fill="${skin}"/>
        <path d="M21 25a11 11 0 0 1 22 0v-3a11 11 0 0 0-22 0z" fill="${hair}"/>
        ${beard ? `<path d="M23 28a9 9 0 0 0 18 0v4a9 9 0 0 1-18 0z" fill="${hair}"/>` : ''}
        ${glass ? `<g fill="none" stroke="#d4af5a" stroke-width="1.5">
            <circle cx="27" cy="26" r="4"/><circle cx="37" cy="26" r="4"/>
            <path d="M31 26h2"/></g>` : ''}
        ${phones ? `<g fill="none" stroke="#7cb0ff" stroke-width="2.4" stroke-linecap="round">
            <path d="M20 27v-3a12 12 0 0 1 24 0v3"/><path d="M20 27v4"/><path d="M44 27v4"/></g>` : ''}
        <path d="M14 64c2-11 9-16 18-16s16 5 18 16z" fill="#111820"/>
        <rect x="26" y="52" width="12" height="8" rx="1.5" fill="#0b0f14" stroke="#2a3846"/>
        <path d="M29 55l2 1.6-2 1.6M32.5 58.4h3" stroke="#d4af5a" stroke-width="1" fill="none"
              stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`
    }
    const frag = document.createDocumentFragment()
    for (let i = 0; i < 37; i++) {
      const d = document.createElement('div')
      d.className = 'face-tile'
      d.innerHTML = kit(i) + `<em>${roles[i % roles.length]}</em>`
      frag.append(d)
    }
    crew.append(frag)
  }

  /* ── تختهٔ کد زنده ────────────────────────────────────────────── */
  const wall = $('#wall')
  if (wall && C) {
    const typers = new Map()

    C.wall.forEach((s, i) => {
      const el = document.createElement('article')
      el.className = 'slab'
      el.tabIndex = 0
      el.innerHTML = `
        <span class="glow"></span>
        <div class="face">
          <div class="idx">0${i + 1} — ${s.stack}</div>
          <h3></h3>
          <p></p>
          <div class="file"><em class="mono"></em><span class="hint">روی کارت بایستید تا نوشته شود</span></div>
        </div>
        <div class="pane">
          <div class="code mono"></div>
          <div class="term mono"></div>
        </div>`
      $('h3', el).textContent = s.title
      $('p', el).textContent = s.blurb
      $('em', el).textContent = s.file
      const t = C.typer($('.code', el), $('.term', el), s)
      // زیر reduced-motion هیچ تایپی رخ نمی‌دهد، پس کد از همان اول کامل است
      if (reduce) t.full()
      else t.reset()
      typers.set(el, t)

      const on = () => { if (reduce) t.full(); else t.start(8) }
      const off = () => t.reset()
      el.addEventListener('pointerenter', on)
      el.addEventListener('pointerleave', off)
      el.addEventListener('focus', on)
      el.addEventListener('blur', off)
      wall.append(el)
    })

    /* روی لمس، کارتی که وسط قاب می‌ایستد خودش زنده می‌شود */
    if (!fine && 'IntersectionObserver' in window) {
      const wio = new IntersectionObserver(
        (es) =>
          es.forEach((e) => {
            const t = typers.get(e.target)
            if (!t) return
            if (e.isIntersecting) {
              e.target.classList.add('live')
              t.start(8)
            } else {
              e.target.classList.remove('live')
              t.reset()
            }
          }),
        { root: wall, threshold: 0.75 },
      )
      $$('.slab', wall).forEach((el) => wio.observe(el))
    }

    /* کشیدن با ماوس */
    let down = false
    let sx = 0
    let sl = 0
    wall.addEventListener('pointerdown', (e) => {
      down = true
      sx = e.clientX
      sl = wall.scrollLeft
      wall.classList.add('dragging')
    })
    addEventListener('pointerup', () => {
      down = false
      wall.classList.remove('dragging')
    })
    wall.addEventListener('pointermove', (e) => {
      if (!down) return
      wall.scrollLeft = sl - (e.clientX - sx) * (document.dir === 'rtl' ? -1 : 1) * -1
    })

    const page = (dir) => {
      const card = $('.slab', wall)
      wall.scrollBy({ left: dir * (card.offsetWidth + 20), behavior: reduce ? 'auto' : 'smooth' })
    }
    $('#wall-prev').addEventListener('click', () => page(1))
    $('#wall-next').addEventListener('click', () => page(-1))

    const bar = $('#rail i')
    const railed = () => {
      const max = wall.scrollWidth - wall.clientWidth
      const k = max <= 0 ? 0 : Math.abs(wall.scrollLeft) / max
      bar.style.transform = `translateX(${(document.dir === 'rtl' ? -1 : 1) * k * (100 / 0.22 - 100)}%)`
    }
    wall.addEventListener('scroll', railed, { passive: true })
    railed()
  }
})()

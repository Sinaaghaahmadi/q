/* Asa — حرکت‌های کم‌شمار صفحهٔ معرفی */
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches

  // نوار بالا: خط زیرین فقط پس از اسکرول
  const nav = document.getElementById('nav')
  const onScroll = () => nav.classList.toggle('is-scrolled', scrollY > 12)
  addEventListener('scroll', onScroll, { passive: true })
  onScroll()

  // ورود تدریجی بخش‌ها
  const items = document.querySelectorAll('.reveal')
  if (reduce || !('IntersectionObserver' in window)) {
    items.forEach((el) => el.classList.add('in'))
    return
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e, i) => {
        if (!e.isIntersecting) return
        setTimeout(() => e.target.classList.add('in'), i * 70)
        io.unobserve(e.target)
      })
    },
    { rootMargin: '0px 0px -12% 0px', threshold: 0.12 },
  )
  items.forEach((el) => io.observe(el))
})()

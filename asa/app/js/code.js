/* Asa — موتور کد زنده: نمونه‌ها، رنگ‌آمیزی نحو، و تایپ.
 *
 * رنگ‌آمیزی با یک توکنایزرِ چسبان (sticky) انجام می‌شود، نه با
 * جای‌گزینیِ پی‌درپیِ regex — وگرنه یک کلیدواژه داخل رشته هم رنگ می‌گیرد.
 */
window.AsaCode = (() => {
  const RULES = {
    ts: [
      [/\/\/[^\n]*/y, 'c'],
      [/`[^`]*`|'[^']*'|"[^"]*"/y, 's'],
      [/\b(?:const|let|export|default|async|await|function|return|if|else|for|of|in|type|interface|import|from|new|class|extends|throw|try|catch|as|satisfies)\b/y, 'k'],
      [/\b\d+(?:\.\d+)?\b/y, 'n'],
      [/\b[A-Za-z_$][\w$]*(?=\()/y, 'f'],
      [/[{}()[\]<>.,;:=+\-*/|&?!]/y, 'p'],
    ],
    py: [
      [/#[^\n]*/y, 'c'],
      [/'''[\s\S]*?'''|'[^']*'|"[^"]*"/y, 's'],
      [/\b(?:def|return|import|from|as|for|in|if|elif|else|with|class|async|await|await|yield|not|and|or|None|True|False)\b/y, 'k'],
      [/\b\d+(?:\.\d+)?\b/y, 'n'],
      [/\b[A-Za-z_][\w]*(?=\()/y, 'f'],
      [/[{}()[\].,;:=+\-*/|&<>@]/y, 'p'],
    ],
    sql: [
      [/--[^\n]*/y, 'c'],
      [/'[^']*'/y, 's'],
      [/\b(?:select|from|where|group|order|by|join|left|inner|on|as|with|and|or|not|null|case|when|then|end|desc|asc|limit|sum|count|avg|date_trunc|coalesce)\b/iy, 'k'],
      [/\b\d+(?:\.\d+)?\b/y, 'n'],
      [/[(),.;*=<>|-]/y, 'p'],
    ],
    json: [
      [/"[^"]*"(?=\s*:)/y, 'f'],
      [/"[^"]*"/y, 's'],
      [/\b(?:true|false|null)\b/y, 'k'],
      [/\b\d+(?:\.\d+)?\b/y, 'n'],
      [/[{}[\],:]/y, 'p'],
    ],
  }

  const esc = (s) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  function highlight(text, lang) {
    const rules = RULES[lang] || RULES.ts
    let out = ''
    let i = 0
    while (i < text.length) {
      let hit = null
      for (const [re, cls] of rules) {
        re.lastIndex = i
        const m = re.exec(text)
        if (m && m.index === i && m[0]) {
          hit = [m[0], cls]
          break
        }
      }
      if (hit) {
        out += `<span class="${hit[1]}">${esc(hit[0])}</span>`
        i += hit[0].length
      } else {
        out += esc(text[i])
        i += 1
      }
    }
    return out
  }

  /** یک تایپِ قابل‌لغو: متن را کاراکتر به کاراکتر می‌نویسد، بعد ترمینال را. */
  function typer(codeEl, termEl, sample) {
    let raf = null
    let timer = null
    const lines = sample.code.split('\n')
    const gutter = lines.map((_, i) => String(i + 1).padStart(2, ' ')).join('\n')

    const paint = (n) => {
      codeEl.innerHTML =
        `<pre><span class="gutter">${gutter}</span><span class="src">` +
        highlight(sample.code.slice(0, n), sample.lang) +
        (n < sample.code.length ? '<span class="caret"></span>' : '') +
        '</span></pre>'
    }

    const runTerm = () => {
      if (!termEl) return
      termEl.innerHTML = ''
      sample.term.forEach((line, i) => {
        timer = setTimeout(() => {
          const d = document.createElement('div')
          d.className = line.startsWith('✓') ? 'ok' : 'dim'
          d.textContent = line
          termEl.append(d)
        }, 260 * (i + 1))
      })
    }

    return {
      start(speed = 9) {
        this.stop()
        let n = 0
        let last = performance.now()
        const step = (t) => {
          const due = Math.floor((t - last) / (1000 / 60))
          if (due) {
            last = t
            n = Math.min(sample.code.length, n + speed)
            paint(n)
          }
          if (n < sample.code.length) raf = requestAnimationFrame(step)
          else runTerm()
        }
        raf = requestAnimationFrame(step)
      },
      stop() {
        if (raf) cancelAnimationFrame(raf)
        if (timer) clearTimeout(timer)
        raf = timer = null
      },
      reset() {
        this.stop()
        paint(0)
        if (termEl) termEl.innerHTML = ''
      },
      full() {
        this.stop()
        paint(sample.code.length)
        runTerm()
      },
    }
  }

  /* ── نمونه‌ها ─────────────────────────────────────────────────── */
  const wall = [
    {
      key: 'product',
      title: 'محصول نرم‌افزاری',
      blurb: 'وب، اپ و PWA — از اولین طرح تا انتشار. سریع باز می‌شود، روان می‌ماند.',
      file: 'rate-board.tsx',
      lang: 'ts',
      stack: 'Next.js · TypeScript',
      code: `export function RateBoard({ pairs }: Props) {
  const live = useLiveRates(pairs, { every: 4_000 })

  return (
    <ol className="board">
      {live.map((row) => (
        <Row key={row.pair} data={row}
             trend={row.delta > 0 ? 'up' : 'down'} />
      ))}
    </ol>
  )
}`,
      term: ['✓ build passed in 812ms', '✓ 19 routes · 214 kB first load', 'deployed → production'],
    },
    {
      key: 'ai',
      title: 'هوش مصنوعی',
      blurb: 'دستیار، خودکارسازی و مدل‌هایی که واقعاً به کار می‌آیند — نه واژهٔ تبلیغاتی.',
      file: 'anomaly.py',
      lang: 'py',
      stack: 'Python · PyTorch',
      code: `def detect(series, window=48):
    """نوسان غیرعادی را پیش از کاربر می‌بیند."""
    base = rolling_median(series, window)
    spread = mad(series - base) * 1.4826

    for t, value in enumerate(series):
        z = (value - base[t]) / max(spread, 1e-9)
        if abs(z) > 3.5:
            yield Alert(t, value, severity=round(abs(z), 1))`,
      term: ['✓ 1,204 windows scored', '✓ precision 0.94 · recall 0.89', 'alert dispatched → 2 users'],
    },
    {
      key: 'data',
      title: 'داده و تحلیل',
      blurb: 'جمع‌آوری، پاک‌سازی و داشبوردهایی که به‌جای عدد، تصمیم می‌دهند.',
      file: 'cohorts.sql',
      lang: 'sql',
      stack: 'Postgres · dbt',
      code: `with monthly as (
  select date_trunc('month', placed_at) as m,
         count(*) as orders,
         sum(amount) as volume
  from orders
  where state = 'settled'
  group by 1
)
select m, orders, volume,
       volume / nullif(orders, 0) as avg_ticket
from monthly
order by m desc
limit 12;`,
      term: ['✓ 12 rows in 34ms', '✓ materialised → mart.monthly', 'dashboard refreshed'],
    },
    {
      key: 'brand',
      title: 'محتوا و برند',
      blurb: 'هویت بصری، تصویرسازی و تولید محتوا — با یک لحن واحد در همهٔ سطح‌ها.',
      file: 'tokens.ts',
      lang: 'ts',
      stack: 'Design tokens',
      code: `export const tokens = {
  gold: { 500: '#d4af5a', 300: '#f0d89b' },
  ink: { 900: '#06080b', 500: '#a8b6c4' },
  radius: [10, 16, 24, 32],
  motion: { ease: 'cubic-bezier(.22,.61,.36,1)' },
} as const

// یک منبع حقیقت: CSS، فیگما و اپ از همین‌جا رنگ می‌گیرند.
export const css = toCustomProperties(tokens)`,
      term: ['✓ 64 tokens → globals.css', '✓ figma library synced', 'contrast checked · AA'],
    },
    {
      key: 'okr',
      title: 'بیزنس‌پلن و OKR',
      blurb: 'مدل درآمدی و استقرار OKR — تا هدف از اتاق مدیریت به میز کار برسد.',
      file: 'okr.q3.json',
      lang: 'json',
      stack: 'OKR · سازمانی',
      code: `{
  "objective": "خدمت‌رسانی بی‌وقفه در فصل پرترافیک",
  "owner": "تیم زیرساخت",
  "keyResults": [
    { "kr": "دسترس‌پذیری", "from": 99.2, "to": 99.9, "unit": "%" },
    { "kr": "زمان پاسخ p95", "from": 840, "to": 300, "unit": "ms" },
    { "kr": "میانگین پاسخ تیکت", "from": 6, "to": 1, "unit": "h" }
  ],
  "checkIn": "هفتگی"
}`,
      term: ['✓ 3 key results · 1 owner', '✓ هفتهٔ ۴ از ۱۳', 'confidence 0.72'],
    },
    {
      key: 'venture',
      title: 'مشارکت در کسب‌وکار',
      blurb: 'گاهی به‌جای فاکتور، شریک می‌شویم — برای ایده‌هایی که به آن‌ها ایمان داریم.',
      file: 'split.ts',
      lang: 'ts',
      stack: 'مدل درآمدی',
      code: `export function split(revenue: number, terms: Terms) {
  const recovered = Math.min(revenue, terms.buildCost)
  const surplus = revenue - recovered

  return {
    toAsa: recovered * 0.5 + surplus * terms.share,
    toFounder: recovered * 0.5 + surplus * (1 - terms.share),
  }
}`,
      term: ['✓ modelled 36 months', '✓ break-even → month 11', 'terms drafted'],
    },
  ]

  const hero = [
    {
      tab: 'asa.ts',
      lang: 'ts',
      code: `const asa = {
  people: 37,
  continents: 4,
  belief: 'هوش مصنوعی، هر روز، در کار واقعی',
  goal: 'ایرانی آباد',
}

export async function build(idea: Idea) {
  const plan = await shape(idea)
  return ship(plan, { until: 'it stands on its own' })
}`,
      term: ['✓ 37 developers online', 'building → 6 disciplines'],
    },
    {
      tab: 'model.py',
      lang: 'py',
      code: `class Assistant:
    def __init__(self, tools):
        self.tools = tools

    async def run(self, task):
        plan = await self.think(task)
        for step in plan:
            yield await self.act(step)`,
      term: ['✓ 12 tools registered', 'agent ready'],
    },
    {
      tab: 'growth.sql',
      lang: 'sql',
      code: `select month,
       count(distinct project) as projects,
       sum(shipped) as releases
from delivery
where year = 2026
group by month
order by month;`,
      term: ['✓ 8 rows', 'chart refreshed'],
    },
  ]

  return { highlight, typer, wall, hero }
})()

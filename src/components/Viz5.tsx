import { useFullscreen } from '../hooks/useFullscreen'
import { useEffect, useRef, useState, useMemo } from 'react'
import * as d3 from 'd3'
import './Viz5.css'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CombinationRecord {
  year:         number
  manufacturer: string
  airline:      string
  origin:       string
  destination:  string
  incidents:    number
  fatalities:   number
}

interface NamedEntry {
  key?:     string   // manufacturers
  name?:    string   // airlines
  country?: string   // origins / destinations
  incidents: number
  fatalities: number
  years:     number
}

interface PoissonData {
  byManufacturer: (NamedEntry & { key: string; name: string })[]
  byAirline:      (NamedEntry & { name: string })[]
  byOrigin:       (NamedEntry & { country: string })[]
  byDestination:  (NamedEntry & { country: string })[]
  combinations:   CombinationRecord[]
  meta: { yearMin: number; yearMax: number; totalIncidents: number; totalFatalities: number }
}

interface YearRange { label: string; from: number; to: number }

// ---------------------------------------------------------------------------
// Poisson helpers
// ---------------------------------------------------------------------------

function poissonPMF(lambda: number, k: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0
  const logP = -lambda + k * Math.log(lambda) - logFactorial(k)
  return Math.exp(logP)
}

const _logFactCache: number[] = [0]
function logFactorial(n: number): number {
  for (let i = _logFactCache.length; i <= n; i++) {
    _logFactCache[i] = _logFactCache[i - 1] + Math.log(i)
  }
  return _logFactCache[n]
}

function kMax(lambda: number): number {
  if (lambda <= 0) return 6
  return Math.max(6, Math.ceil(lambda + 4 * Math.sqrt(lambda)) + 1)
}

// ---------------------------------------------------------------------------
// Year ranges
// ---------------------------------------------------------------------------

const YEAR_RANGES: YearRange[] = [
  { label: 'All time',    from: 1919, to: 2024 },
  { label: '2000–2024',   from: 2000, to: 2024 },
  { label: '1990–1999',   from: 1990, to: 1999 },
  { label: '1980–1989',   from: 1980, to: 1989 },
  { label: '1970–1979',   from: 1970, to: 1979 },
  { label: 'Before 1970', from: 1919, to: 1969 },
]

const ACCENT = '#a78bfa'

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const Viz5: React.FC = () => {
  const { ref: widgetRef, isFullscreen, toggle } = useFullscreen()
  const svgRef      = useRef<SVGSVGElement>(null)
  const tooltipRef  = useRef<HTMLDivElement>(null)
  const chartRef    = useRef<HTMLDivElement>(null)

  const [data,      setData]      = useState<PoissonData | null>(null)
  const [chartSize, setChartSize] = useState({ w: 0, h: 0 })

  // Filters
  const [manufacturer, setManufacturer] = useState('Any')
  const [airline,      setAirline]      = useState('Any')
  const [origin,       setOrigin]       = useState('Any')
  const [destination,  setDestination]  = useState('Any')
  const [yearRangeIdx, setYearRangeIdx] = useState(0)

  // Load data
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/crashes_for_poisson.json`)
      .then(r => r.json())
      .then((d: PoissonData) => setData(d))
  }, [])

  // ResizeObserver on chart div
  useEffect(() => {
    const el = chartRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      setChartSize({ w: Math.floor(width), h: Math.floor(height) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // ── Dropdown option lists derived from the loaded data ──────────────────
  const mfrOptions = useMemo(() => {
    if (!data) return []
    return data.byManufacturer.map(m => m.name)
  }, [data])

  const airlineOptions = useMemo(() => {
    if (!data) return []
    return data.byAirline.map(a => a.name)
  }, [data])

  const originOptions = useMemo(() => {
    if (!data) return []
    return data.byOrigin.map(o => o.country)
  }, [data])

  const destOptions = useMemo(() => {
    if (!data) return []
    return data.byDestination.map(d => d.country)
  }, [data])

  // ── Filter combinations → compute λ ─────────────────────────────────────
  const { lambda, totalIncidents, yearsInRange } = useMemo(() => {
    if (!data) return { lambda: 0, totalIncidents: 0, yearsInRange: 1 }

    const range = YEAR_RANGES[yearRangeIdx]
    const years = range.to - range.from + 1

    // Resolve display name → key for manufacturer
    const mfrKey = manufacturer !== 'Any'
      ? data.byManufacturer.find(m => m.name === manufacturer)?.key ?? null
      : null

    const total = data.combinations.reduce((sum, c) => {
      if (c.year < range.from || c.year > range.to) return sum
      if (mfrKey       && c.manufacturer !== mfrKey)   return sum
      if (airline !== 'Any' && c.airline !== airline)  return sum
      if (origin  !== 'Any' && c.origin  !== origin)   return sum
      if (destination !== 'Any' && c.destination !== destination) return sum
      return sum + c.incidents
    }, 0)

    return {
      lambda:         total / Math.max(years, 1),
      totalIncidents: total,
      yearsInRange:   years,
    }
  }, [data, yearRangeIdx, manufacturer, airline, origin, destination])

  // ── D3 chart ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!svgRef.current || !chartRef.current) return
    const { w: totalWidth, h: totalHeight } = chartSize
    if (totalWidth <= 0 || totalHeight <= 0) return

    const margin = { top: 18, right: 20, bottom: 46, left: 54 }
    const width  = totalWidth  - margin.left - margin.right
    const height = totalHeight - margin.top  - margin.bottom
    if (width <= 0 || height <= 0) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()
    svg.attr('width', totalWidth).attr('height', totalHeight)

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

    const km      = kMax(lambda)
    const kValues = d3.range(0, km + 1)
    const pmfData = kValues.map(k => ({ k, p: poissonPMF(lambda, k) }))

    const xScale = d3.scaleBand()
      .domain(kValues.map(String))
      .range([0, width])
      .padding(kValues.length > 30 ? 0.08 : 0.15)

    const maxP = d3.max(pmfData, d => d.p) ?? 0.01
    const yScale = d3.scaleLinear()
      .domain([0, maxP * 1.18])
      .range([height, 0])
      .nice()

    // Grid
    g.append('g')
      .selectAll('line')
      .data(yScale.ticks(5))
      .join('line')
      .attr('x1', 0).attr('x2', width)
      .attr('y1', (d: number) => yScale(d))
      .attr('y2', (d: number) => yScale(d))
      .attr('stroke', 'var(--border)')
      .attr('stroke-dasharray', '3,3')
      .attr('stroke-width', 0.8)

    // Smooth area + line overlay
    if (lambda > 0 && kValues.length > 1) {
      const steps = 300
      const step  = km / steps
      const curvePoints: Array<{ x: number; p: number }> = []
      const bw = xScale.bandwidth()
      for (let i = 0; i <= steps; i++) {
        const kf     = i * step
        const kFloor = Math.floor(kf)
        const kCeil  = Math.min(Math.ceil(kf), km)
        const t      = kf - kFloor
        const p      = poissonPMF(lambda, kFloor) * (1 - t) + poissonPMF(lambda, kCeil) * t
        const xPos   = (xScale(String(kFloor)) ?? 0) + bw * (0.5 + t)
        curvePoints.push({ x: xPos, p })
      }

      const defs = svg.append('defs')
      defs.append('linearGradient')
        .attr('id', 'viz5-grad')
        .attr('x1', '0').attr('y1', '0').attr('x2', '0').attr('y2', '1')
        .selectAll('stop')
        .data([
          { offset: '0%',   opacity: 0.26 },
          { offset: '100%', opacity: 0.02 },
        ])
        .join('stop')
        .attr('offset',       d => d.offset)
        .attr('stop-color',   ACCENT)
        .attr('stop-opacity', d => d.opacity)

      const area = d3.area<{ x: number; p: number }>()
        .x(d => d.x).y0(height).y1(d => yScale(d.p))
        .curve(d3.curveCatmullRom.alpha(0.5))

      const line = d3.line<{ x: number; p: number }>()
        .x(d => d.x).y(d => yScale(d.p))
        .curve(d3.curveCatmullRom.alpha(0.5))

      g.append('path').datum(curvePoints)
        .attr('d', area)
        .attr('fill', 'url(#viz5-grad)')

      g.append('path').datum(curvePoints)
        .attr('d', line)
        .attr('fill', 'none')
        .attr('stroke', ACCENT)
        .attr('stroke-width', 2)
        .attr('opacity', 0.7)
    }

    // Bars
    type BarD = { k: number; p: number }
    g.selectAll('.viz5-bar')
      .data(pmfData)
      .join('rect')
      .attr('class', 'viz5-bar')
      .attr('x',      (d: BarD) => xScale(String(d.k)) ?? 0)
      .attr('y',      (d: BarD) => yScale(d.p))
      .attr('width',  xScale.bandwidth())
      .attr('height', (d: BarD) => Math.max(0, height - yScale(d.p)))
      .attr('fill',   ACCENT)
      .attr('rx',     2)
      .attr('opacity', 0.42)
      .on('mouseover', (event: MouseEvent, d: BarD) => {
        d3.select(event.currentTarget as SVGRectElement).attr('opacity', 0.72)
        const tooltip = tooltipRef.current
        if (!tooltip || !chartRef.current) return
        tooltip.innerHTML = `
          <div class="viz5-tt-k">k = ${d.k} crash${d.k !== 1 ? 'es' : ''} / yr</div>
          <div class="viz5-tt-row">P(X = ${d.k}) = <b>${(d.p * 100).toFixed(3)}%</b></div>
          <div class="viz5-tt-row">λ = ${lambda.toFixed(3)}</div>
        `
        tooltip.style.display = 'block'
        const rect = chartRef.current.getBoundingClientRect()
        const ex = event.clientX - rect.left
        const ey = event.clientY - rect.top
        tooltip.style.left = `${Math.min(ex + 14, totalWidth - 220)}px`
        tooltip.style.top  = `${Math.max(ey - 70, 4)}px`
      })
      .on('mousemove', (event: MouseEvent) => {
        const tooltip = tooltipRef.current
        if (!tooltip || !chartRef.current) return
        const rect = chartRef.current.getBoundingClientRect()
        tooltip.style.left = `${Math.min(event.clientX - rect.left + 14, totalWidth - 220)}px`
        tooltip.style.top  = `${Math.max(event.clientY - rect.top - 70, 4)}px`
      })
      .on('mouseout', (event: MouseEvent) => {
        d3.select(event.currentTarget as SVGRectElement).attr('opacity', 0.42)
        if (tooltipRef.current) tooltipRef.current.style.display = 'none'
      })

    // λ mean line
    if (lambda > 0) {
      const lambdaXBand = xScale(String(Math.round(lambda)))
      if (lambdaXBand !== undefined) {
        const lambdaX = lambdaXBand + xScale.bandwidth() / 2
        g.append('line')
          .attr('x1', lambdaX).attr('x2', lambdaX)
          .attr('y1', 0).attr('y2', height)
          .attr('stroke', ACCENT)
          .attr('stroke-width', 1.5)
          .attr('stroke-dasharray', '4,3')
          .attr('opacity', 0.9)
        g.append('text')
          .attr('x', lambdaX + 5)
          .attr('y', 12)
          .attr('fill', ACCENT)
          .attr('font-size', '10px')
          .attr('font-family', 'var(--mono)')
          .text(`λ = ${lambda.toFixed(2)}`)
      }
    }

    // X axis
    const tickEvery = kValues.length > 40 ? 10 : kValues.length > 20 ? 5 : kValues.length > 10 ? 2 : 1
    const xG = g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(
        d3.axisBottom(xScale)
          .tickValues(kValues.filter((_: number, i: number) => i % tickEvery === 0).map(String))
          .tickSize(3)
      )
    xG.select('.domain').attr('stroke', 'var(--border)')
    xG.selectAll('line').attr('stroke', 'var(--border)')
    xG.selectAll('text').attr('fill', 'var(--text-muted)').attr('font-size', '10px').attr('dy', '1.2em')

    g.append('text')
      .attr('x', width / 2)
      .attr('y', height + 42)
      .attr('text-anchor', 'middle')
      .attr('fill', 'var(--text-muted)')
      .attr('font-size', '11px')
      .attr('font-family', 'var(--sans)')
      .text('Number of crashes per year (k)')

    // Y axis
    const yG = g.append('g').call(
      d3.axisLeft(yScale).ticks(5).tickSize(3)
        .tickFormat(d => `${((d as number) * 100).toFixed(1)}%`)
    )
    yG.select('.domain').attr('stroke', 'var(--border)')
    yG.selectAll('line').attr('stroke', 'var(--border)')
    yG.selectAll('text').attr('fill', 'var(--text-muted)').attr('font-size', '10px')

    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -height / 2)
      .attr('y', -46)
      .attr('text-anchor', 'middle')
      .attr('fill', 'var(--text-muted)')
      .attr('font-size', '11px')
      .attr('font-family', 'var(--sans)')
      .text('Probability')

  }, [lambda, chartSize])

  // ── Derived stats ─────────────────────────────────────────────────────────
  const p0     = poissonPMF(lambda, 0)
  const modeK  = lambda <= 0 ? 0 : Math.max(0, Math.floor(lambda))
  const modeP  = poissonPMF(lambda, modeK)
  const p1plus = 1 - p0

  return (
    <div className="section" id="section5">
      <div className="viz-container">
        <div className="paragraph">
          <p className="section-badge">/ Visualization 05</p>
          <h1 className="viz-title">Modelling your flight's crash risk</h1>
          <p>
            We can model crashes as a Poisson process: given the empirical mean
            number of incidents per year (λ) for a filtered subset of the data,
            the chart shows the full probability distribution over the number of
            crashes in any given year. Narrow the dataset by manufacturer, airline,
            origin or destination country, and time period — the distribution
            updates instantly.
          </p>
        </div>

        <div className="widget" ref={widgetRef}>
          {/* Fullscreen button */}
          <button className="fullscreen-btn" aria-label="Toggle Fullscreen" onClick={toggle}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              {isFullscreen ? <>
                <path d="M8 3v3a2 2 0 0 1-2 2H3"/>
                <path d="M21 8h-3a2 2 0 0 1-2-2V3"/>
                <path d="M3 16h3a2 2 0 0 1 2 2v3"/>
                <path d="M16 21v-3a2 2 0 0 1 2-2h3"/>
              </> : <>
                <path d="M8 3H5a2 2 0 0 0-2 2v3"/>
                <path d="M21 8V5a2 2 0 0 0-2-2h-3"/>
                <path d="M3 16v3a2 2 0 0 0 2 2h3"/>
                <path d="M16 21h3a2 2 0 0 0 2-2v-3"/>
              </>}
            </svg>
          </button>

          <div className="viz5-inner">
            {/* ── Controls ── */}
            <div className="viz5-controls">

              <span className="viz5-ctrl-label">Manufacturer</span>
              <select
                className="viz5-ctrl-select"
                value={manufacturer}
                onChange={e => setManufacturer(e.target.value)}
              >
                <option value="Any">Any</option>
                {mfrOptions.map(m => <option key={m} value={m}>{m}</option>)}
              </select>

              <span className="viz5-ctrl-label">Airline</span>
              <select
                className="viz5-ctrl-select"
                value={airline}
                onChange={e => setAirline(e.target.value)}
              >
                <option value="Any">Any</option>
                {airlineOptions.map(a => <option key={a} value={a}>{a}</option>)}
              </select>

              <div className="viz5-ctrl-sep" />

              <span className="viz5-ctrl-label">Origin</span>
              <select
                className="viz5-ctrl-select"
                value={origin}
                onChange={e => setOrigin(e.target.value)}
              >
                <option value="Any">Any</option>
                {originOptions.map(o => <option key={o} value={o}>{o}</option>)}
              </select>

              <span className="viz5-ctrl-label">Dest.</span>
              <select
                className="viz5-ctrl-select"
                value={destination}
                onChange={e => setDestination(e.target.value)}
              >
                <option value="Any">Any</option>
                {destOptions.map(d => <option key={d} value={d}>{d}</option>)}
              </select>

              <div className="viz5-ctrl-sep" />

              <select
                className="viz5-ctrl-select"
                value={yearRangeIdx}
                onChange={e => setYearRangeIdx(Number(e.target.value))}
              >
                {YEAR_RANGES.map((r, i) => (
                  <option key={r.label} value={i}>{r.label}</option>
                ))}
              </select>

              {/* Stats strip */}
              <div className="viz5-stats">
                <div className="viz5-stat-item">
                  <span className="viz5-stat-label">λ / yr</span>
                  <span className="viz5-stat-value">{lambda.toFixed(2)}</span>
                </div>
                <div className="viz5-stat-item">
                  <span className="viz5-stat-label">Incidents</span>
                  <span className="viz5-stat-value">{totalIncidents}</span>
                </div>
                <div className="viz5-stat-item">
                  <span className="viz5-stat-label">P(0 crashes)</span>
                  <span className="viz5-stat-value">{(p0 * 100).toFixed(1)}%</span>
                </div>
                <div className="viz5-stat-item">
                  <span className="viz5-stat-label">P(≥1 crash)</span>
                  <span className="viz5-stat-value">{(p1plus * 100).toFixed(1)}%</span>
                </div>
                <div className="viz5-stat-item">
                  <span className="viz5-stat-label">Mode k</span>
                  <span className="viz5-stat-value">{modeK} ({(modeP * 100).toFixed(1)}%)</span>
                </div>
              </div>
            </div>

            {/* ── Chart ── */}
            <div className="viz5-chart" ref={chartRef}>
              <svg ref={svgRef} style={{ display: 'block' }} />
              {totalIncidents === 0 && data && (
                <div className="viz5-empty">No data matches the current filters.</div>
              )}
              {!data && (
                <div className="viz5-empty">Loading…</div>
              )}
              <div ref={tooltipRef} className="viz5-tooltip" style={{ display: 'none' }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Viz5

import { useFullscreen } from '../hooks/useFullscreen'
import { useEffect, useRef, useState, useMemo } from 'react'
import * as d3 from 'd3'
import './viz6.css'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CombinationRecord {
  decade:       string
  manufacturer: string
  airline:      string
  departure:    string
  arrival:      string
  incidents:    number
  fatalities:   number
}

interface PoissonData {
  manufacturers: string[]
  airlines:      string[]
  departures:    string[]
  arrivals:      string[]
  decades:       string[]
  combinations:  CombinationRecord[]
  meta: { yearMin: number; yearMax: number; totalIncidents: number; totalFatalities: number }
}

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

const ACCENT = '#a78bfa'

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const viz6: React.FC = () => {
  const { ref: widgetRef, isFullscreen, toggle } = useFullscreen()
  const svgRef     = useRef<SVGSVGElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const chartRef   = useRef<HTMLDivElement>(null)

  const [data,      setData]      = useState<PoissonData | null>(null)
  const [chartSize, setChartSize] = useState({ w: 0, h: 0 })

  // Filters
  const [manufacturer, setManufacturer] = useState('Any')
  // const [airline,      setAirline]      = useState('Any')
  const [departure,    setDeparture]    = useState('Any')
  const [arrival,      setArrival]      = useState('Any')
  const [decadeFrom,   setDecadeFrom]   = useState('Any')
  const [decadeTo,     setDecadeTo]     = useState('Any')

  // Load data
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/crashes_for_poisson.json`)
      .then(r => r.json())
      .then((d: PoissonData) => {
        setData(d)
        // Default decade range to full span
        if (d.decades.length) {
          setDecadeFrom(d.decades[0])
          setDecadeTo(d.decades[d.decades.length - 1])
        }
      })
  }, [])

  // ResizeObserver
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

  // ── Filter combinations → compute λ ─────────────────────────────────────
  const { lambda, totalIncidents} = useMemo(() => {
    if (!data) return { lambda: 0, totalIncidents: 0, decadesInRange: 1 }

    // Build decade range
    const allDecades = data.decades
    const fromIdx = decadeFrom === 'Any' ? 0 : allDecades.indexOf(decadeFrom)
    const toIdx   = decadeTo   === 'Any' ? allDecades.length - 1 : allDecades.indexOf(decadeTo)
    const validDecades = new Set(
      allDecades.slice(
        Math.max(0, fromIdx),
        Math.min(allDecades.length - 1, toIdx) + 1
      )
    )
    const numDecades = validDecades.size

    const total = data.combinations.reduce((sum, c) => {
      if (!validDecades.has(c.decade))                              return sum
      if (manufacturer !== 'Any' && c.manufacturer !== manufacturer) return sum
      if (departure    !== 'Any' && c.departure    !== departure)     return sum
      if (arrival      !== 'Any' && c.arrival      !== arrival)       return sum
      return sum + c.incidents
    }, 0)

    // λ = incidents per year (each decade = 10 years)
    const totalYears = numDecades * 10
    return {
      lambda:         total / Math.max(totalYears, 1),
      totalIncidents: total,
      decadesInRange: numDecades,
    }
  }, [data, decadeFrom, decadeTo, manufacturer, departure, arrival])

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

    // Smooth area + line
    if (lambda > 0 && kValues.length > 1) {
      const steps = 300
      const bw    = xScale.bandwidth()
      const curvePoints: Array<{ x: number; p: number }> = []
      for (let i = 0; i <= steps; i++) {
        const kf     = i * km / steps
        const kFloor = Math.floor(kf)
        const kCeil  = Math.min(Math.ceil(kf), km)
        const t      = kf - kFloor
        const p      = poissonPMF(lambda, kFloor) * (1 - t) + poissonPMF(lambda, kCeil) * t
        const xPos   = (xScale(String(kFloor)) ?? 0) + bw * (0.5 + t)
        curvePoints.push({ x: xPos, p })
      }

      svg.select('defs').remove()
      const defs = svg.append('defs')
      defs.append('linearGradient')
        .attr('id', 'viz6-grad')
        .attr('x1', '0').attr('y1', '0').attr('x2', '0').attr('y2', '1')
        .selectAll('stop')
        .data([{ offset: '0%', opacity: 0.26 }, { offset: '100%', opacity: 0.02 }])
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
        .attr('d', area).attr('fill', 'url(#viz6-grad)')
      g.append('path').datum(curvePoints)
        .attr('d', line).attr('fill', 'none')
        .attr('stroke', ACCENT).attr('stroke-width', 2).attr('opacity', 0.7)
    }

    // Bars
    type BarD = { k: number; p: number }
    g.selectAll('.viz6-bar')
      .data(pmfData)
      .join('rect')
      .attr('class', 'viz6-bar')
      .attr('x',      (d: BarD) => xScale(String(d.k)) ?? 0)
      .attr('y',      (d: BarD) => yScale(d.p))
      .attr('width',  xScale.bandwidth())
      .attr('height', (d: BarD) => Math.max(0, height - yScale(d.p)))
      .attr('fill',   ACCENT).attr('rx', 2).attr('opacity', 0.42)
      .on('mouseover', (event: MouseEvent, d: BarD) => {
        d3.select(event.currentTarget as SVGRectElement).attr('opacity', 0.72)
        const tooltip = tooltipRef.current
        if (!tooltip || !chartRef.current) return
        tooltip.innerHTML = `
          <div class="viz6-tt-k">k = ${d.k} crash${d.k !== 1 ? 'es' : ''} / yr</div>
          <div class="viz6-tt-row">P(X = ${d.k}) = <b>${(d.p * 100).toFixed(3)}%</b></div>
        `
        tooltip.style.display = 'block'
        const rect = chartRef.current.getBoundingClientRect()
        tooltip.style.left = `${Math.min(event.clientX - rect.left + 14, totalWidth - 220)}px`
        tooltip.style.top  = `${Math.max(event.clientY - rect.top  - 70, 4)}px`
      })
      .on('mousemove', (event: MouseEvent) => {
        const tooltip = tooltipRef.current
        if (!tooltip || !chartRef.current) return
        const rect = chartRef.current.getBoundingClientRect()
        tooltip.style.left = `${Math.min(event.clientX - rect.left + 14, totalWidth - 220)}px`
        tooltip.style.top  = `${Math.max(event.clientY - rect.top  - 70, 4)}px`
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
          .attr('x1', lambdaX).attr('x2', lambdaX).attr('y1', 0).attr('y2', height)
          .attr('stroke', ACCENT).attr('stroke-width', 1.5)
          .attr('stroke-dasharray', '4,3').attr('opacity', 0.9)
        g.append('text')
          .attr('x', lambdaX + 5).attr('y', 12)
          .attr('fill', ACCENT).attr('font-size', '10px').attr('font-family', 'var(--mono)')
          .text(`λ = ${lambda.toFixed(2)}`)
      }
    }

    // X axis
    const tickEvery = kValues.length > 40 ? 10 : kValues.length > 20 ? 5 : kValues.length > 10 ? 2 : 1
    const xG = g.append('g').attr('transform', `translate(0,${height})`)
      .call(
        d3.axisBottom(xScale)
          .tickValues(kValues.filter((_: number, i: number) => i % tickEvery === 0).map(String))
          .tickSize(3)
      )
    xG.select('.domain').attr('stroke', 'var(--border)')
    xG.selectAll('line').attr('stroke', 'var(--border)')
    xG.selectAll('text').attr('fill', 'var(--text-muted)').attr('font-size', '10px').attr('dy', '1.2em')
    g.append('text')
      .attr('x', width / 2).attr('y', height + 42).attr('text-anchor', 'middle')
      .attr('fill', 'var(--text-muted)').attr('font-size', '11px').attr('font-family', 'var(--sans)')
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
      .attr('transform', 'rotate(-90)').attr('x', -height / 2).attr('y', -46)
      .attr('text-anchor', 'middle').attr('fill', 'var(--text-muted)')
      .attr('font-size', '11px').attr('font-family', 'var(--sans)').text('Probability')

  }, [lambda, chartSize])

  // Derived stats
  const p0    = poissonPMF(lambda, 0)

  // Valid decade range for the "To" selector (must be ≥ decadeFrom)
  const decadeFromOptions = data?.decades ?? []
  const decadeToOptions   = data
    ? data.decades.filter(d => decadeFrom === 'Any' || d >= decadeFrom)
    : []

  return (
    <div className="section" id="section6">
      <div className="viz-container">
        <div className="widget" ref={widgetRef}>
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

          <div className="viz6-inner">
            {/* ── Controls ── */}
            <div className="viz6-controls">

              <span className="viz6-ctrl-label">Mfr.</span>
              <select className="viz6-ctrl-select" value={manufacturer} onChange={e => setManufacturer(e.target.value)}>
                <option value="Any">Any</option>
                {data?.manufacturers.map(m => <option key={m} value={m}>{m}</option>)}
              </select>

              <div className="viz6-ctrl-sep" />

              <span className="viz6-ctrl-label">Dep.</span>
              <select className="viz6-ctrl-select" value={departure} onChange={e => setDeparture(e.target.value)}>
                <option value="Any">Any</option>
                {data?.departures.map(d => <option key={d} value={d}>{d}</option>)}
              </select>

              <span className="viz6-ctrl-label">Arr.</span>
              <select className="viz6-ctrl-select" value={arrival} onChange={e => setArrival(e.target.value)}>
                <option value="Any">Any</option>
                {data?.arrivals.map(a => <option key={a} value={a}>{a}</option>)}
              </select>

              <div className="viz6-ctrl-sep" />

              <select
                className="viz6-ctrl-select"
                value={decadeFrom}
                onChange={e => {
                  setDecadeFrom(e.target.value)
                  // ensure decadeTo stays ≥ decadeFrom
                  if (decadeTo !== 'Any' && e.target.value !== 'Any' && decadeTo < e.target.value)
                    setDecadeTo(e.target.value)
                }}
              >
                <option value="Any">Any decade</option>
                {decadeFromOptions.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <span className="viz6-ctrl-sep-dash">–</span>
              <select
                className="viz6-ctrl-select"
                value={decadeTo}
                onChange={e => setDecadeTo(e.target.value)}
              >
                <option value="Any">Any decade</option>
                {decadeToOptions.map(d => <option key={d} value={d}>{d}</option>)}
              </select>

              {/* Stats */}
              <div className="viz6-stats">
                <div className="viz6-stat-item">
                  <span className="viz6-stat-label">Incidents</span>
                  <span className="viz6-stat-value">{totalIncidents}</span>
                </div>
                <div className="viz6-stat-item">
                  <span className="viz6-stat-label">P(0)</span>
                  <span className="viz6-stat-value">{(p0 * 100).toFixed(1)}%</span>
                </div>
                <div className="viz6-stat-item">
                  <span className="viz6-stat-label">P(≥1)</span>
                  <span className="viz6-stat-value">{((1 - p0) * 100).toFixed(1)}%</span>
                </div>
              </div>
            </div>

            {/* ── Chart ── */}
            <div className="viz6-chart" ref={chartRef}>
              <svg ref={svgRef} style={{ display: 'block' }} />
              {totalIncidents === 0 && data && (
                <div className="viz6-empty">No data matches the current filters.</div>
              )}
              {!data && <div className="viz6-empty">Loading…</div>}
              <div ref={tooltipRef} className="viz6-tooltip" style={{ display: 'none' }} />
            </div>
          </div>
        </div>

        <div className="paragraph">
          <p className="section-badge">/ Visualization 06</p>
          <h1 className="viz-title">Modelling your flight's crash risk</h1>
          <p>
            Using a Poisson process, we model crashes as a rate λ — the mean
            number of incidents per year for a filtered subset of the data.
            The chart shows the full probability distribution P(X = k): the
            chance of exactly k crashes occurring in any given year. Filter by
            manufacturer, airline, departure city, arrival city, and decade range.
          </p>
        </div>
      </div>
    </div>
  )
}

export default viz6

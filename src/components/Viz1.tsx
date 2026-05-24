import { useFullscreen } from '../hooks/useFullscreen'
import { useEffect, useRef, useState, useCallback } from 'react'
import * as d3 from 'd3'
import './Viz1.css'

type Metric = 'incidents' | 'fatalities'

interface DataPoint {
  year: number
  key: string
  name: string
  incidents: number
  fatalities: number
}

const MFR_COLORS: Record<string, string> = {
  boeing:     '#a78bfa',
  airbus:     '#22d3ee',
  douglas:    '#fb923c',
  lockheed:   '#f87171',
  de:         '#4ade80',
  antonov:    '#facc15',
  ilyushin:   '#60a5fa',
  fokker:     '#f472b6',
  mcdonnell:  '#a3e635',
  tupolev:    '#fb7185',
  convair:    '#c084fc',
  embraer:    '#34d399',
  cessna:     '#fbbf24',
  bell:       '#38bdf8',
  atr:        '#e879f9',
  beechcraft: '#f9a8d4',
  yakovlev:   '#86efac',
  avro:       '#fde68a',
  sikorsky:   '#93c5fd',
  let:        '#fca5a5',
}

const ALL_MANUFACTURERS = [
  { key: 'boeing',     name: 'Boeing' },
  { key: 'airbus',     name: 'Airbus' },
  { key: 'douglas',    name: 'Douglas' },
  { key: 'lockheed',   name: 'Lockheed' },
  { key: 'mcdonnell',  name: 'McDonnell Douglas' },
  { key: 'fokker',     name: 'Fokker' },
  { key: 'antonov',    name: 'Antonov' },
  { key: 'tupolev',    name: 'Tupolev' },
  { key: 'ilyushin',   name: 'Ilyushin' },
  { key: 'convair',    name: 'Convair' },
  { key: 'embraer',    name: 'Embraer' },
  { key: 'cessna',     name: 'Cessna' },
  { key: 'atr',        name: 'ATR' },
  { key: 'bell',       name: 'Bell' },
  { key: 'de',         name: 'De Havilland' },
  { key: 'beechcraft', name: 'Beechcraft' },
  { key: 'yakovlev',   name: 'Yakovlev' },
  { key: 'avro',       name: 'Avro' },
  { key: 'sikorsky',   name: 'Sikorsky' },
  { key: 'let',        name: 'LET' },
]

const YEAR_MIN = 1919
const YEAR_MAX = 2024

const Viz1: React.FC = () => {
  const { ref: widgetRef, isFullscreen, toggle } = useFullscreen()
  const svgRef = useRef<SVGSVGElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<HTMLDivElement>(null)
  const [data, setData] = useState<DataPoint[]>([])
  const [selectedMfrs, setSelectedMfrs] = useState<string[]>(['boeing', 'airbus'])
  const [metric, setMetric] = useState<Metric>('incidents')
  const [yearFrom, setYearFrom] = useState(2010)
  const [yearTo, setYearTo] = useState(2024)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [chartSize, setChartSize] = useState({ w: 0, h: 0 })

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/crashes_by_manufacturer.json`)
      .then(r => r.json())
      .then(setData)
  }, [])

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

  const toggleMfr = useCallback((key: string) => {
    setSelectedMfrs(prev =>
      prev.includes(key)
        ? prev.length > 1 ? prev.filter(m => m !== key) : prev
        : [...prev, key]
    )
  }, [])

  useEffect(() => {
    if (!dropdownOpen) return
    const handle = (e: MouseEvent) => {
      if (!(e.target as Element).closest('.viz1-mfr-dropdown')) setDropdownOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [dropdownOpen])

  useEffect(() => {
if (!data.length || !svgRef.current || !chartRef.current) return
    const { w: totalWidth, h: totalHeight } = chartSize
    if (totalWidth <= 0 || totalHeight <= 0) return

    const numYears = yearTo - yearFrom + 1
    const rotateLabels = numYears > 15
    const margin = { top: 14, right: 16, bottom: rotateLabels ? 52 : 36, left: 38 }
    const width = totalWidth - margin.left - margin.right
    const height = totalHeight - margin.top - margin.bottom
    if (width <= 0 || height <= 0) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()
    svg.attr('width', totalWidth).attr('height', totalHeight)

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

    const years = d3.range(yearFrom, yearTo + 1)
    const filtered = data.filter(d =>
      selectedMfrs.includes(d.key) && d.year >= yearFrom && d.year <= yearTo
    )

    const lookup = new Map<number, Map<string, DataPoint>>()
    for (const d of filtered) {
      if (!lookup.has(d.year)) lookup.set(d.year, new Map())
      lookup.get(d.year)!.set(d.key, d)
    }

    const x0 = d3.scaleBand()
      .domain(years.map(String))
      .range([0, width])
      .padding(0.22)

    const x1 = d3.scaleBand()
      .domain(selectedMfrs)
      .range([0, x0.bandwidth()])
      .padding(0.06)

    type BarDatum = { mfr: string; yr: number; value: number }

    const maxVal = d3.max(filtered, (d: DataPoint) => d[metric]) ?? 0
    const yScale = d3.scaleLinear()
      .domain([0, Math.max(maxVal * 1.15, 1)])
      .range([height, 0])
      .nice()

    // Horizontal grid lines
    g.append('g')
      .selectAll('line')
      .data(yScale.ticks(5))
      .join('line')
      .attr('x1', 0).attr('x2', width)
      .attr('y1', (d: number) => yScale(d)).attr('y2', (d: number) => yScale(d))
      .attr('stroke', 'var(--border)')
      .attr('stroke-dasharray', '3,3')
      .attr('stroke-width', 0.8)

    // Bars
    g.selectAll('.yr-grp')
      .data(years)
      .join('g')
      .attr('transform', (yr: number) => `translate(${x0(String(yr))},0)`)
      .selectAll('rect')
      .data((yr: number) => selectedMfrs.map(mfr => ({
        mfr, yr,
        value: lookup.get(yr)?.get(mfr)?.[metric] ?? 0,
      })))
      .join('rect')
      .attr('x', (d: BarDatum) => x1(d.mfr) ?? 0)
      .attr('y', (d: BarDatum) => yScale(d.value))
      .attr('width', x1.bandwidth())
      .attr('height', (d: BarDatum) => Math.max(0, height - yScale(d.value)))
      .attr('fill', (d: BarDatum) => MFR_COLORS[d.mfr] ?? '#888')
      .attr('rx', 2)
      .attr('opacity', 0.82)
      .on('mouseover', (event: MouseEvent, d: BarDatum) => {
        d3.select(event.currentTarget as SVGRectElement).attr('opacity', 1)
        const tooltip = tooltipRef.current
        if (!tooltip || !chartRef.current) return
        const yearData = lookup.get(d.yr)
        const lines = selectedMfrs.map(mfr => {
          const dp = yearData?.get(mfr)
          const mfrName = ALL_MANUFACTURERS.find(m => m.key === mfr)?.name ?? mfr
          return `<span style="color:${MFR_COLORS[mfr]}">■</span>&nbsp;<b>${mfrName}</b>: ${dp?.incidents ?? 0} incidents, ${dp?.fatalities ?? 0} fatalities`
        }).join('<br/>')
        tooltip.innerHTML = `<div class="viz1-tt-year">${d.yr}</div>${lines}`
        tooltip.style.display = 'block'
        const rect = chartRef.current.getBoundingClientRect()
        const ex = event.clientX - rect.left
        const ey = event.clientY - rect.top
        tooltip.style.left = `${Math.min(ex + 14, totalWidth - 200)}px`
        tooltip.style.top = `${Math.max(ey - 70, 4)}px`
      })
      .on('mousemove', (event: MouseEvent) => {
        const tooltip = tooltipRef.current
        if (!tooltip || !chartRef.current) return
        const rect = chartRef.current.getBoundingClientRect()
        const ex = event.clientX - rect.left
        const ey = event.clientY - rect.top
        tooltip.style.left = `${Math.min(ex + 14, totalWidth - 200)}px`
        tooltip.style.top = `${Math.max(ey - 70, 4)}px`
      })
      .on('mouseout', (event: MouseEvent) => {
        d3.select(event.currentTarget as SVGRectElement).attr('opacity', 0.82)
        if (tooltipRef.current) tooltipRef.current.style.display = 'none'
      })

    // X axis
    const tickEvery = numYears > 40 ? 10 : numYears > 20 ? 5 : numYears > 10 ? 2 : 1
    const xG = g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(
        d3.axisBottom(x0)
          .tickValues(years.filter((_: number, i: number) => i % tickEvery === 0).map(String))
          .tickSize(3)
      )
    xG.select('.domain').attr('stroke', 'var(--border)')
    xG.selectAll('line').attr('stroke', 'var(--border)')
    const xLabels = xG.selectAll<SVGTextElement, string>('text')
      .attr('fill', 'var(--text-muted)')
      .attr('font-size', '10px')
    if (rotateLabels) {
      xLabels.attr('transform', 'rotate(-40)').attr('text-anchor', 'end').attr('dx', '-4px').attr('dy', '6px')
    } else {
      xLabels.attr('dy', '1.2em')
    }

    // Y axis
    const yG = g.append('g').call(d3.axisLeft(yScale).ticks(5).tickSize(3))
    yG.select('.domain').attr('stroke', 'var(--border)')
    yG.selectAll('line').attr('stroke', 'var(--border)')
    yG.selectAll('text').attr('fill', 'var(--text-muted)').attr('font-size', '10px')

  }, [data, selectedMfrs, metric, yearFrom, yearTo, chartSize])

  const selectedLabel = selectedMfrs.length === 1
    ? (ALL_MANUFACTURERS.find(m => m.key === selectedMfrs[0])?.name ?? selectedMfrs[0])
    : `${selectedMfrs.length} manufacturers`

  return (
    <div className="section" id="section1">
      <div className="viz-container">
        <div className="paragraph">
          <p className="section-badge">/ Visualization 01</p>
          <h1 className="viz-title">Safety record of aircraft manufacturers</h1>
          <p>
             In recent years, Boeing's 737 MAX defects have led the media to often portray the aircraft manufacturer as less reliable than its European counterpart, Airbus. While it's true that recent serious incidents have regularly implicated the American company, what is the real situation? What does the data say about other aircraft manufacturers? Select any combination of manufacturers and see how their incident and fatality records compare year by year, from the dawn of commercial aviation to today.
          </p>
        </div>
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

          <div className="viz1-inner">
            <div className="viz1-controls">
              <div className="viz1-mfr-dropdown">
                <button className="viz1-ctrl-btn" onClick={() => setDropdownOpen(o => !o)}>
                  {selectedLabel}
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 8, flexShrink: 0 }}>
                    <path d="M6 9l6 6 6-6"/>
                  </svg>
                </button>
                {dropdownOpen && (
                  <div className="viz1-mfr-panel">
                    {ALL_MANUFACTURERS.map(m => (
                      <label
                        key={m.key}
                        className={`viz1-mfr-item${selectedMfrs.includes(m.key) ? ' checked' : ''}`}
                      >
                        <span className="viz1-mfr-swatch" style={{ background: MFR_COLORS[m.key] }} />
                        <input
                          type="checkbox"
                          checked={selectedMfrs.includes(m.key)}
                          onChange={() => toggleMfr(m.key)}
                        />
                        {m.name}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <select className="viz1-ctrl-select" value={metric} onChange={e => setMetric(e.target.value as Metric)}>
                <option value="incidents">Incidents</option>
                <option value="fatalities">Fatalities</option>
              </select>

              <select className="viz1-ctrl-select" value={yearFrom} onChange={e => setYearFrom(Number(e.target.value))}>
                {d3.range(YEAR_MIN, yearTo).map(yr => <option key={yr} value={yr}>{yr}</option>)}
              </select>
              <span className="viz1-ctrl-sep">–</span>
              <select className="viz1-ctrl-select" value={yearTo} onChange={e => setYearTo(Number(e.target.value))}>
                {d3.range(yearFrom + 1, YEAR_MAX + 1).map(yr => <option key={yr} value={yr}>{yr}</option>)}
              </select>

              <div className="viz1-legend">
                {selectedMfrs.map(mfr => (
                  <span key={mfr} className="viz1-legend-item">
                    <span className="viz1-legend-swatch" style={{ background: MFR_COLORS[mfr] }} />
                    {ALL_MANUFACTURERS.find(m => m.key === mfr)?.name}
                  </span>
                ))}
              </div>
            </div>

            <div className="viz1-chart" ref={chartRef}>
              <svg ref={svgRef} style={{ display: 'block' }} />
              <div ref={tooltipRef} className="viz1-tooltip" style={{ display: 'none' }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Viz1

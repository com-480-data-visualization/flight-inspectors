import { useFullscreen } from '../hooks/useFullscreen'
import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import * as d3 from 'd3'
import './Viz6.css'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Level = 'city' | 'country' | 'continent'

interface FlowRecord {
  from:       string
  to:         string
  count:      number
  fatalities: number
}

interface NodeRecord {
  id:         string
  departures: number
  arrivals:   number
  continent?: string
  country?:   string
}

interface ChordData {
  cities:     NodeRecord[]
  countries:  NodeRecord[]
  continents: NodeRecord[]
  flows: {
    city:      FlowRecord[]
    country:   FlowRecord[]
    continent: FlowRecord[]
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Per-continent color palette — matches Viz1 accent family
const CONTINENT_COLORS: Record<string, string> = {
  'North America': '#a78bfa',   // purple
  'Europe':        '#22d3ee',   // cyan
  'Asia':          '#fb923c',   // orange
  'South America': '#4ade80',   // green
  'Africa':        '#facc15',   // yellow
  'Oceania':       '#f472b6',   // pink
  'Unknown':       '#6b7280',   // gray
}

// Fallback palette for city/country level (hash-based)
const PALETTE = [
  '#a78bfa', '#22d3ee', '#fb923c', '#4ade80', '#facc15', '#f472b6',
  '#60a5fa', '#f87171', '#34d399', '#fbbf24', '#38bdf8', '#c084fc',
  '#a3e635', '#fb7185', '#e879f9', '#86efac', '#93c5fd', '#fca5a5',
]

function nodeColor(node: NodeRecord, level: Level): string {
  if (level === 'continent') return CONTINENT_COLORS[node.id] ?? CONTINENT_COLORS['Unknown']
  if (level === 'country')   return CONTINENT_COLORS[node.continent ?? 'Unknown'] ?? CONTINENT_COLORS['Unknown']
  // city — use continent color with index-based variant
  const continent = node.continent ?? 'Unknown'
  const base = CONTINENT_COLORS[continent] ?? CONTINENT_COLORS['Unknown']
  return base
}

// Simple stable color by index
function paletteColor(index: number): string {
  return PALETTE[index % PALETTE.length]
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const Viz6: React.FC = () => {
  const { ref: widgetRef, isFullscreen, toggle } = useFullscreen()
  const svgRef     = useRef<SVGSVGElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const chartRef   = useRef<HTMLDivElement>(null)

  const [data,      setData]      = useState<ChordData | null>(null)
  const [chartSize, setChartSize] = useState({ w: 0, h: 0 })
  const [level,     setLevel]     = useState<Level>('country')
  const [metric,    setMetric]    = useState<'count' | 'fatalities'>('count')
  const [hovered,   setHovered]   = useState<string | null>(null)    // node id
  const [topN,      setTopN]      = useState(20)

  // Load data
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/crashes_for_chord.json`)
      .then(r => r.json())
      .then((d: ChordData) => setData(d))
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

  // ── Derived data: nodes + flows for the current level + topN ────────────
  const { nodes, flows, colorMap } = useMemo(() => {
    if (!data) return { nodes: [], flows: [], colorMap: new Map<string, string>() }

    const rawNodes = data[level === 'city' ? 'cities' : level === 'country' ? 'countries' : 'continents']
    const rawFlows = data.flows[level]

    // rank nodes by total involvement, keep topN
    const nodeRank = new Map<string, number>()
    for (const f of rawFlows) {
      nodeRank.set(f.from, (nodeRank.get(f.from) ?? 0) + f[metric])
      nodeRank.set(f.to,   (nodeRank.get(f.to)   ?? 0) + f[metric])
    }

    const sorted = [...rawNodes]
      .filter(n => nodeRank.has(n.id))
      .sort((a, b) => (nodeRank.get(b.id) ?? 0) - (nodeRank.get(a.id) ?? 0))
      .slice(0, topN)

    const validIds = new Set(sorted.map(n => n.id))
    const filteredFlows = rawFlows.filter(f => validIds.has(f.from) && validIds.has(f.to))

    // Assign a stable color to each node
    const colorMap = new Map<string, string>()
    if (level === 'continent') {
      for (const n of sorted) colorMap.set(n.id, CONTINENT_COLORS[n.id] ?? CONTINENT_COLORS['Unknown'])
    } else if (level === 'country') {
      for (const n of sorted) colorMap.set(n.id, CONTINENT_COLORS[(n as any).continent ?? 'Unknown'] ?? CONTINENT_COLORS['Unknown'])
    } else {
      // city: group by continent color, differentiate with index within group
      const continentIdx = new Map<string, number>()
      for (const n of sorted) {
        const cont = (n as any).continent ?? 'Unknown'
        const idx  = continentIdx.get(cont) ?? 0
        continentIdx.set(cont, idx + 1)
        // slightly shift hue per city within the continent
        colorMap.set(n.id, paletteColor(PALETTE.indexOf(CONTINENT_COLORS[cont] ?? '#6b7280') + idx))
      }
    }

    return { nodes: sorted, flows: filteredFlows, colorMap }
  }, [data, level, metric, topN])

  // ── D3 chord layout ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!svgRef.current || !nodes.length || !flows.length) return
    const { w: W, h: H } = chartSize
    if (W <= 0 || H <= 0) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()
    svg.attr('width', W).attr('height', H)

    const cx = W / 2
    const cy = H / 2
    // Leave margin for labels
    const labelMargin = Math.min(W, H) * 0.22
    const R = Math.min(W, H) / 2 - labelMargin
    if (R < 40) return

    const nodeArcWidth = Math.max(8, R * 0.075)   // thickness of the arc segments
    const innerR       = R - nodeArcWidth
    const GAP          = 0.018  // radians gap between node arcs

    const g = svg.append('g').attr('transform', `translate(${cx},${cy})`)

    // ── Angular layout ──────────────────────────────────────────────────────
    // Each node gets an arc proportional to its total flow (departures + arrivals
    // for the current set of flows)

    const nodeTotal = new Map<string, number>()
    for (const f of flows) {
      nodeTotal.set(f.from, (nodeTotal.get(f.from) ?? 0) + f[metric])
      nodeTotal.set(f.to,   (nodeTotal.get(f.to)   ?? 0) + f[metric])
    }

    const totalFlow  = [...nodeTotal.values()].reduce((s, v) => s + v, 0)
    const totalGap   = GAP * nodes.length
    const arcScale   = (2 * Math.PI - totalGap) / Math.max(totalFlow, 1)

    // Compute start angle for each node
    const nodeAngle  = new Map<string, { start: number; end: number }>()
    let   cursor     = -Math.PI / 2   // start at top

    for (const n of nodes) {
      const span = (nodeTotal.get(n.id) ?? 0) * arcScale
      nodeAngle.set(n.id, { start: cursor, end: cursor + span })
      cursor += span + GAP
    }

    // Within each node arc, track how much angle has been consumed for
    // departures (from the start of the arc) and arrivals (from the end)
    const depCursor = new Map<string, number>()
    const arrCursor = new Map<string, number>()
    for (const n of nodes) {
      depCursor.set(n.id, nodeAngle.get(n.id)!.start)
      arrCursor.set(n.id, nodeAngle.get(n.id)!.end)
    }

    // Pre-compute ribbon angles for all flows
    type RibbonSpec = {
      flow: FlowRecord
      fromA0: number; fromA1: number
      toA0: number;   toA1: number
      color: string
    }

    const ribbons: RibbonSpec[] = []
    for (const f of flows) {
      if (!nodeAngle.has(f.from) || !nodeAngle.has(f.to)) continue
      const span = f[metric] * arcScale
      const fromStart = depCursor.get(f.from)!
      depCursor.set(f.from, fromStart + span)

      // arrivals fill from the end backwards
      const toEnd = arrCursor.get(f.to)!
      arrCursor.set(f.to, toEnd - span)

      ribbons.push({
        flow:   f,
        fromA0: fromStart,
        fromA1: fromStart + span,
        toA0:   toEnd - span,
        toA1:   toEnd,
        color:  colorMap.get(f.from) ?? '#888',
      })
    }

    // ── Draw ribbons ─────────────────────────────────────────────────────
    const ribbonGroup = g.append('g').attr('class', 'viz6-ribbons')

    function makeRibbonPath(
      fromA0: number, fromA1: number,
      toA0:   number, toA1:   number,
      r:      number
    ): string {
      const midFrom = (fromA0 + fromA1) / 2
      const midTo   = (toA0   + toA1)   / 2
      const x0 = r * Math.cos(fromA0), y0 = r * Math.sin(fromA0)
      const x1 = r * Math.cos(fromA1), y1 = r * Math.sin(fromA1)
      const x2 = r * Math.cos(toA1),   y2 = r * Math.sin(toA1)
      const x3 = r * Math.cos(toA0),   y3 = r * Math.sin(toA0)
      // control points at origin (creates a nice bow)
      const k = 0.0
      const cx0 = k * r * Math.cos(midFrom), cy0 = k * r * Math.sin(midFrom)
      const cx1 = k * r * Math.cos(midTo),   cy1 = k * r * Math.sin(midTo)
      return [
        `M ${x0} ${y0}`,
        `A ${r} ${r} 0 ${Math.abs(fromA1 - fromA0) > Math.PI ? 1 : 0} 1 ${x1} ${y1}`,
        `Q ${cx0} ${cy0} ${cx1} ${cy1}`,     // ← bezier toward source center
        `Q 0 0 ${cx1} ${cy1}`,               // through origin for full bow
        `A ${r} ${r} 0 ${Math.abs(toA1 - toA0) > Math.PI ? 1 : 0} 0 ${x3} ${y3}`,
        `Q ${cx1} ${cy1} ${cx0} ${cy0}`,
        `Q 0 0 ${cx0} ${cy0}`,
        'Z',
      ].join(' ')
    }

    // Better: use a proper cubic bezier through the origin
    function ribbonD(
      fromA0: number, fromA1: number,
      toA0:   number, toA1:   number,
    ): string {
      const r = innerR
      const x0 = r * Math.cos(fromA0), y0 = r * Math.sin(fromA0)
      const x1 = r * Math.cos(fromA1), y1 = r * Math.sin(fromA1)
      const x2 = r * Math.cos(toA0),   y2 = r * Math.sin(toA0)
      const x3 = r * Math.cos(toA1),   y3 = r * Math.sin(toA1)
      return [
        `M ${x0.toFixed(2)} ${y0.toFixed(2)}`,
        // arc along inner circle from a0 to a1 of source
        `A ${r} ${r} 0 ${fromA1 - fromA0 > Math.PI ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`,
        // bezier to target arc — control point at origin gives the bow
        `C 0 0 0 0 ${x3.toFixed(2)} ${y3.toFixed(2)}`,
        // arc along inner circle from b1 back to b0 of target
        `A ${r} ${r} 0 ${toA1 - toA0 > Math.PI ? 1 : 0} 0 ${x2.toFixed(2)} ${y2.toFixed(2)}`,
        // bezier back to source start
        `C 0 0 0 0 ${x0.toFixed(2)} ${y0.toFixed(2)}`,
        'Z',
      ].join(' ')
    }

    const ribbonEls = ribbonGroup.selectAll('path')
      .data(ribbons)
      .join('path')
      .attr('d', (d: RibbonSpec) => ribbonD(d.fromA0, d.fromA1, d.toA0, d.toA1))
      .attr('fill', (d: RibbonSpec) => d.color)
      .attr('fill-opacity', (d: RibbonSpec) =>
        hovered === null ? 0.35
        : (hovered === d.flow.from || hovered === d.flow.to) ? 0.7 : 0.06
      )
      .attr('stroke', (d: RibbonSpec) => d.color)
      .attr('stroke-width', 0.4)
      .attr('stroke-opacity', 0.5)
      .style('cursor', 'pointer')
      .on('mouseover', (event: MouseEvent, d: RibbonSpec) => {
        const tooltip = tooltipRef.current
        if (!tooltip || !chartRef.current) return
        tooltip.innerHTML = `
          <div class="viz6-tt-route">${d.flow.from} → ${d.flow.to}</div>
          <div class="viz6-tt-row">Crashes: <b>${d.flow.count}</b></div>
          <div class="viz6-tt-row">Fatalities: <b>${d.flow.fatalities}</b></div>
        `
        tooltip.style.display = 'block'
        const rect = chartRef.current.getBoundingClientRect()
        tooltip.style.left = `${Math.min(event.clientX - rect.left + 12, W - 210)}px`
        tooltip.style.top  = `${Math.max(event.clientY - rect.top  - 60, 4)}px`
      })
      .on('mousemove', (event: MouseEvent) => {
        const tooltip = tooltipRef.current
        if (!tooltip || !chartRef.current) return
        const rect = chartRef.current.getBoundingClientRect()
        tooltip.style.left = `${Math.min(event.clientX - rect.left + 12, W - 210)}px`
        tooltip.style.top  = `${Math.max(event.clientY - rect.top  - 60, 4)}px`
      })
      .on('mouseout', () => {
        if (tooltipRef.current) tooltipRef.current.style.display = 'none'
      })

    // ── Draw arrowheads at target arc ─────────────────────────────────────
    // Small triangle at midpoint of toA0..toA1, pointing outward
    // const arrowGroup = g.append('g').attr('class', 'viz6-arrows')
    // for (const rb of ribbons) {
    //   const { fromA0, fromA1, toA0, toA1, color, flow } = rb
    //   const midA    = (toA0 + toA1) / 2
    //   const tipR    = innerR - 1
    //   const baseR   = innerR + nodeArcWidth * 0.55
    //   const halfW   = Math.max(2, (toA1 - toA0) * innerR / 2 * 0.7)

    //   // tip
    //   const tx = tipR * Math.cos(midA), ty = tipR * Math.sin(midA)
    //   // base left/right
    //   const perp  = midA + Math.PI / 2
    //   const bx1   = baseR * Math.cos(midA) + halfW * Math.cos(perp)
    //   const by1   = baseR * Math.sin(midA) + halfW * Math.sin(perp)
    //   const bx2   = baseR * Math.cos(midA) - halfW * Math.cos(perp)
    //   const by2   = baseR * Math.sin(midA) - halfW * Math.sin(perp)

    //   arrowGroup.append('polygon')
    //     .attr('points', `${tx.toFixed(1)},${ty.toFixed(1)} ${bx1.toFixed(1)},${by1.toFixed(1)} ${bx2.toFixed(1)},${by2.toFixed(1)}`)
    //     .attr('fill', color)
    //     .attr('fill-opacity', hovered === null ? 0.7 : (hovered === flow.from || hovered === flow.to) ? 1 : 0.1)
    //     .attr('stroke', 'none')
    // }

// ── Draw arrowheads at target arc ─────────────────────────────────────
    const arrowGroup = g.append('g').attr('class', 'viz6-arrows')

    for (const rb of ribbons) {
      const { toA0, toA1, color, flow } = rb

      // midpoint of the TARGET segment
      const midA = (toA0 + toA1) / 2

      // arrow positioned directly on target arc
      const rArrow = innerR + nodeArcWidth * 0.45

      // tangent direction
      const tangent = midA + Math.PI / 2

      // arrow size
      const arrowLen = Math.max(6, Math.min(14, (toA1 - toA0) * innerR * 0.6))
      const arrowWid = arrowLen * 0.6

      // tip points ALONG the flow direction
      const tipX = rArrow * Math.cos(midA)
      const tipY = rArrow * Math.sin(midA)

      // base center slightly backward along tangent
      const baseCX = tipX - arrowLen * Math.cos(tangent)
      const baseCY = tipY - arrowLen * Math.sin(tangent)

      // perpendicular for width
      const perp = tangent + Math.PI / 2

      const bx1 = baseCX + (arrowWid / 2) * Math.cos(perp)
      const by1 = baseCY + (arrowWid / 2) * Math.sin(perp)

      const bx2 = baseCX - (arrowWid / 2) * Math.cos(perp)
      const by2 = baseCY - (arrowWid / 2) * Math.sin(perp)

      arrowGroup.append('polygon')
        .attr(
          'points',
          `
          ${tipX},${tipY}
          ${bx1},${by1}
          ${bx2},${by2}
          `
        )
        .attr('fill', color)
        .attr(
          'fill-opacity',
          hovered === null
            ? 0.9
            : hovered === flow.from || hovered === flow.to
            ? 1
            : 0.08
        )
        .attr('stroke', 'none')
    }

    // ── Draw node arcs ────────────────────────────────────────────────────
    const arcGen = d3.arc<{ node: NodeRecord; startAngle: number; endAngle: number }>()
      .innerRadius(innerR)
      .outerRadius(innerR + nodeArcWidth)
      .startAngle(d => d.startAngle)
      .endAngle(d => d.endAngle)

    const arcData = nodes.map(n => ({
      node:       n,
      startAngle: nodeAngle.get(n.id)!.start,
      endAngle:   nodeAngle.get(n.id)!.end,
    }))

    const arcGroup = g.append('g').attr('class', 'viz6-arcs')

    arcGroup.selectAll('path')
      .data(arcData)
      .join('path')
      .attr('d', arcGen)
      .attr('fill', d => colorMap.get(d.node.id) ?? '#888')
      .attr('fill-opacity', d => hovered === null ? 0.9 : hovered === d.node.id ? 1 : 0.3)
      .attr('stroke', 'var(--bg)')
      .attr('stroke-width', 1)
      .style('cursor', 'pointer')
      .on('mouseover', (event: MouseEvent, d: { node: NodeRecord }) => {
        setHovered(d.node.id)
        const tooltip = tooltipRef.current
        if (!tooltip || !chartRef.current) return
        const outflows = flows.filter(f => f.from === d.node.id)
        const inflows  = flows.filter(f => f.to   === d.node.id)
        const totalOut = outflows.reduce((s, f) => s + f[metric], 0)
        const totalIn  = inflows. reduce((s, f) => s + f[metric], 0)
        tooltip.innerHTML = `
          <div class="viz6-tt-node">${d.node.id}</div>
          <div class="viz6-tt-row">Departures: <b>${totalOut}</b></div>
          <div class="viz6-tt-row">Arrivals: <b>${totalIn}</b></div>
        `
        tooltip.style.display = 'block'
        const rect = chartRef.current!.getBoundingClientRect()
        tooltip.style.left = `${Math.min(event.clientX - rect.left + 12, W - 210)}px`
        tooltip.style.top  = `${Math.max(event.clientY - rect.top  - 60, 4)}px`
      })
      .on('mousemove', (event: MouseEvent) => {
        const tooltip = tooltipRef.current
        if (!tooltip || !chartRef.current) return
        const rect = chartRef.current.getBoundingClientRect()
        tooltip.style.left = `${Math.min(event.clientX - rect.left + 12, W - 210)}px`
        tooltip.style.top  = `${Math.max(event.clientY - rect.top  - 60, 4)}px`
      })
      .on('mouseout', () => {
        setHovered(null)
        if (tooltipRef.current) tooltipRef.current.style.display = 'none'
      })

    // ── Labels ────────────────────────────────────────────────────────────
    const labelGroup = g.append('g').attr('class', 'viz6-labels')
    const LABEL_R = innerR + nodeArcWidth + 6

    for (const d of arcData) {
      const midA   = (d.startAngle + d.endAngle) / 2
      const arcSpan = d.endAngle - d.startAngle
      // only label if arc is wide enough to be readable
      const minArcForLabel = 2 * Math.PI / 60
      if (arcSpan < minArcForLabel) continue

      const x       = LABEL_R * Math.cos(midA)
      const y       = LABEL_R * Math.sin(midA)
      const degrees = (midA * 180) / Math.PI
      const flip    = degrees > 90 && degrees < 270
      const rotate  = flip ? degrees + 180 : degrees

      // Abbreviate long city/country names
      let label = d.node.id
      if (label.length > 16) label = label.slice(0, 14) + '…'

      labelGroup.append('text')
        .attr('transform', `translate(${x.toFixed(1)},${y.toFixed(1)}) rotate(${rotate.toFixed(1)})`)
        .attr('text-anchor', flip ? 'end' : 'start')
        .attr('dominant-baseline', 'central')
        .attr('font-size', level === 'city' ? '9px' : level === 'country' ? '10px' : '12px')
        .attr('font-family', 'var(--sans)')
        .attr('fill', colorMap.get(d.node.id) ?? 'var(--text-muted)')
        .attr('opacity', hovered === null ? 1 : hovered === d.node.id ? 1 : 0.4)
        .text(label)
    }

  }, [nodes, flows, colorMap, chartSize, hovered, level, metric])

  // ── Legend ───────────────────────────────────────────────────────────────
  const legendEntries = useMemo(() => {
    if (level === 'continent') {
      return Object.entries(CONTINENT_COLORS)
        .filter(([k]) => k !== 'Unknown')
        .map(([label, color]) => ({ label, color }))
    }
    // country / city: show unique continents present in current nodes
    const seen = new Map<string, string>()
    for (const n of nodes) {
      const cont  = (n as any).continent ?? 'Unknown'
      const color = colorMap.get(n.id) ?? '#888'
      if (cont !== 'Unknown' && !seen.has(cont)) seen.set(cont, CONTINENT_COLORS[cont] ?? color)
    }
    return [...seen.entries()].map(([label, color]) => ({ label, color }))
  }, [nodes, colorMap, level])

  return (
    <div className="section" id="section6">
      <div className="viz-container">
        <div className="paragraph">
          <p className="section-badge">/ Visualization 06</p>
          <h1 className="viz-title">Where crashes happen: origin–destination flows</h1>
          <p>
            Each arc segment represents an airport, country, or continent. Ribbons
            connect departure and arrival locations — thickness encodes the number
            of crashes on that route. Arrowheads at the arrival end indicate
            direction of flight. Hover a node or ribbon for details.
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

          <div className="viz6-inner">
            {/* ── Controls ── */}
            <div className="viz6-controls">

              {/* Level toggle */}
              <div className="viz6-toggle-group">
                {(['city', 'country', 'continent'] as Level[]).map(l => (
                  <button
                    key={l}
                    className={`viz6-toggle-btn${level === l ? ' active' : ''}`}
                    onClick={() => setLevel(l)}
                  >
                    {l.charAt(0).toUpperCase() + l.slice(1)}
                  </button>
                ))}
              </div>

              <div className="viz6-ctrl-sep" />

              <span className="viz6-ctrl-label">Metric</span>
              <select className="viz6-ctrl-select" value={metric} onChange={e => setMetric(e.target.value as 'count' | 'fatalities')}>
                <option value="count">Crashes</option>
                <option value="fatalities">Fatalities</option>
              </select>

              <span className="viz6-ctrl-label">Show top</span>
              <select className="viz6-ctrl-select" value={topN} onChange={e => setTopN(Number(e.target.value))}>
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={20}>20</option>
                <option value={30}>30</option>
                <option value={50}>50</option>
              </select>
              <span className="viz6-ctrl-label" style={{ marginLeft: -2 }}>nodes</span>

              {/* Legend */}
              <div className="viz6-legend">
                {legendEntries.map(({ label, color }) => (
                  <span key={label} className="viz6-legend-item">
                    <span className="viz6-legend-swatch" style={{ background: color }} />
                    {label}
                  </span>
                ))}
              </div>
            </div>

            {/* ── Chart ── */}
            <div className="viz6-chart" ref={chartRef}>
              <svg ref={svgRef} style={{ display: 'block' }} />
              {!data && <div className="viz6-empty">Loading…</div>}
              {data && nodes.length === 0 && (
                <div className="viz6-empty">No data for current filters.</div>
              )}
              <div ref={tooltipRef} className="viz6-tooltip" style={{ display: 'none' }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Viz6

import { useFullscreen } from '../hooks/useFullscreen'
import { useEffect, useRef, useState, useMemo } from 'react'
import * as d3 from 'd3'
import './Viz5.css'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Level   = 'city' | 'country' | 'continent'
type Metric  = 'count' | 'fatalities'

interface FlowRecord  { from: string; to: string; count: number; fatalities: number }
interface NodeRecord  { id: string; departures: number; arrivals: number; continent?: string; country?: string }
interface ChordData   {
  cities: NodeRecord[]; countries: NodeRecord[]; continents: NodeRecord[]
  flows: { city: FlowRecord[]; country: FlowRecord[]; continent: FlowRecord[] }
}

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

const CONTINENT_COLORS: Record<string, string> = {
  'North America': '#a78bfa',
  'Europe':        '#22d3ee',
  'Asia':          '#fb923c',
  'South America': '#4ade80',
  'Africa':        '#facc15',
  'Oceania':       '#f472b6',
  'Unknown':       '#6b7280',
}
const PALETTE = [
  '#a78bfa','#22d3ee','#fb923c','#4ade80','#facc15','#f472b6',
  '#60a5fa','#f87171','#34d399','#fbbf24','#38bdf8','#c084fc',
  '#a3e635','#fb7185','#e879f9','#86efac','#93c5fd','#fca5a5',
]

// Darken a hex color for the arrival half of each arc
function darken(hex: string, f = 0.5): string {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
  const d = (v: number) => Math.round(v*(1-f)).toString(16).padStart(2,'0')
  return `#${d(r)}${d(g)}${d(b)}`
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const Viz5: React.FC = () => {
  const { ref: widgetRef, isFullscreen, toggle } = useFullscreen()
  const svgRef     = useRef<SVGSVGElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const chartRef   = useRef<HTMLDivElement>(null)

  const [data,      setData]      = useState<ChordData | null>(null)
  const [chartSize, setChartSize] = useState({ w: 0, h: 0 })
  const [level,     setLevel]     = useState<Level>('country')
  const [metric,    setMetric]    = useState<Metric>('count')
  const [hovered,   setHovered]   = useState<string | null>(null)
  const [topN,      setTopN]      = useState(20)

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/crashes_for_chord.json`)
      .then(r => r.json()).then((d: ChordData) => setData(d))
  }, [])

  useEffect(() => {
    const el = chartRef.current; if (!el) return
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      setChartSize({ w: Math.floor(width), h: Math.floor(height) })
    })
    ro.observe(el); return () => ro.disconnect()
  }, [])

  // ── Nodes + flows for current level / topN ────────────────────────────────
  const { nodes, flows, colorMap } = useMemo(() => {
    if (!data) return { nodes: [] as NodeRecord[], flows: [] as FlowRecord[], colorMap: new Map<string,string>() }

    const rawNodes = data[level === 'city' ? 'cities' : level === 'country' ? 'countries' : 'continents']
    const rawFlows = data.flows[level]

    // Rank nodes by total flow involvement
    const rank = new Map<string,number>()
    for (const f of rawFlows) {
      rank.set(f.from, (rank.get(f.from) ?? 0) + f[metric])
      rank.set(f.to,   (rank.get(f.to)   ?? 0) + f[metric])
    }
    const sorted   = [...rawNodes].filter(n => rank.has(n.id))
      .sort((a,b) => (rank.get(b.id) ?? 0) - (rank.get(a.id) ?? 0)).slice(0, topN)
    const validIds = new Set(sorted.map(n => n.id))
    const filtered = rawFlows.filter(f => validIds.has(f.from) && validIds.has(f.to))

    // Color map
    const colorMap = new Map<string,string>()
    if (level === 'continent') {
      sorted.forEach(n => colorMap.set(n.id, CONTINENT_COLORS[n.id] ?? CONTINENT_COLORS['Unknown']))
    } else if (level === 'country') {
      sorted.forEach(n => colorMap.set(n.id, CONTINENT_COLORS[(n as any).continent ?? 'Unknown'] ?? CONTINENT_COLORS['Unknown']))
    } else {
      const contIdx = new Map<string,number>()
      sorted.forEach(n => {
        const cont = (n as any).continent ?? 'Unknown'
        const base = PALETTE.indexOf(CONTINENT_COLORS[cont] ?? '#6b7280')
        const idx  = contIdx.get(cont) ?? 0; contIdx.set(cont, idx+1)
        colorMap.set(n.id, PALETTE[(base + idx) % PALETTE.length])
        // then:
        // const base = (CONTINENT_IDX[cont] ?? 6) * 3
        // colorMap.set(n.id, PALETTE[(base + idx) % PALETTE.length])
      })
    }
    return { nodes: sorted, flows: filtered, colorMap }
  }, [data, level, metric, topN])

  // ── D3 chord layout + drawing ────────────────────────────────────────────
  useEffect(() => {
    if (!svgRef.current || !nodes.length || !flows.length) return
    const { w: W, h: H } = chartSize
    if (W <= 0 || H <= 0) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()
    svg.attr('width', W).attr('height', H)

    const cx = W/2, cy = H/2
    const labelMargin = Math.min(W,H) * 0.22
    const outerR = Math.min(W,H)/2 - labelMargin
    if (outerR < 40) return
    const ARC_W  = Math.max(8, outerR * 0.07)
    const innerR = outerR - ARC_W

    // ── Build N×N matrix for d3.chordDirected ─────────────────────────────
    // matrix[i][j] = flow from node i → node j
    const N       = nodes.length
    const idxMap  = new Map<string,number>(nodes.map((n,i) => [n.id, i]))
    const matrix  = Array.from({length: N}, () => new Array(N).fill(0))
    for (const f of flows) {
      const i = idxMap.get(f.from), j = idxMap.get(f.to)
      if (i !== undefined && j !== undefined) matrix[i][j] += f[metric]
    }

    // ── d3.chordDirected layout ────────────────────────────────────────────
    // padAngle: gap between node arcs
    // sortSubgroups: within each group, outgoing (departures) come before
    //   incoming (arrivals) because chordDirected puts sources first
    const chordLayout = (d3 as any).chordDirected
      ? (d3 as any).chordDirected()
          .padAngle(0.025)
          .sortSubgroups(d3.descending)
      : d3.chord()
          .padAngle(0.025)
          .sortSubgroups(d3.descending)

    const chords = chordLayout(matrix)

    // ── Ribbon generator with arrowhead ────────────────────────────────────
    // ribbonArrow puts the arrowhead at the TARGET (arrival) end
    const ribbonGen = (d3 as any).ribbonArrow
      ? (d3 as any).ribbonArrow()
          .radius(innerR)
          .headRadius(Math.max(4, ARC_W * 0.55))
      : d3.ribbon().radius(innerR)

    // ── Arc generator for the outer ring ──────────────────────────────────
    const arcGen = d3.arc<d3.ChordGroup>()
      .innerRadius(innerR)
      .outerRadius(outerR)

    const g = svg.append('g').attr('transform', `translate(${cx},${cy})`)

    // ── 1. Draw ribbons ────────────────────────────────────────────────────
    // Ribbons drawn first (below arcs)
    const ribbonGroup = g.append('g').attr('class', 'Viz5-ribbons')

    ribbonGroup.selectAll('path')
      .data(chords)
      .join('path')
        .attr('d', (d: any) => ribbonGen(d))
        .attr('fill', (d: any) => colorMap.get(nodes[d.source.index]?.id) ?? '#888')
        .attr('fill-opacity', (d: any) => {
          if (hovered === null) return 0.35
          const fromId = nodes[d.source.index]?.id
          const toId   = nodes[d.target.index]?.id
          return (hovered === fromId || hovered === toId) ? 0.75 : 0.04
        })
        .attr('stroke', (d: any) => colorMap.get(nodes[d.source.index]?.id) ?? '#888')
        .attr('stroke-width', 0.4)
        .attr('stroke-opacity', 0.4)
        .style('cursor', 'pointer')
        .on('mouseover', (event: MouseEvent, d: any) => {
          const fromId = nodes[d.source.index]?.id ?? ''
          const toId   = nodes[d.target.index]?.id ?? ''
          const flow   = flows.find(f => f.from === fromId && f.to === toId)
          const tt = tooltipRef.current; if (!tt || !chartRef.current) return
          tt.innerHTML = `
            <div class="viz5-tt-route">${fromId} → ${toId}</div>
            <div class="viz5-tt-row">Crashes: <b>${flow?.count ?? d.source.value}</b></div>
            <div class="viz5-tt-row">Fatalities: <b>${flow?.fatalities ?? '–'}</b></div>
          `
          tt.style.display = 'block'
          const rect = chartRef.current.getBoundingClientRect()
          tt.style.left = `${Math.min(event.clientX - rect.left + 12, W - 215)}px`
          tt.style.top  = `${Math.max(event.clientY - rect.top  - 60, 4)}px`
        })
        .on('mousemove', (event: MouseEvent) => {
          const tt = tooltipRef.current; if (!tt || !chartRef.current) return
          const rect = chartRef.current.getBoundingClientRect()
          tt.style.left = `${Math.min(event.clientX - rect.left + 12, W - 215)}px`
          tt.style.top  = `${Math.max(event.clientY - rect.top  - 60, 4)}px`
        })
        .on('mouseout', () => { if (tooltipRef.current) tooltipRef.current.style.display = 'none' })

    // ── 2. Draw outer arc ring — split dep (bright) / arr (dark) ──────────
    // In d3.chordDirected the SOURCE slots sit at the START of each group arc
    // and TARGET slots at the END.  We colour them differently.
    const arcGroup = g.append('g').attr('class', 'Viz5-arcs')

    // Gather per-group source and target angular extents
    interface GroupSplit { depEnd: number; arrStart: number }
    const groupSplit = new Map<number, GroupSplit>()

    for (const ch of chords as any[]) {
      const si = ch.source.index, ti = ch.target.index
      // source slots: ch.source.startAngle … ch.source.endAngle  → departure
      // target slots: ch.target.startAngle … ch.target.endAngle  → arrival
      // We need the boundary: max of all source endAngles for this group
      //   and min of all target startAngles for this group
      const cur = groupSplit.get(si) ?? { depEnd: -Infinity, arrStart: Infinity }
      groupSplit.set(si, {
        depEnd:    Math.max(cur.depEnd,    ch.source.endAngle),
        arrStart:  cur.arrStart,
      })
      const curT = groupSplit.get(ti) ?? { depEnd: -Infinity, arrStart: Infinity }
      groupSplit.set(ti, {
        depEnd:    curT.depEnd,
        arrStart:  Math.min(curT.arrStart, ch.target.startAngle),
      })
    }

    for (const group of (chords as any).groups as d3.ChordGroup[]) {
      const nodeId = nodes[group.index]?.id
      const col    = colorMap.get(nodeId) ?? '#888'
      const split  = groupSplit.get(group.index)
      const dim    = hovered === null ? 1 : hovered === nodeId ? 1 : 0.22

      // Determine boundary between dep and arr sub-arcs
      const depEnd   = (split && split.depEnd   > group.startAngle) ? split.depEnd   : group.endAngle
      const arrStart = (split && split.arrStart < group.endAngle)   ? split.arrStart : group.endAngle

      // Use midpoint if both overlap (single-direction node)
      const boundary = (depEnd <= arrStart)
        ? (depEnd + arrStart) / 2
        : (group.startAngle + group.endAngle) / 2

      // Departure sub-arc (bright, first half)
      if (boundary > group.startAngle) {
        arcGroup.append('path')
          .attr('d', arcGen({ ...group, startAngle: group.startAngle, endAngle: boundary } as any))
          .attr('fill', col)
          .attr('fill-opacity', dim * 0.9)
          .attr('stroke', 'var(--bg)').attr('stroke-width', 0.8)
          .style('pointer-events', 'none')
      }

      // Arrival sub-arc (darkened, second half)
      if (group.endAngle > boundary) {
        arcGroup.append('path')
          .attr('d', arcGen({ ...group, startAngle: boundary, endAngle: group.endAngle } as any))
          .attr('fill', darken(col))
          .attr('fill-opacity', dim * 0.9)
          .attr('stroke', 'var(--bg)').attr('stroke-width', 0.8)
          .style('pointer-events', 'none')
      }

      // Invisible hit-target for hover (full arc)
      arcGroup.append('path')
        .attr('d', arcGen(group))
        .attr('fill', 'transparent').attr('stroke', 'none')
        .style('cursor', 'pointer')
        .datum({ nodeId, group })
        .on('mouseover', (event: MouseEvent, d: any) => {
          setHovered(d.nodeId)
          const tt = tooltipRef.current; if (!tt || !chartRef.current) return
          const totalOut = flows.filter(f => f.from === d.nodeId).reduce((s,f) => s + f[metric], 0)
          const totalIn  = flows.filter(f => f.to   === d.nodeId).reduce((s,f) => s + f[metric], 0)
          tt.innerHTML = `
            <div class="viz5-tt-node">${d.nodeId}</div>
            <div class="viz5-tt-row">Departures: <b>${totalOut}</b></div>
            <div class="viz5-tt-row">Arrivals: <b>${totalIn}</b></div>
          `
          tt.style.display = 'block'
          const rect = chartRef.current!.getBoundingClientRect()
          tt.style.left = `${Math.min(event.clientX - rect.left + 12, W - 215)}px`
          tt.style.top  = `${Math.max(event.clientY - rect.top  - 60, 4)}px`
        })
        .on('mousemove', (event: MouseEvent) => {
          const tt = tooltipRef.current; if (!tt || !chartRef.current) return
          const rect = chartRef.current.getBoundingClientRect()
          tt.style.left = `${Math.min(event.clientX - rect.left + 12, W - 215)}px`
          tt.style.top  = `${Math.max(event.clientY - rect.top  - 60, 4)}px`
        })
        .on('mouseout', () => { setHovered(null); if (tooltipRef.current) tooltipRef.current.style.display = 'none' })
    }

    // ── 3. Labels ──────────────────────────────────────────────────────────
    const LABEL_R  = outerR + 8
    const MIN_SPAN = (2 * Math.PI) / 70
    const labelGrp = g.append('g').style('pointer-events','none')

    for (const group of (chords as any).groups as d3.ChordGroup[]) {
      const span = group.endAngle - group.startAngle
      if (span < MIN_SPAN) continue
      const nodeId = nodes[group.index]?.id ?? ''
      const midA   = (group.startAngle + group.endAngle) / 2
      const x      = LABEL_R * Math.cos(midA - Math.PI/2)
      const y      = LABEL_R * Math.sin(midA - Math.PI/2)
      const deg    = ((midA - Math.PI/2) * 180) / Math.PI
      const flip   = deg > 90 && deg < 270
      let label    = nodeId; if (label.length > 16) label = label.slice(0,14) + '…'

      labelGrp.append('text')
        .attr('transform', `translate(${x.toFixed(1)},${y.toFixed(1)}) rotate(${(flip ? deg+180 : deg).toFixed(1)})`)
        .attr('text-anchor', flip ? 'end' : 'start')
        .attr('dominant-baseline', 'central')
        .attr('font-size', level === 'city' ? '9px' : level === 'country' ? '10px' : '12px')
        .attr('font-family', 'var(--sans)')
        .attr('fill', colorMap.get(nodeId) ?? 'var(--text-muted)')
        .attr('opacity', hovered === null ? 1 : hovered === nodeId ? 1 : 0.3)
        .text(label)
    }

  }, [nodes, flows, colorMap, chartSize, hovered, level, metric])

  // ── Legend ────────────────────────────────────────────────────────────────
 const legendEntries = level === 'city'
    ? []
    : Object.entries(CONTINENT_COLORS)
        .filter(([k]) => k !== 'Unknown')
        .map(([label, color]) => ({ label, color }))

  return (
    <div className="section" id="section5">
      <div className="viz-container">
        <div className="paragraph">
          <p className="section-badge">/ Visualization 05</p>
          <h1 className="viz-title">Origin–destination flows: the most perilous routes</h1>
          <p>
            
            Each arc segment represents a city, country, or continent. The bright
            portion marks departures; the darker portion marks arrivals. Ribbon
            thickness encodes crash count. Arrowheads point toward the arrival end.
            Hover a node or ribbon for details.
          </p>
        </div>

        <div className="widget" ref={widgetRef}>
          <button className="fullscreen-btn" aria-label="Toggle Fullscreen" onClick={toggle}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              {isFullscreen ? <>
                <path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/>
                <path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/>
              </> : <>
                <path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/>
                <path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>
              </>}
            </svg>
          </button>

          <div className="viz5-inner">
            <div className="viz5-controls">
              <div className="viz5-toggle-group">
                {(['city','country','continent'] as Level[]).map(l => (
                  <button key={l} className={`viz5-toggle-btn${level===l?' active':''}`} onClick={() => setLevel(l)}>
                    {l.charAt(0).toUpperCase()+l.slice(1)}
                  </button>
                ))}
              </div>
              <div className="viz5-ctrl-sep" />
              <span className="viz5-ctrl-label">Metric</span>
              <select className="viz5-ctrl-select" value={metric} onChange={e => setMetric(e.target.value as Metric)}>
                <option value="count">Incidents</option>
                <option value="fatalities">Fatalities</option>
              </select>
              <span className="viz5-ctrl-label">Show top</span>
              <select className="viz5-ctrl-select" value={topN} onChange={e => setTopN(Number(e.target.value))}>
                {[10,15,20,30,50].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <span className="viz5-ctrl-label" style={{marginLeft:-2}}>nodes</span>
              <div className="viz5-legend">
                {legendEntries.map(({label,color}) => (
                  <span key={label} className="viz5-legend-item">
                    <span className="viz5-legend-swatch" style={{background:color}}/>
                    {label}
                  </span>
                ))}
              </div>
            </div>

            <div className="viz5-chart" ref={chartRef}>
              <svg ref={svgRef} style={{display:'block'}}/>
              {!data && <div className="viz5-empty">Loading…</div>}
              {data && nodes.length === 0 && <div className="viz5-empty">No data for current filters.</div>}
              <div ref={tooltipRef} className="viz5-tooltip" style={{display:'none'}}/>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Viz5

import { useFullscreen } from '../hooks/useFullscreen'
import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import './Viz2.css'

type Metric = 'incidents' | 'fatalities'

interface AirlinePoint {
  year: number
  key: string
  name: string
  incidents: number
  fatalities: number
}

interface BubbleNode extends d3.SimulationNodeDatum {
  key: string
  name: string
  value: number
  r: number
  colorIdx: number
  __restX?: number
  __restY?: number
}

const PALETTE = [
  '#a78bfa', '#22d3ee', '#fb923c', '#f87171', '#4ade80',
  '#facc15', '#60a5fa', '#f472b6', '#a3e635', '#34d399',
  '#e879f9', '#38bdf8', '#fbbf24', '#fb7185', '#c084fc',
]

function hexToRgba(hex: string, a: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}

const YEAR_MIN = 1920
const YEAR_MAX = 2024
const TOP_N = 15
const PLAY_MS = 450

const Viz2: React.FC = () => {
  const { ref: widgetRef, isFullscreen, toggle } = useFullscreen()
  const svgRef    = useRef<SVGSVGElement>(null)
  const chartRef  = useRef<HTMLDivElement>(null)
  const simRef    = useRef<d3.Simulation<BubbleNode, undefined> | null>(null)
  const nodesRef  = useRef<BubbleNode[]>([])

  const [data,      setData]      = useState<AirlinePoint[]>([])
  const [metric,    setMetric]    = useState<Metric>('incidents')
  const [year,      setYear]      = useState(1949)
  const [playing,   setPlaying]   = useState(false)
  const [chartSize, setChartSize] = useState({ w: 0, h: 0 })

  /* ── data fetch ── */
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/crashes_by_airline.json`)
      .then(r => r.json())
      .then(setData)
  }, [])

  /* ── resize observer ── */
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

  /* ── autoplay ── */
  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => {
      setYear(y => {
        if (y >= YEAR_MAX) { setPlaying(false); return y }
        return y + 1
      })
    }, PLAY_MS)
    return () => clearInterval(id)
  }, [playing])

  /* ── force simulation (init once, update on size change) ── */
  useEffect(() => {
    const { w, h } = chartSize
    if (w <= 0 || h <= 0) return

    if (!simRef.current) {
      simRef.current = d3.forceSimulation<BubbleNode>()
        .force('x', d3.forceX<BubbleNode>(w / 2).strength(0.06))
        .force('y', d3.forceY<BubbleNode>(h / 2).strength(0.06))
        .force('collide', d3.forceCollide<BubbleNode>((d: BubbleNode) => d.r + 2).iterations(3))
        .velocityDecay(0.35)
        .alphaDecay(0.015)
        .on('tick', () => {
          if (!svgRef.current) return
          d3.select(svgRef.current)
            .selectAll<SVGGElement, BubbleNode>('.bbl')
            .attr('transform', (d: BubbleNode) => `translate(${d.x ?? 0},${d.y ?? 0})`)
        })
    } else {
      simRef.current
        .force('x', d3.forceX<BubbleNode>(w / 2).strength(0.06))
        .force('y', d3.forceY<BubbleNode>(h / 2).strength(0.06))
        .alpha(0.3).restart()
    }
  }, [chartSize])

  /* ── draw / update bubbles ── */
  useEffect(() => {
    if (!data.length || !svgRef.current || !chartSize.w || !chartSize.h) return
    const { w, h } = chartSize
    const svg = d3.select(svgRef.current).attr('width', w).attr('height', h)

    /* year watermark */
    svg.selectAll<SVGTextElement, number>('.yr-wm')
      .data([year])
      .join('text')
      .attr('class', 'yr-wm')
      .attr('x', w / 2).attr('y', h / 2)
      .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
      .attr('fill', 'var(--border)')
      .attr('font-size', Math.min(w, h) * 0.28)
      .attr('font-weight', 700)
      .attr('font-family', 'var(--mono)')
      .attr('pointer-events', 'none')
      .attr('user-select', 'none')
      .text(year)

    /* top N for this year */
    const yearData = data
      .filter((d: AirlinePoint) => d.year === year)
      .sort((a: AirlinePoint, b: AirlinePoint) => b[metric] - a[metric])
      .slice(0, TOP_N)

    const maxVal = d3.max(yearData, (d: AirlinePoint) => d[metric]) ?? 1
    const maxR   = Math.min(w, h) * 0.21
    const rScale = d3.scaleSqrt().domain([0, maxVal]).range([0, maxR])

    /* merge with existing nodes to preserve positions */
    const existing = new Map(nodesRef.current.map(n => [n.key, n]))
    const newNodes: BubbleNode[] = yearData.map((d: AirlinePoint, i: number) => {
      const prev = existing.get(d.key)
      const r    = Math.max(rScale(d[metric]), 6)
      if (prev) {
        prev.value    = d[metric]
        prev.name     = d.name
        prev.r        = r
        prev.colorIdx = i
        return prev
      }
      return {
        key: d.key, name: d.name, value: d[metric], r, colorIdx: i,
        x: w / 2 + (Math.random() - 0.5) * w * 0.3,
        y: h / 2 + (Math.random() - 0.5) * h * 0.3,
      }
    })
    nodesRef.current = newNodes

    const color = (d: BubbleNode) => PALETTE[d.colorIdx % PALETTE.length]

    /* D3 join */
    const groups = svg.selectAll<SVGGElement, BubbleNode>('.bbl')
      .data(newNodes, (d: BubbleNode) => d.key)

    groups.exit()
      .transition().duration(250)
      .attr('opacity', 0).remove()

    const entered = groups.enter()
      .append('g').attr('class', 'bbl')
      .attr('opacity', 0)
      .attr('transform', (d: BubbleNode) =>
        `translate(${d.x ?? w / 2},${d.y ?? h / 2})`)

    entered.append('circle')
    entered.append('text')
      .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
      .attr('pointer-events', 'none').attr('font-family', 'var(--sans)')

    const all = entered.merge(groups)

    all.transition().duration(250).attr('opacity', 1)

    all.select<SVGCircleElement>('circle')
      .transition().duration(350)
      .attr('r', (d: BubbleNode) => d.r)
      .attr('fill', (d: BubbleNode) => hexToRgba(color(d), 0.15))
      .attr('stroke', (d: BubbleNode) => color(d))
      .attr('stroke-width', 1.5)

    all.select<SVGTextElement>('text')
      .text((d: BubbleNode) => d.r >= 20 ? d.name : '')
      .attr('fill', 'var(--text-h)')
      .attr('font-size', (d: BubbleNode) => Math.max(Math.min(d.r * 0.27, 12), 7))

    /* tooltip */
    all
      .on('mouseover', (event: MouseEvent, d: BubbleNode) => {
        d3.select(event.currentTarget as SVGGElement)
          .select('circle').attr('stroke-width', 2.5).attr('fill', hexToRgba(color(d), 0.28))
        if (!chartRef.current) return
        const tip = d3.select<HTMLDivElement, unknown>('.viz2-tooltip')
        const rect = chartRef.current.getBoundingClientRect()
        tip.style('display', 'block')
          .html(`<span class="viz2-tt-name" style="color:${color(d)}">${d.name}</span><br/>${d.value} ${metric}`)
          .style('left', `${Math.min(event.clientX - rect.left + 12, chartSize.w - 160)}px`)
          .style('top',  `${Math.max(event.clientY - rect.top  - 50, 4)}px`)
      })
      .on('mousemove', (event: MouseEvent) => {
        if (!chartRef.current) return
        const rect = chartRef.current.getBoundingClientRect()
        d3.select<HTMLDivElement, unknown>('.viz2-tooltip')
          .style('left', `${Math.min(event.clientX - rect.left + 12, chartSize.w - 160)}px`)
          .style('top',  `${Math.max(event.clientY - rect.top  - 50, 4)}px`)
      })
      .on('mouseout', (event: MouseEvent, d: BubbleNode) => {
        d3.select(event.currentTarget as SVGGElement)
          .select('circle').attr('stroke-width', 1.5).attr('fill', hexToRgba(color(d), 0.15))
        d3.select('.viz2-tooltip').style('display', 'none')
      })

    /* drag — free movement, snaps back on release */
    const drag = d3.drag<SVGGElement, BubbleNode>()
      .on('start', (_ev: d3.D3DragEvent<SVGGElement, BubbleNode, BubbleNode>, d: BubbleNode) => {
        simRef.current?.alphaTarget(0.3).restart()
        d.fx = d.x; d.fy = d.y
        d.__restX = d.x ?? 0; d.__restY = d.y ?? 0
        d3.select(_ev.sourceEvent.target as SVGCircleElement).attr('stroke-width', 2.5)
      })
      .on('drag', (ev: d3.D3DragEvent<SVGGElement, BubbleNode, BubbleNode>, d: BubbleNode) => {
        d.fx = ev.x
        d.fy = ev.y
      })
      .on('end', (ev: d3.D3DragEvent<SVGGElement, BubbleNode, BubbleNode>, d: BubbleNode) => {
        simRef.current?.alphaTarget(0)
        d3.select(ev.sourceEvent.target as SVGCircleElement).attr('stroke-width', 1.5)
        // give an initial velocity toward rest position for a snappy return
        d.vx = ((d.__restX ?? 0) - (d.x ?? 0)) * 0.35
        d.vy = ((d.__restY ?? 0) - (d.y ?? 0)) * 0.35
        d.fx = null; d.fy = null
        simRef.current?.alpha(0.45).restart()
      })

    all.call(drag)

    /* restart simulation */
    if (simRef.current) {
      simRef.current
        .nodes(newNodes)
        .force('collide',
          d3.forceCollide<BubbleNode>((d: BubbleNode) => d.r + 2).iterations(3))
        .alpha(0.45).restart()
    }
  }, [data, year, metric, chartSize])

  /* cleanup */
  useEffect(() => () => { simRef.current?.stop() }, [])

  const pct = ((year - YEAR_MIN) / (YEAR_MAX - YEAR_MIN)) * 100

  return (
    <div className="section" id="section2">
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

          <div className="viz2-inner">
            {/* controls */}
            <div className="viz2-controls">
              <select
                className="viz2-select"
                value={metric}
                onChange={e => setMetric(e.target.value as Metric)}
              >
                <option value="incidents">Incidents</option>
                <option value="fatalities">Fatalities</option>
              </select>
            </div>

            {/* chart */}
            <div className="viz2-chart" ref={chartRef}>
              <svg ref={svgRef} style={{ display: 'block' }} />
              <div className="viz2-tooltip" style={{ display: 'none' }} />
            </div>

            {/* timeline */}
            <div className="viz2-timeline">
              <span className="viz2-yr-edge">{YEAR_MIN}</span>

              <div className="viz2-slider-wrap">
                <button
                  className="viz2-play-btn"
                  onClick={() => setPlaying(p => !p)}
                  aria-label={playing ? 'Pause' : 'Play'}
                >
                  {playing
                    ? <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><rect x="5" y="4" width="4" height="16"/><rect x="15" y="4" width="4" height="16"/></svg>
                    : <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
                  }
                </button>

                <div className="viz2-track-wrap">
                  <div className="viz2-track-fill" style={{ width: `${pct}%` }} />
                  <span className="viz2-yr-thumb-label" style={{ left: `${pct}%` }}>{year}</span>
                  <input
                    type="range"
                    className="viz2-slider"
                    min={YEAR_MIN} max={YEAR_MAX}
                    value={year}
                    onChange={e => { setPlaying(false); setYear(Number(e.target.value)) }}
                  />
                </div>
              </div>

              <span className="viz2-yr-edge">{YEAR_MAX}</span>
            </div>
          </div>
        </div>

        <div className="paragraph">
          <p className="section-badge">/ Visualization 02</p>
          <h1 className="viz-title">Safety record of airlines</h1>
          <p>
            What about airlines? What is the correlation between the name of a flight operator and its risk of incident/accident? Each bubble represents one of the top airlines by incident count. Its size reflects the number of incidents or fatalities in the selected year. Drag the slider or press play to watch how the record evolves from 1920 to 2024.
          </p>
        </div>
      </div>
    </div>
  )
}

export default Viz2

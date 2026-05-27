import { useFullscreen } from '../hooks/useFullscreen'
import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import { feature } from 'topojson-client'
import type { FeatureCollection, Geometry } from 'geojson'
import './Viz4.css'

interface Route {
  year: number
  operator: string
  ac_type: string
  fatalities: number
  aboard: number
  dep: [number, number]
  arr: [number, number]
  depCity: string
  arrCity: string
  location: string
  loc?: [number, number]   // precise city-level coordinates
  locIso?: number          // country ISO numeric — used as approximate fallback
}

const YEAR_MIN = 1916
const YEAR_MAX = 2024
const AUTO_ROTATE_SPEED = 0.0008  // 5x slower than before (~450s / rotation)
const AUTO_ROTATE_IDLE_MS = 2500
const FAT_DOMAIN_MAX = 350         // ~95th percentile; saturates the red end

const Viz4: React.FC = () => {
  const { ref: widgetRef, isFullscreen, toggle } = useFullscreen()
  const svgRef       = useRef<SVGSVGElement>(null)
  const tooltipRef   = useRef<HTMLDivElement>(null)
  const chartRef     = useRef<HTMLDivElement>(null)
  const rotateRef    = useRef<[number, number, number]>([0, -20, 0])
  const rafRef       = useRef<number | null>(null)
  const lastTickRef  = useRef<number | null>(null)
  const lastUserInput= useRef<number>(0)
  const draggingRef  = useRef<boolean>(false)
  const hoveringRef  = useRef<boolean>(false)
  const pinnedRouteRef = useRef<Route | null>(null)

  const [data,     setData]     = useState<Route[]>([])
  const [world,    setWorld]    = useState<FeatureCollection<Geometry> | null>(null)
  const [yearFrom, setYearFrom] = useState(1990)
  const [yearTo,   setYearTo]   = useState(2024)
  const [size,     setSize]     = useState({ w: 0, h: 0 })

  /* ── data fetch ── */
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/crashed_routes.json`)
      .then(r => r.json())
      .then(setData)

    fetch(`${import.meta.env.BASE_URL}data/countries-110m.json`)
      .then(r => r.json())
      .then((topo: any) => {
        const fc = feature(topo, topo.objects.countries) as unknown as FeatureCollection<Geometry>
        setWorld(fc)
      })
  }, [])

  /* ── resize observer (with synchronous initial read so we don't depend on RO's
        first notification, which can be delayed if the tab is backgrounded) ── */
  useEffect(() => {
    const el = chartRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    if (r.width > 0 && r.height > 0) {
      setSize({ w: Math.floor(r.width), h: Math.floor(r.height) })
    }
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      setSize({ w: Math.floor(width), h: Math.floor(height) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  /* ── main draw effect + auto-rotate loop ── */
  useEffect(() => {
    if (!world || !svgRef.current || size.w <= 0 || size.h <= 0) return
    const TT_OFFSET = 10  // gap between cursor and tooltip edge
    const { w, h } = size
    const svg = d3.select(svgRef.current).attr('width', w).attr('height', h)
    svg.selectAll('*').remove()

    /* No more radial-gradient blobs for the dots — they were too prominent.
       Endpoint dots are now simple thin-ringed circles, scaled with globe size. */

    const projection = d3.geoOrthographic()
      .scale(Math.min(w, h) / 2.05)   // slightly larger globe — fills the widget
      .translate([w / 2, h / 2])
      .rotate(rotateRef.current)
      .clipAngle(90)
    const globeR = projection.scale()

    const path = d3.geoPath(projection)

    // Outer ocean sphere
    const sphere = svg.append('path')
      .datum({ type: 'Sphere' } as any)
      .attr('d', path as any)
      .attr('fill', 'var(--bg-elevated)')
      .attr('stroke', 'var(--border)')
      .attr('stroke-width', 0.6)

    // Graticule
    const graticulePath = svg.append('path')
      .datum(d3.geoGraticule10() as any)
      .attr('d', path as any)
      .attr('fill', 'none')
      .attr('stroke', 'var(--border)')
      .attr('stroke-width', 0.4)
      .attr('stroke-opacity', 0.55)

    // Land
    const landPaths = svg.append('g')
      .selectAll('path')
      .data(world.features as any[])
      .join('path')
      .attr('d', path as any)
      .attr('fill', 'var(--bg-card)')
      .attr('stroke', 'var(--border)')
      .attr('stroke-width', 0.35)

    const routesG = svg.append('g').attr('class', 'globe-routes')
    const dotsG   = svg.append('g').attr('class', 'globe-dots')
    const crashG  = svg.append('g').attr('class', 'globe-crash')

    /* fatality-driven color scale: gentle yellow -> deep red, sqrt-warped
       so small fatality counts already show up in warm colours */
    const fatScale = d3.scaleSequential(d3.interpolateYlOrRd)
      .domain([0, 1])
      .clamp(true)
    const fatNorm = (n: number) => Math.sqrt(Math.min(n, FAT_DOMAIN_MAX) / FAT_DOMAIN_MAX)
    const colorOf = (d: Route) => d.fatalities > 0
      ? fatScale(fatNorm(d.fatalities))
      : 'rgba(160,180,200,0.55)'  // neutral grey-blue for zero-fatality incidents

    /* visibility test against current rotation */
    const isVisible = (coords: [number, number]) => {
      const r = projection.rotate()
      const cosc = Math.sin(coords[1] * Math.PI / 180) * Math.sin(-r[1] * Math.PI / 180) +
                   Math.cos(coords[1] * Math.PI / 180) * Math.cos(-r[1] * Math.PI / 180) *
                   Math.cos((coords[0] + r[0]) * Math.PI / 180)
      return cosc > 0
    }

    /* Build a quick ISO-numeric -> country-centroid map from the topojson.
       Used to position the approximate crash X when we know the country of
       the crash but not the exact city. */
    const countryCentroid = new Map<number, [number, number]>()
    for (const f of world.features as any[]) {
      const iso = Number(f.id)
      if (!Number.isFinite(iso)) continue
      const c = d3.geoCentroid(f) as [number, number]
      if (Number.isFinite(c[0]) && Number.isFinite(c[1])) countryCentroid.set(iso, c)
    }

    /* Resolve a Route to its best-effort crash coordinate.
       Returns null when no marker should be drawn at all (ocean, unknown). */
    const crashCoord = (d: Route): [number, number] | null => {
      if (d.loc) return d.loc
      if (d.locIso != null) return countryCentroid.get(d.locIso) ?? null
      return null
    }
    const isApproxCrash = (d: Route) => !d.loc

    const redraw = () => {
      projection.rotate(rotateRef.current)
      sphere.attr('d', path as any)
      graticulePath.attr('d', path as any)
      landPaths.attr('d', path as any)
      routesG.selectAll<SVGPathElement, Route>('path.route')
        .attr('d', (d: Route) => path({ type: 'LineString', coordinates: [d.dep, d.arr] } as any) as string)
      routesG.selectAll<SVGPathElement, Route>('path.route-hit')
        .attr('d', (d: Route) => path({ type: 'LineString', coordinates: [d.dep, d.arr] } as any) as string)
      dotsG.selectAll<SVGGElement, {pt: [number, number]; kind: 'dep'|'arr'}>('g.dot')
        .each(function (d) {
          const p = projection(d.pt)
          const vis = isVisible(d.pt) && !!p
          const sel = d3.select(this)
          // preserve data-focus state (set by focusRoute/clearFocus); only this
          // controls user-visible fading. We just need to move the element.
          sel.attr('transform', p ? `translate(${p[0]},${p[1]})` : 'translate(-9999,-9999)')
          // Hide entirely if on the back hemisphere (regardless of focus)
          sel.attr('data-vis', vis ? '1' : '0')
        })
      crashG.selectAll<SVGGElement, Route>('g.crash')
        .each(function (d) {
          const c = crashCoord(d)
          if (!c) {
            d3.select(this).attr('opacity', 0)
            return
          }
          const p = projection(c)
          const vis = isVisible(c) && !!p
          d3.select(this)
            .attr('transform', p ? `translate(${p[0]},${p[1]})` : 'translate(-9999,-9999)')
            .attr('opacity', d3.select(this).attr('data-shown') === '1' && vis ? 1 : 0)
        })
    }

    /* drag-to-rotate */
    const drag = d3.drag<SVGSVGElement, unknown>()
      .on('start', () => { draggingRef.current = true; lastUserInput.current = performance.now() })
      .on('drag', (ev: any) => {
        const r = rotateRef.current
        const k = 0.4
        rotateRef.current = [r[0] + ev.dx * k, Math.max(-90, Math.min(90, r[1] - ev.dy * k)), r[2]]
        lastUserInput.current = performance.now()
        redraw()
      })
      .on('end', () => { draggingRef.current = false; lastUserInput.current = performance.now() })
    svg.call(drag as any)

    /* auto-rotate when idle and not interacting */
    const loop = (t: number) => {
      const dt = lastTickRef.current == null ? 0 : t - lastTickRef.current
      lastTickRef.current = t
      const idleFor = t - lastUserInput.current
      if (!draggingRef.current && !hoveringRef.current && idleFor > AUTO_ROTATE_IDLE_MS) {
        rotateRef.current = [
          rotateRef.current[0] + AUTO_ROTATE_SPEED * dt,
          rotateRef.current[1],
          rotateRef.current[2],
        ]
        redraw()
      }
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)

    // Re-pin previously selected route if it survives the new filter
    pinnedRouteRef.current = null
    drawRoutes()
    redraw()

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
      lastTickRef.current = null
    }

    function drawRoutes() {
      const filtered = data.filter(d => d.year >= yearFrom && d.year <= yearTo)

      /* visible lines */
      const lines = routesG.selectAll<SVGPathElement, Route>('path.route')
        .data(filtered)
      lines.exit().remove()
      lines.enter().append('path')
        .attr('class', 'route')
        .attr('fill', 'none')
        .attr('stroke-linecap', 'round')
        .merge(lines as any)
        .attr('d', (d: Route) => path({ type: 'LineString', coordinates: [d.dep, d.arr] } as any) as string)
        .attr('stroke', colorOf)
        .attr('stroke-width', 1.6)
        .attr('stroke-opacity', 0.72)

      /* wide invisible hit-area on top */
      const hits = routesG.selectAll<SVGPathElement, Route>('path.route-hit')
        .data(filtered)
      hits.exit().remove()
      hits.enter().append('path')
        .attr('class', 'route-hit')
        .attr('fill', 'none')
        .attr('stroke', 'transparent')
        .attr('stroke-width', 11)
        .attr('stroke-linecap', 'round')
        .style('cursor', 'pointer')
        .merge(hits as any)
        .attr('d', (d: Route) => path({ type: 'LineString', coordinates: [d.dep, d.arr] } as any) as string)
        .on('mouseover', function (event: MouseEvent, d: Route) {
          if (pinnedRouteRef.current) return   // ignore hovers while pinned
          hoveringRef.current = true
          focusRoute(d)
          crashG.selectAll<SVGGElement, Route>('g.crash')
            .attr('data-shown', (o: Route) => o === d ? '1' : '0')
          showTip(event, d, false)
          redraw()
        })
        .on('mousemove', function (event: MouseEvent) {
          if (pinnedRouteRef.current) return
          positionTip(event)
        })
        .on('mouseout', function () {
          if (pinnedRouteRef.current) return
          hoveringRef.current = false
          lastUserInput.current = performance.now()
          clearFocus()
          crashG.selectAll<SVGGElement, Route>('g.crash').attr('data-shown', '0')
          hideTip()
          redraw()
        })
        .on('click', function (event: MouseEvent, d: Route) {
          event.stopPropagation()
          if (pinnedRouteRef.current === d) {
            // clicking pinned route again unpins
            unpinRoute()
          } else {
            // pin a new route (focusRoute re-applies styling for everything)
            pinnedRouteRef.current = d
            hoveringRef.current = true
            // rotate the globe so both endpoints are in the visible hemisphere:
            // point the camera at the great-circle midpoint of the route.
            const mid = d3.geoInterpolate(d.dep, d.arr)(0.5) as [number, number]
            rotateRef.current = [-mid[0], -mid[1], 0]
            focusRoute(d)
            crashG.selectAll<SVGGElement, Route>('g.crash')
              .attr('data-shown', (o: Route) => o === d ? '1' : '0')
            showTip(event, d, true)
            redraw()
          }
        })

      /* endpoint dots — small thin-ringed circles, scaled with globe radius
         dep = hollow ring with small dot inside (origin marker)
         arr = filled cyan disc with thin outer ring (destination marker) */
      const baseR = Math.max(1.4, globeR / 90)   // ~2.5 at full size, ~1.7 when small
      type DotDatum = { pt: [number, number]; kind: 'dep' | 'arr'; route: Route }
      const dots: DotDatum[] = filtered.flatMap(r => [
        { pt: r.dep, kind: 'dep' as const, route: r },
        { pt: r.arr, kind: 'arr' as const, route: r },
      ])
      const ds = dotsG.selectAll<SVGGElement, DotDatum>('g.dot').data(dots)
      ds.exit().remove()
      const dsEnter = ds.enter().append('g').attr('class', 'dot')
        .attr('data-focus', '1')
        .style('pointer-events', 'none')
      dsEnter.append('circle').attr('class', 'dot-outer')
      dsEnter.append('circle').attr('class', 'dot-inner')
      dsEnter.merge(ds as any)
      /* Both endpoints look identical: same turquoise fill, same white outer
         ring. The only difference is that the arrival dot has a small white
         core marking the destination. */
      const DOT_FILL = 'rgb(0, 196, 220)'        // turquoise
      const DOT_RING = 'rgba(255, 255, 255, 0.9)' // white border
      dotsG.selectAll<SVGCircleElement, DotDatum>('circle.dot-outer')
        .attr('r', baseR * 1.4)
        .attr('fill', DOT_FILL)
        .attr('fill-opacity', 0.9)
        .attr('stroke', DOT_RING)
        .attr('stroke-width', 1.0)
      dotsG.selectAll<SVGCircleElement, DotDatum>('circle.dot-inner')
        .attr('r', (d: DotDatum) => d.kind === 'arr' ? baseR * 0.4 : 0)
        .attr('fill', '#ffffff')
        .attr('stroke', 'none')

      /* crash X markers — only routes with at least country-level resolution
         get a marker. Precise (city) → solid X; country-centroid only →
         dashed X with an "approx." label. */
      const markable = filtered.filter(d => !!crashCoord(d))
      const cm = crashG.selectAll<SVGGElement, Route>('g.crash').data(markable)
      cm.exit().remove()
      const cmEnter = cm.enter().append('g').attr('class', 'crash').attr('data-shown', '0')
        .style('pointer-events', 'none')
      cmEnter.append('circle').attr('class', 'crash-glow').attr('r', 10)
        .attr('fill', 'rgba(255,90,90,0.18)')
      cmEnter.append('line').attr('class', 'crash-x').attr('x1', -4).attr('y1', -4).attr('x2', 4).attr('y2', 4)
      cmEnter.append('line').attr('class', 'crash-x').attr('x1', -4).attr('y1', 4).attr('x2', 4).attr('y2', -4)
      cmEnter.append('text').attr('class', 'crash-aprx')
        .attr('y', -8).attr('text-anchor', 'middle')
        .attr('font-family', 'var(--mono)').attr('font-size', 8)
        .attr('fill', '#ff7a7a').attr('pointer-events', 'none')
      crashG.selectAll<SVGLineElement, Route>('line.crash-x')
        .attr('stroke', '#ff5a5a').attr('stroke-width', 1.8).attr('stroke-linecap', 'round')
      crashG.selectAll<SVGGElement, Route>('g.crash').each(function (d) {
        const approx = isApproxCrash(d)
        const g = d3.select(this)
        g.select('text.crash-aprx').text(approx ? 'approx.' : '')
        g.selectAll('line.crash-x').attr('stroke-dasharray', approx ? '2,2' : '')
      })
    }

    /* selection / focus helpers — fade everything that's not the selected route */
    function focusRoute(d: Route) {
      // Routes: selected one stays at full colour & gets thicker; everything else fades to a faint grey.
      routesG.selectAll<SVGPathElement, Route>('path.route')
        .attr('stroke-width', (o: Route) => o === d ? 2.8 : 1.4)
        .attr('stroke-opacity', (o: Route) => o === d ? 1 : 0.12)
        .attr('stroke', (o: Route) => o === d ? colorOf(o) : 'rgba(150,150,165,0.9)')
      // Dots: only the selected route's dep & arr stay visible.
      dotsG.selectAll<SVGGElement, {pt: [number, number]; kind: 'dep'|'arr'; route?: Route}>('g.dot')
        .attr('data-focus', function (o) { return (o as any).route === d ? '1' : '0' })
    }
    function clearFocus() {
      routesG.selectAll<SVGPathElement, Route>('path.route')
        .attr('stroke-width', 1.6)
        .attr('stroke-opacity', 0.72)
        .attr('stroke', colorOf)
      dotsG.selectAll('g.dot').attr('data-focus', '1')
    }
    function unpinRoute() {
      pinnedRouteRef.current = null
      hoveringRef.current = false
      lastUserInput.current = performance.now()
      clearFocus()
      crashG.selectAll<SVGGElement, Route>('g.crash').attr('data-shown', '0')
      hideTip()
      redraw()
    }

    /* tooltip helpers (TT_OFFSET declared at top of effect so handlers
       attached during drawRoutes() never see it in the TDZ) */
    function showTip(event: MouseEvent, d: Route, pinned: boolean) {
      if (!tooltipRef.current || !widgetRef.current) return
      const aprx = isApproxCrash(d) ? ' <span class="viz4-tt-aprx">(approx.)</span>' : ''
      const closeBtn = pinned
        ? `<button class="viz4-tt-close" aria-label="Unpin route" type="button">×</button>`
        : ''
      const pinHint = pinned ? '' : '<div class="viz4-tt-hint">click to pin</div>'
      tooltipRef.current.innerHTML = `
        ${closeBtn}
        <div class="viz4-tt-title">${escapeHtml(d.depCity)} → ${escapeHtml(d.arrCity)}</div>
        <div class="viz4-tt-row"><span>Year</span><b>${d.year}</b></div>
        <div class="viz4-tt-row"><span>Operator</span><b>${escapeHtml(d.operator) || '—'}</b></div>
        <div class="viz4-tt-row"><span>Aircraft</span><b>${escapeHtml(d.ac_type) || '—'}</b></div>
        <div class="viz4-tt-row"><span>Casualties</span><b>${d.fatalities} / ${d.aboard}</b></div>
        ${d.location ? `<div class="viz4-tt-loc">Crashed near${aprx}<br/><b>${escapeHtml(d.location)}</b></div>` : ''}
        ${pinHint}
      `
      tooltipRef.current.style.display = 'block'
      tooltipRef.current.classList.toggle('viz4-tt-pinned', pinned)
      const closeEl = tooltipRef.current.querySelector('.viz4-tt-close') as HTMLButtonElement | null
      if (closeEl) closeEl.onclick = (e) => { e.stopPropagation(); unpinRoute() }
      positionTip(event)
    }
    function positionTip(event: MouseEvent) {
      if (!tooltipRef.current || !widgetRef.current) return
      const rect = widgetRef.current.getBoundingClientRect()
      const tt = tooltipRef.current
      const ttW = tt.offsetWidth  || 230
      const ttH = tt.offsetHeight || 150
      const cx = event.clientX - rect.left
      const cy = event.clientY - rect.top
      // Horizontal: prefer the side of the cursor with more room. If neither
      // side has full room, still place the tooltip on that side and let it
      // pin to the widget edge — better than dumping it across the chart.
      const roomR = rect.width - cx - TT_OFFSET
      const roomL = cx - TT_OFFSET
      let x = (roomR >= ttW || roomR >= roomL)
        ? cx + TT_OFFSET
        : cx - TT_OFFSET - ttW
      x = Math.max(4, Math.min(x, rect.width - ttW - 4))
      // Vertical: same idea — prefer below, fall back above
      const roomB = rect.height - cy - TT_OFFSET
      const roomA = cy - TT_OFFSET
      let y = (roomB >= ttH || roomB >= roomA)
        ? cy + TT_OFFSET
        : cy - TT_OFFSET - ttH
      y = Math.max(4, Math.min(y, rect.height - ttH - 4))
      tt.style.left = `${x}px`
      tt.style.top  = `${y}px`
    }
    function hideTip() {
      if (tooltipRef.current) {
        tooltipRef.current.style.display = 'none'
        tooltipRef.current.classList.remove('viz4-tt-pinned')
      }
    }

    /* clicking anywhere on the svg (but not on a route) unpins */
    svg.on('click', function (event: any) {
      if (!pinnedRouteRef.current) return
      // event.target is the svg / land / dot — unpin
      if ((event.target as Element).closest?.('path.route-hit')) return
      unpinRoute()
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world, data, yearFrom, yearTo, size])

  const filteredCount = data.filter(d => d.year >= yearFrom && d.year <= yearTo).length
  const pctFrom = ((yearFrom - YEAR_MIN) / (YEAR_MAX - YEAR_MIN)) * 100
  const pctTo   = ((yearTo   - YEAR_MIN) / (YEAR_MAX - YEAR_MIN)) * 100

  return (
    <div className="section" id="section4">
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

          <div className="viz4-inner">
            <div className="viz4-info">
              <span className="viz4-info-count">{filteredCount.toLocaleString()}</span>
              <span className="viz4-info-label">routes</span>
              <div className="viz4-range-label">
                <b>{yearFrom}</b><span>-</span><b>{yearTo}</b>
              </div>
            </div>

            <div className="viz4-chart" ref={chartRef}>
              <svg ref={svgRef} style={{ display: 'block', cursor: 'grab' }} />
              <div ref={tooltipRef} className="viz4-tooltip" style={{ display: 'none' }} />
            </div>

            <div className="viz4-timeline">
              <div className="viz4-track-row">
                <span className="viz4-yr-edge">{YEAR_MIN}</span>
                <div className="viz4-track-wrap">
                  <div className="viz4-track" />
                  <div className="viz4-track-fill"
                    style={{ left: `${pctFrom}%`, width: `${pctTo - pctFrom}%` }} />
                  <input type="range" className="viz4-slider viz4-slider-from"
                    min={YEAR_MIN} max={YEAR_MAX} value={yearFrom}
                    onChange={e => setYearFrom(Math.min(Number(e.target.value), yearTo - 1))} />
                  <input type="range" className="viz4-slider viz4-slider-to"
                    min={YEAR_MIN} max={YEAR_MAX} value={yearTo}
                    onChange={e => setYearTo(Math.max(Number(e.target.value), yearFrom + 1))} />
                </div>
                <span className="viz4-yr-edge">{YEAR_MAX}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="paragraph">
          <p className="section-badge">/ Visualization 04</p>
          <h1 className="viz-title">Crashed flight routes around the world</h1>
          <p>
            Each line on the globe is a flight that never made it to its destination. Lines connect the
            departure (white) and arrival (cyan) airports as great-circle arcs, and their colour scales
            with the number of fatalities, pale yellow for incidents with no deaths, deep red for the
            deadliest. Drag the globe to rotate it, or let it spin on its own. Brush the year range below
            to focus on a period. Hover any line to reveal a red X at the crash location (precise where
            it's known, dashed and labelled <em>approx.</em> when only city-level data is available).
          </p>
        </div>
      </div>
    </div>
  )
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]!))
}

export default Viz4

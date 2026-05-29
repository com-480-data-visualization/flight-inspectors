import { useFullscreen } from '../hooks/useFullscreen'
import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import { feature } from 'topojson-client'
import type { FeatureCollection, Geometry } from 'geojson'
import './Viz3.css'

type Metric = 'incidents' | 'fatalities'

interface CountryYear {
  year: number
  iso: number
  name: string
  continent: string
  incidents: number
  fatalities: number
}

interface CountryAgg {
  iso: number
  name: string
  continent: string
  incidents: number
  fatalities: number
}

interface CountryFeatureProps {
  name?: string
}

const YEAR_MIN = 1908
const YEAR_MAX = 2024

/* Latitude band the heatmap shows. Anything south of HEAT_LAT_MIN is cropped
   so Antarctica doesn't waste space — other continents fill the widget. */
const HEAT_LAT_MIN = -55
const HEAT_LAT_MAX = 84

/* Mercator projection that exactly fits the latitude band (-55, 84) into the
   given pixel box. We compute scale + translate manually because d3.geoBounds
   treats any dateline-spanning polygon as the entire globe, breaking fitExtent. */
function makeHeatProjection(w: number, h: number): d3.GeoProjection {
  const mercY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))
  const yTop = mercY(HEAT_LAT_MAX)
  const yBot = mercY(HEAT_LAT_MIN)
  const yRange = yTop - yBot
  const kByH = h / yRange
  const kByW = w / (2 * Math.PI)
  const k = Math.min(kByH, kByW)
  // Pin lat=HEAT_LAT_MAX to pixel y=0, lon=0 to pixel x=w/2.
  // pixel y(lat) = ty - k * mercY(lat) => ty = k * yTop
  return d3.geoMercator()
    .scale(k)
    .center([0, 0])
    .translate([w / 2, k * yTop])
}

const CONTINENT_COLORS: Record<string, string> = {
  'Africa':        '#f87171',
  'Asia':          '#facc15',
  'Europe':        '#22d3ee',
  'North America': '#a78bfa',
  'Oceania':       '#4ade80',
  'South America': '#fb923c',
}

const Viz3: React.FC = () => {
  const { ref: widgetRef, isFullscreen, toggle } = useFullscreen()
  const heatRef     = useRef<SVGSVGElement>(null)
  const treeRef     = useRef<SVGSVGElement>(null)
  const tooltipRef  = useRef<HTMLDivElement>(null)
  const heatWrapRef = useRef<HTMLDivElement>(null)
  const treeWrapRef = useRef<HTMLDivElement>(null)

  const [data,     setData]     = useState<CountryYear[]>([])
  const [world,    setWorld]    = useState<FeatureCollection<Geometry, CountryFeatureProps> | null>(null)
  const [metric,   setMetric]   = useState<Metric>('incidents')
  const [yearFrom, setYearFrom] = useState(1980)
  const [yearTo,   setYearTo]   = useState(2024)
  const [hovered,  setHovered]  = useState<number | null>(null)
  const [heatSize, setHeatSize] = useState({ w: 0, h: 0 })
  const [treeSize, setTreeSize] = useState({ w: 0, h: 0 })

  /* ── data fetch ── */
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/crashes_by_country.json`)
      .then(r => r.json())
      .then(setData)

    fetch(`${import.meta.env.BASE_URL}data/countries-110m.json`)
      .then(r => r.json())
      .then((topo: any) => {
        const fc = feature(topo, topo.objects.countries) as unknown as FeatureCollection<Geometry, CountryFeatureProps>
        setWorld(fc)
      })
  }, [])

  /* ── resize observers ── */
  useEffect(() => {
    const el = heatWrapRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    if (r.width > 0 && r.height > 0) setHeatSize({ w: Math.floor(r.width), h: Math.floor(r.height) })
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      setHeatSize({ w: Math.floor(width), h: Math.floor(height) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const el = treeWrapRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    if (r.width > 0 && r.height > 0) setTreeSize({ w: Math.floor(r.width), h: Math.floor(r.height) })
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      setTreeSize({ w: Math.floor(width), h: Math.floor(height) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  /* ── aggregate over the chosen year range ── */
  const aggregated: CountryAgg[] = (() => {
    const map = new Map<number, CountryAgg>()
    for (const d of data) {
      if (d.year < yearFrom || d.year > yearTo) continue
      const cur = map.get(d.iso)
      if (cur) {
        cur.incidents  += d.incidents
        cur.fatalities += d.fatalities
      } else {
        map.set(d.iso, {
          iso: d.iso, name: d.name, continent: d.continent,
          incidents: d.incidents, fatalities: d.fatalities,
        })
      }
    }
    return [...map.values()]
  })()

  const byIso = new Map(aggregated.map(d => [d.iso, d]))
  const totalIncidents  = aggregated.reduce((s, d) => s + d.incidents,  0)
  const totalFatalities = aggregated.reduce((s, d) => s + d.fatalities, 0)

  /* ── tooltip helpers ── */
  const TT_OFFSET = 10
  const positionTip = (event: MouseEvent) => {
    if (!tooltipRef.current || !widgetRef.current) return
    const rect = widgetRef.current.getBoundingClientRect()
    const tt = tooltipRef.current
    const ttW = tt.offsetWidth  || 180
    const ttH = tt.offsetHeight || 110
    const cx = event.clientX - rect.left
    const cy = event.clientY - rect.top
    const roomR = rect.width - cx - TT_OFFSET
    const roomL = cx - TT_OFFSET
    let x = (roomR >= ttW || roomR >= roomL)
      ? cx + TT_OFFSET
      : cx - TT_OFFSET - ttW
    x = Math.max(4, Math.min(x, rect.width - ttW - 4))
    const roomB = rect.height - cy - TT_OFFSET
    const roomA = cy - TT_OFFSET
    let y = (roomB >= ttH || roomB >= roomA)
      ? cy + TT_OFFSET
      : cy - TT_OFFSET - ttH
    y = Math.max(4, Math.min(y, rect.height - ttH - 4))
    tt.style.left = `${x}px`
    tt.style.top  = `${y}px`
  }
  const showTip = (event: MouseEvent, iso: number) => {
    const d = byIso.get(iso)
    if (!d || !tooltipRef.current) return
    const total = metric === 'incidents' ? totalIncidents : totalFatalities
    const v = d[metric]
    const pct = total > 0 ? (v / total * 100).toFixed(1) : '0.0'
    const swatch = CONTINENT_COLORS[d.continent] || '#888'
    tooltipRef.current.innerHTML = `
      <div class="viz3-tt-title"><span class="viz3-tt-swatch" style="background:${swatch}"></span>${d.name}</div>
      <div class="viz3-tt-row"><span>Incidents</span><b>${d.incidents.toLocaleString()}</b></div>
      <div class="viz3-tt-row"><span>Fatalities</span><b>${d.fatalities.toLocaleString()}</b></div>
      <div class="viz3-tt-row"><span>Share (${metric})</span><b>${pct}%</b></div>
      <div class="viz3-tt-cont">${d.continent}</div>
    `
    tooltipRef.current.style.display = 'block'
    positionTip(event)
  }
  const moveTip = positionTip
  const hideTip = () => {
    if (tooltipRef.current) tooltipRef.current.style.display = 'none'
  }

  /* ── HEATMAP ── */
  useEffect(() => {
    if (!world || !heatRef.current || heatSize.w <= 0 || heatSize.h <= 0) return
    const { w, h } = heatSize
    const svg = d3.select(heatRef.current).attr('width', w).attr('height', h)
    svg.selectAll('*').remove()

    const projection = makeHeatProjection(w, h)
    const path = d3.geoPath(projection)

    const maxVal = d3.max(aggregated, (d: CountryAgg) => d[metric]) || 1
    /* Use Blues clipped to [0.28, 1.0] so even the smallest non-zero countries
       show a clear medium-blue rather than washed-out near-white. */
    const blues = (t: number) => d3.interpolateBlues(0.28 + 0.72 * t)
    const color = d3.scaleSequentialLog(blues).domain([1, maxVal])

    /* Define a clipPath matching the cropped viewport so any country geometry
       that extends below the southern crop (Antarctica) gets clipped cleanly. */
    const clipTop    = projection([0, HEAT_LAT_MAX])?.[1] ?? 0
    const clipBottom = projection([0, HEAT_LAT_MIN])?.[1] ?? h
    svg.append('clipPath').attr('id', 'viz3-heat-clip')
      .append('rect')
      .attr('x', 0).attr('y', clipTop)
      .attr('width', w).attr('height', clipBottom - clipTop)

    // Sea/ocean background covering the cropped Mercator viewport
    svg.append('rect')
      .attr('x', 0).attr('y', clipTop)
      .attr('width', w).attr('height', clipBottom - clipTop)
      .attr('fill', 'var(--bg-elevated)')

    /* Wrap all country paths inside the clip so geometry can't peek through. */
    const countryG = svg.append('g').attr('clip-path', 'url(#viz3-heat-clip)')

    countryG.selectAll('path.country')
      .data(world.features as any[])
      .join('path')
      .attr('class', 'country')
      .attr('d', path as any)
      .attr('fill', (f: any) => {
        const iso = Number(f.id)
        const d = byIso.get(iso)
        return d && d[metric] > 0 ? color(d[metric]) : 'var(--surface-hover)'
      })
      .attr('stroke', 'var(--border)')
      .attr('stroke-width', 0.4)
      .style('cursor', 'pointer')
      .on('mouseover', (event: MouseEvent, f: any) => {
        const iso = Number(f.id)
        if (byIso.has(iso)) {
          setHovered(iso)
          showTip(event, iso)
        }
      })
      .on('mousemove', moveTip)
      .on('mouseout', () => { setHovered(null); hideTip() })

    // Highlight overlay (drawn last so it sits on top, also clipped)
    countryG.append('path').attr('class', 'hl').attr('fill', 'none')
      .attr('stroke', 'var(--accent)').attr('stroke-width', 1.5)
      .attr('pointer-events', 'none')

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world, data, metric, yearFrom, yearTo, heatSize])

  /* ── HEATMAP highlight update ── */
  useEffect(() => {
    if (!world || !heatRef.current) return
    const svg = d3.select(heatRef.current)
    const { w, h } = heatSize
    if (w <= 0) return
    const projection = makeHeatProjection(w, h)
    const path = d3.geoPath(projection)
    const target = hovered != null
      ? world.features.find((f: any) => Number(f.id) === hovered)
      : null
    svg.select('path.hl').attr('d', target ? (path(target as any) ?? '') : '')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hovered, world, heatSize])

  /* ── TREEMAP ── */
  useEffect(() => {
    if (!treeRef.current || treeSize.w <= 0 || treeSize.h <= 0) return
    const { w, h } = treeSize
    const svg = d3.select(treeRef.current).attr('width', w).attr('height', h)
    svg.selectAll('*').remove()

    if (aggregated.length === 0) return

    // Group by continent for hierarchy
    const byContinent = d3.group(aggregated, (d: CountryAgg) => d.continent)
    const root = d3.hierarchy<any>({
      name: 'root',
      children: [...byContinent.entries()].map(([continent, items]) => ({
        name: continent,
        children: items,
      })),
    }).sum((d: any) => d[metric] ?? 0)
      .sort((a: any, b: any) => (b.value ?? 0) - (a.value ?? 0))

    d3.treemap<any>().size([w, h]).paddingInner(1).paddingTop(0).round(true)(root)

    const leaves = root.leaves()

    const cell = svg.selectAll('g.cell')
      .data(leaves)
      .join('g')
      .attr('class', 'cell')
      .attr('transform', (d: any) => `translate(${d.x0},${d.y0})`)
      .style('cursor', 'pointer')

    cell.append('rect')
      .attr('width',  (d: any) => Math.max(0, d.x1 - d.x0))
      .attr('height', (d: any) => Math.max(0, d.y1 - d.y0))
      .attr('fill',   (d: any) => CONTINENT_COLORS[d.data.continent] || '#888')
      .attr('fill-opacity', 0.85)
      .attr('stroke', 'var(--bg-card)')
      .attr('stroke-width', 1)
      .on('mouseover', (event: MouseEvent, d: any) => {
        setHovered(d.data.iso)
        showTip(event, d.data.iso)
      })
      .on('mousemove', moveTip)
      .on('mouseout', () => { setHovered(null); hideTip() })

    /* Font sizes scale with the cell's smaller dimension, capped so big cells
       don't get absurdly large text and small cells still read at a sensible
       minimum (~9 px name, 8 px percentage). Idea is the same as a market-map
       treemap: larger weight = larger label. */
    cell.append('text')
      .attr('font-family', 'var(--sans)')
      .attr('pointer-events', 'none')
      .each(function (d: any) {
        const wrec = d.x1 - d.x0
        const hrec = d.y1 - d.y0
        if (wrec < 20 || hrec < 14) return

        const t = d3.select(this)
        const total = metric === 'incidents' ? totalIncidents : totalFatalities
        const pct = total > 0 ? (d.value / total * 100).toFixed(1) : '0.0'

        // Scale name font with cell size — bigger boxes get bigger labels.
        const nameSize = Math.max(9, Math.min(wrec / 6.5, hrec / 3.5, 28))
        const pctSize  = Math.max(8, Math.min(wrec / 9, hrec / 5, 18))

        const showPct  = hrec >= nameSize * 2.1   // only if there's room

        // Position the name. If both name and pct fit, push the name up
        // slightly so the pair is vertically centred in the cell.
        const padX = Math.max(4, nameSize * 0.35)
        const padY = nameSize + 2
        t.attr('x', padX).attr('y', padY)
          .attr('font-size', nameSize)
          .attr('font-weight', 700)
          .attr('fill', 'rgba(20,20,25,0.9)')   // dark text reads on bright continent fills

        const maxTextW = wrec - padX - 4
        const nameSpan = t.append('tspan').text(d.data.name)
        const node = nameSpan.node() as SVGTextContentElement | null
        if (node) {
          let s = d.data.name as string
          while (s.length > 1 && node.getComputedTextLength() > maxTextW) {
            s = s.slice(0, -1)
            nameSpan.text(s + '…')
          }
        }
        if (showPct) {
          t.append('tspan').attr('x', padX).attr('dy', pctSize * 1.15)
            .attr('font-size', pctSize).attr('font-weight', 500)
            .attr('fill', 'rgba(20,20,25,0.65)').text(`${pct}%`)
        }
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, metric, yearFrom, yearTo, treeSize])

  /* ── TREEMAP highlight update ── */
  useEffect(() => {
    if (!treeRef.current) return
    d3.select(treeRef.current).selectAll<SVGRectElement, any>('g.cell rect')
      .attr('stroke', (d: any) => d.data.iso === hovered ? 'var(--accent)' : 'var(--bg-card)')
      .attr('stroke-width', (d: any) => d.data.iso === hovered ? 2 : 1)
      .attr('fill-opacity', (d: any) => d.data.iso === hovered ? 1 : 0.85)
  }, [hovered])

  return (
    <div className="section" id="section3">
      <div className="viz-container">
        <div className="paragraph">
          <p className="section-badge">/ Visualization 03</p>
          <h1 className="viz-title">Where in the world do planes crash?</h1>
          <p>
            Plane crashes are not distributed evenly across the globe. The choropleth map shades each
            country by its incident count, while the treemap below shows the same data grouped by continent,
            making the relative scale of each region easier to read. The United States alone accounts for
            roughly a fifth of all recorded incidents, partly because of its vastly larger volume of
            domestic flights. Switch between incidents and fatalities, narrow the year range, and hover any
            country to see the figure highlighted in both views at once.
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

          <div className="viz3-inner">
            <div className="viz3-controls">
              <select className="viz3-select" value={metric} onChange={e => setMetric(e.target.value as Metric)}>
                <option value="incidents">Incidents</option>
                <option value="fatalities">Fatalities</option>
              </select>
              <div className="viz3-range-label">
                <b>{yearFrom}</b><span>-</span><b>{yearTo}</b>
              </div>
            </div>

            <div className="viz3-heat" ref={heatWrapRef}>
              <svg ref={heatRef} style={{ display: 'block' }} />
            </div>

            <div className="viz3-tree" ref={treeWrapRef}>
              <svg ref={treeRef} style={{ display: 'block' }} />
            </div>

            <div className="viz3-timeline">
              <div className="viz3-track-row">
                <span className="viz3-yr-edge">{YEAR_MIN}</span>
                <div className="viz3-track-wrap">
                  <div className="viz3-track" />
                  <div className="viz3-track-fill"
                    style={{
                      left:  `${((yearFrom - YEAR_MIN) / (YEAR_MAX - YEAR_MIN)) * 100}%`,
                      width: `${((yearTo   - yearFrom) / (YEAR_MAX - YEAR_MIN)) * 100}%`,
                    }} />
                  <input type="range" className="viz3-slider viz3-slider-from"
                    min={YEAR_MIN} max={YEAR_MAX} value={yearFrom}
                    onChange={e => setYearFrom(Math.min(Number(e.target.value), yearTo))} />
                  <input type="range" className="viz3-slider viz3-slider-to"
                    min={YEAR_MIN} max={YEAR_MAX} value={yearTo}
                    onChange={e => setYearTo(Math.max(Number(e.target.value), yearFrom))} />
                </div>
                <span className="viz3-yr-edge">{YEAR_MAX}</span>
              </div>
            </div>

            <div ref={tooltipRef} className="viz3-tooltip" style={{ display: 'none' }} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default Viz3

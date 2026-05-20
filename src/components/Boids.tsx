import { useEffect, useRef } from 'react'

const NUM_BOIDS = 7
const MAX_SPEED = 1.0
const MIN_SPEED = 0.45

interface Boid { x: number; y: number; vx: number; vy: number }

function initBoid(w: number, h: number): Boid {
  const angle = Math.random() * Math.PI * 2
  const speed = MIN_SPEED + Math.random() * (MAX_SPEED - MIN_SPEED)
  return { x: Math.random() * w, y: Math.random() * h, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed }
}

function clamp(vx: number, vy: number): [number, number] {
  const mag = Math.hypot(vx, vy)
  if (mag === 0) return [MIN_SPEED, 0]
  const m = Math.max(MIN_SPEED, Math.min(MAX_SPEED, mag))
  return [(vx / mag) * m, (vy / mag) * m]
}

function step(boids: Boid[], w: number, h: number): Boid[] {
  return boids.map(b => {
    const dvx = (Math.random() - 0.5) * 0.18
    const dvy = (Math.random() - 0.5) * 0.18
    let [vx, vy] = clamp(b.vx + dvx * 0.1, b.vy + dvy * 0.1)
    let x = b.x + vx, y = b.y + vy
    if (x < -20) x = w + 20; else if (x > w + 20) x = -20
    if (y < -20) y = h + 20; else if (y > h + 20) y = -20
    return { x, y, vx, vy }
  })
}

const PLANE_PATH = new Path2D('M 66.362 90 c -0.062 0 -0.124 -0.006 -0.186 -0.018 c -0.325 -0.062 -0.599 -0.279 -0.73 -0.582 L 48.998 51.788 L 37.192 63.594 l 3.292 10.806 c 0.108 0.353 0.012 0.737 -0.25 0.998 l -6.436 6.436 c -0.23 0.23 -0.557 0.331 -0.88 0.278 c -0.321 -0.057 -0.594 -0.266 -0.732 -0.561 l -7.519 -16.035 L 8.383 57.88 c -0.295 -0.139 -0.504 -0.412 -0.561 -0.732 c -0.056 -0.321 0.047 -0.649 0.278 -0.88 l 6.436 -6.436 c 0.261 -0.261 0.644 -0.354 0.999 -0.25 l 10.805 3.291 l 11.872 -11.872 L 0.599 24.553 c -0.303 -0.132 -0.521 -0.406 -0.582 -0.73 c -0.062 -0.325 0.042 -0.659 0.275 -0.893 l 7.538 -7.538 c 0.239 -0.239 0.583 -0.34 0.914 -0.271 l 45.69 9.658 L 76.979 2.234 C 78.42 0.793 80.335 0 82.372 0 c 2.038 0 3.953 0.793 5.394 2.234 C 89.207 3.675 90 5.59 90 7.627 s -0.793 3.953 -2.234 5.394 L 65.223 35.565 l 9.657 45.69 c 0.069 0.331 -0.032 0.675 -0.271 0.914 l -7.539 7.538 C 66.88 89.896 66.625 90 66.362 90 z')

function drawAirplane(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, color: string) {
  ctx.save()
  ctx.fillStyle = color
  ctx.globalAlpha = 0.6
  ctx.translate(x, y)
  // SVG nose points upper-right (~45°); rotate +45° to align with +x travel direction
  ctx.rotate(angle + Math.PI / 4)
  ctx.scale(0.3, 0.3)
  ctx.translate(-45, -45)  // center the 90×90 path at origin
  ctx.fill(PLANE_PATH)
  ctx.restore()
}

const Boids: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const state = useRef<{ boids: Boid[]; raf: number }>({ boids: [], raf: 0 })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
      if (state.current.boids.length === 0) {
        state.current.boids = Array.from({ length: NUM_BOIDS }, () =>
          initBoid(canvas.width, canvas.height)
        )
      }
    }

    resize()
    window.addEventListener('resize', resize)

    const loop = () => {
      const { width, height } = canvas
      ctx.clearRect(0, 0, width, height)
      const color = getComputedStyle(document.documentElement)
        .getPropertyValue('--accent').trim() || 'rgb(0,234,255)'
      state.current.boids = step(state.current.boids, width, height)
      for (const b of state.current.boids) {
        drawAirplane(ctx, b.x, b.y, Math.atan2(b.vy, b.vx), color)
      }
      state.current.raf = requestAnimationFrame(loop)
    }
    loop()

    return () => {
      cancelAnimationFrame(state.current.raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return <canvas ref={canvasRef} className="hero-boids" />
}

export default Boids

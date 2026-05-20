import { useRef, useState, useEffect } from 'react'

export function useFullscreen() {
  const ref = useRef<HTMLDivElement>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    if (isFullscreen) {
      el.classList.remove('widget--closing')
      el.classList.add('widget--fullscreen')
      document.body.style.overflow = 'hidden'
    } else if (el.classList.contains('widget--fullscreen')) {
      el.classList.add('widget--closing')
      el.addEventListener('animationend', () => {
        el.classList.remove('widget--fullscreen', 'widget--closing')
        document.body.style.overflow = ''
      }, { once: true })
    }
  }, [isFullscreen])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFullscreen(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    return () => {
      ref.current?.classList.remove('widget--fullscreen', 'widget--closing')
      document.body.style.overflow = ''
    }
  }, [])

  const toggle = () => setIsFullscreen(prev => !prev)

  return { ref, isFullscreen, toggle }
}

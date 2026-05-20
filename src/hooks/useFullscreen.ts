import { useRef, useState, useEffect } from 'react'

export function useFullscreen() {
  const ref = useRef<HTMLDivElement>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    const handleChange = () => {
      setIsFullscreen(document.fullscreenElement === ref.current)
    }
    document.addEventListener('fullscreenchange', handleChange)
    return () => document.removeEventListener('fullscreenchange', handleChange)
  }, [])

  const toggle = () => {
    if (!document.fullscreenElement) {
      ref.current?.requestFullscreen()
    } else {
      document.exitFullscreen()
    }
  }

  return { ref, isFullscreen, toggle }
}

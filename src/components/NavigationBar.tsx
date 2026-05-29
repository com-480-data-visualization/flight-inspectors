import { useEffect, useState } from 'react'
import './NavigationBar.css'

const topNavItems = [
  { id: 'hero-section', label: 'Home' },
  { id: 'introduction-section', label: 'Introduction' },
]

const vizItems = [
  { id: 'section1', label: 'Safety record of aircraft manufacturers' },
  { id: 'section2', label: 'Safety record of airlines' },
  { id: 'section3', label: 'Geographic distribution of crashes' },
  { id: 'section4', label: 'Crashed flight routes around the world' },
  { id: 'section5', label: 'Viz 5' },
  { id: 'section6', label: 'Viz 6' },
]

const bottomNavItems = [
  { id: 'about-section', label: 'Team' },
]

const allNavItems = [...topNavItems, ...vizItems, ...bottomNavItems]

const NavigationBar: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [activeSection, setActiveSection] = useState('hero-section')
  const [isVizOpen, setIsVizOpen] = useState(false)
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const stored = localStorage.getItem('theme') as 'dark' | 'light' | null
    if (stored) return stored
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme === 'light' ? 'light' : '')
  }, [theme])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: light)')
    const handleSystemChange = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem('theme')) {
        setTheme(e.matches ? 'light' : 'dark')
      }
    }
    mq.addEventListener('change', handleSystemChange)
    return () => mq.removeEventListener('change', handleSystemChange)
  }, [])

  const toggleTheme = () => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark'
      localStorage.setItem('theme', next)
      return next
    })
  }

  useEffect(() => {
    const updateNavbarState = () => {
      setScrolled(window.scrollY > 20)

      const viewportProbe = window.scrollY + window.innerHeight * 0.35
      let currentSection = allNavItems[0].id

      for (const item of allNavItems) {
        const section = document.getElementById(item.id)
        if (section && viewportProbe >= section.offsetTop) {
          currentSection = item.id
        }
      }

      setActiveSection(currentSection)
    }

    updateNavbarState()
    window.addEventListener('scroll', updateNavbarState)
    window.addEventListener('resize', updateNavbarState)

    return () => {
      window.removeEventListener('scroll', updateNavbarState)
      window.removeEventListener('resize', updateNavbarState)
    }
  }, [])

  const toggleMenu = () => {
    setIsMenuOpen((prev) => !prev)
  }

  const closeMenu = () => {
    setIsMenuOpen(false)
  }

  const vizIsActive = vizItems.some(v => v.id === activeSection)

  return (
    <nav className={`navbar${scrolled ? ' scrolled' : ''}`}>
      <div className="navbar-container">
        <a href="#hero-section" className="navbar-logo" onClick={closeMenu}>
          <span className="navbar-brand">
            FLIGHT INSPECTORS
          </span>
        </a>

        <ul className={`navbar-menu${isMenuOpen ? ' active' : ''}`}>
          {topNavItems.map((item) => (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                className={`navbar-item${activeSection === item.id ? ' active' : ''}`}
                onClick={() => {
                  setActiveSection(item.id)
                  closeMenu()
                }}
              >
                {item.label}
              </a>
            </li>
          ))}

          {/* Desktop: hover dropdown */}
          <li
            className="navbar-dropdown-wrapper"
            onMouseEnter={() => setIsVizOpen(true)}
            onMouseLeave={() => setIsVizOpen(false)}
          >
            <span className={`navbar-item navbar-dropdown-trigger${vizIsActive ? ' active' : ''}`}>
              Visualizations
              <svg
                className={`dropdown-arrow${isVizOpen ? ' open' : ''}`}
                viewBox="0 0 24 24" width="12" height="12"
                fill="none" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round"
              >
                <path d="M6 9l6 6 6-6"/>
              </svg>
            </span>
            <ul className={`navbar-dropdown${isVizOpen ? ' open' : ''}`}>
              <div className="navbar-dropdown-inner">
                {vizItems.map((item) => (
                  <li key={item.id}>
                    <a
                      href={`#${item.id}`}
                      className={`navbar-item${activeSection === item.id ? ' active' : ''}`}
                      onClick={() => {
                        setActiveSection(item.id)
                        closeMenu()
                        setIsVizOpen(false)
                      }}
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </div>
            </ul>
          </li>

          {/* Mobile only: viz items shown flat */}
          {vizItems.map((item) => (
            <li key={`mob-${item.id}`} className="mobile-viz-item">
              <a
                href={`#${item.id}`}
                className={`navbar-item${activeSection === item.id ? ' active' : ''}`}
                onClick={() => {
                  setActiveSection(item.id)
                  closeMenu()
                }}
              >
                {item.label}
              </a>
            </li>
          ))}

          {bottomNavItems.map((item) => (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                className={`navbar-item${activeSection === item.id ? ' active' : ''}`}
                onClick={() => {
                  setActiveSection(item.id)
                  closeMenu()
                }}
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="navbar-right">
          <button
            type="button"
            className="theme-toggle"
            aria-label="Toggle theme"
            onClick={toggleTheme}
          >
            {theme === 'dark' ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5"/>
                <line x1="12" y1="1" x2="12" y2="3"/>
                <line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1" y1="12" x2="3" y2="12"/>
                <line x1="21" y1="12" x2="23" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            )}
          </button>

          <button
            type="button"
            className="mobile-menu-button"
            aria-label="Toggle menu"
            aria-expanded={isMenuOpen}
            onClick={toggleMenu}
          >
            <span className="bar"></span>
            <span className="bar"></span>
            <span className="bar"></span>
          </button>
        </div>
      </div>
    </nav>
  );
}

export default NavigationBar

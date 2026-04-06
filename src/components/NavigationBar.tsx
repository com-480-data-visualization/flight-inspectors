import { useEffect, useState } from 'react'
import './NavigationBar.css'

const navItems = [
  { id: 'hero-section', label: 'Home' },
  { id: 'indtroduction-section', label: 'Presentation' },
  { id: 'section1', label: 'Viz1' },
  { id: 'section2', label: 'Viz2' },
  { id: 'section3', label: 'Viz3' },
  { id: 'section4', label: 'Viz4' },
  { id: 'section5', label: 'Viz5' },
  { id: 'about-section', label: 'About' },
]

const NavigationBar: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [activeSection, setActiveSection] = useState('hero-section')

  useEffect(() => {
    const updateNavbarState = () => {
      setScrolled(window.scrollY > 20)

      const viewportProbe = window.scrollY + window.innerHeight * 0.35
      let currentSection = navItems[0].id

      for (const item of navItems) {
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

  return (
    <nav className={`navbar${scrolled ? ' scrolled' : ''}`}>
      <div className="navbar-container">
        <a href="#hero-section" className="navbar-logo" onClick={closeMenu}>
          <span className="navbar-brand">
            FLIGHT INSPECTORS 
          </span>
        </a>

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

        <ul className={`navbar-menu${isMenuOpen ? ' active' : ''}`}>
          {navItems.map((item) => (
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
      </div>
    </nav>
  );
}

export default NavigationBar
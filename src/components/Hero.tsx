import { useState, useEffect } from 'react'
import './Hero.css'
import { GithubIcon } from './icons/GithubIcon'
import Boids from './Boids'

const stats = [
  { value: '...', label: 'Stat 1' },
  { value: '...', label: 'Stat 2' },
  { value: '...', label: 'Stat 3' },
]

const Hero: React.FC = () => {
  const [displayText, setDisplayText] = useState('')
  const [showCursor, setShowCursor] = useState(true)
  const fullText = 'airline, aircraft, route, year...'

  useEffect(() => {
    let i = 0
    const interval = setInterval(() => {
      setDisplayText(fullText.slice(0, i + 1))
      i++
      if (i >= fullText.length) clearInterval(interval)
    }, 40)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const cursor = setInterval(() => {
      setShowCursor(c => !c)
    }, 530)
    return () => clearInterval(cursor)
  }, [])

  return (
    <div className="hero-content">
      <Boids />
      <div className="hero-container">
        <h1 className="hero-title">
          {/* How safe do you think<br />
          flying <span className="accent-text">really</span> is? */}
          How safe do you think<br />
          flying <span className="accent-text">really</span> is?
        </h1>
        <div className="hero-code">
          <span className="code-keyword">filter</span> by{' '}
          <span className="code-string">{displayText}</span>
          <span className={`cursor ${showCursor ? 'visible' : ''}`}>█</span>
        </div>
        <div className="hero-actions">
          <a href="#introduction-section" className="btn-primary">
            Explore our visualizations
          </a>
          <a href="https://github.com/com-480-data-visualization/flight-inspectors" className="btn-secondary" aria-label="GitHub repository" target="_blank" rel="noopener noreferrer">
            <GithubIcon size={16} style={{marginRight: 8}} />
            GitHub
          </a>
        </div>
        <div className="hero-stats">
          {stats.map((stat) => (
            <div key={stat.label} className="stat-item">
              <span className="stat-value">{stat.value}</span>
              <span className="stat-label">{stat.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default Hero

import './NavigationBar.css'

const NavigationBar: React.FC = () => {
  return (
    <nav className="navigation-bar">
      <div className="nav-content">
        <a href="/" className="nav-logo">Flight Inspectors</a>
        <ul className="nav-links">
          <li><a href="/docs">Documentation</a></li>
          <li><a href="/community">Community</a></li>
          <li><a href="/about">About</a></li>
        </ul>
      </div>
    </nav>
  )
}

export default NavigationBar
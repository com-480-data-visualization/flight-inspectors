import './NavigationBar.css'

const NavigationBar: React.FC = () => {
  return (
    <nav className="navigation-bar">
      <div className="nav-content">
        <a href="/" className="nav-logo">Flight Inspectors</a>
        <ul className="nav-links">
          <li><a href="">Home</a></li>
          <li><a href="">Presentation</a></li>
          <li><a href="">Viz1</a></li>
          <li><a href="">Viz2</a></li>
          <li><a href="">Viz3</a></li>
          <li><a href="">Viz4</a></li>
          <li><a href="">Viz5</a></li>
          <li><a href="">About</a></li>
        </ul>
      </div>
    </nav>
  )
}

export default NavigationBar
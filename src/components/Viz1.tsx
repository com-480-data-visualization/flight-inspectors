import { useFullscreen } from '../hooks/useFullscreen'
import './Viz1.css'

const Viz1: React.FC = () => {
    const { ref, isFullscreen, toggle } = useFullscreen()
    return (
      <div className="section">
        <div className="viz-container">
          <div className="paragraph">
            <p className="section-badge">/ Visualization 01</p>
            <h1 className="viz-title">Compare the safety of different actors in civil aviation throughout history</h1>
            <p>
              Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do
              eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut
              enim ad minim veniam, quis nostrud exercitation ullamco laboris
              nisi ut aliquip ex ea commodo consequat.
            </p>
          </div>
          <div className="widget" ref={ref}>
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
            <h2>
              viz will go here
            </h2>
          </div>
        </div>
      </div>
    );
}

export default Viz1

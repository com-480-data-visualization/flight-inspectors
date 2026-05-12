import './Viz2.css'

const Viz2: React.FC = () => {
    return (
      <div className="section">
        <div className="viz-container">
          <div className="widget">
            <button className="fullscreen-btn" aria-label="Toggle Fullscreen">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
              </svg>
            </button>
            <h2>
              viz will go here
            </h2>
          </div>
          <div className="paragraph">
            <p className="section-badge">/ Visualization 02</p>
            <h1 className="viz-title">Name of visualization</h1>
            <p>
              Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do
              eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut
              enim ad minim veniam, quis nostrud exercitation ullamco laboris
              nisi ut aliquip ex ea commodo consequat.
            </p>
          </div>
        </div>
      </div>
    );
}

export default Viz2

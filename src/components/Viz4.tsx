import './Viz4.css'

const Viz4: React.FC = () => {
    return (
      <div id="section4" className="section">
        <div className="viz_container">
          <div className="paragraph">
            <h2>
                VIZ 4
            </h2>
            <p>
              Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do
              eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut
              enim ad minim veniam, quis nostrud exercitation ullamco laboris
              nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in
              reprehenderit in voluptate velit esse cillum dolore eu fugiat
              nulla pariatur. Excepteur sint occaecat cupidatat non proident,
              sunt in culpa qui officia deserunt mollit anim id est laborum.
            </p>
          </div>
          <div className="widget">
            <button className="fullscreen-btn" aria-label="Toggle Fullscreen">
              <svg viewBox="0 0 24 24" width="20" height="20">
                <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
              </svg>
            </button>
            <h2>data visualization will go here</h2>
          </div>
        </div>
      </div>
    );
}

export default Viz4

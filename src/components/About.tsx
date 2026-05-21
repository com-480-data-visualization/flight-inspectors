import './About.css'

const team = [
  { name: 'Nicolas Karmolinski', contribution: 'Created data visualization ... and ..., ... Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.' },
  { name: 'Roméo Maignal', contribution: 'Worked on the first skeleton of the website and then embellished it with additional decorations, animations and responsive design features. In charge of the two first data visualizations, extracting the corresponding data and implementing the interactive features with D3.js.' },
  { name: 'Jakub Kielar', contribution: 'Created data visualization ... and ..., ... Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.' },
]

const About: React.FC = () => {
  return (
    <div className="about-content">
      <div className="about-inner">
        <p className="section-badge">/ Team</p>
        <h2 className="about-heading">
          Meet the flight inspectors
        </h2>
        <div className="about-grid">
          {team.map((member) => (
            <div key={member.name} className="about-card">
              <div className="about-avatar">
                <span className="avatar-placeholder">
                  {member.name.charAt(0)}
                </span>
              </div>
              <h3 className="about-name">{member.name}</h3>
              <p className="about-contribution">{member.contribution}</p>
            </div>
          ))}
        </div>
        <p className="about-acknowledgement">
          This website has been built in the context of the COM-480:Data-Visualization course at EPFL. It represents the final aggregation of the javascript/typescript knowledge we gained during the semester combined with the rich datasets we selected. The project is open source and available on GitHub. We hope you enjoy exploring the data as much as we enjoyed building this project!
        </p>
        <div className="about-links">
          <a
            href="https://www.kaggle.com/datasets/sobhanmoosavi/us-accidents"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-outline"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Dataset
          </a>
          <a
            href="https://github.com/com-480-data-visualization/flight-inspectors"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-outline"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/>
            </svg>
            Source code
          </a>
        </div>
      </div>
    </div>
  )
}

export default About

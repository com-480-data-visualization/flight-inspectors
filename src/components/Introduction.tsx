import './Introduction.css'

const Introduction: React.FC = () => {
  return (
    <div className="intro-content">
      <div className="intro-inner">
        <p className="section-badge">/ Introduction</p>
        <h2 className="intro-heading">
          Understanding the real risks of air travel
        </h2>
        <div className="intro-grid">
          <div className="intro-card">
            <h3 className="card-title">The Problem</h3>
            <p>
              No matter how safe air travel might be, it's always difficult to
              completely shake off the feeling of insecurity when flying.
            </p>
          </div>
          <div className="intro-card">
            <h3 className="card-title">Our Approach</h3>
            <p>
              We provide an interactive platform to assess air travel safety
              through various visualizations such as routes, airlines, aircraft types,
              and advanced statistical analyses.
            </p>
          </div>
          <div className="intro-card">
            <h3 className="card-title">The Dataset</h3>
            <p>
              Leveraging decades of aviation data, we analyze accident
              frequencies, survival rates, and risk factors across different
              carriers and regions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Introduction

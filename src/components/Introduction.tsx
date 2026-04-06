import './Introduction.css'

const Introduction: React.FC = () => {
  return (
    <div className="abstract-container">
      <div className="abstract">
        <h1>Project of Data Visualization </h1>
        <p>
          No matter how safe air travel might be, it's always difficult to
          completely shake off the feeling of insecurity of flying.
        </p>
        <p>
          In an attempt to address these concerns, we aim to provide an
          interactive platform to assess the safety of air travel and the
          variable risks associated with specific criteria such as routes,
          airlines, and aircraft types through various visualizations, providing
          visitors with insightful analyses on the reliability of agents
          involved in air travel. We also intend to pursue some more in-depth
          analyses, comparing advanced statistical results across different
          actors in the aviation industry, like analyzing the frequency of
          accidents through the lens of a Poisson distribution.
        </p>
      </div>
    </div>
  );
}

export default Introduction
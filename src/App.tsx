import NavigationBar from './components/NavigationBar'
import Hero from './components/Hero'
import Introduction from './components/Introduction'
import Viz1 from './components/Viz1'
import Viz2 from './components/Viz2'
import Viz3 from './components/Viz3'
import Viz4 from './components/Viz4'
import Viz5 from './components/Viz5'
import About from './components/About'

import './App.css'

function App() {
  return (
    <>
      <NavigationBar />

      <section id="hero-section">
        <Hero /> {/* Hero designates the visual element that is meant to capture the visitor's attention (e.g. a large text or image taking most of the space on the screen) */}
      </section>

      <section id="indtroduction-section">
        <Introduction /> {/* Here we present our project, our problematic and our motivations */}
      </section>

      {/* Each section explores a different interpretation of our dataset, by means of a different type of data visualization */}
      <section id="section1">
        <Viz1 />
      </section>

      <section id="section2">
        <Viz2 />
      </section>

      <section id="section3">
        <Viz3 />
      </section>

      <section id="section4">
        <Viz4 />
      </section>

      <section id="section5">
        <Viz5 />
      </section>

      {/* Small presentation of the team, aknowledgement, ... */}
      <section id='about-section'>
        <About />
      </section>
    </>
  );
}

export default App
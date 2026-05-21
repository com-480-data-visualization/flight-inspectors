# Flight Inspectors
Flight Inspectors is a data visualization project that explores the history of plane crashes from 1908 to 2024. The project aims to provide insights into the causes and trends of plane crashes over time, as well as to raise awareness about aviation safety.

## Prerequisites
- [Node.js / NPM](https://nodejs.org/en/download)
- [Git](https://git-scm.com/install/)

## Run
```
npm run dev
```
Open [http://localhost:5174/](http://localhost:5174/) with your browser to view the website.

You can also visit the deployed version of the website hosted on GitHub Pages at [https://com-480-data-visualization.github.io/flight-inspectors/](https://com-480-data-visualization.github.io/flight-inspectors/).

## Analysis
### Datasets
The primary dataset we will be working with is a dataset of plane crashes from 1908 to 2024 found on [Kaggle by Luiscé Francisco](https://www.kaggle.com/datasets/luiscfrancisco/plane-crashes-dataset/data). As a complement, we will be using the airports, routes, and airlines datasets from [OpenFlights](https://openflights.org/data), a free, high-quality and comprehensive aviation database.

### Run the data analysis
The scripts only use Python's standard library — no extra packages are required. They all read from `data/crashes_cleaned.csv`.

**Hero section stats** (prints summary figures to stdout):
```bash
python3 data/hero_stats.py
```

**Viz 1 — incidents & fatalities by manufacturer** (writes `public/data/crashes_by_manufacturer.json`):
```bash
python3 data/viz1/script.py
```

**Viz 2 — incidents & fatalities by airline** (writes `public/data/crashes_by_airline.json`):
```bash
python3 data/viz2/script.py
```

Run all three from the project root. The two viz scripts must be run before `npm run dev` if the JSON files are missing.

## Contributors
| Student's name | SCIPER | Contribution |
| -------------- | ------ | ------------ |
| Nicolas Karmolinski | 316655 | TODO |
| Roméo Maignal | 360568 | Worked on the first skeleton of the website and then embellished it with additional decorations, animations and responsive design features. In charge of the two first data visualizations, extracting the corresponding data and implementing the interactive features with D3.js. |
| Jakub Kielar | 423372| TODO |

## Stack
- Scripting language: [TypeScript](https://www.typescriptlang.org/)
- UI/UX framework: [React](https://react.dev/)
- Build tool & development server: [Vite](https://vite.dev/)
- Runtime environment: [Node.js](https://nodejs.org/en)
- Package manager: [NPM](https://docs.npmjs.com/)
- Data visualization library: [D3](https://d3js.org/)
- Hosting service: [GitHub Pages](https://docs.github.com/en/pages)

<div inline style="display: flex; gap: 1rem; margin-top: 1rem;" bb>
<img width="50" src="https://upload.wikimedia.org/wikipedia/commons/4/4c/Typescript_logo_2020.svg?utm_source=commons.wikimedia.org&utm_campaign=index&utm_content=original" alt="TypeScript" title="TypeScript"/>
<img width="50" src="https://upload.wikimedia.org/wikipedia/commons/a/a7/React-icon.svg?utm_source=commons.wikimedia.org&utm_campaign=index&utm_content=original" alt="React" title="React"/>
<img width="50" src="https://v2.vitejs.dev/logo.svg" alt="Vite" title="Vite"/>
<img width="50" src="https://upload.wikimedia.org/wikipedia/commons/d/d9/Node.js_logo.svg" alt="Node.js" title="Node.js"/>
<img width="50" src="https://upload.wikimedia.org/wikipedia/commons/d/db/Npm-logo.svg?utm_source=commons.wikimedia.org&utm_campaign=index&utm_content=original"/>
<img width="50" src="https://d3js.org/logo.svg"/>
<img width="100" src="https://blog.frankel.ch/assets/resources/refresher-github-pages/github-pages.svg"/>
</div>

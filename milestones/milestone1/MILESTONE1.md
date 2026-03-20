# Project of Data Visualization (COM-480)

| Student's name | SCIPER |
| -------------- | ------ |
| Nicolas Karmolinski | 316655 |
| Roméo Maignal | 360568 |
| Jakub Kielar | 423372|


## Milestone 1 (20th March, 5pm)

**10% of the final grade**

This is a preliminary milestone to let you set up goals for your final project and assess the feasibility of your ideas.
Please, fill the following sections about your project.

*(max. 2000 characters per section)*

### Dataset

The primary dataset we will be working on is a dataset of plane crashes from 1908 to 2024 found on [Kaggle](https://www.kaggle.com/datasets/luiscfrancisco/plane-crashes-dataset/data). This was the most up-to-date dataset we could find that contains relatively complete information on crucial details for our analyses: route, operator and aircraft type. The dataset contains information on every kind of flight possible, thus will require some processing to only keep commercial flights, which is our project's main point of interest. Some slight cleaning might be necessary. The dataset contains many columns, including a couple that we will likely not need, like fuselage number of flight number, the latter of which is quite incomplete. The route column may need to be split into two departure and arrival columns.

As a complement, we will be using the airports, routes, and airlines datasets from [OpenFlights](https://openflights.org/data), a free, high-quality and comprehensive aviation database. In conjunction with our primary dataset, we will be able to relate the plane crashes to geographical locations, priming us for apt visualizations.

### Problematic

Through various data visualizations, we aim to demonstrate the safety of air travel and the variable risks associated with specific criteria such as routes, airlines, and aircraft types. This presentation also aims to compare statistical results across different actors in the aviation industry. We want to provide visitors with insightful analyses on the reliability of companies involved in air travel.

### Exploratory Data Analysis

Some basic cleaning and preprocessing to the crashes dataset is done in [preprocessing.ipynb](../../preprocessing.ipynb). The main operations aim to simplify the dataset by dropping unnecessary columns from the original and formatting columns such that we can relate them back to the OpenFlights datasets. Regarding the latter, as they are high quality, no preprocessing was deemed to be required.

For our final exposition, we aim to address our research objectives through advanced statistics and provide an insighful interpretation of our results. In the meantime, in order to give a preliminary overview of our project, we explore a few fields within our datasets in the following notebook: [preliminary_analysis.ipynb](../../preliminary_analysis.ipynb) .


### Related work

The database we used is technically not yet widely described by researchers. However, similar dataset, closely related to the dataset we used, has been videly investigated and described. The reason we didn’t choose this dataset is the fact that is records finish at year 2009, which makes the dataset a little outdated to use in modern solutions. This dataset was investigated and visualized by Ruslan Klymentiev - [Airplane Crashes Data Visualization](https://www.kaggle.com/code/ruslankl/airplane-crashes-data-visualization) presenting many important information with plots and classification graphs. He investigated the fatalities, differences between military and civil flights statistics, the reliability of operators and many other factors. 
Further investigation of the dataset was found on kaggle platform [Who not to fly with](https://www.kaggle.com/code/garydee/who-not-to-fly-with) that focuses on the accidents and fatalities connected to flight operators. It aims to present reliability of each operator throughout the history.

Another [article](https://www.kaggle.com/code/imdevskp/exploring-historic-air-plane-crash-data) presents crash analytics for models of planes, manufacturers, crash locations and even comparison between early and late hours of the day.

Our approach is original as we aim to discover the chosen flight crashes dataset further and connect the data with dataset of flights, routes and airlines, creating combined set of data. This set would be more meaningful for visualizations and detailed analysis. We aim to present interactive map of the world with routes of flights and places of crashes. We didn’t encounter such combination of data and presentation method during our research of related works, therefore we decided to pick this problematic as we found it very unique.

One of the first inspirations for our work and presenting the routes of given flights was the widely known [FlightRadar](https://www.flightradar24.com/), were the flight can be traced by its unique flight number. The inspiration for presenting data as a map was also the previously mentioned [OpenFlights](https://openflights.org/data) website where we found their map of flight connections, however in a very static manner. However, we wanted to go a bit further and make the map interactive, where user can interact and pick single connection between airports and see the crashes of that very route. Then we approached the [FlightConnections](https://www.flightconnections.com/) website, which presented the data in much more organised and interactive way, where user could pick starting point to see the possible route choices. We wanted to follow such approach, however with presentation of additional data about the crashes, combination that we didn’t encounter during our investigation.


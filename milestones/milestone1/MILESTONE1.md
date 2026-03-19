# Project of Data Visualization (COM-480)

| Student's name | SCIPER |
| -------------- | ------ |
| Nicolas Karmolinski | 316655 |
| Roméo Maignal | 360568 |
| Jakub Kielar | |


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

_Unsure: There are countless statistics to apply to our datasets and endless insights to draw from their analysis._ For our final exposition, we aim to address our research question using sophisticated metrics. In the meantime, [preliminary_analysis.ipynb](../../preliminary_analysis.ipynb) aims to explore several fields within our datasets for a better understanding of what we will be working with.

### Related work


> - What others have already done with the data?
> - Why is your approach original?
> - What source of inspiration do you take? Visualizations that you found on other websites or magazines (might be unrelated to your data).
> - In case you are using a dataset that you have already explored in another context (ML or ADA course, semester project...), you are required to share the report of that work to outline the differences with the submission for this class.

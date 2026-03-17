import matplotlib.pyplot as plt
import pandas as pd

df = pd.read_csv("./../data/crashes.csv")

df["Date"] = pd.to_datetime(df["Date"], format="%B %d, %Y")

df["year"] = df["Date"].dt.year
accidents_per_year = df["year"].value_counts().sort_index()

accidents_per_year.plot(kind="bar", figsize=(15, 5))
plt.title("Flight Accidents per Year")
plt.xlabel("Year")
plt.ylabel("Number of Accidents")
plt.tight_layout()

plt.savefig("accidents_per_year.svg", format="svg")

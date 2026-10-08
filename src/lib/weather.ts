import { cacheLife, cacheTag } from "next/cache";
import type { CityWeather } from "./types";

// Coordinates (not names) are the lookup query so "Naples" can't resolve to
// Naples, Italy. Display names are ours, not the API's.
const CITIES = [
  { city: "Naples, Florida", q: "26.1420,-81.7948" },
  { city: "Cupertino, California", q: "37.3230,-122.0322" },
  { city: "Bentonville, Arkansas", q: "36.3729,-94.2088" },
  { city: "Seattle, Washington", q: "47.6062,-122.3321" },
  { city: "Dubai, UAE", q: "25.2048,55.2708" },
];

async function fetchCurrent(q: string, key: string): Promise<NonNullable<CityWeather["current"]>> {
  const url = new URL("https://api.weatherapi.com/v1/current.json");
  url.searchParams.set("key", key);
  url.searchParams.set("q", q);
  url.searchParams.set("aqi", "no");

  const res = await fetch(url);
  // Don't include the URL in errors: it contains the API key.
  if (!res.ok) throw new Error(`WeatherAPI responded ${res.status}`);

  const { current } = await res.json();
  return {
    temp_f: current.temp_f,
    temp_c: current.temp_c,
    condition: current.condition.text,
    humidity: current.humidity,
    wind_mph: current.wind_mph,
  };
}

// The only access point for weather. A city that fails to load comes back with
// `current: null` so one bad lookup doesn't take down the front page.
export async function getWeather(): Promise<CityWeather[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("weather");

  const key = process.env.WEATHER_API_KEY;
  if (!key) return CITIES.map(({ city }) => ({ city, current: null }));

  const results = await Promise.allSettled(CITIES.map(({ q }) => fetchCurrent(q, key)));
  return CITIES.map(({ city }, i) => {
    const result = results[i];
    return { city, current: result.status === "fulfilled" ? result.value : null };
  });
}

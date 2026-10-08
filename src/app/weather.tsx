import { getWeather } from "@/lib/weather";

export async function WeatherSection() {
  const cities = await getWeather();

  return (
    <section>
      <h2>Weather Around the World</h2>
      <ul className="card-list weather-list">
        {cities.map(({ city, current }) => (
          <li key={city}>
            <h3>{city}</h3>
            {current ? (
              <>
                <p className="weather-temp">
                  {Math.round(current.temp_f)}°F / {Math.round(current.temp_c)}°C
                </p>
                <p>{current.condition}</p>
                <p>
                  Humidity {current.humidity}% · Wind {Math.round(current.wind_mph)} mph
                </p>
              </>
            ) : (
              <p>Unavailable</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

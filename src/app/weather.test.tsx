// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MOCK_WEATHER } from "@/test/fixtures";
import type { CityWeather } from "@/lib/types";

const { getWeather } = vi.hoisted(() => ({ getWeather: vi.fn() }));
vi.mock("@/lib/weather", () => ({ getWeather }));
// Only used by the real getWeather in the last test: Next's cache runtime isn't available here.
vi.mock("next/cache", () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));

import { WeatherSection } from "./weather";

// WeatherSection is an async Server Component: await it, then render the result.
async function renderWeather(data: CityWeather[] = MOCK_WEATHER) {
  getWeather.mockResolvedValue(data);
  render(await WeatherSection());
}

const cityCard = (name: string) => screen.getByRole("heading", { level: 3, name }).closest("li")!;

beforeEach(() => {
  getWeather.mockReset();
});

describe("WeatherSection display", () => {
  it("shows a heading and one card per city, in order", async () => {
    await renderWeather();

    expect(screen.getByRole("heading", { level: 2, name: "Weather Around the World" })).toBeInTheDocument();
    const cities = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(cities).toEqual([
      "Naples, Florida",
      "Cupertino, California",
      "Bentonville, Arkansas",
      "Seattle, Washington",
      "Dubai, UAE",
    ]);
    expect(screen.getAllByRole("listitem")).toHaveLength(5);
  });

  it("shows temperature in both Fahrenheit and Celsius, rounded to whole degrees", async () => {
    await renderWeather();

    expect(within(cityCard("Naples, Florida")).getByText("86°F / 30°C")).toBeInTheDocument();
    expect(within(cityCard("Cupertino, California")).getByText("72°F / 22°C")).toBeInTheDocument();
    expect(within(cityCard("Dubai, UAE")).getByText("105°F / 41°C")).toBeInTheDocument();
  });

  it("shows the sky condition for each city", async () => {
    await renderWeather();

    expect(within(cityCard("Naples, Florida")).getByText("Sunny")).toBeInTheDocument();
    expect(within(cityCard("Bentonville, Arkansas")).getByText("Light rain")).toBeInTheDocument();
    expect(within(cityCard("Seattle, Washington")).getByText("Overcast")).toBeInTheDocument();
  });

  it("shows humidity as a percentage and wind speed rounded to whole mph", async () => {
    await renderWeather();

    expect(within(cityCard("Naples, Florida")).getByText("Humidity 62% · Wind 8 mph")).toBeInTheDocument();
    expect(within(cityCard("Seattle, Washington")).getByText("Humidity 90% · Wind 9 mph")).toBeInTheDocument();
    expect(within(cityCard("Dubai, UAE")).getByText("Humidity 25% · Wind 15 mph")).toBeInTheDocument();
  });

  it("handles freezing and negative temperatures", async () => {
    await renderWeather([
      { city: "Seattle, Washington", current: { temp_f: -4.4, temp_c: -20.2, condition: "Blizzard", humidity: 70, wind_mph: 30 } },
    ]);

    expect(screen.getByText("-4°F / -20°C")).toBeInTheDocument();
  });

  it("does not show 'Unavailable' when every city loads", async () => {
    await renderWeather();
    expect(screen.queryByText("Unavailable")).not.toBeInTheDocument();
  });
});

describe("WeatherSection when a lookup fails", () => {
  it("shows Unavailable for only the failed city and keeps the others", async () => {
    await renderWeather(MOCK_WEATHER.map((w) => (w.city === "Seattle, Washington" ? { ...w, current: null } : w)));

    const seattle = cityCard("Seattle, Washington");
    expect(within(seattle).getByText("Unavailable")).toBeInTheDocument();
    expect(within(seattle).queryByText(/°F/)).not.toBeInTheDocument();
    expect(screen.getAllByText("Unavailable")).toHaveLength(1);
    expect(within(cityCard("Naples, Florida")).getByText("86°F / 30°C")).toBeInTheDocument();
  });

  it("still lists every city when all lookups fail (for example, no API key)", async () => {
    await renderWeather(MOCK_WEATHER.map((w) => ({ ...w, current: null })));

    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(5);
    expect(screen.getAllByText("Unavailable")).toHaveLength(5);
  });

  it("renders no cities (but keeps the heading) if the list is empty", async () => {
    await renderWeather([]);

    expect(screen.getByRole("heading", { level: 2, name: "Weather Around the World" })).toBeInTheDocument();
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });
});

describe("WeatherSection with the real getWeather (WeatherAPI response mocked)", () => {
  // Drives raw WeatherAPI-shaped JSON through lib/weather.ts and into the UI, so a
  // change to the API mapping that breaks the display is caught here.
  it("turns raw API responses into the on-screen display", async () => {
    const actual = await vi.importActual<typeof import("@/lib/weather")>("@/lib/weather");
    getWeather.mockImplementation(actual.getWeather);
    vi.stubEnv("WEATHER_API_KEY", "test-key");

    let call = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        call += 1;
        if (call === 5) return { ok: false, status: 503, json: async () => ({}) }; // Dubai fails
        return {
          ok: true,
          status: 200,
          json: async () => ({
            current: { temp_f: 70.2, temp_c: 21.2, condition: { text: "Mist" }, humidity: 55, wind_mph: 3.4 },
          }),
        };
      }),
    );

    render(await WeatherSection());

    expect(within(cityCard("Naples, Florida")).getByText("70°F / 21°C")).toBeInTheDocument();
    expect(within(cityCard("Naples, Florida")).getByText("Mist")).toBeInTheDocument();
    expect(within(cityCard("Naples, Florida")).getByText("Humidity 55% · Wind 3 mph")).toBeInTheDocument();
    expect(within(cityCard("Dubai, UAE")).getByText("Unavailable")).toBeInTheDocument();
  });
});

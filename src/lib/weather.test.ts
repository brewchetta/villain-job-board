import { beforeEach, describe, expect, it, vi } from "vitest";

const { cacheLife, cacheTag } = vi.hoisted(() => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));
vi.mock("next/cache", () => ({ cacheLife, cacheTag }));

import { getWeather } from "./weather";

const CITY_NAMES = [
  "Naples, Florida",
  "Cupertino, California",
  "Bentonville, Arkansas",
  "Seattle, Washington",
  "Dubai, UAE",
];

const apiBody = (temp: number) => ({
  current: {
    temp_f: temp,
    temp_c: (temp - 32) / 1.8,
    condition: { text: "Sunny", icon: "ignored" },
    humidity: 40,
    wind_mph: 7,
    uv: 3, // extra API fields must not leak through
  },
});

function okResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

beforeEach(() => {
  cacheLife.mockClear();
  cacheTag.mockClear();
});

describe("getWeather", () => {
  it("returns every city as unavailable when no API key is set", async () => {
    vi.stubEnv("WEATHER_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const weather = await getWeather();

    expect(weather.map((w) => w.city)).toEqual(CITY_NAMES);
    expect(weather.every((w) => w.current === null)).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("is cached for minutes under the weather tag", async () => {
    vi.stubEnv("WEATHER_API_KEY", "");
    await getWeather();

    expect(cacheLife).toHaveBeenCalledWith("minutes");
    expect(cacheTag).toHaveBeenCalledWith("weather");
  });

  it("maps the API response to our own shape", async () => {
    vi.stubEnv("WEATHER_API_KEY", "secret-key");
    vi.stubGlobal("fetch", vi.fn(async () => okResponse(apiBody(86))));

    const [first] = await getWeather();

    expect(first).toEqual({
      city: "Naples, Florida",
      current: {
        temp_f: 86,
        temp_c: 30,
        condition: "Sunny",
        humidity: 40,
        wind_mph: 7,
      },
    });
  });

  it("looks cities up by coordinates, with the key, once per city", async () => {
    vi.stubEnv("WEATHER_API_KEY", "secret-key");
    const fetchMock = vi.fn(async () => okResponse(apiBody(70)));
    vi.stubGlobal("fetch", fetchMock);

    await getWeather();

    expect(fetchMock).toHaveBeenCalledTimes(5);
    const urls = (fetchMock.mock.calls as unknown as [URL][]).map(([url]) => new URL(String(url)));
    for (const url of urls) {
      expect(url.origin + url.pathname).toBe("https://api.weatherapi.com/v1/current.json");
      expect(url.searchParams.get("key")).toBe("secret-key");
      expect(url.searchParams.get("aqi")).toBe("no");
      expect(url.searchParams.get("q")).toMatch(/^-?\d+\.\d+,-?\d+\.\d+$/);
    }
    expect(urls[0].searchParams.get("q")).toBe("26.1420,-81.7948");
  });

  it("marks only the failing city as unavailable and keeps the rest", async () => {
    vi.stubEnv("WEATHER_API_KEY", "secret-key");
    let call = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        call += 1;
        // Seattle (4th) answers with an HTTP error, the rest succeed.
        return call === 4 ? { ok: false, status: 500, json: async () => ({}) } : okResponse(apiBody(60));
      }),
    );

    const weather = await getWeather();

    expect(weather.map((w) => w.current === null)).toEqual([false, false, false, true, false]);
    expect(weather[3].city).toBe("Seattle, Washington");
  });

  it("treats a network failure or malformed body as unavailable, not a crash", async () => {
    vi.stubEnv("WEATHER_API_KEY", "secret-key");
    let call = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        call += 1;
        if (call === 1) throw new Error("network down");
        if (call === 2) return okResponse({}); // no `current`
        return okResponse(apiBody(50));
      }),
    );

    const weather = await getWeather();

    expect(weather[0].current).toBeNull();
    expect(weather[1].current).toBeNull();
    expect(weather.slice(2).every((w) => w.current !== null)).toBe(true);
  });

  it("never puts the API key in the data it returns on failure", async () => {
    vi.stubEnv("WEATHER_API_KEY", "secret-key");
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) })));

    const weather = await getWeather();

    expect(JSON.stringify(weather)).not.toContain("secret-key");
  });
});

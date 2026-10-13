import type { CityWeather, Job } from "@/lib/types";

export function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: "henchperson",
    title: "Henchperson",
    summary: "Stand menacingly in corridors and never ask what is in the crates.",
    pay: "$38,000 - $48,000 per year, plus combat pay",
    location: "Various secret bases (assigned on first day)",
    qualifications: ["Comfortable standing for long periods", "Able to follow orders"],
    benefits: ["Dental (replacement teeth included)", "Matching uniform allowance"],
    disclaimers: ["Not liable for injuries caused by heroes, lasers, or sharks."],
    ...overrides,
  };
}

export function makeJobs(count: number): Job[] {
  return Array.from({ length: count }, (_, i) =>
    makeJob({ id: `job-${i + 1}`, title: `Villain Role ${i + 1}`, summary: `Summary ${i + 1}` }),
  );
}

// Mock weather API data in our own shape, as returned by getWeather().
export const MOCK_WEATHER: CityWeather[] = [
  { city: "Naples, Florida", current: { temp_f: 86.4, temp_c: 30.2, condition: "Sunny", humidity: 62, wind_mph: 7.6 } },
  { city: "Cupertino, California", current: { temp_f: 71.5, temp_c: 21.9, condition: "Partly cloudy", humidity: 48, wind_mph: 4.2 } },
  { city: "Bentonville, Arkansas", current: { temp_f: 64.0, temp_c: 17.8, condition: "Light rain", humidity: 81, wind_mph: 11.0 } },
  { city: "Seattle, Washington", current: { temp_f: 52.7, temp_c: 11.5, condition: "Overcast", humidity: 90, wind_mph: 9.4 } },
  { city: "Dubai, UAE", current: { temp_f: 104.9, temp_c: 40.5, condition: "Clear", humidity: 25, wind_mph: 14.5 } },
];

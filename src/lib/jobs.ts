import type { Job } from "./types";

// Mock data until Supabase is connected. Keep getJobs/getJobById as the only
// access points so swapping in real queries doesn't touch the pages.
const jobs: Job[] = [
  {
    id: "henchperson",
    title: "Henchperson",
    summary:
      "Stand menacingly in corridors, guard things of unspecified importance, and never ask what is in the crates.",
  },
  {
    id: "lair-facilities-manager",
    title: "Lair Facilities Manager",
    summary:
      "Keep the volcano stable, the shark tanks filtered, and the trapdoors properly oiled.",
  },
  {
    id: "chief-doomsday-device-engineer",
    title: "Chief Doomsday Device Engineer",
    summary:
      "Design, build, and calibrate the Garden's flagship device. Must be comfortable with deadlines that are, technically, the end of the world.",
  },
  {
    id: "minion-wrangler",
    title: "Minion Wrangler",
    summary:
      "Coordinate shifts, snacks, and morale for several hundred enthusiastic minions.",
  },
  {
    id: "monologue-writer",
    title: "Monologue Writer",
    summary:
      "Craft compelling villain speeches that are long enough to be dramatic but short enough to avoid fatal interruptions.",
  },
];

export async function getJobs(): Promise<Job[]> {
  return jobs;
}

export async function getJobById(id: string): Promise<Job | undefined> {
  return jobs.find((job) => job.id === id);
}

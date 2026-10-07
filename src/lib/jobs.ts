import type { Job } from "./types";

// Mock data until Supabase is connected. Keep getJobs/getJobById as the only
// access points so swapping in real queries doesn't touch the pages.
const jobs: Job[] = [
  {
    id: "henchperson",
    title: "Henchperson",
    summary:
      "Stand menacingly in corridors, guard things of unspecified importance, and never ask what is in the crates.",
    pay: "$38,000 - $48,000 per year, plus combat pay",
    benefits: [
      "Dental (replacement teeth included)",
      "Matching uniform allowance",
      "Free lunch on days the lair is not under attack",
    ],
    qualifications: [
      "Comfortable standing for long periods",
      "Able to follow orders without follow-up questions",
      "Willingness to be defeated by a hero in the first act",
    ],
    location: "Various secret bases (assigned on first day)",
    disclaimers: [
      "The Garden is not liable for injuries caused by heroes, lasers, or sharks.",
      "Henchperson turnover is high; this is not a reflection of management.",
    ],
  },
  {
    id: "lair-facilities-manager",
    title: "Lair Facilities Manager",
    summary:
      "Keep the volcano stable, the shark tanks filtered, and the trapdoors properly oiled.",
    pay: "$72,000 - $95,000 per year",
    benefits: [
      "Full health coverage (excluding volcano-related incidents)",
      "Hard hat provided",
      "Annual shark-tank maintenance bonus",
    ],
    qualifications: [
      "5+ years managing large industrial or geothermal facilities",
      "Working knowledge of aquatic predator husbandry",
      "Valid hazardous materials certification",
    ],
    location: "Hollowed-out volcano, Pacific Ring of Fire",
    disclaimers: [
      "Volcano eruptions are considered an act of villainy, not an act of nature.",
      "Candidates must be able to swim.",
    ],
  },
  {
    id: "chief-doomsday-device-engineer",
    title: "Chief Doomsday Device Engineer",
    summary:
      "Design, build, and calibrate the Garden's flagship device. Must be comfortable with deadlines that are, technically, the end of the world.",
    pay: "$180,000 - $250,000 per year, plus equity in the new world order",
    benefits: [
      "Premium health, dental, and vision",
      "Private lab with blast doors",
      "Guaranteed survival in the post-doomsday shelter",
    ],
    qualifications: [
      "PhD in physics, engineering, or a closely related forbidden field",
      "Track record of delivering world-altering projects on schedule",
      "Strong written and verbal communication, including ultimatums",
    ],
    location: "Orbital platform (remote work not available)",
    disclaimers: [
      "Equity value may drop to zero in the event of a successful launch.",
      "The Garden does not guarantee the continued existence of the surrounding planet.",
    ],
  },
  {
    id: "minion-wrangler",
    title: "Minion Wrangler",
    summary:
      "Coordinate shifts, snacks, and morale for several hundred enthusiastic minions.",
    pay: "$55,000 - $70,000 per year",
    benefits: [
      "Unlimited banana-adjacent snacks",
      "Noise-canceling headphones",
      "Paid time off after major incidents",
    ],
    qualifications: [
      "Experience supervising large, loud teams",
      "Patience of a saint, or at least a very stubborn supervillain",
      "Fluency in Minionese preferred",
    ],
    location: "Central Garden headquarters, Sub-basement 4",
    disclaimers: [
      "Minions are not responsible for damage caused by minions.",
      "Position may involve being covered in goggles and overalls.",
    ],
  },
  {
    id: "monologue-writer",
    title: "Monologue Writer",
    summary:
      "Craft compelling villain speeches that are long enough to be dramatic but short enough to avoid fatal interruptions.",
    pay: "$60,000 - $85,000 per year, plus per-speech royalties",
    benefits: [
      "Flexible hours (mostly dramatic late-night ones)",
      "Remote-friendly via encrypted channel",
      "Complimentary cape",
    ],
    qualifications: [
      "Portfolio of at least three unhinged speeches",
      "Strong sense of pacing and menace",
      "Ability to write while a villain paces behind you",
    ],
    location: "Hybrid: headquarters library or an undisclosed remote location",
    disclaimers: [
      "Speeches are delivered at the client's own risk.",
      "The Garden is not liable if a hero escapes during the monologue.",
    ],
  },
];

export async function getJobs(): Promise<Job[]> {
  return jobs;
}

export async function getJobById(id: string): Promise<Job | undefined> {
  return jobs.find((job) => job.id === id);
}

// Standard JTSC volunteer jobs and the credit hours each shift has historically carried.
// Sourced from the club meet volunteer records. Used to suggest job names when an admin
// builds a session, and to offer known hour options at check-in.

export const volunteerJobCatalog = [
  { name: "Announcer", hours: [3.25, 4.0, 4.25, 4.75, 5.25] },
  { name: "Awards", hours: [2.0, 3.0, 4.0] },
  { name: "Bottled Water Donation - 3 Cases", hours: [2.0] },
  { name: "Bottled Water Donation - 4 Cases", hours: [2.0] },
  { name: "Bottled Water Donation - 5 Cases", hours: [1.0] },
  { name: "Check-in Table", hours: [1.5] },
  { name: "Concessions", hours: [3.25, 3.5, 3.75, 4.0, 4.25, 4.5, 5.25, 5.5] },
  { name: "Console", hours: [4.0, 4.5, 5.0] },
  { name: "Console- Shadow/Train", hours: [3.0] },
  { name: "Donation- Diet Pepsi- 2 Cases (48 Cans)", hours: [2.0] },
  { name: "Donation- Dr. Pepper- 2 Cases (48 Cans)", hours: [2.0] },
  { name: "Donation- Mt. Dew- 2 Cases (48 Cans)", hours: [2.0] },
  { name: "Donation- Pepsi- 2 Cases (48 Cans)", hours: [2.0] },
  { name: "Donation- Starry- 2 Cases (48 Cans)", hours: [2.0] },
  { name: "Donation-Diet Dr. Pepper-2 Cases 48 cans", hours: [2.0] },
  { name: "Event Set-Up", hours: [3.5] },
  { name: "Event Tear Down (ADULTS ONLY)", hours: [1.0] },
  { name: "Head Timer", hours: [3.75, 4.25, 4.5, 5.0, 5.25] },
  { name: "Heat Sheet Sales", hours: [1.5] },
  { name: "Heat Winner Awards", hours: [3.0, 3.5] },
  { name: "Hospitality", hours: [4.0, 4.25, 4.5, 4.75, 5.0, 5.5, 6.0] },
  { name: "Officials", hours: [4.0, 4.25, 4.5, 4.75, 5.0, 5.5] },
  { name: "Pool Party Volunteer- ADULTS 18+ ONLY", hours: [3.75] },
  { name: "Ribbons", hours: [3.5, 4.0] },
  { name: "Runner", hours: [3.5, 4.0, 4.75, 5.0] },
  { name: "Safety officer", hours: [4.0, 4.25, 4.5, 5.5, 6.0] },
  { name: "Stager", hours: [3.5, 4.0, 4.25] },
  { name: "Swimmer Positive Check-in", hours: [1.0, 1.25, 1.5] },
  { name: "Timer", hours: [3.75, 4.25, 4.5, 5.0, 5.25] },
  { name: "Timer - Experienced Parents ONLY", hours: [3.75, 4.0] },
  { name: "Timer - New Families Only!!!!!", hours: [4.25] },
  { name: "Timer - New Parents Only", hours: [3.75] },
  { name: "Timer- LANE 2 ONLY!!!", hours: [1.0, 1.25, 1.5, 2.0] },
  { name: "Video Streaming", hours: [3.0, 3.5, 4.0, 4.25, 4.5, 5.0] },
  { name: "Volunteer Check-in", hours: [1.25, 1.5, 2.0] },
];

export const volunteerJobNames = volunteerJobCatalog.map(job => job.name);

/** Credit-hour options recorded for a job name, or an empty list when it is not a standard job. */
export function jobHourOptions(name) {
  if (!name) return [];
  const target = String(name).trim().toLowerCase();
  return volunteerJobCatalog.find(job => job.name.toLowerCase() === target)?.hours ?? [];
}

/** The most common credit for a job name, used to prefill the hours field. */
export function defaultJobHours(name) {
  const options = jobHourOptions(name);
  return options.length ? options[Math.floor(options.length / 2)] : null;
}

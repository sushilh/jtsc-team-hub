export const socialFormats = {
  portrait: { width: 1080, height: 1350, label: "Instagram feed", ratio: "4:5", filename: "instagram-feed" },
  square: { width: 1080, height: 1080, label: "Facebook feed", ratio: "1:1", filename: "facebook-feed" },
};

export function formatMeetDate(value = "") {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return "";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(date);
}

export function meetDetails(meetName = "", meetDate = "") {
  return [meetName.trim(), formatMeetDate(meetDate)].filter(Boolean).join(" · ");
}

export function createCaptions({ name = "", headline = "", eventName = "", time = "", subline = "", meetName = "", meetDate = "" } = {}) {
  const clean = value => String(value).trim();
  const swimmer = clean(name);
  const achievement = clean(headline);
  const event = [clean(eventName), clean(time)].filter(Boolean).join(" · ");
  const details = [achievement, clean(subline), event, meetDetails(meetName, meetDate)].filter(Boolean).join("\n");
  return {
    instagram: [swimmer ? `Congratulations, ${swimmer}! 🎉` : "Celebrating a JTSC achievement! 🎉", details, "Proud to be a Trojan. Keep making waves!", "#JTSC #JenksTrojans #SwimTeam #Swimming #TrojanPride"].filter(Boolean).join("\n\n"),
    facebook: [swimmer ? `Join us in congratulating ${swimmer}!` : "Join us in celebrating our JTSC swimmers!", details, "Jenks Trojan Swim Club is proud to celebrate this achievement. Help us cheer on our Trojans in the comments!", "#JTSC #JenksTrojans"].filter(Boolean).join("\n\n"),
  };
}

export function imageFilename(name, template, format) {
  const swimmer = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "jtsc-swimmer";
  const { width, height, filename } = socialFormats[format];
  return `${swimmer}-${template}-${filename}-${width}x${height}.png`;
}

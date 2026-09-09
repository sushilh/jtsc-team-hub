export const socialFormats = {
  portrait: { width: 1080, height: 1350, label: "Instagram feed", ratio: "4:5", filename: "instagram-feed" },
  square: { width: 1080, height: 1080, label: "Facebook feed", ratio: "1:1", filename: "facebook-feed" },
};

export function createCaptions({ name = "", headline = "", eventName = "", time = "", subline = "" } = {}) {
  const clean = value => String(value).trim();
  const swimmer = clean(name);
  const achievement = clean(headline);
  const event = [clean(eventName), clean(time)].filter(Boolean).join(" · ");
  const details = [achievement, clean(subline), event].filter(Boolean).join("\n");
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

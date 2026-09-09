import type { Metadata } from "next";
import ClubHub from "./components/ClubHub";

export const metadata: Metadata = {
  title: "Team Hub | JTSC",
  description: "Volunteer check-in, meet administration, and share-ready swimmer achievement cards for Jenks Trojan Swim Club.",
};

export default function Home() {
  return <ClubHub />;
}

import type { Metadata } from "next";
import ClubHub from "../components/ClubHub";

export const metadata: Metadata = {
  title: "New Parent Guide | JTSC",
  description: "Essential season, gear, meet-day, and volunteer information for Jenks Trojan Swim Club families.",
};

export default function ParentGuidePage() {
  return <ClubHub initialTab="parents" />;
}

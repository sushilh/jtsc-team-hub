import type { Metadata } from "next";
import StateTimesApp from "../components/StateTimesApp";

export const metadata: Metadata = {
  title: "State Qualifying Times",
  description: "2025-2028 Oklahoma Swimming qualifying times by age, gender, stroke, and course.",
};

export default function StateTimesPage() {
  return <StateTimesApp />;
}

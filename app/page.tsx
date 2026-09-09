import type { Metadata } from "next";
import CardStudio from "./components/CardStudio";

export const metadata: Metadata = {
  title: "Achievement Card Studio | JTSC",
  description: "Create share-ready swimmer achievement graphics for Jenks Trojan Swim Club.",
};

export default function Home() {
  return <CardStudio />;
}

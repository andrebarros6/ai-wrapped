import { Bricolage_Grotesque, JetBrains_Mono } from "next/font/google";

// Fonts for the dark card theme. Only the story pages load them.
const bricolage = Bricolage_Grotesque({ subsets: ["latin"], weight: ["500", "800"], variable: "--font-bricolage" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], weight: ["500", "700"], variable: "--font-jetbrains" });

export default function StoryLayout({ children }: LayoutProps<"/story">) {
  return <div className={`${bricolage.variable} ${jetbrains.variable}`}>{children}</div>;
}

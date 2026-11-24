import { Bricolage_Grotesque, JetBrains_Mono } from "next/font/google";

// Fonts for the dark card theme, loaded only by pages that show cards (/story, /s).
const bricolage = Bricolage_Grotesque({ subsets: ["latin"], weight: ["500", "800"], variable: "--font-bricolage" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], weight: ["500", "700"], variable: "--font-jetbrains" });

export const cardFontsClass = `${bricolage.variable} ${jetbrains.variable}`;

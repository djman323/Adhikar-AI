import "./globals.css";
import { Space_Grotesk, IBM_Plex_Serif } from "next/font/google";
import TopTabs from "./components/top-tabs";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
});

const ibmPlexSerif = IBM_Plex_Serif({
  subsets: ["latin"],
  variable: "--font-plex-serif",
  weight: ["400", "500"],
});

export const metadata = {
  title: "Adhikar AI | Constitutional Legal Intelligence",
  description: "A cinematic constitutional law interface with source-aware legal chat and a premium home page.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${spaceGrotesk.variable} ${ibmPlexSerif.variable}`}>
        <TopTabs />
        {children}
      </body>
    </html>
  );
}

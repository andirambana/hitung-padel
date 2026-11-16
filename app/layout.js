import { Anton, Manrope, Outfit } from "next/font/google";
import "./globals.css";

const body = Manrope({
  subsets: ["latin"],
  variable: "--font-body",
});

const brand = Outfit({
  subsets: ["latin"],
  weight: ["500", "700", "800"],
  variable: "--font-brand",
});

const score = Anton({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-score",
});

export const metadata = {
  title: "HitungSkorPadel",
  description: "A padel scoreboard in the browser. Golden point, advantage, tie-breaks, and super tie-breaks.",
  applicationName: "HitungSkorPadel",
  appleWebApp: {
    capable: true,
    title: "HitungSkorPadel",
    statusBarStyle: "black-translucent",
  },
};

export const viewport = {
  themeColor: "#121614",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }) {
  return (
    <html lang="id" className={`${body.variable} ${brand.variable} ${score.variable}`}>
      <body>{children}</body>
    </html>
  );
}

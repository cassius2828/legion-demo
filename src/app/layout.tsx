import "~/styles/globals.css";

import { type Metadata } from "next";
import { Geist } from "next/font/google";

import { AppNav } from "~/app/_components/app-nav";
import { TRPCReactProvider } from "~/trpc/react";

export const metadata: Metadata = {
  title: "Legion demo",
  description: "Clinic charts for providers and patients",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable}`}>
      <body>
        <TRPCReactProvider>
          <AppNav />
          {children}
        </TRPCReactProvider>
      </body>
    </html>
  );
}

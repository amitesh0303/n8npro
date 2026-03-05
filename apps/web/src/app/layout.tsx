import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "n8npro – AI Workflow Automation",
  description: "Visual n8n-like workflow automation with AI Agent nodes, LLM integrations, and execution engine",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-slate-900 text-white font-sans">
        {children}
      </body>
    </html>
  );
}

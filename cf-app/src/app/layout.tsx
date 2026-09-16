export const metadata = {
  title: "DebateAI",
  description: "AI-enhanced real-time debating platform — Cloudflare edition",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

export default function SupportOpenSource() {
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4">
      <div className="text-center max-w-xl">
        <h1 className="text-4xl font-bold text-primary mb-4">
          Support DebateAI
        </h1>
        <p className="text-muted-foreground text-lg mb-6">
          DebateAI is an open-source project built by the community, for the
          community. Whether you're a developer, designer, or debate enthusiast
          — your contributions make a difference.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a
            href="https://github.com/AOSSIE-Org/DebateAI"
            target="_blank"
            rel="noreferrer"
            className="bg-primary text-primary-foreground px-6 py-3 rounded-md font-semibold hover:bg-primary/90 transition-colors"
          >
            View on GitHub
          </a>
          <a
            href="https://github.com/AOSSIE-Org/DebateAI/issues"
            target="_blank"
            rel="noreferrer"
            className="border border-border text-foreground px-6 py-3 rounded-md font-semibold hover:bg-muted transition-colors"
          >
            Report an Issue
          </a>
        </div>
      </div>
    </div>
  );
}
// src/Pages/TermsOfService.tsx
function TermsOfService() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold text-foreground mb-2">Terms of Service</h1>
      <p className="text-sm text-muted-foreground mb-8">Last updated: {new Date().getFullYear()}</p>

      <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
        <p>
          By using DebateAI, you agree to use the platform respectfully and
          in accordance with our community guidelines. DebateAI is an
          open-source project maintained by AOSSIE and provided as-is,
          without warranties of any kind.
        </p>
        <p>
          Users are responsible for the content they submit during debates.
          Abusive, harmful, or illegal use of the platform is prohibited and
          may result in account suspension.
        </p>
        <p>
          For the full, detailed Terms of Service, please check back soon or
          reach out via our{' '}
          
            <a href="https://github.com/AOSSIE-Org/DebateAI"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            GitHub repository
          </a>{' '}
          or{' '}
          
            <a href="https://discord.com/invite/hjUhu33uAn"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Discord server
          </a>
          .
        </p>
      </div>
    </div>
  );
}

export default TermsOfService;
// src/Pages/PrivacyPolicy.tsx
function PrivacyPolicy() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold text-foreground mb-2">Privacy Policy</h1>
      <p className="text-sm text-muted-foreground mb-8">Last updated: {new Date().getFullYear()}</p>

      <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
        <p>
          DebateAI is an open-source project built by AOSSIE. We are currently
          finalizing our full Privacy Policy. In the meantime, please note that
          DebateAI collects only the information necessary to provide its
          debate practice services, such as account details and debate
          session data.
        </p>
        <p>
          We do not sell your personal information to third parties. For any
          questions regarding data handling, please reach out to us via our{' '}
          
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
        <p>This page will be updated with the complete policy soon.</p>
      </div>
    </div>
  );
}

export default PrivacyPolicy;
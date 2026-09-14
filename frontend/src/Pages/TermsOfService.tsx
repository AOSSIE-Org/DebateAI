// src/Pages/TermsOfService.tsx
function TermsOfService() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold text-foreground mb-2">Terms of Service</h1>
      <p className="text-sm text-muted-foreground mb-8">Last updated: September 2026</p>

      <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">1. Introduction</h2>
          <p>
            Welcome to <strong>DebateAI</strong>, an open-source AI-enhanced online debating
            platform developed and maintained by AOSSIE ("AOSSIE", "we", "us", or "our").
          </p>
          <p className="mt-2">
            These Terms of Service ("Terms") govern your access to and use of DebateAI,
            including its website, applications, APIs, online debate rooms, AI-powered
            features, and related services (collectively, the "Service").
          </p>
          <p className="mt-2">
            By accessing or using DebateAI, you agree to these Terms. If you do not agree
            with these Terms, please do not use the Service.
          </p>
          <p className="mt-2">
            If you use DebateAI on behalf of an organization or another person, you
            represent that you have the authority to accept these Terms on their behalf.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">2. Eligibility</h2>
          <p>
            You must be at least 13 years old to use DebateAI. If you are under the age of
            majority in your jurisdiction, you may only use the Service with the
            involvement of a parent or legal guardian.
          </p>
          <p className="mt-2">
            You are responsible for ensuring that your use of DebateAI complies with all
            applicable laws, regulations, and third-party terms.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">3. Description of the Service</h2>
          <p>
            DebateAI provides an online platform for structured debates between users and,
            where supported, AI participants. Depending on the features available, the
            Service may provide:
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Online multiplayer debate rooms</li>
            <li>User-versus-user debates</li>
            <li>User-versus-AI debates</li>
            <li>AI-generated debate responses</li>
            <li>AI-assisted debate judgment and evaluation</li>
            <li>Debate transcripts</li>
            <li>Live debate communication (text, and audio/video where enabled)</li>
            <li>Spectator functionality</li>
            <li>Polls and reactions</li>
            <li>User ratings or Elo-style scores</li>
            <li>Matchmaking</li>
            <li>Debate statistics and analytics</li>
            <li>User profiles</li>
            <li>Other debate-related functionality</li>
          </ul>
          <p className="mt-2">
            Features may change over time as DebateAI is developed and improved. We may
            add, modify, suspend, or discontinue features at any time.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">4. User Accounts</h2>
          <p>
            Some features require you to create or maintain an account. When creating an
            account, you agree to provide information that is reasonably accurate and to
            keep that information up to date where necessary.
          </p>
          <p className="mt-2">
            Depending on the authentication method used (including Google OAuth), your
            account may include information such as:
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Email address</li>
            <li>Display name</li>
            <li>Profile/avatar information</li>
            <li>Account identifier</li>
            <li>Rating or Elo information</li>
            <li>Authentication-related information</li>
          </ul>
          <p className="mt-2">
            You are responsible for maintaining the security of your account credentials
            and authentication tokens. You must notify us if you believe that your account
            has been accessed or used without authorization.
          </p>
          <p className="mt-2">You must not:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Use another person's account without permission</li>
            <li>Attempt to obtain another user's credentials</li>
            <li>Circumvent authentication mechanisms</li>
            <li>Create accounts for fraudulent or abusive purposes</li>
            <li>Impersonate another person or organization</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">5. Acceptable Use</h2>
          <p>You agree to use DebateAI responsibly and lawfully. You must not use the Service to:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Violate applicable laws or regulations</li>
            <li>Harass, threaten, abuse, or intimidate other users</li>
            <li>Promote violence or illegal activities</li>
            <li>Distribute malware or malicious code</li>
            <li>Attempt unauthorized access to accounts, rooms, APIs, databases, or infrastructure</li>
            <li>Interfere with the operation of the Service</li>
            <li>Circumvent authentication, authorization, rate limits, or other security controls</li>
            <li>Conduct automated activity that places unreasonable load on the Service</li>
            <li>Manipulate ratings, matchmaking, polls, reactions, or other platform mechanisms</li>
            <li>Exploit bugs or vulnerabilities for unauthorized purposes</li>
            <li>Attempt to reverse engineer or compromise security mechanisms</li>
            <li>Upload or transmit content that infringes another person's intellectual property or privacy rights</li>
            <li>Use the Service to distribute spam or unsolicited communications</li>
          </ul>
          <p className="mt-2">You are responsible for the content you submit or communicate through DebateAI.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">6. Debate Conduct</h2>
          <p>
            DebateAI is designed to facilitate structured discussion and argumentation.
            Users are expected to participate in good faith and to respect other
            participants.
          </p>
          <p className="mt-2">You must not intentionally disrupt debates through:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Spam</li>
            <li>Repeated automated messages</li>
            <li>Deliberate abuse of the room system</li>
            <li>Attempts to manipulate debate results</li>
            <li>Exploitation of technical issues</li>
            <li>Coordinated disruption of other users' debates</li>
          </ul>
          <p className="mt-2">
            AOSSIE may restrict or suspend access where necessary to protect users, the
            Service, or the integrity of the platform.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">7. User Content</h2>
          <p>You may submit content through the Service, including:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Debate messages</li>
            <li>Arguments</li>
            <li>Questions</li>
            <li>Responses</li>
            <li>Poll responses</li>
            <li>Reactions</li>
            <li>Other content supported by the Service</li>
          </ul>
          <p className="mt-2">
            You retain ownership of content that you lawfully own. By submitting content to
            DebateAI, you grant AOSSIE a limited, non-exclusive right to process, store,
            transmit, and display that content as necessary to operate and provide the
            Service.
          </p>
          <p className="mt-2">This may include processing content for:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Delivering messages to other participants</li>
            <li>Maintaining debate transcripts</li>
            <li>Providing live debate functionality</li>
            <li>Generating AI responses</li>
            <li>Generating AI-assisted judgments or evaluations</li>
            <li>Providing platform features</li>
            <li>Maintaining and securing the Service</li>
          </ul>
          <p className="mt-2">You are responsible for ensuring that you have the necessary rights to submit the content.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">8. AI-Generated Content</h2>
          <p>
            DebateAI may use artificial intelligence (including Google's Gemini API) to
            generate debate responses, evaluations, judgments, recommendations, summaries,
            or other content.
          </p>
          <p className="mt-2">
            AI-generated content may be inaccurate, incomplete, biased, inconsistent, or
            inappropriate. AI-generated content should not be treated as:
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Professional advice</li>
            <li>Authoritative factual information</li>
            <li>A definitive determination of the quality or correctness of an argument</li>
            <li>A substitute for human judgment</li>
          </ul>
          <p className="mt-2">
            AI-generated debate judgments and scores are intended primarily for the
            functionality and entertainment/educational purposes of the platform. You
            should independently evaluate important claims or conclusions produced by the
            Service.
          </p>
          <p className="mt-2">
            We do not guarantee that AI-generated content will always be accurate,
            relevant, unbiased, available, or consistent.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">9. Ratings, Scores, and Rankings</h2>
          <p>
            DebateAI may provide ratings, Elo-style scores, rankings, statistics, or other
            measurements based on user activity and/or debate results.
          </p>
          <p className="mt-2">
            These values are estimates generated by platform algorithms and should not be
            considered objective measures of a person's intelligence, expertise, ability,
            or character.
          </p>
          <p className="mt-2">
            We may modify the scoring or ranking system as the Service evolves. We do not
            guarantee that ratings, rankings, or other metrics will remain unchanged or
            accurately represent a user's real-world abilities.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">10. Live Communication, WebSockets, and WebRTC</h2>
          <p>
            Some DebateAI functionality uses real-time communication technologies,
            including WebSockets for text-based live functionality and WebRTC for
            peer-to-peer or relayed audio/video communication, where enabled.
          </p>
          <p className="mt-2">
            Because real-time functionality depends on network connectivity, browsers,
            infrastructure, and third-party services, we cannot guarantee uninterrupted
            real-time communication, and audio/video quality may depend on network
            conditions and browser support.
          </p>
          <p className="mt-2">A connection may be interrupted, delayed, disconnected, or unavailable.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">11. Spectator Features</h2>
          <p>Some debates may be accessible through spectator functionality.</p>
          <p className="mt-2">
            Where spectator access is enabled, information made available through a public
            or spectator-enabled debate — including audio/video, where enabled — may be
            visible to spectators.
          </p>
          <p className="mt-2">
            Users should therefore avoid submitting information to public debates that they
            do not want other participants or spectators to see.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">12. Third-Party Services</h2>
          <p>
            DebateAI may rely on third-party services to provide certain functionality,
            including Google's Gemini API (AI-powered features) and Google OAuth
            (authentication), as well as database, hosting, and email service providers.
          </p>
          <p className="mt-2">
            Your use of functionality involving a third-party service may also be subject
            to that provider's terms and policies.
          </p>
          <p className="mt-2">
            AOSSIE does not control the availability, security, or policies of third-party
            services. Where applicable, third-party services are described in our Privacy
            Policy.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">13. Open-Source Software</h2>
          <p>DebateAI is developed as an open-source project.</p>
          <p className="mt-2">
            The rights to use, modify, and redistribute the source code are governed by the
            applicable open-source license included with the project.
          </p>
          <p className="mt-2">
            These Terms govern your use of the hosted Service and do not replace or modify
            the terms of the project's open-source license. Where there is a conflict
            between these Terms and the applicable open-source license regarding rights to
            the source code, the applicable open-source license controls those source-code
            rights.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">14. Intellectual Property</h2>
          <p>
            Except for user-generated content and third-party materials, the Service and
            its original components, including its software, branding, design,
            documentation, and other materials, are owned by or licensed to AOSSIE and its
            contributors.
          </p>
          <p className="mt-2">
            Nothing in these Terms grants you ownership of AOSSIE trademarks, branding, or
            other intellectual property. Third-party libraries and services remain subject
            to their respective licenses and terms.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">15. Availability</h2>
          <p>
            We aim to keep DebateAI available and reliable, but the Service is provided on
            an "as available" basis. We do not guarantee that:
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>The Service will always be available</li>
            <li>Debate rooms will always be accessible</li>
            <li>WebSocket or WebRTC connections will remain uninterrupted</li>
            <li>AI services will always respond</li>
            <li>Third-party integrations will always function</li>
            <li>Data will never be lost</li>
            <li>The Service will always be free from bugs or errors</li>
          </ul>
          <p className="mt-2">
            The Service may occasionally be unavailable because of maintenance, upgrades,
            outages, security incidents, infrastructure failures, or circumstances beyond
            our control.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">16. Disclaimer of Warranties</h2>
          <p>
            To the maximum extent permitted by applicable law, DebateAI is provided{' '}
            <strong>"as is"</strong> and <strong>"as available"</strong>, without warranties
            of any kind, express or implied.
          </p>
          <p className="mt-2">This includes warranties regarding:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Accuracy</li>
            <li>Reliability</li>
            <li>Availability</li>
            <li>Fitness for a particular purpose</li>
            <li>Non-infringement</li>
            <li>Security</li>
            <li>Completeness</li>
            <li>AI-generated content</li>
          </ul>
          <p className="mt-2">You use the Service at your own discretion and risk.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">17. Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by applicable law, AOSSIE, its maintainers,
            contributors, and affiliates will not be liable for indirect, incidental,
            special, consequential, exemplary, or punitive damages arising from or related
            to your use of, or inability to use, DebateAI.
          </p>
          <p className="mt-2">This includes, where legally permitted:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Loss of data</li>
            <li>Loss of content</li>
            <li>Service interruptions</li>
            <li>AI-generated errors</li>
            <li>Incorrect debate judgments</li>
            <li>Incorrect ratings or rankings</li>
            <li>Account-related issues</li>
            <li>Third-party service failures</li>
            <li>Unauthorized access resulting from circumstances outside our reasonable control</li>
          </ul>
          <p className="mt-2">
            Nothing in these Terms excludes or limits liability that cannot legally be
            excluded or limited.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">18. Suspension and Termination</h2>
          <p>
            We may suspend or terminate access to the Service where reasonably necessary,
            including when a user:
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Violates these Terms</li>
            <li>Abuses other users</li>
            <li>Attempts to compromise the Service</li>
            <li>Engages in fraudulent activity</li>
            <li>Creates security risks</li>
            <li>Uses the Service unlawfully</li>
          </ul>
          <p className="mt-2">
            We may also suspend functionality temporarily for maintenance, security, or
            operational reasons.
          </p>
          <p className="mt-2">
            You may stop using the Service at any time. Where applicable, account and data
            deletion requests are handled according to the Privacy Policy.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">19. Changes to the Service</h2>
          <p>DebateAI is an actively developed open-source project. We may change:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Features</li>
            <li>APIs</li>
            <li>Debate formats</li>
            <li>Scoring systems</li>
            <li>AI models</li>
            <li>Infrastructure</li>
            <li>Authentication mechanisms</li>
            <li>User-interface functionality</li>
          </ul>
          <p className="mt-2">
            Continued use of the Service after material changes to these Terms constitutes
            acceptance of the updated Terms, to the extent permitted by applicable law.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">20. Changes to These Terms</h2>
          <p>We may update these Terms from time to time.</p>
          <p className="mt-2">
            The "Last updated" date at the top of this document will be changed when
            material updates are made. We encourage users to review the Terms
            periodically.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">21. Governing Law and Dispute Resolution</h2>
          <p>
            These Terms are governed by applicable law in the jurisdiction in which AOSSIE
            operates, except where applicable law requires otherwise.
          </p>
          <p className="mt-2">
            Before pursuing formal proceedings, the parties should attempt to resolve
            disputes through good-faith communication.
          </p>
          <p className="mt-2">
            Nothing in this section prevents a user from exercising rights that cannot
            legally be waived.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">22. Contact Information</h2>
          <p>
            If you have questions, concerns, or reports regarding these Terms or the
            Service, contact:
          </p>
          <p className="mt-2">
            <strong>Email:</strong> contact@aossie.org
            <br />
            <strong>Organization:</strong> AOSSIE
          </p>
          <p className="mt-2">
            You may also use the project's official{' '}
            <a
              href="https://github.com/AOSSIE-Org/DebateAI"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              GitHub repository
            </a>{' '}
            or{' '}
            <a
              href="https://discord.com/invite/hjUhu33uAn"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Discord server
            </a>{' '}
            for appropriate project-related issues.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">23. Legal Notice</h2>
          <p>These Terms are provided for transparency and general use by an open-source project.</p>
          <p className="mt-2">
            They are not a substitute for legal advice. AOSSIE should obtain appropriate
            legal review before relying on these Terms as a legally binding agreement in a
            particular jurisdiction.
          </p>
        </section>
      </div>
    </div>
  );
}

export default TermsOfService;
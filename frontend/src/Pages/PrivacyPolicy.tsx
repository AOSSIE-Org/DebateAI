// src/Pages/PrivacyPolicy.tsx
function PrivacyPolicy() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold text-foreground mb-2">Privacy Policy</h1>
      <p className="text-sm text-muted-foreground mb-8">Last updated: September 2026</p>

      <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">Introduction</h2>
          <p>AOSSIE ("AOSSIE", "we", "us", or "our") respects your privacy.</p>
          <p className="mt-2">
            This Privacy Policy explains how <strong>DebateAI</strong> ("DebateAI", "the
            App", or "the Service") collects, uses, stores, and protects information when
            you use the platform.
          </p>
          <p className="mt-2">
            Unlike browser-only applications, DebateAI uses a backend infrastructure to
            provide functionality such as authentication, online debate rooms, real-time
            communication, user profiles, matchmaking, debate transcripts, and AI-powered
            features.
          </p>
          <p className="mt-2">
            We aim to collect and process only the information reasonably necessary to
            provide, maintain, secure, and improve the Service.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">1. Information We Collect</h2>
          <p>Depending on the features you use, DebateAI may process the following categories of information.</p>

          <h3 className="text-base font-semibold text-foreground mt-4 mb-2">1.1 Account Information</h3>
          <p>When you create or use an account, we may process information such as:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Email address</li>
            <li>Display name</li>
            <li>User identifier</li>
            <li>Profile/avatar information</li>
            <li>Authentication-related information</li>
            <li>Account creation and verification information</li>
          </ul>
          <p className="mt-2">
            The exact information collected may depend on the authentication method you
            use (including Google OAuth, where applicable).
          </p>

          <h3 className="text-base font-semibold text-foreground mt-4 mb-2">1.2 Debate Information</h3>
          <p>When you participate in a debate, the Service may process information associated with that debate, including:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Debate room identifier</li>
            <li>Debate messages</li>
            <li>Questions and responses</li>
            <li>Debate phases</li>
            <li>Participants</li>
            <li>Debate timestamps</li>
            <li>Debate transcripts</li>
            <li>Debate results or judgments</li>
            <li>Ratings or Elo-related information</li>
            <li>Polls and reactions, where enabled</li>
          </ul>
          <p className="mt-2">
            Messages and other debate content may be transmitted through the Service's
            backend and real-time communication infrastructure so that they can be
            delivered to the appropriate participants.
          </p>

          <h3 className="text-base font-semibold text-foreground mt-4 mb-2">1.3 User-Generated Content</h3>
          <p>Information that you voluntarily submit through the Service may be collected and processed, including:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Arguments</li>
            <li>Debate statements</li>
            <li>Questions</li>
            <li>Responses</li>
            <li>Reactions</li>
            <li>Poll responses</li>
            <li>Other content submitted through supported features</li>
          </ul>
          <p className="mt-2">You should not submit sensitive personal information to public or spectator-accessible debates.</p>

          <h3 className="text-base font-semibold text-foreground mt-4 mb-2">1.4 Automatically Generated Technical Information</h3>
          <p>When you use DebateAI, the Service may process technical information required to operate and secure the platform. Depending on the infrastructure and configuration, this may include:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>IP address</li>
            <li>Browser information</li>
            <li>Device information</li>
            <li>User-Agent information</li>
            <li>Request timestamps</li>
            <li>Connection information</li>
            <li>Authentication/session information</li>
            <li>Error and diagnostic information</li>
          </ul>
          <p className="mt-2">This information may be used for security, debugging, abuse prevention, and service operation.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">2. How We Use Information</h2>
          <p>We may use information for the following purposes:</p>

          <h3 className="text-base font-semibold text-foreground mt-4 mb-2">Providing the Service</h3>
          <p>To:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Create and maintain user accounts</li>
            <li>Authenticate users</li>
            <li>Create and manage debate rooms</li>
            <li>Allow users to join debates</li>
            <li>Deliver real-time messages</li>
            <li>Display participants</li>
            <li>Maintain debate transcripts</li>
            <li>Provide matchmaking</li>
            <li>Calculate or update ratings</li>
            <li>Provide polls, reactions, and related functionality</li>
          </ul>

          <h3 className="text-base font-semibold text-foreground mt-4 mb-2">AI-Powered Features</h3>
          <p>DebateAI may process debate-related content through <strong>Google's Gemini API</strong> to provide features such as:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>AI debate participants</li>
            <li>AI-generated responses</li>
            <li>AI-assisted debate judgments</li>
            <li>Debate analysis</li>
            <li>Recommendations</li>
            <li>Other AI-powered functionality</li>
          </ul>
          <p className="mt-2">Only information reasonably necessary for the relevant AI feature is transmitted to Gemini.</p>

          <h3 className="text-base font-semibold text-foreground mt-4 mb-2">Security</h3>
          <p>Information may be used to:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Detect unauthorized access</li>
            <li>Prevent abuse</li>
            <li>Protect accounts</li>
            <li>Investigate security incidents</li>
            <li>Enforce platform rules</li>
            <li>Maintain the integrity of debate rooms</li>
            <li>Diagnose technical problems</li>
          </ul>

          <h3 className="text-base font-semibold text-foreground mt-4 mb-2">Service Improvement</h3>
          <p>We may use technical and operational information to understand failures, improve reliability, and develop new features.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">3. AI Processing</h2>
          <p>AI is an important component of DebateAI.</p>
          <p className="mt-2">
            Depending on the feature being used, debate messages or other relevant content
            may be transmitted to <strong>Google's Gemini API</strong> for processing.
          </p>
          <p className="mt-2">For example, Gemini may be used to:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Generate responses from an AI debate participant</li>
            <li>Evaluate a completed debate</li>
            <li>Generate a judgment or score</li>
            <li>Analyze debate content</li>
          </ul>
          <p className="mt-2">
            Gemini processes transmitted information according to Google's applicable
            policies and contractual terms.
          </p>
          <p className="mt-2">AI-generated results may be inaccurate or incomplete.</p>
          <p className="mt-2">
            Users should not submit highly sensitive personal information into debate
            content merely for the purpose of obtaining an AI-generated response or
            judgment.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">4. Data Storage</h2>
          <p>DebateAI uses server-side infrastructure to provide its functionality.</p>
          <p className="mt-2">Depending on the feature, information may be stored in databases or other infrastructure used by the Service. For example, the Service may store:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Account information</li>
            <li>User profile information</li>
            <li>Room information</li>
            <li>Participant information</li>
            <li>Debate-related information</li>
            <li>Ratings</li>
            <li>Debate transcripts</li>
            <li>Poll or reaction information</li>
            <li>Security and operational information</li>
          </ul>
          <p className="mt-2">The Service currently uses a database infrastructure for persistent application data.</p>
          <p className="mt-2">
            Data may also temporarily exist in server memory, caches, logs, or other
            operational systems when necessary to provide the Service.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">5. Real-Time Communication</h2>
          <p>DebateAI uses real-time communication technologies, including WebSockets, for certain functionality.</p>
          <p className="mt-2">Information transmitted through real-time connections may include:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Debate events</li>
            <li>Participant events</li>
            <li>Messages</li>
            <li>Debate state</li>
            <li>Polls</li>
            <li>Reactions</li>
            <li>Other information required for live functionality</li>
          </ul>
          <p className="mt-2">
            Real-time communications are transmitted through the infrastructure used by
            DebateAI and may be temporarily processed in memory.
          </p>

          <h3 className="text-base font-semibold text-foreground mt-4 mb-2">5a. Audio/Video Communication (WebRTC)</h3>
          <p>
            Where audio or video debate functionality is enabled, DebateAI may use WebRTC
            to establish peer-to-peer or relayed audio/video connections between
            participants.
          </p>
          <p className="mt-2">
            Audio and video streams are used to deliver live debate communication and are
            not intentionally recorded or stored by the Service unless a recording feature
            is explicitly enabled and disclosed elsewhere in the Service.
          </p>
          <p className="mt-2">
            Participants should be aware that other participants may be able to see or hear
            them during a live audio/video debate, and should not use audio/video debate
            functionality in settings where this is not appropriate.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">6. Spectator Information</h2>
          <p>DebateAI may provide spectator functionality for certain debates.</p>
          <p className="mt-2">
            Spectator functionality may use a randomly generated spectator identifier
            stored in the user's browser.
          </p>
          <p className="mt-2">
            This identifier helps distinguish spectator connections and does not by itself
            represent a user's DebateAI account identity.
          </p>
          <p className="mt-2">
            If a debate is available to spectators, information intentionally displayed as
            part of that debate (including audio/video, where enabled) may be visible to
            spectators.
          </p>
          <p className="mt-2">
            Users should therefore avoid including private or sensitive information in
            debates that may be publicly or spectator accessible.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">7. Cookies and Local Storage</h2>
          <p>DebateAI may use browser storage mechanisms such as <code>localStorage</code> or similar technologies for application functionality.</p>
          <p className="mt-2">Depending on the implementation, locally stored information may include:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Authentication tokens</li>
            <li>Spectator identifiers</li>
            <li>Application state</li>
            <li>User preferences</li>
            <li>Other data required for the application to function</li>
          </ul>
          <p className="mt-2">
            Browser storage is controlled by the browser and is generally accessible to
            scripts running within the application's origin.
          </p>
          <p className="mt-2">Users should keep their browsers and devices secure.</p>
          <p className="mt-2">Clearing browser storage may sign you out of the Service or remove locally stored application state.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">8. Authentication Tokens</h2>
          <p>DebateAI uses JWT-based authentication tokens to maintain authenticated sessions.</p>
          <p className="mt-2">The frontend may store an authentication token in browser storage so that authenticated API requests can be made.</p>
          <p className="mt-2">Users should:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Keep their devices secure</li>
            <li>Avoid sharing authentication tokens</li>
            <li>Sign out on shared or public computers</li>
            <li>Report suspected unauthorized access</li>
          </ul>
          <p className="mt-2">
            Anyone who obtains an active authentication token may potentially be able to
            access functionality associated with that session.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">9. Data Sharing</h2>
          <p>We do not sell your personal information.</p>
          <p className="mt-2">
            We may share or transmit information only when reasonably necessary to
            operate, secure, or improve the Service. Depending on the features you use,
            this may include the following categories of recipients.
          </p>

          <h3 className="text-base font-semibold text-foreground mt-4 mb-2">AI Service Providers</h3>
          <p>Relevant debate content may be transmitted to <strong>Google (Gemini API)</strong> when required to generate AI responses or judgments.</p>
          <p className="mt-2">The amount of information transmitted is limited to what is necessary for the requested AI functionality.</p>

          <h3 className="text-base font-semibold text-foreground mt-4 mb-2">Authentication Providers</h3>
          <p>Where you sign in using <strong>Google OAuth</strong>, Google may process information necessary to authenticate your account, subject to Google's own privacy policy.</p>

          <h3 className="text-base font-semibold text-foreground mt-4 mb-2">Infrastructure and Hosting Providers</h3>
          <p>Information may be processed by infrastructure providers that host or operate components of the Service.</p>
          <p className="mt-2">
            These providers may process data on our behalf as necessary to provide
            infrastructure, databases, networking, storage, monitoring, or related
            services.
          </p>

          <h3 className="text-base font-semibold text-foreground mt-4 mb-2">Email Service Providers</h3>
          <p>
            Where email functionality is used, information such as an email address may be
            transmitted to an email service provider for purposes such as account
            verification or service-related communications.
          </p>

          <h3 className="text-base font-semibold text-foreground mt-4 mb-2">Legal or Security Requirements</h3>
          <p>We may disclose information when reasonably necessary to:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Comply with applicable law</li>
            <li>Respond to valid legal requests</li>
            <li>Protect users</li>
            <li>Protect the Service</li>
            <li>Investigate fraud or abuse</li>
            <li>Address security incidents</li>
            <li>Protect our rights or property</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">10. Third-Party Services</h2>
          <p>DebateAI may integrate with or depend upon third-party services, including:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li><strong>Google Gemini API</strong> (AI-powered features)</li>
            <li><strong>Google OAuth</strong> (account authentication)</li>
            <li>Database providers</li>
            <li>Cloud infrastructure providers</li>
            <li>Email providers</li>
            <li>Hosting providers</li>
            <li>Monitoring or analytics services, if enabled</li>
          </ul>
          <p className="mt-2">Third-party providers may have their own privacy policies and terms.</p>
          <p className="mt-2">AOSSIE does not control the privacy practices of independent third-party services.</p>
          <p className="mt-2">Users should review the applicable policies of third-party services when using functionality that depends on them.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">11. Data Security</h2>
          <p>We take reasonable measures to protect information processed by DebateAI. These measures may include:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Authentication and authorization controls</li>
            <li>JWT-based authentication</li>
            <li>Role-based access controls where applicable</li>
            <li>Access restrictions</li>
            <li>Secure database access</li>
            <li>Request validation</li>
            <li>Security monitoring</li>
            <li>Infrastructure-level security controls</li>
          </ul>
          <p className="mt-2">However, no method of electronic transmission, storage, or processing can be guaranteed to be completely secure.</p>
          <p className="mt-2">
            You are also responsible for protecting your account credentials,
            authentication tokens, device, and any information you voluntarily share
            through the Service.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">12. Data Retention</h2>
          <p>
            We retain information for as long as reasonably necessary to provide the
            Service, maintain security, comply with applicable obligations, resolve
            disputes, and enforce our agreements.
          </p>
          <p className="mt-2">The exact retention period may vary depending on:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>The type of information</li>
            <li>The purpose for which it was collected</li>
            <li>Operational requirements</li>
            <li>Security requirements</li>
            <li>Legal requirements</li>
          </ul>
          <p className="mt-2">Some debate-related information may remain associated with a debate or account after the debate has ended.</p>
          <p className="mt-2">If specific retention periods are introduced for particular categories of data, this Privacy Policy may be updated accordingly.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">13. Data Deletion</h2>
          <p>Where applicable, users may request deletion of personal information associated with their account.</p>
          <p className="mt-2">Deletion requests may be submitted to: <strong>contact@aossie.org</strong></p>
          <p className="mt-2">
            When making a request, provide sufficient information for us to identify the
            relevant account without sending passwords, authentication tokens, or other
            unnecessary sensitive credentials.
          </p>
          <p className="mt-2">Some information may need to be retained where required for:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Legal compliance</li>
            <li>Security</li>
            <li>Fraud prevention</li>
            <li>Dispute resolution</li>
            <li>Enforcement of agreements</li>
            <li>Legitimate operational requirements</li>
          </ul>
          <p className="mt-2">Deletion of an account or information may also result in the loss of associated application functionality or content.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">14. Data Access and Correction</h2>
          <p>Where applicable, users may request access to or correction of personal information associated with their account.</p>
          <p className="mt-2">Requests may be submitted to: <strong>contact@aossie.org</strong></p>
          <p className="mt-2">We may need to verify the request before providing or modifying account information.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">15. Children's Privacy</h2>
          <p>
            DebateAI requires users to be at least 13 years old. DebateAI is not intended
            to knowingly collect personal information from children under 13, or from
            children where such collection is otherwise prohibited by applicable law.
          </p>
          <p className="mt-2">
            If you believe that a child has provided personal information to the Service
            in violation of these requirements, please contact: <strong>contact@aossie.org</strong>
          </p>
          <p className="mt-2">We will take reasonable steps to investigate and address the situation.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">16. International Data Processing</h2>
          <p>
            Depending on the infrastructure and third-party services used by DebateAI,
            information may be processed or stored in countries other than the country in
            which you reside.
          </p>
          <p className="mt-2">Different jurisdictions may have different data protection laws.</p>
          <p className="mt-2">
            By using the Service, you acknowledge that information may be processed by
            infrastructure and service providers (including Google, for Gemini and OAuth
            functionality) in locations necessary to provide the Service, subject to
            applicable legal requirements.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">17. Public and Spectator Debates</h2>
          <p>Some DebateAI rooms may be configured as public, private, or invitation-based rooms.</p>
          <p className="mt-2">Information shared in public or spectator-accessible debates should not be considered confidential.</p>
          <p className="mt-2">Before submitting content, consider whether you are comfortable with that content — including audio or video, where enabled — being visible to:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Other debate participants</li>
            <li>Spectators</li>
            <li>Other users who are permitted to access the debate</li>
          </ul>
          <p className="mt-2">
            Do not use a public debate room to share passwords, authentication tokens,
            financial information, government identification numbers, or other sensitive
            personal information.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">18. User Responsibility</h2>
          <p>You are responsible for the information you voluntarily submit to DebateAI.</p>
          <p className="mt-2">In particular, you should avoid submitting unnecessary sensitive information into:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Public debates</li>
            <li>Spectator-accessible rooms</li>
            <li>AI prompts</li>
            <li>Debate messages</li>
            <li>Polls or reactions</li>
          </ul>
          <p className="mt-2">You are also responsible for complying with applicable laws and third-party rights when submitting content.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">19. Data Generated by the Service</h2>
          <p>The Service may generate information based on your use of DebateAI, including:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Ratings</li>
            <li>Elo scores</li>
            <li>Debate statistics</li>
            <li>AI-generated evaluations</li>
            <li>Debate judgments</li>
            <li>Participation statistics</li>
            <li>Matchmaking information</li>
          </ul>
          <p className="mt-2">These values may be generated algorithmically and may not always be accurate.</p>
          <p className="mt-2">They are primarily intended to support the functionality of DebateAI.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">20. No Sale of Personal Information</h2>
          <p>AOSSIE does not sell users' personal information.</p>
          <p className="mt-2">We also do not intend to use personal information for targeted advertising through DebateAI.</p>
          <p className="mt-2">If the Service's data practices materially change, this Privacy Policy will be updated accordingly.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">21. Your Privacy Choices</h2>
          <p>Depending on the functionality available, you may be able to:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Update profile information</li>
            <li>Stop using the Service</li>
            <li>Sign out of your account</li>
            <li>Clear locally stored browser data</li>
            <li>Request deletion of account information</li>
            <li>Request access to or correction of personal information</li>
          </ul>
          <p className="mt-2">Some locally stored information can be removed by clearing the application's browser storage.</p>
          <p className="mt-2">Clearing browser storage does not necessarily delete information already stored on DebateAI's servers.</p>
          <p className="mt-2">For server-side deletion requests, contact: <strong>contact@aossie.org</strong></p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">22. Changes to This Privacy Policy</h2>
          <p>We may update this Privacy Policy when:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>The Service changes</li>
            <li>New features are introduced</li>
            <li>Third-party services change</li>
            <li>Data-processing practices change</li>
            <li>Legal requirements change</li>
          </ul>
          <p className="mt-2">The "Last updated" date at the beginning of this policy will be updated when material changes are made.</p>
          <p className="mt-2">We encourage users to review this policy periodically.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">23. Contact Us</h2>
          <p>
            If you have questions, concerns, or requests regarding this Privacy Policy or
            DebateAI's privacy practices, contact:
          </p>
          <p className="mt-2">
            <strong>Email:</strong> contact@aossie.org
            <br />
            <strong>Organization:</strong> AOSSIE
          </p>
          <p className="mt-2">
            You can also reach us via our{' '}
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
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">24. Legal Notice</h2>
          <p>This Privacy Policy is intended to provide transparency regarding the data practices of DebateAI.</p>
          <p className="mt-2">It is not a substitute for professional legal advice.</p>
          <p className="mt-2">
            Because privacy requirements vary between jurisdictions, AOSSIE should obtain
            appropriate legal review before treating this document as a complete
            compliance policy for a specific jurisdiction.
          </p>
        </section>
      </div>
    </div>
  );
}

export default PrivacyPolicy;

function About() {
  return (
    <div className="min-h-screen py-8 px-4 md:px-16 lg:px-32 text-foreground">
      {/* Main Heading */}
      <h1 className="text-3xl md:text-4xl font-bold mb-4 text-center">
        About DebateAI
      </h1>

      {/* Intro Paragraph */}
      <p className="text-center text-base md:text-lg text-muted-foreground mb-8 leading-relaxed">
        DebateAI is a platform dedicated to helping you sharpen your
        argumentation and public speaking skills through interactive,
        AI-enhanced debates. Whether you’re a seasoned debater or just starting
        out, you’ll find exciting real-time challenges, structured debate
        formats, and a vibrant community ready to engage with you.
      </p>

      {/* Our Mission */}
      <section className="my-10 space-y-4">
        <h2 className="text-2xl md:text-3xl font-semibold">Our Mission</h2>
        <p className="leading-relaxed text-base md:text-lg">
          We believe that strong communication skills are essential in every
          area of life. Our goal is to make debate practice accessible, fun, and
          effective. Through DebateAI, you can learn to construct compelling
          arguments, understand multiple perspectives, and boost your confidence
          in presenting your ideas—all in an engaging, interactive environment.
        </p>
      </section>

      {/* Key Features */}
      <section className="my-10 space-y-4">
        <h2 className="text-2xl md:text-3xl font-semibold">Key Features</h2>
        <ul className="list-disc list-inside space-y-3 text-base md:text-lg leading-relaxed">
          <li>
            <strong>AI-Enhanced Debates:</strong> Challenge an AI-driven
            opponent that adapts to your arguments in real time.
          </li>
          <li>
            <strong>Real-Time User Matchups:</strong> Engage in live debates
            with fellow users on topics ranging from pop culture to global
            issues.
          </li>
          <li>
            <strong>Structured Formats:</strong> Practice formal debate rounds
            including opening statements, rebuttals, and closing arguments.
          </li>
          <li>
            <strong>Personalized Progress Tracking:</strong> Keep tabs on your
            debate history, ratings, and skill improvements.
          </li>
          <li>
            <strong>Community-Driven Topics:</strong> Suggest new debate topics
            and vote on trending issues to keep discussions fresh and relevant.
          </li>
        </ul>
      </section>

      {/* How It Benefits You */}
      <section className="my-10 space-y-4">
        <h2 className="text-2xl md:text-3xl font-semibold">
          How DebateAI Benefits You
        </h2>
        <p className="leading-relaxed text-base md:text-lg">
          By combining modern AI technology with interactive debate formats,
          DebateAI helps you:
        </p>
        <ul className="list-disc list-inside space-y-3 text-base md:text-lg leading-relaxed">
          <li>Build critical thinking and persuasive communication skills.</li>
          <li>
            Gain confidence in articulating your viewpoints in front of others.
          </li>
          <li>
            Explore diverse perspectives and expand your knowledge on current
            events.
          </li>
          <li>
            Receive instant feedback from both AI opponents and community
            members.
          </li>
        </ul>
      </section>

      {/* Contributing / Community Involvement */}
      <section className="my-10 space-y-4">
        <h2 className="text-2xl md:text-3xl font-semibold">Get Involved</h2>
        <p className="leading-relaxed text-base md:text-lg">
          We’re always looking for passionate debaters, topic curators, and
          community members who want to help us grow. Here’s how you can
          contribute:
        </p>
        <ul className="list-disc list-inside space-y-3 text-base md:text-lg leading-relaxed">
          <li>
            <strong>Suggest New Features:</strong> Have an idea to improve
            DebateAI? Share it in our feedback forum.
          </li>
          <li>
            <strong>Submit Debate Topics:</strong> Propose topics you’re
            passionate about and spark meaningful discussions.
          </li>
          <li>
            <strong>Join the Community:</strong> Participate in forums, attend
            online meetups, and help new members get started.
          </li>
        </ul>
      </section>

      {/* Closing */}
      <p className="text-center text-sm md:text-base text-muted-foreground mt-12">
        Thank you for being a part of DebateAI. Together, let’s make
        argumentation and critical thinking skills accessible to everyone!
      </p>

      {/* Footer */}
      <footer className="text-center text-xs md:text-sm text-muted-foreground mt-8">
        © 2016-2025 AOSSIE. All rights reserved.
      </footer>
    </div>
  );
}

export default About;

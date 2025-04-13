import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const CoachPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-background text-foreground p-6 flex flex-col justify-center">
      {/* Header Section */}
      <header className="text-center mb-8">
        <h1 className="text-4xl font-bold text-primary">AI Debate Coach</h1>
        <p className="text-lg text-muted-foreground mt-2">
          Elevate your debating prowess with intelligent, AI-driven guidance.
        </p>
      </header>

      {/* Featured Learning Path */}
      <section className="mb-8">
        <h2 className="text-2xl font-bold mb-4 text-center">Featured Learning Path</h2>
        <Card className="max-w-xl mx-auto shadow-xl hover:shadow-2xl transition-shadow border-l-4 border-primary">
          <CardContent className="p-6">
            <h3 className="text-2xl font-semibold mb-2">Strengthen Argument</h3>
            <p className="text-md text-muted-foreground mb-4">
              Master the art of crafting compelling, persuasive arguments that win debates.
            </p>
            <Link to="/coach/strengthen-argument">
              <Button className="bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors">
                Start Now
              </Button>
            </Link>
          </CardContent>
        </Card>
      </section>

      {/* Upcoming Learning Paths */}
      <section>
        <h2 className="text-2xl font-bold mb-4 text-center">More Learning Paths Coming Soon</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
          <Card className="shadow-lg h-full">
            <CardContent className="p-4">
              <h3 className="text-lg font-semibold mb-1">Rebuttal Techniques</h3>
              <p className="text-sm text-muted-foreground mb-2">
                Learn to dismantle opponents' arguments with precision and confidence.
              </p>
              <span className="text-xs italic text-muted-foreground">Coming Soon</span>
            </CardContent>
          </Card>
          <Card className="shadow-lg h-full">
            <CardContent className="p-4">
              <h3 className="text-lg font-semibold mb-1">Evidence Evaluation</h3>
              <p className="text-sm text-muted-foreground mb-2">
                Assess and leverage evidence to bolster your debate performance.
              </p>
              <span className="text-xs italic text-muted-foreground">Coming Soon</span>
            </CardContent>
          </Card>
          <Card className="shadow-lg h-full">
            <CardContent className="p-4">
              <h3 className="text-lg font-semibold mb-1">Debate Strategy</h3>
              <p className="text-sm text-muted-foreground mb-2">
                Develop winning strategies to outsmart your opponents.
              </p>
              <span className="text-xs italic text-muted-foreground">Coming Soon</span>
            </CardContent>
          </Card>
          <Card className="shadow-lg h-full">
            <CardContent className="p-4">
              <h3 className="text-lg font-semibold mb-1">Public Speaking Skills</h3>
              <p className="text-sm text-muted-foreground mb-2">
                Enhance your delivery and captivate any audience.
              </p>
              <span className="text-xs italic text-muted-foreground">Coming Soon</span>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center mt-8">
        <p className="text-sm text-muted-foreground">
          Stay tuned for more exciting features!
        </p>
      </footer>
    </div>
  );
};

export default CoachPage;
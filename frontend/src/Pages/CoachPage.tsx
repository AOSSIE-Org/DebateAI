import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, Sparkles } from "lucide-react"; // Assuming Lucide icons are installed

const CoachPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-r from-primary/10 to-secondary/10 py-16 md:py-24">
        <div className="container mx-auto px-6 text-center">
          <h1 className="text-5xl md:text-6xl font-extrabold text-foreground mb-4">
            AI Debate Coach
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-6">
            Elevate your debating skills with personalized, AI-driven guidance designed to make you a master debater.
          </p>
          <Link to="/coach/strengthen-argument">
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-3 text-lg rounded-full">
              Start Learning <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Featured Learning Paths */}
      <section className="py-12 bg-background">
        <div className="container mx-auto px-6">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-8">Featured Learning Paths</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            {/* Strengthen Argument Card */}
            <Card className="group shadow-lg hover:shadow-xl transition-all duration-300 border-l-4 border-primary">
              <CardHeader>
                <CardTitle className="text-xl font-semibold flex items-center">
                  <BookOpen className="h-6 w-6 mr-2 text-primary" />
                  Strengthen Argument
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Master the art of crafting compelling, persuasive arguments that win debates.
                </p>
                <Link to="/coach/strengthen-argument">
                  <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground group-hover:scale-105 transition-transform">
                    Start Now
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Pros and Cons Challenge Card */}
            <Card className="group shadow-lg hover:shadow-xl transition-all duration-300 border-l-4 border-primary">
              <CardHeader>
                <CardTitle className="text-xl font-semibold flex items-center">
                  <Sparkles className="h-6 w-6 mr-2 text-primary" />
                  Pros and Cons Challenge
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Test your critical thinking by crafting up to 5 pros and cons for engaging debate topics.
                </p>
                <Link to="/coach/pros-cons">
                  <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground group-hover:scale-105 transition-transform">
                    Try Challenge
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Upcoming Learning Paths */}
      <section className="py-12 bg-muted/50">
        <div className="container mx-auto px-6">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-8">More Learning Paths Coming Soon</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {[
              {
                title: "Rebuttal Techniques",
                desc: "Learn to dismantle opponents' arguments with precision and confidence.",
              },
              {
                title: "Evidence Evaluation",
                desc: "Assess and leverage evidence to bolster your debate performance.",
              },
              {
                title: "Debate Strategy",
                desc: "Develop winning strategies to outsmart your opponents.",
              },
              {
                title: "Public Speaking Skills",
                desc: "Enhance your delivery and captivate any audience.",
              },
            ].map((path, index) => (
              <Card
                key={index}
                className="shadow-md hover:shadow-lg transition-all duration-300 h-full flex flex-col"
              >
                <CardHeader>
                  <CardTitle className="text-lg font-semibold">{path.title}</CardTitle>
                </CardHeader>
                <CardContent className="flex-grow">
                  <p className="text-sm text-muted-foreground mb-2">{path.desc}</p>
                  <span className="text-xs italic text-muted-foreground">Coming Soon</span>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 bg-background text-center">
        <div className="container mx-auto px-6">
          <h3 className="text-xl font-semibold mb-2">Stay Updated</h3>
          <p className="text-muted-foreground mb-4">
            Subscribe to get the latest updates on new learning paths and features!
          </p>
          <div className="max-w-md mx-auto flex gap-2">
            <input
              type="email"
              placeholder="Enter your email"
              className="flex-grow px-4 py-2 rounded-lg bg-input text-foreground border border-border"
              disabled
            />
            <Button disabled className="bg-primary hover:bg-primary/90 text-primary-foreground">
              Subscribe
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            © 2025 ArgueHub. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default CoachPage;
import React from "react";
import { Heart, Star, Code, Github, Gift, Share2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const SupportOpenSource: React.FC = () => {
  return (
    <div className="min-h-screen py-12 px-4 md:px-16 lg:px-32 bg-gradient-to-b from-background to-accent/20 text-foreground">
      {/* Hero Section */}
      <div className="max-w-4xl mx-auto text-center space-y-6 mb-16">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 text-red-500 text-sm font-semibold border border-red-500/20 animate-pulse">
          <Heart className="w-4 h-4 fill-current" />
          <span>Support Open Source</span>
        </div>
        
        <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-tight">
          Help Us Build the Future of <br className="hidden md:block" />
          <span className="bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
            DebateAI
          </span>
        </h1>

        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          DebateAI is an open-source project by <strong>AOSSIE</strong>. We are dedicated to making critical thinking, structured argumentation, and debating education open and accessible to everyone worldwide.
        </p>

        <div className="flex flex-wrap justify-center gap-4 pt-4">
          <a
            href="https://github.com/AOSSIE-Org/DebateAI"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button className="font-bold gap-2 px-6 h-12">
              <Github className="w-5 h-5" />
              Star on GitHub
              <ArrowRight className="w-4 h-4" />
            </Button>
          </a>
          <a
            href="https://aossie.org"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" className="font-bold gap-2 px-6 h-12 border-primary text-primary hover:bg-primary/10">
              Learn about AOSSIE
            </Button>
          </a>
        </div>
      </div>

      {/* Ways to Support Grid */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
        {/* Support Option 1: Code */}
        <div className="flex flex-col justify-between p-8 rounded-2xl border border-border bg-card hover:shadow-xl hover:border-primary/50 transition-all duration-300 group">
          <div className="space-y-4">
            <div className="p-3 w-fit rounded-xl bg-primary/10 text-primary group-hover:scale-110 transition-transform">
              <Code className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold">Contribute Code</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              We love pull requests! Help us fix bugs, implement new features, improve test coverage, or refine the UI. Check out our open issues to get started.
            </p>
          </div>
          <div className="pt-6">
            <a
              href="https://github.com/AOSSIE-Org/DebateAI/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline font-semibold text-sm flex items-center gap-1"
            >
              Browse issues <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>

        {/* Support Option 2: Star */}
        <div className="flex flex-col justify-between p-8 rounded-2xl border border-border bg-card hover:shadow-xl hover:border-primary/50 transition-all duration-300 group">
          <div className="space-y-4">
            <div className="p-3 w-fit rounded-xl bg-yellow-500/10 text-yellow-500 group-hover:scale-110 transition-transform">
              <Star className="w-6 h-6 fill-current" />
            </div>
            <h3 className="text-xl font-bold">Spread the Word</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Starring our repository helps increase its visibility. You can also share the project with fellow students, teachers, debaters, and developers!
            </p>
          </div>
          <div className="pt-6">
            <a
              href="https://github.com/AOSSIE-Org/DebateAI"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline font-semibold text-sm flex items-center gap-1"
            >
              Star the repo <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>

        {/* Support Option 3: Donations */}
        <div className="flex flex-col justify-between p-8 rounded-2xl border border-border bg-card hover:shadow-xl hover:border-primary/50 transition-all duration-300 group">
          <div className="space-y-4">
            <div className="p-3 w-fit rounded-xl bg-purple-500/10 text-purple-500 group-hover:scale-110 transition-transform">
              <Gift className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold">Sponsor & Support</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Support AOSSIE as a sponsoring organization. Financial support helps us cover hosting costs, API budgets, and mentor community programs.
            </p>
          </div>
          <div className="pt-6">
            <a
              href="https://aossie.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline font-semibold text-sm flex items-center gap-1"
            >
              Sponsor AOSSIE <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>

      {/* AOSSIE Organization Info */}
      <div className="max-w-4xl mx-auto rounded-3xl border border-border bg-card/50 p-8 md:p-12 backdrop-blur-sm space-y-6">
        <h3 className="text-2xl font-bold text-center">About AOSSIE</h3>
        <p className="text-muted-foreground text-center leading-relaxed">
          AOSSIE is an umbrella organization for open-source development, dedicated to creating educational tools, research platforms, and collaborative spaces. DebateAI is part of our suite of applications designed to empower minds globally through technology.
        </p>
        <div className="flex justify-center gap-6 text-sm text-muted-foreground pt-4 border-t border-border">
          <span className="flex items-center gap-1">
            <Code className="w-4 h-4" /> 100% Open Source
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <Heart className="w-4 h-4 text-red-500" /> Community Driven
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <Share2 className="w-4 h-4" /> Globally Accessible
          </span>
        </div>
      </div>

      {/* Footer */}
      <footer className="text-center text-xs md:text-sm text-muted-foreground mt-16 pt-8 border-t border-border/30">
        © 2016-{new Date().getFullYear()} <a href="https://aossie.org" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">AOSSIE</a>. All rights reserved.
      </footer>
    </div>
  );
};

export default SupportOpenSource;

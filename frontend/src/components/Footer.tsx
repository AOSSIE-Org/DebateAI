// src/components/Footer.tsx
import React from 'react';
import { NavLink } from 'react-router-dom';
import { Github, MessageCircle, Heart } from 'lucide-react';
import debateAiLogo from '@/assets/aossie.png';

function Footer() {
  return (
    <footer className="border-t border-border bg-background px-4 py-6 md:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 md:flex-row md:items-start md:justify-between">
        {/* Brand */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold">DebateAI by</span>
            
              <a href="https://aossie.org"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:opacity-80 transition-opacity"
            >
              <img
                src={debateAiLogo}
                alt="DebateAI Logo"
                className="h-6 w-auto object-contain"
              />
            </a>
          </div>
          <p className="text-sm text-muted-foreground max-w-xs">
            AI-powered debate practice platform, built by AOSSIE.
          </p>
        </div>

        {/* Navigation */}
        <div className="flex flex-col gap-2">
          <h4 className="text-sm font-semibold text-foreground">Navigate</h4>
          <NavLink to="/startDebate" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Start Debate
          </NavLink>
          <NavLink to="/leaderboard" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Leaderboard
          </NavLink>
          <NavLink to="/about" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            About
          </NavLink>
          <NavLink to="/support-os" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
            Support DebateAI <Heart className="h-3 w-3 text-red-500" />
          </NavLink>
        </div>

        {/* Legal */}
        <div className="flex flex-col gap-2">
          <h4 className="text-sm font-semibold text-foreground">Legal</h4>
          <NavLink to="/privacy-policy" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Privacy Policy
          </NavLink>
          <NavLink to="/terms-of-service" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Terms of Service
          </NavLink>
        </div>

        {/* Community / Social */}
        <div className="flex flex-col gap-2">
          <h4 className="text-sm font-semibold text-foreground">Community</h4>
          
            <a href="https://discord.com/invite/hjUhu33uAn"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            <MessageCircle className="h-4 w-4" /> Discord
          </a>
          
           <a href="https://github.com/AOSSIE-Org/DebateAI"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            <Github className="h-4 w-4" /> GitHub
          </a>
        </div>
      </div>

      <div className="mx-auto mt-6 max-w-7xl border-t border-border pt-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} DebateAI · AOSSIE. All rights reserved.
      </div>
    </footer>
  );
}

export default Footer;
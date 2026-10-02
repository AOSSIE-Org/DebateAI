// src/components/Footer.tsx

import React from "react";
import { NavLink } from "react-router-dom";
import {
  FaGithub,
  FaLinkedin,
  FaDiscord,
  FaYoutube,
  FaXTwitter,
  FaEnvelope,
} from "react-icons/fa6";
import { Heart } from "lucide-react";
import debateAiLogo from "@/assets/aossie.png";

const footerLinks = [
  {
    label: "Start Debate",
    href: "/startDebate",
  },
  {
    label: "Leaderboard",
    href: "/leaderboard",
  },
  {
    label: "About DebateAI",
    href: "/about",
  },
  {
    label: "Support Us",
    href: "/support-os",
  },
];

const legalLinks = [
  {
    label: "Privacy Policy",
    href: "/privacy-policy",
  },
  {
    label: "Terms of Service",
    href: "/terms-of-service",
  },
];

const socialLinks = [
  {
    label: "Email",
    href: "mailto:aossie.oss@gmail.com",
    icon: FaEnvelope,
  },
  {
    label: "GitHub",
    href: "https://github.com/AOSSIE-Org",
    icon: FaGithub,
  },
  {
    label: "Discord",
    href: "https://discord.com/invite/hjUhu33uAn",
    icon: FaDiscord,
  },
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/company/aossie/",
    icon: FaLinkedin,
  },
  {
    label: "X",
    href: "https://x.com/aossie_org",
    icon: FaXTwitter,
  },
  {
    label: "YouTube",
    href: "https://www.youtube.com/@AOSSIE-Org",
    icon: FaYoutube,
  },
];

function Footer() {
  return (
    <footer
      role="contentinfo"
      className="border-t border-border bg-background px-4 py-6 md:px-8"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-8 md:flex-row md:items-start md:justify-between">
        {/* BRAND */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold">DebateAI by</span>

            <a
              href="https://aossie.org"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Visit AOSSIE website"
              className="transition-opacity hover:opacity-80"
            >
              <img
                src={debateAiLogo}
                alt="AOSSIE"
                className="h-6 w-auto object-contain"
              />
            </a>
          </div>

          <p className="max-w-xs text-sm leading-5 text-muted-foreground">
            AI-powered debate practice platform, built by AOSSIE to help
            sharpen communication, argumentation, and critical thinking skills.
          </p>
        </div>

        {/* EXPLORE */}
        <div className="flex flex-col gap-3">
          <h4 className="text-sm font-semibold text-foreground">Explore</h4>

          <div className="flex flex-col gap-2">
            {footerLinks.map((item) => (
              <NavLink
                key={item.label}
                to={item.href}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        </div>

        {/* LEGAL */}
        <div className="flex flex-col gap-3">
          <h4 className="text-sm font-semibold text-foreground">Legal</h4>

          <div className="flex flex-col gap-2">
            {legalLinks.map((item) => (
              <NavLink
                key={item.label}
                to={item.href}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        </div>

        {/* COMMUNITY */}
        <div className="flex flex-col gap-3">
          <h4 className="text-sm font-semibold text-foreground">
            Community
          </h4>

          <div className="flex items-center gap-4">
            {socialLinks.map((item) => {
              const Icon = item.icon;
              const isEmail = item.href.startsWith("mailto:");

              return (
                <a
                  key={item.label}
                  href={item.href}
                  target={isEmail ? undefined : "_blank"}
                  rel={isEmail ? undefined : "noopener noreferrer"}
                  aria-label={`Visit our ${item.label}`}
                  title={item.label}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Icon className="h-[18px] w-[18px]" />
                </a>
              );
            })}
          </div>

          <p className="max-w-[220px] text-xs leading-5 text-muted-foreground">
            Join the AOSSIE community and help us build open-source software
            together.
          </p>
        </div>
      </div>

      {/* BOTTOM */}
      <div className="mx-auto mt-8 flex max-w-7xl flex-col items-center gap-2 border-t border-border pt-4 text-center md:flex-row md:justify-between">
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} DebateAI · AOSSIE. All rights reserved.
        </p>

        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          Made with
          <Heart
            className="h-3.5 w-3.5 fill-current text-red-500"
            aria-hidden="true"
          />
          by{" "}
          <a
            href="https://github.com/AOSSIE-Org"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-foreground transition-colors hover:text-primary"
          >
            AOSSIE
          </a>
        </p>
      </div>
    </footer>
  );
}

export default Footer;
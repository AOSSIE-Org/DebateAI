import { useContext } from "react";
import SupportUsButton, { supportUsButtonProps } from "support-us-button";
import supportStyles from "support-us-button/style.css?raw";
import { ThemeContext, ThemeOptions } from "../context/theme-provider";
import aossieLogo from "../assets/aossie.png";
import debateAiLogo from "../assets/debateai-logo.svg"

const SupportOpenSource = () => {
  const { theme } = useContext(ThemeContext);
  const currentTheme = theme === ThemeOptions.Light ? "light" : "dark";

  const buttonProps: supportUsButtonProps = {
    Theme: currentTheme,
    projectInformation: {
      name: "DebateAI",
      image: debateAiLogo,
      description:
        "DebateAI is an open-source platform that allows you to debate with other people and have your debates evaluated by AI, or practice and sharpen your debate skills directly against diverse AI personalities.",
    },

    organizationInformation: {
      name: "AOSSIE",
      image: aossieLogo,
      link: "https://aossie.org",
      desc: "AOSSIE is a non-profit organization dedicated to building impactful open-source software, mentoring contributors, and fostering innovation through global collaboration.",
    },

    sponsors: [
      {
        name: "Google Summer of Code",
      },
    ],

    ctaSection: {
      sponsorLink: [
        {
          name: "Support Now",
          url: "https://buymeacoffee.com/aossie",
        },
      ],
    },
    Logo: true,
    className:
      "w-full !px-4 sm:!px-8 md:!px-16 !py-8 sm:!py-10 md:!py-14 rounded-2xl border border-border/40 shadow-sm transition-all duration-300",
  };

  return (
    <div className="w-full min-h-full flex items-center justify-center py-2 sm:py-6 px-1 sm:px-3">
      <style dangerouslySetInnerHTML={{ __html: supportStyles }} />
      <div className="w-full max-w-6xl mx-auto overflow-hidden">
        <SupportUsButton {...buttonProps} />
      </div>
    </div>
  );
};

export default SupportOpenSource;
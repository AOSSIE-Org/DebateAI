import React from "react";
import { BadgeCheck } from "lucide-react";

export interface SocialVerificationBadgeProps {
  verified?: boolean;
  size?: "xs" | "sm" | "md";
  showText?: boolean;
  className?: string;
  tooltip?: string;
}

/**
 * SocialVerificationBadge Component
 *
 * Displays a verification badge next to validated social media profile links,
 * signifying that the handle/URL has been strictly validated and points to an
 * official, whitelisted platform domain.
 */
export const SocialVerificationBadge: React.FC<SocialVerificationBadgeProps> = ({
  verified = true,
  size = "xs",
  showText = false,
  className = "",
  tooltip = "Verified Social Handle — Validated format from trusted official domain",
}) => {
  if (!verified) return null;

  const sizeClasses = {
    xs: "w-3.5 h-3.5",
    sm: "w-4 h-4",
    md: "w-5 h-5",
  };

  const textClasses = {
    xs: "text-[10px] py-0 px-1",
    sm: "text-xs py-0.5 px-1.5",
    md: "text-xs py-0.5 px-2",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 rounded-full border border-emerald-200 dark:border-emerald-800 transition-colors select-none ${textClasses[size]} ${className}`}
      title={tooltip}
    >
      <BadgeCheck className={`${sizeClasses[size]} text-emerald-500 fill-emerald-500/15 shrink-0`} />
      {showText && <span>Verified</span>}
    </span>
  );
};

export default SocialVerificationBadge;

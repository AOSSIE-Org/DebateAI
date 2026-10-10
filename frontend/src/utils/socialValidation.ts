export type SupportedPlatform = "twitter" | "instagram" | "linkedin" | "github";

export interface PlatformConfig {
  id: SupportedPlatform;
  name: string;
  label: string;
  placeholder: string;
  allowedDomains: string[];
  canonicalBaseUrl: string;
  handlePattern: RegExp;
  minHandleLength: number;
  maxHandleLength: number;
  formatHandleForDisplay: (handle: string) => string;
  buildProfileUrl: (handle: string) => string;
}

export const SUPPORTED_PLATFORMS: Record<SupportedPlatform, PlatformConfig> = {
  twitter: {
    id: "twitter",
    name: "X (formerly Twitter)",
    label: "X / Twitter",
    placeholder: "username or https://x.com/username",
    allowedDomains: ["x.com", "twitter.com", "mobile.twitter.com"],
    canonicalBaseUrl: "https://x.com",
    handlePattern: /^[a-zA-Z0-9_]{1,15}$/,
    minHandleLength: 1,
    maxHandleLength: 15,
    formatHandleForDisplay: (handle) => (handle.startsWith("@") ? handle : `@${handle}`),
    buildProfileUrl: (handle) => `https://x.com/${handle.replace(/^@/, "")}`,
  },
  instagram: {
    id: "instagram",
    name: "Instagram",
    label: "Instagram",
    placeholder: "username or https://instagram.com/username",
    allowedDomains: ["instagram.com"],
    canonicalBaseUrl: "https://instagram.com",
    handlePattern: /^[a-zA-Z0-9._]{1,30}$/,
    minHandleLength: 1,
    maxHandleLength: 30,
    formatHandleForDisplay: (handle) => (handle.startsWith("@") ? handle : `@${handle}`),
    buildProfileUrl: (handle) => `https://instagram.com/${handle.replace(/^@/, "")}`,
  },
  linkedin: {
    id: "linkedin",
    name: "LinkedIn",
    label: "LinkedIn",
    placeholder: "username, in/username, or profile URL",
    allowedDomains: ["linkedin.com"],
    canonicalBaseUrl: "https://linkedin.com/in",
    handlePattern: /^[a-zA-Z0-9-]{3,100}$/,
    minHandleLength: 3,
    maxHandleLength: 100,
    formatHandleForDisplay: (handle) => (handle.startsWith("in/") ? handle : `in/${handle}`),
    buildProfileUrl: (handle) => `https://linkedin.com/in/${handle.replace(/^in\//, "")}`,
  },
  github: {
    id: "github",
    name: "GitHub",
    label: "GitHub",
    placeholder: "username or https://github.com/username",
    allowedDomains: ["github.com"],
    canonicalBaseUrl: "https://github.com",
    // GitHub: 1-39 chars, alphanumeric and single hyphens, cannot start or end with hyphen
    handlePattern: /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/,
    minHandleLength: 1,
    maxHandleLength: 39,
    formatHandleForDisplay: (handle) => (handle.startsWith("@") ? handle : `@${handle}`),
    buildProfileUrl: (handle) => `https://github.com/${handle.replace(/^@/, "")}`,
  },
};

export interface SocialValidationResult {
  isValid: boolean;
  handle: string;
  url: string;
  error?: string;
  isVerified: boolean;
}

/**
 * Validates whether a hostname belongs to the whitelist of trusted domains for a platform.
 */
function isDomainWhitelisted(hostname: string, allowedDomains: string[]): boolean {
  const cleanHost = hostname.toLowerCase().replace(/^www\./, "");
  return allowedDomains.some((domain) => cleanHost === domain || cleanHost.endsWith(`.${domain}`));
}

/**
 * Parses user input (which can be a clean handle, @handle, or full URL),
 * validates against trusted domain whitelist and handle structure rules,
 * and converts to standardized clean handle and canonical URL.
 */
export function parseAndValidateSocialInput(
  platform: SupportedPlatform,
  rawInput: string
): SocialValidationResult {
  const config = SUPPORTED_PLATFORMS[platform];
  if (!config) {
    return {
      isValid: false,
      handle: "",
      url: "",
      error: `Unsupported platform: ${platform}`,
      isVerified: false,
    };
  }

  const trimmed = rawInput.trim();
  if (!trimmed) {
    return {
      isValid: true,
      handle: "",
      url: "",
      isVerified: false,
    };
  }

  let candidateHandle = trimmed;

  // Check if input appears to be a URL
  const looksLikeUrl =
    /^https?:\/\//i.test(trimmed) ||
    /^\/\//.test(trimmed) ||
    config.allowedDomains.some((domain) =>
      trimmed.toLowerCase().startsWith(domain) || trimmed.toLowerCase().startsWith(`www.${domain}`)
    );

  if (looksLikeUrl) {
    let urlToParse = trimmed;
    if (!/^https?:\/\//i.test(urlToParse)) {
      urlToParse = `https://${urlToParse.replace(/^\/\//, "")}`;
    }

    try {
      const parsedUrl = new URL(urlToParse);

      // Security check: Whitelist trusted domains to prevent phishing / malicious external links
      if (!isDomainWhitelisted(parsedUrl.hostname, config.allowedDomains)) {
        return {
          isValid: false,
          handle: "",
          url: "",
          error: `Untrusted domain "${parsedUrl.hostname}". Only official ${config.name} links (${config.allowedDomains.join(", ")}) are allowed.`,
          isVerified: false,
        };
      }

      // Extract path segments
      const pathSegments = parsedUrl.pathname
        .split("/")
        .map((segment) => segment.trim())
        .filter(Boolean);

      if (pathSegments.length === 0) {
        return {
          isValid: false,
          handle: "",
          url: "",
          error: `URL does not point to a specific ${config.name} profile.`,
          isVerified: false,
        };
      }

      if (platform === "linkedin") {
        if (pathSegments[0] === "in" && pathSegments.length > 1) {
          candidateHandle = pathSegments[1];
        } else {
          candidateHandle = pathSegments[0];
        }
      } else {
        candidateHandle = pathSegments[0];
      }
    } catch {
      return {
        isValid: false,
        handle: "",
        url: "",
        error: "Invalid URL structure.",
        isVerified: false,
      };
    }
  }

  // Strip leading @ or platform prefixes
  candidateHandle = candidateHandle.replace(/^@+/, "");
  if (platform === "linkedin") {
    candidateHandle = candidateHandle.replace(/^in\/+/i, "");
  }

  // Strip any accidental trailing slashes or query parameters
  candidateHandle = candidateHandle.split("/")[0].split("?")[0].split("#")[0].trim();

  if (!candidateHandle) {
    return {
      isValid: false,
      handle: "",
      url: "",
      error: `Please enter a valid ${config.label} handle.`,
      isVerified: false,
    };
  }

  // Length constraints
  if (candidateHandle.length < config.minHandleLength) {
    return {
      isValid: false,
      handle: candidateHandle,
      url: "",
      error: `Handle must be at least ${config.minHandleLength} character${config.minHandleLength > 1 ? "s" : ""}.`,
      isVerified: false,
    };
  }

  if (candidateHandle.length > config.maxHandleLength) {
    return {
      isValid: false,
      handle: candidateHandle,
      url: "",
      error: `Handle cannot exceed ${config.maxHandleLength} characters.`,
      isVerified: false,
    };
  }

  // Platform specific syntax constraints
  if (!config.handlePattern.test(candidateHandle)) {
    if (platform === "twitter") {
      return {
        isValid: false,
        handle: candidateHandle,
        url: "",
        error: "X/Twitter handles can only contain letters, numbers, and underscores.",
        isVerified: false,
      };
    }
    if (platform === "instagram") {
      return {
        isValid: false,
        handle: candidateHandle,
        url: "",
        error: "Instagram handles can only contain letters, numbers, periods, and underscores.",
        isVerified: false,
      };
    }
    if (platform === "linkedin") {
      return {
        isValid: false,
        handle: candidateHandle,
        url: "",
        error: "LinkedIn profile identifiers can only contain letters, numbers, and hyphens.",
        isVerified: false,
      };
    }
    if (platform === "github") {
      return {
        isValid: false,
        handle: candidateHandle,
        url: "",
        error: "GitHub usernames cannot start or end with hyphens or have consecutive hyphens.",
        isVerified: false,
      };
    }
    return {
      isValid: false,
      handle: candidateHandle,
      url: "",
      error: `Invalid handle characters for ${config.label}.`,
      isVerified: false,
    };
  }

  // Special checks for Instagram: cannot start/end with dot, no consecutive dots
  if (platform === "instagram") {
    if (candidateHandle.startsWith(".") || candidateHandle.endsWith(".")) {
      return {
        isValid: false,
        handle: candidateHandle,
        url: "",
        error: "Instagram handles cannot start or end with a period.",
        isVerified: false,
      };
    }
    if (candidateHandle.includes("..")) {
      return {
        isValid: false,
        handle: candidateHandle,
        url: "",
        error: "Instagram handles cannot contain consecutive periods.",
        isVerified: false,
      };
    }
  }

  const standardizedUrl = config.buildProfileUrl(candidateHandle);

  return {
    isValid: true,
    handle: candidateHandle,
    url: standardizedUrl,
    isVerified: true,
  };
}

/**
 * Returns standardized canonical URL for a platform and handle/URL string.
 */
export function getStandardizedSocialUrl(
  platform: SupportedPlatform,
  handleOrUrl: string
): string {
  const result = parseAndValidateSocialInput(platform, handleOrUrl);
  return result.isValid && result.url ? result.url : "";
}

/**
 * Returns clean display text for a social handle.
 */
export function getStandardizedSocialDisplay(
  platform: SupportedPlatform,
  handleOrUrl: string
): string {
  const result = parseAndValidateSocialInput(platform, handleOrUrl);
  if (!result.isValid || !result.handle) return handleOrUrl;
  return SUPPORTED_PLATFORMS[platform].formatHandleForDisplay(result.handle);
}

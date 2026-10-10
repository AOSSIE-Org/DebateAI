import { describe, it } from "node:test";
import assert from "node:assert";
import {
  parseAndValidateSocialInput,
  getStandardizedSocialUrl,
  getStandardizedSocialDisplay,
} from "./socialValidation.ts";

describe("Social Media Handle Validation and Profile Verification", () => {
  describe("X / Twitter validation", () => {
    it("validates and normalizes clean handle", () => {
      const res = parseAndValidateSocialInput("twitter", "elonmusk");
      assert.strictEqual(res.isValid, true);
      assert.strictEqual(res.handle, "elonmusk");
      assert.strictEqual(res.url, "https://x.com/elonmusk");
      assert.strictEqual(res.isVerified, true);
    });

    it("strips leading @ symbol", () => {
      const res = parseAndValidateSocialInput("twitter", "@jack");
      assert.strictEqual(res.isValid, true);
      assert.strictEqual(res.handle, "jack");
      assert.strictEqual(res.url, "https://x.com/jack");
    });

    it("parses full official URLs (x.com and twitter.com)", () => {
      const resX = parseAndValidateSocialInput("twitter", "https://x.com/jack");
      assert.strictEqual(resX.isValid, true);
      assert.strictEqual(resX.handle, "jack");
      assert.strictEqual(resX.url, "https://x.com/jack");

      const resTwitter = parseAndValidateSocialInput("twitter", "https://twitter.com/jack");
      assert.strictEqual(resTwitter.isValid, true);
      assert.strictEqual(resTwitter.handle, "jack");
      assert.strictEqual(resTwitter.url, "https://x.com/jack");
    });

    it("rejects untrusted phishing domains", () => {
      const res = parseAndValidateSocialInput("twitter", "https://evil-phishing.com/jack");
      assert.strictEqual(res.isValid, false);
      assert.match(res.error || "", /Untrusted domain/i);
    });

    it("rejects invalid characters and handles longer than 15 characters", () => {
      const resInvalid = parseAndValidateSocialInput("twitter", "user!name");
      assert.strictEqual(resInvalid.isValid, false);

      const resTooLong = parseAndValidateSocialInput("twitter", "a".repeat(16));
      assert.strictEqual(resTooLong.isValid, false);
    });
  });

  describe("Instagram validation", () => {
    it("validates handle and builds canonical URL", () => {
      const res = parseAndValidateSocialInput("instagram", "sample_user.99");
      assert.strictEqual(res.isValid, true);
      assert.strictEqual(res.handle, "sample_user.99");
      assert.strictEqual(res.url, "https://instagram.com/sample_user.99");
    });

    it("rejects leading or trailing periods and consecutive periods", () => {
      const resLeading = parseAndValidateSocialInput("instagram", ".baduser");
      assert.strictEqual(resLeading.isValid, false);

      const resTrailing = parseAndValidateSocialInput("instagram", "baduser.");
      assert.strictEqual(resTrailing.isValid, false);

      const resConsecutive = parseAndValidateSocialInput("instagram", "bad..user");
      assert.strictEqual(resConsecutive.isValid, false);
    });

    it("parses and validates full instagram.com URL", () => {
      const res = parseAndValidateSocialInput("instagram", "https://www.instagram.com/valid_user");
      assert.strictEqual(res.isValid, true);
      assert.strictEqual(res.handle, "valid_user");
    });

    it("rejects untrusted domains", () => {
      const res = parseAndValidateSocialInput("instagram", "https://fake-instagram.xyz/valid_user");
      assert.strictEqual(res.isValid, false);
    });
  });

  describe("LinkedIn validation", () => {
    it("handles clean handle or in/handle format", () => {
      const res1 = parseAndValidateSocialInput("linkedin", "john-doe-123");
      assert.strictEqual(res1.isValid, true);
      assert.strictEqual(res1.handle, "john-doe-123");
      assert.strictEqual(res1.url, "https://linkedin.com/in/john-doe-123");

      const res2 = parseAndValidateSocialInput("linkedin", "in/john-doe-123");
      assert.strictEqual(res2.isValid, true);
      assert.strictEqual(res2.handle, "john-doe-123");
    });

    it("parses full linkedin.com/in/ URL", () => {
      const res = parseAndValidateSocialInput("linkedin", "https://www.linkedin.com/in/johndoe");
      assert.strictEqual(res.isValid, true);
      assert.strictEqual(res.handle, "johndoe");
      assert.strictEqual(res.url, "https://linkedin.com/in/johndoe");
    });

    it("rejects untrusted domains", () => {
      const res = parseAndValidateSocialInput("linkedin", "https://fake-linkedin.com/in/johndoe");
      assert.strictEqual(res.isValid, false);
    });
  });

  describe("GitHub validation", () => {
    it("validates valid GitHub username", () => {
      const res = parseAndValidateSocialInput("github", "octocat");
      assert.strictEqual(res.isValid, true);
      assert.strictEqual(res.handle, "octocat");
      assert.strictEqual(res.url, "https://github.com/octocat");
      assert.strictEqual(res.isVerified, true);
    });

    it("parses full github.com URL", () => {
      const res = parseAndValidateSocialInput("github", "https://github.com/torvalds");
      assert.strictEqual(res.isValid, true);
      assert.strictEqual(res.handle, "torvalds");
      assert.strictEqual(res.url, "https://github.com/torvalds");
    });

    it("rejects usernames beginning or ending with hyphens", () => {
      assert.strictEqual(parseAndValidateSocialInput("github", "-baduser").isValid, false);
      assert.strictEqual(parseAndValidateSocialInput("github", "baduser-").isValid, false);
    });

    it("rejects untrusted domains", () => {
      const res = parseAndValidateSocialInput("github", "https://malicious-github.com/octocat");
      assert.strictEqual(res.isValid, false);
    });
  });

  describe("Formatting helpers", () => {
    it("getStandardizedSocialDisplay formats appropriately", () => {
      assert.strictEqual(getStandardizedSocialDisplay("twitter", "https://x.com/alice"), "@alice");
      assert.strictEqual(getStandardizedSocialDisplay("instagram", "alice"), "@alice");
      assert.strictEqual(getStandardizedSocialDisplay("linkedin", "alice-123"), "in/alice-123");
      assert.strictEqual(getStandardizedSocialDisplay("github", "alice"), "@alice");
    });

    it("getStandardizedSocialUrl returns canonical URLs", () => {
      assert.strictEqual(getStandardizedSocialUrl("twitter", "@alice"), "https://x.com/alice");
      assert.strictEqual(getStandardizedSocialUrl("github", "@alice"), "https://github.com/alice");
    });

    it("empty input produces valid empty result (for clearing profile fields)", () => {
      const res = parseAndValidateSocialInput("twitter", "   ");
      assert.strictEqual(res.isValid, true);
      assert.strictEqual(res.handle, "");
      assert.strictEqual(res.isVerified, false);
    });
  });
});

package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
)

type FactCheckVerdict string

const (
	VerdictTrue          FactCheckVerdict = "TRUE"
	VerdictPartiallyTrue FactCheckVerdict = "PARTIALLY_TRUE"
	VerdictMisleading    FactCheckVerdict = "MISLEADING"
	VerdictFalse         FactCheckVerdict = "FALSE"
	VerdictUnverified    FactCheckVerdict = "UNVERIFIED"
)

type VerifiedClaim struct {
	Claim           string           `json:"claim"`
	Verdict         FactCheckVerdict `json:"verdict"`
	Confidence      float64          `json:"confidence"`
	Explanation     string           `json:"explanation"`
	SourceReference string           `json:"source_reference"`
}

type FactCheckReport struct {
	Topic            string          `json:"topic"`
	OriginalText     string          `json:"original_text"`
	Claims           []VerifiedClaim `json:"claims"`
	TotalClaims      int             `json:"total_claims"`
	TrueClaimsCount  int             `json:"true_claims_count"`
	FalseClaimsCount int             `json:"false_claims_count"`
	CredibilityScore int             `json:"credibility_score"`
	FactDensity      string          `json:"fact_density"`
	Summary          string          `json:"summary"`
	CheckedAt        time.Time       `json:"checked_at"`
}

func CheckDebateFacts(ctx context.Context, topic, statement, contextInfo string) (*FactCheckReport, error) {
	if strings.TrimSpace(statement) == "" {
		return nil, errors.New("statement cannot be empty")
	}

	prompt := fmt.Sprintf(`You are an impartial, highly rigorous debate fact-checker.
Analyze the following debate statement on the topic: "%s".
Context: "%s"

Statement to fact-check:
"%s"

Extract all factual claims, verifiable statistics, historical assertions, or scientific statements made in the speech.
Do NOT fact-check pure subjective opinions. Only extract objective empirical or verifiable claims.

Return a STRICT JSON object in this exact schema without any markdown formatting or commentary outside JSON:
{
  "claims": [
    {
      "claim": "concise summary of the factual claim",
      "verdict": "TRUE" | "PARTIALLY_TRUE" | "MISLEADING" | "FALSE" | "UNVERIFIED",
      "confidence": 0.95,
      "explanation": "concise factual explanation based on established consensus",
      "source_reference": "credible source, scientific consensus, or statistical authority"
    }
  ],
  "credibility_score": 85,
  "fact_density": "high" | "medium" | "low",
  "summary": "1-2 sentence overall assessment of the statement's factual accuracy"
}`, topic, contextInfo, statement)

	rawResponse, err := generateDefaultModelText(ctx, prompt)
	if err != nil {
		return nil, fmt.Errorf("failed to generate fact check report: %w", err)
	}

	cleaned := cleanModelOutput(rawResponse)
	var parsed struct {
		Claims           []VerifiedClaim `json:"claims"`
		CredibilityScore int             `json:"credibility_score"`
		FactDensity      string          `json:"fact_density"`
		Summary          string          `json:"summary"`
	}

	if err := json.Unmarshal([]byte(cleaned), &parsed); err != nil {
		return nil, fmt.Errorf("failed to parse fact check JSON output: %w", err)
	}

	report := &FactCheckReport{
		Topic:            topic,
		OriginalText:     statement,
		Claims:           parsed.Claims,
		TotalClaims:      len(parsed.Claims),
		CredibilityScore: parsed.CredibilityScore,
		FactDensity:      parsed.FactDensity,
		Summary:          parsed.Summary,
		CheckedAt:        time.Now().UTC(),
	}

	if report.CredibilityScore < 0 {
		report.CredibilityScore = 0
	} else if report.CredibilityScore > 100 {
		report.CredibilityScore = 100
	}

	for _, c := range report.Claims {
		switch c.Verdict {
		case VerdictTrue:
			report.TrueClaimsCount++
		case VerdictFalse, VerdictMisleading:
			report.FalseClaimsCount++
		}
	}

	return report, nil
}

package services

import (
	"arguehub/models"
	"context"
	"fmt"
	"log"
	"strings"
	"time"
)

// AnalyzeDebateTranscript sends the full debate transcript to Gemini and requests
// a structured JSON response containing fallacy detection, 4-pillar scoring,
// argument matrix analysis, and personalized coaching tips.
func AnalyzeDebateTranscript(history []models.Message, topic, userStance, botName string) (string, error) {
	if geminiClient == nil {
		return "", fmt.Errorf("gemini client not initialized")
	}

	transcript := FormatHistory(history)

	// Build opponent stance (opposite of user's stance)
	botStance := "Against"
	if strings.EqualFold(userStance, "Against") {
		botStance = "For"
	}

	prompt := fmt.Sprintf(`You are an expert debate analyst and logical reasoning specialist. Analyze the following debate transcript between a User (stance: %s) and %s (stance: %s) on the topic: "%s".

Provide a comprehensive analysis in STRICT JSON format. Your response must be ONLY valid JSON with no other text.

Debate Transcript:
%s

Required JSON Output Format:
{
  "fallacies": [
    {
      "type": "string (e.g., Ad Hominem, Straw Man, False Dilemma, Slippery Slope, Appeal to Emotion, Red Herring, Circular Reasoning, Hasty Generalization, Appeal to Authority, Tu Quoque)",
      "sender": "string (User or Bot)",
      "quote": "string (exact quote from the transcript where the fallacy occurs)",
      "explanation": "string (brief explanation of why this is a fallacy)",
      "severity": "string (low, medium, high)",
      "phase": "string (which debate phase this occurred in)"
    }
  ],
  "pillar_scores": {
    "user": {
      "argument_strength": {
        "score": "number (0-100)",
        "feedback": "string (specific feedback on argument coherence and logical flow)"
      },
      "rebuttal_effectiveness": {
        "score": "number (0-100)",
        "feedback": "string (how well they addressed opponent's main points)"
      },
      "evidence_support": {
        "score": "number (0-100)",
        "feedback": "string (quality of factual support and references)"
      },
      "rhetorical_style": {
        "score": "number (0-100)",
        "feedback": "string (persuasiveness, language proficiency, articulation)"
      }
    },
    "bot": {
      "argument_strength": {
        "score": "number (0-100)",
        "feedback": "string"
      },
      "rebuttal_effectiveness": {
        "score": "number (0-100)",
        "feedback": "string"
      },
      "evidence_support": {
        "score": "number (0-100)",
        "feedback": "string"
      },
      "rhetorical_style": {
        "score": "number (0-100)",
        "feedback": "string"
      }
    }
  },
  "argument_matrix": {
    "user_strongest_points": [
      {
        "point": "string (summary of the strong argument)",
        "impact": "string (high, medium, low)",
        "phase": "string (which phase it was made in)"
      }
    ],
    "bot_strongest_points": [
      {
        "point": "string",
        "impact": "string",
        "phase": "string"
      }
    ],
    "user_unanswered_arguments": [
      {
        "argument": "string (a counter-argument the user failed to address)",
        "made_by": "Bot",
        "suggestion": "string (how the user could have responded)"
      }
    ],
    "bot_unanswered_arguments": [
      {
        "argument": "string (a counter-argument the bot failed to address)",
        "made_by": "User",
        "suggestion": "string"
      }
    ],
    "decisive_argument": {
      "summary": "string (the single argument that most influenced the outcome)",
      "made_by": "string (User or Bot)",
      "why_decisive": "string (explanation of why this argument was pivotal)"
    }
  },
  "coaching_tips": [
    {
      "category": "string (e.g., Logic, Evidence, Delivery, Strategy, Rebuttal)",
      "title": "string (short actionable title)",
      "tip": "string (specific, personalized improvement advice based on the debate)",
      "priority": "string (high, medium, low)",
      "example": "string (example of how the user could improve, referencing their actual debate)"
    }
  ],
  "overall_summary": {
    "debate_quality": "string (excellent, good, average, poor)",
    "key_takeaway": "string (one-sentence summary of the debate outcome)",
    "user_overall_score": "number (0-100, weighted average of all pillars)",
    "bot_overall_score": "number (0-100)",
    "improvement_potential": "string (brief description of the user's biggest area for growth)"
  }
}

IMPORTANT RULES:
1. Return ONLY valid JSON, no markdown, no code fences, no additional text.
2. Be specific - always reference actual quotes and moments from the transcript.
3. Identify ALL logical fallacies, even subtle ones. If none exist, return an empty array.
4. Coaching tips should be personalized and actionable, not generic advice.
5. Scores should be fair and evidence-based, not inflated.
6. The argument matrix should capture the debate's strategic dynamics accurately.
7. Limit fallacies to the most significant ones (max 8).
8. Provide exactly 3-5 coaching tips, prioritized by impact.`,
		userStance, botName, botStance, topic, transcript)

	// Use a 60-second timeout to prevent Gemini calls from hanging indefinitely
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	text, err := generateDefaultModelText(ctx, prompt)
	if err != nil {
		log.Printf("Gemini error in AnalyzeDebateTranscript: %v", err)
		return "", fmt.Errorf("failed to analyze debate: %w", err)
	}

	if text == "" {
		return "", fmt.Errorf("empty response from Gemini")
	}

	return text, nil
}
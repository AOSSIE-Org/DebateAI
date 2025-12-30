package services

import (
    "context"
    "encoding/json"
    "errors"
    "fmt"
    "io"
    "math"
    "strings"
    "time"

    "log"
)

// SideScores represents scores for one criterion for both sides
type SideScores struct {
    SideA int `json:"sideA"`
    SideB int `json:"sideB"`
}

// Scores holds per-criterion scores
type Scores struct {
    Logic      SideScores `json:"logic"`
    Evidence   SideScores `json:"evidence"`
    Persuasion SideScores `json:"persuasion"`
    Rebuttal   SideScores `json:"rebuttal"`
}

// JudgementResult is the structured result returned by JudgeDebate
type JudgementResult struct {
    Winner  string `json:"winner"`
    Scores  Scores `json:"scores"`
    Summary string `json:"summary"`
}

// JudgeDebateAI evaluates a debate transcript using Gemini and returns a strict JSON result.
func JudgeDebateAI(ctx context.Context, transcript string) (*JudgementResult, error) {
    // Use a child context with timeout to avoid hanging on Gemini calls.
    // The timeout balances between giving the model time to respond and failing fast.
    ctx, cancel := context.WithTimeout(ctx, 60*time.Second)
    defer cancel()

    // Build a strict prompt instructing Gemini to return only valid JSON.
    prompt := strings.Join([]string{
        "You are an impartial debate judge.\n",
        "Evaluate the following debate transcript and output ONLY valid JSON matching the schema exactly (no explanation, no markdown, no commentary):\n",
        `{"winner": string, "scores": {"logic": {"sideA": number, "sideB": number}, "evidence": {"sideA": number, "sideB": number}, "persuasion": {"sideA": number, "sideB": number}, "rebuttal": {"sideA": number, "sideB": number}}, "summary": string}` + "\n",
        "Rules:\n",
        "- Choose winner as either \"Side A\" or \"Side B\".\n",
        "- All scores must be integers between 1 and 10 (inclusive).\n",
        "- Summary must be a concise impartial explanation of the decision (1-3 sentences).\n",
        "- Return exactly one top-level JSON object with no extra fields.\n",
        "- If a numeric value is not an integer, round or convert it to an integer within 1-10.\n",
        "Transcript:\n",
        transcript,
    }, "")

    // Ask Gemini for a response
    respText, err := generateDefaultModelText(ctx, prompt)
    if err != nil {
        // Log the error and return a wrapped error so callers can decide whether to retry.
        log.Printf("error: gemini generate error: %v", err)
        return nil, fmt.Errorf("gemini generate error: %w", err)
    }

    // Strict JSON parsing
    // First attempt: strict decode into expected types (ints).
    var result JudgementResult
    dec := json.NewDecoder(strings.NewReader(respText))
    dec.DisallowUnknownFields()
    if err := dec.Decode(&result); err == nil {
        // ensure no trailing tokens
        if err := dec.Decode(&struct{}{}); err != io.EOF {
            return nil, fmt.Errorf("extra data after JSON or invalid JSON structure; raw: %s", respText)
        }

        // Validate winner and ranges
        if result.Winner != "Side A" && result.Winner != "Side B" {
            return nil, fmt.Errorf("invalid winner value: %q", result.Winner)
        }
        validate := func(s SideScores, name string) error {
            if s.SideA < 1 || s.SideA > 10 {
                return fmt.Errorf("%s.sideA out of range: %d", name, s.SideA)
            }
            if s.SideB < 1 || s.SideB > 10 {
                return fmt.Errorf("%s.sideB out of range: %d", name, s.SideB)
            }
            return nil
        }
        if err := validate(result.Scores.Logic, "logic"); err != nil {
            return nil, err
        }
        if err := validate(result.Scores.Evidence, "evidence"); err != nil {
            return nil, err
        }
        if err := validate(result.Scores.Persuasion, "persuasion"); err != nil {
            return nil, err
        }
        if err := validate(result.Scores.Rebuttal, "rebuttal"); err != nil {
            return nil, err
        }
        return &result, nil
    }

    // If strict decoding failed, attempt a forgiving parse that accepts numbers as floats
    // and coerces them to ints (rounding and clamping to 1..10).
    var raw map[string]any
    if err := json.Unmarshal([]byte(respText), &raw); err != nil {
        return nil, fmt.Errorf("failed to parse Gemini JSON output strictly and leniently: %w; raw: %s", err, respText)
    }

    // Extract winner
    winnerVal, ok := raw["winner"].(string)
    if !ok || (winnerVal != "Side A" && winnerVal != "Side B") {
        return nil, fmt.Errorf("invalid or missing winner in AI response: %v", raw["winner"])
    }

    // Helper to coerce a numeric value to int in 1..10
    toInt := func(v any) (int, error) {
        switch n := v.(type) {
        case float64:
            i := int(math.Round(n))
            if i < 1 {
                i = 1
            }
            if i > 10 {
                i = 10
            }
            return i, nil
        case int:
            if n < 1 {
                n = 1
            }
            if n > 10 {
                n = 10
            }
            return n, nil
        case string:
            // try to parse string numbers
            var f float64
            if err := json.Unmarshal([]byte(fmt.Sprintf("%q", n)), &f); err == nil {
                i := int(math.Round(f))
                if i < 1 {
                    i = 1
                }
                if i > 10 {
                    i = 10
                }
                return i, nil
            }
        }
        return 0, errors.New("unable to coerce numeric score")
    }

    scoresAny, ok := raw["scores"].(map[string]any)
    if !ok {
        return nil, fmt.Errorf("missing or invalid scores object in AI response")
    }

    extractSide := func(obj any) (SideScores, error) {
        m, ok := obj.(map[string]any)
        if !ok {
            return SideScores{}, errors.New("invalid side scores object")
        }
        a, err := toInt(m["sideA"])
        if err != nil {
            return SideScores{}, err
        }
        b, err := toInt(m["sideB"])
        if err != nil {
            return SideScores{}, err
        }
        return SideScores{SideA: a, SideB: b}, nil
    }

    var final JudgementResult
    final.Winner = winnerVal
    // Parse each criterion, returning error if any missing
    if v, ok := scoresAny["logic"]; ok {
        if s, err := extractSide(v); err == nil {
            final.Scores.Logic = s
        } else {
            return nil, fmt.Errorf("invalid logic scores: %w", err)
        }
    } else {
        return nil, fmt.Errorf("missing logic scores in AI response")
    }
    if v, ok := scoresAny["evidence"]; ok {
        if s, err := extractSide(v); err == nil {
            final.Scores.Evidence = s
        } else {
            return nil, fmt.Errorf("invalid evidence scores: %w", err)
        }
    } else {
        return nil, fmt.Errorf("missing evidence scores in AI response")
    }
    if v, ok := scoresAny["persuasion"]; ok {
        if s, err := extractSide(v); err == nil {
            final.Scores.Persuasion = s
        } else {
            return nil, fmt.Errorf("invalid persuasion scores: %w", err)
        }
    } else {
        return nil, fmt.Errorf("missing persuasion scores in AI response")
    }
    if v, ok := scoresAny["rebuttal"]; ok {
        if s, err := extractSide(v); err == nil {
            final.Scores.Rebuttal = s
        } else {
            return nil, fmt.Errorf("invalid rebuttal scores: %w", err)
        }
    } else {
        return nil, fmt.Errorf("missing rebuttal scores in AI response")
    }

    // Summary
    if s, ok := raw["summary"].(string); ok {
        final.Summary = s
    } else {
        final.Summary = ""
    }

    return &final, nil
}

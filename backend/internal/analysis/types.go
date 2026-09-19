package analysis

// FallacySignal represents a detected reasoning issue in a debate.
type FallacySignal struct {
	Type        string // e.g., "Ad Hominem", "False Dilemma"
	Phase       string // opening, cross-exam, closing
	Explanation string // why this weakens the argument
}

// AnalysisResult stores the output of post-debate reasoning analysis.
type AnalysisResult struct {
	DebateID string
	Signals  []FallacySignal
}

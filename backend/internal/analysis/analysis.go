package analysis

// PostDebateAnalyzer defines the contract for future reasoning analysis modules.
// It is intentionally minimal and does not alter any existing debate flow.
type PostDebateAnalyzer interface {
	Analyze(transcript interface{}) (*AnalysisResult, error)
}

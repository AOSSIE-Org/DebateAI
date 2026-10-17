# Proposed Fix for Issue #660

### Root Cause & Approach
The fallback logic when parsing the judgment JSON uses loose substring checks (`strings.Contains(resultLower, "for")` / `against`), which leads to false positives and incorrect win/loss assignments due to common words containing these substrings. We can fix this by replacing the unstructured string matching with structured word-boundary checks or explicitly defaulting to a draw (`draw`) when JSON parsing fails instead of relying on ambiguous text search.

### Proposed Code Fix
Update lines 157–169 in `backend/services/transcriptservice.go` to avoid generic substring collisions (or default safely to a draw):

```go
				} else {
					// Fallback to strict word matching or default to draw if JSON parsing fails
					resultLower := strings.ToLower(result)
					// Use word boundaries or check explicitly for structured verdict fragments
					hasFor := strings.Contains(resultLower, `"winner": "for"`) || strings.Contains(resultLower, `'winner': 'for'`)
					hasAgainst := strings.Contains(resultLower, `"winner": "against"`) || strings.Contains(resultLower, `'winner': 'against'`)

					if hasFor && !hasAgainst {
						resultFor = "win"
						resultAgainst = "loss"
					} else if hasAgainst && !hasFor {
						resultFor = "loss"
						resultAgainst = "win"
					} else {
						resultFor = "draw"
						resultAgainst = "draw"
					}
				}
```

### Verification
1. Run unit/integration tests that submit transcripts resulting in malformed or non-JSON judge responses containing common words like "therefore" or "again".
2. Verify that win/loss results are no longer incorrectly triggered by substring matches and safely fall back to a `draw` or require exact marker matches.

---
*Formulated by @SarthakSoni31 via CodeSphere AI*
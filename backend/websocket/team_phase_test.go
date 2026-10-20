package websocket

import "testing"

func TestTeamDebatePhaseProgression(t *testing.T) {
	phases := []struct {
		current string
		next    string
		role    string
	}{
		{"openingFor", "openingAgainst", "for"},
		{"openingAgainst", "crossForQuestion", "against"},
		{"crossForQuestion", "crossAgainstAnswer", "for"},
		{"crossAgainstAnswer", "crossAgainstQuestion", "against"},
		{"crossAgainstQuestion", "crossForAnswer", "against"},
		{"crossForAnswer", "closingFor", "for"},
		{"closingFor", "closingAgainst", "for"},
		{"closingAgainst", "finished", "against"},
	}

	for _, test := range phases {
		t.Run(test.current, func(t *testing.T) {
			next, ok := nextTeamDebatePhase(test.current)
			if !ok || next != test.next {
				t.Fatalf("nextTeamDebatePhase(%q) = (%q, %v), want (%q, true)", test.current, next, ok, test.next)
			}
			if role := teamDebatePhaseRole(test.current); role != test.role {
				t.Fatalf("teamDebatePhaseRole(%q) = %q, want %q", test.current, role, test.role)
			}
		})
	}
}

func TestTeamDebatePhaseProgressionRejectsUnknownAndTerminalPhases(t *testing.T) {
	for _, phase := range []string{"setup", "countdown", "finished", "unexpected"} {
		t.Run(phase, func(t *testing.T) {
			next, ok := nextTeamDebatePhase(phase)
			if ok || next != "" {
				t.Fatalf("nextTeamDebatePhase(%q) = (%q, %v), want empty phase and false", phase, next, ok)
			}
			if role := teamDebatePhaseRole(phase); role != "" {
				t.Fatalf("teamDebatePhaseRole(%q) = %q, want empty role", phase, role)
			}
		})
	}
}

func TestTeamCanAdvanceOnlyOnItsSpeakingPhase(t *testing.T) {
	tests := []struct {
		phase string
		role  string
		want  bool
	}{
		{"openingFor", "for", true},
		{"openingFor", "FOR", true},
		{"openingFor", "against", false},
		{"crossAgainstAnswer", "against", true},
		{"crossAgainstAnswer", "for", false},
		{"finished", "for", false},
	}

	for _, test := range tests {
		t.Run(test.phase+"_"+test.role, func(t *testing.T) {
			if got := teamCanAdvanceDebatePhase(test.phase, test.role); got != test.want {
				t.Fatalf("teamCanAdvanceDebatePhase(%q, %q) = %v, want %v", test.phase, test.role, got, test.want)
			}
		})
	}
}

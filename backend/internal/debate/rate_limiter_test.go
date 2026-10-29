package debate

import (
	"sync"
	"sync/atomic"
	"testing"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"
)

func newTestLimiter(t *testing.T) (*RateLimiter, *miniredis.Miniredis) {
	t.Helper()
	mr := miniredis.RunT(t)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	t.Cleanup(func() { _ = rdb.Close() })
	return NewRateLimiterWithClient(rdb), mr
}

func TestAllowReactionStopsAtLimitUnderConcurrency(t *testing.T) {
	rl, _ := newTestLimiter(t)
	config := DefaultRateLimitConfig()

	var allowed int64
	var wg sync.WaitGroup
	for i := 0; i < 50; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			ok, err := rl.AllowReaction("debate-1", "spectator-1", config)
			if err != nil {
				t.Errorf("AllowReaction: %v", err)
				return
			}
			if ok {
				atomic.AddInt64(&allowed, 1)
			}
		}()
	}
	wg.Wait()

	if allowed != int64(config.MaxReactions) {
		t.Fatalf("allowed %d reactions, want %d", allowed, config.MaxReactions)
	}
}

func TestAllowQuestionResetsAfterWindow(t *testing.T) {
	rl, mr := newTestLimiter(t)
	config := DefaultRateLimitConfig()

	if ok, err := rl.AllowQuestion("debate-1", "spectator-1", config); err != nil || !ok {
		t.Fatalf("first question: ok=%v err=%v", ok, err)
	}
	if ok, err := rl.AllowQuestion("debate-1", "spectator-1", config); err != nil || ok {
		t.Fatalf("second question in the same window: ok=%v err=%v", ok, err)
	}

	mr.FastForward(config.QuestionWindow)

	if ok, err := rl.AllowQuestion("debate-1", "spectator-1", config); err != nil || !ok {
		t.Fatalf("question after the window: ok=%v err=%v", ok, err)
	}
}

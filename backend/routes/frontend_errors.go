package routes

import (
    "log"
    "net/http"

    "github.com/gin-gonic/gin"
)

// FrontendErrorPayload is the expected shape from the browser.
type FrontendErrorPayload struct {
    Message        string `json:"message" binding:"required"`
    Stack          string `json:"stack"`
    ComponentStack string `json:"componentStack"`
    URL            string `json:"url"`
    UserAgent      string `json:"userAgent"`
    TS             string `json:"ts"`
}

// HandleFrontendError accepts lightweight frontend error reports. This endpoint is intentionally
// simple and best-effort: it logs the payload and returns 204. Implementers may extend this
// to persist to a DB or forward to an error-tracking system.
func HandleFrontendError(c *gin.Context) {
    var payload FrontendErrorPayload
    if err := c.ShouldBindJSON(&payload); err != nil {
        // If the body isn't JSON or missing fields, accept it silently and return 204 to
        // avoid breaking sendBeacon/fetch flows.
        log.Printf("frontend error: invalid payload: %v", err)
        c.Status(http.StatusNoContent)
        return
    }

    // Log to server logs. This keeps the endpoint low-friction; for production, forward
    // to your observability stack (Sentry/Datadog/ELK) or persist to a DB.
    log.Printf("[FRONTEND ERROR] ts=%s url=%s ua=%s message=%s stack=%s componentStack=%s",
        payload.TS, payload.URL, payload.UserAgent, payload.Message, payload.Stack, payload.ComponentStack)

    c.Status(http.StatusNoContent)
}

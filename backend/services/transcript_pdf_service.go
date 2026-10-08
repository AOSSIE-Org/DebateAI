package services

import (
	"bytes"
	"fmt"
	"sort"
	"strings"
	"time"

	"arguehub/models"

	"github.com/jung-kurt/gofpdf"
)

// GenerateTranscriptPDF renders a SavedDebateTranscript into a formatted PDF
// and returns the raw PDF bytes. No temp files are created.
func GenerateTranscriptPDF(transcript *models.SavedDebateTranscript) ([]byte, error) {
	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.SetAutoPageBreak(true, 20)
	pdf.SetMargins(15, 15, 15)

	pdf.AddPage()

	// ── Header ──────────────────────────────────────────────────────────
	renderHeader(pdf, transcript)

	// ── Metadata ────────────────────────────────────────────────────────
	renderMetadata(pdf, transcript)

	// ── Messages (conversation) ─────────────────────────────────────────
	if len(transcript.Messages) > 0 {
		renderMessages(pdf, transcript.Messages)
	}

	// ── Phase Transcripts (user-vs-user) ────────────────────────────────
	if len(transcript.Transcripts) > 0 {
		renderPhaseTranscripts(pdf, transcript.Transcripts)
	}

	// ── Footer with generation timestamp ────────────────────────────────
	renderFooter(pdf)

	// Serialize to bytes
	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		return nil, fmt.Errorf("failed to generate PDF: %w", err)
	}
	if pdf.Err() {
		return nil, fmt.Errorf("PDF generation error: %v", pdf.Error())
	}

	return buf.Bytes(), nil
}

// ─── Rendering helpers ──────────────────────────────────────────────────────

func renderHeader(pdf *gofpdf.Fpdf, t *models.SavedDebateTranscript) {
	// Title bar background
	pdf.SetFillColor(30, 41, 59) // slate-800
	pdf.Rect(0, 0, 210, 35, "F")

	// Title text
	pdf.SetFont("Helvetica", "B", 20)
	pdf.SetTextColor(255, 255, 255)
	pdf.SetXY(15, 8)
	pdf.CellFormat(0, 10, "ArgueHub", "", 0, "L", false, 0, "")

	// Subtitle
	pdf.SetFont("Helvetica", "", 10)
	pdf.SetTextColor(203, 213, 225) // slate-300
	pdf.SetXY(15, 19)
	pdf.CellFormat(0, 8, "Debate Transcript Report", "", 0, "L", false, 0, "")

	pdf.Ln(25)
}

func renderMetadata(pdf *gofpdf.Fpdf, t *models.SavedDebateTranscript) {
	pdf.SetY(42)

	// Metadata box
	pdf.SetFillColor(248, 250, 252) // slate-50
	pdf.SetDrawColor(226, 232, 240) // slate-200
	startY := pdf.GetY()
	pdf.Rect(15, startY, 180, 42, "FD")

	pdf.SetFont("Helvetica", "B", 11)
	pdf.SetTextColor(30, 41, 59) // slate-800
	pdf.SetXY(20, startY+3)
	pdf.CellFormat(0, 7, "Debate Details", "", 1, "L", false, 0, "")

	pdf.SetFont("Helvetica", "", 9)
	pdf.SetTextColor(71, 85, 105) // slate-600

	// Row 1: Topic and Type
	pdf.SetXY(20, startY+12)
	pdf.SetFont("Helvetica", "B", 9)
	pdf.CellFormat(20, 6, "Topic:", "", 0, "L", false, 0, "")
	pdf.SetFont("Helvetica", "", 9)
	topic := truncateText(sanitizeText(t.Topic), 60)
	pdf.CellFormat(70, 6, topic, "", 0, "L", false, 0, "")

	pdf.SetFont("Helvetica", "B", 9)
	pdf.CellFormat(15, 6, "Type:", "", 0, "L", false, 0, "")
	pdf.SetFont("Helvetica", "", 9)
	debateType := sanitizeText(formatDebateType(t.DebateType))
	pdf.CellFormat(0, 6, debateType, "", 1, "L", false, 0, "")

	// Row 2: Opponent and Result
	pdf.SetX(20)
	pdf.SetFont("Helvetica", "B", 9)
	pdf.CellFormat(20, 6, "vs:", "", 0, "L", false, 0, "")
	pdf.SetFont("Helvetica", "", 9)
	opponent := truncateText(sanitizeText(t.Opponent), 60)
	pdf.CellFormat(70, 6, opponent, "", 0, "L", false, 0, "")

	pdf.SetFont("Helvetica", "B", 9)
	pdf.CellFormat(15, 6, "Result:", "", 0, "L", false, 0, "")
	pdf.SetFont("Helvetica", "", 9)
	pdf.CellFormat(0, 6, sanitizeText(strings.ToUpper(t.Result)), "", 1, "L", false, 0, "")

	// Row 3: Date
	pdf.SetX(20)
	pdf.SetFont("Helvetica", "B", 9)
	pdf.CellFormat(20, 6, "Date:", "", 0, "L", false, 0, "")
	pdf.SetFont("Helvetica", "", 9)
	pdf.CellFormat(0, 6, t.CreatedAt.Format("January 2, 2006 at 3:04 PM"), "", 1, "L", false, 0, "")

	pdf.Ln(8)
}

func renderMessages(pdf *gofpdf.Fpdf, messages []models.Message) {
	// Section heading
	pdf.SetFont("Helvetica", "B", 13)
	pdf.SetTextColor(30, 41, 59)
	pdf.CellFormat(0, 10, "Conversation", "", 1, "L", false, 0, "")
	pdf.SetDrawColor(30, 41, 59)
	pdf.Line(15, pdf.GetY(), 195, pdf.GetY())
	pdf.Ln(4)

	currentPhase := ""

	for _, msg := range messages {
		// Phase sub-header
		if msg.Phase != "" && msg.Phase != currentPhase {
			currentPhase = msg.Phase
			pdf.Ln(2)
			pdf.SetFont("Helvetica", "BI", 10)
			pdf.SetTextColor(100, 116, 139) // slate-500
			phaseName := formatPhaseName(msg.Phase)
			pdf.CellFormat(0, 7, phaseName, "", 1, "L", false, 0, "")
			pdf.Ln(1)
		}

		renderMessageBubble(pdf, msg)
	}

	pdf.Ln(6)
}

func renderMessageBubble(pdf *gofpdf.Fpdf, msg models.Message) {
	// Pick colors based on sender
	var bgR, bgG, bgB int
	var labelR, labelG, labelB int
	senderLabel := msg.Sender

	switch msg.Sender {
	case "User":
		bgR, bgG, bgB = 239, 246, 255       // blue-50
		labelR, labelG, labelB = 29, 78, 216 // blue-700
	case "Bot":
		bgR, bgG, bgB = 240, 253, 244         // green-50
		labelR, labelG, labelB = 21, 128, 61  // green-700
	case "Judge":
		bgR, bgG, bgB = 254, 249, 195          // yellow-100
		labelR, labelG, labelB = 161, 98, 7    // yellow-700
	default:
		bgR, bgG, bgB = 241, 245, 249          // slate-100
		labelR, labelG, labelB = 71, 85, 105   // slate-600
	}

	_ = pdf.GetX()

	// Pre-calculate text dimensions for page-break check
	text := sanitizeText(msg.Text)
	lineHt := 4.5
	lines := pdf.SplitText(text, 170)
	textHeight := float64(len(lines))*lineHt + 6
	// Total height includes sender label (5mm) + text bubble + spacing
	totalHeight := 5 + textHeight + 3

	// Check if we need a new page (accounting for full content height)
	if pdf.GetY()+totalHeight > 280 {
		pdf.AddPage()
	}

	// Sender label
	pdf.SetFont("Helvetica", "B", 9)
	pdf.SetTextColor(labelR, labelG, labelB)
	pdf.CellFormat(0, 5, senderLabel, "", 1, "L", false, 0, "")

	// Message text with background
	pdf.SetFont("Helvetica", "", 9)
	pdf.SetTextColor(51, 65, 85) // slate-700

	// Draw background rectangle
	pdf.SetFillColor(bgR, bgG, bgB)
	pdf.Rect(15, pdf.GetY(), 180, textHeight, "F")

	// Write the text inside the box
	pdf.SetX(18)
	pdf.MultiCell(174, lineHt, text, "", "L", false)
	pdf.Ln(3)
}

func renderPhaseTranscripts(pdf *gofpdf.Fpdf, transcripts map[string]string) {
	// Section heading
	pdf.SetFont("Helvetica", "B", 13)
	pdf.SetTextColor(30, 41, 59)
	pdf.CellFormat(0, 10, "Phase Transcripts", "", 1, "L", false, 0, "")
	pdf.SetDrawColor(30, 41, 59)
	pdf.Line(15, pdf.GetY(), 195, pdf.GetY())
	pdf.Ln(4)

	// Sort phases for consistent ordering
	phases := sortPhases(transcripts)

	for _, phase := range phases {
		text := transcripts[phase]
		if strings.TrimSpace(text) == "" {
			continue
		}

		// Pre-calculate text height to check page space properly
		sanitized := sanitizeText(text)
		preLines := pdf.SplitText(sanitized, 170)
		preHeight := float64(len(preLines))*4.5 + 6 + 7 + 4 // text + padding + header + spacing
		if pdf.GetY()+preHeight > 280 {
			pdf.AddPage()
		}

		// Phase name
		phaseName := formatPhaseName(phase)
		pdf.SetFont("Helvetica", "B", 10)
		pdf.SetTextColor(71, 85, 105)
		pdf.CellFormat(0, 7, phaseName, "", 1, "L", false, 0, "")

		// Phase content with light background
		pdf.SetFillColor(248, 250, 252) // slate-50
		pdf.SetFont("Helvetica", "", 9)
		pdf.SetTextColor(51, 65, 85)

		lineHt := 4.5
		lines := pdf.SplitText(sanitized, 170)
		textHeight := float64(len(lines))*lineHt + 6

		pdf.Rect(15, pdf.GetY(), 180, textHeight, "F")
		pdf.SetX(18)
		pdf.MultiCell(174, lineHt, sanitized, "", "L", false)
		pdf.Ln(4)
	}
}

func renderFooter(pdf *gofpdf.Fpdf) {
	pdf.SetFont("Helvetica", "I", 8)
	pdf.SetTextColor(148, 163, 184) // slate-400
	timestamp := time.Now().Format("Generated on January 2, 2006 at 3:04 PM")
	pdf.SetY(-15)
	pdf.CellFormat(0, 10, timestamp+" | ArgueHub Platform", "", 0, "C", false, 0, "")
}

// ─── Utility helpers ────────────────────────────────────────────────────────

func formatDebateType(dt string) string {
	switch dt {
	case "user_vs_bot":
		return "User vs Bot"
	case "user_vs_user":
		return "User vs User"
	default:
		return dt
	}
}

func formatPhaseName(phase string) string {
	// Convert camelCase like "openingFor" → "Opening For"
	var result strings.Builder
	for i, r := range phase {
		if i > 0 && r >= 'A' && r <= 'Z' {
			result.WriteRune(' ')
		}
		if i == 0 {
			result.WriteRune(rune(strings.ToUpper(string(r))[0]))
		} else {
			result.WriteRune(r)
		}
	}
	return result.String()
}

func truncateText(text string, maxLen int) string {
	runes := []rune(text)
	if len(runes) <= maxLen {
		return text
	}
	if maxLen <= 3 {
		return string(runes[:maxLen])
	}
	return string(runes[:maxLen-3]) + "..."
}

func sanitizeText(text string) string {
	// Normalize line endings
	text = strings.ReplaceAll(text, "\r\n", "\n")
	text = strings.ReplaceAll(text, "\r", "\n")

	// gofpdf uses Windows-1252 encoding by default.
	// Map common Unicode characters to their Windows-1252 equivalents,
	// and pass through ASCII + Latin-1 Supplement (U+00A0–U+00FF) directly.
	unicodeToWin1252 := map[rune]string{
		'\u2018': "'",  // left single quotation mark
		'\u2019': "'",  // right single quotation mark
		'\u201C': "\"", // left double quotation mark
		'\u201D': "\"", // right double quotation mark
		'\u2013': "-",  // en dash
		'\u2014': "--", // em dash
		'\u2026': "...", // ellipsis
		'\u2022': "*",  // bullet
		'\u00A0': " ",  // non-breaking space
	}

	var b strings.Builder
	b.Grow(len(text))
	for _, r := range text {
		if r < 128 {
			// Standard ASCII - always safe
			b.WriteRune(r)
		} else if r >= 160 && r <= 255 {
			// Latin-1 Supplement - directly supported by Windows-1252
			b.WriteRune(r)
		} else if replacement, ok := unicodeToWin1252[r]; ok {
			// Known Unicode → Windows-1252 equivalent
			b.WriteString(replacement)
		} else {
			// Unsupported character - use closest safe representation
			b.WriteRune(' ')
		}
	}
	return b.String()
}

func sortPhases(transcripts map[string]string) []string {
	// Preferred ordering of debate phases
	preferredOrder := []string{
		"openingFor", "openingAgainst",
		"crossForQuestion", "crossAgainstAnswer",
		"crossAgainstQuestion", "crossForAnswer",
		"closingFor", "closingAgainst",
	}

	ordered := make([]string, 0, len(transcripts))
	seen := make(map[string]bool)

	for _, phase := range preferredOrder {
		if _, exists := transcripts[phase]; exists {
			ordered = append(ordered, phase)
			seen[phase] = true
		}
	}

	// Append any remaining phases alphabetically
	remaining := make([]string, 0)
	for phase := range transcripts {
		if !seen[phase] {
			remaining = append(remaining, phase)
		}
	}
	sort.Strings(remaining)
	ordered = append(ordered, remaining...)

	return ordered
}

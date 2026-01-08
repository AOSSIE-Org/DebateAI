package services

import (
	"context"
	"fmt"
	"strings"
	"arguehub/services/gemini" 
	
)

func TranslateContent(content, fromLang, toLang string) (string, error) {
	// 1. Guard Clause: Don't waste API units if languages are the same or missing
	if fromLang == "" || toLang == "" || strings.EqualFold(fromLang, toLang) {
		return content, nil
	}

	ctx := context.Background()
	
	// 2. Refined Prompt: Instructions are clearer to prevent AI "chatter"
	prompt := fmt.Sprintf(
		"Act as a professional translator. Translate the following debate message from %s to %s. "+
		"Maintain the original tone, slang, and debate context. "+
		"IMPORTANT: Output ONLY the translated text. Do not include quotes, explanations, or 'Translation:' prefixes. "+
		"Content: %s", 
		fromLang, toLang, content,
	)

	// 3. Check if GeminiInstance exists to prevent Nil Pointer Exception
	if gemini.GeminiInstance == nil {
		return content, fmt.Errorf("gemini instance not initialized")
	}

	resp, err := gemini.GeminiInstance.GenerateContent(ctx, prompt)
	if err != nil {
		// Log the error but return the original content so the chat doesn't break
		return content, err
	}

	// 4. Clean up the response
	translated := strings.TrimSpace(resp)
    
    // Remove leading/trailing quotes if Gemini ignored instructions
	translated = strings.Trim(translated, "\"") 

	return translated, nil
}
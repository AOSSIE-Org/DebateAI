import React, { useState, useEffect, useMemo } from 'react';
import Fuse from 'fuse.js';
import { useDebateWS } from '../hooks/useDebateWS';
import { useAtom } from 'jotai';
import { debateIdAtom, spectatorHashAtom, transcriptAtom, questionsAtom } from '../atoms/debateAtoms';
import { Input } from './ui/input';
import { Button } from './ui/button';

export const AnonymousQA: React.FC = () => {
  const [debateId] = useAtom(debateIdAtom);
  const [spectatorHash] = useAtom(spectatorHashAtom);
  const [transcript] = useAtom(transcriptAtom);
  const [questions] = useAtom(questionsAtom);
  const { sendMessage } = useDebateWS(debateId);
  const [questionText, setQuestionText] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Split transcript into sentences for Fuse.js
  const sentences = useMemo(() => {
    if (!transcript) return [];
    return transcript
      .split(/(?<=[.!?])\s+/)
      .filter(s => s.trim().length > 10)
      .map(s => s.trim());
  }, [transcript]);

  // Initialize Fuse.js
  const fuse = useMemo(() => {
    if (sentences.length === 0) return null;
    return new Fuse(sentences, {
      includeScore: true,
      threshold: 0.35,
      minMatchCharLength: 3,
    });
  }, [sentences]);

  // Get suggestions as user types
  useEffect(() => {
    if (!fuse || !questionText.trim() || questionText.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const results = fuse.search(questionText).slice(0, 5);
    const newSuggestions = results.map(r => r.item);
    setSuggestions(newSuggestions);
    setShowSuggestions(newSuggestions.length > 0);
  }, [questionText, fuse]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!debateId || !questionText.trim()) return;

    const hash = spectatorHash || localStorage.getItem('spectatorHash') || '';
    
    // If no hash, generate one
    let finalHash = hash;
    if (!finalHash) {
      const spectatorId = localStorage.getItem('spectatorId') || crypto.randomUUID();
      localStorage.setItem('spectatorId', spectatorId);
      
      // Compute SHA-256 hash
      const encoder = new TextEncoder();
      const data = encoder.encode(spectatorId);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      finalHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      localStorage.setItem('spectatorHash', finalHash);
    }

    const payload = {
      qId: crypto.randomUUID(),
      text: questionText.trim(),
      spectatorHash: finalHash,
      timestamp: Date.now(),
    };

    sendMessage('question', payload);
    setQuestionText('');
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setQuestionText(suggestion);
    setShowSuggestions(false);
  };

  if (!debateId) return null;

  return (
    <div className="w-full max-w-2xl mx-auto p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-4">
        <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">
          Ask a Question (Anonymous)
        </h3>
        
        <form onSubmit={handleSubmit} className="relative">
          <Input
            type="text"
            value={questionText}
            onChange={(e) => setQuestionText(e.target.value)}
            placeholder="Type your question..."
            className="w-full pr-24"
            onFocus={() => {
              if (suggestions.length > 0) setShowSuggestions(true);
            }}
          />
          
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-60 overflow-auto">
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
          
          <Button
            type="submit"
            disabled={!questionText.trim()}
            className="absolute right-2 top-1/2 transform -translate-y-1/2"
          >
            Send
          </Button>
        </form>

        <div className="mt-4 space-y-2 max-h-60 overflow-y-auto">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Recent Questions ({questions.length})
          </h4>
          {questions.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 italic">
              No questions yet. Be the first to ask!
            </p>
          ) : (
            questions.slice(-10).reverse().map((q) => (
              <div
                key={q.qId}
                className="text-sm p-2 bg-gray-50 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600"
              >
                <p className="text-gray-900 dark:text-gray-100">{q.text}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {new Date(q.timestamp).toLocaleTimeString()}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};



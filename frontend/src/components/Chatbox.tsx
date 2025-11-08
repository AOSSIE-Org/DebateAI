import React, { useState, useRef, useEffect } from 'react';
import { BsFillSendFill } from 'react-icons/bs';
import { Mic, MicOff, Type, Volume2 } from 'lucide-react';

export interface ChatMessage {
  isUser: boolean;
  text: string;
  timestamp?: number;
  isTyping?: boolean;
  isSpeaking?: boolean;
}

export interface TypingIndicator {
  userId: string;
  username: string;
  isTyping: boolean;
  isSpeaking: boolean;
  partialText?: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent {
  error: string;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognition;
}

const Chatbox: React.FC<{
  messages: ChatMessage[];
  transcriptStatus: { loading: boolean; isUser: boolean };
  onSendMessage: (message: string, mode: 'type' | 'speak') => void;
  onTypingChange: (isTyping: boolean, partialText?: string) => void;
  onSpeakingChange: (isSpeaking: boolean) => void;
  typingIndicators: TypingIndicator[];
  isMyTurn: boolean;
  disabled?: boolean;
}> = ({
  messages,
  transcriptStatus,
  onSendMessage,
  onTypingChange,
  onSpeakingChange,
  typingIndicators,
  isMyTurn,
  disabled = false,
}) => {
  const [inputText, setInputText] = useState('');
  const [inputMode, setInputMode] = useState<'type' | 'speak'>('type');
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [, setInterimText] = useState('');
  const [, setFinalText] = useState('');

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const onSpeakingChangeRef = useRef(onSpeakingChange);

  // Update onSpeakingChangeRef when onSpeakingChange changes
  useEffect(() => {
    onSpeakingChangeRef.current = onSpeakingChange;
  }, [onSpeakingChange]);

  // Initialize speech recognition
  const finalTextRef = useRef('');
  useEffect(() => {
    const SpeechRecognitionConstructor:
      | SpeechRecognitionConstructor
      | undefined = (window.SpeechRecognition ||
      window.webkitSpeechRecognition) as
      | SpeechRecognitionConstructor
      | undefined;
    if (SpeechRecognitionConstructor) {
      recognitionRef.current = new SpeechRecognitionConstructor();
      const recognition = recognitionRef.current;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsRecognizing(true);
        onSpeakingChangeRef.current(true);
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interimTranscript = '';
        let finalTranscript = finalTextRef.current;

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' ';
          } else {
            interimTranscript += transcript;
          }
        }

        finalTextRef.current = finalTranscript;
        setFinalText(finalTranscript);
        setInterimText(interimTranscript);
        setInputText(finalTranscript + interimTranscript);
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        setIsRecognizing(false);
        onSpeakingChangeRef.current(false);
      };

      recognition.onend = () => {
        setIsRecognizing(false);
        onSpeakingChangeRef.current(false);
      };
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setInputText(text);
    setFinalText(text);
    setInterimText('');

    // Send typing indicator
    onTypingChange(text.length > 0, text);
  };

  const handleSendMessage = () => {
    if (!inputText.trim() || disabled || !isMyTurn) return;

    onSendMessage(inputText.trim(), inputMode);
    setInputText('');
    setFinalText('');
    setInterimText('');
    onTypingChange(false);

    if (isRecognizing) {
      stopRecognition();
    }
  };

  const startRecognition = () => {
    if (recognitionRef.current && !isRecognizing) {
      setInputMode('speak');
      recognitionRef.current.start();
    }
  };

  const stopRecognition = () => {
    if (recognitionRef.current && isRecognizing) {
      recognitionRef.current.stop();
    }
  };

  const toggleInputMode = () => {
    if (inputMode === 'type') {
      setInputMode('speak');
      if (!isRecognizing) {
        startRecognition();
      }
    } else {
      setInputMode('type');
      if (isRecognizing) {
        stopRecognition();
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className='rounded-xl bg-card text-card-foreground shadow flex flex-col h-full'>
      {/* Header */}
      <div className='space-y-1.5 p-6 flex flex-row items-center justify-between'>
        <div className='flex items-center space-x-4'>
          <div>
            <p className='text-sm leading-none'>Chat</p>
          </div>
        </div>
        <div className='flex items-center space-x-2'>
          <button
            onClick={toggleInputMode}
            disabled={disabled || !isMyTurn}
            className={`p-2 rounded-md transition-colors ${
              inputMode === 'type'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted hover:bg-muted/80'
            } ${disabled || !isMyTurn ? 'opacity-50 cursor-not-allowed' : ''}`}
            title={inputMode === 'type' ? 'Switch to Voice' : 'Switch to Type'}
          >
            {inputMode === 'type' ? (
              <Mic className='w-4 h-4' />
            ) : (
              <Type className='w-4 h-4' />
            )}
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className='p-6 pt-0 flex-1 overflow-y-auto'>
        <div className='space-y-4'>
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex w-max max-w-[75%] flex-col gap-2 rounded-lg px-3 py-2 text-sm ${
                message.isUser
                  ? 'ml-auto bg-primary text-primary-foreground'
                  : 'bg-muted'
              }`}
            >
              <div className='flex items-center gap-2'>
                {message.isTyping && (
                  <div className='flex items-center gap-1 text-xs opacity-70'>
                    <div className='flex space-x-1'>
                      <div className='w-1 h-1 bg-current rounded-full animate-bounce'></div>
                      <div
                        className='w-1 h-1 bg-current rounded-full animate-bounce'
                        style={{ animationDelay: '0.1s' }}
                      ></div>
                      <div
                        className='w-1 h-1 bg-current rounded-full animate-bounce'
                        style={{ animationDelay: '0.2s' }}
                      ></div>
                    </div>
                    <span>typing...</span>
                  </div>
                )}
                {message.isSpeaking && (
                  <div className='flex items-center gap-1 text-xs opacity-70'>
                    <Volume2 className='w-3 h-3' />
                    <span>speaking...</span>
                  </div>
                )}
              </div>
              {message.text}
              {message.timestamp && (
                <div className='text-xs opacity-70 mt-1'>
                  {new Date(message.timestamp).toLocaleTimeString()}
                </div>
              )}
            </div>
          ))}

          {/* Typing Indicators */}
          {typingIndicators.map((indicator, index) => (
            <div
              key={index}
              className={`flex w-max max-w-[75%] flex-col gap-2 rounded-lg px-3 py-2 text-sm bg-muted ${
                indicator.isTyping || indicator.isSpeaking ? '' : 'hidden'
              }`}
            >
              <div className='flex items-center gap-2'>
                <span className='text-xs font-medium'>
                  {indicator.username}
                </span>
                {indicator.isTyping && (
                  <div className='flex items-center gap-1 text-xs opacity-70'>
                    <div className='flex space-x-1'>
                      <div className='w-1 h-1 bg-current rounded-full animate-bounce'></div>
                      <div
                        className='w-1 h-1 bg-current rounded-full animate-bounce'
                        style={{ animationDelay: '0.1s' }}
                      ></div>
                      <div
                        className='w-1 h-1 bg-current rounded-full animate-bounce'
                        style={{ animationDelay: '0.2s' }}
                      ></div>
                    </div>
                    <span>typing...</span>
                  </div>
                )}
                {indicator.isSpeaking && (
                  <div className='flex items-center gap-1 text-xs opacity-70'>
                    <Volume2 className='w-3 h-3' />
                    <span>speaking...</span>
                  </div>
                )}
              </div>
              {indicator.partialText && (
                <div className='text-sm opacity-70 italic'>
                  {indicator.partialText}
                </div>
              )}
            </div>
          ))}

          {transcriptStatus.loading && (
            <div
              className={`flex w-max max-w-[75%] flex-col gap-2 rounded-lg px-3 py-2 text-sm animate-pulse ${
                transcriptStatus.isUser
                  ? 'ml-auto bg-primary text-primary-foreground'
                  : 'bg-muted'
              }`}
            >
              Generating transcript...
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div className='flex items-center p-6 pt-0'>
        <form
          className='flex w-full items-center space-x-2'
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
        >
          <div className='flex-1 relative'>
            <input
              ref={inputRef}
              className='flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm'
              id='message'
              placeholder={
                inputMode === 'type'
                  ? 'Type your message...'
                  : isRecognizing
                  ? 'Listening...'
                  : 'Click microphone to speak...'
              }
              autoComplete='off'
              value={inputText}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              disabled={disabled || !isMyTurn}
            />
            {inputMode === 'speak' && (
              <div className='absolute right-2 top-1/2 transform -translate-y-1/2'>
                <button
                  type='button'
                  onClick={isRecognizing ? stopRecognition : startRecognition}
                  disabled={disabled || !isMyTurn}
                  className={`p-1 rounded-full transition-colors ${
                    isRecognizing
                      ? 'bg-red-500 text-white'
                      : 'bg-blue-500 text-white hover:bg-blue-600'
                  } ${
                    disabled || !isMyTurn ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {isRecognizing ? (
                    <MicOff className='w-3 h-3' />
                  ) : (
                    <Mic className='w-3 h-3' />
                  )}
                </button>
              </div>
            )}
          </div>
          <button
            className='inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 w-9'
            type='submit'
            disabled={disabled || !isMyTurn || !inputText.trim()}
          >
            <BsFillSendFill />
            <span className='sr-only'>Send</span>
          </button>
        </form>
      </div>
    </div>
  );
};

export default Chatbox;

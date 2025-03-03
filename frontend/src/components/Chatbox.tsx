import React, { useRef, useEffect } from "react";

export interface ChatMessage {
  isUser: boolean;
  text: string;
}

interface ChatboxProps {
  messages: ChatMessage[];
  transcriptStatus: {
    loading: boolean;
    isUser: boolean;
  };
}

const Chatbox: React.FC<ChatboxProps> = ({ messages, transcriptStatus }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll to bottom whenever messages change
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-blue-300 dark:border-blue-700 p-3 bg-blue-50 dark:bg-blue-900">
        <h2 className="text-lg font-semibold text-blue-700 dark:text-blue-300">Messages</h2>
      </div>
      
      <div className="flex-1 overflow-y-auto p-3 bg-white dark:bg-neutral-800">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`mb-3 max-w-[80%] ${
              message.isUser ? "ml-auto" : "mr-auto"
            }`}
          >
            <div
              className={`p-3 rounded-lg ${
                message.isUser
                  ? "bg-blue-500 text-white rounded-br-none"
                  : "bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200 rounded-bl-none"
              }`}
            >
              {message.text}
            </div>
            <div
              className={`text-xs mt-1 ${
                message.isUser
                  ? "text-right text-neutral-500 dark:text-neutral-400"
                  : "text-left text-neutral-500 dark:text-neutral-400"
              }`}
            >
              {message.isUser ? "You" : "Opponent"}
            </div>
          </div>
        ))}
        
        {transcriptStatus.loading && (
          <div
            className={`mb-3 max-w-[80%] ${
              transcriptStatus.isUser ? "ml-auto" : "mr-auto"
            }`}
          >
            <div
              className={`p-3 rounded-lg ${
                transcriptStatus.isUser
                  ? "bg-blue-500 text-white bg-opacity-50 rounded-br-none"
                  : "bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200 bg-opacity-50 dark:bg-opacity-50 rounded-bl-none"
              }`}
            >
              <div className="flex items-center">
                <div className="mr-2">Transcribing</div>
                <div className="flex space-x-1">
                  <div className="w-2 h-2 rounded-full bg-current animate-pulse"></div>
                  <div className="w-2 h-2 rounded-full bg-current animate-pulse" style={{ animationDelay: "0.2s" }}></div>
                  <div className="w-2 h-2 rounded-full bg-current animate-pulse" style={{ animationDelay: "0.4s" }}></div>
                </div>
              </div>
            </div>
            <div
              className={`text-xs mt-1 ${
                transcriptStatus.isUser
                  ? "text-right text-neutral-500 dark:text-neutral-400"
                  : "text-left text-neutral-500 dark:text-neutral-400"
              }`}
            >
              {transcriptStatus.isUser ? "You" : "Opponent"}
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
      
      <div className="border-t border-blue-300 dark:border-blue-700 p-3 bg-white dark:bg-neutral-800">
        <div className="relative">
          <input
            type="text"
            className="w-full p-2 pr-10 border border-blue-300 dark:border-blue-700 rounded-lg bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Type a message..."
            disabled={true}
            aria-label="Message input (disabled during debate)"
          />
          <div className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs text-neutral-500 dark:text-neutral-400">
            Audio only
          </div>
        </div>
        <div className="text-xs text-center mt-2 text-neutral-500 dark:text-neutral-400">
          Messages are automatically transcribed from your speech
        </div>
      </div>
    </div>
  );
};

export default Chatbox;
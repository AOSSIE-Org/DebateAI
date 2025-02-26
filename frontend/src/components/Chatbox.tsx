import React from 'react'
import { BsFillSendFill } from 'react-icons/bs'

export interface ChatMessage {
  isUser: boolean
  text: string
}

const Chatbox: React.FC<{
  messages: ChatMessage[]
  transcriptStatus: { loading: boolean; isUser: boolean }
}> = ({ messages, transcriptStatus }) => {
  return (
    <div className="rounded-xl bg-card text-card-foreground shadow flex flex-col h-full">
      {/* Header */}
      <div className="space-y-1.5 p-6 flex flex-row items-center">
        <div className="flex items-center space-x-4">
          <div>
            <p className="text-sm leading-none">Chat</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="p-6 pt-0 flex-1 overflow-y-auto">
        <div className="space-y-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex w-max max-w-[75%] flex-col gap-2 rounded-lg px-3 py-2 text-sm ${
                message.isUser
                  ? 'ml-auto bg-primary text-primary-foreground'
                  : 'bg-muted'
              }`}
            >
              {message.text}
            </div>
          ))}
          {transcriptStatus.loading && (
            <div
              className={`flex w-max max-w-[75%] flex-col gap-2 rounded-lg px-3 py-2 text-sm bg-muted animate-pulse ${
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
      <div className="flex items-center p-6 pt-0">
        <form className="flex w-full items-center space-x-2">
          <input
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm flex-1"
            id="message"
            placeholder="Type your message..."
            autoComplete="off"
            value=""
            onChange={() => {}}
          />
          <button
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 w-9"
            type="submit"
            disabled
          >
            <BsFillSendFill />
            <span className="sr-only">Send</span>
          </button>
        </form>
      </div>
    </div>
  )
}

export default Chatbox

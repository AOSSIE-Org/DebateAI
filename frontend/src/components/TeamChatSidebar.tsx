import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Send, Users } from 'lucide-react';
import { safeParse } from '@/utils/safeParse';

interface ChatMessage {
  id: string;
  userId: string;
  email: string;
  displayName: string;
  message: string;
  timestamp: string;
}

interface TeamChatSidebarProps {
  teamId: string;
  isOpen: boolean;
  onClose: () => void;
  ws?: WebSocket;
}

const TeamChatSidebar: React.FC<TeamChatSidebarProps> = ({
  teamId,
  isOpen,
  onClose,
  ws,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle WebSocket messages
  useEffect(() => {
    if (!ws) return;

    const sendJoin = () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'join', room: teamId }));
      }
    };

    ws.onopen = () => {
      setIsConnected(true);
      sendJoin();
    };

    if (ws.readyState === WebSocket.OPEN) {
      setIsConnected(true);
      sendJoin();
    }

    ws.onmessage = (event) => {
      const data = safeParse<any>(event.data, null);
      if (!data) return;

      if (data.type === 'teamChatMessage') {
        const newChatMessage: ChatMessage = {
          id: data.messageId || Date.now().toString(),
          userId: data.userId,
          email: data.email || '',
          displayName: data.username || 'Unknown',
          message: data.content || data.message,
          timestamp: data.timestamp || Date.now().toString(),
        };
        setMessages((prev) => [...prev, newChatMessage]);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
    };

    ws.onerror = (error) => {
      console.error('TeamChatSidebar WebSocket error', error);
      setIsConnected(false);
    };

    return () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [ws, teamId]);

  const handleSendMessage = () => {
    if (!newMessage.trim() || !ws || ws.readyState !== WebSocket.OPEN) return;

    const messageData = {
      type: 'message',
      room: teamId,
      content: newMessage,
      timestamp: Date.now(),
    };

    ws.send(JSON.stringify(messageData));
    setNewMessage('');
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  };

  if (!isOpen) return null;

  return (
    <div className='fixed right-0 top-0 h-full w-96 bg-white shadow-2xl flex flex-col z-50 border-l border-gray-200'>
      {/* Header */}
      <div className='p-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-2'>
            <Users className='w-5 h-5 text-blue-600' />
            <h2 className='text-lg font-semibold text-gray-900'>Team Chat</h2>
          </div>
          <Button
            variant='ghost'
            size='sm'
            onClick={onClose}
            className='text-gray-500 hover:text-gray-700'
          >
            ✕
          </Button>
        </div>
        <div className='mt-2 flex items-center gap-2'>
          <div
            className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-green-500' : 'bg-red-500'
            }`}
          />
          <span className='text-sm text-gray-600'>
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className='flex-1 p-4'>
        <div className='space-y-4'>
          {messages.length === 0 ? (
            <div className='text-center text-gray-500 py-8'>
              No messages yet. Start the conversation!
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className='flex gap-3 hover:bg-gray-50 p-2 rounded-lg transition-colors'
              >
                <Avatar className='w-8 h-8'>
                  <AvatarImage
                    src={`https://avatar.iran.liara.run/public/${msg.userId}`}
                  />
                  <AvatarFallback>{msg.displayName[0]}</AvatarFallback>
                </Avatar>
                <div className='flex-1'>
                  <div className='flex items-center gap-2 mb-1'>
                    <span className='font-medium text-sm text-gray-900'>
                      {msg.displayName}
                    </span>
                    <span className='text-xs text-gray-500'>
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className='text-sm text-gray-700 break-words'>
                    {msg.message}
                  </p>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className='p-4 border-t border-gray-200 bg-gray-50'>
        <div className='flex gap-2'>
          <Input
            placeholder='Type a message...'
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={!isConnected}
            className='flex-1'
          />
          <Button
            onClick={handleSendMessage}
            disabled={!newMessage.trim() || !isConnected}
            size='icon'
          >
            <Send className='w-4 h-4' />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TeamChatSidebar;


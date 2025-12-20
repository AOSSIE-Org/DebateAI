import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import clsx from 'clsx';

const reactionsList = ['😂', '❤️', '❤️', '👍'];

interface Message {
  username: string;
  message: string;
  timestamp?: number;
}

interface FloatingEmoji {
  id: number;
  emoji: string;
}

type VoteOption = 'FOR' | 'AGAINST';

const ChatRoom = () => {
  const { roomId } = useParams();
  const [username, setUsername] = useState('');
  const [joined, setJoined] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [voteResults, setVoteResults] = useState({ FOR: 0, AGAINST: 0 });
  const [userCount, setUserCount] = useState(0);
  const [userVoted, setUserVoted] = useState(false);
  const [floatingEmojis, setFloatingEmojis] = useState<FloatingEmoji[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const emojiIdRef = useRef(0);

  // Cleanup WebSocket on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const joinRoom = () => {
    if (!username.trim()) return;
    const token = localStorage.getItem('token');
    if (!token) return;

    wsRef.current = new WebSocket(
      `ws://localhost:1313/chat/${roomId}?token=${token}`
    );

    wsRef.current.onopen = () => {
      if (wsRef.current) {
        wsRef.current.send(
          JSON.stringify({ type: 'join', room: roomId, username })
        );
      }
      setJoined(true);
    };

    wsRef.current.onmessage = (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      switch (data.type) {
        case 'chatMessage':
          setMessages((prev) => [
            ...prev,
            {
              username: data.username,
              message: data.content,
              timestamp: data.timestamp,
            },
          ]);
          break;
        case 'notification':
          setMessages((prev) => [
            ...prev,
            { username: 'system', message: data.content },
          ]);
          break;
        case 'reaction':
          animateEmoji(data.extra?.reaction || '😂');
          break;
        case 'vote':
          if (data.extra?.option) {
            setVoteResults((prev) => ({
              ...prev,
              [data.extra.option]:
                (prev[data.extra.option as VoteOption] || 0) + 1,
            }));
          }
          break;
        case 'presence':
          setUserCount(data.count || 0);
          break;
        default:
      }
    };

    wsRef.current.onclose = () => {
      setJoined(false);
    };

    wsRef.current.onerror = (error: Event) => {
      console.error('ChatRoom WebSocket error', error);
    };
  };

  const sendMessage = () => {
    if (
      !messageInput.trim() ||
      !wsRef.current ||
      wsRef.current.readyState !== WebSocket.OPEN
    ) {
      return;
    }
    const timestamp = Math.floor(Date.now() / 1000);
    setMessages((prev) => [
      ...prev,
      { username, message: messageInput, timestamp },
    ]);
    if (wsRef.current) {
      wsRef.current.send(
        JSON.stringify({ type: 'chatMessage', content: messageInput })
      );
    }
    setMessageInput('');
  };

  const sendReaction = (reactionType: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }
    if (wsRef.current) {
      wsRef.current.send(
        JSON.stringify({ type: 'reaction', extra: { reaction: reactionType } })
      );
    }
  };

  const animateEmoji = (emoji: string) => {
    const id = emojiIdRef.current++;
    setFloatingEmojis((prev) => [...prev, { id, emoji }]);
    setTimeout(() => {
      setFloatingEmojis((prev) => prev.filter((e) => e.id !== id));
    }, 2000);
  };

  const handleVote = (option: VoteOption) => {
    if (
      userVoted ||
      !wsRef.current ||
      wsRef.current.readyState !== WebSocket.OPEN
    ) {
      return;
    }
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({ type: 'vote', extra: { option } }));
    }
    setVoteResults((prev) => ({
      ...prev,
      [option]: (prev[option] || 0) + 1,
    }));
    setUserVoted(true);
  };

  return (
    <div className='min-h-screen relative flex flex-col bg-gradient-to-br from-gray-800 to-gray-900 text-white p-6'>
      {/* Floating Emoji Layer */}
      <div className='absolute inset-0 pointer-events-none overflow-hidden z-50'>
        {floatingEmojis.map(({ id, emoji }) => (
          <div
            key={id}
            className='absolute text-4xl animate-floating drop-shadow-lg'
            style={{
              left: `${Math.random() * 80 + 10}%`,
              bottom: '10px',
            }}
          >
            {emoji}
          </div>
        ))}
      </div>

      {/* Join Section */}
      {!joined ? (
        <div className='flex flex-col sm:flex-row gap-4 items-center justify-center mt-16'>
          <input
            type='text'
            placeholder='Enter username'
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className='border border-gray-400 p-3 rounded-md w-72 bg-gray-100 text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500 transition'
          />
          <button
            onClick={joinRoom}
            className='bg-blue-600 hover:bg-blue-700 transition text-white px-6 py-3 rounded-md shadow-md'
          >
            Join Room
          </button>
        </div>
      ) : (
        <>
          <div className='flex flex-col sm:flex-row items-center justify-between mb-6'>
            <h2 className='text-2xl font-extrabold'>Live Chat</h2>
            <p className='text-base text-gray-300 mt-2 sm:mt-0'>
              {userCount} users watching...
            </p>
          </div>

          {/* Chat Box */}
          <div className='flex flex-col-reverse overflow-y-auto h-[45vh] bg-gray-100 text-gray-900 border border-gray-300 rounded-lg shadow-inner p-4 mb-6'>
            {messages
              .slice()
              .reverse()
              .map((msg: Message, index: number) => (
                <div
                  key={index}
                  className={clsx(
                    'mb-2 text-sm p-1 rounded transition-colors',
                    msg.username === 'system' && 'text-blue-600 font-medium',
                    msg.username === username && 'text-green-700 font-semibold'
                  )}
                >
                  <span className='mr-2'>
                    [
                    {msg.timestamp
                      ? new Date(msg.timestamp * 1000).toLocaleTimeString()
                      : 'N/A'}
                    ]
                  </span>
                  <span className='mr-2'>{msg.username}:</span>
                  <span>{msg.message}</span>
                </div>
              ))}
          </div>

          {/* Message Input */}
          <div className='flex gap-4 mb-6'>
            <input
              type='text'
              placeholder='Type a message...'
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              className='flex-grow border border-gray-400 p-3 rounded-md bg-gray-100 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 transition'
            />

            <button
              onClick={sendMessage}
              className='bg-green-600 hover:bg-green-700 transition text-white px-6 py-3 rounded-md shadow-md'
            >
              Send
            </button>
          </div>

          {/* Reactions */}
          <div className='mb-6'>
            <h3 className='font-bold text-lg mb-3'>Reactions</h3>
            <div className='flex gap-4 text-3xl'>
              {reactionsList.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => sendReaction(emoji)}
                  className='transition transform hover:scale-125'
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Voting */}
          <div className='mt-auto mb-4'>
            <h3 className='text-xl font-bold mb-4'>Live Poll</h3>
            <div className='flex gap-6'>
              <button
                onClick={() => handleVote('FOR')}
                disabled={userVoted}
                className='bg-purple-600 hover:bg-purple-700 transition text-white px-6 py-3 rounded-md shadow-md flex flex-col items-center disabled:opacity-50'
              >
                <span className='font-semibold'>Vote FOR</span>
                <span className='text-sm'>{voteResults.FOR}</span>
              </button>
              <button
                onClick={() => handleVote('AGAINST')}
                disabled={userVoted}
                className='bg-red-600 hover:bg-red-700 transition text-white px-6 py-3 rounded-md shadow-md flex flex-col items-center disabled:opacity-50'
              >
                <span className='font-semibold'>Vote AGAINST</span>
                <span className='text-sm'>{voteResults.AGAINST}</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ChatRoom;

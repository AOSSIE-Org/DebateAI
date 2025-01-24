// import React, { useState, useEffect } from 'react';
// import { io, Socket } from 'socket.io-client';
// import axios from 'axios';

// const socket: Socket = io('http://localhost:5000');

// const JoinRoom: React.FC = ()  => {
//   const [roomId, setRoomId] = useState(''); 
//   const [username, setUsername] = useState('');
//   const [message, setMessage] = useState('');
//   const [messages, setMessages] = useState<string[]>([]);
//   const [joined, setJoined] = useState(false);

//   const handleCreateRoom = async () => {
//     try {
//       const response = await axios.post('http://localhost:5000/create-room', { room_id: roomId });
//       alert(response.data.message);
//     } catch (error) {
//       console.error(error);
//     }
//   };


//   const handleJoinRoom = async () => {
//     try {
//       const response = await axios.post('http://localhost:5000/join-room', {
//         room_id: roomId,
//         user: username,
//       });
//       alert(response.data.message);
//       setJoined(true);
//       socket.emit('join', { room: roomId, user: username });
//     } catch (error) {
//       console.error(error);
//     }
//   };


//   const sendMessage = () => {
//     if (message.trim()) {
//       socket.emit('message', { room: roomId, user: username, message });
//       setMessage('');
//     }
//   };

//   useEffect(() => {
//     socket.on('message', (data) => {
//       setMessages((prev) => [...prev, `${data.user}: ${data.message}`]);
//     });

//     socket.on('user_joined', (data) => {
//       setMessages((prev) => [...prev, `${data.user} has joined the room.`]);
//     });

//     socket.on('user_left', (data) => {
//       setMessages((prev) => [...prev, `${data.user} has left the room.`]);
//     });

//     return () => {
//       socket.off('message');
//       socket.off('user_joined');
//       socket.off('user_left');
//     };
//   }, []);

//   return (
//     <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-6">
//       <h1 className="text-4xl font-bold text-teal-600 mb-6">Debate Room</h1>
//       {!joined ? (
//         <div className="bg-white shadow-lg rounded-lg p-6 w-full max-w-md">
//           <h2 className="text-2xl font-semibold text-gray-700 mb-4">Join or Create a Room</h2>
//           <input
//             type="text"
//             placeholder="Enter Room ID"
//             value={roomId}
//             onChange={(e) => setRoomId(e.target.value)}
//             className="w-full p-3 border rounded-lg mb-3 text-gray-700 focus:outline-teal-500"
//           />
//           <input
//             type="text"
//             placeholder="Enter Username"
//             value={username}
//             onChange={(e) => setUsername(e.target.value)}
//             className="w-full p-3 border rounded-lg mb-4 text-gray-700 focus:outline-teal-500"
//           />
//           <div className="flex justify-between">
//             <button
//               onClick={handleCreateRoom}
//               className="w-full bg-teal-600 text-white p-3 rounded-lg font-semibold hover:bg-teal-700 transition"
//             >
//               Create Room
//             </button>
//             <div className="w-2"></div>
//             <button
//               onClick={handleJoinRoom}
//               className="w-full bg-blue-600 text-white p-3 rounded-lg font-semibold hover:bg-blue-700 transition"
//             >
//               Join Room
//             </button>
//           </div>
//         </div>
//       ) : (
//         <div className="bg-white shadow-lg rounded-lg p-6 w-full max-w-2xl">
//           <h2 className="text-xl font-semibold text-gray-700 mb-4">Room: {roomId}</h2>
//           <div className="h-64 overflow-y-scroll bg-gray-50 border rounded-lg p-3 mb-4">
//             {messages.map((msg, idx) => (
//               <p key={idx} className="text-gray-700 mb-2">
//                 {msg}
//               </p>
//             ))}
//           </div>
//           <div className="flex items-center space-x-3">
//             <input
//               type="text"
//               placeholder="Type your message"
//               value={message}
//               onChange={(e) => setMessage(e.target.value)}
//               className="w-full p-3 border rounded-lg text-gray-700 focus:outline-teal-500"
//             />
//             <button
//               onClick={sendMessage}
//               className="bg-teal-600 text-white px-5 py-3 rounded-lg font-semibold hover:bg-teal-700 transition"
//             >
//               Send
//             </button>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// };

// export default JoinRoom;


import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import axios from 'axios';

const socket: Socket = io('http://localhost:5000');

const DebateRoom: React.FC = () => {
  const [roomId, setRoomId] = useState('');
  const [username, setUsername] = useState('');
  const [opponent, setOpponent] = useState('');
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<string[]>([]);
  const [joined, setJoined] = useState(false);
  const [round, setRound] = useState(1);
  const [timer, setTimer] = useState(60); // 60 seconds per round
  const [userPoints, setUserPoints] = useState(0);
  const [opponentPoints, setOpponentPoints] = useState(0);

  const handleCreateRoom = async () => {
    try {
      const response = await axios.post('http://localhost:5000/create-room', { room_id: roomId });
      alert(response.data.message);
    } catch (error) {
      console.error(error);
    }
  };

  const handleJoinRoom = async () => {
    try {
      const response = await axios.post('http://localhost:5000/join-room', {
        room_id: roomId,
        user: username,
      });
      alert(response.data.message);
      setJoined(true);
      socket.emit('join', { room: roomId, user: username });
    } catch (error) {
      console.error(error);
    }
  };

  const sendMessage = () => {
    if (message.trim()) {
      socket.emit('message', { room: roomId, user: username, message });
      setMessage('');
      setUserPoints((prev) => prev + 10); // Increment points for arguments made
    }
  };

  useEffect(() => {
    socket.on('message', (data) => {
      setMessages((prev) => [...prev, `${data.user}: ${data.message}`]);
    });

    socket.on('user_joined', (data) => {
      setOpponent(data.user); // Set opponent's username
      setMessages((prev) => [...prev, `${data.user} has joined the room.`]);
    });

    socket.on('user_left', (data) => {
      setMessages((prev) => [...prev, `${data.user} has left the room.`]);
      setOpponent('');
    });

    const interval = setInterval(() => {
      if (joined && timer > 0) {
        setTimer((prev) => prev - 1);
      }
    }, 1000);

    return () => {
      clearInterval(interval);
      socket.off('message');
      socket.off('user_joined');
      socket.off('user_left');
    };
  }, [joined, timer]);

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-6">
      <h1 className="text-4xl font-bold text-yellow-400 mb-6">Debate Battlefield</h1>
      {!joined ? (
        <div className="bg-white shadow-lg rounded-lg p-6 w-full max-w-md">
          <h2 className="text-2xl font-semibold text-gray-700 mb-4">Join or Create a Debate</h2>
          <input
            type="text"
            placeholder="Enter Room ID"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            className="w-full p-3 border rounded-lg mb-3 text-gray-700 focus:outline-yellow-400"
          />
          <input
            type="text"
            placeholder="Enter Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full p-3 border rounded-lg mb-4 text-gray-700 focus:outline-yellow-400"
          />
          <div className="flex justify-between">
            <button
              onClick={handleCreateRoom}
              className="w-full bg-yellow-600 text-white p-3 rounded-lg font-semibold hover:bg-yellow-700 transition"
            >
              Create Room
            </button>
            <div className="w-2"></div>
            <button
              onClick={handleJoinRoom}
              className="w-full bg-blue-600 text-white p-3 rounded-lg font-semibold hover:bg-blue-700 transition"
            >
              Join Room
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-gray-800 shadow-lg rounded-lg p-6 w-full max-w-5xl text-white">
          <h2 className="text-xl font-semibold text-yellow-400 mb-4">Debate Room: {roomId}</h2>
          <div className="flex justify-between items-center mb-6">
            <div className="flex-1 text-center">
              <h3 className="text-xl font-bold">{username}</h3>
              <p className="text-yellow-400 text-lg">Points: {userPoints}</p>
            </div>
            <div className="flex-1 text-center text-lg font-bold">
              <p className="text-white">Round {round}</p>
              <p className="text-yellow-400">Time Left: {timer}s</p>
            </div>
            <div className="flex-1 text-center">
              <h3 className="text-xl font-bold">{opponent || "Waiting..."}</h3>
              <p className="text-yellow-400 text-lg">Points: {opponentPoints}</p>
            </div>
          </div>
          <div className="h-64 overflow-y-scroll bg-gray-900 border border-gray-700 rounded-lg p-3 mb-4">
            {messages.map((msg, idx) => (
              <p key={idx} className="text-gray-300 mb-2">{msg}</p>
            ))}
          </div>
          <div className="flex items-center space-x-3">
            <input
              type="text"
              placeholder="Type your argument"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full p-3 border border-gray-700 rounded-lg text-gray-300 bg-gray-800 focus:outline-yellow-400"
            />
            <button
              onClick={sendMessage}
              className="bg-yellow-600 text-white px-5 py-3 rounded-lg font-semibold hover:bg-yellow-700 transition"
            >
              Submit Argument
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DebateRoom;

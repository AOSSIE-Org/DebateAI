// import { useContext, useState } from 'react'
// import './App.css'
// import AuthenticationPage from './Pages/Authentication'
// import { ThemeProvider, ThemeContext } from './context/theme-provider'
// import { Button } from './components/ui/button'

// import { LuMoon } from "react-icons/lu";
// import { LuSun } from "react-icons/lu";


// function Subscriber(){
//   const value = useContext(ThemeContext);
//   return(
//     <Button onClick={value!.toggleTheme} className='p-0 h-8 w-8 md:h-12 md:w-12 fixed right-4 bottom-4'>
//       {value?.theme ? <LuMoon className='text-xl'/> : <LuSun className="text-xl"/>}
//     </Button>
//   )
// }
// function App() {

//   return (
//     <div>
//       <ThemeProvider>
//         <AuthenticationPage></AuthenticationPage>
//         {/* <Subscriber></Subscriber> */}
//       </ThemeProvider>
//     </div>
//   )
// }

// export default App

// import React, { useState, useEffect } from 'react';
// import { io, Socket } from 'socket.io-client';
// import axios from 'axios';

// const socket: Socket = io('http://localhost:5000');

// const App: React.FC = () => {
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

  // const handleJoinRoom = async () => {
  //   try {
  //     const response = await axios.post('http://localhost:5000/join-room', {
  //       room_id: roomId,
  //       user: username,
  //     });
  //     alert(response.data.message);
  //     setJoined(true);
  //     socket.emit('join', { room: roomId, user: username });
  //   } catch (error) {
  //     console.error(error);
  //   }
  // };

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
//     <div className="App">
//       <h1>Debate Room</h1>
//       {!joined ? (
//         <div>
//           <input
//             type="text"
//             placeholder="Enter Room ID"
//             value={roomId}
//             onChange={(e) => setRoomId(e.target.value)}
//           />
//           <input
//             type="text"
//             placeholder="Enter Username"
//             value={username}
//             onChange={(e) => setUsername(e.target.value)}
//           />
//           <button onClick={handleCreateRoom}>Create Room</button>
//           <button onClick={handleJoinRoom}>Join Room</button>
//         </div>
//       ) : (
//         <div>
//           <div>
//             <h2>Room: {roomId}</h2>
//             <div>
//               {messages.map((msg, idx) => (
//                 <p key={idx}>{msg}</p>
//               ))}
//             </div>
//           </div>
//           <input
//             type="text"
//             placeholder="Type your message"
//             value={message}
//             onChange={(e) => setMessage(e.target.value)}
//           />
//           <button onClick={sendMessage}>Send</button>
//         </div>
//       )}
//     </div>
//   );
// };

// export default App;


import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import axios from 'axios';

const socket: Socket = io('http://localhost:5000');

const App: React.FC = () => {
  const [roomId, setRoomId] = useState('');
  const [username, setUsername] = useState('');
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<string[]>([]);
  const [joined, setJoined] = useState(false);

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
    }
  };

  useEffect(() => {
    socket.on('message', (data) => {
      setMessages((prev) => [...prev, `${data.user}: ${data.message}`]);
    });

    socket.on('user_joined', (data) => {
      setMessages((prev) => [...prev, `${data.user} has joined the room.`]);
    });

    socket.on('user_left', (data) => {
      setMessages((prev) => [...prev, `${data.user} has left the room.`]);
    });

    return () => {
      socket.off('message');
      socket.off('user_joined');
      socket.off('user_left');
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-6">
      <h1 className="text-4xl font-bold text-teal-600 mb-6">Debate Room</h1>
      {!joined ? (
        <div className="bg-white shadow-lg rounded-lg p-6 w-full max-w-md">
          <h2 className="text-2xl font-semibold text-gray-700 mb-4">Join or Create a Room</h2>
          <input
            type="text"
            placeholder="Enter Room ID"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            className="w-full p-3 border rounded-lg mb-3 text-gray-700 focus:outline-teal-500"
          />
          <input
            type="text"
            placeholder="Enter Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full p-3 border rounded-lg mb-4 text-gray-700 focus:outline-teal-500"
          />
          <div className="flex justify-between">
            <button
              onClick={handleCreateRoom}
              className="w-full bg-teal-600 text-white p-3 rounded-lg font-semibold hover:bg-teal-700 transition"
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
        <div className="bg-white shadow-lg rounded-lg p-6 w-full max-w-2xl">
          <h2 className="text-xl font-semibold text-gray-700 mb-4">Room: {roomId}</h2>
          <div className="h-64 overflow-y-scroll bg-gray-50 border rounded-lg p-3 mb-4">
            {messages.map((msg, idx) => (
              <p key={idx} className="text-gray-700 mb-2">
                {msg}
              </p>
            ))}
          </div>
          <div className="flex items-center space-x-3">
            <input
              type="text"
              placeholder="Type your message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full p-3 border rounded-lg text-gray-700 focus:outline-teal-500"
            />
            <button
              onClick={sendMessage}
              className="bg-teal-600 text-white px-5 py-3 rounded-lg font-semibold hover:bg-teal-700 transition"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;


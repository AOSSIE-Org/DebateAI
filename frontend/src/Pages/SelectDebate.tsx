import React from "react";
import { useNavigate } from "react-router-dom";

const SelectDebate: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-b from-blue-100 to-gray-200">
      <h1 className="text-4xl font-extrabold text-blue-600 mb-8 animate-pulse">
        Choose Your Debate Mode
      </h1>

      {/* Debate Options */}
      <div className="flex space-x-8">
        {/* Debate with AI */}
        <div
          onClick={() => navigate("/debate-with-ai")}
          className="cursor-pointer bg-white shadow-lg rounded-lg p-8 w-64 flex flex-col items-center transition-transform transform hover:scale-105 hover:shadow-xl group"
        >
          <div className="bg-blue-500 text-white w-16 h-16 flex items-center justify-center rounded-full mb-4 group-hover:bg-blue-600">
            <i className="fas fa-robot text-3xl"></i>
          </div>
          <h2 className="text-xl font-semibold text-gray-700 group-hover:text-blue-500">
            Debate with AI
          </h2>
          <p className="text-gray-500 text-center mt-2">
            Challenge an AI with your arguments and improve your debating skills.
          </p>
        </div>

        {/* Debate with User */}
        <div
          onClick={() => navigate("/join-room")}
          className="cursor-pointer bg-white shadow-lg rounded-lg p-8 w-64 flex flex-col items-center transition-transform transform hover:scale-105 hover:shadow-xl group"
        >
          <div className="bg-gray-400 text-white w-16 h-16 flex items-center justify-center rounded-full mb-4 group-hover:bg-gray-500">
            <i className="fas fa-user-friends text-3xl"></i>
          </div>
          <h2 className="text-xl font-semibold text-gray-700 group-hover:text-gray-500">
            Debate with User
          </h2>
          <p className="text-gray-500 text-center mt-2">
            Compete with other users in real-time debates.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SelectDebate;


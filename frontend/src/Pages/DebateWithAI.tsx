import React, { useState } from "react";
import axios from "axios";
import SubmitButton from "../Utils/SubmitButton";
import Header from "../Utils/Header";
import Loader from "@/Utils/Loader";
import Loader1 from "../Utils/Loader1";


const DebateWithAI: React.FC = () => {
  const [userArgument, setUserArgument] = useState<string>("");
  const [debateLog, setDebateLog] = useState<{ user: string; ai: string }[]>([]);
  const [userScore, setUserScore] = useState<number>(0);
  const [analysis, setAnalysis] = useState<{
    userAnalysis: string;
    userPoints : string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleDebate = async () => {
    if (!userArgument.trim()) return;

    // Add user's argument to the debate log immediately
    setDebateLog((prevLog) => [...prevLog, { user: userArgument, ai: "" }]);
    setUserArgument("");
    setIsLoading(true);

    try {
      // Send the user's argument to the backend and receive AI's response
      const response = await axios.post("http://localhost:5000/debate", {
        argument: userArgument,
      });
      const aiResponse = response.data.counter_argument;

      // Update the last log entry with AI's response
      setDebateLog((prevLog) => {
        const updatedLog = [...prevLog];
        updatedLog[updatedLog.length - 1].ai = aiResponse;
        return updatedLog;
      });

      // Fetch analysis for both user and AI arguments
        const analysisresponse = await axios.post("http://localhost:5000/analyse", {
          user_argument: userArgument,
          
        });
        console.log(analysisresponse);

        if (analysisresponse.data) {
          setAnalysis({
            userAnalysis: analysisresponse.data.user_analysis_content,
            userPoints: analysisresponse.data.user_analysis_points,
          });
          
        console.log(analysis);

        setUserScore((prev) => prev + parseInt(analysisresponse.data.user_analysis_points|| "0"));
        }else{
          console.error("No analysis data received from the backend");
        }
    } catch (error) {
      console.error("Error debating with AI or fetching analysis:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-between h-screen bg-gradient-to-b from-gray-100 to-gray-300 p-4">
      {/* Header */}
      <div className="flex justify-between items-center w-full max-w-7xl mb-4">
        <h1 ><Header /></h1>
        <div className="flex space-x-6">
          <div className="text-center">
            <p className="text-sm font-medium text-gray-600">Your Score</p>
            <p className="text-2xl font-bold text-blue-500">{userScore}</p>
          </div>
        </div>
      </div>

      <div className="flex w-full max-w-7xl">
        {/* Analysis Box */}
        <div className="flex-grow w-1/3 bg-gray-200 shadow-lg rounded-lg p-6 mr-4 max-h-[500px] overflow-y-auto">
          <h2 className="text-xl font-bold text-red-500 mb-4">Analysis</h2>
          {analysis ? (
      <div className="mb-4">
        <p>{analysis.userAnalysis}</p>
      </div>
    ) : !isLoading ? (
      <p>No analysis available yet. Submit an argument to get started.</p>
    ) : (
      <Loader1 />
    )}
        </div>

        {/* Debate Log Section */}
        <div className="flex-grow w-2/3 bg-white shadow-lg rounded-lg p-6 max-h-[500px] overflow-y-scroll">
          {debateLog.map((entry, index) => (
            <div key={index} className="flex flex-col mb-6">
              {/* User's Argument */}
              <div className="flex justify-start">
                <div className="bg-blue-500 text-white p-4 rounded-lg max-w-md shadow-lg">
                  <p className="font-bold">You:</p>
                  <p>{entry.user}</p>
                </div>
              </div>
              {/* AI's Response */}
              {isLoading && index === debateLog.length - 1 && entry.ai === "" ? (
                <div className="flex justify-end mt-2 animate-pulse">
                  <div className="bg-gray-300 text-gray-800 p-4 rounded-lg max-w-md shadow-lg">
                    <p className="font-bold">AI:</p>
                    <Loader/>
                  </div>
                </div>
              ) : (
                entry.ai && (
                  <div className="flex justify-end mt-2">
                    <div className="bg-green-500 text-white p-4 rounded-lg max-w-md shadow-lg">
                      <p className="font-bold">AI:</p>
                      <p>{entry.ai}</p>
                    </div>
                  </div>
                )
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Input Section */}
      <div className="w-full max-w-7xl mt-4 mb-8">
        <div className="flex items-center space-x-4">
          <input
            type="text"
            value={userArgument}
            onChange={(e) => setUserArgument(e.target.value)}
            placeholder="Enter your argument"
            className="flex-grow p-3 border rounded-lg shadow-sm focus:ring-2 focus:ring-blue-400"
          />
           <div
            onClick={handleDebate}
            className={`rounded-xl shadow-md text-white font-semibold ${
              isLoading
                ? "bg-gray-500 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700"
            }`}
            >
              <SubmitButton></SubmitButton>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DebateWithAI;

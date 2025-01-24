import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import SelectDebate from "./Pages/SelectDebate";
import DebateWithAI from "./Pages/DebateWithAI";
import JoinRoom from "./Pages/JoinRoom";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<SelectDebate />} />
        <Route path="/debate-with-ai" element={<DebateWithAI />} />
        <Route path = "/join-room" element={<JoinRoom />} />
      </Routes>
    </Router>
  );
}

export default App;

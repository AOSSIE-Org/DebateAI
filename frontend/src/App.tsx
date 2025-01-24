import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import SelectDebate from "./Pages/SelectDebate";
import DebateWithAI from "./Pages/DebateWithAI";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<SelectDebate />} />
        <Route path="/debate-with-ai" element={<DebateWithAI />} />
      </Routes>
    </Router>
  );
}

export default App;

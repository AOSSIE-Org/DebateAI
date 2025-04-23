import React, { useContext } from "react";
import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import { AuthProvider, AuthContext } from "./context/authContext";
import { ThemeProvider } from "./context/theme-provider";
// Pages
import Home from "./Pages/Home";
import Authentication from "./Pages/Authentication";
import DebateApp from "./Pages/Game";
import Profile from "./Pages/Profile";
import Leaderboard from "./Pages/Leaderboard";
import StartDebate from "./Pages/StartDebate";
import About from "./Pages/About";
import BotSelection from "./Pages/BotSelection";
import DebateRoom from "./Pages/DebateRoom";
import OnlineDebateRoom from "./Pages/OnlineDebateRoom";
import StrengthenArgument from "./Pages/StrengthenArgument";
// Layout
import Layout from "./components/Layout";
import CoachPage from "./Pages/CoachPage";
import ChatRoom from "./components/ChatRoom";
import TournamentHub from "./Pages/TournamentHub";
import TournamentDetails from "./Pages/TournamentDetails";

// Protects routes based on authentication status
function ProtectedRoute() {
  const authContext = useContext(AuthContext);
  if (!authContext) {
    throw new Error("ProtectedRoute must be used within an AuthProvider");
  }
  const { isAuthenticated, loading: isLoading } = authContext;
  if (isLoading) {
    return <div>Loading...</div>;
  }
  return isAuthenticated ? <Outlet /> : <Navigate to="/" replace />;
}

// Defines application routes
function AppRoutes() {
  const authContext = useContext(AuthContext);
  if (!authContext) {
    throw new Error("AppRoutes must be used within an AuthProvider");
  }
  const { isAuthenticated } = authContext;
  return (
    <Routes>
      {/* Public routes */}
      <Route
        path="/"
        element={
          isAuthenticated ? <Navigate to="/startDebate" replace /> : <Home />
        }
      />
      <Route path="/auth" element={<Authentication />} />
      {/* Protected routes with layout */}
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<Layout />}>
          <Route path="startDebate" element={<StartDebate />} />
          <Route path="leaderboard" element={<Leaderboard />} />
          <Route path="profile" element={<Profile />} />
          <Route path="about" element={<About />} />
          <Route path="game/:userId" element={<DebateApp />} />
          <Route path="bot-selection" element={<BotSelection />} />
          <Route path="/tournaments" element={<TournamentHub />} />
          <Route path="/coach" element={<CoachPage />} />
          <Route path="/tournament/:id/bracket" element={<TournamentDetails />} />
          <Route
            path="coach/strengthen-argument"
            element={<StrengthenArgument />}
          />
        </Route>
        <Route path="/debate/:roomId" element={<DebateRoom />} />
        <Route path="/debate-room/:roomId" element={<OnlineDebateRoom />} />
        <Route path="/spectator/:roomId" element={<ChatRoom />} />
      </Route>
      {/* Redirect unknown routes */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

// Main app with providers
function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <AppRoutes />
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;

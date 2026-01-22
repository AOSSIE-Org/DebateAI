import { useContext } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, AuthContext } from './context/authContext';
import { ThemeProvider } from './context/theme-provider';
// Pages
import Home from './Pages/Home';
import Authentication from './Pages/Authentication';
import DebateApp from './Pages/Game';
import Profile from './Pages/Profile';
import Leaderboard from './Pages/Leaderboard';
import StartDebate from './Pages/StartDebate';
import About from './Pages/About';
import BotSelection from './Pages/BotSelection';
import DebateRoom from './Pages/DebateRoom';
import OnlineDebateRoom from './Pages/OnlineDebateRoom';
import StrengthenArgument from './Pages/StrengthenArgument';
import SpeechTest from './Pages/SpeechTest';
// Layout
import Layout from './components/Layout';
import CoachPage from './Pages/CoachPage';
import ChatRoom from './components/ChatRoom';
import TournamentHub from './Pages/TournamentHub';
import TournamentDetails from './Pages/TournamentDetails';
import ProsConsChallenge from './Pages/ProsConsChallenge';
import TeamBuilder from './Pages/TeamBuilder';
import TeamDebateRoom from './Pages/TeamDebateRoom';
import CommunityFeed from './Pages/CommunityFeed';
import AdminSignup from './Pages/Admin/AdminSignup';
import AdminDashboard from './Pages/Admin/AdminDashboard';
import ViewDebate from './Pages/ViewDebate';

// Protects routes based on authentication status
function ProtectedRoute() {
  const authContext = useContext(AuthContext);
  if (!authContext) {
    throw new Error('ProtectedRoute must be used within an AuthProvider');
  }
  const { isAuthenticated, loading: isLoading } = authContext;
  if (isLoading) {
    return <div>Loading...</div>;
  }
  return isAuthenticated ? <Outlet /> : <Navigate to='/' replace />;
}

// Defines application routes
function AppRoutes() {
  const authContext = useContext(AuthContext);
  if (!authContext) {
    throw new Error('AppRoutes must be used within an AuthProvider');
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
        <Route path="/admin/login" element={<AdminSignup />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />

        {/* Protected routes */}
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="startDebate" element={<StartDebate />} />
            <Route path="leaderboard" element={<Leaderboard />} />
            <Route path="profile" element={<Profile />} />
            <Route path="community" element={<CommunityFeed />} />
            <Route path="about" element={<About />} />
            <Route path="team-builder" element={<TeamBuilder />} />
            <Route path="game/:userId" element={<DebateApp />} />
            <Route path="bot-selection" element={<BotSelection />} />
            <Route path="tournaments" element={<TournamentHub />} />
            <Route
              path="tournament/:id/bracket"
              element={<TournamentDetails />}
            />

            {/* Coach routes */}
            <Route path="coach" element={<CoachPage />}>
              <Route
                path="strengthen-argument"
                element={<StrengthenArgument />}
              />
              <Route path="pros-cons" element={<ProsConsChallenge />} />
            </Route>
          </Route>

          {/* Debate routes (outside layout) */}
          <Route path="debate/:roomId" element={<DebateRoom />} />
          <Route path="debate-room/:roomId" element={<OnlineDebateRoom />} />
          <Route path="team-debate/:debateId" element={<TeamDebateRoom />} />
          <Route path="spectator/:roomId" element={<ChatRoom />} />
          <Route path="debate/:debateID/view" element={<ViewDebate />} />
          <Route path="view-debate/:debateID" element={<ViewDebate />} />
          <Route path="speech-test" element={<SpeechTest />} />
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

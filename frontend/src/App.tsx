import { useContext } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, AuthContext } from './context/authContext';
import { ThemeProvider } from './context/theme-provider';
import { GlobalErrorBoundary, RouteErrorBoundary } from './components/ErrorBoundary';
import DebateRoomErrorBoundary from './components/ErrorBoundary/DebateRoomWrapper';
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
        path='/'
        element={
          isAuthenticated ? <Navigate to='/startDebate' replace /> : (
            <RouteErrorBoundary routeName="Home">
              <Home />
            </RouteErrorBoundary>
          )
        }
      />
      <Route path='/auth' element={
        <RouteErrorBoundary routeName="Authentication">
          <Authentication />
        </RouteErrorBoundary>
      } />
      {/* Protected routes with layout */}
      <Route element={<ProtectedRoute />}>
        <Route path='/' element={
          <RouteErrorBoundary routeName="Layout">
            <Layout />
          </RouteErrorBoundary>
        }>
          <Route path='startDebate' element={
            <RouteErrorBoundary routeName="Start Debate">
              <StartDebate />
            </RouteErrorBoundary>
          } />
          <Route path='leaderboard' element={
            <RouteErrorBoundary routeName="Leaderboard">
              <Leaderboard />
            </RouteErrorBoundary>
          } />
          <Route path='profile' element={
            <RouteErrorBoundary routeName="Profile">
              <Profile />
            </RouteErrorBoundary>
          } />
          <Route path='about' element={
            <RouteErrorBoundary routeName="About">
              <About />
            </RouteErrorBoundary>
          } />
          <Route path='team-builder' element={
            <RouteErrorBoundary routeName="Team Builder">
              <TeamBuilder />
            </RouteErrorBoundary>
          } />
          <Route path='game/:userId' element={
            <RouteErrorBoundary routeName="Debate Game">
              <DebateApp />
            </RouteErrorBoundary>
          } />
          <Route path='bot-selection' element={
            <RouteErrorBoundary routeName="Bot Selection">
              <BotSelection />
            </RouteErrorBoundary>
          } />
          <Route path='/tournaments' element={
            <RouteErrorBoundary routeName="Tournament Hub">
              <TournamentHub />
            </RouteErrorBoundary>
          } />
          <Route path='/coach' element={
            <RouteErrorBoundary routeName="Coach">
              <CoachPage />
            </RouteErrorBoundary>
          } />
          <Route
            path='/tournament/:id/bracket'
            element={
              <RouteErrorBoundary routeName="Tournament Details">
                <TournamentDetails />
              </RouteErrorBoundary>
            }
          />
          <Route
            path='coach/strengthen-argument'
            element={
              <RouteErrorBoundary routeName="Strengthen Argument">
                <StrengthenArgument />
              </RouteErrorBoundary>
            }
          />
          <Route path='coach/pros-cons' element={
            <RouteErrorBoundary routeName="Pros & Cons Challenge">
              <ProsConsChallenge />
            </RouteErrorBoundary>
          } />
        </Route>
        {/* Critical debate routes with specialized error handling */}
        <Route path='/debate/:roomId' element={
          <DebateRoomErrorBoundary>
            <DebateRoom />
          </DebateRoomErrorBoundary>
        } />
        <Route path='/debate-room/:roomId' element={
          <DebateRoomErrorBoundary>
            <OnlineDebateRoom />
          </DebateRoomErrorBoundary>
        } />
        <Route path='/team-debate/:debateId' element={
          <DebateRoomErrorBoundary>
            <TeamDebateRoom />
          </DebateRoomErrorBoundary>
        } />
        <Route path='/spectator/:roomId' element={
          <RouteErrorBoundary routeName="Spectator Chat">
            <ChatRoom />
          </RouteErrorBoundary>
        } />
        <Route path='/debate/:debateID/view' element={
          <RouteErrorBoundary routeName="View Debate">
            <ViewDebate />
          </RouteErrorBoundary>
        } />
        <Route path='/view-debate/:debateID' element={
          <RouteErrorBoundary routeName="View Debate">
            <ViewDebate />
          </RouteErrorBoundary>
        } />
        <Route path='/speech-test' element={
          <RouteErrorBoundary routeName="Speech Test">
            <SpeechTest />
          </RouteErrorBoundary>
        } />
      </Route>
      {/* Redirect unknown routes */}
      <Route path='*' element={<Navigate to='/' replace />} />
    </Routes>
  );
}

// Main app with providers
function App() {
  return (
    <GlobalErrorBoundary>
      <AuthProvider>
        <ThemeProvider>
          <AppRoutes />
        </ThemeProvider>
      </AuthProvider>
    </GlobalErrorBoundary>
  );
}

export default App;

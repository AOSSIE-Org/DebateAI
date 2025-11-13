import { useContext } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, AuthContext } from './context/authContext';
import { ThemeProvider } from './context/theme-provider';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { RouteErrorBoundary } from './components/ErrorBoundary';
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
          <RouteErrorBoundary>
            {isAuthenticated ? <Navigate to='/startDebate' replace /> : <Home />}
          </RouteErrorBoundary>
        }
      />
      <Route 
        path='/auth' 
        element={
          <RouteErrorBoundary>
            <Authentication />
          </RouteErrorBoundary>
        } 
      />
      {/* Protected routes with layout */}
      <Route element={<ProtectedRoute />}>
        <Route 
          path='/' 
          element={
            <RouteErrorBoundary>
              <Layout />
            </RouteErrorBoundary>
          }
        >
          <Route 
            path='startDebate' 
            element={
              <RouteErrorBoundary>
                <StartDebate />
              </RouteErrorBoundary>
            } 
          />
          <Route 
            path='leaderboard' 
            element={
              <RouteErrorBoundary>
                <Leaderboard />
              </RouteErrorBoundary>
            } 
          />
          <Route 
            path='profile' 
            element={
              <RouteErrorBoundary>
                <Profile />
              </RouteErrorBoundary>
            } 
          />
          <Route 
            path='about' 
            element={
              <RouteErrorBoundary>
                <About />
              </RouteErrorBoundary>
            } 
          />
          <Route 
            path='team-builder' 
            element={
              <RouteErrorBoundary>
                <TeamBuilder />
              </RouteErrorBoundary>
            } 
          />
          <Route 
            path='game/:userId' 
            element={
              <RouteErrorBoundary>
                <DebateApp />
              </RouteErrorBoundary>
            } 
          />
          <Route 
            path='bot-selection' 
            element={
              <RouteErrorBoundary>
                <BotSelection />
              </RouteErrorBoundary>
            } 
          />
          <Route 
            path='/tournaments' 
            element={
              <RouteErrorBoundary>
                <TournamentHub />
              </RouteErrorBoundary>
            } 
          />
          <Route 
            path='/coach' 
            element={
              <RouteErrorBoundary>
                <CoachPage />
              </RouteErrorBoundary>
            } 
          />
          <Route
            path='/tournament/:id/bracket'
            element={
              <RouteErrorBoundary>
                <TournamentDetails />
              </RouteErrorBoundary>
            }
          />
          <Route
            path='coach/strengthen-argument'
            element={
              <RouteErrorBoundary>
                <StrengthenArgument />
              </RouteErrorBoundary>
            }
          />
          <Route 
            path='coach/pros-cons' 
            element={
              <RouteErrorBoundary>
                <ProsConsChallenge />
              </RouteErrorBoundary>
            } 
          />
        </Route>
        <Route 
          path='/debate/:roomId' 
          element={
            <RouteErrorBoundary>
              <DebateRoom />
            </RouteErrorBoundary>
          } 
        />
        <Route 
          path='/debate-room/:roomId' 
          element={
            <RouteErrorBoundary>
              <OnlineDebateRoom />
            </RouteErrorBoundary>
          } 
        />
        <Route 
          path='/team-debate/:debateId' 
          element={
            <RouteErrorBoundary>
              <TeamDebateRoom />
            </RouteErrorBoundary>
          } 
        />
        <Route 
          path='/spectator/:roomId' 
          element={
            <RouteErrorBoundary>
              <ChatRoom />
            </RouteErrorBoundary>
          } 
        />
        <Route 
          path='/debate/:debateID/view' 
          element={
            <RouteErrorBoundary>
              <ViewDebate />
            </RouteErrorBoundary>
          } 
        />
        <Route 
          path='/view-debate/:debateID' 
          element={
            <RouteErrorBoundary>
              <ViewDebate />
            </RouteErrorBoundary>
          } 
        />
        <Route 
          path='/speech-test' 
          element={
            <RouteErrorBoundary>
              <SpeechTest />
            </RouteErrorBoundary>
          } 
        />
      </Route>
      {/* Redirect unknown routes */}
      <Route path='*' element={<Navigate to='/' replace />} />
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

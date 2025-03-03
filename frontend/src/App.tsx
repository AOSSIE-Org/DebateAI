import './App.css';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import Authentication from './Pages/Authentication';
import Home from './Pages/Home';
import { ThemeProvider } from './context/theme-provider';
import DebateApp from './Pages/Game';
import { AuthContext, AuthProvider } from  "./context/authContext";
import { useContext, useEffect, useState } from 'react';
import ToastNotification from './components/ToastNotification';

const ProtectedRoute = () => {
  const auth = useContext(AuthContext);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(false);
  }, [auth?.isAuthenticated]);

  if (isLoading) return <div>Loading...</div>; // Show loading screen while checking auth

  return auth?.isAuthenticated ? <Outlet /> : <Navigate to="/auth" replace />;
};


function App() {
  return (<div>
      <ToastNotification />
      <AuthProvider>
        <ThemeProvider>
            <Routes>
              <Route path="/auth" element={<Authentication />} />
              <Route path="/" element={<Home />} />
              <Route element={<ProtectedRoute />}>
                <Route path="/game/:userId" element={<DebateApp />} />
              </Route>
            </Routes>
        </ThemeProvider>
      </AuthProvider>
    </div>
    
  );
}


export default App;

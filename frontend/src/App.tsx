import './App.css';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import Authentication from './Pages/Authentication';
import Home from './Pages/Home';
import { ThemeProvider } from './context/theme-provider';
import DebateApp from './Pages/Game';
import { AuthContext, AuthProvider } from  "./context/authContext";
import { useContext, useEffect, useState } from 'react';
import DebateWithAI from './Pages/DebateWithAI';
import Features from './components/ui/Features';
import InteractiveDemo from './Pages/Demo/InteractiveDemo';
import HowItWorks from './Pages/HowItWorks/HowItWorks';
import FAQ from './Pages/FaqPage/FAQ';
import Footer from './Pages/Footer/Footer';
import StartDebatePage from './Pages/StartDebatePage';


const ProtectedRoute = () => {
  const auth = useContext(AuthContext);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(false);
  }, [auth?.isAuthenticated]);

  if (isLoading) return <div>Loading...</div>; // Show loading screen while checking auth

  return auth?.isAuthenticated ? <Outlet /> : <Navigate to="/auth" replace />;
};

function HomePage() {
  return (
    <>      <Home />
      
      <InteractiveDemo />
      <HowItWorks></HowItWorks>
      <Features></Features>
      <FAQ></FAQ>
      <Footer></Footer>
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
          <Routes>
            <Route path="/auth" element={<Authentication />} />
            <Route path="/" element={<HomePage />} />
            <Route path="/startdebate" element={<StartDebatePage />} />
            <Route path="/debatewithai" element={<DebateWithAI />} />
            <Route element={<ProtectedRoute />}>
            <Route path="/game/:userId" element={<DebateApp />} />
            </Route>
          </Routes>
      </ThemeProvider>
    </AuthProvider>
    
  );
}



export default App;

import './App.css';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Authentication from './Pages/Authentication';
import Home from './Pages/Home';
import { ThemeProvider } from './context/theme-provider';

// Dummy authentication check function (replace with real logic)
const isAuthenticated = (): boolean => {
  // Example: Check if a token exists in localStorage
  return true;
  // return localStorage.getItem('authToken') ? true : false;
};

// Define props for ProtectedRoute
interface ProtectedRouteProps {
  children: React.ReactNode; // React children
}

// Protected Route Component
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  return isAuthenticated() ? <>{children}</> : <Navigate to="/auth" replace />;
};


function App() {
  return (
    <ThemeProvider>
      <Router>
        <Routes>
          <Route path="/auth" element={<Authentication />} />
          <Route path="/" element={<Home />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;

{/* <ProtectedRoute>
                <Home />
              </ProtectedRoute> */}
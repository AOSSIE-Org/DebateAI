import { useContext, useState } from "react";
import "./App.css";
import AuthenticationPage from "./Pages/Authentication";
import { ThemeProvider, ThemeContext } from "./context/theme-provider";
import { Button } from "./components/ui/button";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LuMoon } from "react-icons/lu";
import { LuSun } from "react-icons/lu";
import LandingPage from "./Pages/LandingPage";

function Subscriber() {
  const value = useContext(ThemeContext);
  return (
    <Button
      onClick={value!.toggleTheme}
      className="p-0 h-8 w-8 md:h-12 md:w-12 fixed right-4 bottom-4"
    >
      {value?.theme ? (
        <LuMoon className="text-xl" />
      ) : (
        <LuSun className="text-xl" />
      )}
    </Button>
  );
}
function App() {
  return (
    <div>
      <BrowserRouter>
        <ThemeProvider>
          <Routes>
            <Route index element={<LandingPage />} />
            <Route path="/login" element={<AuthenticationPage />} />
          </Routes>
        </ThemeProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;

import React, { useContext, useState } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "@/context/authContext";
import DebateCover from "../assets/DebateCover4.svg";
import { RiRobot2Fill } from "react-icons/ri";
import { FaHandshakeSimpleSlash } from "react-icons/fa6";
import AOSSIELogo from "@/assets/aossie.png";
const Home: React.FC = () => {
  const navigate = useNavigate();
  const authContext = useContext(AuthContext);
  const [loading, setLoading] = useState<null | "online" | "bot">(null);
  const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

  const signupHandler = () => {
    navigate('/auth', { state: { isSignUp: true } });
  };

  const loginHandler = () => {
    navigate('/auth', { state: { isSignUp: false } });
  };

  const handlePlayDebateClick = async () => {
    setLoading("online");

    await delay(800);

    if (authContext?.isAuthenticated) {
      navigate('/game');
    } else {
      navigate('/auth', { state: { isSignUp: false } });
    }

    setLoading(null);
  };

  const handlePlayBotClick = async () => {
    setLoading("bot");

    await delay(800);

    if (authContext?.isAuthenticated) {
      navigate('/bot-selection');
    } else {
      navigate('/auth', { state: { isSignUp: false } });
    }

    setLoading(null);
  };

  const logoutHandler = () =>{
    authContext?.logout()
    navigate("/")
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <nav className="flex items-center justify-between px-6 py-4 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-4">
          <a 
            href="https://aossie.org" 
            target="_blank" 
            rel="noopener noreferrer"
            className="p-1 hover:opacity-80 transition-opacity"
          >
            <img src={AOSSIELogo} alt="AOSSIE Logo" className="h-8 w-auto object-contain" />
          </a>
          <div className="flex flex-col">
            <span className="text-2xl font-black tracking-tight text-primary leading-none">DebateAI</span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">by AOSSIE</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {authContext?.isAuthenticated ? (
            <Button onClick={logoutHandler} variant="destructive" size="sm">Log out</Button>
          ) : (
            <>
              <Button 
                variant="ghost" 
                className="text-foreground hover:bg-accent"
                onClick={loginHandler}
              >
                Login
              </Button>
              <Button 
                variant="outline"
                className="font-bold border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                onClick={signupHandler}
              >
                Sign Up
              </Button>
            </>
          )}
        </div>
      </nav>

      <div className="flex items-center justify-center">
        <div className="flex flex-wrap items-center justify-center w-full px-2 md:px-16">
          <div className="w-full md:w-2/3 p-4 md:p-16">
            <img src={DebateCover} alt="Debate Cover" className="w-full object-cover" />
          </div>
          <div className="flex w-full md:w-1/3 flex-col items-center justify-center space-y-4 p-4">
            <h3 className="text-xl md:text-4xl font-bold text-center">
              Play Debate Online on the <span className="text-primary">#1</span> Site!
            </h3>
            <div className="flex flex-col w-full">
              <Button className="my-2 h-auto rounded text-xl flex items-center justify-start" onClick={handlePlayDebateClick}>
                <FaHandshakeSimpleSlash className="text-4xl" />
                <div className="flex flex-col items-start ml-4">
                  <span className="font-bold">Play Online</span>
                  <span className="text-sm text-primary-foreground font-thin">
                    Play with someone at your level
                  </span>
                </div>
              </Button>
              <Button
                className="my-2 h-auto rounded text-xl flex items-center justify-start"
                variant="outline"
                onClick={handlePlayBotClick}
              >
                <RiRobot2Fill className="text-4xl" />
                <div className="flex flex-col items-start ml-4">
                  <span className="font-bold">Practice with Bot</span>
                  <span className="text-sm text-muted-foreground font-thin">
                    Improve your skills with AI guidance
                  </span>
                </div>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;

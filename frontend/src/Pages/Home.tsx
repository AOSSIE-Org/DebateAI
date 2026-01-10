import DebateCover from "../assets/DebateCover4.svg";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { RiRobot2Fill } from "react-icons/ri";
import { FaHandshakeSimpleSlash } from "react-icons/fa6";
import { useContext } from "react";
import { AuthContext } from "@/context/authContext";

{/* TODO modify the home page for already logged in and signed up state  */}

const Home: React.FC = () => {
  const navigate = useNavigate();
  const authContext = useContext(AuthContext);

  

  const signupHandler = () => {
    navigate('/auth', { state: { isSignUp: true } });
  };

  const loginHandler = () => {
    navigate('/auth', { state: { isSignUp: false } });
  };
  const handlePlayDebateClick = () => {
    if (authContext?.isAuthenticated) {
      navigate('/game');  
    } else {
      navigate('/auth', { state: { isSignUp: false } });
    }
  };

  const handlePlayBotClick = () => {
    if (authContext?.isAuthenticated) {
      navigate('/game');  // Navigate to play page if authenticated
    } else {
      navigate('/auth', { state: { isSignUp: false } });  // Navigate to login page if not authenticated
    }
  };

  const logoutHandler = () =>{
    authContext?.logout()
    navigate("/")
  }

  return (
    <div className="flex flex-col min-h-screen">
      <nav className="flex items-center justify-between px-4 py-4 md:px-12">
        <h1 className="text-xl md:text-3xl font-bold">Argue-Hub</h1>
          {
            authContext?.isAuthenticated?(<Button onClick={logoutHandler}>Log out</Button>):(
              <div className="flex">
                <Button className="mr-2" onClick={loginHandler}>Login</Button>
                <Button variant="outline" onClick={signupHandler}>Sign Up</Button>
              </div>  
            )
          }
      </nav>

      <div className="flex items-start justify-center pt-8">
        <div className="flex flex-wrap items-start justify-center w-full px-2 md:px-16">
          <div className="w-full md:w-2/3 p-4 md:p-16">
            <img src={DebateCover} alt="Debate Cover" className="w-full object-cover" />
          </div>
          <div className="flex w-full md:w-1/3 flex-col items-center justify-center space-y-8 p-4 pt-16 min-h-[600px]">
            <h3 className="text-2xl md:text-6xl lg:text-7xl font-extrabold text-center leading-tight tracking-tight drop-shadow-2xl shadow-black/50" style={{ textShadow: '4px 4px 8px rgba(0, 0, 0, 0.5), 2px 2px 4px rgba(0, 0, 0, 0.3)' }}>
              <span className="whitespace-nowrap">Play Debate Online</span><br />on the <span className="text-primary font-black drop-shadow-xl shadow-black/60">#1</span> Site!
            </h3>
            <div className="flex flex-col w-full">
              <Button className="my-3 h-auto rounded-lg text-2xl flex items-center justify-start shadow-2xl hover:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] transition-all duration-300 transform hover:scale-105" style={{ boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3), 0 10px 20px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)' }} onClick={handlePlayDebateClick}>
                <FaHandshakeSimpleSlash className="text-5xl" />
                <div className="flex flex-col items-start ml-6">
                  <span className="font-bold text-2xl drop-shadow-md" style={{ textShadow: '2px 2px 4px rgba(0, 0, 0, 0.3)' }}>Play Online</span>
                  <span className="text-xl text-primary-foreground font-medium mt-2 drop-shadow-sm" style={{ textShadow: '1px 1px 2px rgba(0, 0, 0, 0.2)' }}>
                    Play with someone at your level
                  </span>
                </div>
              </Button>
              <Button
                className="my-3 h-auto rounded-lg text-2xl flex items-center justify-start shadow-2xl hover:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] transition-all duration-300 transform hover:scale-105"
                style={{ boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3), 0 10px 20px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)' }}
                variant="outline"
                onClick={handlePlayBotClick}
              >
                <RiRobot2Fill className="text-5xl" />
                <div className="flex flex-col items-start ml-6">
                  <span className="font-bold text-2xl drop-shadow-md" style={{ textShadow: '2px 2px 4px rgba(0, 0, 0, 0.3)' }}>Practice with Bot</span>
                  <span className="text-xl text-muted-foreground font-medium mt-2 drop-shadow-sm" style={{ textShadow: '1px 1px 2px rgba(0, 0, 0, 0.2)' }}>
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

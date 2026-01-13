import DebateCover from "../assets/DebateCover4.svg";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { RiRobot2Fill } from "react-icons/ri";
import { FaHandshakeSimpleSlash } from "react-icons/fa6";
import { useContext } from "react";
import { AuthContext } from "@/context/authContext";

const Home: React.FC = () => {
  const navigate = useNavigate();
  const authContext = useContext(AuthContext);

  const signupHandler = () => {
    navigate("/auth", { state: { isSignUp: true } });
  };

  const loginHandler = () => {
    navigate("/auth", { state: { isSignUp: false } });
  };
  const handlePlayDebateClick = () => {
    if (authContext?.isAuthenticated) {
      navigate("/game");
    } else {
      navigate("/auth", { state: { isSignUp: false } });
    }
  };

  const handlePlayBotClick = () => {
    if (authContext?.isAuthenticated) {
      navigate("/game"); // Navigate to play page if authenticated
    } else {
      navigate("/auth", { state: { isSignUp: false } }); // Navigate to login page if not authenticated
    }
  };

  const logoutHandler = () => {
    authContext?.logout();
    navigate("/");
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <nav className="flex items-center justify-between px-4 py-3 md:px-12 flex-shrink-0">
        <h1 className="text-xl md:text-3xl font-bold">Argue-Hub</h1>
        {authContext?.isAuthenticated ? (
          <Button onClick={logoutHandler}>Log out</Button>
        ) : (
          <div className="flex">
            <Button className="mr-2" onClick={loginHandler}>
              Login
            </Button>
            <Button variant="outline" onClick={signupHandler}>
              Sign Up
            </Button>
          </div>
        )}
      </nav>

      <div className="flex items-center justify-center flex-1 min-h-0">
        <div className="flex flex-col md:flex-row items-center justify-center w-full h-full px-4 md:px-8 gap-4 md:gap-8">
          {/* Image container - constrained height */}
          <div className="flex items-center justify-center w-full md:w-1/2 flex-shrink min-h-0">
            <img
              src={DebateCover}
              alt="Debate Cover"
              className="w-full max-h-[45vh] md:max-h-[70vh] object-contain"
            />
          </div>
          {/* Content container */}
          <div className="flex w-full md:w-1/2 flex-col items-center justify-center gap-3 md:gap-4 flex-shrink-0">
            <h3 className="text-lg md:text-xl lg:text-3xl font-bold text-center">
              Play Debate Online on the <span className="text-primary">#1</span>{" "}
              Site!
            </h3>
            <div className="flex flex-col w-full max-w-md gap-2">
              <Button
                className="h-auto py-3 rounded text-base md:text-lg flex items-center justify-start whitespace-normal text-left"
                onClick={handlePlayDebateClick}
              >
                <FaHandshakeSimpleSlash className="text-2xl md:text-3xl shrink-0" />{" "}
                <div className="flex flex-col items-start ml-3">
                  <span className="font-bold leading-tight">Play Online</span>
                  <span className="text-xs md:text-sm text-primary-foreground font-thin leading-tight">
                    Play with someone at your level
                  </span>
                </div>
              </Button>
              <Button
                className="h-auto py-3 rounded text-base md:text-lg flex items-center justify-start whitespace-normal text-left"
                variant="outline"
                onClick={handlePlayBotClick}
              >
                <RiRobot2Fill className="text-2xl md:text-3xl shrink-0" />
                <div className="flex flex-col items-start ml-3">
                  <span className="font-bold leading-tight">
                    Practice with Bot
                  </span>
                  <span className="text-xs md:text-sm text-muted-foreground font-thin leading-tight">
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

import { useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import { RiRobot2Fill } from "react-icons/ri";
import { FaHandshakeSimpleSlash } from "react-icons/fa6";

import DebateCover from "../assets/DebateCover4.svg";
import { Button } from "../components/ui/button";
import { AuthContext } from "../context/authContext";
import DebatePopup from "@/components/DebatePopup";

const StartDebate = () => {
  const navigate = useNavigate();
  const authContext = useContext(AuthContext);
  const [showPopup, setShowPopup] = useState(false);

  const handlePlayDebateClick = () => {
    if (authContext?.isAuthenticated) {
      setShowPopup(true);
    } else {
      navigate("/auth", { state: { isSignUp: false } });
    }
  };

  const handlePlayBotClick = () => {
    if (authContext?.isAuthenticated) {
      navigate("/bot-selection");
    } else {
      navigate("/auth", { state: { isSignUp: false } });
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-center flex-1 min-h-0">
        <div className="flex flex-col xl:flex-row items-center justify-center w-full h-full px-4 xl:px-8 gap-4 xl:gap-8">
          {/* Image container - constrained height */}
          <div className="flex items-center justify-center w-full xl:w-1/2 flex-shrink min-h-0">
            <img
              src={DebateCover}
              alt="Debate Cover"
              className="w-full max-h-[45vh] xl:max-h-[70vh] object-contain"
            />
          </div>
          {/* Content container */}
          <div className="flex w-full xl:w-1/2 flex-col items-center justify-center gap-3 xl:gap-4 flex-shrink-0">
            <h3 className="text-lg md:text-xl xl:text-3xl font-bold text-center">
              Play Debate Online on the <span className="text-primary">#1</span>{" "}
              Site!
            </h3>
            <div className="flex flex-col w-full max-w-md gap-2">
              <Button
                className="h-auto py-3 rounded text-base md:text-lg flex items-center justify-start whitespace-normal text-left"
                onClick={handlePlayDebateClick}
              >
                <FaHandshakeSimpleSlash className="text-2xl md:text-3xl shrink-0" />
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
      {showPopup && <DebatePopup onClose={() => setShowPopup(false)} />}
    </div>
  );
};

export default StartDebate;

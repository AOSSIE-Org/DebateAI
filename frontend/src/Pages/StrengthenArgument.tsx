import React, { useState, useEffect } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { getAuthToken } from "@/utils/auth";

// Dummy list of topics for suggestions
const sampleTopics = [
  "Should AI rule the world?",
  "Is social media making us more isolated?",
  "Should renewable energy replace fossil fuels?",
  "Is remote work the future of employment?",
];

interface WeakStatement {
  id: string;
  topic: string;
  stance: string;
  text: string;
}

interface Evaluation {
  score: number;
  feedback: string;
}

interface Notification {
  id: number;
  title: string;
  description: string;
  variant: "default" | "destructive";
}

const StrengthenArgument: React.FC = () => {
  const [topic, setTopic] = useState<string>("");
  const [stance, setStance] = useState<string>("for");
  const [weakStatement, setWeakStatement] = useState<WeakStatement | null>(null);
  const [userResponse, setUserResponse] = useState<string>("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [animatedScore, setAnimatedScore] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<number>(1);

  useEffect(() => {
    setToken(getAuthToken());
    const handleStorageChange = () => setToken(getAuthToken());
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  // Animate score: count up from 0 to final score over 1000ms
  useEffect(() => {
    if (score !== null) {
      setAnimatedScore(0);
      const duration = 1000;
      const steps = score;
      const intervalTime = duration / (steps || 1);
      let current = 0;
      const interval = setInterval(() => {
        current++;
        setAnimatedScore(current);
        if (current >= score) {
          clearInterval(interval);
        }
      }, intervalTime);
      return () => clearInterval(interval);
    }
  }, [score]);

  const notify = (title: string, description: string, variant: "default" | "destructive" = "default") => {
    const newNotification = {
      id: Date.now(),
      title,
      description,
      variant,
    };
    setNotifications((prev) => [...prev, newNotification]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== newNotification.id));
    }, 5000);
  };

  const fetchWeakStatement = async () => {
    if (!topic.trim()) {
      setError("Please enter a topic.");
      return;
    }
    if (!token) {
      setError("Please log in to continue.");
      notify("Authentication Error", "Please log in to continue", "destructive");
      return;
    }
    setIsLoading(true);
    setError(null);
    setWeakStatement(null);
    try {
      const url = `http://localhost:1313/coach/strengthen-argument/weak-statement?topic=${encodeURIComponent(topic)}&stance=${encodeURIComponent(stance)}`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      });
      const text = await response.text();
      if (!response.ok) {
        throw new Error(`Server error (Status: ${response.status}): ${text || "Unknown error"}`);
      }
      let data: WeakStatement | null = null;
      try {
        data = JSON.parse(text) as WeakStatement;
      } catch (err) {
        console.warn('Failed to parse weak statement response', err);
      }
      if (!data || !data.id || !data.text || !data.topic || !data.stance) {
        throw new Error("Invalid response format: missing fields");
      }
      setWeakStatement(data);
      setCurrentStep(2);
    } catch (err: any) {
      const errorMessage = err.message.includes("invalid character")
        ? "Server returned invalid data. Please try again or contact support."
        : err.message;
      setError(errorMessage);
      notify("Error", errorMessage, "destructive");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!weakStatement || !userResponse.trim()) return;
    if (!token) {
      setError("Please log in to continue.");
      notify("Authentication Error", "Please log in to continue", "destructive");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("http://localhost:1313/coach/strengthen-argument/evaluate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        body: JSON.stringify({
          topic: weakStatement.topic,
          stance: weakStatement.stance,
          weakStatementText: weakStatement.text,
          userResponse,
        }),
      });
      const text = await response.text();
      if (!response.ok) {
        throw new Error(`Server error (Status: ${response.status}): ${text || "Unknown error"}`);
      }
      let data: Evaluation | null = null;
      try {
        data = JSON.parse(text) as Evaluation;
      } catch (err) {
        console.warn("Failed to parse evaluation response", err);
      }

      // Validate parsed response
      if (!data || typeof data.score !== "number" || !data.feedback) {
        throw new Error("Invalid evaluation result: missing score or feedback");
      }

      setFeedback(data.feedback);
      setScore(data.score);
      setShowModal(true);
      setCurrentStep(3);
    } catch (err: any) {
      setError(err.message);
      notify("Error", err.message, "destructive");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRandomTopic = () => {
    const randomTopic = sampleTopics[Math.floor(Math.random() * sampleTopics.length)];
    setTopic(randomTopic);
  };

  const handleTryAnother = () => {
    setTopic("");
    setStance("for");
    setWeakStatement(null);
    setUserResponse("");
    setFeedback(null);
    setScore(null);
    setShowModal(false);
    setCurrentStep(1);
  };

  return (
    <div className="container mx-auto p-6 min-h-screen bg-background text-foreground">
      {/* Notification Area */}
      <div className="fixed top-4 right-4 space-y-2 z-50">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={`p-4 rounded-md shadow-md ${
              notification.variant === "destructive" ? "bg-destructive" : "bg-primary"
            }`}
          >
            <h3 className="font-bold">{notification.title}</h3>
            <p>{notification.description}</p>
          </div>
        ))}
      </div>

      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <header className="mb-8 border-b border-border pb-4">
          <h1 className="text-4xl font-extrabold mb-2">Strengthen Your Debate Skills</h1>
          <p className="text-lg text-muted-foreground">
            Turn a weak argument into a persuasive statement. Choose a topic, generate a weak statement, and then refine it!
          </p>
        </header>

        {/* Step Progress Indicator */}
        <div className="flex items-center justify-center mb-8">
          <div className="flex flex-col items-center">
            <div className={`w-8 h-8 rounded-full ${currentStep >= 1 ? "bg-primary" : "bg-muted"}`}></div>
            <span className="text-sm mt-1">Choose Topic</span>
          </div>
          <div className="w-16 h-1 bg-muted mx-2"></div>
          <div className="flex flex-col items-center">
            <div className={`w-8 h-8 rounded-full ${currentStep >= 2 ? "bg-primary" : "bg-muted"}`}></div>
            <span className="text-sm mt-1">Strengthen Argument</span>
          </div>
          <div className="w-16 h-1 bg-muted mx-2"></div>
          <div className="flex flex-col items-center">
            <div className={`w-8 h-8 rounded-full ${currentStep >= 3 ? "bg-primary" : "bg-muted"}`}></div>
            <span className="text-sm mt-1">View Feedback</span>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-4 bg-destructive text-destructive-foreground rounded">
            {error}
          </div>
        )}

        {/* Step 1: Choose a Topic */}
        {currentStep === 1 && (
          <Card className="mb-6 bg-card text-card-foreground shadow-lg">
            <CardHeader>
              <CardTitle className="text-xl font-semibold">Step 1: Choose a Topic</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-muted-foreground">
                Enter a debate topic or use one of our suggestions to get started.
              </p>
              <div className="flex space-x-2 mb-4">
                <Input
                  placeholder="Enter a debate topic (e.g., 'Social Media Benefits')"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="flex-grow border-border"
                />
                <Button
                  onClick={handleRandomTopic}
                  variant="outline"
                  className="hover:bg-secondary/90"
                >
                  Random Topic
                </Button>
              </div>
              <div className="mb-4">
                <select
                  value={stance}
                  onChange={(e) => setStance(e.target.value)}
                  className="bg-input text-foreground border-border w-full p-2 rounded"
                >
                  <option value="for">For</option>
                  <option value="against">Against</option>
                </select>
              </div>
              <Button
                onClick={fetchWeakStatement}
                disabled={isLoading || !topic.trim()}
                className="w-full bg-primary hover:bg-primary/90"
              >
                {isLoading ? "Generating..." : "Generate Weak Statement"}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Strengthen Argument */}
        {weakStatement && (
          <>
            <Card className="mb-6 bg-card text-card-foreground shadow-lg">
              <CardHeader>
                <CardTitle className="text-xl font-semibold">
                  Weak Opening Statement for {weakStatement.stance} the topic "{weakStatement.topic}"
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p>{weakStatement.text}</p>
              </CardContent>
            </Card>

            <Card className="mb-6 bg-card text-card-foreground shadow-lg">
              <CardHeader>
                <CardTitle className="text-xl font-semibold">Your Strengthened Argument</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="Write your strengthened argument here..."
                  value={userResponse}
                  onChange={(e) => setUserResponse(e.target.value)}
                  className="mb-4 bg-input text-foreground border-border min-h-[150px]"
                  rows={5}
                />
                <Button
                  onClick={handleSubmit}
                  disabled={isLoading || !userResponse.trim()}
                  className="w-full bg-primary hover:bg-primary/90"
                >
                  {isLoading ? "Submitting..." : "Submit Your Argument"}
                </Button>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Feedback Dialog (Unchanged) */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="bg-card text-card-foreground">
          <DialogHeader>
            <DialogTitle>Feedback</DialogTitle>
            <DialogDescription className="flex flex-col items-center">
              {score !== null && (
                <p className="mb-4 text-6xl font-bold text-primary">
                  {animatedScore.toString().padStart(2, "0")}
                </p>
              )}
              {feedback && <p className="mt-2 text-center">{feedback}</p>}
            </DialogDescription>
          </DialogHeader>
          <Button
            onClick={handleTryAnother}
            className="mt-4 bg-destructive hover:bg-destructive/90"
          >
            Try Another Topic
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StrengthenArgument;

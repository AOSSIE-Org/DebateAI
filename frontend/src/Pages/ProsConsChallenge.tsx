// src/Pages/ProsConsChallenge.tsx
import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { getAuthToken } from "@/utils/auth";

interface ArgumentEvaluation {
  score: number;
  feedback: string;
  counter: string;
}

interface Evaluation {
  pros: ArgumentEvaluation[];
  cons: ArgumentEvaluation[];
  score: number;
}

const ProsConsChallenge: React.FC = () => {
  const [token, setToken] = useState<string | null>(null);
  const [topic, setTopic] = useState<string | null>(null);
  const [pros, setPros] = useState<string[]>([""]);
  const [cons, setCons] = useState<string[]>([""]);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<number>(1);

  useEffect(() => {
    setToken(getAuthToken());
    const handleStorageChange = () => setToken(getAuthToken());
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const fetchTopic = async () => {
    if (!token) {
      setError("Please log in to continue.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("http://localhost:1313/coach/pros-cons/topic", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to fetch topic");
      setTopic(data.topic);
      setCurrentStep(2);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const addArgument = (type: "pros" | "cons") => {
    if (type === "pros" && pros.length < 5) {
      setPros([...pros, ""]);
    } else if (type === "cons" && cons.length < 5) {
      setCons([...cons, ""]);
    }
  };

  const updateArgument = (type: "pros" | "cons", index: number, value: string) => {
    if (type === "pros") {
      const newPros = [...pros];
      newPros[index] = value;
      setPros(newPros);
    } else {
      const newCons = [...cons];
      newCons[index] = value;
      setCons(newCons);
    }
  };

  const handleSubmit = async () => {
    if (!token || !topic) return;
    if (pros.filter(p => p.trim()).length === 0 || cons.filter(c => c.trim()).length === 0) {
      setError("Please provide at least one pro and one con.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("http://localhost:1313/coach/pros-cons/submit", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ topic, pros: pros.filter(p => p.trim()), cons: cons.filter(c => c.trim()) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to evaluate arguments");
      setEvaluation(data);
      setCurrentStep(3);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const resetChallenge = () => {
    setTopic(null);
    setPros([""]);
    setCons([""]);
    setEvaluation(null);
    setCurrentStep(1);
    setError(null);
  };

  return (
    <div className="container mx-auto p-6 min-h-screen bg-background text-foreground">
      <header className="mb-8 border-b border-border pb-4">
        <h1 className="text-4xl font-extrabold mb-2">Pros and Cons Challenge</h1>
        <p className="text-lg text-muted-foreground">
          Test your argumentation skills by generating up to 5 pros and 5 cons for a debate topic!
        </p>
      </header>

      {/* Step Progress */}
      <div className="flex items-center justify-center mb-8">
        {[1, 2, 3].map(step => (
          <React.Fragment key={step}>
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full ${currentStep >= step ? "bg-primary" : "bg-muted"}`}></div>
              <span className="text-sm mt-1">
                {step === 1 ? "Get Topic" : step === 2 ? "Enter Arguments" : "View Feedback"}
              </span>
            </div>
            {step < 3 && <div className="w-16 h-1 bg-muted mx-2"></div>}
          </React.Fragment>
        ))}
      </div>

      {error && (
        <div className="mb-4 p-4 bg-destructive text-destructive-foreground rounded">
          {error}
        </div>
      )}

      {/* Step 1: Fetch Topic */}
      {currentStep === 1 && (
        <Card className="max-w-3xl mx-auto bg-card text-card-foreground shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl font-semibold">Step 1: Get Your Debate Topic</CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              onClick={fetchTopic}
              disabled={isLoading}
              className="w-full bg-primary hover:bg-primary/90"
            >
              {isLoading ? "Fetching..." : "Get Topic"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Enter Pros and Cons */}
      {topic && currentStep === 2 && (
        <Card className="max-w-3xl mx-auto bg-card text-card-foreground shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl font-semibold">Topic: {topic}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-medium mb-2">Pros (up to 5)</h3>
                {pros.map((pro, index) => (
                  <Textarea
                    key={`pro-${index}`}
                    value={pro}
                    onChange={(e) => updateArgument("pros", index, e.target.value)}
                    placeholder={`Pro ${index + 1}`}
                    className="mb-2 bg-input text-foreground border-border min-h-[80px]"
                  />
                ))}
                {pros.length < 5 && (
                  <Button onClick={() => addArgument("pros")} className="mt-2">
                    Add Pro
                  </Button>
                )}
              </div>
              <div>
                <h3 className="text-lg font-medium mb-2">Cons (up to 5)</h3>
                {cons.map((con, index) => (
                  <Textarea
                    key={`con-${index}`}
                    value={con}
                    onChange={(e) => updateArgument("cons", index, e.target.value)}
                    placeholder={`Con ${index + 1}`}
                    className="mb-2 bg-input text-foreground border-border min-h-[80px]"
                  />
                ))}
                {cons.length < 5 && (
                  <Button onClick={() => addArgument("cons")} className="mt-2">
                    Add Con
                  </Button>
                )}
              </div>
            </div>
            <Button
              onClick={handleSubmit}
              disabled={isLoading}
              className="w-full mt-4 bg-primary hover:bg-primary/90"
            >
              {isLoading ? "Submitting..." : "Submit Arguments"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Display Feedback */}
      {evaluation && currentStep === 3 && (
        <Card className="max-w-3xl mx-auto bg-card text-card-foreground shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-center">Your Evaluation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center mb-6">
              <h2 className="text-3xl font-bold text-primary">Final Score: {evaluation.score}</h2>
              <p className="text-muted-foreground">Out of {10 * (evaluation.pros.length + evaluation.cons.length)}</p>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold mb-2 text-primary">Pros</h3>
                {evaluation.pros.map((pro, idx) => (
                  <Card key={idx} className="mb-4 bg-muted p-4 rounded-lg">
                    <p className="font-semibold">Pro {idx + 1}: Score {pro.score}/10</p>
                    <p><strong>Feedback:</strong> {pro.feedback}</p>
                    <p><strong>Counterargument:</strong> {pro.counter}</p>
                  </Card>
                ))}
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2 text-primary">Cons</h3>
                {evaluation.cons.map((con, idx) => (
                  <Card key={idx} className="mb-4 bg-muted p-4 rounded-lg">
                    <p className="font-semibold">Con {idx + 1}: Score {con.score}/10</p>
                    <p><strong>Feedback:</strong> {con.feedback}</p>
                    <p><strong>Counterargument:</strong> {con.counter}</p>
                  </Card>
                ))}
              </div>
            </div>
            <Button onClick={resetChallenge} className="w-full mt-6 bg-destructive hover:bg-destructive/90">
              Try Another Challenge
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ProsConsChallenge;
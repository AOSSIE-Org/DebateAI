package main

import (
	"arguehub/config"
	"arguehub/services"
)

func main() {
	cfg, err := config.LoadConfig("./config/config.prod.yml")
	if err != nil {
		panic("failed to load config: " + err.Error())
	}

	services.InitDebateVsBotService(cfg)

	sample := map[string]string{
		"openingFor":           "Good evening. I firmly support the motion and will outline three reasons.",
		"openingAgainst":       "I disagree with the motion and will demonstrate why it fails real-world tests.",
		"crossForQuestion":     "Could you clarify how your plan addresses the second-order consequences?",
		"crossAgainstAnswer":   "Certainly. The negative impacts you highlight are mitigated by phased adoption.",
		"crossAgainstQuestion": "What evidence do you have that your proposal scales nationwide?",
		"crossForAnswer":       "We have data from three pilot programs that show 30 percent efficiency gains.",
		"closingFor":           "In summary, the motion stands: it is practical, evidence-backed, and humane.",
		"closingAgainst":       "In closing, the proposal ignores key risks. The safer choice is to reject it.",
	}

	services.JudgeDebateHumanVsHuman(sample)
}

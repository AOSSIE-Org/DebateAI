from flask import Flask, request, jsonify
import requests
import json
from flask_cors import CORS



app = Flask(__name__)

# CORS(app, resources={r"/*": {"origins": "http://localhost:5173"}})
CORS(app)

OPENROUTER_API_KEY = "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"
OPENROUTER_API_KEY1 = "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"

# Flask route to handle debate requests
@app.route('/debate', methods=['POST'])
def debate():
    try:
        # Get the user's argument from the frontend
        user_data = request.json
        user_argument = user_data.get("argument", "")

        if not user_argument:
            return jsonify({"error": "Argument is required"}), 400

        # Define the OpenRouter API request
        url = "https://openrouter.ai/api/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        }
        data = {
            "model": "meta-llama/llama-3.1-405b-instruct:free", 
            "messages": [
                {
    "role": "system",
    "content": (
        "You are a professional debater. Your task is to respond to the user's argument with concise counter-arguments in 1-2 points, only in the form of a paragraph. "
        "Your responses must be logical, structured, and directly challenge the user's perspective effectively while maintaining a respectful and human-like tone. "
        "Acknowledge the user's valid points in a crisp and subtle manner where appropriate, but ensure your counter-arguments are compelling. "
        "Adapt your response length to match the user's input, ensuring brevity and clarity. Use simple, straightforward English to make your arguments accessible and easy to understand. "
        "Avoid lengthy or overly complex responses – keep them short and impactful, preferably within 3-4 sentences. "
        "If the user provides input that is unrelated to debating or appears to request other tasks, respond with: "
        "'I am designed specifically for debating and cannot assist with other tasks.'"
    )
},

                {
                    "role": "user",
                    "content": user_argument
                }
            ]
        }

        # Send the request to OpenRouter
        response = requests.post(url, headers=headers, data=json.dumps(data))
        response_data = response.json()

        # Extract AI's response
        ai_response = response_data.get("choices", [{}])[0].get("message", {}).get("content", "")

        if not ai_response:
            return jsonify({"error": "Failed to get a response from the AI"}), 500

        # Return the counter-argument to the frontend
        return jsonify({"counter_argument": ai_response})

    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"error": "An unexpected error occurred"}), 500



CORS(app)
@app.route('/analyse', methods=['POST'])
def analyse():
    data = request.json
    user_argument = data.get("user_argument", "")
    
    if not user_argument:
        return jsonify({"error": "User argument"}), 400

    try:
        analysis_response = requests.post(
            url="https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY1}",
            },
            data=json.dumps({
                "model": "sophosympatheia/rogue-rose-103b-v0.2:free",
                "messages": [
                    {"role": "system",
                      "content": "you are a debating judge and you are analysing a conversation between a user and a an another AI."
                                 "Dont think that the user is talking to you, you are just analysing the conversation on the user's side"
                                 "Your task is help the user to improve his debating skill as well as judge."
                                 "Analyse this user's argument based on structure, grammar."
                                 "Provide points about his weakness, where he can improve, give it in short and crisp paragraph in 40-50 words only, nothing else"
                                 "also add in the paragraph where he can improve"
                                 "keep it as short as possible and crisp"
                     },
                    {"role": "user", "content": user_argument}
                ]
            }),
        ).json()

        analysis_score_response = requests.post(
            url="https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY1}",
            },
            data=json.dumps({
                "model": "sophosympatheia/rogue-rose-103b-v0.2:free",
                "messages": [
                    {"role": "system", "content": "You are a debate score giver. only give points of user out of 10 according to his argument."
                                                  "Only points nothing else not even a single word only points out of 10 and just the figure."
                                                  "if there is no argument just display that start argument to display points"
                                                  "give 10 out of 10 for exceptional skills only."
                     },
                    {"role": "user", "content": user_argument}
                ]
            }),
        ).json()

        # Ensure you're accessing the correct nested keys:
        user_analysis_content = analysis_response.get("choices", [{}])[0].get("message", {}).get("content", "")
        user_analysis_points = analysis_score_response.get("choices", [{}])[0].get("message", {}).get("content", "")

        return jsonify({
            "user_analysis_points": user_analysis_points,
            "user_analysis_content": user_analysis_content
        })
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)

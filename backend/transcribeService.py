# Python server code (FastAPI)
from fastapi import FastAPI
import whisper
import json
import ssl

# Workaround for SSL certificate verify failed error
ssl._create_default_https_context = ssl._create_unverified_context

# Initialize the FastAPI app
app = FastAPI()

# Load Whisper model
model = whisper.load_model("base")

@app.post("/transcribe/batch")
async def batch_transcription(file_path: str):
    """
    Endpoint to transcribe a batch audio file specified by its file path.
    """
    try:
        # Transcribe the audio file
        transcription = model.transcribe(file_path, language="en")['text']
        return {"transcription": transcription}
    except Exception as e:
        return {"error": str(e)}

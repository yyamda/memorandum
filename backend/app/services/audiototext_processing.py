from collections import deque
from concurrent.futures import ThreadPoolExecutor
from openai import OpenAI
import tempfile
import time 
import os 
import threading
import whisper
from pyannote.audio import Pipeline
from services.text_store_pipeline import core_pipeline
from dotenv import load_dotenv
from pydub import AudioSegment
import subprocess
from io import BytesIO
from typing import List, Optional
load_dotenv()

# === Text and Audio Parameters ===
BUFFER_DURATION_SECONDS = 20 # buffer chunk length
CHUNK_DURATION_MS = 250 # each chunk length
MAX_TEXT_SEGMENTS = 2 # each text chunk length 

# === Global Variables === 
AUDIO_BUFFER = deque()
TEXT_SEGMENT_BUFFER = [] 
START_TIME = None

# === Audio Models === 
client = OpenAI(
    api_key=os.getenv("OPEN_AI_WHISPER_KEY")
)
# pipeline = Pipeline.from_pretrained(
#     # "/Users/yyamada/documents/cs_projects/2025/lahacks/matrix-v1/backend/app/audio_models/pyannote/speaker-diarization",  # <-- your local path here
#     "pyannote/speaker-diarization",  # <-- your local path here
#     use_auth_token=os.getenv("HUGGING_FACE_READ_KEY"),
#     # use_auth_token=None
# )

def buffer_audio_chunk(binary_chunk, friend_id: str):
    """ add a new chunk to the audio buffer and process when enough is stored"""
    print("Buffer Audio Called: ")
    wav_bytes = convert_webm_to_wav(binary_chunk)
    # run thread to start model usage
    threading.Thread(
        target=process_audio_to_text, 
        args=(wav_bytes, friend_id), 
        daemon=True
    ).start()

def process_audio_to_text(wav_bytes, friend_id: str):
    """ Run transcirption (whisper) and diarization (pyannote) and store combined result"""
    try: 
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=True) as temp_wav_file:
            temp_wav_file.write(wav_bytes)
            temp_wav_file.flush()

            print(f"📝 Temp file created at: {temp_wav_file.name}")


            start = time.time()

            # --- Run OpenAI Whisper + Pyannote in parallel ---
            def run_whisper_api():
                print("🎤 Starting Whisper API call...")
                with open(temp_wav_file.name, "rb") as audio_file:
                    transcription = client.audio.transcriptions.create(
                        model="gpt-4o-transcribe",
                        file=audio_file
                    )
                return transcription.text
        
            # def run_pyannote():
            #     print("🧠 Starting Pyannote pipeline...")
            #     diarization = pipeline(temp_path, min_speakers=2, max_speakers=3)
            #     return diarization

            transcription_text = run_whisper_api()


            end = time.time()
            print("🎤 Whisper Result:", transcription_text)
            print(f"✅ Audio model processing finished in {end - start:.2f}s")

        # append result to text buffer
        TEXT_SEGMENT_BUFFER.append(transcription_text)


        # If text hit limit, send to pipeline
        if sum(len(segment) for segment in TEXT_SEGMENT_BUFFER) >= 100:
            full_text = "\n\n".join(TEXT_SEGMENT_BUFFER)
            print("TEXT BUFFER EXCEEDED: ", full_text)

            core_pipeline(full_text, friend_id)
            TEXT_SEGMENT_BUFFER.clear()
    except Exception as e:
        print(f"[Processing Error] {e}")

def convert_webm_to_wav(chunk) -> bytes:
    """Convert a webm binary chunk into WAV bytes, with debug prints and safe resource handling."""
    temp_webm_path = None
    temp_wav_path = None

    try:
        # 1. Save the received audio chunk into a temp webm file
        with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as temp_webm:
            temp_webm.write(chunk)
            temp_webm_path = temp_webm.name

        print(f"📝 Written temporary WebM file: {temp_webm_path}")

        # 2. Prepare output WAV file path
        temp_wav_path = temp_webm_path.replace('.webm', '.wav')
        print(f"🎯 Target WAV path: {temp_wav_path}")

        # 3. Convert WebM to WAV using ffmpeg
        command = [
            'ffmpeg',
            '-y',                     # overwrite output if exists
            '-i', temp_webm_path,      # input file
            '-ar', '16000',            # resample audio to 16 kHz
            '-ac', '1',                # set audio to mono
            temp_wav_path
        ]
        print(f"🛠️ Running ffmpeg command: {' '.join(command)}")
        subprocess.run(command, check=True)
        print(f"✅ FFmpeg conversion successful: {temp_wav_path}")

        # 4. Read WAV file fully into memory
        with open(temp_wav_path, 'rb') as wav_file:
            wav_bytes = wav_file.read()

        print(f"📦 WAV file read into memory, size: {len(wav_bytes)} bytes")
        return wav_bytes

    except subprocess.CalledProcessError as e:
        print(f"❌ FFmpeg failed with error: {e}")
        raise e

    finally:
        # 5. Cleanup temp files (after all reads are completed)
        if temp_webm_path and os.path.exists(temp_webm_path):
            os.remove(temp_webm_path)
            print(f"🧹 Deleted temporary WebM file: {temp_webm_path}")
        if temp_wav_path and os.path.exists(temp_wav_path):
            os.remove(temp_wav_path)
            print(f"🧹 Deleted temporary WAV file: {temp_wav_path}")



def assemble_speaker_transcript(transcript, diarize_note):
    """Combine Whisper text with PyAnnote speaker turns into readable format."""

    transcript = transcript["text"]
    diarized = []

    for segment, _, speaker in diarize_note.itertracks(yield_label=True):
        diarized.append(f"[{segment.start:.2f}-{segment.end:.2f}] Speaker {speaker}")

    return f"{transcript.strip()}\n" + "\n".join(diarized)



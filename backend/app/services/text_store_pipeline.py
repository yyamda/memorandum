import tempfile
import time 
import os
from groq import Groq
import json
import pinecone
from sentence_transformers import SentenceTransformer
import uuid
from dotenv import load_dotenv
from pinecone import Pinecone

load_dotenv()

groq_client = Groq(api_key=os.getenv("GROQ_KEY"))


pc = Pinecone(
    api_key=os.getenv("PINECONE_KEY"),
    environment="us-east-1-aws"
)

index = pc.Index("memorandum")


def core_pipeline(diarized_transcript: str, friend_id: str):
    print("🎤At core pipeline")
    
    # throw into groq
    conv_json = mold_transcript_for_memory(diarized_transcript)

    # throw into Pinecone
    for conv in conv_json:
        store_to_pinecone(conv, friend_id)

    return

def embed_with_groq_llama(text):
    response = groq_client.embeddings.create(
        model="llama-embed-english-v2",
        input=text
    )
    return response.data[0].embedding 


def mold_transcript_for_memory(raw_transcript: str) -> dict:
    print("🎤 Attempting to call groq to mold transcript \n")
    prompt = f"""You are an AI assistant helping users remember important conversation points.

            Given the following transcription, clean it up and reframe it:
            - Maintain a first-person plural point of view in past tense (eg. "We talked about", "Alan in going to xyz").
            - Extract the important topics or facts that were discussed.
            - Keep the wording factual and avoid adding new information.
            - Write it in a casual memoric manner, focusing on what could be useful to recall in future conversations.

            Then also provide a short one-line memory summary that captures the essence of the conversation.  
            The memory summary should be concise, neutral, and suitable as a quick reminder.

            Respond strictly in this JSON array format:
            [
            {{
                "conversation": "Cleaned version of chunk 1",
                "memory_summary": "One-line memory summary for chunk 1"
            }},
            {{
                "conversation": "Cleaned version of chunk 2",
                "memory_summary": "One-line memory summary for chunk 2"
            }},
            ...
            ]

            TRANSCRIPTION:
            {raw_transcript}
            """

    response = groq_client.chat.completions.create(
        model="llama-3.3-70b-versatile",  
        messages=[
            {
                "role": "user",
                "content": prompt
            }
        ],
        temperature=0.2,  # lower temperature = more factual
        max_tokens=4096
    )
    print("🎤Received returned summary from groq \n")
    print(response.choices[0].message.content)

    return json.loads(response.choices[0].message.content)


def store_to_pinecone(transcript_json, friend_id):
    print("🎤Attempting to store conversation in Pinecone \n")
    # 2. Embed the conversation
    print("Starting embedding")

    embeddings = pc.inference.embed(
        model="multilingual-e5-large",
        inputs=[transcript_json["conversation"]],
        parameters={"input_type": "passage", "truncate": "END"}
    )

    conversation_id = str(uuid.uuid4())
    print("Starting upsert")

    # 4. Upsert into Pinecone
    index.upsert(
        vectors=[
            {
                "id": conversation_id,
                "values": embeddings[0]["values"],
                "metadata": {
                    "friend_id": friend_id,
                    "text": transcript_json["conversation"],
                    "memory_summary": transcript_json["memory_summary"]
                }
            }
        ]
    )

    print(f"✅ Uploaded conversation for friend_id: {friend_id} (conversation_id: {conversation_id})")
    return
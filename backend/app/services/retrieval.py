from pinecone import Pinecone
import os 
from dotenv import load_dotenv

load_dotenv()
pc = Pinecone(
    api_key=os.getenv("PINECONE_KEY"),
    environment="us-east-1-aws"
)
index = pc.Index("memorandum")

def retrieve_memory(query_text, friend_id):

    query_embedding = pc.inference.embed(
        model="multilingual-e5-large",
        inputs=[query_text],
        parameters={"input_type": "query"}
    )
    print("send query now")
    results = index.query(
        mapespace="",
        vector=query_embedding[0].values,
        top_k=10,
        include_values=False,
        include_metadata=True,
        filter={
            "friend_id": {"$eq": friend_id}
        }
    )


    memories = [] 
    for match in results["matches"]:
        memories.append({
            "memory_summary": match["metadata"]["memory_summary"],
            "conversation": match["metadata"]["text"]
        })
    print("called memories: ", memories)
    return memories
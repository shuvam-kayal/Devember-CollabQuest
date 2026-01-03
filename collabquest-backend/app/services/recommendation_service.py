import os
import chromadb
from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_core.documents import Document
from app.models import User, Team

# --- CONFIGURATION ---
CHROMA_PATH = os.path.join(os.getcwd(), "chroma_db_matching")
EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"

embedding_function = HuggingFaceEmbeddings(model_name=EMBEDDING_MODEL)

_global_client = None

def get_chroma_client():
    """
    Returns the single shared instance of the ChromaDB client.
    """
    global _global_client
    if _global_client is None:
        print("🔌 Initializing Global ChromaDB Client...")
        _global_client = chromadb.PersistentClient(path=CHROMA_PATH)
    return _global_client

async def sync_data_to_chroma():
    """
    Reads ALL Users and Teams from MongoDB and saves them into ChromaDB.
    Uses the SINGLETON client to avoid WinError 32 (File Locking).
    """
    print("🔄 Syncing MongoDB to Vector Database...")
    
    docs_to_save = []

    # 1. PROCESS TEAMS
    teams = await Team.find_all().to_list()
    for team in teams:
        content = f"Project: {team.name}. Description: {team.description}. Looking for Skills: {', '.join(team.needed_skills)}."
        doc = Document(
            page_content=content,
            metadata={"type": "team", "id": str(team.id), "name": team.name}
        )
        docs_to_save.append(doc)

    # 2. PROCESS USERS
    users = await User.find_all().to_list()
    for user in users:
        skill_names = [s.name if hasattr(s, 'name') else str(s) for s in user.skills]
        content = f"Developer: {user.username}. Bio: {user.about}. Skills: {', '.join(skill_names)}."
        doc = Document(
            page_content=content,
            metadata={"type": "user", "id": str(user.id), "name": user.username}
        )
        docs_to_save.append(doc)

    # 3. SAVE TO CHROMA (The Fix)
    if docs_to_save:
        # 👇 USE THE SHARED CLIENT (Fixes WinError 32)
        client = get_chroma_client()
        
        # Clean specific collection instead of deleting the whole folder
        try:
            client.delete_collection("sc_portfolio") 
        except Exception:
            pass # Collection might not exist yet, which is fine
            
        # Initialize LangChain wrapper using the SHARED client
        db = Chroma(
            client=client,
            collection_name="sc_portfolio",
            embedding_function=embedding_function
        )
        
        # Add the new documents
        db.add_documents(docs_to_save)
        
        print(f"✅ Synced {len(docs_to_save)} profiles to the AI Matcher.")
    else:
        print("⚠️ No data to sync.")
# 🔥 FIX: Removed 'async' to allow usage with asyncio.to_thread

def search_vectors(query: str, filter_type: str = None):
    """
    Searches ChromaDB for matches using the shared client.
    filter_type: "team" (find projects) or "user" (find developers)
    """
    # 👇 USE THE SHARED CLIENT (Fixes WinError 32)
    client = get_chroma_client()
    
    # Initialize LangChain wrapper using the SHARED client
    # We point to the same "sc_portfolio" collection used in sync_data_to_chroma
    db = Chroma(
        client=client,
        collection_name="sc_portfolio",
        embedding_function=embedding_function
    )
    
    # Search for top 5 matches
    results = db.similarity_search(query, k=5)
    
    matches = []
    for doc in results:
        # Apply filter (if I only want Teams, ignore Users)
        if filter_type and doc.metadata.get("type") != filter_type:
            continue
            
        matches.append(doc.page_content)
        
    return matches
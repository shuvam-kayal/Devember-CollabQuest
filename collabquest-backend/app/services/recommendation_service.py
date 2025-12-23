import os
from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_core.documents import Document
from app.models import User, Team

# --- CONFIGURATION ---
CHROMA_PATH = "chroma_db_matching" 
EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"

embedding_function = HuggingFaceEmbeddings(model_name=EMBEDDING_MODEL)

async def sync_data_to_chroma():
    """
    Reads ALL Users and Teams from MongoDB and saves them into ChromaDB.
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

    # 3. SAVE TO CHROMA
    if docs_to_save:
        if os.path.exists(CHROMA_PATH):
             import shutil
             shutil.rmtree(CHROMA_PATH)
             
        Chroma.from_documents(
            documents=docs_to_save, 
            embedding=embedding_function, 
            persist_directory=CHROMA_PATH
        )
        print(f"✅ Synced {len(docs_to_save)} profiles to the AI Matcher.")
    else:
        print("⚠️ No data to sync.")

# 🔥 UPDATE: Made this 'async' to help the chatbot
async def search_vectors(query: str, filter_type: str = None):
    """
    Searches ChromaDB for matches.
    filter_type: "team" (find projects) or "user" (find developers)
    """
    if not os.path.exists(CHROMA_PATH):
        # If DB doesn't exist, try syncing first!
        await sync_data_to_chroma()
        if not os.path.exists(CHROMA_PATH):
            return []

    db = Chroma(persist_directory=CHROMA_PATH, embedding_function=embedding_function)
    
    # Search for top 5 matches (Increased from 3 to give AI more options)
    results = db.similarity_search(query, k=5)
    
    matches = []
    for doc in results:
        # Apply filter (if I only want Teams, ignore Users)
        if filter_type and doc.metadata.get("type") != filter_type:
            continue
            
        matches.append(doc.page_content)
        
    return matches
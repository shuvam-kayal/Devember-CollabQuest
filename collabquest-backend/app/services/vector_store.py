from sentence_transformers import SentenceTransformer
import numpy as np

# Load model once (Singleton pattern)
# This will download ~80MB on the first run automatically
print("🧠 Loading Embedding Model...")
model = SentenceTransformer('all-MiniLM-L6-v2')
print("✅ Embedding Model Loaded")

def generate_embedding(text: str) -> list[float]:
    """Converts text into a 384-dimensional vector"""
    if not text or not text.strip():
        return [0.0] * 384
    
    # Generate embedding
    embedding = model.encode(text)
    return embedding.tolist()

def calculate_similarity(vec1: list[float], vec2: list[float]) -> float:
    """Calculates Cosine Similarity between two vectors (0 to 1)"""
    if not vec1 or not vec2: return 0.0
    
    v1 = np.array(vec1)
    v2 = np.array(vec2)
    
    norm1 = np.linalg.norm(v1)
    norm2 = np.linalg.norm(v2)
    
    if norm1 == 0 or norm2 == 0: return 0.0
    
    # Dot product divided by magnitudes
    score = np.dot(v1, v2) / (norm1 * norm2)
    
    # Return as 0.0 - 1.0
    return float(score)
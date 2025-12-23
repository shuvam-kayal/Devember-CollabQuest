// services/aiChat.ts

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/**
 * Sends a message to the new AI Chatbot endpoint.
 */
export async function askAI(message: string, token: string) {
  try {
    // CHANGED: Endpoint is now /chat/ai/ask (defined in chatbot_routes)
    const res = await fetch(`${API_URL}/chat/ai/ask`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`, 
      },
      // CHANGED: The backend service expects "question", not "message"
      body: JSON.stringify({ question: message }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.detail || "AI Request Failed");
    }

    // Expected response: { "answer": "..." } or { "response": "..." }
    // passing the whole JSON back to the component is safest
    return res.json();

  } catch (error) {
    console.error("❌ AI Service Error:", error);
    throw error;
  }
}

/**
 * Fetches chat history.
 */
export async function getAIHistory(token: string) {
  // This URL looks correct based on main.py prefix "/chat/ai"
  const res = await fetch(`${API_URL}/chat/ai/history`, {
    headers: {
      "Authorization": `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error("Failed to fetch AI history");
  }

  return res.json();
}
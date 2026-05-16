import google.generativeai as genai
import os
import json
from typing import List, Optional
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# Configure Gemini
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)


SYSTEM_PROMPT = """You are HelpBot, an expert AI assistant for a professional help desk platform. 
You specialize in answering technical and conceptual questions with accuracy and clarity.

Your knowledge covers:
- Python programming (syntax, libraries, best practices, frameworks)
- Software development concepts and design patterns
- Data structures and algorithms
- Web development (React, FastAPI, REST APIs)
- Database management (PostgreSQL, SQL)
- DevOps and deployment practices
- General programming and computer science concepts

When answering:
1. Be concise but thorough
2. Use code examples when relevant (format with proper markdown code blocks)
3. Reference reliable sources when applicable
4. Structure complex answers with clear sections
5. If you're unsure, say so rather than guessing
6. Be professional and helpful at all times

Format your responses in clean markdown for best readability."""


class GeminiService:
    def __init__(self):
        self.model = None
        self._init_model()

    def _init_model(self):
        try:
            if GEMINI_API_KEY:
                self.model = genai.GenerativeModel(
                    model_name="gemini-2.5-flash",
                    generation_config={
                        "temperature": 0.7,
                        "top_p": 0.95,
                        "top_k": 40,
                        "max_output_tokens": 2048,
                    },
                    system_instruction=SYSTEM_PROMPT
                )
                print("✅ Gemini model initialized")
            else:
                print("⚠️  No Gemini API key found - using fallback responses")
        except Exception as e:
            print(f"❌ Error initializing Gemini: {e}")

    async def get_response(
        self,
        query: str,
        conversation_history: Optional[List[dict]] = None
    ) -> dict:
        """
        Get AI response for a user query.
        Returns dict with 'answer' and 'sources' keys.
        """
        if not self.model:
            return {
                "answer": self._fallback_response(query),
                "sources": ["Built-in knowledge base"]
            }

        try:
            # Build conversation history for context
            chat_history = []
            if conversation_history:
                for msg in conversation_history[-10:]:  # Last 10 messages for context
                    role = "user" if msg["role"] == "user" else "model"
                    chat_history.append({
                        "role": role,
                        "parts": [msg["content"]]
                    })

            # Start chat with history
            chat = self.model.start_chat(history=chat_history)
            
            # Add reference context to the query
            enhanced_query = self._enhance_query(query)
            
            response = chat.send_message(enhanced_query)
            answer = response.text

            # Determine sources based on query content
            sources = self._determine_sources(query)

            return {
                "answer": answer,
                "sources": sources
            }

        except Exception as e:
            print(f"Gemini error: {e}")
            return {
                "answer": f"I encountered an error processing your request. Please try again.\n\nError details: {str(e)}",
                "sources": []
            }

    def _enhance_query(self, query: str) -> str:
        """Add context to help Gemini give better answers."""
        return f"""{query}

Please provide a comprehensive answer with:
- Clear explanation
- Code examples if relevant (in proper markdown code blocks)
- References to Python documentation, official docs, or best practices where applicable
- Any important caveats or edge cases"""

    def _determine_sources(self, query: str) -> List[str]:
        """Determine relevant sources based on query keywords."""
        sources = []
        query_lower = query.lower()

        source_map = {
            ("python", "pip", "import", "def ", "class ", "function", "list", "dict", "tuple"):
                "Python Official Documentation (docs.python.org)",
            ("react", "jsx", "component", "hook", "useState", "useEffect"):
                "React Documentation (react.dev)",
            ("sql", "postgres", "database", "query", "select", "insert"):
                "PostgreSQL Documentation (postgresql.org/docs)",
            ("fastapi", "api", "endpoint", "route", "pydantic"):
                "FastAPI Documentation (fastapi.tiangolo.com)",
            ("algorithm", "data structure", "complexity", "sorting", "searching"):
                "Introduction to Algorithms - CLRS",
            ("git", "github", "version control", "commit", "branch"):
                "Git Documentation (git-scm.com/doc)",
            ("docker", "container", "kubernetes", "deployment"):
                "Docker Documentation (docs.docker.com)",
            ("machine learning", "ml", "ai", "neural", "model", "training"):
                "Scikit-learn Documentation & Papers",
        }

        for keywords, source in source_map.items():
            if any(kw in query_lower for kw in keywords):
                sources.append(source)

        if not sources:
            sources = ["Gemini AI Knowledge Base", "General Programming Best Practices"]

        return sources[:3]  # Max 3 sources

    def _fallback_response(self, query: str) -> str:
        """Fallback when API key is not configured."""
        return f"""I'm currently running in demo mode (no API key configured).

**Your question:** {query}

To get real AI-powered answers:
1. Get a free Gemini API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Add it to your `.env` file as `GEMINI_API_KEY=your-key-here`
3. Restart the backend server

**Demo Answer:**
This helpdesk platform is designed to answer questions about Python, web development, databases, algorithms, and general programming topics using Google's Gemini AI with access to documentation and best practices."""


gemini_service = GeminiService()

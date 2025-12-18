from js import Response, Headers, URL
import json
import re

# --- In-memory store for uploaded documents (per Worker instance) ---
# NOTE: This is NOT persistent storage, but is enough to make your app work
# reliably during a session without depending on Workers AI / Vectorize.
DOCUMENTS = []  # each item: {"filename": str, "text": str}


# --- Helper: Standard JSON Response with CORS ---
def json_response(data, status=200):
    headers = Headers.new()
    headers.set("content-type", "application/json")
    headers.set("Access-Control-Allow-Origin", "*")
    headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    headers.set("Access-Control-Allow-Headers", "Content-Type")
    
    return Response.new(
        json.dumps(data),
        status=status,
        headers=headers
    )


# --- Naive text summarization helpers (no external AI) ---
def simple_snippet(text: str, max_chars: int = 1500) -> str:
    """Return the first reasonable snippet of text up to max_chars."""
    t = text.strip()
    if len(t) <= max_chars:
        return t
    return t[:max_chars] + "\n\n[Truncated: document is longer.]"


def keyword_snippet(text: str, query: str, max_chars: int = 1500) -> str:
    """
    Very simple keyword-based snippet:
    - Split into paragraphs.
    - Keep ones that contain any query word.
    - Fallback to simple_snippet if nothing matches.
    """
    if not text:
        return ""

    query_words = [w.lower() for w in re.findall(r"\w+", query)]
    if not query_words:
        return simple_snippet(text, max_chars)

    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    matched = []
    for p in paragraphs:
        low = p.lower()
        if any(w in low for w in query_words):
            matched.append(p)

    if not matched:
        return simple_snippet(text, max_chars)

    joined = "\n\n---\n\n".join(matched)
    if len(joined) <= max_chars:
        return joined
    return joined[:max_chars] + "\n\n[Truncated: document is longer.]"

async def on_fetch(request, env):
    try:
        # Handle preflight CORS check
        if request.method == "OPTIONS":
            headers = Headers.new()
            headers.set("Access-Control-Allow-Origin", "*")
            headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            headers.set("Access-Control-Allow-Headers", "Content-Type")
            return Response.new("", status=204, headers=headers)

        url = URL.new(request.url)
        pathname = str(url.pathname) if url.pathname else "/"
        
        # Health check endpoint
        if request.method == "GET" and pathname == "/health":
            return json_response({"status": "ok", "message": "Backend is online"})
        
        if request.method == "POST" and pathname == "/api/upload":
            return await handle_upload(request, env)
        
        if request.method == "POST" and pathname == "/api/chat":
            return await handle_chat(request, env)

        # Default response with CORS
        headers = Headers.new()
        headers.set("Access-Control-Allow-Origin", "*")
        return Response.new("Empire RAG Backend Online", status=200, headers=headers)

    except Exception as e:
        error_msg = f"Error: {str(e)}"
        headers = Headers.new()
        headers.set("Access-Control-Allow-Origin", "*")
        headers.set("content-type", "text/plain")
        return Response.new(error_msg, status=500, headers=headers)

async def handle_upload(request, env):
    try:
        body_text = await request.text()
        body = json.loads(body_text)
        
        filename = body.get("filename")
        text = body.get("text")
        
        if not filename or not text:
            return json_response({"error": "Missing filename or text in request body"}, 400)

        # Store raw document in in-memory list
        DOCUMENTS.append({"filename": filename, "text": text})
        print(f"Stored document '{filename}' in memory. Total docs: {len(DOCUMENTS)}")

        # We no longer depend on Workers AI or Vectorize here.
        return json_response(
            {
                "status": "success",
                "message": f"Document '{filename}' stored in memory for Q&A.",
                "docs_in_memory": len(DOCUMENTS),
            }
        )

    except Exception as e:
        print(f"Upload Critical Error: {e}")
        return json_response({"error": str(e)}, 500)

async def handle_chat(request, env):
    try:
        body_text = await request.text()
        body = json.loads(body_text)
        
        query = body.get("query")
        
        if not query:
            return json_response({"error": "Query cannot be empty"}, 400)

        # --- Pure Python Q&A over in-memory documents (no Workers AI, no Vectorize) ---
        if not DOCUMENTS:
            return json_response(
                {
                    "answer": "I don't have any documents loaded yet. Please upload a file first.",
                    "sources": [],
                }
            )

        # Build a simple keyword-based snippet across all docs
        snippets = []
        sources = []
        for doc in DOCUMENTS:
            snippet = keyword_snippet(doc["text"], query, max_chars=800)
            if snippet:
                snippets.append(f"From {doc['filename']}:\n{snippet}")
                sources.append(doc["filename"])

        if not snippets:
            answer = "I couldn't find anything in your uploaded documents related to that question."
        else:
            combined = "\n\n====================\n\n".join(snippets)
            max_chars = 1500
            answer = combined[:max_chars]
            if len(combined) > max_chars:
                answer += "\n\n[Truncated output; ask more specific questions for details.]"

        return json_response({"answer": answer, "sources": list(set(sources))})

    except Exception as e:
        print(f"Chat Error: {e}")
        return json_response({"error": str(e)}, 500)
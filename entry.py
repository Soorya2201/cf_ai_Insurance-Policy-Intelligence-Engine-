from js import Response, Headers, URL
import json

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

# --- Helper: Chunk Text ---
def split_text(text, chunk_size=800):
    return [text[i:i+chunk_size] for i in range(0, len(text), chunk_size)]

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
        
        chunks = split_text(text)
        print(f"Processing {filename}: Split into {len(chunks)} chunks.")

        vectors = []
        
        for i in range(0, len(chunks), 5):
            batch_chunks = chunks[i:i+5]
            
            try:
                embedding_resp = await env.AI.run(
                    "@cf/baai/bge-base-en-v1.5",
                    {"text": batch_chunks}
                )
                
                for j, vector_data in enumerate(embedding_resp.data):
                    chunk_index = i + j
                    chunk_text = batch_chunks[j]
                    
                    vectors.append({
                        "id": f"{filename}_chunk_{chunk_index}",
                        "values": list(vector_data),
                        "metadata": {
                            "text": chunk_text,
                            "filename": filename,
                            "chunk_id": str(chunk_index)
                        }
                    })
            except Exception as e:
                print(f"Error embedding batch {i}: {e}")

        if len(vectors) > 0:
            await env.VECTORIZE.upsert(vectors)

        return json_response({"status": "success", "chunks_processed": len(vectors)})

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
        
        # Get embedding for query
        query_embedding_resp = await env.AI.run("@cf/baai/bge-base-en-v1.5", {"text": [query]})
        
        # Extract vector - handle different response formats
        query_vector = None
        if hasattr(query_embedding_resp, 'data') and len(query_embedding_resp.data) > 0:
            query_vector = list(query_embedding_resp.data[0])
        elif hasattr(query_embedding_resp, 'shape') and hasattr(query_embedding_resp, 'tolist'):
            query_vector = query_embedding_resp.tolist()
        elif isinstance(query_embedding_resp, list):
            query_vector = list(query_embedding_resp[0]) if len(query_embedding_resp) > 0 else []
        else:
            raise Exception(f"Unexpected embedding response format: {type(query_embedding_resp)}")

        matches = await env.VECTORIZE.query(query_vector, topK=5, returnMetadata=True)
        
        context_texts = []
        sources = []
        for match in matches.matches:
            if hasattr(match, 'metadata') and match.metadata:
                context_texts.append(str(match.metadata.text))
                sources.append(str(match.metadata.filename))
        
        # Build prompt with context - Python Workers AI expects 'text' or 'requests' format
        context_str = '\n\n'.join(context_texts) if context_texts else "No relevant context found."
        
        # Format as a single text prompt (llama-3-8b-instruct format)
        full_prompt = f"""<|system|>
You are a helpful assistant that answers questions based on the provided context. If the answer cannot be found in the context, say so clearly.

Context:
{context_str}
<|user|>
{query}
<|assistant|>
"""

        # Use 'text' format as required by Python Workers AI binding
        llama_resp = await env.AI.run(
            "@cf/meta/llama-3-8b-instruct",
            {"text": full_prompt}
        )

        # Extract response
        answer = ""
        if hasattr(llama_resp, 'response'):
            answer = str(llama_resp.response)
        elif hasattr(llama_resp, 'text'):
            answer = str(llama_resp.text)
        elif isinstance(llama_resp, dict):
            answer = str(llama_resp.get('response', llama_resp.get('text', str(llama_resp))))
        elif isinstance(llama_resp, str):
            answer = llama_resp
        else:
            answer = str(llama_resp)

        return json_response({
            "answer": answer,
            "sources": list(set(sources))
        })

    except Exception as e:
        print(f"Chat Error: {e}")
        return json_response({"error": str(e)}, 500)
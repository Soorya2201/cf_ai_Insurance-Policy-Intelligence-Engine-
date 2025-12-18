import React, { useState, useRef, useEffect } from 'react';
import { Upload, Send, FileText, Cpu, Terminal, Database, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker - use local worker file
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

// ✅ Backend URL - Use production Cloudflare Workers URL
const BACKEND_URL = "https://empire-rag-backend.soorya220104.workers.dev"; 

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: string[];
}

interface DocFile {
  name: string;
  status: 'pending' | 'uploading' | 'indexed' | 'error';
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Empire RAG Systems online. Upload your documents to initialize knowledge base.' }
  ]);
  const [input, setInput] = useState('');
  const [files, setFiles] = useState<DocFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // ✅ I defaulted this to FALSE so it connects to your real backend immediately
  const [isDemoMode, setIsDemoMode] = useState(false); 
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Test backend connection on mount
  useEffect(() => {
    const testBackendConnection = async () => {
      try {
        console.log("Testing backend connection to:", BACKEND_URL);
        const res = await fetch(`${BACKEND_URL}/health`, {
          method: 'GET',
        });
        if (res.ok) {
          const data = await res.json();
          console.log("✅ Backend connection successful:", data);
        } else {
          console.warn("⚠️ Backend responded with status:", res.status);
        }
      } catch (err) {
        console.error("❌ Backend connection failed:", err);
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `Warning: Cannot connect to backend at ${BACKEND_URL}. Please ensure the backend is deployed. Error: ${err instanceof Error ? err.message : 'Unknown error'}`
        }]);
      }
    };
    
    if (!isDemoMode) {
      testBackendConnection();
    }
  }, [isDemoMode]);

  // Check backend connectivity before upload
  const checkBackendConnection = async (): Promise<boolean> => {
    try {
      const res = await fetch(`${BACKEND_URL}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });
      return res.ok;
    } catch (err) {
      console.error("Backend connection check failed:", err);
      return false;
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).map(f => ({ name: f.name, status: 'pending' as const, file: f }));
      setFiles(prev => [...prev, ...newFiles.map(f => ({ name: f.name, status: 'pending' as const }))]);

      // Check backend connection first
      if (!isDemoMode) {
        const isBackendOnline = await checkBackendConnection();
        if (!isBackendOnline) {
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: `⚠️ Cannot connect to backend at ${BACKEND_URL}. Please ensure the backend is deployed. Run: npx wrangler deploy`
          }]);
          newFiles.forEach(fileObj => updateFileStatus(fileObj.name, 'error'));
          return;
        }
      }

      for (let i = 0; i < newFiles.length; i++) {
        const fileObj = newFiles[i];
        updateFileStatus(fileObj.name, 'uploading');

        try {
          // Extract text based on file type
          let text: string;
          const fileName = fileObj.file.name.toLowerCase();
          
          if (fileName.endsWith('.pdf')) {
            text = await readPDFFile(fileObj.file);
          } else {
            text = await readFileAsText(fileObj.file);
          }
          
          // Validate that we got text
          if (!text || text.length === 0) {
            throw new Error("File appears to be empty");
          }
          
          // Check file size (warn if too large)
          if (text.length > 5000000) { // ~5MB text limit
            console.warn(`File ${fileObj.name} is large (${(text.length / 1024 / 1024).toFixed(2)}MB). Consider splitting it.`);
          }
          
          if (!isDemoMode) {
            console.log("Uploading to:", `${BACKEND_URL}/api/upload`);
            console.log(`File: ${fileObj.name}, Size: ${text.length} characters`);
            
            // Create the JSON payload
            const payload = JSON.stringify({ filename: fileObj.name, text: text });
            console.log(`Payload size: ${payload.length} bytes`);
            
            let res;
            try {
              res = await fetch(`${BACKEND_URL}/api/upload`, {
                method: 'POST',
                body: payload,
                headers: { 'Content-Type': 'application/json; charset=utf-8' }
              });
            } catch (fetchError) {
              console.error("Network error:", fetchError);
              throw new Error(`Network error: ${fetchError instanceof Error ? fetchError.message : 'Failed to connect to server'}. Please check if the backend is deployed and accessible.`);
            }
            
            let errorMessage = "Upload failed";
            if (!res.ok) {
              try {
                const errorText = await res.text();
                console.error("Error response:", errorText);
                try {
                  const errorData = JSON.parse(errorText);
                  errorMessage = errorData.error || errorData.message || `Server error: ${res.status}`;
                } catch {
                  errorMessage = errorText || `Server error: ${res.status} ${res.statusText}`;
                }
              } catch (parseErr) {
                errorMessage = `Upload failed with status ${res.status} ${res.statusText}`;
              }
              console.error("Upload error:", errorMessage);
              throw new Error(errorMessage);
            }
            
            const data = await res.json();
            console.log("Upload success:", data);
            updateFileStatus(fileObj.name, 'indexed');
            
            // Show success message
            setMessages(prev => [...prev, {
              role: 'assistant',
              content: `Successfully indexed "${fileObj.name}". You can now ask questions about this document.`
            }]);
          } else {
            await new Promise(resolve => setTimeout(resolve, 1500));
            updateFileStatus(fileObj.name, 'indexed');
          }
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          console.error("Upload error:", errorMsg);
          updateFileStatus(fileObj.name, 'error');
          
          // Show error message to user
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: `Failed to upload "${fileObj.name}": ${errorMsg}. Please check the console for more details.`
          }]);
        }
      }
    }
  };

  const updateFileStatus = (fileName: string, status: DocFile['status']) => {
    setFiles(prev => prev.map(f => f.name === fileName ? { ...f, status } : f));
  };

  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result;
        if (typeof result === 'string') {
          resolve(result);
        } else {
          reject(new Error('Failed to read file as text'));
        }
      };
      reader.onerror = (e) => {
        reject(new Error(`File read error: ${e.target?.error?.message || 'Unknown error'}`));
      };
      // Read as UTF-8 text, which handles most encodings
      reader.readAsText(file, 'UTF-8');
    });
  };

  const readPDFFile = async (file: File): Promise<string> => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      let fullText = '';
      const numPages = pdf.numPages;
      
      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        fullText += pageText + '\n';
      }
      
      if (!fullText.trim()) {
        throw new Error('PDF appears to be empty or contains no extractable text');
      }
      
      return fullText;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to parse PDF: ${errorMsg}`);
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim() || isProcessing) return;

    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsProcessing(true);

    try {
      let responseText = "";
      let sources: string[] = [];

      if (!isDemoMode) {
        console.log("Chatting with:", `${BACKEND_URL}/api/chat`); // Debug log
        const res = await fetch(`${BACKEND_URL}/api/chat`, {
          method: 'POST',
          body: JSON.stringify({ query: userMsg }),
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (!res.ok) {
          let errorMessage = "Failed to get response";
          try {
            const errorData = await res.json();
            errorMessage = errorData.error || errorData.message || `Server error: ${res.status}`;
          } catch {
            errorMessage = `Request failed with status ${res.status}`;
          }
          throw new Error(errorMessage);
        }
        
        const data = await res.json();
        responseText = data.answer || "No answer provided";
        sources = data.sources || [];
      } else {
        await new Promise(resolve => setTimeout(resolve, 2000));
        responseText = `[SIMULATION MODE] Based on the inputs regarding "${userMsg}", the optimal strategy is consistent execution.`;
        sources = ["sim_data.txt"];
      }

      setMessages(prev => [...prev, { role: 'assistant', content: responseText, sources }]);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error occurred";
      console.error("Chat error:", err);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `Error: ${errorMsg}. Please check the console for more details.` 
      }]);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 font-sans overflow-hidden">
      
      {/* Sidebar */}
      <div className="w-80 bg-slate-900 border-r border-slate-800 flex flex-col p-6">
        <div className="flex items-center gap-2 mb-8 text-emerald-400">
          <Database className="w-6 h-6" />
          <h1 className="font-bold tracking-wider text-lg">EMPIRE RAG</h1>
        </div>

        <div className="mb-6">
          <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-700 border-dashed rounded-lg cursor-pointer hover:bg-slate-800 transition-all group">
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <Upload className="w-8 h-8 mb-3 text-slate-500 group-hover:text-emerald-400" />
              <p className="text-sm text-slate-500 group-hover:text-slate-300">Upload Context Docs</p>
            </div>
            <input type="file" className="hidden" multiple onChange={handleFileUpload} />
          </label>
        </div>

        <div className="flex-1 overflow-y-auto pr-2">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Knowledge Base</h2>
          <div className="space-y-3">
            {files.map((file, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-slate-800/50 rounded border border-slate-800">
                <div className="flex items-center gap-3 overflow-hidden">
                  <FileText className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span className="text-sm truncate max-w-[120px]">{file.name}</span>
                </div>
                {file.status === 'uploading' && <Loader2 className="w-4 h-4 animate-spin text-blue-400" />}
                {file.status === 'indexed' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                {file.status === 'error' && <AlertCircle className="w-4 h-4 text-red-500" />}
              </div>
            ))}
          </div>
        </div>
        
        <div className="mt-4 pt-4 border-t border-slate-800 text-xs text-slate-600">
          <div className="flex justify-between items-center mt-2">
             <span>Mode</span>
             <button onClick={() => setIsDemoMode(!isDemoMode)} className="text-blue-400 hover:text-blue-300 font-bold">
               {isDemoMode ? "SIMULATION" : "LIVE CONNECTION"}
             </button>
          </div>
        </div>
      </div>

      {/* Main Chat */}
      <div className="flex-1 flex flex-col relative">
        <div className="h-16 border-b border-slate-800 flex items-center justify-between px-8 bg-slate-900/50 backdrop-blur">
          <div className="flex items-center gap-2 text-slate-400">
            <Terminal className="w-4 h-4" />
            <span className="text-sm font-mono">/bin/llama-3-8b-instruct</span>
          </div>
        </div>

        {/* File Upload Button at Top */}
        <div className="px-8 py-4 border-b border-slate-800 bg-slate-900/30">
          <label className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg cursor-pointer transition-colors">
            <Upload className="w-4 h-4" />
            <span className="text-sm font-medium">Upload Files</span>
            <input 
              type="file" 
              className="hidden" 
              multiple 
              onChange={handleFileUpload}
              accept=".txt,.md,.pdf,.doc,.docx"
            />
          </label>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded bg-emerald-900/30 flex items-center justify-center border border-emerald-500/20 shrink-0">
                  <Cpu className="w-4 h-4 text-emerald-400" />
                </div>
              )}
              <div className={`max-w-[70%] space-y-2`}>
                <div className={`p-4 rounded-lg text-sm leading-relaxed ${
                  msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-slate-800/80 text-slate-200 border border-slate-700'
                }`}>
                  {msg.content.split('\n').map((line, i) => <p key={i} className="mb-2">{line}</p>)}
                </div>
                {msg.sources && msg.sources.length > 0 && (
                  <div className="flex gap-2 text-xs text-slate-500 pl-1">
                     <span>Sources:</span>
                     {msg.sources.map((s, i) => (
                       <span key={i} className="bg-slate-800 px-2 py-0.5 rounded border border-slate-700 text-slate-400">{s}</span>
                     ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-6 bg-slate-900/30 border-t border-slate-800">
          <div className="max-w-4xl mx-auto relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Query your knowledge base..."
              className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-6 pr-14 py-4 text-slate-200 focus:outline-none focus:border-emerald-500"
            />
            <button onClick={handleSendMessage} disabled={isProcessing} className="absolute right-3 top-3 p-2 bg-emerald-600 rounded text-white hover:bg-emerald-500">
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
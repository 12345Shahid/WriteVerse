import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTeam } from "@/context/TeamContext";
import { supabase } from "@/lib/supabase";
import { SiteNav } from "@/components/SiteNav";
import { Button } from "@/components/ui/button-brutal";
import { Input } from "@/components/ui/input";
import { Bot, User, Send, Loader2, ArrowLeft, RefreshCw, Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from 'react-markdown';

export default function AgentChat() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentTeam } = useTeam();
  
  const [agent, setAgent] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<any[]>([]);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (id && currentTeam) {
        // Reset state immediately to prevent chat history bleeding
        setMessages([]);
        setSessionId(null);
        setAgent(null);
        
        loadAgent();
        loadLastSession();
    }
  }, [id, currentTeam]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadAgent = async () => {
    const { data } = await supabase.from('agents').select('*').eq('id', id).single();
    setAgent(data);
  };

  const loadLastSession = async () => {
      const { data } = await supabase.from('agent_sessions')
        .select('id')
        .eq('agent_id', id)
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if(data) {
          setSessionId(data.id);
          const { data: msgs } = await supabase.from('agent_messages')
            .select('*')
            .eq('session_id', data.id)
            .order('created_at', { ascending: true });
          setMessages(msgs || []);
      }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          const reader = new FileReader();
          reader.onload = (ev) => {
              if (ev.target?.result) {
                  setAttachments(prev => [...prev, {
                      name: file.name,
                      type: file.type,
                      content: ev.target!.result as string
                  }]);
              }
          };
          reader.readAsDataURL(file);
      }
  };

  const removeAttachment = (index: number) => {
      setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!input.trim() && attachments.length === 0) || loading) return;

    const userMsg = { 
        role: 'user', 
        content: input,
        attachments: attachments.length > 0 ? attachments : undefined
    };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    const currentAttachments = [...attachments];
    setAttachments([]);
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/agents/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'x-organization-id': currentTeam?.id || '',
          'x-user-id': session?.user?.id || ''
        },
        body: JSON.stringify({ 
            agentId: id, 
            message: userMsg.content,
            sessionId,
            attachments: currentAttachments
        })
      });
      
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to send');
      
      setSessionId(json.sessionId); // Ensure we stay in same session
      
      const botMsg = { role: 'assistant', content: json.response };
      setMessages(prev => [...prev, botMsg]);
      
    } catch (e: any) {
      toast.error(e.message);
      // Remove user message if failed? No, let them retry maybe.
    } finally {
      setLoading(false);
    }
  };

  const handleNewSession = () => {
      setSessionId(null);
      setMessages([]);
  };

  if (!agent) return null;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <SiteNav />
      
      {/* Header */}
      <div className="bg-white border-b-2 border-black p-4 flex justify-between items-center sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/agents")}>
                <ArrowLeft className="h-4 w-4"/>
            </Button>
            <div className="flex items-center gap-2">
                <div className="bg-purple-300 border border-black p-1 rounded-full">
                    <Bot className="h-5 w-5"/>
                </div>
                <div>
                    <h1 className="font-bold text-lg leading-tight">{agent.name}</h1>
                    <p className="text-xs text-muted-foreground">Powered by Knowledge Base</p>
                </div>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleNewSession}>
              <RefreshCw className="mr-2 h-3 w-3"/> New Chat
          </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 container mx-auto max-w-3xl">
          {messages.length === 0 && (
              <div className="text-center py-20 text-muted-foreground">
                  <Bot className="h-12 w-12 mx-auto mb-4 opacity-20"/>
                  <p>Start a conversation with {agent.name}</p>
              </div>
          )}
          
          <div className="space-y-6">
            {messages.map((msg, i) => (
                <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.role === 'assistant' && (
                        <div className="bg-purple-300 border border-black p-1 rounded-full h-8 w-8 flex items-center justify-center flex-shrink-0">
                            <Bot className="h-4 w-4"/>
                        </div>
                    )}
                    
                    <div className={`max-w-[80%] border-2 border-black p-3 shadow-brutal-sm ${
                        msg.role === 'user' ? 'bg-black text-white' : 'bg-white'
                    }`}>
                        {msg.attachments && msg.attachments.length > 0 && (
                            <div className="mb-2 space-y-1">
                                {msg.attachments.map((att: any, idx: number) => (
                                    <div key={idx} className="text-xs bg-gray-700 text-white p-1 px-2 rounded inline-block mr-1">
                                        📎 {att.name}
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="text-sm prose prose-sm max-w-none dark:prose-invert">
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                    </div>

                    {msg.role === 'user' && (
                        <div className="bg-gray-200 border border-black p-1 rounded-full h-8 w-8 flex items-center justify-center flex-shrink-0">
                            <User className="h-4 w-4"/>
                        </div>
                    )}
                </div>
            ))}
            {loading && (
                 <div className="flex gap-3 justify-start">
                    <div className="bg-purple-300 border border-black p-1 rounded-full h-8 w-8 flex items-center justify-center flex-shrink-0">
                        <Bot className="h-4 w-4"/>
                    </div>
                    <div className="bg-white border-2 border-black p-3">
                        <Loader2 className="h-4 w-4 animate-spin"/>
                    </div>
                 </div>
            )}
            <div ref={scrollRef}/>
          </div>
      </div>

      {/* Input */}
      <div className="bg-white border-t-2 border-black p-4">
          <div className="container mx-auto max-w-3xl">
            {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                    {attachments.map((att, i) => (
                        <div key={i} className="flex items-center gap-1 bg-slate-100 border border-black px-2 py-1 rounded text-sm">
                            <span className="truncate max-w-[150px]">{att.name}</span>
                            <button onClick={() => removeAttachment(i)} className="hover:text-red-500">
                                <X className="h-3 w-3"/>
                            </button>
                        </div>
                    ))}
                </div>
            )}
            <form onSubmit={handleSend} className="flex gap-2">
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileSelect} 
                    className="hidden"
                    accept="image/*,application/pdf,.txt" 
                />
                <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} className="px-3">
                    <Paperclip className="h-4 w-4"/>
                </Button>
                <Input 
                    value={input} 
                    onChange={e => setInput(e.target.value)} 
                    className="input-brutal flex-1" 
                    placeholder="Type your message..."
                    autoFocus
                />
                <Button type="submit" disabled={loading || (!input.trim() && attachments.length === 0)} className="bg-black text-white w-12 px-0">
                    <Send className="h-4 w-4"/>
                </Button>
            </form>
          </div>
      </div>
    </div>
  );
}

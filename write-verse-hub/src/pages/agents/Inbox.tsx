import React, { useState, useEffect } from "react";
import { useTeam } from "@/context/TeamContext";
import { supabase } from "@/lib/supabase";
import { SiteNav } from "@/components/SiteNav";
import { Button } from "@/components/ui/button-brutal";
import { Input } from "@/components/ui/input";
import { Loader2, RefreshCw, Send, User, Bot, AlertTriangle, AlertCircle, Play, Pause } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from 'react-markdown';
import { useSearchParams } from "react-router-dom";

export default function Inbox() {
  const { currentTeam } = useTeam();
  const [searchParams] = useSearchParams();
  const filter = searchParams.get('filter') || 'escalated'; // 'all' or 'escalated'
  const agentIdFromUrl = searchParams.get('agentId') || ''; // Filter by specific agent
  
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);

  useEffect(() => {
    if (currentTeam) loadInbox();
  }, [currentTeam, filter, agentIdFromUrl]);

  useEffect(() => {
    if (selectedSession) loadMessages(selectedSession);
  }, [selectedSession]);

  const loadInbox = async () => {
    try {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        
        // Pass agentId to filter by specific agent
        let url = `${import.meta.env.VITE_API_URL || ''}/api/agents/inbox?filter=${filter}`;
        if (agentIdFromUrl) {
          url += `&agentId=${agentIdFromUrl}`;
        }
        
        const res = await fetch(url, {
            headers: {
                'x-user-id': session?.user?.id || '',
                'x-organization-id': currentTeam?.id || ''
            }
        });
        const json = await res.json();
        setSessions(json.sessions || []);
    } catch (e) {
        toast.error("Failed to load inbox");
    } finally {
        setLoading(false);
    }
  };

  const loadMessages = async (sessionId: string) => {
    setLoadingMessages(true);
    const { data } = await supabase.from('agent_messages')
            .select('*')
            .eq('session_id', sessionId)
            .order('created_at', { ascending: true });
    setMessages(data || []);
    setLoadingMessages(false);
  };

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reply.trim()) return;

    try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/agents/reply`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-user-id': session?.user?.id || ''
            },
            body: JSON.stringify({
                sessionId: selectedSession,
                message: reply
            })
        });

        if (!res.ok) throw new Error('Failed to send');

        // Optimistic update
        setMessages(prev => [...prev, {
            role: 'assistant',
            content: reply,
            created_at: new Date().toISOString(),
            metadata: { responded_by: session?.user?.id }
        }]);
        setReply("");
        toast.success("Reply sent");
    } catch (e) {
        toast.error("Failed to send reply");
    }
  };

  const closeSession = async () => {
      if(!selectedSession) return;
      try {
          const { data: { session } } = await supabase.auth.getSession();
          // Mark session as closed via API (keeps data for records)
          const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/agents/close`, {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
                  'x-user-id': session?.user?.id || ''
              },
              body: JSON.stringify({ sessionId: selectedSession })
          });
          
          if (!res.ok) throw new Error('Failed to close session');
          
          toast.success("Session closed");
          // Update local state to reflect closed status
          setSessions(prev => prev.map(s => 
            s.id === selectedSession ? {...s, status: 'closed'} : s
          ));
          setSelectedSession(null);
      } catch (e) {
          console.error('Close session error:', e);
          toast.error("Failed to close session");
      }
  };
  
  const toggleAgentStatus = async (newStatus: 'active' | 'escalated') => {
      if(!selectedSession) return;
      try {
          const { data: { session } } = await supabase.auth.getSession();
          const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/agents/status`, {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
                  'x-user-id': session?.user?.id || ''
              },
              body: JSON.stringify({ sessionId: selectedSession, status: newStatus })
          });
          
          if (!res.ok) throw new Error('Failed to update status');
          
          // Immediately update local state for better UX
          setSessions(prev => prev.map(s => 
            s.id === selectedSession ? {...s, status: newStatus} : s
          ));
          
          toast.success(newStatus === 'active' ? "Agent Started - AI will respond" : "Agent Stopped - Human takeover");
      } catch (e) {
         toast.error("Failed to update agent status");
      }
  };

  // derived
  const currentSessionData = sessions.find(s => s.id === selectedSession);
  // Agent is active when status is 'active', stopped when 'escalated'
  const isAgentActive = currentSessionData?.status === 'active';
  // For escalated chats, agent should be stopped (is_escalated = true means agent stopped)

  return (
    <div className="h-screen bg-slate-50 flex flex-col overflow-hidden">
      <SiteNav />
      {/* Remove min-h-screen from root or ensure h-screen on root to make sticky work */}
      
      <div className="container mx-auto p-4 flex-1 flex gap-4 h-full overflow-hidden">
        
        {/* Sidebar List */}
        <div className="w-1/3 bg-white border-2 border-black flex flex-col">
            <div className={`p-4 border-b-2 border-black flex justify-between items-center ${filter === 'all' ? 'bg-white' : 'bg-yellow-300'}`}>
                <h2 className="font-bold flex items-center gap-2">
                    {filter === 'all' ? <Bot className="h-5 w-5"/> : <AlertTriangle className="h-5 w-5"/>} 
                    {filter === 'all' ? 'All Conversations' : 'Escalated Chats'}
                </h2>
                <Button variant="ghost" size="sm" onClick={loadInbox}>
                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}/>
                </Button>
            </div>
            <div className="flex-1 overflow-y-auto">
                {sessions.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                        <p>No {filter === 'all' ? 'active' : 'escalated'} conversations.</p>
                        <p className="text-xs">All caught up!</p>
                    </div>
                ) : (
                    sessions.map(s => (
                        <div 
                            key={s.id}
                            onClick={() => setSelectedSession(s.id)}
                            className={`p-4 border-b border-gray-200 cursor-pointer hover:bg-slate-50 ${selectedSession === s.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''}`}
                        >
                            <div className="flex justify-between mb-1">
                                <span className="font-bold text-sm truncate">{s.agentName}</span>
                                <span className="text-xs text-gray-400">{new Date(s.updatedAt).toLocaleTimeString()}</span>
                            </div>
                            <h3 className="text-sm font-semibold truncate mb-1">{s.title}</h3>
                            <div className="flex justify-between items-center">
                                <p className="text-xs text-gray-500 truncate max-w-[150px]">{s.lastMessage}</p>
                                {filter === 'all' && (
                                    <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                                        s.status === 'escalated' ? 'bg-yellow-200 text-yellow-800' : 'bg-green-200 text-green-800'
                                    }`}>
                                        {s.status}
                                    </span>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 bg-white border-2 border-black flex flex-col">
            {selectedSession ? (
                <>
                    <div className="p-4 border-b-2 border-black flex justify-between items-center bg-gray-50">
                        <div>
                             <span className="font-mono text-xs text-gray-500 block">Session: {selectedSession}</span>
                             {currentSessionData?.customerEmail && (
                                <div className="mt-1 text-sm">
                                    <span className="font-bold">{currentSessionData?.customerName || 'Lead'}</span>
                                    <span className="text-gray-500 ml-2">&lt;{currentSessionData?.customerEmail}&gt;</span>
                                </div>
                             )}
                        </div>
                        <div className="flex gap-2">
                             {/* Debug status display */}
                             <span className={`text-xs px-2 py-1 rounded ${currentSessionData?.status === 'escalated' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
                               {currentSessionData?.status || 'unknown'}
                             </span>
                             
                             {/* Agent Controls */}
                             {/* When escalated: Stop disabled, Start enabled */}
                             <Button 
                                variant="outline" 
                                size="sm" 
                                className={`gap-1 ${currentSessionData?.status !== 'escalated' ? 'border-red-500 text-red-500 hover:bg-red-50' : 'opacity-50 cursor-not-allowed'}`}
                                onClick={() => toggleAgentStatus('escalated')}
                                disabled={currentSessionData?.status === 'escalated'}
                                title={currentSessionData?.status === 'escalated' ? "Agent is already stopped (Escalated)" : "Stop Agent - Will escalate to human"}
                             >
                                <Pause className="h-3 w-3" /> Stop Agent
                             </Button>
                             <Button 
                                variant="outline" 
                                size="sm" 
                                className={`gap-1 ${currentSessionData?.status === 'escalated' ? 'border-green-500 text-green-500 hover:bg-green-50' : 'opacity-50 cursor-not-allowed'}`}
                                onClick={() => toggleAgentStatus('active')}
                                disabled={currentSessionData?.status !== 'escalated'}
                                title={currentSessionData?.status !== 'escalated' ? "Agent is already running" : "Start Agent - Resume AI responses"}
                             >
                                <Play className="h-3 w-3" /> Start Agent
                             </Button>
                             
                             <div className="h-6 w-px bg-gray-300 mx-1"></div>
                             
                             <Button variant="outline" size="sm" onClick={closeSession} className="border-gray-400 text-gray-600 hover:bg-gray-100">
                                Close Ticket
                             </Button>
                        </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-100">
                        {loadingMessages ? (
                            <Loader2 className="animate-spin h-8 w-8 mx-auto opacity-50"/>
                        ) : (
                            messages.map((msg, i) => (
                                <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                                    {msg.role === 'user' && (
                                        <div className="bg-gray-300 border border-black p-1 rounded-full h-8 w-8 flex items-center justify-center flex-shrink-0">
                                            <User className="h-4 w-4"/>
                                        </div>
                                    )}
                                    <div className={`max-w-[70%] border-2 border-black p-3 shadow-brutal-sm ${
                                        msg.role === 'user' ? 'bg-gray-200' : 'bg-blue-100'
                                    }`}>
                                        <div className="prose prose-sm"><ReactMarkdown>{msg.content}</ReactMarkdown></div>
                                        <div className="text-[10px] text-gray-500 mt-1 text-right">
                                            {msg.role === 'assistant' && msg.metadata?.responded_by ? '(Human Agent)' : ''}
                                        </div>
                                    </div>
                                     {msg.role === 'assistant' && (
                                        <div className="bg-blue-300 border border-black p-1 rounded-full h-8 w-8 flex items-center justify-center flex-shrink-0">
                                            <Bot className="h-4 w-4"/>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                        {/* Scroll anchor could go here */}
                    </div>

                    <div className="p-4 bg-white border-t-2 border-black">
                        <form onSubmit={handleReply} className="flex gap-2">
                             <Input 
                                value={reply} 
                                onChange={e => setReply(e.target.value)} 
                                className="input-brutal flex-1"
                                placeholder="Write a reply..."
                            />
                            <Button type="submit" className="bg-black text-white">
                                <Send className="h-4 w-4"/>
                            </Button>
                        </form>
                    </div>
                </>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                    <div className="h-16 w-16 mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                        <AlertCircle className="h-8 w-8 opacity-20"/>
                    </div>
                    <p>Select a {filter === 'all' ? 'conversation' : 'ticket'} to view details</p>
                </div>
            )}
        </div>

      </div>
    </div>
  );
}

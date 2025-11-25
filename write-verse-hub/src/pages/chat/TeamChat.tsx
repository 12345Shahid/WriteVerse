import { useEffect, useState, useRef } from 'react';
import { useTeam } from '@/context/TeamContext';
import { supabase } from '@/lib/supabase';
import { listThreads, createThread, listMessages, sendMessage, ChatThread, ChatMessage } from '@/lib/api-chat';
import { SiteNav } from '@/components/SiteNav';
import { Button } from '@/components/ui/button-brutal';
import { Input } from '@/components/ui/input';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Send, User, Bot, Hash, Paperclip, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import ReactMarkdown from 'react-markdown';

export default function TeamChat() {
  const { currentTeam } = useTeam();
  const { toast } = useToast();
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load Threads
  useEffect(() => {
    loadThreads();
    
    // Subscribe to Threads
    const channel = supabase.channel('public:chat_threads')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_threads' }, () => {
            loadThreads();
        })
        .subscribe();
        
    return () => { supabase.removeChannel(channel); };
  }, []);

  const loadThreads = async () => {
    try {
        const data = await listThreads();
        setThreads(data);
        setLoadingThreads(false);
    } catch(e) { console.error(e); }
  };

  // Load Messages when active thread changes
  useEffect(() => {
    if (!activeThreadId) return;
    setMessages([]);
    loadMessages(activeThreadId);

    // Subscribe to Messages
    const channel = supabase.channel(`public:chat_messages:${activeThreadId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `thread_id=eq.${activeThreadId}` }, (payload) => {
            const newMsg = payload.new as ChatMessage;
            setMessages(prev => {
                if (prev.find(m => m.id === newMsg.id)) return prev;
                // Note: payload.new doesn't have the relation 'user', so email might be missing initially until reload.
                // We can try to patch it if we knew the current user, but for now it's fine.
                return [...prev, newMsg]; 
            });
        })
        .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeThreadId]);
  
  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const loadMessages = async (id: string) => {
    try {
        const data = await listMessages(id);
        setMessages(data);
    } catch(e) { console.error(e); }
  };

  const handleCreateThread = async () => {
    const topic = prompt("Enter chat topic:");
    if (!topic) return;
    try {
        const newThread = await createThread(topic);
        setThreads([newThread, ...threads]);
        setActiveThreadId(newThread.id);
    } catch(e) { toast({ title: "Error creating thread", variant: "destructive" }); }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    if (!currentTeam) return;
    
    setUploading(true);
    const file = e.target.files[0];
    try {
        const path = `${currentTeam.id}/chat/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const { error } = await supabase.storage.from('assets').upload(path, file);
        if (error) throw error;
        
        const { data: { publicUrl } } = supabase.storage.from('assets').getPublicUrl(path);
        
        const linkMarkdown = `\n[📄 ${file.name}](${publicUrl})`;
        setInputText(prev => (prev + linkMarkdown).trim());
        toast({ title: "File attached" });
    } catch(e: any) {
        console.error(e);
        toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSend = async () => {
    if (!activeThreadId || !inputText.trim()) return;
    const txt = inputText;
    setInputText('');
    setSending(true);
    try {
        await sendMessage(activeThreadId, txt);
    } catch(e) {
        toast({ title: "Failed to send", variant: "destructive" });
        setInputText(txt); 
    } finally {
        setSending(false);
    }
  };

  const activeThread = threads.find(t => t.id === activeThreadId);

  return (
    <div className="h-screen flex flex-col bg-background font-sans selection:bg-black selection:text-white">
      <SiteNav />
      <div className="flex-1 flex overflow-hidden">
            {/* Sidebar */}
            <div className="w-72 bg-muted/20 border-r border-black flex flex-col">
                <div className="p-4 border-b border-black flex justify-between items-center bg-white">
                    <h2 className="font-black uppercase text-sm tracking-wider">Team Chat</h2>
                    <Button size="sm" variant="ghost" onClick={handleCreateThread}><Plus className="h-4 w-4"/></Button>
                </div>
                <ScrollArea className="flex-1 p-2">
                    {loadingThreads && <div className="p-4 text-center text-sm">Loading...</div>}
                    {threads.map(t => (
                        <div 
                            key={t.id} 
                            className={`p-3 mb-2 rounded cursor-pointer border-2 transition-all ${activeThreadId === t.id ? 'bg-white border-black shadow-brutal' : 'border-transparent hover:bg-white/50'}`}
                            onClick={() => setActiveThreadId(t.id)}
                        >
                            <div className="font-bold text-sm truncate flex items-center">
                                <Hash className="h-3 w-3 mr-1 opacity-50"/> {t.topic}
                            </div>
                            <div className="text-xs text-muted-foreground truncate mt-1">
                                {new Date(t.updated_at).toLocaleDateString()}
                            </div>
                        </div>
                    ))}
                    {threads.length === 0 && !loadingThreads && (
                        <div className="p-4 text-center text-xs text-muted-foreground">No threads yet. Create one!</div>
                    )}
                </ScrollArea>
            </div>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col bg-white relative">
                {activeThread ? (
                    <>
                        {/* Header */}
                        <div className="h-14 border-b border-black flex items-center px-4 bg-muted/10 justify-between">
                            <div className="flex items-center font-bold">
                                <Hash className="h-4 w-4 mr-2"/>
                                {activeThread.topic}
                            </div>
                            <div className="text-xs text-muted-foreground">
                                Created by {activeThread.created_by_user?.email || 'Unknown'}
                            </div>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
                            {messages.map(msg => {
                                const isAI = msg.role === 'assistant';
                                const isSystem = msg.role === 'system';
                                
                                if (isSystem) return (
                                    <div key={msg.id} className="flex justify-center my-2">
                                        <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">{msg.content}</span>
                                    </div>
                                );

                                return (
                                    <div key={msg.id} className={`flex ${isAI ? 'justify-start' : 'justify-end'}`}>
                                        <div className={`max-w-[80%] rounded-lg p-3 border-2 border-black shadow-brutal ${isAI ? 'bg-white' : 'bg-blue-100'}`}>
                                            <div className="text-xs font-bold mb-1 flex items-center opacity-70">
                                                {isAI ? <Bot className="h-3 w-3 mr-1"/> : <User className="h-3 w-3 mr-1"/>}
                                                {isAI ? 'WriterAI' : (msg.user?.email || 'User')}
                                            </div>
                                            <div className="text-sm prose prose-sm max-w-none">
                                                <ReactMarkdown>{msg.content}</ReactMarkdown>
                                            </div>
                                            <div className="text-[10px] text-right mt-1 opacity-50">
                                                {new Date(msg.created_at).toLocaleTimeString()}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            {sending && (
                                <div className="flex justify-end">
                                    <div className="text-xs text-muted-foreground animate-pulse">Sending...</div>
                                </div>
                            )}
                        </div>

                        {/* Input */}
                        <div className="p-4 border-t border-black bg-muted/10">
                            <form onSubmit={e => { e.preventDefault(); handleSend(); }} className="flex gap-2">
                                <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                                <Button type="button" variant="outline" size="icon" disabled={uploading} onClick={() => fileInputRef.current?.click()} className="border-2 border-black shadow-brutal bg-white shrink-0">
                                    {uploading ? <Loader2 className="h-4 w-4 animate-spin"/> : <Paperclip className="h-4 w-4"/>}
                                </Button>
                                <Input 
                                    value={inputText} 
                                    onChange={e => setInputText(e.target.value)} 
                                    placeholder="Type a message..." 
                                    className="border-2 border-black shadow-brutal focus-visible:ring-0"
                                />
                                <Button type="submit" disabled={sending || !inputText.trim()} className="border-2 border-black shadow-brutal bg-black text-white hover:bg-gray-800">
                                    <Send className="h-4 w-4"/>
                                </Button>
                            </form>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center flex-col text-muted-foreground">
                        <div className="p-4 bg-muted/20 rounded-full mb-4 border-2 border-black/10"><Hash className="h-8 w-8"/></div>
                        <p className="font-medium">Select a thread to start chatting</p>
                    </div>
                )}
            </div>
      </div>
    </div>
  );
}

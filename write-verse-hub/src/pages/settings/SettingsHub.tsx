import { ToolLayout } from '@/components/tool/ToolLayout';
import { useNavigate } from 'react-router-dom';
import { Users, Tags, Bot, GitFork, LayoutTemplate, Megaphone, BookOpen } from 'lucide-react';

export default function SettingsHub() {
    const navigate = useNavigate();
    return (
        <ToolLayout title="Settings" description="Manage your workspace">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto mt-10">
                <div 
                  className="border-4 border-black p-6 bg-white shadow-brutal hover:translate-y-1 transition-transform cursor-pointer flex flex-col items-center text-center"
                  onClick={() => navigate('/settings/team')}
                >
                    <div className="bg-blue-100 w-16 h-16 flex items-center justify-center border-2 border-black mb-4 rounded-full">
                        <Users className="h-8 w-8 text-black"/>
                    </div>
                    <h3 className="text-2xl font-black uppercase mb-2">Team Management</h3>
                    <p className="text-muted-foreground font-medium">Manage members, roles, and workspace settings.</p>
                </div>

                <div 
                  className="border-4 border-black p-6 bg-white shadow-brutal hover:translate-y-1 transition-transform cursor-pointer flex flex-col items-center text-center"
                  onClick={() => navigate('/settings/tags')}
                >
                    <div className="bg-pink-100 w-16 h-16 flex items-center justify-center border-2 border-black mb-4 rounded-full">
                        <Tags className="h-8 w-8 text-black"/>
                    </div>
                    <h3 className="text-2xl font-black uppercase mb-2">Tags Management</h3>
                    <p className="text-muted-foreground font-medium">Create and manage tags for files and projects.</p>
                </div>

                <div 
                  className="border-4 border-black p-6 bg-white shadow-brutal hover:translate-y-1 transition-transform cursor-pointer flex flex-col items-center text-center"
                  onClick={() => navigate('/knowledge')}
                >
                    <div className="bg-cyan-100 w-16 h-16 flex items-center justify-center border-2 border-black mb-4 rounded-full">
                        <BookOpen className="h-8 w-8 text-black"/>
                    </div>
                    <h3 className="text-2xl font-black uppercase mb-2">Knowledge Base</h3>
                    <p className="text-muted-foreground font-medium">Upload docs for your Agents to read and learn from.</p>
                </div>

                <div 
                  className="border-4 border-black p-6 bg-white shadow-brutal hover:translate-y-1 transition-transform cursor-pointer flex flex-col items-center text-center"
                  onClick={() => navigate('/agents')}
                >
                    <div className="bg-purple-100 w-16 h-16 flex items-center justify-center border-2 border-black mb-4 rounded-full">
                        <Bot className="h-8 w-8 text-black"/>
                    </div>
                    <h3 className="text-2xl font-black uppercase mb-2">Custom Agents</h3>
                    <p className="text-muted-foreground font-medium">Create and manage AI agents with custom instructions.</p>
                </div>

                <div 
                  className="border-4 border-black p-6 bg-white shadow-brutal hover:translate-y-1 transition-transform cursor-pointer flex flex-col items-center text-center"
                  onClick={() => navigate('/workflows')}
                >
                    <div className="bg-green-100 w-16 h-16 flex items-center justify-center border-2 border-black mb-4 rounded-full">
                        <GitFork className="h-8 w-8 text-black"/>
                    </div>
                    <h3 className="text-2xl font-black uppercase mb-2">Workflows</h3>
                    <p className="text-muted-foreground font-medium">Build multi-step AI workflows and automations.</p>
                </div>

                <div 
                  className="border-4 border-black p-6 bg-white shadow-brutal hover:translate-y-1 transition-transform cursor-pointer flex flex-col items-center text-center"
                  onClick={() => navigate('/templates')}
                >
                    <div className="bg-yellow-100 w-16 h-16 flex items-center justify-center border-2 border-black mb-4 rounded-full">
                        <LayoutTemplate className="h-8 w-8 text-black"/>
                    </div>
                    <h3 className="text-2xl font-black uppercase mb-2">Templates</h3>
                    <p className="text-muted-foreground font-medium">Create custom tool templates for your team.</p>
                </div>

                <div 
                  className="border-4 border-black p-6 bg-white shadow-brutal hover:translate-y-1 transition-transform cursor-pointer flex flex-col items-center text-center"
                  onClick={() => navigate('/brand-voice')}
                >
                    <div className="bg-orange-100 w-16 h-16 flex items-center justify-center border-2 border-black mb-4 rounded-full">
                        <Megaphone className="h-8 w-8 text-black"/>
                    </div>
                    <h3 className="text-2xl font-black uppercase mb-2">Brand Voice</h3>
                    <p className="text-muted-foreground font-medium">Manage brand voices and tone guidelines.</p>
                </div>
            </div>
        </ToolLayout>
    )
}

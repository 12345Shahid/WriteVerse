import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listBrandVoices, deleteBrandVoice, BrandVoice } from '@/lib/api-brand-voices';
import { ToolLayout } from '@/components/tool/ToolLayout';
import { Button } from '@/components/ui/button-brutal';
import { Plus, Trash2, Edit2, Mic2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useTeam } from '@/context/TeamContext';

export default function BrandVoices() {
  const { currentTeam } = useTeam();
  const { toast } = useToast();
  const [voices, setVoices] = useState<BrandVoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [currentTeam]);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await listBrandVoices();
      setVoices(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this Brand Voice profile?")) return;
    try {
      await deleteBrandVoice(id);
      setVoices(voices.filter(v => v.id !== id));
      toast({ title: "Deleted", description: "Profile removed" });
    } catch (e) {
      toast({ title: "Error", description: "Failed to delete", variant: "destructive" });
    }
  };

  const isViewer = currentTeam?.role === 'viewer';

  return (
    <ToolLayout title="Brand Voice" description="Manage your organization's tone and style profiles">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-black uppercase">Voice Profiles</h2>
        {!isViewer && (
          <Link to="/brand-voice/new">
            <Button className="bg-black text-white shadow-brutal hover:bg-gray-800">
              <Plus className="mr-2 h-4 w-4" /> New Profile
            </Button>
          </Link>
        )}
      </div>

      {loading ? (
        <div className="text-center py-10">Loading...</div>
      ) : voices.length === 0 ? (
        <div className="text-center py-10 border-2 border-dashed border-black bg-white">
          <Mic2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p className="font-bold text-muted-foreground">No voice profiles yet.</p>
          {!isViewer && <p className="text-sm mt-2">Create one to guide your AI content generation.</p>}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {voices.map(voice => (
            <div key={voice.id} className="border-4 border-black p-4 bg-white shadow-brutal hover:-translate-y-1 transition-transform">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-bold text-lg truncate">{voice.name}</h3>
                {!isViewer && (
                  <div className="flex gap-1">
                    <Link to={`/brand-voice/${voice.id}`}>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0"><Edit2 className="h-4 w-4" /></Button>
                    </Link>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-600 hover:text-red-700" onClick={() => handleDelete(voice.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
              <p className="text-sm text-muted-foreground line-clamp-2 h-10">{voice.description || "No description"}</p>
              
              <div className="mt-4 flex flex-wrap gap-1">
                {voice.tone_tags && voice.tone_tags.slice(0, 3).map(t => (
                  <span key={t} className="text-xs bg-yellow-200 border border-black px-1 rounded">{t}</span>
                ))}
                {voice.tone_tags && voice.tone_tags.length > 3 && <span className="text-xs text-muted-foreground">+{voice.tone_tags.length - 3} more</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </ToolLayout>
  );
}

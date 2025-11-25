import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getBrandVoice, createBrandVoice, updateBrandVoice, addVoiceSample, deleteVoiceSample, BrandVoice, BrandVoiceSample } from '@/lib/api-brand-voices';
import { ToolLayout } from '@/components/tool/ToolLayout';
import { Button } from '@/components/ui/button-brutal';
import { Input } from '@/components/ui/input';
import { Textarea } from "@/components/ui/textarea";
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2, Plus, Save, ArrowLeft, X } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useTeam } from '@/context/TeamContext';

export default function BrandVoiceBuilder() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentTeam } = useTeam();
  
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [voice, setVoice] = useState<Partial<BrandVoice>>({
    name: '',
    description: '',
    tone_tags: [],
    rules: { dos: [], donts: [] }
  });
  
  const [samples, setSamples] = useState<BrandVoiceSample[]>([]);
  const [newTag, setNewTag] = useState('');
  const [newDo, setNewDo] = useState('');
  const [newDont, setNewDont] = useState('');
  const [newSample, setNewSample] = useState('');

  useEffect(() => {
    if (isEdit && id) {
      loadVoice(id);
    }
  }, [id]);

  const loadVoice = async (voiceId: string) => {
    try {
      const data = await getBrandVoice(voiceId);
      setVoice(data);
      setSamples(data.brand_voice_samples || []);
    } catch (e) {
      toast({ title: "Error", description: "Failed to load profile", variant: "destructive" });
      navigate('/brand-voice');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!voice.name) return toast({ title: "Name required", variant: "destructive" });
    setSaving(true);
    try {
      if (isEdit && id) {
        await updateBrandVoice(id, voice);
        toast({ title: "Saved", description: "Profile updated" });
      } else {
        const newVoice = await createBrandVoice(voice);
        toast({ title: "Created", description: "Profile created" });
        navigate(`/brand-voice/${newVoice.id}`);
      }
    } catch (e) {
      toast({ title: "Error", description: "Failed to save", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleAddSample = async () => {
    if (!newSample.trim() || !id) return;
    try {
      const sample = await addVoiceSample(id, newSample);
      setSamples([...samples, sample]);
      setNewSample('');
      toast({ title: "Sample added" });
    } catch (e) {
      toast({ title: "Error", variant: "destructive" });
    }
  };

  const handleDeleteSample = async (sampleId: string) => {
    if (!id) return;
    try {
      await deleteVoiceSample(id, sampleId);
      setSamples(samples.filter(s => s.id !== sampleId));
    } catch (e) {
      toast({ title: "Error", variant: "destructive" });
    }
  };

  // Array helpers
  const addTag = () => { if (newTag.trim()) { setVoice({...voice, tone_tags: [...(voice.tone_tags||[]), newTag.trim()]}); setNewTag(''); }};
  const removeTag = (idx: number) => { const t = [...(voice.tone_tags||[])]; t.splice(idx, 1); setVoice({...voice, tone_tags: t}); };

  const addDo = () => { if (newDo.trim()) { setVoice({...voice, rules: { ...voice.rules!, dos: [...(voice.rules?.dos||[]), newDo.trim()] }}); setNewDo(''); }};
  const removeDo = (idx: number) => { const d = [...(voice.rules?.dos||[])]; d.splice(idx, 1); setVoice({...voice, rules: { ...voice.rules!, dos: d }}); };

  const addDont = () => { if (newDont.trim()) { setVoice({...voice, rules: { ...voice.rules!, donts: [...(voice.rules?.donts||[]), newDont.trim()] }}); setNewDont(''); }};
  const removeDont = (idx: number) => { const d = [...(voice.rules?.donts||[])]; d.splice(idx, 1); setVoice({...voice, rules: { ...voice.rules!, donts: d }}); };

  const isViewer = currentTeam?.role === 'viewer';

  if (loading) return <div className="p-10 text-center">Loading...</div>;

  return (
    <ToolLayout title={isEdit ? "Edit Voice Profile" : "New Voice Profile"} description="Define tone, rules, and samples">
      <div className="mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/brand-voice')}><ArrowLeft className="mr-2 h-4 w-4"/> Back</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Main Info */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-2 border-black shadow-brutal">
            <CardHeader><CardTitle>Profile Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Profile Name</Label>
                <Input value={voice.name} onChange={e => setVoice({...voice, name: e.target.value})} placeholder="e.g. Official Corporate, Friendly Blog" disabled={isViewer} />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea value={voice.description} onChange={e => setVoice({...voice, description: e.target.value})} placeholder="Briefly describe the persona..." disabled={isViewer} />
              </div>
              
              <div>
                <Label>Tone Tags</Label>
                <div className="flex gap-2 mb-2 flex-wrap">
                  {voice.tone_tags?.map((t, i) => (
                    <Badge key={i} variant="secondary" className="border border-black">
                      {t} {!isViewer && <X className="ml-1 h-3 w-3 cursor-pointer" onClick={() => removeTag(i)} />}
                    </Badge>
                  ))}
                </div>
                {!isViewer && (
                  <div className="flex gap-2">
                    <Input value={newTag} onChange={e => setNewTag(e.target.value)} placeholder="Add tone (e.g. Witty)" onKeyDown={e => e.key === 'Enter' && addTag()} />
                    <Button onClick={addTag} size="icon" variant="outline"><Plus className="h-4 w-4"/></Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-black shadow-brutal">
            <CardHeader><CardTitle>Style Guidelines</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-green-700">Do's (Preferred)</Label>
                <ul className="list-disc pl-4 mb-2 space-y-1">
                  {voice.rules?.dos.map((item, i) => (
                    <li key={i} className="text-sm group flex justify-between">
                      {item}
                      {!isViewer && <X className="h-3 w-3 opacity-0 group-hover:opacity-100 cursor-pointer" onClick={() => removeDo(i)}/>}
                    </li>
                  ))}
                </ul>
                {!isViewer && (
                  <div className="flex gap-2">
                    <Input value={newDo} onChange={e => setNewDo(e.target.value)} placeholder="Add rule..." onKeyDown={e => e.key === 'Enter' && addDo()} />
                    <Button onClick={addDo} size="icon" variant="outline" className="shrink-0"><Plus className="h-4 w-4"/></Button>
                  </div>
                )}
              </div>
              
              <div>
                <Label className="text-red-700">Dont's (Avoid)</Label>
                <ul className="list-disc pl-4 mb-2 space-y-1">
                  {voice.rules?.donts.map((item, i) => (
                    <li key={i} className="text-sm group flex justify-between">
                      {item}
                      {!isViewer && <X className="h-3 w-3 opacity-0 group-hover:opacity-100 cursor-pointer" onClick={() => removeDont(i)}/>}
                    </li>
                  ))}
                </ul>
                {!isViewer && (
                  <div className="flex gap-2">
                    <Input value={newDont} onChange={e => setNewDont(e.target.value)} placeholder="Add rule..." onKeyDown={e => e.key === 'Enter' && addDont()} />
                    <Button onClick={addDont} size="icon" variant="outline" className="shrink-0"><Plus className="h-4 w-4"/></Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Samples & Actions */}
        <div className="space-y-6">
          <Card className="border-2 border-black shadow-brutal bg-blue-50">
            <CardHeader><CardTitle>Actions</CardTitle></CardHeader>
            <CardContent>
              {!isViewer ? (
                <Button className="w-full bg-black text-white" onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving...' : <><Save className="mr-2 h-4 w-4"/> Save Profile</>}
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground text-center">View Only Mode</p>
              )}
            </CardContent>
          </Card>

          {isEdit && (
            <Card className="border-2 border-black shadow-brutal">
              <CardHeader><CardTitle>Voice Samples</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <p className="text-xs text-muted-foreground">Upload text samples to train the AI on your specific style.</p>
                <div className="max-h-[400px] overflow-y-auto space-y-2">
                  {samples.map(s => (
                    <div key={s.id} className="p-2 bg-white border border-black rounded text-xs relative group">
                      <p className="line-clamp-3">{s.content}</p>
                      {!isViewer && (
                        <Button variant="destructive" size="icon" className="h-6 w-6 absolute top-1 right-1 opacity-0 group-hover:opacity-100" onClick={() => handleDeleteSample(s.id)}>
                          <Trash2 className="h-3 w-3"/>
                        </Button>
                      )}
                    </div>
                  ))}
                  {samples.length === 0 && <p className="text-xs italic text-muted-foreground">No samples yet.</p>}
                </div>
                
                {!isViewer && (
                  <div className="pt-2 border-t border-black/10">
                    <Textarea 
                      placeholder="Paste a sample paragraph..." 
                      className="text-xs min-h-[80px] mb-2"
                      value={newSample}
                      onChange={e => setNewSample(e.target.value)}
                    />
                    <Button size="sm" variant="outline" className="w-full" onClick={handleAddSample} disabled={!newSample.trim()}>
                      <Plus className="mr-2 h-3 w-3"/> Add Sample
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </ToolLayout>
  );
}

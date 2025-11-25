import { useEffect, useState } from 'react';
import { useBrandVoice } from '@/context/BrandVoiceContext';
import { listBrandVoices, BrandVoice } from '@/lib/api-brand-voices';
import { useTeam } from '@/context/TeamContext';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Mic2 } from 'lucide-react';

export function BrandVoiceSelector() {
  const { selectedVoiceId, setSelectedVoiceId } = useBrandVoice();
  const { currentTeam } = useTeam();
  const [voices, setVoices] = useState<BrandVoice[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (currentTeam) {
      loadVoices();
    }
  }, [currentTeam]);

  const loadVoices = async () => {
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

  if (!currentTeam) return null;

  return (
    <div className="flex items-center gap-2">
        <Mic2 className="h-4 w-4 text-muted-foreground"/>
        <Select value={selectedVoiceId || "none"} onValueChange={(val) => setSelectedVoiceId(val === "none" ? undefined : val)}>
            <SelectTrigger className="w-[200px] h-8 text-xs bg-white border-2 border-black shadow-sm">
                <SelectValue placeholder="Select Brand Voice" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="none">Default Voice</SelectItem>
                {voices.map(v => (
                    <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                ))}
            </SelectContent>
        </Select>
    </div>
  );
}

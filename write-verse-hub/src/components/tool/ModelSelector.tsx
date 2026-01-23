import { useModel, AVAILABLE_MODELS } from '@/context/ModelContext';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel
} from "@/components/ui/select";
import { Cpu } from 'lucide-react';

export function ModelSelector() {
  const { selectedModelId, setSelectedModelId } = useModel();

  // Get unique providers
  const providers = Array.from(new Set(AVAILABLE_MODELS.map(m => m.provider)));

  return (
    <div className="flex items-center gap-2">
        <Cpu className="h-4 w-4 text-muted-foreground"/>
        <Select value={selectedModelId} onValueChange={setSelectedModelId}>
            <SelectTrigger className="w-[240px] h-8 text-xs bg-white border-2 border-black shadow-sm">
                <SelectValue placeholder="Select Model" />
            </SelectTrigger>
            <SelectContent className="max-h-[400px]">
                {providers.map(provider => (
                    <SelectGroup key={provider}>
                        <SelectLabel className="text-xs font-bold text-muted-foreground bg-muted/50 px-2 py-1 mt-1 mb-1">
                            {provider}
                        </SelectLabel>
                        {AVAILABLE_MODELS
                            .filter(m => m.provider === provider)
                            .map(m => (
                            <SelectItem key={m.id} value={m.id} className="text-xs">
                                <div className="flex flex-col items-start gap-0.5">
                                    <span className="font-medium">{m.name}</span>
                                    <div className="flex gap-2 text-[10px] text-muted-foreground">
                                        <span>{m.speed}</span>
                                        <span>•</span>
                                        <span>{m.category}</span>
                                    </div>
                                </div>
                            </SelectItem>
                        ))}
                    </SelectGroup>
                ))}
            </SelectContent>
        </Select>
    </div>
  );
}

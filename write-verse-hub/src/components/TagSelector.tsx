import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button-brutal";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Plus, X, Tag as TagIcon } from "lucide-react";
import { toast } from "sonner";

interface TagSelectorProps {
  entityId: string;
  entityType: 'agent' | 'workflow' | 'knowledge_file';
  organizationId: string;
}

export function TagSelector({ entityId, entityType, organizationId }: TagSelectorProps) {
  const [assignedTags, setAssignedTags] = useState<any[]>([]);
  const [availableTags, setAvailableTags] = useState<any[]>([]);
  const [open, setOpen] = useState(false);

  // Map entity type to table names
  const tableMap = {
    agent: 'agent_tags',
    workflow: 'workflow_tags',
    knowledge_file: 'knowledge_file_tags'
  };
  
  const idFieldMap = {
      agent: 'agent_id',
      workflow: 'workflow_id',
      knowledge_file: 'file_id'
  };

  const tableName = tableMap[entityType];
  const idField = idFieldMap[entityType];

  useEffect(() => {
    if (entityId && organizationId) {
      loadTags();
    }
  }, [entityId, organizationId]);

  const loadTags = async () => {
    // 1. Fetch all org tags
    const { data: allTags } = await supabase
      .from('tags')
      .select('*')
      .eq('organization_id', organizationId);
    
    setAvailableTags(allTags || []);

    // 2. Fetch assigned tags
    const { data: links } = await supabase
      .from(tableName)
      .select('tag_id, tag:tags(*)')
      .eq(idField, entityId);
    
    const assigned = links?.map((l: any) => l.tag) || [];
    setAssignedTags(assigned);
  };

  const handleAddTag = async (tagId: string) => {
    // Check if already assigned
    if (assignedTags.find(t => t.id === tagId)) return;

    const { error } = await supabase
      .from(tableName)
      .insert({ [idField]: entityId, tag_id: tagId });
    
    if (error) {
        toast.error("Failed to add tag");
    } else {
        const tag = availableTags.find(t => t.id === tagId);
        setAssignedTags([...assignedTags, tag]);
        setOpen(false);
    }
  };

  const handleRemoveTag = async (tagId: string) => {
    const { error } = await supabase
      .from(tableName)
      .delete()
      .eq(idField, entityId)
      .eq('tag_id', tagId);
      
    if (error) {
        toast.error("Failed to remove tag");
    } else {
        setAssignedTags(assignedTags.filter(t => t.id !== tagId));
    }
  };

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {assignedTags.map(tag => (
        <Badge key={tag.id} variant="outline" className="border-black bg-white flex items-center gap-1 py-1">
          {tag.name}
          <button onClick={() => handleRemoveTag(tag.id)} className="hover:text-red-500 ml-1">
            <X className="h-3 w-3"/>
          </button>
        </Badge>
      ))}
      
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-6 border-dashed rounded-full px-2 text-xs">
            <Plus className="h-3 w-3 mr-1"/> Tag
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-52" align="start">
          <Command>
            <CommandInput placeholder="Search tags..." className="h-9" />
            <CommandList>
              <CommandEmpty>No tags found.</CommandEmpty>
              <CommandGroup>
                {availableTags.map(tag => {
                    const isSelected = assignedTags.some(t => t.id === tag.id);
                    if (isSelected) return null;
                    return (
                      <CommandItem
                        key={tag.id}
                        value={tag.name}
                        onSelect={() => handleAddTag(tag.id)}
                        className="cursor-pointer"
                      >
                        <TagIcon className="mr-2 h-4 w-4" />
                        {tag.name}
                      </CommandItem>
                    );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

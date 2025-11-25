import { useEffect, useState, useRef } from 'react';
import { useTeam } from '@/context/TeamContext';
import { ToolLayout } from '@/components/tool/ToolLayout';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button-brutal';
import { Loader2, Upload, File, Trash2, Folder as FolderIcon, Download, Search, Plus, ArrowLeft, ExternalLink, MoreVertical, Tag, Layers, Edit2, X } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { getCommonHeaders } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface TagModel { id: string; name: string; }
interface Category { id: string; name: string; }

interface Asset {
  id: string;
  name: string;
  size_bytes: number;
  file_type: string;
  storage_path: string;
  created_at: string;
  folder_id: string | null;
  category_id: string | null;
  tags?: TagModel[];
}

interface Folder {
  id: string;
  name: string;
  parent_id: string | null;
  category_id: string | null;
  tags?: TagModel[];
}

export default function FileManager() {
  const { currentTeam } = useTeam();
  const isViewer = currentTeam?.role === 'viewer';
  const { toast } = useToast();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<TagModel[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<{id: string, name: string}[]>([]);
  
  // Search & Filter
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterTag, setFilterTag] = useState('all');

  // New Folder
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  // Dialogs
  const [editFolder, setEditFolder] = useState<Folder | null>(null);
  const [deleteFolder, setDeleteFolder] = useState<Folder | null>(null);
  const [deleteContent, setDeleteContent] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  // Tag Management Dialog
  const [manageTagsItem, setManageTagsItem] = useState<{type: 'asset'|'folder', item: Asset|Folder} | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadData();
  }, [currentFolderId, search, filterType, filterCategory, filterTag]);

  useEffect(() => {
      loadMetadata();
  }, []);

  const loadMetadata = async () => {
      try {
          const headers = await getCommonHeaders();
          const [catRes, tagRes] = await Promise.all([
              fetch('/api/categories', { headers }),
              fetch('/api/tags', { headers })
          ]);
          if (catRes.ok) {
              const d = await catRes.json();
              setCategories(d.categories || []);
          }
          if (tagRes.ok) {
              const d = await tagRes.json();
              setTags(d.tags || []);
          }
      } catch(e) { console.error(e); }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const headers = await getCommonHeaders();
      
      // Build params
      const params = new URLSearchParams();
      if (!search) {
        if (currentFolderId) params.append('folderId', currentFolderId);
        else params.append('folderId', 'null');
      }
      
      if (search) params.append('search', search);
      if (filterType !== 'all') params.append('type', filterType);

      const [assetRes, folderRes] = await Promise.all([
        fetch(`/api/assets?${params.toString()}`, { headers }),
        fetch(`/api/folders?parentId=${currentFolderId || 'null'}`, { headers })
      ]);

      if (assetRes.ok && folderRes.ok) {
        let aData = await assetRes.json();
        let fData = await folderRes.json();
        
        let assetsList = aData.assets || [];
        let foldersList = fData.folders || [];

        if (filterCategory !== 'all') {
            assetsList = assetsList.filter((a: Asset) => a.category_id === filterCategory);
            foldersList = foldersList.filter((f: Folder) => f.category_id === filterCategory);
        }
        
        if (filterTag !== 'all') {
            assetsList = assetsList.filter((a: Asset) => a.tags?.some(t => t.id === filterTag));
            foldersList = foldersList.filter((f: Folder) => f.tags?.some(t => t.id === filterTag));
        }

        setAssets(assetsList);
        setFolders(foldersList);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setUploading(true);
    const file = e.target.files[0];

    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session) throw new Error("Not logged in");
      const orgId = localStorage.getItem('writerai_active_team');
      if (!orgId) throw new Error("No active team");

      const path = `${orgId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const { data, error } = await supabase.storage.from('assets').upload(path, file);
      if (error) throw error;

      const { error: dbError } = await supabase.from('assets').insert({
          organization_id: orgId,
          name: file.name,
          storage_path: path,
          file_type: file.type,
          size_bytes: file.size,
          uploaded_by: session.session.user.id,
          folder_id: currentFolderId || null,
          category_id: filterCategory !== 'all' ? filterCategory : null
        });

      if (dbError) throw dbError;
      toast({ title: "Success", description: "File uploaded" });
      loadData();
    } catch (error: any) {
      console.error(error);
      toast({ title: "Error", description: error.message || "Upload failed", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
        const res = await fetch('/api/folders', {
            method: 'POST',
            headers: await getCommonHeaders(),
            body: JSON.stringify({ 
                name: newFolderName, 
                parentId: currentFolderId,
                categoryId: filterCategory !== 'all' ? filterCategory : null 
            })
        });
        if (res.ok) {
            setNewFolderName('');
            setShowNewFolder(false);
            loadData();
            toast({ title: "Created", description: "Folder created" });
        }
    } catch (e) { console.error(e); }
  };
  
  const handleCreateCategory = async () => {
      if (!newCategoryName.trim()) return;
      try {
          const res = await fetch('/api/categories', {
              method: 'POST',
              headers: await getCommonHeaders(),
              body: JSON.stringify({ name: newCategoryName })
          });
          if (res.ok) {
              const data = await res.json();
              setCategories([...categories, data.category]);
              setNewCategoryName('');
              setShowNewCategory(false);
              toast({ title: "Created", description: "Category added" });
          }
      } catch(e) { console.error(e); }
  };

  const handleDeleteAsset = async (id: string) => {
    if (!confirm("Delete file?")) return;
    try {
       const res = await fetch(`/api/assets/${id}`, { method: 'DELETE', headers: await getCommonHeaders() });
       if (!res.ok) throw new Error("Failed to delete");
       setAssets(assets.filter(a => a.id !== id));
       toast({ title: "Deleted", description: "File removed" });
    } catch (e) { toast({ title: "Error", description: "Delete failed", variant: "destructive" }); }
  };

  const handleDownload = async (asset: Asset) => {
      try {
          const { data, error } = await supabase.storage.from('assets').createSignedUrl(asset.storage_path, 60, { download: asset.name });
          if (error) throw error;
          if (data?.signedUrl) {
              const link = document.createElement('a');
              link.href = data.signedUrl;
              link.setAttribute('download', asset.name);
              document.body.appendChild(link);
              link.click();
              link.remove();
          }
      } catch (e) { console.error(e); toast({ title: "Error", description: "Download failed", variant: "destructive" }); }
  };
  
  const handleAttachTag = async (tagId: string) => {
      if (!manageTagsItem) return;
      const { type, item } = manageTagsItem;
      // Check already exists
      if (item.tags?.some(t => t.id === tagId)) return;

      try {
          const endpoint = type === 'asset' ? `/api/assets/${item.id}/tags` : `/api/folders/${item.id}/tags`;
          const res = await fetch(endpoint, {
              method: 'POST',
              headers: await getCommonHeaders(),
              body: JSON.stringify({ tagId })
          });
          if (res.ok) {
              loadData();
              // Update local item state to reflect changes in dialog
              const newTag = tags.find(t => t.id === tagId);
              if (newTag) {
                  setManageTagsItem({ ...manageTagsItem, item: { ...item, tags: [...(item.tags || []), newTag] } });
              }
              toast({ title: "Tag Added" });
          }
      } catch(e) { toast({ title: "Error", variant: "destructive" }); }
  };

  const handleDetachTag = async (tagId: string) => {
      if (!manageTagsItem) return;
      const { type, item } = manageTagsItem;
      try {
          const endpoint = type === 'asset' ? `/api/assets/${item.id}/tags/${tagId}` : `/api/folders/${item.id}/tags/${tagId}`;
          const res = await fetch(endpoint, { method: 'DELETE', headers: await getCommonHeaders() });
          if (res.ok) {
              loadData();
              setManageTagsItem({ ...manageTagsItem, item: { ...item, tags: (item.tags || []).filter(t => t.id !== tagId) } });
              toast({ title: "Tag Removed" });
          }
      } catch(e) { toast({ title: "Error", variant: "destructive" }); }
  };

  const navigateToFolder = (folder: Folder) => {
      setBreadcrumbs([...breadcrumbs, { id: folder.id, name: folder.name }]);
      setCurrentFolderId(folder.id);
      setSearch('');
  };
  
  const handleShowInFolder = (folderId: string | null) => {
      setSearch('');
      setCurrentFolderId(folderId);
      setBreadcrumbs([]); 
  };
  
  const navigateUp = () => {
      if (breadcrumbs.length === 0) return;
      const newBreadcrumbs = breadcrumbs.slice(0, -1);
      setBreadcrumbs(newBreadcrumbs);
      setCurrentFolderId(newBreadcrumbs.length > 0 ? newBreadcrumbs[newBreadcrumbs.length - 1].id : null);
  };

  const onRenameFolder = async () => {
      if (!editFolder || !renameValue.trim()) return;
      try {
          const res = await fetch(`/api/folders/${editFolder.id}`, {
              method: 'PATCH',
              headers: await getCommonHeaders(),
              body: JSON.stringify({ name: renameValue })
          });
          if (res.ok) {
              loadData();
              setEditFolder(null);
              toast({ title: "Success", description: "Folder renamed" });
          }
      } catch(e) { toast({ title: "Error", description: "Rename failed", variant: "destructive" }); }
  };
  
  const onDeleteFolder = async () => {
      if (!deleteFolder) return;
      try {
          const res = await fetch(`/api/folders/${deleteFolder.id}?deleteContent=${deleteContent}`, {
              method: 'DELETE',
              headers: await getCommonHeaders()
          });
          if (res.ok) {
              loadData();
              setDeleteFolder(null);
              setDeleteContent(false);
              toast({ title: "Deleted", description: "Folder removed" });
          }
      } catch(e) { toast({ title: "Error", description: "Delete failed", variant: "destructive" }); }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <ToolLayout title="File Manager" description="Manage your assets and documents">
      <div className="bg-white border-4 border-black p-6 shadow-brutal min-h-[600px]">
        
        {/* Controls */}
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 mb-6">
           <div className="flex items-center gap-2 w-full xl:w-auto">
              {currentFolderId && (
                  <Button variant="outline" size="icon" onClick={navigateUp} title="Go Up">
                      <ArrowLeft className="h-4 w-4"/>
                  </Button>
              )}
              <h2 className="text-2xl font-black uppercase truncate max-w-[200px] md:max-w-md">
                  {search ? 'Search Results' : (breadcrumbs.length > 0 ? breadcrumbs[breadcrumbs.length - 1].name : 'Library')}
              </h2>
           </div>
           
           <div className="flex flex-wrap gap-2 w-full xl:w-auto items-center">
              <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground"/>
                  <Input placeholder="Search..." className="pl-8 w-32" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              
              <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-[90px]"><SelectValue placeholder="Type" /></SelectTrigger>
                  <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="image">Images</SelectItem>
                      <SelectItem value="document">Docs</SelectItem>
                  </SelectContent>
              </Select>

              <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger className="w-[120px]"><SelectValue placeholder="Category" /></SelectTrigger>
                  <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
              </Select>

              <Select value={filterTag} onValueChange={setFilterTag}>
                  <SelectTrigger className="w-[100px]"><SelectValue placeholder="Tag" /></SelectTrigger>
                  <SelectContent>
                      <SelectItem value="all">All Tags</SelectItem>
                      {tags.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
              </Select>
              
              <Button variant="outline" size="icon" disabled={isViewer} onClick={() => setShowNewCategory(true)} title="Add Category"><Layers className="h-4 w-4"/></Button>

              <Button variant="outline" disabled={isViewer} onClick={() => setShowNewFolder(!showNewFolder)}>
                <Plus className="mr-2 h-4 w-4"/> Folder
              </Button>

              <div className="relative">
                <input type="file" ref={fileInputRef} className="hidden" onChange={handleUpload} />
                <Button onClick={() => fileInputRef.current?.click()} disabled={uploading || isViewer}>
                    {uploading ? <Loader2 className="animate-spin mr-2"/> : <Upload className="mr-2"/>}
                    Upload
                </Button>
              </div>
           </div>
        </div>

        {/* New Folder Input */}
        {showNewFolder && (
            <div className="mb-6 flex gap-2 items-center bg-muted p-4 border-2 border-black border-dashed">
                <FolderIcon className="h-5 w-5"/>
                <Input placeholder="Folder Name" value={newFolderName} onChange={e => setNewFolderName(e.target.value)} className="bg-white max-w-xs" />
                <Button size="sm" onClick={handleCreateFolder} disabled={!newFolderName.trim()}>Create</Button>
                <Button size="sm" variant="ghost" onClick={() => setShowNewFolder(false)}>Cancel</Button>
            </div>
        )}

        {/* Content */}
        {loading ? (
            <div className="text-center py-10"><Loader2 className="animate-spin mx-auto"/></div>
        ) : assets.length === 0 && folders.length === 0 ? (
            <div className="text-center py-10 border-2 border-dashed border-black bg-muted">
                <FolderIcon className="h-12 w-12 mx-auto mb-2 opacity-50"/>
                <p className="font-bold text-muted-foreground">No files or folders found.</p>
            </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Folders */}
                {!search && folders.map(folder => (
                    <div key={folder.id} 
                        className="border-2 border-black p-4 hover:bg-accent transition-all flex items-center gap-3 bg-yellow-50 group"
                        onDoubleClick={() => navigateToFolder(folder)}
                        onClick={(e) => { e.stopPropagation(); navigateToFolder(folder); }}
                    >
                        <FolderIcon className="h-8 w-8 fill-yellow-400 text-black"/>
                        <div className="flex-1 overflow-hidden">
                            <p className="font-bold truncate">{folder.name}</p>
                            {folder.tags && folder.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                    {folder.tags.map(t => (
                                        <span key={t.id} className="text-[10px] bg-black text-white px-1 rounded">{t.name}</span>
                                    ))}
                                </div>
                            )}
                        </div>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100"><MoreVertical className="h-4 w-4"/></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                                <DropdownMenuItem disabled={isViewer} onClick={(e) => { e.stopPropagation(); setEditFolder(folder); setRenameValue(folder.name); }}>
                                    <Edit2 className="mr-2 h-4 w-4"/> Rename
                                </DropdownMenuItem>
                                <DropdownMenuItem disabled={isViewer} onClick={(e) => { e.stopPropagation(); setManageTagsItem({type: 'folder', item: folder}); }}>
                                    <Tag className="mr-2 h-4 w-4"/> Manage Tags
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem disabled={isViewer} className="text-red-600" onClick={(e) => { e.stopPropagation(); setDeleteFolder(folder); }}>
                                    <Trash2 className="mr-2 h-4 w-4"/> Delete
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                ))}

                {/* Assets */}
                {assets.map(asset => (
                    <div key={asset.id} className="border-2 border-black p-4 hover:shadow-brutal transition-all flex items-start gap-3 bg-white group">
                        <div className="bg-muted p-2 border border-black rounded">
                            <File className="h-8 w-8"/>
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <p className="font-bold truncate" title={asset.name}>{asset.name}</p>
                            <p className="text-xs text-muted-foreground">{formatSize(asset.size_bytes)} • {new Date(asset.created_at).toLocaleDateString()}</p>
                            {asset.tags && asset.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                    {asset.tags.map(t => (
                                        <span key={t.id} className="text-[10px] bg-black text-white px-1 rounded">{t.name}</span>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="flex flex-col gap-1">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0"><MoreVertical className="h-4 w-4"/></Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                    {/* Download allowed for Viewers */}
                                    <DropdownMenuItem onClick={() => handleDownload(asset)}>
                                        <Download className="mr-2 h-4 w-4"/> Download
                                    </DropdownMenuItem>
                                    <DropdownMenuItem disabled={isViewer} onClick={() => setManageTagsItem({type: 'asset', item: asset})}>
                                        <Tag className="mr-2 h-4 w-4"/> Manage Tags
                                    </DropdownMenuItem>
                                    <DropdownMenuItem disabled={isViewer} onClick={() => handleDeleteAsset(asset.id)}>
                                        <Trash2 className="mr-2 h-4 w-4"/> Delete
                                    </DropdownMenuItem>
                                    {search && (
                                        <DropdownMenuItem onClick={() => handleShowInFolder(asset.folder_id)}>
                                            <ExternalLink className="mr-2 h-4 w-4"/> Show in Folder
                                        </DropdownMenuItem>
                                    )}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem disabled={isViewer} className="text-red-600" onClick={() => handleDeleteAsset(asset.id)}>
                                        <Trash2 className="mr-2 h-4 w-4"/> Delete
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>
                ))}
            </div>
        )}
      </div>

      {/* Rename Dialog */}
      <Dialog open={!!editFolder} onOpenChange={(o) => !o && setEditFolder(null)}>
          <DialogContent>
              <DialogHeader><DialogTitle>Rename Folder</DialogTitle></DialogHeader>
              <Input value={renameValue} onChange={e => setRenameValue(e.target.value)} />
              <DialogFooter>
                  <Button onClick={onRenameFolder}>Save</Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>

      {/* Delete Folder Dialog */}
      <Dialog open={!!deleteFolder} onOpenChange={(o) => !o && setDeleteFolder(null)}>
          <DialogContent>
              <DialogHeader><DialogTitle>Delete Folder</DialogTitle></DialogHeader>
              <div className="py-4">
                  <p className="mb-4">Are you sure you want to delete "{deleteFolder?.name}"?</p>
                  <div className="flex items-center space-x-2">
                      <Checkbox id="delContent" checked={deleteContent} onCheckedChange={(c) => setDeleteContent(!!c)} />
                      <Label htmlFor="delContent">Delete all files inside (Recursive)</Label>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">If unchecked, files will move to the main library.</p>
              </div>
              <DialogFooter>
                  <Button variant="destructive" onClick={onDeleteFolder}>Delete</Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
      
      {/* Manage Tags Dialog */}
      <Dialog open={!!manageTagsItem} onOpenChange={(o) => !o && setManageTagsItem(null)}>
          <DialogContent>
              <DialogHeader><DialogTitle>Manage Tags</DialogTitle></DialogHeader>
              <div className="space-y-4">
                  {/* Current Tags */}
                  <div className="flex flex-wrap gap-2">
                      {manageTagsItem?.item.tags?.map(tag => (
                          <span key={tag.id} className="bg-black text-white px-2 py-1 rounded flex items-center gap-1 text-sm">
                              {tag.name}
                              <X className="h-3 w-3 cursor-pointer hover:text-red-400" onClick={() => handleDetachTag(tag.id)}/>
                          </span>
                      ))}
                      {(!manageTagsItem?.item.tags || manageTagsItem.item.tags.length === 0) && <span className="text-muted-foreground text-sm">No tags assigned.</span>}
                  </div>
                  
                  {/* Add Tag */}
                  <div className="pt-4 border-t">
                      <Label className="mb-2 block">Add Tag</Label>
                      <div className="flex flex-wrap gap-2">
                          {tags.filter(t => !manageTagsItem?.item.tags?.some(existing => existing.id === t.id)).map(tag => (
                              <Button key={tag.id} size="sm" variant="outline" onClick={() => handleAttachTag(tag.id)} className="h-6 text-xs">
                                  <Plus className="mr-1 h-3 w-3"/> {tag.name}
                              </Button>
                          ))}
                      </div>
                  </div>
              </div>
          </DialogContent>
      </Dialog>
      
      {/* New Category Dialog */}
      <Dialog open={showNewCategory} onOpenChange={setShowNewCategory}>
          <DialogContent>
              <DialogHeader><DialogTitle>New Category</DialogTitle></DialogHeader>
              <Input placeholder="Category Name" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} />
              <DialogFooter>
                  <Button onClick={handleCreateCategory}>Create</Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>

    </ToolLayout>
  );
}

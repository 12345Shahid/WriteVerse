import { useState, useEffect } from "react";
import { useTeam } from "@/context/TeamContext";
import { createTeam, inviteMember, listMembers, TeamMember } from "@/lib/api-teams";
import { Button } from "@/components/ui/button-brutal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Users, Plus, Briefcase, Copy, Check } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { ToolLayout } from "@/components/tool/ToolLayout";

const TeamSettings = () => {
  const { teams, currentTeam, switchTeam, refreshTeams } = useTeam();
  const { toast } = useToast();
  
  const [isCreating, setIsCreating] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("viewer");
  const [isInviting, setIsInviting] = useState(false);
  const [lastInviteLink, setLastInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (currentTeam) {
      loadMembers(currentTeam.id);
      setLastInviteLink(null); // Reset link on switch
    } else {
      setMembers([]);
    }
  }, [currentTeam]);

  const loadMembers = async (teamId: string) => {
    setIsLoadingMembers(true);
    try {
      const list = await listMembers(teamId);
      setMembers(list);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingMembers(false);
    }
  };

  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) return;
    setIsCreating(true);
    try {
      const newTeam = await createTeam(newTeamName);
      await refreshTeams();
      switchTeam(newTeam.id);
      setNewTeamName("");
      toast({ title: "Success", description: "Team created!" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    } finally {
      setIsCreating(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !currentTeam) return;
    setIsInviting(true);
    setLastInviteLink(null);
    try {
      const res = await inviteMember(currentTeam.id, inviteEmail, inviteRole);
      if (res.inviteLink) {
        setLastInviteLink(res.inviteLink);
        toast({ title: "Invite Created", description: "Share the link below with the user." });
      } else {
        toast({ title: "Success", description: res.message });
      }
      setInviteEmail("");
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    } finally {
      setIsInviting(false);
    }
  };

  const copyLink = () => {
    if (!lastInviteLink) return;
    navigator.clipboard.writeText(lastInviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Copied", description: "Link copied to clipboard" });
  };

  return (
    <ToolLayout title="Team Management" description="Manage your workspaces and team members">
      <div className="grid lg:grid-cols-3 gap-8">
        
        {/* Left Column: Team Switcher & Creation */}
        <div className="space-y-8">
          <div className="border-4 border-black bg-white p-6 shadow-brutal">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 uppercase">
              <Briefcase className="w-5 h-5" /> Your Workspaces
            </h2>
            <div className="space-y-2 mb-6">
              {teams.map(team => (
                <button
                  key={team.id}
                  onClick={() => switchTeam(team.id)}
                  className={`w-full text-left p-3 border-2 font-bold transition-all
                    ${currentTeam?.id === team.id 
                      ? "bg-black text-white border-black" 
                      : "bg-white text-black border-black hover:bg-gray-100"
                    }`}
                >
                  {team.name}
                  <span className="float-right text-xs font-normal bg-white/20 px-2 py-1 rounded">
                    {team.role}
                  </span>
                </button>
              ))}
            </div>

            <div className="pt-4 border-t-2 border-black border-dashed space-y-3">
              <Label>Create New Workspace</Label>
              <div className="flex gap-2">
                <Input 
                  value={newTeamName}
                  onChange={e => setNewTeamName(e.target.value)}
                  placeholder="Acme Corp"
                  className="input-brutal"
                />
                <Button onClick={handleCreateTeam} disabled={isCreating || !newTeamName}>
                  {isCreating ? <Loader2 className="animate-spin" /> : <Plus />}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Members & Invites */}
        <div className="lg:col-span-2 space-y-8">
          {currentTeam ? (
            <>
              <div className="border-4 border-black bg-brutalist-pink p-6 shadow-brutal">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-2xl font-bold uppercase flex items-center gap-2">
                      <Users className="w-6 h-6" /> {currentTeam.name} Members
                    </h2>
                    <p className="text-sm font-medium opacity-80">Manage access and roles.</p>
                  </div>
                  <div className="bg-white border-2 border-black px-3 py-1 font-mono text-sm font-bold">
                    ID: {currentTeam.id.slice(0, 8)}...
                  </div>
                </div>

                {isLoadingMembers ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : (
                  <div className="bg-white border-2 border-black divide-y-2 divide-black">
                    {members.map(m => (
                      <div key={m.id} className="p-4 flex justify-between items-center">
                        <div>
                          <div className="font-bold">{m.email}</div>
                          <div className="text-xs text-gray-500">Joined: {new Date(m.joinedAt).toLocaleDateString()}</div>
                        </div>
                        <span className="uppercase text-xs font-black bg-yellow-300 px-2 py-1 border border-black">
                          {m.role}
                        </span>
                      </div>
                    ))}
                    {members.length === 0 && (
                      <div className="p-4 text-center text-gray-500">No members found (Wait, you should be one?)</div>
                    )}
                  </div>
                )}
              </div>

              {['owner', 'admin'].includes(currentTeam.role) && (
                <div className="border-4 border-black bg-white p-6 shadow-brutal space-y-6">
                  
                  {/* Invite Form */}
                  <div>
                    <h3 className="text-xl font-bold mb-4 uppercase">Invite New Member</h3>
                    <div className="flex flex-col md:flex-row gap-4 items-end">
                      <div className="flex-grow space-y-2 w-full">
                        <Label>Email Address</Label>
                        <Input 
                          value={inviteEmail}
                          onChange={e => setInviteEmail(e.target.value)}
                          placeholder="colleague@company.com"
                          className="input-brutal"
                        />
                      </div>
                      <div className="w-full md:w-48 space-y-2">
                        <Label>Role</Label>
                        <Select value={inviteRole} onValueChange={setInviteRole}>
                          <SelectTrigger className="input-brutal bg-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="viewer">Viewer</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button 
                        onClick={handleInvite} 
                        disabled={isInviting || !inviteEmail}
                        className="w-full md:w-auto bg-black text-white h-12"
                      >
                        {isInviting ? <Loader2 className="animate-spin mr-2" /> : <Users className="mr-2 w-4 h-4" />}
                        Invite
                      </Button>
                    </div>
                  </div>

                  {/* Copy Link Result */}
                  {lastInviteLink && (
                    <div className="bg-green-100 border-2 border-black p-4 animate-in fade-in zoom-in duration-300">
                      <Label className="text-green-800 font-bold mb-2 block">Invitation Created! Share this link:</Label>
                      <div className="flex gap-2">
                        <Input readOnly value={lastInviteLink} className="bg-white font-mono text-xs" />
                        <Button onClick={copyLink} variant="outline" className="bg-white">
                          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                  )}

                </div>
              )}
            </>
          ) : (
            <div className="border-4 border-black bg-gray-100 p-12 text-center border-dashed">
              <Briefcase className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <h3 className="text-xl font-bold text-gray-500">Select a Workspace to manage members</h3>
            </div>
          )}
        </div>

      </div>
    </ToolLayout>
  );
};

export default TeamSettings;

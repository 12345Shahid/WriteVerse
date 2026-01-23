import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { listTeams, Team } from "@/lib/api-teams";
import { supabase } from "@/lib/supabase";

interface TeamContextType {
  teams: Team[];
  currentTeam: Team | null;
  isLoading: boolean;
  refreshTeams: (retryOnEmpty?: boolean) => Promise<void>;
  switchTeam: (teamId: string) => void;
}

const TeamContext = createContext<TeamContextType | undefined>(undefined);

export const TeamProvider = ({ children }: { children: ReactNode }) => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [currentTeam, setCurrentTeam] = useState<Team | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshTeams = async (retryOnEmpty: boolean = false) => {
    try {
      setIsLoading(true);
      const session = await supabase.auth.getSession();
      if (!session.data.session) {
        setTeams([]);
        setCurrentTeam(null);
        return;
      }

      let data = await listTeams();
      
      // If no teams found and retryOnEmpty is true, retry a few times
      // This handles the race condition after fresh signup
      if ((!data || data.length === 0) && retryOnEmpty) {
        let retries = 0;
        const maxRetries = 4;
        while ((!data || data.length === 0) && retries < maxRetries) {
          console.log(`[TeamContext] No teams found, retrying... (${retries + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, 600));
          data = await listTeams();
          retries++;
        }
      }
      
      setTeams(data);
      
      // Restore selected team from localStorage or default to first
      const savedId = localStorage.getItem("writerai_active_team");
      const found = data.find(t => t.id === savedId) || data[0] || null;
      setCurrentTeam(found);
      if (found) localStorage.setItem("writerai_active_team", found.id);
      
    } catch (err) {
      console.error("Failed to load teams", err);
    } finally {
      setIsLoading(false);
    }
  };

  const switchTeam = (teamId: string) => {
    const found = teams.find(t => t.id === teamId);
    if (found) {
      setCurrentTeam(found);
      localStorage.setItem("writerai_active_team", found.id);
      // Reloading page is a crude but effective way to ensure all data fetching hooks 
      // (which might rely on current org ID) reset. 
      // For a SPA, better to just update state, but let's update state for now.
    }
  };

  useEffect(() => {
    refreshTeams();
    
    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      // On sign in, retry if teams are empty (handles fresh signup race condition)
      const shouldRetry = event === 'SIGNED_IN';
      refreshTeams(shouldRetry);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <TeamContext.Provider value={{ teams, currentTeam, isLoading, refreshTeams, switchTeam }}>
      {children}
    </TeamContext.Provider>
  );
};

export const useTeam = () => {
  const context = useContext(TeamContext);
  if (context === undefined) {
    throw new Error("useTeam must be used within a TeamProvider");
  }
  return context;
};

import { supabase } from "./supabase";

// Since we are using a custom backend for some operations but supabase for auth, 
// we need to decide if we call the backend API (port 8787) or Supabase directly.
// The backend endpoints we created (port 8787) use supabaseAdmin to bypass RLS for some things,
// but also enforce business logic. Let's use the backend API.

const API_URL = "http://localhost:8787/api";

async function getHeaders() {
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  return {
    "Content-Type": "application/json",
    "x-user-id": session?.user?.id || "",
    // "Authorization": `Bearer ${session?.access_token}` // If backend verified tokens
  };
}

export interface Team {
  id: string;
  name: string;
  role: "owner" | "admin" | "editor" | "viewer";
  created_at: string;
}

export interface TeamMember {
  id: string;
  userId: string;
  email: string;
  role: "owner" | "admin" | "editor" | "viewer";
  joinedAt: string;
}

export async function listTeams(): Promise<Team[]> {
  const headers = await getHeaders();
  const res = await fetch(`${API_URL}/teams`, { headers });
  if (!res.ok) throw new Error("Failed to list teams");
  const data = await res.json();
  return data.teams || [];
}

export async function createTeam(name: string): Promise<Team> {
  const headers = await getHeaders();
  const res = await fetch(`${API_URL}/teams`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error("Failed to create team");
  const data = await res.json();
  return data.team;
}

export async function listMembers(teamId: string): Promise<TeamMember[]> {
  const headers = await getHeaders();
  const res = await fetch(`${API_URL}/teams/${teamId}/members`, { headers });
  if (!res.ok) throw new Error("Failed to list members");
  const data = await res.json();
  return data.members || [];
}

export async function inviteMember(teamId: string, email: string, role: string) {
  const headers = await getHeaders();
  const res = await fetch(`${API_URL}/teams/${teamId}/invite`, {
    method: "POST",
    headers,
    body: JSON.stringify({ email, role }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || "Failed to invite member");
  }
  return await res.json();
}

export async function getTeamCredits(teamId: string): Promise<{ balance_credits: number; total_spent_usd: number }> {
  const headers = await getHeaders();
  const res = await fetch(`${API_URL}/teams/${teamId}/credits`, { headers });
  if (!res.ok) throw new Error("Failed to fetch team credits");
  return await res.json();
}

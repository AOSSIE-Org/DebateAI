import { getAuthToken } from '@/utils/auth';

const API_BASE_URL = import.meta.env.VITE_BASE_URL || 'http://localhost:1313';

export interface SideScores {
  sideA: number;
  sideB: number;
}

export interface JudgementScores {
  logic: SideScores;
  evidence: SideScores;
  persuasion: SideScores;
  rebuttal: SideScores;
}

export interface JudgementResult {
  winner: string;
  scores: JudgementScores;
  summary: string;
}

async function parseJSONResponse(resp: Response) {
  const text = await resp.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    // Try to extract fenced JSON if model returns markdown
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (fence && fence[1]) {
      try {
        return JSON.parse(fence[1]);
      } catch {
        // fallthrough
      }
    }
    throw new Error('Invalid JSON response');
  }
}

function extractErrorMessage(err: any, fallback = 'Request failed') {
  if (!err) return fallback;
  if (typeof err === 'string') return err;
  if (err?.message) return err.message;
  return fallback;
}

export async function judgeDebate(debateId: string): Promise<JudgementResult> {
  const token = getAuthToken();
  if (!token) throw new Error('Authentication token not found');

  const res = await fetch(`${API_BASE_URL}/debate/${debateId}/judge`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });

  if (!res.ok) {
    let data = null;
    try {
      data = await parseJSONResponse(res);
    } catch {}
    const msg = data?.error || data?.message || res.statusText || 'Failed to judge debate';
    throw new Error(msg);
  }

  const data = await parseJSONResponse(res);
  return data?.result || data;
}

export async function getJudgement(debateId: string): Promise<JudgementResult> {
  const token = getAuthToken();
  if (!token) throw new Error('Authentication token not found');

  const res = await fetch(`${API_BASE_URL}/debate/${debateId}/judge`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    let data = null;
    try {
      data = await parseJSONResponse(res);
    } catch {}
    const msg = data?.error || data?.message || res.statusText || 'Failed to fetch judgement';
    throw new Error(msg);
  }

  const data = await parseJSONResponse(res);
  return data;
}

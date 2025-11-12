import { atom } from 'jotai';

export interface Comment {
  id: string;
  transcriptId: string;
  parentId?: string | null;
  path: string[];
  content: string;
  userId: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
  children?: Comment[];
}

// Atom for comments by transcript ID
export const commentsByTranscriptAtom = atom<Record<string, Comment[]>>({});

// Helper atom to get comments for a specific transcript
export const getCommentsForTranscriptAtom = (transcriptId: string) =>
  atom((get) => get(commentsByTranscriptAtom)[transcriptId] || []);

// Helper atom to set comments for a specific transcript
export const setCommentsForTranscriptAtom = (transcriptId: string) =>
  atom(null, (get, set, comments: Comment[]) => {
    const current = get(commentsByTranscriptAtom);
    set(commentsByTranscriptAtom, {
      ...current,
      [transcriptId]: comments,
    });
  });

// Helper atom to add a comment to a transcript
export const addCommentToTranscriptAtom = (transcriptId: string) =>
  atom(null, (get, set, comment: Comment) => {
    const current = get(commentsByTranscriptAtom);
    const existing = current[transcriptId] || [];
    set(commentsByTranscriptAtom, {
      ...current,
      [transcriptId]: [...existing, comment],
    });
  });

// Helper atom to remove a comment from a transcript
export const removeCommentFromTranscriptAtom = (transcriptId: string) =>
  atom(null, (get, set, commentId: string) => {
    const current = get(commentsByTranscriptAtom);
    const existing = current[transcriptId] || [];
    
    const removeFromTree = (comments: Comment[]): Comment[] => {
      return comments
        .filter((c) => c.id !== commentId)
        .map((c) => ({
          ...c,
          children: c.children ? removeFromTree(c.children) : undefined,
        }));
    };
    
    set(commentsByTranscriptAtom, {
      ...current,
      [transcriptId]: removeFromTree(existing),
    });
  });


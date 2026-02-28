import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  MessageSquare,
  Bot,
  Users,
  Trophy,
  XCircle,
  MinusCircle,
  Clock,
  Trash2,
  Eye,
  Calendar,
  User,
} from 'lucide-react';
import {
  transcriptService,
  SavedDebateTranscript,
} from '@/services/transcriptService';
import { format } from 'date-fns';
import CommentTree from './CommentTree';
import Assumptions from './Assumptions';
import { Share2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface SavedTranscriptsProps {
  className?: string;
}

const SavedTranscripts: React.FC<SavedTranscriptsProps> = ({ className }) => {
  const navigate = useNavigate();
  const [transcripts, setTranscripts] = useState<SavedDebateTranscript[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTranscript, setSelectedTranscript] =
    useState<SavedDebateTranscript | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [creatingPost, setCreatingPost] = useState(false);

  useEffect(() => {
    fetchTranscripts();
  }, []);

  const fetchTranscripts = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await transcriptService.getUserTranscripts();
      if (data && data.length > 0) {
      }
      setTranscripts(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to fetch transcripts'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTranscript = async (id: string) => {

    if (
      !confirm(
        'Are you sure you want to delete this transcript? This action cannot be undone.'
      )
    ) {
      return;
    }

    try {
      setDeletingId(id);
      await transcriptService.deleteTranscript(id);
      setTranscripts(transcripts.filter((t) => t.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete transcript');
    } finally {
      setDeletingId(null);
    }
  };

  const handleViewTranscript = (transcript: SavedDebateTranscript) => {
    setSelectedTranscript(transcript);
    setIsViewDialogOpen(true);
  };

  const handleCreatePost = async () => {
    if (!selectedTranscript) return;

    setCreatingPost(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Please log in to create a post');
        return;
      }

      const baseURL = import.meta.env.VITE_BASE_URL || 'http://localhost:1313';
      const response = await fetch(`${baseURL}/posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          transcriptId: selectedTranscript.id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create post');
      }

      alert(
        'Post created successfully! You can view it in the Community Feed.'
      );
      navigate('/community');
    } catch (err) {
      console.error('Error creating post:', err);
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to create post';
      alert(errorMessage);
    } finally {
      setCreatingPost(false);
    }
  };

  const getResultIcon = (result: string) => {
    switch (result) {
      case 'win':
        return <Trophy className='w-4 h-4 text-yellow-500' />;
      case 'loss':
        return <XCircle className='w-4 h-4 text-red-500' />;
      case 'draw':
        return <MinusCircle className='w-4 h-4 text-gray-500' />;
      default:
        return <Clock className='w-4 h-4 text-blue-500' />;
    }
  };

  const getResultColor = (result: string) => {
    switch (result) {
      case 'win':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'loss':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'draw':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  const getDebateTypeIcon = (type: string) => {
    return type === 'user_vs_bot' ? (
      <Bot className='w-4 h-4' />
    ) : (
      <Users className='w-4 h-4' />
    );
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <MessageSquare className='w-5 h-5' />
            Saved Debate Transcripts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className='flex items-center justify-center py-8'>
            <div className='text-center'>
              <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2'></div>
              <p className='text-sm text-muted-foreground'>
                Loading transcripts...
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <MessageSquare className='w-5 h-5' />
            Saved Debate Transcripts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className='text-center py-8'>
            <XCircle className='w-8 h-8 text-red-500 mx-auto mb-2' />
            <p className='text-sm text-red-600 mb-2'>{error}</p>
            <Button onClick={fetchTranscripts} variant='outline' size='sm'>
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className={className}>
        <CardHeader>
          <div className='flex items-center justify-between'>
            <CardTitle className='flex items-center gap-2'>
              <MessageSquare className='w-5 h-5' />
              Saved Debate Transcripts
              <Badge variant='secondary' className='ml-2'>
                {transcripts.length}
              </Badge>
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {transcripts.length === 0 ? (
            <div className='text-center py-8'>
              <MessageSquare className='w-12 h-12 text-muted-foreground mx-auto mb-4' />
              <h3 className='text-lg font-semibold mb-2'>
                No saved transcripts
              </h3>
              <p className='text-sm text-muted-foreground mb-4'>
                Your debate transcripts will appear here after you complete
                debates.
              </p>
            </div>
          ) : (
            <div className='space-y-3'>
              {transcripts.map((transcript) => (
                <div
                  key={transcript.id}
                  className='border rounded-lg p-4 hover:bg-muted/50 transition-colors'
                >
                  <div className='flex items-start justify-between mb-3'>
                    <div className='flex-1'>
                      <div className='flex items-center gap-2 mb-2'>
                        {getDebateTypeIcon(transcript.debateType)}
                        <h3 className='font-semibold text-sm'>
                          {transcript.topic}
                        </h3>
                        <Badge
                          variant='outline'
                          className={`text-xs ${getResultColor(
                            transcript.result
                          )}`}
                        >
                          {getResultIcon(transcript.result)}
                          <span className='ml-1 capitalize'>
                            {transcript.result}
                          </span>
                        </Badge>
                      </div>
                      <div className='flex items-center gap-4 text-xs text-muted-foreground'>
                        <div className='flex items-center gap-1'>
                          <User className='w-3 h-3' />
                          <span>vs {transcript.opponent}</span>
                        </div>
                        <div className='flex items-center gap-1'>
                          <Calendar className='w-3 h-3' />
                          <span>
                            {format(
                              new Date(transcript.createdAt),
                              'MMM dd, yyyy'
                            )}
                          </span>
                        </div>
                        <div className='flex items-center gap-1'>
                          <MessageSquare className='w-3 h-3' />
                          <span>{transcript.messages.length} messages</span>
                        </div>
                        {transcript.debateType === 'user_vs_bot' && (
                          <div className='flex items-center gap-1'>
                            <Bot className='w-3 h-3' />
                            <span>Bot Debate</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className='flex items-center gap-2'>
                      <Button
                        variant='outline'
                        size='sm'
                        onClick={() => handleViewTranscript(transcript)}
                        className='h-8 px-2'
                      >
                        <Eye className='w-3 h-3 mr-1' />
                        View
                      </Button>
                      <Button
                        variant='outline'
                        size='sm'
                        onClick={() => handleDeleteTranscript(transcript.id)}
                        disabled={deletingId === transcript.id}
                        className='h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-50'
                      >
                        <Trash2 className='w-3 h-3' />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* View Transcript Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className='max-w-4xl max-h-[90vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2'>
              <MessageSquare className='w-5 h-5' />
              Debate Transcript
            </DialogTitle>
          </DialogHeader>
          {selectedTranscript && (
            <div className='space-y-4'>
              <div className='grid grid-cols-2 gap-4 text-sm'>
                <div>
                  <span className='font-semibold'>Topic:</span>
                  <p className='text-muted-foreground'>
                    {selectedTranscript.topic}
                  </p>
                </div>
                <div>
                  <span className='font-semibold'>Opponent:</span>
                  <p className='text-muted-foreground'>
                    {selectedTranscript.opponent}
                    {selectedTranscript.debateType === 'user_vs_bot' && (
                      <span className='ml-1 text-xs bg-blue-100 text-blue-800 px-1 rounded'>
                        Bot
                      </span>
                    )}
                  </p>
                </div>
                <div>
                  <span className='font-semibold'>Type:</span>
                  <p className='text-muted-foreground capitalize'>
                    {selectedTranscript.debateType.replace('_', ' ')}
                  </p>
                </div>
                <div>
                  <span className='font-semibold'>Result:</span>
                  <div className='flex items-center gap-1'>
                    {getResultIcon(selectedTranscript.result)}
                    <span className='text-muted-foreground capitalize'>
                      {selectedTranscript.result}
                    </span>
                  </div>
                </div>
                <div>
                  <span className='font-semibold'>Date:</span>
                  <p className='text-muted-foreground'>
                    {format(new Date(selectedTranscript.createdAt), 'PPP')}
                  </p>
                </div>
                <div>
                  <span className='font-semibold'>Messages:</span>
                  <p className='text-muted-foreground'>
                    {selectedTranscript.messages.length}
                  </p>
                </div>
              </div>

              <Separator />

              <div>
                <h4 className='font-semibold mb-3'>Conversation</h4>
                <ScrollArea className='h-64 border rounded-lg p-4'>
                  <div className='space-y-3'>
                    {selectedTranscript.messages.map((message, index) => (
                      <div
                        key={index}
                        className={`flex gap-3 ${message.sender === 'User'
                            ? 'justify-end'
                            : 'justify-start'
                          }`}
                      >
                        <div
                          className={`max-w-[80%] rounded-lg p-3 ${message.sender === 'User'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted'
                            }`}
                        >
                          <div className='flex items-center gap-2 mb-1'>
                            <span className='text-xs font-medium'>
                              {message.sender}
                            </span>
                            {message.phase && (
                              <Badge variant='outline' className='text-xs'>
                                {message.phase}
                              </Badge>
                            )}
                            {selectedTranscript.debateType === 'user_vs_bot' &&
                              message.sender === 'Bot' && (
                                <Badge
                                  variant='secondary'
                                  className='text-xs bg-blue-100 text-blue-800'
                                >
                                  AI
                                </Badge>
                              )}
                          </div>
                          <p className='text-sm whitespace-pre-wrap'>
                            {message.text}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              {selectedTranscript.transcripts &&
                Object.keys(selectedTranscript.transcripts).length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h4 className='font-semibold mb-3'>Phase Transcripts</h4>
                      <div className='space-y-3'>
                        {Object.entries(selectedTranscript.transcripts).map(
                          ([phase, transcript]) => (
                            <div key={phase} className='border rounded-lg p-3'>
                              <h5 className='font-medium text-sm mb-2 capitalize'>
                                {phase.replace(/([A-Z])/g, ' $1').trim()}
                              </h5>
                              <p className='text-sm text-muted-foreground whitespace-pre-wrap'>
                                {transcript}
                              </p>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  </>
                )}

              <Separator />

              <div className='flex justify-between items-center'>
                <Button
                  onClick={handleCreatePost}
                  disabled={creatingPost}
                  className='flex items-center gap-2'
                  variant='default'
                >
                  <Share2 className='w-4 h-4' />
                  {creatingPost ? 'Creating Post...' : 'Create Post'}
                </Button>
              </div>

              <Separator />

              {/* Assumptions Section */}
              <div>
                <Assumptions debateId={selectedTranscript.id} />
              </div>

              <Separator />

              <div>
                <CommentTree
                  transcriptId={selectedTranscript.id}
                  onCommentAdded={() => {
                    // Refresh comments after adding
                  }}
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SavedTranscripts;

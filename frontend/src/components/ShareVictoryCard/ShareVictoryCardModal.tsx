import React, { useRef, useState, useEffect } from 'react';
import { toPng, toBlob } from 'html-to-image';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { DebateVictoryCardData, CardTheme } from './types';
import DebateVictoryCard from './DebateVictoryCard';
import {
  Download,
  Copy,
  Check,
  Share2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import { FaXTwitter } from 'react-icons/fa6';

interface ShareVictoryCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: DebateVictoryCardData | null;
}

export const ShareVictoryCardModal: React.FC<ShareVictoryCardModalProps> = ({
  isOpen,
  onClose,
  data,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);

  const [theme, setTheme] = useState<CardTheme>('championship');
  const [scale, setScale] = useState<number>(0.6);
  const [zoomMode, setZoomMode] = useState<'fit' | '75' | '100'>('fit');
  const [isDownloading, setIsDownloading] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Auto-fit preview calculation
  useEffect(() => {
    if (!isOpen) {
      setFeedbackMessage(null);
      setCopySuccess(false);
      return;
    }

    const updateScale = () => {
      if (zoomMode === '100') {
        setScale(1);
        return;
      }
      if (zoomMode === '75') {
        setScale(0.75);
        return;
      }
      if (previewContainerRef.current) {
        const containerWidth = previewContainerRef.current.clientWidth - 16;
        const targetScale = Math.min(1, Math.max(0.3, containerWidth / 1200));
        setScale(targetScale);
      }
    };

    updateScale();
    const resizeObserver = new ResizeObserver(() => updateScale());
    if (previewContainerRef.current) {
      resizeObserver.observe(previewContainerRef.current);
    }

    window.addEventListener('resize', updateScale);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateScale);
    };
  }, [isOpen, zoomMode]);

  // Clean slug for filename
  const getCleanSlug = (text?: string): string => {
    if (!text) return 'debate';
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 30);
  };

  // Download high-resolution PNG (2x pixel ratio -> 2400 x 1260 px)
  const handleDownload = async () => {
    if (!cardRef.current || isDownloading) return;
    setIsDownloading(true);
    setFeedbackMessage(null);

    try {
      const dataUrl = await toPng(cardRef.current, {
        pixelRatio: 2,
        cacheBust: true,
      });

      const slug = getCleanSlug(data?.topic);
      const link = document.createElement('a');
      link.download = `debateai-victory-${slug || 'match'}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setFeedbackMessage({
        type: 'success',
        text: 'Card downloaded! High-resolution 2400×1260 PNG saved.',
      });
    } catch (err) {
      setFeedbackMessage({
        type: 'error',
        text: 'Failed to generate PNG image. Please try again.',
      });
    } finally {
      setIsDownloading(false);
    }
  };

  // Copy image to clipboard for 1-click Discord / Slack sharing
  const handleCopyImage = async () => {
    if (!cardRef.current || isCopying) return;
    setIsCopying(true);
    setFeedbackMessage(null);

    try {
      const blob = await toBlob(cardRef.current, {
        pixelRatio: 2,
        cacheBust: true,
      });

      if (!blob) {
        throw new Error('Image generation resulted in empty blob');
      }

      if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
        throw new Error('Clipboard image writing is not supported by this browser. Please use Download PNG.');
      }

      await navigator.clipboard.write([
        new ClipboardItem({
          'image/png': blob,
        }),
      ]);

      setCopySuccess(true);
      setFeedbackMessage({
        type: 'success',
        text: 'Card copied to clipboard! Paste directly into Discord, Slack, or chat.',
      });

      setTimeout(() => setCopySuccess(false), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to copy image to clipboard.';
      setFeedbackMessage({
        type: 'error',
        text: msg.includes('not supported')
          ? msg
          : 'Clipboard copy failed or permission denied. Please use Download PNG.',
      });
    } finally {
      setIsCopying(false);
    }
  };

  // Share to X (Twitter) via intent URL
  const handleShareTwitter = () => {
    if (!data) return;
    const winnerScoreText = data.winner.score !== undefined && data.winner.score !== null ? ` (${data.winner.score} pts)` : '';
    const opponentScoreText = data.opponent.score !== undefined && data.opponent.score !== null ? ` (${data.opponent.score} pts)` : '';

    const text =
      `🏆 Debate Results on DebateAI!\n\n` +
      `Topic: "${data.topic}"\n` +
      `Winner: ${data.winner.name}${winnerScoreText}\n` +
      `Opponent: ${data.opponent.name}${opponentScoreText}\n\n` +
      `Join the arena:`;

    const url = new URL('https://twitter.com/intent/tweet');
    url.searchParams.set('text', text);
    url.searchParams.set('url', 'https://debateai.aossie.org');
    url.searchParams.set('hashtags', 'DebateAI,AOSSIE,CompetitiveDebate');

    window.open(url.toString(), '_blank', 'noopener,noreferrer');
  };

  if (!data) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl w-[95vw] max-h-[92vh] overflow-y-auto p-4 sm:p-6 bg-card border-border shadow-2xl">
        <DialogHeader className="mb-2">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-xl font-bold text-foreground">
              <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20">
                <Share2 className="w-5 h-5" />
              </span>
              Share Debate Victory Card
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs sm:text-sm text-muted-foreground">
            Preview, customize, and export high-resolution match summary cards to share on Discord, X (Twitter), and social media.
          </DialogDescription>
        </DialogHeader>

        {/* Action & Customization Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-muted/60 border border-border">
          {/* Theme Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground mr-1 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Theme:
            </span>
            <button
              onClick={() => setTheme('championship')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                theme === 'championship'
                  ? 'bg-amber-500 text-black shadow-sm'
                  : 'bg-background hover:bg-muted text-foreground border border-border'
              }`}
            >
              Championship
            </button>
            <button
              onClick={() => setTheme('cyber')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                theme === 'cyber'
                  ? 'bg-cyan-500 text-black shadow-sm'
                  : 'bg-background hover:bg-muted text-foreground border border-border'
              }`}
            >
              Cyber Neon
            </button>
            <button
              onClick={() => setTheme('obsidian')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                theme === 'obsidian'
                  ? 'bg-emerald-500 text-black shadow-sm'
                  : 'bg-background hover:bg-muted text-foreground border border-border'
              }`}
            >
              Obsidian
            </button>
          </div>

          {/* Zoom / Preview Controls */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground mr-1">Preview:</span>
            <Button
              size="sm"
              variant={zoomMode === 'fit' ? 'secondary' : 'outline'}
              className="h-7 text-xs px-2.5"
              onClick={() => setZoomMode('fit')}
              title="Fit to Screen"
            >
              <Maximize2 className="w-3 h-3 mr-1" /> Fit
            </Button>
            <Button
              size="sm"
              variant={zoomMode === '75' ? 'secondary' : 'outline'}
              className="h-7 text-xs px-2.5"
              onClick={() => setZoomMode('75')}
              title="75% Zoom"
            >
              <ZoomOut className="w-3 h-3 mr-1" /> 75%
            </Button>
            <Button
              size="sm"
              variant={zoomMode === '100' ? 'secondary' : 'outline'}
              className="h-7 text-xs px-2.5"
              onClick={() => setZoomMode('100')}
              title="100% Original Size"
            >
              <ZoomIn className="w-3 h-3 mr-1" /> 100%
            </Button>
          </div>
        </div>

        {/* Feedback Alert Banner */}
        {feedbackMessage && (
          <div
            className={`p-3 rounded-lg text-xs sm:text-sm font-medium flex items-center gap-2 ${
              feedbackMessage.type === 'success'
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                : 'bg-destructive/15 text-destructive border border-destructive/30'
            }`}
          >
            {feedbackMessage.type === 'success' ? (
              <Check className="w-4 h-4 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
            )}
            <span>{feedbackMessage.text}</span>
          </div>
        )}

        {/* Live Card Preview Box */}
        <div
          ref={previewContainerRef}
          className="relative w-full rounded-2xl bg-black/80 border border-border/80 p-2 sm:p-4 overflow-x-auto flex justify-center items-start min-h-[220px]"
          style={{ maxHeight: '55vh' }}
        >
          <div
            style={{
              width: 1200 * scale,
              height: 630 * scale,
              flexShrink: 0,
              position: 'relative',
              overflow: 'hidden',
              borderRadius: 16,
              boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
            }}
          >
            <div
              style={{
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
                width: 1200,
                height: 630,
              }}
            >
              <DebateVictoryCard ref={cardRef} data={data} theme={theme} />
            </div>
          </div>
        </div>

        {/* Export Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border mt-1">
          <div className="text-xs text-muted-foreground hidden sm:block">
            Exported dimensions: <span className="font-semibold text-foreground">2400 × 1260 px</span> (2× Retina Quality)
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
            {/* Copy to Clipboard Button */}
            <Button
              onClick={handleCopyImage}
              disabled={isCopying}
              variant="outline"
              className="flex-1 sm:flex-none border-border hover:bg-muted text-xs sm:text-sm"
              title="Copy card image to clipboard for instant pasting"
            >
              {copySuccess ? (
                <>
                  <Check className="w-4 h-4 mr-1.5 text-emerald-500" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-1.5" />
                  {isCopying ? 'Generating...' : 'Copy Image'}
                </>
              )}
            </Button>

            {/* Share to X (Twitter) */}
            <Button
              onClick={handleShareTwitter}
              variant="outline"
              className="flex-1 sm:flex-none border-border hover:bg-muted text-xs sm:text-sm"
              title="Share match result directly on X (Twitter)"
            >
              <FaXTwitter className="w-4 h-4 mr-1.5" />
              Share to X
            </Button>

            {/* Download PNG Button */}
            <Button
              onClick={handleDownload}
              disabled={isDownloading}
              className="flex-1 sm:flex-none bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold shadow-md text-xs sm:text-sm"
            >
              <Download className="w-4 h-4 mr-1.5" />
              {isDownloading ? 'Exporting PNG...' : 'Download PNG'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ShareVictoryCardModal;

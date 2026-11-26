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
import { DebateVictoryCard } from './DebateVictoryCard';
import { DebateVictoryCardData } from './types';
import { Trophy, Download, Copy, Check } from 'lucide-react';

interface ShareVictoryCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: DebateVictoryCardData;
}

export const ShareVictoryCardModal: React.FC<ShareVictoryCardModalProps> = ({
  isOpen,
  onClose,
  data,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const updateScale = () => {
      if (containerRef.current) {
        const width = containerRef.current.clientWidth;
        if (width > 0) {
          setScale(width / 1200);
        }
      }
    };

    updateScale();

    // Use ResizeObserver for instant responsive updates on orientation change or window resize
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      observer = new ResizeObserver(() => {
        updateScale();
      });
      observer.observe(containerRef.current);
    }

    window.addEventListener('resize', updateScale);
    const timer1 = setTimeout(updateScale, 50);
    const timer2 = setTimeout(updateScale, 200);

    return () => {
      if (observer) observer.disconnect();
      window.removeEventListener('resize', updateScale);
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [isOpen]);

  // Handle Download Image (PNG)
  const handleDownload = async () => {
    if (!cardRef.current) return;
    try {
      setIsDownloading(true);
      const dataUrl = await toPng(cardRef.current, {
        quality: 0.95,
        pixelRatio: 2,
        cacheBust: true,
      });

      const link = document.createElement('a');
      link.download = `debateai-victory-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to download victory card:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  // Handle Copy Image to Clipboard
  const handleCopy = async () => {
    if (!cardRef.current) return;
    try {
      setIsCopying(true);
      const blob = await toBlob(cardRef.current, {
        quality: 0.95,
        pixelRatio: 2,
        cacheBust: true,
      });

      if (blob && navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob }),
        ]);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      } else {
        const textToCopy = `🏆 Won debate on DebateAI by AOSSIE!\nMotion: "${data.topic}"\nScore: ${data.winner.score || 0} vs ${data.opponent.score || 0}\nJoin the debate: https://debateai.aossie.org`;
        await navigator.clipboard.writeText(textToCopy);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } catch (err) {
      console.error('Failed to copy card to clipboard:', err);
      try {
        const textToCopy = `🏆 Won debate on DebateAI by AOSSIE!\nMotion: "${data.topic}"\nScore: ${data.winner.score || 0} vs ${data.opponent.score || 0}`;
        await navigator.clipboard.writeText(textToCopy);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      } catch (e) {
        console.error(e);
      }
    } finally {
      setIsCopying(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        onInteractOutside={(e) => {
          const target = e.target as HTMLElement;
          if (
            target?.closest?.('.social-share-modal-overlay') ||
            target?.closest?.('.social-share-modal-content') ||
            document.querySelector('.social-share-modal-overlay.active')
          ) {
            e.preventDefault();
          }
        }}
        onEscapeKeyDown={(e) => {
          const socialModal = document.querySelector(
            '.social-share-modal-overlay.active, .social-share-modal-overlay[style*="display: flex"]'
          ) as HTMLElement;
          if (socialModal) {
            e.preventDefault();
            const closeBtn = socialModal.querySelector('.social-share-modal-close') as HTMLElement;
            if (closeBtn) {
              closeBtn.click();
            } else {
              socialModal.style.display = 'none';
              socialModal.classList.remove('active');
            }
          }
        }}
        className="max-w-3xl w-[94vw] sm:w-[90vw] p-3.5 sm:p-5 bg-card text-card-foreground border border-border shadow-2xl rounded-2xl max-h-[95vh] overflow-y-auto sm:overflow-hidden z-[10001]"
      >
        <DialogHeader className="text-left pb-2 border-b border-border">
          <DialogTitle className="text-base sm:text-lg font-bold text-primary flex items-center gap-2">
            <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            Share Debate Victory Card
          </DialogTitle>
          <DialogDescription className="text-[11px] sm:text-xs text-muted-foreground">
            Download your victory banner or share it directly to social channels.
          </DialogDescription>
        </DialogHeader>

        {/* Card Live Preview Container */}
        <div className="w-full flex items-center justify-center my-2 sm:my-3 rounded-xl bg-muted/40 p-1.5 sm:p-2.5 border border-border overflow-hidden">
          <div
            ref={containerRef}
            className="w-full max-w-[650px] relative overflow-hidden rounded-lg shadow-md border border-border/60"
            style={{ height: `${630 * scale}px` }}
          >
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '1200px',
                height: '630px',
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
              }}
            >
              <DebateVictoryCard ref={cardRef} data={data} />
            </div>
          </div>
        </div>

        {/* Action Controls Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2.5 border-t border-border">
          <div className="flex flex-wrap items-center gap-2">
            {/* Download Button */}
            <Button
              onClick={handleDownload}
              disabled={isDownloading}
              className="flex-1 sm:flex-none bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-3.5 py-2 text-xs sm:text-sm rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-sm"
            >
              <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              {isDownloading ? 'Exporting...' : 'Download PNG'}
            </Button>

            {/* Copy to Clipboard Button */}
            <Button
              onClick={handleCopy}
              disabled={isCopying}
              variant="outline"
              className="flex-1 sm:flex-none border-border bg-background hover:bg-muted text-foreground font-semibold px-3.5 py-2 text-xs sm:text-sm rounded-lg flex items-center justify-center gap-1.5 transition-all"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-500" />
                  <span className="text-emerald-500 font-bold">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span>{isCopying ? 'Copying...' : 'Copy Image'}</span>
                </>
              )}
            </Button>
          </div>

          {/* AOSSIE SocialShareButton */}
          <div className="flex items-center justify-center sm:justify-end">
            <div data-social-share></div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

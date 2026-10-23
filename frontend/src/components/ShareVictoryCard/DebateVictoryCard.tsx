import { forwardRef } from 'react';
import { DebateVictoryCardData } from './types';
import AOSSIELogo from '@/assets/aossie.png';
import { Trophy, Crown, Swords, Calendar } from 'lucide-react';

interface Props {
  data: DebateVictoryCardData;
}

export const DebateVictoryCard = forwardRef<HTMLDivElement, Props>(
  ({ data }, ref) => {
    const { topic, matchType, winner, opponent, verdictReason } = data;
    const dateStr = new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    return (
      <div
        ref={ref}
        style={{
          width: 1200,
          height: 630,
          background: 'radial-gradient(ellipse at 50% 0%, #1e1b18 0%, #0c0a09 55%, #050505 100%)',
          fontFamily: "'Outfit', sans-serif",
          position: 'relative',
          overflow: 'hidden',
          padding: '38px 52px',
          boxSizing: 'border-box',
          color: '#f8fafc',
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid rgba(249, 115, 22, 0.25)',
        }}
      >
        {/* Subtle orange / amber glow highlights matching website palette */}
        <div
          style={{
            position: 'absolute',
            top: -120,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 700,
            height: 350,
            background: 'radial-gradient(circle, rgba(249, 115, 22, 0.18) 0%, rgba(234, 88, 12, 0.05) 50%, transparent 75%)',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -80,
            left: -80,
            width: 380,
            height: 380,
            background: 'radial-gradient(circle, rgba(234, 88, 12, 0.08) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />

        {/* ── Header Row ── */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 26,
            position: 'relative',
            zIndex: 1,
          }}
        >
          {/* Left: AOSSIE branding */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <img
              src={AOSSIELogo}
              alt="AOSSIE Logo"
              style={{
                height: 52,
                width: 'auto',
                objectFit: 'contain',
              }}
            />
            <div>
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 900,
                  color: '#ffffff',
                  letterSpacing: -0.5,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                }}
              >
                Debate<span style={{ color: '#f97316' }}>AI</span>
              </div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#a8a29e',
                  letterSpacing: 2.2,
                  textTransform: 'uppercase',
                  marginTop: -2,
                }}
              >
                BY AOSSIE
              </div>
            </div>
          </div>

          {/* Right: Match type badge + date */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div
              style={{
                background: 'rgba(249, 115, 22, 0.12)',
                border: '1px solid rgba(249, 115, 22, 0.45)',
                borderRadius: 9999,
                padding: '6px 16px',
                fontSize: 13,
                fontWeight: 800,
                color: '#fb923c',
                letterSpacing: 1.2,
                textTransform: 'uppercase',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Trophy size={16} color="#f97316" strokeWidth={2.5} />
              <span>{matchType}</span>
            </div>
            <div
              style={{
                fontSize: 14,
                color: '#a8a29e',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Calendar size={15} color="#78716c" />
              <span>{dateStr}</span>
            </div>
          </div>
        </div>

        {/* ── Debate Motion ── */}
        <div
          style={{
            background: 'rgba(28, 25, 23, 0.85)',
            border: '1px solid rgba(249, 115, 22, 0.25)',
            borderRadius: 16,
            padding: '16px 26px',
            marginBottom: 28,
            position: 'relative',
            zIndex: 1,
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: '#f97316',
              letterSpacing: 2,
              textTransform: 'uppercase',
              marginBottom: 6,
            }}
          >
            DEBATE MOTION
          </div>
          <div
            style={{
              fontSize: 21,
              fontWeight: 600,
              color: '#f5f5f4',
              fontStyle: 'italic',
              lineHeight: 1.35,
            }}
          >
            "{topic}"
          </div>
        </div>

        {/* ── Players Section ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 24,
            flex: 1,
            position: 'relative',
            zIndex: 1,
          }}
        >
          {/* Winner Card */}
          <div
            style={{
              flex: 1,
              position: 'relative',
              background: 'linear-gradient(135deg, rgba(38, 28, 20, 0.9) 0%, rgba(20, 16, 13, 0.95) 100%)',
              border: '2px solid #f97316',
              borderRadius: 18,
              padding: '22px 26px',
              display: 'flex',
              alignItems: 'center',
              gap: 18,
              boxShadow: '0 8px 30px rgba(249, 115, 22, 0.22)',
            }}
          >
            {/* Winner badge */}
            <div
              style={{
                position: 'absolute',
                top: -13,
                right: 20,
                background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                color: '#ffffff',
                fontWeight: 900,
                fontSize: 11,
                borderRadius: 9999,
                padding: '4px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                letterSpacing: 1.2,
                textTransform: 'uppercase',
                boxShadow: '0 4px 12px rgba(234, 88, 12, 0.5)',
              }}
            >
              <Crown size={13} color="#ffffff" strokeWidth={2.8} />
              WINNER
            </div>

            <img
              src={winner.avatarUrl || 'https://api.dicebear.com/9.x/big-ears/svg?seed=Winner'}
              alt={winner.name}
              width={72}
              height={72}
              style={{
                borderRadius: '50%',
                border: '3px solid #f97316',
                objectFit: 'cover',
                flexShrink: 0,
                background: '#1c1917',
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 800,
                  color: '#ffffff',
                  marginBottom: 6,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {winner.name}
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  marginBottom: 8,
                }}
              >
                {winner.stance && (
                  <span
                    style={{
                      background: 'rgba(249, 115, 22, 0.18)',
                      border: '1px solid rgba(249, 115, 22, 0.5)',
                      borderRadius: 6,
                      padding: '2px 9px',
                      fontSize: 11,
                      fontWeight: 800,
                      color: '#fb923c',
                      letterSpacing: 1,
                      textTransform: 'uppercase',
                    }}
                  >
                    {winner.stance}
                  </span>
                )}
                {winner.eloChange !== undefined && (
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 800,
                      color: '#22c55e',
                    }}
                  >
                    +{Math.abs(winner.eloChange)} Elo
                  </span>
                )}
              </div>
              <div style={{ fontSize: 15, color: '#a8a29e', fontWeight: 500 }}>
                Score:{' '}
                <span
                  style={{
                    fontWeight: 900,
                    fontSize: 22,
                    color: '#ffffff',
                    fontStyle: 'italic',
                  }}
                >
                  {winner.score ?? 0}
                </span>
                <span style={{ color: '#78716c' }}>
                  {' '}
                  / {(winner.score ?? 0) > 40 ? 100 : 40}
                </span>
              </div>
            </div>
          </div>

          {/* VS Badge with Lucide Swords */}
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: 'rgba(28, 25, 23, 0.9)',
              border: '2px solid rgba(249, 115, 22, 0.45)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 4px 15px rgba(0, 0, 0, 0.5)',
            }}
          >
            <Swords size={24} color="#f97316" strokeWidth={2.2} />
          </div>

          {/* Opponent Card */}
          <div
            style={{
              flex: 1,
              background: 'rgba(24, 21, 19, 0.75)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 18,
              padding: '22px 26px',
              display: 'flex',
              alignItems: 'center',
              gap: 18,
            }}
          >
            <img
              src={opponent.avatarUrl || 'https://api.dicebear.com/9.x/big-ears/svg?seed=Opponent'}
              alt={opponent.name}
              width={64}
              height={64}
              style={{
                borderRadius: '50%',
                border: '2px solid #57534e',
                objectFit: 'cover',
                opacity: 0.88,
                flexShrink: 0,
                background: '#1c1917',
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: '#d6d3d1',
                  marginBottom: 6,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {opponent.name}
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  marginBottom: 8,
                }}
              >
                {opponent.stance && (
                  <span
                    style={{
                      background: 'rgba(120, 113, 108, 0.18)',
                      border: '1px solid rgba(120, 113, 108, 0.35)',
                      borderRadius: 6,
                      padding: '2px 9px',
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#a8a29e',
                      letterSpacing: 1,
                      textTransform: 'uppercase',
                    }}
                  >
                    {opponent.stance}
                  </span>
                )}
                {opponent.eloChange !== undefined && (
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 800,
                      color: '#ef4444',
                    }}
                  >
                    {opponent.eloChange} Elo
                  </span>
                )}
              </div>
              <div style={{ fontSize: 15, color: '#78716c', fontWeight: 500 }}>
                Score:{' '}
                <span
                  style={{
                    fontWeight: 800,
                    fontSize: 20,
                    color: '#d6d3d1',
                    fontStyle: 'italic',
                  }}
                >
                  {opponent.score ?? 0}
                </span>
                <span style={{ color: '#57534e' }}>
                  {' '}
                  / {(opponent.score ?? 0) > 40 ? 100 : 40}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Footer: Verdict + branding ── */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            marginTop: 22,
            position: 'relative',
            zIndex: 1,
          }}
        >
          {verdictReason && (
            <div
              style={{
                fontSize: 13,
                color: '#78716c',
                fontStyle: 'italic',
                maxWidth: 680,
                lineHeight: 1.45,
              }}
            >
              "{verdictReason.length > 120 ? verdictReason.slice(0, 120) + '…' : verdictReason}"
            </div>
          )}
          <div
            style={{
              fontSize: 14,
              fontWeight: 800,
              color: '#f97316',
              letterSpacing: 0.5,
              marginLeft: 'auto',
            }}
          >
            debateai.aossie.org
          </div>
        </div>
      </div>
    );
  }
);

DebateVictoryCard.displayName = 'DebateVictoryCard';

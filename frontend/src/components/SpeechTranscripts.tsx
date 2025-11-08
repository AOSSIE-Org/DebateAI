import React from 'react';

interface SpeechTranscriptsProps {
  transcripts: { [key: string]: string };
  currentPhase: string;
}

const SpeechTranscripts: React.FC<SpeechTranscriptsProps> = ({
  transcripts,
  currentPhase,
}) => {
  const phases = [
    'openingFor',
    'openingAgainst',
    'crossForQuestion',
    'crossAgainstAnswer',
    'crossAgainstQuestion',
    'crossForAnswer',
    'closingFor',
    'closingAgainst',
  ];

  const getPhaseDisplayName = (phase: string) => {
    switch (phase) {
      case 'openingFor':
        return 'Opening Statement (For)';
      case 'openingAgainst':
        return 'Opening Statement (Against)';
      case 'crossForQuestion':
        return 'Cross Examination - Question (For)';
      case 'crossAgainstAnswer':
        return 'Cross Examination - Answer (Against)';
      case 'crossAgainstQuestion':
        return 'Cross Examination - Question (Against)';
      case 'crossForAnswer':
        return 'Cross Examination - Answer (For)';
      case 'closingFor':
        return 'Closing Statement (For)';
      case 'closingAgainst':
        return 'Closing Statement (Against)';
      default:
        return phase;
    }
  };

  return (
    <div className='bg-white rounded-xl shadow-lg p-4 mt-4'>
      <h3 className='text-lg font-semibold text-gray-800 mb-4'>
        Speech Transcripts by Phase
      </h3>
      <div className='space-y-4'>
        {phases.map((phase) => {
          const transcript = transcripts[phase];
          const isCurrentPhase = phase === currentPhase;

          return (
            <div
              key={phase}
              className={`p-3 rounded-lg border ${
                isCurrentPhase
                  ? 'border-orange-400 bg-orange-50'
                  : 'border-gray-200 bg-gray-50'
              }`}
            >
              <div className='flex items-center justify-between mb-2'>
                <h4 className='font-medium text-sm text-gray-700'>
                  {getPhaseDisplayName(phase)}
                </h4>
                {isCurrentPhase && (
                  <span className='text-xs bg-orange-500 text-white px-2 py-1 rounded'>
                    Current
                  </span>
                )}
              </div>

              {transcript ? (
                <div className='text-sm text-gray-800 bg-white p-2 rounded border'>
                  {transcript}
                </div>
              ) : (
                <div className='text-sm text-gray-500 italic'>
                  No transcript available yet
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SpeechTranscripts;

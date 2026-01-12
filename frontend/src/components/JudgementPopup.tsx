import React from 'react';
import { Button } from './ui/button'; // Adjust the path as needed
import { useNavigate } from 'react-router-dom';

// Define both possible JudgmentData types
type JudgmentDataUserBot = {
  opening_statement: {
    user: { score: number; reason: string };
    bot: { score: number; reason: string };
  };
  cross_examination: {
    user: { score: number; reason: string };
    bot: { score: number; reason: string };
  };
  answers: {
    user: { score: number; reason: string };
    bot: { score: number; reason: string };
  };
  closing: {
    user: { score: number; reason: string };
    bot: { score: number; reason: string };
  };
  total: { user: number; bot: number };
  verdict: {
    winner: string;
    reason: string;
    congratulations: string;
    opponent_analysis: string;
  };
};

type JudgmentDataForAgainst = {
  opening_statement: {
    for: { score: number; reason: string };
    against: { score: number; reason: string };
  };
  cross_examination_questions: {
    for: { score: number; reason: string };
    against: { score: number; reason: string };
  };
  cross_examination_answers: {
    for: { score: number; reason: string };
    against: { score: number; reason: string };
  };
  closing: {
    for: { score: number; reason: string };
    against: { score: number; reason: string };
  };
  total: { for: number; against: number };
  verdict: {
    winner: string;
    reason: string;
    congratulations: string;
    opponent_analysis: string;
  };
};

// Union type for JudgmentData
type JudgmentData = JudgmentDataUserBot | JudgmentDataForAgainst;

type RatingSummary = {
  for: { rating: number; change: number };
  against: { rating: number; change: number };
};

type DebateSide = 'for' | 'against';

type JudgmentPopupProps = {
  judgment: JudgmentData;
  userAvatar?: string;
  botAvatar?: string;
  botName?: string;
  userStance?: string;
  botStance?: string;
  botDesc?: string;
  forRole?: string;
  againstRole?: string;
  localRole?: DebateSide | null;
  localDisplayName?: string | null;
  localAvatarUrl?: string | null;
  opponentDisplayName?: string | null;
  opponentAvatarUrl?: string | null;
  ratingSummary?: RatingSummary | null;
  onClose: () => void;
};

// Define Debate Coach skills
type CoachSkill = {
  title: string;
  description: string;
  url: string;
};

const coachSkills: CoachSkill[] = [
  {
    title: 'Strengthen Argument',
    description:
      'Master the art of crafting compelling, persuasive arguments that win debates.',
    url: 'http://localhost:5173/coach/strengthen-argument',
  },
  {
    title: 'Pros and Cons Challenge',
    description:
      'Test your critical thinking by crafting up to 5 pros and cons for engaging debate topics.',
    url: 'http://localhost:5173/coach/pros-cons',
  },
];

const JudgmentPopup: React.FC<JudgmentPopupProps> = ({
  judgment,
  userAvatar,
  botAvatar,
  botName,
  userStance,
  botStance,
  botDesc,
  forRole,
  againstRole,
  localRole = null,
  localDisplayName,
  localAvatarUrl,
  opponentDisplayName,
  opponentAvatarUrl,
  ratingSummary,
  onClose,
}) => {
  const navigate = useNavigate();
  const userName = 'You';

  const localAvatar =
    localStorage.getItem('userAvatar') ||
    'https://avatar.iran.liara.run/public/40';
  const opponentAvatar =
    localStorage.getItem('opponentAvatar') ||
    'https://avatar.iran.liara.run/public/31';

  const isUserBotFormat = 'user' in judgment.opening_statement;

  const defaultForName = forRole || 'For Debater';
  const defaultAgainstName = againstRole || 'Against Debater';
  const resolvedLocalName = localDisplayName || userName;
  const resolvedOpponentName = opponentDisplayName || 'Opponent';
  const derivedLocalAvatar = localAvatarUrl || localAvatar;
  const derivedOpponentAvatar = opponentAvatarUrl || opponentAvatar;

  const resolvedForName = isUserBotFormat
    ? defaultForName
    : localRole === 'for'
      ? resolvedLocalName
      : localRole === 'against'
        ? resolvedOpponentName
        : defaultForName;

  const resolvedAgainstName = isUserBotFormat
    ? defaultAgainstName
    : localRole === 'against'
      ? resolvedLocalName
      : localRole === 'for'
        ? resolvedOpponentName
        : defaultAgainstName;

  const player1Name = isUserBotFormat ? userName : resolvedForName;
  const player2Name = isUserBotFormat ? botName || 'Bot' : resolvedAgainstName;
  const player1Stance = isUserBotFormat ? userStance : 'For';
  const player2Stance = isUserBotFormat ? botStance : 'Against';

  const resolvedForAvatar = isUserBotFormat
    ? userAvatar
    : localRole === 'for'
      ? derivedLocalAvatar
      : localRole === 'against'
        ? derivedOpponentAvatar
        : derivedLocalAvatar || derivedOpponentAvatar;

  const resolvedAgainstAvatar = isUserBotFormat
    ? botAvatar
    : localRole === 'against'
      ? derivedLocalAvatar
      : localRole === 'for'
        ? derivedOpponentAvatar
        : derivedOpponentAvatar || derivedLocalAvatar;

  const player1Avatar = resolvedForAvatar || localAvatar;
  const player2Avatar = resolvedAgainstAvatar || opponentAvatar;
  const player2Desc = isUserBotFormat ? botDesc : resolvedAgainstName || 'Debater';

  const formatChange = (value: number) =>
    `${value >= 0 ? '+' : ''}${value.toFixed(2)}`;
  const formatRating = (value: number) => value.toFixed(2);

  const player1RatingSummary =
    !isUserBotFormat && ratingSummary ? ratingSummary.for : null;
  const player2RatingSummary =
    !isUserBotFormat && ratingSummary ? ratingSummary.against : null;

  const handleGoHome = () => {
    navigate('/startdebate');
  };

  // Helper function to safely access scores and reasons
  const getScoreAndReason = (
    section: string,
    player: 'player1' | 'player2'
  ) => {
    if (isUserBotFormat) {
      const data = judgment as JudgmentDataUserBot;
      const key = player === 'player1' ? 'user' : 'bot';
      switch (section) {
        case 'opening_statement':
          return {
            score: data.opening_statement[key].score,
            reason: data.opening_statement[key].reason,
          };
        case 'cross_examination':
          return {
            score: data.cross_examination[key].score,
            reason: data.cross_examination[key].reason,
          };
        case 'answers':
          return {
            score: data.answers[key].score,
            reason: data.answers[key].reason,
          };
        case 'closing':
          return {
            score: data.closing[key].score,
            reason: data.closing[key].reason,
          };
        case 'total':
          return { score: data.total[key], reason: '' };
        default:
          return { score: 0, reason: 'Data not available' };
      }
    } else {
      const data = judgment as JudgmentDataForAgainst;
      const key = player === 'player1' ? 'for' : 'against';
      switch (section) {
        case 'opening_statement':
          return {
            score: data.opening_statement[key].score,
            reason: data.opening_statement[key].reason,
          };
        case 'cross_examination_questions':
          return {
            score: data.cross_examination_questions[key].score,
            reason: data.cross_examination_questions[key].reason,
          };
        case 'cross_examination_answers':
          return {
            score: data.cross_examination_answers[key].score,
            reason: data.cross_examination_answers[key].reason,
          };
        case 'closing':
          return {
            score: data.closing[key].score,
            reason: data.closing[key].reason,
          };
        case 'total':
          return { score: data.total[key], reason: '' };
        default:
          return { score: 0, reason: 'Data not available' };
      }
    }
  };

  // Logic to recommend skills based on performance
  const recommendSkills = (): CoachSkill[] => {
    const recommended: CoachSkill[] = [];
    const player1Scores = {
      opening: getScoreAndReason('opening_statement', 'player1').score,
      cross_questions: isUserBotFormat
        ? getScoreAndReason('cross_examination', 'player1').score
        : getScoreAndReason('cross_examination_questions', 'player1').score,
      cross_answers: isUserBotFormat
        ? getScoreAndReason('answers', 'player1').score
        : getScoreAndReason('cross_examination_answers', 'player1').score,
      closing: getScoreAndReason('closing', 'player1').score,
    };
    const player1Reasons = {
      opening: getScoreAndReason(
        'opening_statement',
        'player1'
      ).reason.toLowerCase(),
      cross_questions: isUserBotFormat
        ? getScoreAndReason('cross_examination', 'player1').reason.toLowerCase()
        : getScoreAndReason(
          'cross_examination_questions',
          'player1'
        ).reason.toLowerCase(),
      cross_answers: isUserBotFormat
        ? getScoreAndReason('answers', 'player1').reason.toLowerCase()
        : getScoreAndReason(
          'cross_examination_answers',
          'player1'
        ).reason.toLowerCase(),
      closing: getScoreAndReason('closing', 'player1').reason.toLowerCase(),
    };

    // Strengthen Argument: Low scores in opening/closing or weak argument-related feedback
    if (
      player1Scores.opening <= 6 ||
      player1Scores.closing <= 6 ||
      player1Reasons.opening.includes('weak') ||
      player1Reasons.opening.includes('unclear') ||
      player1Reasons.opening.includes('persuasive') ||
      player1Reasons.closing.includes('weak') ||
      player1Reasons.closing.includes('unclear') ||
      player1Reasons.closing.includes('persuasive')
    ) {
      recommended.push(coachSkills[0]);
    }

    // Pros and Cons Challenge: Low scores in cross-examination or critical thinking-related feedback
    if (
      player1Scores.cross_questions <= 6 ||
      player1Scores.cross_answers <= 6 ||
      player1Reasons.cross_questions.includes('relevance') ||
      player1Reasons.cross_questions.includes('thinking') ||
      player1Reasons.cross_answers.includes('coherence') ||
      player1Reasons.cross_answers.includes('evasion')
    ) {
      recommended.push(coachSkills[1]);
    }

    // Default: Recommend both if no specific issues or multiple areas need work
    if (recommended.length === 0 || recommended.length > 1) {
      return coachSkills;
    }
    return recommended;
  };

  const recommendedSkills = recommendSkills();

  return (
    <div className='fixed inset-0 flex items-center justify-center bg-black bg-opacity-60 z-50 p-4'>
      <div className='bg-gradient-to-br from-white to-gray-100 p-8 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-orange-200 transform transition-all duration-300 scale-100 hover:scale-102'>
        {/* Top Profile Section */}
        <div className='flex justify-between items-center mb-8'>
          <div className='flex items-center space-x-4 bg-gray-50 p-4 rounded-lg shadow-sm w-1/2 mr-2'>
            <img
              src={player1Avatar}
              alt={player1Name}
              className='w-16 h-16 rounded-full border-2 border-orange-400 object-cover'
            />
            <div>
              <h3 className='text-xl font-bold text-gray-800'>{player1Name}</h3>
              <p className='text-sm text-gray-600'>
                Stance:{' '}
                <span className='font-semibold text-orange-500'>
                  {player1Stance}
                </span>
              </p>
              <p className='text-xs text-gray-500'>Debater</p>
            </div>
          </div>
          <div className='flex items-center space-x-4 bg-gray-50 p-4 rounded-lg shadow-sm w-1/2 ml-2'>
            <img
              src={player2Avatar}
              alt={player2Name}
              className='w-16 h-16 rounded-full border-2 border-orange-400 object-cover'
            />
            <div>
              <h3 className='text-xl font-bold text-gray-800'>{player2Name}</h3>
              <p className='text-sm text-gray-600'>
                Stance:{' '}
                <span className='font-semibold text-orange-500'>
                  {player2Stance}
                </span>
              </p>
              <p className='text-xs text-gray-500'>
                {player2Desc || 'Debater'}
              </p>
            </div>
          </div>
        </div>

        {/* Phase Sections */}
        <div className='space-y-10'>
          <div className='bg-white p-6 rounded-lg shadow-md'>
            <h3 className='text-2xl font-bold text-gray-800 text-center mb-6'>
              Opening Statement
            </h3>
            <div className='grid grid-cols-2 gap-6'>
              <div className='p-4 bg-gray-50 rounded-lg'>
                <h4 className='text-lg font-semibold text-gray-700'>
                  {player1Name}
                </h4>
                <p className='mt-2 text-xl font-bold text-orange-600'>
                  {getScoreAndReason('opening_statement', 'player1').score}/10
                </p>
                <p className='mt-2 text-sm text-gray-600 leading-relaxed'>
                  {getScoreAndReason('opening_statement', 'player1').reason}
                </p>
              </div>
              <div className='p-4 bg-gray-50 rounded-lg'>
                <h4 className='text-lg font-semibold text-gray-700'>
                  {player2Name}
                </h4>
                <p className='mt-2 text-xl font-bold text-orange-600'>
                  {getScoreAndReason('opening_statement', 'player2').score}/10
                </p>
                <p className='mt-2 text-sm text-gray-600 leading-relaxed'>
                  {getScoreAndReason('opening_statement', 'player2').reason}
                </p>
              </div>
            </div>
          </div>

          {isUserBotFormat ? (
            <div className='bg-white p-6 rounded-lg shadow-md'>
              <h3 className='text-2xl font-bold text-gray-800 text-center mb-6'>
                Cross Examination
              </h3>
              <div className='grid grid-cols-2 gap-6'>
                <div className='p-4 bg-gray-50 rounded-lg'>
                  <h4 className='text-lg font-semibold text-gray-700'>
                    {player1Name}
                  </h4>
                  <p className='mt-2 text-xl font-bold text-orange-600'>
                    {getScoreAndReason('cross_examination', 'player1').score}/10
                  </p>
                  <p className='mt-2 text-sm text-gray-600 leading-relaxed'>
                    {getScoreAndReason('cross_examination', 'player1').reason}
                  </p>
                </div>
                <div className='p-4 bg-gray-50 rounded-lg'>
                  <h4 className='text-lg font-semibold text-gray-700'>
                    {player2Name}
                  </h4>
                  <p className='mt-2 text-xl font-bold text-orange-600'>
                    {getScoreAndReason('cross_examination', 'player2').score}/10
                  </p>
                  <p className='mt-2 text-sm text-gray-600 leading-relaxed'>
                    {getScoreAndReason('cross_examination', 'player2').reason}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className='bg-white p-6 rounded-lg shadow-md'>
                <h3 className='text-2xl font-bold text-gray-800 text-center mb-6'>
                  Cross Examination Questions
                </h3>
                <div className='grid grid-cols-2 gap-6'>
                  <div className='p-4 bg-gray-50 rounded-lg'>
                    <h4 className='text-lg font-semibold text-gray-700'>
                      {player1Name}
                    </h4>
                    <p className='mt-2 text-xl font-bold text-orange-600'>
                      {
                        getScoreAndReason(
                          'cross_examination_questions',
                          'player1'
                        ).score
                      }
                      /10
                    </p>
                    <p className='mt-2 text-sm text-gray-600 leading-relaxed'>
                      {
                        getScoreAndReason(
                          'cross_examination_questions',
                          'player1'
                        ).reason
                      }
                    </p>
                  </div>
                  <div className='p-4 bg-gray-50 rounded-lg'>
                    <h4 className='text-lg font-semibold text-gray-700'>
                      {player2Name}
                    </h4>
                    <p className='mt-2 text-xl font-bold text-orange-600'>
                      {
                        getScoreAndReason(
                          'cross_examination_questions',
                          'player2'
                        ).score
                      }
                      /10
                    </p>
                    <p className='mt-2 text-sm text-gray-600 leading-relaxed'>
                      {
                        getScoreAndReason(
                          'cross_examination_questions',
                          'player2'
                        ).reason
                      }
                    </p>
                  </div>
                </div>
              </div>
              <div className='bg-white p-6 rounded-lg shadow-md'>
                <h3 className='text-2xl font-bold text-gray-800 text-center mb-6'>
                  Cross Examination Answers
                </h3>
                <div className='grid grid-cols-2 gap-6'>
                  <div className='p-4 bg-gray-50 rounded-lg'>
                    <h4 className='text-lg font-semibold text-gray-700'>
                      {player1Name}
                    </h4>
                    <p className='mt-2 text-xl font-bold text-orange-600'>
                      {
                        getScoreAndReason(
                          'cross_examination_answers',
                          'player1'
                        ).score
                      }
                      /10
                    </p>
                    <p className='mt-2 text-sm text-gray-600 leading-relaxed'>
                      {
                        getScoreAndReason(
                          'cross_examination_answers',
                          'player1'
                        ).reason
                      }
                    </p>
                  </div>
                  <div className='p-4 bg-gray-50 rounded-lg'>
                    <h4 className='text-lg font-semibold text-gray-700'>
                      {player2Name}
                    </h4>
                    <p className='mt-2 text-xl font-bold text-orange-600'>
                      {
                        getScoreAndReason(
                          'cross_examination_answers',
                          'player2'
                        ).score
                      }
                      /10
                    </p>
                    <p className='mt-2 text-sm text-gray-600 leading-relaxed'>
                      {
                        getScoreAndReason(
                          'cross_examination_answers',
                          'player2'
                        ).reason
                      }
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}

          {isUserBotFormat && (
            <div className='bg-white p-6 rounded-lg shadow-md'>
              <h3 className='text-2xl font-bold text-gray-800 text-center mb-6'>
                Answers to Cross Examination
              </h3>
              <div className='grid grid-cols-2 gap-6'>
                <div className='p-4 bg-gray-50 rounded-lg'>
                  <h4 className='text-lg font-semibold text-gray-700'>
                    {player1Name}
                  </h4>
                  <p className='mt-2 text-xl font-bold text-orange-600'>
                    {getScoreAndReason('answers', 'player1').score}/10
                  </p>
                  <p className='mt-2 text-sm text-gray-600 leading-relaxed'>
                    {getScoreAndReason('answers', 'player1').reason}
                  </p>
                </div>
                <div className='p-4 bg-gray-50 rounded-lg'>
                  <h4 className='text-lg font-semibold text-gray-700'>
                    {player2Name}
                  </h4>
                  <p className='mt-2 text-xl font-bold text-orange-600'>
                    {getScoreAndReason('answers', 'player2').score}/10
                  </p>
                  <p className='mt-2 text-sm text-gray-600 leading-relaxed'>
                    {getScoreAndReason('answers', 'player2').reason}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className='bg-white p-6 rounded-lg shadow-md'>
            <h3 className='text-2xl font-bold text-gray-800 text-center mb-6'>
              Closing Statement
            </h3>
            <div className='grid grid-cols-2 gap-6'>
              <div className='p-4 bg-gray-50 rounded-lg'>
                <h4 className='text-lg font-semibold text-gray-700'>
                  {player1Name}
                </h4>
                <p className='mt-2 text-xl font-bold text-orange-600'>
                  {getScoreAndReason('closing', 'player1').score}/10
                </p>
                <p className='mt-2 text-sm text-gray-600 leading-relaxed'>
                  {getScoreAndReason('closing', 'player1').reason}
                </p>
              </div>
              <div className='p-4 bg-gray-50 rounded-lg'>
                <h4 className='text-lg font-semibold text-gray-700'>
                  {player2Name}
                </h4>
                <p className='mt-2 text-xl font-bold text-orange-600'>
                  {getScoreAndReason('closing', 'player2').score}/10
                </p>
                <p className='mt-2 text-sm text-gray-600 leading-relaxed'>
                  {getScoreAndReason('closing', 'player2').reason}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Total Scores */}
        <div className='mt-10 bg-white p-6 rounded-lg shadow-md'>
          <h3 className='text-2xl font-bold text-gray-800 text-center mb-6'>
            Total Scores
          </h3>
          <div className='flex justify-around items-center'>
            <div className='text-center'>
              <p className='text-4xl font-bold text-orange-600'>
                {getScoreAndReason('total', 'player1').score}
              </p>
              <p className='text-sm text-gray-500'>/ 40</p>
              <p className='text-lg font-semibold text-gray-700'>
                {player1Name}
              </p>
            </div>
            <div className='text-center'>
              <p className='text-4xl font-bold text-orange-600'>
                {getScoreAndReason('total', 'player2').score}
              </p>
              <p className='text-sm text-gray-500'>/ 40</p>
              <p className='text-lg font-semibold text-gray-700'>
                {player2Name}
              </p>
            </div>
          </div>
        </div>

        {/* Rating Summary */}
        {!isUserBotFormat && player1RatingSummary && player2RatingSummary && (
          <div className='mt-10 bg-white p-6 rounded-lg shadow-md border border-gray-200'>
            <h3 className='text-2xl font-bold text-gray-800 text-center mb-6'>
              Rating Impact
            </h3>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
              <div className='p-4 bg-gray-50 rounded-lg border border-gray-200'>
                <h4 className='text-lg font-semibold text-gray-700 mb-2'>
                  {player1Name} ({player1Stance})
                </h4>
                <p className='text-sm text-gray-600'>
                  New Rating:{' '}
                  <span className='font-semibold text-gray-900'>
                    {formatRating(player1RatingSummary.rating)}
                  </span>
                </p>
                <p
                  className={`text-sm font-semibold ${player1RatingSummary.change >= 0
                    ? 'text-green-600'
                    : 'text-red-600'
                    }`}
                >
                  Change: {formatChange(player1RatingSummary.change)}
                </p>
              </div>
              <div className='p-4 bg-gray-50 rounded-lg border border-gray-200'>
                <h4 className='text-lg font-semibold text-gray-700 mb-2'>
                  {player2Name} ({player2Stance})
                </h4>
                <p className='text-sm text-gray-600'>
                  New Rating:{' '}
                  <span className='font-semibold text-gray-900'>
                    {formatRating(player2RatingSummary.rating)}
                  </span>
                </p>
                <p
                  className={`text-sm font-semibold ${player2RatingSummary.change >= 0
                    ? 'text-green-600'
                    : 'text-red-600'
                    }`}
                >
                  Change: {formatChange(player2RatingSummary.change)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Verdict */}
        <div className='mt-10 bg-gradient-to-r from-orange-500 to-orange-600 p-6 rounded-lg shadow-md text-white text-center'>
          <h3 className='text-2xl font-bold'>Verdict</h3>
          <p className='mt-4 text-3xl font-bold'>
            {judgment.verdict.winner} Wins!
          </p>
          <p className='mt-3 text-lg'>{judgment.verdict.congratulations}</p>
          <p className='mt-2 text-md leading-relaxed'>
            {judgment.verdict.opponent_analysis}
          </p>
        </div>

        {/* Skills to Improve */}
        <div className='mt-10 bg-white p-6 rounded-lg shadow-md'>
          <h3 className='text-2xl font-bold text-gray-800 text-center mb-6'>
            Skills to Improve with Debate Coach
          </h3>
          <p className='text-center text-gray-600 mb-6'>
            Based on your performance, we recommend practicing these skills to
            enhance your debating abilities:
          </p>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
            {recommendedSkills.map((skill) => (
              <div
                key={skill.title}
                className='p-4 bg-gray-50 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200'
              >
                <h4 className='text-lg font-semibold text-gray-700'>
                  {skill.title}
                </h4>
                <p className='mt-2 text-sm text-gray-600 leading-relaxed'>
                  {skill.description}
                </p>
                <a
                  href={skill.url}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='mt-4 inline-block bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 transform hover:scale-105'
                >
                  Start Now
                </a>
              </div>
            ))}
          </div>
        </div>

        {/* Buttons */}
        <div className='text-center mt-8'>
          <Button
            onClick={handleGoHome}
            className='bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-full text-lg font-semibold transition-all duration-200 transform hover:scale-105 mr-4'
          >
            Back to Home
          </Button>
          <Button
            onClick={onClose}
            className='bg-gray-500 hover:bg-gray-600 text-white px-6 py-3 rounded-full text-lg font-semibold transition-all duration-200 transform hover:scale-105'
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};

export default JudgmentPopup;

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const pageTitles: Record<string, string> = {
  '/': 'DebateAI',
  '/startDebate': 'DebateAI',
  '/tournaments': 'Tournaments | DebateAI',
  '/team-builder': 'Team Debates | DebateAI',
  '/leaderboard': 'Leaderboard | DebateAI',
  '/community': 'Community | DebateAI',
  '/profile': 'Profile | DebateAI',
  '/about': 'About | DebateAI',
  '/support-os': 'Support | DebateAI',
  '/auth': 'Authentication | DebateAI',
};

function PageTitle() {
  const location = useLocation();

  useEffect(() => {
    document.title = pageTitles[location.pathname] || 'DebateAI';
  }, [location.pathname]);

  return null;
}

export default PageTitle;
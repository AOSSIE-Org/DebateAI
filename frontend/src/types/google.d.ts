interface GoogleId {
  initialize: (config: {
    client_id: string;
    callback: (response: { credential: string; select_by: string }) => void;
    auto_select?: boolean;
    context?: 'signin' | 'signup' | 'use';
    ux_mode?: 'popup' | 'redirect';
    login_uri?: string;
  }) => void;
  renderButton: (
    element: HTMLElement | null,
    options: {
      theme: 'outline' | 'filled_blue' | 'filled_black';
      size: 'large' | 'medium' | 'small';
      text?: 'signin_with' | 'signup_with' | 'continue_with';
      width?: string;
      shape?: 'rectangular' | 'pill';
      logo_alignment?: 'left' | 'center';
    }
  ) => void;
  prompt: () => void;
  cancel: () => void;
}

interface GoogleAccounts {
  id: GoogleId;
}

interface Window {
  google?: {
    accounts: GoogleAccounts;
  };
}
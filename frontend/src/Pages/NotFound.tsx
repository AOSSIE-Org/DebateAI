// src/Pages/NotFound.tsx
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center text-foreground">
      <p className="text-6xl font-black text-primary">404</p>
      <h1 className="mt-4 text-3xl md:text-4xl font-bold">Page not found</h1>
      <p className="mt-2 max-w-md text-muted-foreground">
        The requested page does not exist or has been moved.
      </p>
      <Button asChild className="mt-6">
        <Link to="/">Go to Home</Link>
      </Button>
    </main>
  );
}

export default NotFound;

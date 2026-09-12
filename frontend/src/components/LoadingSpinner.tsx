import React from "react";
import { Loader2 } from "lucide-react";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg" | "xl";
  fullScreen?: boolean;
}

const sizeMap = {
  sm: "h-6 w-6",
  md: "h-10 w-10",
  lg: "h-16 w-16",
  xl: "h-24 w-24",
};

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size,
  fullScreen = false,
}) => {
  const resolvedSize = size ?? (fullScreen ? "lg" : "md");

  const content = (
    <div className="flex flex-col items-center justify-center gap-2 p-8">
      <Loader2
        className={`${sizeMap[resolvedSize]} animate-spin text-primary`}
      />
    </div>
  );

  if (fullScreen) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center">
        {content}
      </div>
    );
  }

  return content;
};

export default LoadingSpinner;

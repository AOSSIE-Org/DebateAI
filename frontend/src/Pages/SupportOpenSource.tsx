import {
  ArrowUpRight,
  Bug,
  ChevronRight,
  Code,
  Github,
  Heart,
  Star,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface SupportCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  buttonText: string;
  onClick?: () => void;
  hoverType?: "orange" | "red";
}

const SupportCard = ({
  icon,
  title,
  description,
  buttonText,
  onClick,
  hoverType = "orange",
}: SupportCardProps) => {
  const isRed = hoverType === "red";

  return (
    <Card
      className={`group flex h-full flex-col rounded-2xl border-border bg-card shadow-none transition-all duration-300 hover:-translate-y-0.5 hover:border-foreground/20 ${
        isRed
          ? "hover:border-red-500/40 contrast:hover:border-yellow-400"
          : "hover:border-orange-500/40 contrast:hover:border-yellow-400"
      }`}
    >
      <CardHeader className="flex-1 p-6">
        <div
          className={`mb-6 flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-muted/40 transition-colors duration-300 ${
            isRed
              ? "group-hover:border-red-500/30 group-hover:bg-red-500/5"
              : "group-hover:border-orange-500/30 group-hover:bg-orange-500/5"
          } contrast:group-hover:border-yellow-400 contrast:group-hover:bg-yellow-400/10`}
        >
          <div
            className={`text-muted-foreground transition-colors duration-300 ${
              isRed
                ? "group-hover:text-red-500 contrast:group-hover:text-yellow-400"
                : "group-hover:text-orange-500 contrast:group-hover:text-yellow-400"
            }`}
          >
            {icon}
          </div>
        </div>

        <CardTitle
          className={`text-lg font-semibold tracking-tight transition-colors duration-300 ${
            isRed
              ? "group-hover:text-red-500 contrast:group-hover:text-yellow-400"
              : "group-hover:text-orange-500 contrast:group-hover:text-yellow-400"
          }`}
        >
          {title}
        </CardTitle>

        <CardDescription className="mt-2 max-w-sm text-sm font-normal leading-relaxed contrast:text-white">
          {description}
        </CardDescription>
      </CardHeader>

      <CardFooter className="p-6 pt-0">
        <Button
          variant="ghost"
          onClick={onClick}
          className={`group/button h-9 w-full justify-between rounded-lg border border-border bg-transparent px-3 text-sm font-medium transition-all duration-200 hover:bg-muted/50 ${
            isRed
              ? "hover:border-red-500/30 hover:bg-red-500/5 hover:text-red-500 contrast:hover:border-yellow-400 contrast:hover:bg-yellow-400/10 contrast:hover:text-yellow-400"
              : "hover:border-orange-500/30 hover:bg-orange-500/5 hover:text-orange-500 contrast:hover:border-yellow-400 contrast:hover:bg-yellow-400/10 contrast:hover:text-yellow-400"
          }`}
        >
          {buttonText}

          <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-hover/button:translate-x-0.5 group-hover/button:text-current" />
        </Button>
      </CardFooter>
    </Card>
  );
};

const PrimarySupportCard = () => {
  return (
    <div
      className="
        group rounded-2xl border border-border bg-card
        transition-all duration-300
        hover:border-foreground/20
        contrast:border-yellow-400 contrast:bg-black
      "
    >
      <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex min-w-0 items-center gap-4">
          <div
            className="
              flex h-11 w-11 shrink-0 items-center justify-center
              rounded-xl border border-border bg-muted/40
              text-foreground transition-all duration-300
              group-hover:border-foreground/20 group-hover:bg-muted
            "
          >
            <Github className="h-5 w-5" />
          </div>

          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold tracking-tight sm:text-lg">
              Star DebateAI on GitHub
            </h2>

            <p className="mt-1 text-sm text-muted-foreground contrast:text-white">
              Help more developers discover the project.
            </p>
          </div>
        </div>

        <Button
          size="sm"
          className="
            h-10 shrink-0 rounded-lg bg-foreground px-4
            font-medium text-background
            hover:bg-foreground/90
            contrast:bg-yellow-400 contrast:text-black
            contrast:hover:bg-yellow-300
          "
          onClick={() =>
            window.open(
              "https://github.com/AOSSIE-Org/DebateAI",
              "_blank",
              "noopener,noreferrer"
            )
          }
        >
          <Star className="mr-2 h-4 w-4" />
          Star on GitHub
          <ArrowUpRight className="ml-1.5 h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
};

const SupportOpenSource = () => {
  return (
    <div className="flex-1 overflow-y-auto bg-background px-5 py-8 md:px-8 md:py-10">
      <div className="mx-auto max-w-5xl">
        <header className="mb-10 max-w-2xl">
          <h1
            className="
              text-3xl font-bold tracking-[-0.03em]
              sm:text-4xl md:text-5xl
              contrast:text-yellow-400
            "
          >
            Support{" "}
            <span className="text-primary contrast:text-yellow-400">
              DebateAI
            </span>
          </h1>

          <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg contrast:text-white">
            Built by the community, for the community. Help us improve the AI
            debate platform and keep it free for everyone.
          </p>
        </header>

        <section className="mb-8">
          <PrimarySupportCard />
        </section>

        <section>
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Ways to contribute
          </p>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <SupportCard
              icon={<Code className="h-5 w-5" />}
              title="Contribute Code"
              description="Join the developer community and help improve DebateAI with your technical skills."
              buttonText="Contribution Guide"
              hoverType="orange"
              onClick={() =>
                window.open(
                  "https://github.com/AOSSIE-Org/DebateAI/blob/main/README.md#contribution-guidelines",
                  "_blank",
                  "noopener,noreferrer"
                )
              }
            />

            <SupportCard
              icon={<Bug className="h-5 w-5" />}
              title="Report Issues"
              description="Found a bug or have an improvement idea? Help us improve platform stability."
              buttonText="Open Issue"
              hoverType="orange"
              onClick={() =>
                window.open(
                  "https://github.com/AOSSIE-Org/DebateAI/issues",
                  "_blank",
                  "noopener,noreferrer"
                )
              }
            />

            <SupportCard
              icon={<Heart className="h-5 w-5" />}
              title="Support the Project"
              description="Help maintain infrastructure and fuel further AI research and development."
              buttonText="Donate"
              hoverType="red"
              onClick={() => {
                // Add donation flow here.
              }}
            />
          </div>
        </section>

        <section className="mt-8 border-t border-border pt-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <a
              href="https://aossie.org"
              target="_blank"
              rel="noopener noreferrer"
              className="
                inline-flex w-fit items-center gap-2
                text-sm font-semibold text-muted-foreground
                transition-colors hover:text-foreground
                contrast:text-yellow-400
              "
            >
              <Github className="h-4 w-4" />
              <span>AOSSIE Open Source</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </a>

            <p className="max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-right contrast:text-white">
              DebateAI is an open laboratory for research in logic and
              communication. Contributions help keep the system independent
              and accessible.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default SupportOpenSource;
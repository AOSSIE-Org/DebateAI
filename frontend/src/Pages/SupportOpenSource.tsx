import { Star, Heart, Code, Bug, ChevronRight, Github } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

interface SupportCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  buttonText: string;
  onClick?: () => void;
  hoverType?: 'orange' | 'red';
}

const SupportCard = ({ icon, title, description, buttonText, onClick, hoverType }: SupportCardProps) => {
  const isRed = hoverType === 'red';
  const isOrange = hoverType === 'orange';
  
  return (
    <Card className={`flex flex-col h-full border-border bg-card/50 backdrop-blur-sm transition-all duration-500 group ${
      isRed ? 'hover:border-red-500/50 hover:shadow-[0_0_20px_rgba(239,68,68,0.15)] contrast:hover:border-yellow-400 contrast:hover:shadow-[0_0_20px_rgba(255,255,0,0.3)]' : 
      isOrange ? 'hover:border-orange-500/50 hover:shadow-[0_0_20px_rgba(249,115,22,0.15)] contrast:hover:border-yellow-400 contrast:hover:shadow-[0_0_20px_rgba(255,255,0,0.3)]' : 
      'hover:border-primary/50'
    }`}>
      <CardHeader className="flex-1">
        <div className={`w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-4 transition-all duration-300 group-hover:scale-110 ${
          isRed ? 'group-hover:bg-red-500/10 contrast:group-hover:bg-yellow-400/20' : 
          isOrange ? 'group-hover:bg-orange-500/20 contrast:group-hover:bg-yellow-400/20' : 
          'group-hover:bg-primary/10'
        }`}>
          <div className={`transition-all duration-300 ${
            isRed ? 'text-muted-foreground group-hover:text-red-500 group-hover:fill-red-500 contrast:group-hover:text-yellow-400 contrast:group-hover:fill-yellow-400' : 
            'text-primary contrast:text-yellow-400'
          }`}>
            {icon}
          </div>
        </div>
        <CardTitle className={`text-xl font-bold transition-colors duration-300 ${
          isRed ? 'group-hover:text-red-500 contrast:group-hover:text-yellow-400' : 
          isOrange ? 'group-hover:text-orange-500 contrast:group-hover:text-yellow-400' : 
          'contrast:text-yellow-400'
        }`}>{title}</CardTitle>
        <CardDescription className="text-muted-foreground mt-2 font-medium contrast:text-white">{description}</CardDescription>
      </CardHeader>
      <CardFooter className="pt-0">
        <Button 
          variant="outline" 
          className={`w-full justify-between transition-all duration-300 ${
            isRed ? 'group-hover:border-red-500 group-hover:text-red-500 group-hover:bg-red-500/5 contrast:group-hover:border-yellow-400 contrast:group-hover:text-yellow-400 contrast:group-hover:bg-yellow-400/10' : 
            isOrange ? 'group-hover:border-orange-500 group-hover:text-orange-500 group-hover:bg-orange-500/5 contrast:group-hover:border-yellow-400 contrast:group-hover:text-yellow-400 contrast:group-hover:bg-yellow-400/10' : 
            'group-hover:border-primary contrast:border-yellow-400 contrast:text-yellow-400'
          }`} 
          onClick={onClick}
        >
          {buttonText}
          <ChevronRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
        </Button>
      </CardFooter>
    </Card>
  );
};

const PrimarySupportCard = () => (
  <Card className="relative overflow-hidden border-primary/50 bg-primary/5 backdrop-blur-md p-1 shadow-lg shadow-primary/5 contrast:border-yellow-400 contrast:bg-yellow-400/10">
    <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
      <Star className="w-32 h-32 text-primary contrast:text-yellow-400" fill="currentColor" />
    </div>
    <div className="flex flex-col md:flex-row items-center gap-6 p-6 md:p-8">
      <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center flex-shrink-0 animate-pulse contrast:bg-yellow-400/30">
        <Star className="w-8 h-8 text-primary contrast:text-yellow-400" fill="currentColor" />
      </div>
      <div className="flex-1 text-center md:text-left space-y-2">
        <CardTitle className="text-2xl md:text-3xl font-black tracking-tight contrast:text-yellow-400">
          Star DebateAI on GitHub
        </CardTitle>
        <CardDescription className="text-lg text-muted-foreground italic contrast:text-white">
          "Help more developers discover the project and join our mission."
        </CardDescription>
      </div>
      <Button 
        size="lg" 
        className="w-full md:w-auto h-14 px-8 text-lg font-bold rounded-xl shadow-lg shadow-primary/20 contrast:bg-yellow-400 contrast:text-black contrast:hover:bg-yellow-500"
        onClick={() => window.open('https://github.com/AOSSIE-Org/DebateAI', '_blank')}
      >
        <Star className="w-5 h-5 mr-2" fill="currentColor" />
        Star on GitHub
      </Button>
    </div>
  </Card>
);

const SupportOpenSource = () => {
  return (
    <div className="flex-1 overflow-y-auto bg-background p-6 md:p-10 animate-in fade-in duration-500">
      <div className="max-w-5xl mx-auto space-y-12">
        
        {/* Header Section */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl md:text-6xl font-black tracking-tight text-foreground contrast:text-yellow-400">
            Support <span className="text-primary contrast:text-yellow-400">DebateAI</span>
          </h1>
          <p className="text-muted-foreground text-lg md:text-xl max-w-2xl mx-auto font-medium contrast:text-white">
            Built by the community, for the community. Help us improve the AI debate platform and keep it free for everyone.
          </p>
        </div>

        {/* Primary Action */}
        <PrimarySupportCard />

        {/* Support Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <SupportCard 
            icon={<Code className="w-6 h-6" />}
            title="Contribute Code"
            description="Join the developer community and help improve DebateAI with your technical skills."
            buttonText="Contribution Guide"
            hoverType="orange"
            onClick={() => window.open('https://github.com/AOSSIE-Org/DebateAI/blob/master/CONTRIBUTING.md', '_blank')}
          />
          <SupportCard 
            icon={<Bug className="w-6 h-6" />}
            title="Report Issues"
            description="Found a bug or have an improvement idea? Help us improve the platform stability."
            buttonText="Open Issue"
            hoverType="orange"
            onClick={() => window.open('https://github.com/AOSSIE-Org/DebateAI/issues', '_blank')}
          />
          <SupportCard 
            icon={<Heart className="w-6 h-6" />}
            title="Support the Project"
            description="Help maintain infrastructure and fuel further AI research and development."
            buttonText="Donate"
            hoverType="red"
            onClick={() => {/* Handle donation flow */}}
          />
        </div>

        {/* Footer / Transparency */}
        <div className="flex flex-col items-center justify-center p-8 rounded-3xl border border-dashed border-border bg-muted/20 text-center gap-4 contrast:border-yellow-400">
          <div className="flex items-center gap-6 opacity-60 contrast:opacity-100">
            <Github className="w-8 h-8 contrast:text-yellow-400" />
            <div className="h-8 w-px bg-border contrast:bg-yellow-400"></div>
            <a href="https://aossie.org" target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition-opacity">
              <p className="text-sm font-bold tracking-widest uppercase contrast:text-yellow-400">AOSSIE Open Source</p>
            </a>
          </div>
          <p className="text-muted-foreground max-w-lg text-sm contrast:text-white">
            DebateAI is an open laboratory for research in logic and communication. 
            All contributions go directly towards keeping the system independent and accessible.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SupportOpenSource;

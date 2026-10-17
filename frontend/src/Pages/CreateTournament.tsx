import { CreateTournamentForm } from "@/components/tournament/CreateTournamentForm";

const CreateTournament = () => {
  return (
    <div className="min-h-full flex items-center justify-center">
      <div className="w-full max-w-[630px]">
        <CreateTournamentForm />
      </div>
    </div>
  );
};

export default CreateTournament;

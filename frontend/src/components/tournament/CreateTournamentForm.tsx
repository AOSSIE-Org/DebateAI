import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createTournament,
  type CreateTournamentData,} from "@/services/tournamentService";
import { Calendar } from "@/components/ui/calendar";
import {Popover,PopoverContent,PopoverTrigger,} from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";


const MIN_PARTICIPANTS_LIMIT = 3;
const MAX_PARTICIPANTS_LIMIT = 16;
const CATEGORIES = ["chat_only", "voice_only", "voice_video"] as const;
const VISIBILITIES = ["public", "private"] as const;
const START_TYPES = ["direct", "scheduled"] as const;


const isOneOf = <T extends readonly string[]>(
  values: T,
  value: string,
): value is T[number] => values.some((candidate) => candidate === value);



export const CreateTournamentForm = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState<CreateTournamentData>({
    title: "",
    description: "",
    moderatorName: "",
    category: "chat_only",
    visibility: "public",
    minParticipants: 3,
    maxParticipants: 16,
    startType: "direct",
    scheduleAt: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copyMessage, setCopyMessage] = useState("");
  const [scheduleDate, setScheduleDate] = useState<Date | undefined>(undefined);
  const [createdTournament, setCreatedTournament] = useState<{
    id: string;
    title: string;
    inviteCode?: string;
  } | null>(null);

  const copyInviteCode = async (inviteCode: string) => {
    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopyMessage("Invite code copied.");
    } catch {
      setCopyMessage("Copy failed. Select and copy the invite code manually.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const title = form.title.trim();
    const description = form.description.trim();
    const moderatorName = form.moderatorName.trim();
    if (!title || !description || !moderatorName) {
      setError(
        "Tournament topic, description, and moderator name are required.",
      );
      return;
    }
    if (
      title.length > 100 ||
      description.length > 2000 ||
      moderatorName.length > 80
    ) {
      setError(
        "Topic must be at most 100 characters, description 2000, and moderator name 80.",
      );
      return;
    }
    if (
      !Number.isInteger(form.minParticipants) ||
      form.minParticipants < MIN_PARTICIPANTS_LIMIT ||
      form.minParticipants > MAX_PARTICIPANTS_LIMIT
    ) {
      setError(
        `Minimum participants must be between ${MIN_PARTICIPANTS_LIMIT} and ${MAX_PARTICIPANTS_LIMIT}.`,
      );
      return;
    }
    if (
      !Number.isInteger(form.maxParticipants) ||
      form.maxParticipants < form.minParticipants ||
      form.maxParticipants > MAX_PARTICIPANTS_LIMIT
    ) {
      setError(
        `Maximum participants must be between the minimum and ${MAX_PARTICIPANTS_LIMIT}.`,
      );
      return;
    }

    let normalizedScheduleAt: string | undefined;
    if (form.startType === "scheduled") {
      if (!scheduleDate || scheduleDate <= new Date()) {
        setError("Choose a valid future date.");
        return;
      }
      normalizedScheduleAt = scheduleDate.toISOString();
    }

    const payload: CreateTournamentData = {
      ...form,
      title,
      description,
      moderatorName,
      ...(normalizedScheduleAt ? { scheduleAt: normalizedScheduleAt } : {}),
    };

    setLoading(true);
    try {
      const result = await createTournament(payload);
      if (
        form.visibility === "private" &&
        !/^\d{6}$/.test(result.inviteCode ?? "")
      ) {
        setError(
          `Tournament was created, but the backend returned an invalid invite code. Restart the backend and contact support with tournament ID: ${result.id}`,
        );
        return;
      }
      setCreatedTournament({
        id: result.id,
        title: result.title,
        ...(result.inviteCode ? { inviteCode: result.inviteCode } : {}),
      });
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to create tournament.",
      );
    } finally {
      setLoading(false);
    }
  };

  if (createdTournament) {
    const inviteCode = createdTournament.inviteCode;
    return (
      <div className="max-w-md mx-auto p-6 bg-card rounded-lg text-center">
        <h2 className="text-2xl font-bold mb-4">Tournament Created! 🎉</h2>
        <p className="mb-2">Title : {createdTournament.title}</p>
        {form.visibility === "private" && inviteCode ? (
          <>
            <p className="mb-2">Share this private invite code:</p>
            <div className="text-xl sm:text-2xl font-mono font-bold bg-primary/20 p-4 rounded mb-4 break-all">
              {inviteCode}
            </div>
            <button
              onClick={() => void copyInviteCode(inviteCode)}
              className="bg-secondary px-4 py-2 rounded w-full mb-2"
            >
              Copy Code
            </button>
            {copyMessage && (
              <p className="text-sm text-muted-foreground mb-2">
                {copyMessage}
              </p>
            )}
          </>
        ) : form.visibility === "private" ? (
          <p className="text-destructive mb-4">
            The tournament was created, but the server did not return an invite
            code. Contact support with the tournament ID above.
          </p>
        ) : (
          <p className="mb-4">Your public tournament has been saved.</p>
        )}
        {/* <button
          onClick={() => {
            setCreatedTournament(null);
            navigate("/tournaments");
          }}
          className="bg-primary text-primary-foreground px-4 py-2 rounded w-full"
        >
          Back to Tournaments
        </button> */}
        <button
          onClick={() => {
            setCreatedTournament(null);
            setForm({
              title: "",
              description: "",
              moderatorName: "",
              category: "chat_only",
              visibility: "public",
              minParticipants: 3,
              maxParticipants: 16,
              startType: "direct",
              scheduleAt: "",
            });
            setScheduleDate(undefined);
            setCopyMessage("");
            navigate("/tournaments");
          }}
          className="bg-primary text-primary-foreground px-4 py-2 rounded w-full"
        >
          Back to Tournaments
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-3xl mx-auto p-6 bg-card rounded-lg"
    >
      <h2 className="text-2xl font-bold mb-6">Create Tournament</h2>

      {error && (
        <div className="text-red-500 mb-4 p-2 bg-red-500/10 rounded">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {/* Topic */}
        <div>
          <label className="block mb-1 font-medium">Tournament Title *</label>
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="e.g. Should AI be regulated?"
            className="w-full p-2 border border-border rounded bg-background"
            required
          />
        </div>

        {/* Description */}
        <div>
          <label className="block mb-1 font-medium">Description *</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="What is this tournament about?"
            className="w-full p-2 border border-border rounded bg-background"
            rows={3}
            required
          />
        </div>

        {/* Moderator Name */}
        <div>
          <label className="block mb-1 font-medium">Moderator's Name *</label>
          <input
            value={form.moderatorName}
            onChange={(e) =>
              setForm({ ...form, moderatorName: e.target.value })
            }
            placeholder="Enter moderator's full name"
            className="w-full p-2 border border-border rounded bg-background"
            required
          />
        </div>

        {/* Category + Visibility */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block mb-1 font-medium">Category *</label>
            <select
              value={form.category}
              onChange={(e) => {
                const category = e.target.value;
                if (isOneOf(CATEGORIES, category)) {
                  setForm((previous) => ({
                    ...previous,
                    category,
                  }));
                }
              }}
              className="w-full p-2 border border-border rounded bg-background"
            >
              <option value="chat_only">Chat Only</option>
              <option value="voice_only">Voice Only</option>
              <option value="voice_video">Voice + Video</option>
            </select>
          </div>
          <div>
            <label className="block mb-1 font-medium">Visibility *</label>
            <select
              value={form.visibility}
              onChange={(e) => {
                const visibility = e.target.value;
                if (isOneOf(VISIBILITIES, visibility)) {
                  setForm((previous) => ({
                    ...previous,
                    visibility,
                  }));
                }
              }}
              className="w-full p-2 border border-border rounded bg-background"
            >
              <option value="public">Public</option>
              <option value="private">Private</option>
            </select>
            {form.visibility === "private" && (
              <p className="text-xs text-muted-foreground mt-1">
                Requires invite code
              </p>
            )}
          </div>
        </div>

        {/* Min + Max */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block mb-1 font-medium">Min Participants *</label>
            <input
              type="number"
              min={MIN_PARTICIPANTS_LIMIT}
              max={MAX_PARTICIPANTS_LIMIT}
              value={form.minParticipants}
              onChange={(e) =>
                setForm({ ...form, minParticipants: +e.target.value })
              }
              className="w-full p-2 border border-border rounded bg-background"
              required
            />
          </div>
          <div>
            <label className="block mb-1 font-medium">Max Participants *</label>
            <input
              type="number"
              min={form.minParticipants}
              max={MAX_PARTICIPANTS_LIMIT}
              value={form.maxParticipants}
              onChange={(e) =>
                setForm({ ...form, maxParticipants: +e.target.value })
              }
              className="w-full p-2 border border-border rounded bg-background"
              required
            />
          </div>
        </div>

        {/* Start Type */}
        <div>
          <label className="block mb-1 font-medium">Start Type *</label>
          <select
            value={form.startType}
            onChange={(e) => {
              const startType = e.target.value;
              if (isOneOf(START_TYPES, startType)) {
                setForm((previous) => ({
                  ...previous,
                  startType,
                }));
              }
            }}
            className="w-full p-2 border border-border rounded bg-background"
          >
            <option value="direct">Start Directly</option>
            <option value="scheduled">Schedule</option>
          </select>
        </div>

        {/* Schedule */}
        {form.startType === "scheduled" && (
          <div>
            <div className="relative">
              <input
                type="text"
                value={scheduleDate ? format(scheduleDate, "PPP") : ""}
                placeholder="dd-mm-yyyy"
                readOnly
                className="w-full p-2 pr-10 border border-border rounded bg-background cursor-pointer"
                onClick={() =>
                  document.getElementById("schedule-popover-trigger")?.click()
                }
              />
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    id="schedule-popover-trigger"
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1"
                  >
                    <CalendarIcon className="h-4 w-4 opacity-50" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={scheduleDate}
                    onSelect={setScheduleDate}
                    disabled={(date) => date < new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2 mt-6">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex-1 bg-secondary py-2 rounded"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 bg-primary text-primary-foreground py-2 rounded"
        >
          {loading ? "Creating..." : "Create Tournament"}
        </button>
      </div>
    </form>
  );
};

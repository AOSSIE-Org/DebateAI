import { useState } from "react";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

interface SettingsModalProps {
  duration?: number;
  rounds?: number | null;
  aiJudge?: boolean | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (settings: { duration: number; rounds?: number | null; aiJudge?: boolean | null }) => void;
}

export default function SettingsModal({ duration = 60, rounds = null, aiJudge = null, isOpen, onClose, onSave }: SettingsModalProps) {
  const [settings, setSettings] = useState({
    duration,
    rounds,
    aiJudge,
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Debate Settings</DialogTitle>
          <DialogDescription>
            Customize the debate settings before you start. Click save when you're done.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {/* Duration Input */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="duration" className="text-right">Duration (s)</Label>
            <Input
              id="duration"
              type="number"
              className="col-span-3 appearance-none"
              value={settings.duration}
              onChange={(e) => setSettings({ ...settings, duration: Number(e.target.value) })}
            />
          </div>

          {/* Rounds Input (Only if rounds is passed as a prop) */}
          {rounds !== null && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="rounds" className="text-right">Rounds</Label>
              <Input
                id="rounds"
                type="number"
                className="col-span-3 appearance-none"
                value={settings.rounds ?? ""}
                onChange={(e) => setSettings({ ...settings, rounds: e.target.value === "" ? null : Number(e.target.value) })}
              />
            </div>
          )}

          {/* AI Judge Checkbox (Only if aiJudge is passed as a prop) */}
          {aiJudge !== null && (
            <div className="flex w-full items-center gap-4 ml-16" onClick={() => setSettings({ ...settings, aiJudge: !settings.aiJudge })}>
              <Checkbox checked={settings.aiJudge ?? false} />
              <span className="text-right">Allow AI Judge</span>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={() => { onSave(settings); onClose(); }}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

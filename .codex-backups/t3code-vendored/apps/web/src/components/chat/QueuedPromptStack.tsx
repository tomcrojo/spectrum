import { type QueuedComposerEntry } from "~/composerDraftStore";
import { QueuedPromptCard } from "./QueuedPromptCard";

interface QueuedPromptStackProps {
  entries: ReadonlyArray<QueuedComposerEntry>;
  onSteer: (entryId: string) => void;
  onEdit: (entryId: string) => void;
  onDelete: (entryId: string) => void;
}

export function QueuedPromptStack({ entries, onSteer, onEdit, onDelete }: QueuedPromptStackProps) {
  if (entries.length === 0) {
    return null;
  }

  return (
    <div className="mb-2 space-y-2">
      {entries.map((entry, index) => (
        <QueuedPromptCard
          key={entry.id}
          entry={entry}
          isNext={index === 0}
          onSteer={onSteer}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

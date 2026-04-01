import { MoreHorizontalIcon, SquarePenIcon, Trash2Icon } from "lucide-react";
import { type QueuedComposerEntry } from "~/composerDraftStore";
import { cn } from "~/lib/utils";
import { Button } from "../ui/button";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "../ui/menu";

function buildQueuedPromptPreview(prompt: string): string {
  const normalized = prompt.replace(/\s+/g, " ").trim();
  return normalized.length > 0 ? normalized : "Queued follow-up";
}

interface QueuedPromptCardProps {
  entry: QueuedComposerEntry;
  isNext: boolean;
  onSteer: (entryId: string) => void;
  onEdit: (entryId: string) => void;
  onDelete: (entryId: string) => void;
}

export function QueuedPromptCard({
  entry,
  isNext,
  onSteer,
  onEdit,
  onDelete,
}: QueuedPromptCardProps) {
  const preview = buildQueuedPromptPreview(entry.prompt);

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-2xl border bg-card/95 px-3 py-2 shadow-xs",
        isNext ? "border-primary/35" : "border-border/80",
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-foreground" title={preview}>
          {preview}
        </p>
      </div>
      <Button
        type="button"
        size="xs"
        variant="outline"
        className="rounded-full px-3"
        onClick={() => onEdit(entry.id)}
      >
        <SquarePenIcon className="mr-1 size-3.5" />
        Edit
      </Button>
      <Button
        type="button"
        size="xs"
        variant={isNext ? "default" : "outline"}
        className="rounded-full px-3"
        onClick={() => onSteer(entry.id)}
      >
        Steer
      </Button>
      <Button
        type="button"
        size="icon-xs"
        variant="ghost"
        className="rounded-full"
        aria-label="Delete queued follow-up"
        onClick={() => onDelete(entry.id)}
      >
        <Trash2Icon className="size-3.5" />
      </Button>
      <Menu>
        <MenuTrigger
          render={
            <Button
              type="button"
              size="icon-xs"
              variant="ghost"
              className="rounded-full"
              aria-label="Queued follow-up actions"
            />
          }
        >
          <MoreHorizontalIcon className="size-3.5" />
        </MenuTrigger>
        <MenuPopup align="end" side="top">
          <MenuItem onClick={() => onEdit(entry.id)}>Edit</MenuItem>
          <MenuItem onClick={() => onSteer(entry.id)}>Steer now</MenuItem>
          <MenuItem onClick={() => onDelete(entry.id)}>Delete</MenuItem>
        </MenuPopup>
      </Menu>
    </div>
  );
}

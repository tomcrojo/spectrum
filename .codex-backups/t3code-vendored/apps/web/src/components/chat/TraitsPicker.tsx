import {
  type ClaudeModelOptions,
  type CodexModelOptions,
  type ProviderKind,
  type ProviderModelOptions,
  type ServerProviderModel,
  type ThreadId,
} from "@t3tools/contracts";
import {
  applyClaudePromptEffortPrefix,
  isClaudeUltrathinkPrompt,
  trimOrNull,
  getDefaultEffort,
  getDefaultContextWindow,
  hasContextWindowOption,
  resolveEffort,
} from "@t3tools/shared/model";
import { memo, useCallback, useState } from "react";
import type { VariantProps } from "class-variance-authority";
import { BotIcon, ChevronDownIcon } from "lucide-react";
import { Button, buttonVariants } from "../ui/button";
import {
  Menu,
  MenuGroup,
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator as MenuDivider,
  MenuTrigger,
} from "../ui/menu";
import { useComposerDraftStore } from "../../composerDraftStore";
import { getProviderModelCapabilities } from "../../providerModels";
import { cn } from "~/lib/utils";

type ProviderOptions = ProviderModelOptions[ProviderKind];
type TraitsPersistence =
  | {
      threadId: ThreadId;
      onModelOptionsChange?: never;
    }
  | {
      threadId?: undefined;
      onModelOptionsChange: (nextOptions: ProviderOptions | undefined) => void;
    };

const ULTRATHINK_PROMPT_PREFIX = "Ultrathink:\n";

function getRawEffort(
  provider: ProviderKind,
  modelOptions: ProviderOptions | null | undefined,
): string | null {
  if (provider === "codex") {
    return trimOrNull((modelOptions as CodexModelOptions | undefined)?.reasoningEffort);
  }
  return trimOrNull((modelOptions as ClaudeModelOptions | undefined)?.effort);
}

function getRawContextWindow(
  provider: ProviderKind,
  modelOptions: ProviderOptions | null | undefined,
): string | null {
  if (provider === "claudeAgent") {
    return trimOrNull((modelOptions as ClaudeModelOptions | undefined)?.contextWindow);
  }
  return null;
}

function buildNextOptions(
  provider: ProviderKind,
  modelOptions: ProviderOptions | null | undefined,
  patch: Record<string, unknown>,
): ProviderOptions {
  if (provider === "codex") {
    return { ...(modelOptions as CodexModelOptions | undefined), ...patch } as CodexModelOptions;
  }
  return { ...(modelOptions as ClaudeModelOptions | undefined), ...patch } as ClaudeModelOptions;
}

function getSelectedTraits(
  provider: ProviderKind,
  models: ReadonlyArray<ServerProviderModel>,
  model: string | null | undefined,
  prompt: string,
  modelOptions: ProviderOptions | null | undefined,
  allowPromptInjectedEffort: boolean,
) {
  const caps = getProviderModelCapabilities(models, model, provider);
  const effortLevels = allowPromptInjectedEffort
    ? caps.reasoningEffortLevels
    : caps.reasoningEffortLevels.filter(
        (option) => !caps.promptInjectedEffortLevels.includes(option.value),
      );

  // Resolve effort from options (provider-specific key)
  const rawEffort = getRawEffort(provider, modelOptions);
  const effort = resolveEffort(caps, rawEffort) ?? null;

  // Thinking toggle (only for models that support it)
  const thinkingEnabled = caps.supportsThinkingToggle
    ? ((modelOptions as ClaudeModelOptions | undefined)?.thinking ?? true)
    : null;

  // Fast mode
  const fastModeEnabled =
    caps.supportsFastMode &&
    (modelOptions as { fastMode?: boolean } | undefined)?.fastMode === true;

  // Context window
  const contextWindowOptions = caps.contextWindowOptions;
  const rawContextWindow = getRawContextWindow(provider, modelOptions);
  const defaultContextWindow = getDefaultContextWindow(caps);
  const contextWindow =
    rawContextWindow && hasContextWindowOption(caps, rawContextWindow)
      ? rawContextWindow
      : defaultContextWindow;

  // Prompt-controlled effort (e.g. ultrathink in prompt text)
  const ultrathinkPromptControlled =
    allowPromptInjectedEffort &&
    caps.promptInjectedEffortLevels.length > 0 &&
    isClaudeUltrathinkPrompt(prompt);

  return {
    caps,
    effort,
    effortLevels,
    thinkingEnabled,
    fastModeEnabled,
    contextWindowOptions,
    contextWindow,
    defaultContextWindow,
    ultrathinkPromptControlled,
  };
}

export interface TraitsMenuContentProps {
  provider: ProviderKind;
  models: ReadonlyArray<ServerProviderModel>;
  model: string | null | undefined;
  prompt: string;
  onPromptChange: (prompt: string) => void;
  modelOptions?: ProviderOptions | null | undefined;
  allowPromptInjectedEffort?: boolean;
  iconOnly?: boolean;
  showEffort?: boolean;
  triggerIcon?: "bars" | "bot";
  triggerVariant?: VariantProps<typeof buttonVariants>["variant"];
  triggerClassName?: string;
}

function stripUltrathinkPrefix(prompt: string): string {
  return prompt.replace(/^Ultrathink:\s*\n?/i, "");
}

function resolveTraitIndicator(
  effortLevels: ReadonlyArray<{ value: string; label: string }>,
  effort: string | null,
  thinkingEnabled: boolean | null,
  fastModeEnabled: boolean,
  ultrathinkPromptControlled: boolean,
): { activeBars: number; toneClassName: string } {
  if (ultrathinkPromptControlled) {
    return { activeBars: 4, toneClassName: "text-amber-400" };
  }

  if (effort && effortLevels.length > 0) {
    const effortIndex = effortLevels.findIndex((option) => option.value === effort);
    const activeBars =
      effortIndex >= 0 ? Math.max(1, Math.ceil(((effortIndex + 1) / effortLevels.length) * 4)) : 1;

    if (activeBars >= 4) {
      return { activeBars, toneClassName: "text-amber-400" };
    }
    if (activeBars === 3) {
      return { activeBars, toneClassName: "text-emerald-400" };
    }
    if (activeBars === 2) {
      return { activeBars, toneClassName: "text-sky-400" };
    }
    return { activeBars, toneClassName: "text-muted-foreground" };
  }

  if (thinkingEnabled === true) {
    return { activeBars: 2, toneClassName: "text-sky-400" };
  }

  if (fastModeEnabled) {
    return { activeBars: 1, toneClassName: "text-emerald-400" };
  }

  return {
    activeBars: thinkingEnabled === false ? 1 : 2,
    toneClassName: thinkingEnabled === false ? "text-muted-foreground" : "text-muted-foreground/80",
  };
}

function TraitBarsIcon(props: { activeBars: number; className?: string }) {
  const barHeights = [5, 8, 11, 14];

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 18 18"
      className={cn("size-3.5 shrink-0", props.className)}
      fill="none"
    >
      {barHeights.map((height, index) => {
        const x = 1.5 + index * 4;
        const y = 16 - height;
        const isActive = index < props.activeBars;

        return (
          <rect
            key={height}
            x={x}
            y={y}
            width="2.5"
            height={height}
            rx="1"
            className={isActive ? "fill-current" : "fill-current opacity-20"}
          />
        );
      })}
    </svg>
  );
}

export const TraitsMenuContent = memo(function TraitsMenuContentImpl({
  provider,
  models,
  model,
  prompt,
  onPromptChange,
  modelOptions,
  allowPromptInjectedEffort = true,
  showEffort = true,
  ...persistence
}: TraitsMenuContentProps & TraitsPersistence) {
  const setProviderModelOptions = useComposerDraftStore((store) => store.setProviderModelOptions);
  const updateModelOptions = useCallback(
    (nextOptions: ProviderOptions | undefined) => {
      if ("onModelOptionsChange" in persistence) {
        persistence.onModelOptionsChange(nextOptions);
        return;
      }
      setProviderModelOptions(persistence.threadId, provider, nextOptions, { persistSticky: true });
    },
    [persistence, provider, setProviderModelOptions],
  );
  const {
    caps,
    effort,
    effortLevels,
    thinkingEnabled,
    fastModeEnabled,
    contextWindowOptions,
    contextWindow,
    defaultContextWindow,
    ultrathinkPromptControlled,
  } = getSelectedTraits(provider, models, model, prompt, modelOptions, allowPromptInjectedEffort);
  const defaultEffort = getDefaultEffort(caps);

  const handleEffortChange = useCallback(
    (value: string) => {
      if (ultrathinkPromptControlled) return;
      if (!value) return;
      const nextOption = effortLevels.find((option) => option.value === value);
      if (!nextOption) return;
      if (caps.promptInjectedEffortLevels.includes(nextOption.value)) {
        const nextPrompt =
          prompt.trim().length === 0
            ? ULTRATHINK_PROMPT_PREFIX
            : applyClaudePromptEffortPrefix(prompt, "ultrathink");
        onPromptChange(nextPrompt);
        return;
      }
      const effortKey = provider === "codex" ? "reasoningEffort" : "effort";
      updateModelOptions(
        buildNextOptions(provider, modelOptions, { [effortKey]: nextOption.value }),
      );
    },
    [
      ultrathinkPromptControlled,
      modelOptions,
      onPromptChange,
      updateModelOptions,
      effortLevels,
      prompt,
      caps.promptInjectedEffortLevels,
      provider,
    ],
  );

  const hasSettingsContent =
    thinkingEnabled !== null || caps.supportsFastMode || contextWindowOptions.length > 1;

  if ((!showEffort || effort === null) && !hasSettingsContent) {
    return null;
  }

  return (
    <>
      {showEffort && effort ? (
        <>
          <MenuGroup>
            <div className="px-2 pt-1.5 pb-1 font-medium text-muted-foreground text-xs">Effort</div>
            {ultrathinkPromptControlled ? (
              <div className="px-2 pb-1.5 text-muted-foreground/80 text-xs">
                Remove Ultrathink from the prompt to change effort.
              </div>
            ) : null}
            <MenuRadioGroup value={effort} onValueChange={handleEffortChange}>
              {effortLevels.map((option) => (
                <MenuRadioItem
                  key={option.value}
                  value={option.value}
                  disabled={ultrathinkPromptControlled}
                >
                  {option.label}
                  {option.value === defaultEffort ? " (default)" : ""}
                </MenuRadioItem>
              ))}
            </MenuRadioGroup>
          </MenuGroup>
        </>
      ) : showEffort ? null : thinkingEnabled !== null ? (
        <MenuGroup>
          <div className="px-2 py-1.5 font-medium text-muted-foreground text-xs">Thinking</div>
          <MenuRadioGroup
            value={thinkingEnabled ? "on" : "off"}
            onValueChange={(value) => {
              updateModelOptions(
                buildNextOptions(provider, modelOptions, { thinking: value === "on" }),
              );
            }}
          >
            <MenuRadioItem value="on">On (default)</MenuRadioItem>
            <MenuRadioItem value="off">Off</MenuRadioItem>
          </MenuRadioGroup>
        </MenuGroup>
      ) : null}
      {caps.supportsFastMode ? (
        <>
          {showEffort || thinkingEnabled !== null ? <MenuDivider /> : null}
          <MenuGroup>
            <div className="px-2 py-1.5 font-medium text-muted-foreground text-xs">Fast Mode</div>
            <MenuRadioGroup
              value={fastModeEnabled ? "on" : "off"}
              onValueChange={(value) => {
                updateModelOptions(
                  buildNextOptions(provider, modelOptions, { fastMode: value === "on" }),
                );
              }}
            >
              <MenuRadioItem value="off">off</MenuRadioItem>
              <MenuRadioItem value="on">on</MenuRadioItem>
            </MenuRadioGroup>
          </MenuGroup>
        </>
      ) : null}
      {contextWindowOptions.length > 1 ? (
        <>
          {showEffort || thinkingEnabled !== null || caps.supportsFastMode ? <MenuDivider /> : null}
          <MenuGroup>
            <div className="px-2 py-1.5 font-medium text-muted-foreground text-xs">
              Context Window
            </div>
            <MenuRadioGroup
              value={contextWindow ?? defaultContextWindow ?? ""}
              onValueChange={(value) => {
                updateModelOptions(
                  buildNextOptions(provider, modelOptions, {
                    contextWindow: value,
                  }),
                );
              }}
            >
              {contextWindowOptions.map((option) => (
                <MenuRadioItem key={option.value} value={option.value}>
                  {option.label}
                  {option.value === defaultContextWindow ? " (default)" : ""}
                </MenuRadioItem>
              ))}
            </MenuRadioGroup>
          </MenuGroup>
        </>
      ) : null}
    </>
  );
});

export const EffortCycleButton = memo(function EffortCycleButton({
  provider,
  models,
  model,
  prompt,
  onPromptChange,
  modelOptions,
  allowPromptInjectedEffort = true,
  triggerVariant,
  triggerClassName,
  ...persistence
}: TraitsMenuContentProps & TraitsPersistence) {
  const setProviderModelOptions = useComposerDraftStore((store) => store.setProviderModelOptions);
  const updateModelOptions = useCallback(
    (nextOptions: ProviderOptions | undefined) => {
      if ("onModelOptionsChange" in persistence) {
        persistence.onModelOptionsChange(nextOptions);
        return;
      }
      setProviderModelOptions(persistence.threadId, provider, nextOptions, { persistSticky: true });
    },
    [persistence, provider, setProviderModelOptions],
  );
  const {
    caps,
    effort,
    effortLevels,
    thinkingEnabled,
    fastModeEnabled,
    ultrathinkPromptControlled,
  } = getSelectedTraits(provider, models, model, prompt, modelOptions, allowPromptInjectedEffort);

  const { activeBars, toneClassName } = resolveTraitIndicator(
    effortLevels,
    effort,
    thinkingEnabled,
    fastModeEnabled,
    ultrathinkPromptControlled,
  );
  const effortLabel = effort
    ? (effortLevels.find((option) => option.value === effort)?.label ?? effort)
    : null;

  const handleClick = useCallback(() => {
    if (!effort || effortLevels.length === 0) {
      return;
    }

    const currentIndex = effortLevels.findIndex((option) => option.value === effort);
    const nextOption = effortLevels[(currentIndex + 1 + effortLevels.length) % effortLevels.length];
    if (!nextOption) {
      return;
    }

    if (caps.promptInjectedEffortLevels.includes(nextOption.value)) {
      const nextPrompt =
        prompt.trim().length === 0
          ? ULTRATHINK_PROMPT_PREFIX
          : applyClaudePromptEffortPrefix(stripUltrathinkPrefix(prompt), "ultrathink");
      onPromptChange(nextPrompt);
      return;
    }

    if (ultrathinkPromptControlled) {
      onPromptChange(stripUltrathinkPrefix(prompt));
    }

    const effortKey = provider === "codex" ? "reasoningEffort" : "effort";
    updateModelOptions(buildNextOptions(provider, modelOptions, { [effortKey]: nextOption.value }));
  }, [
    caps.promptInjectedEffortLevels,
    effort,
    effortLevels,
    modelOptions,
    onPromptChange,
    prompt,
    provider,
    ultrathinkPromptControlled,
    updateModelOptions,
  ]);

  if (!effort || effortLevels.length <= 1) {
    return null;
  }

  return (
    <Button
      size="xs"
      variant={triggerVariant ?? "ghost"}
      className={cn(
        "shrink-0 rounded-full px-2 text-muted-foreground/80 hover:text-foreground",
        triggerClassName,
      )}
      aria-label={effortLabel ? `Effort: ${effortLabel}` : "Cycle effort"}
      title={effortLabel ? `Effort: ${effortLabel}` : "Cycle effort"}
      onClick={handleClick}
    >
      <TraitBarsIcon activeBars={activeBars} className={toneClassName} />
    </Button>
  );
});

export const TraitsPicker = memo(function TraitsPicker({
  provider,
  models,
  model,
  prompt,
  onPromptChange,
  modelOptions,
  allowPromptInjectedEffort = true,
  iconOnly = false,
  showEffort = true,
  triggerIcon = "bars",
  triggerVariant,
  triggerClassName,
  ...persistence
}: TraitsMenuContentProps & TraitsPersistence) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const {
    caps,
    effort,
    effortLevels,
    thinkingEnabled,
    fastModeEnabled,
    contextWindowOptions,
    contextWindow,
    defaultContextWindow,
    ultrathinkPromptControlled,
  } = getSelectedTraits(provider, models, model, prompt, modelOptions, allowPromptInjectedEffort);

  const effortLabel = effort
    ? (effortLevels.find((l) => l.value === effort)?.label ?? effort)
    : null;
  const contextWindowLabel =
    contextWindowOptions.length > 1 && contextWindow !== defaultContextWindow
      ? (contextWindowOptions.find((o) => o.value === contextWindow)?.label ?? null)
      : null;
  const hasSettingsContent =
    thinkingEnabled !== null || caps.supportsFastMode || contextWindowOptions.length > 1;
  const { activeBars, toneClassName } = resolveTraitIndicator(
    effortLevels,
    effort,
    thinkingEnabled,
    fastModeEnabled,
    ultrathinkPromptControlled,
  );
  const triggerLabel = [
    ...(showEffort
      ? [
          ultrathinkPromptControlled
            ? "Ultrathink"
            : effortLabel
              ? effortLabel
              : thinkingEnabled === null
                ? null
                : `Thinking ${thinkingEnabled ? "On" : "Off"}`,
        ]
      : []),
    ...(caps.supportsFastMode && fastModeEnabled ? ["Fast"] : []),
    ...(contextWindowLabel ? [contextWindowLabel] : []),
  ]
    .filter(Boolean)
    .join(" · ");

  const isCodexStyle = provider === "codex";

  if ((showEffort && effort === null) || (!showEffort && !hasSettingsContent)) {
    return null;
  }

  return (
    <Menu
      open={isMenuOpen}
      onOpenChange={(open) => {
        setIsMenuOpen(open);
      }}
    >
      <MenuTrigger
        render={
          <Button
            size={iconOnly ? "xs" : "sm"}
            variant={triggerVariant ?? "ghost"}
            className={cn(
              iconOnly
                ? "shrink-0 rounded-full px-2 text-muted-foreground/80 hover:text-foreground"
                : isCodexStyle
                ? "min-w-0 max-w-40 shrink justify-start overflow-hidden whitespace-nowrap px-2 text-muted-foreground/70 hover:text-foreground/80 sm:max-w-48 sm:px-3 [&_svg]:mx-0"
                : "shrink-0 whitespace-nowrap px-2 text-muted-foreground/70 hover:text-foreground/80 sm:px-3",
              triggerClassName,
            )}
            aria-label={triggerLabel || "Model traits"}
            title={triggerLabel || "Model traits"}
          />
        }
      >
        {iconOnly ? (
          triggerIcon === "bot" ? (
            <BotIcon className="size-3.5" />
          ) : (
            <TraitBarsIcon activeBars={activeBars} className={toneClassName} />
          )
        ) : isCodexStyle ? (
          <span className="flex min-w-0 w-full items-center gap-2 overflow-hidden">
            {triggerLabel}
            <ChevronDownIcon aria-hidden="true" className="size-3 shrink-0 opacity-60" />
          </span>
        ) : (
          <>
            <span>{triggerLabel}</span>
            <ChevronDownIcon aria-hidden="true" className="size-3 opacity-60" />
          </>
        )}
      </MenuTrigger>
      <MenuPopup align="start">
        <TraitsMenuContent
          provider={provider}
          models={models}
          model={model}
          prompt={prompt}
          onPromptChange={onPromptChange}
          modelOptions={modelOptions}
          allowPromptInjectedEffort={allowPromptInjectedEffort}
          showEffort={showEffort}
          {...persistence}
        />
      </MenuPopup>
    </Menu>
  );
});

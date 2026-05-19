<script lang="ts">
import type { FrameworkShowcaseEntry } from '../../lib/framework-showcase'

interface Props {
  entries: FrameworkShowcaseEntry[]
}

const { entries }: Props = $props()

let activeId = $state<string>(entries[0]?.id ?? 'react')
const active = $derived(entries.find((e) => e.id === activeId) ?? entries[0])
let copied = $state(false)

function emitToast(message: string) {
  window.dispatchEvent(new CustomEvent('avatune:toast', { detail: message }))
}

async function copySnippet() {
  if (!active) return
  try {
    await navigator.clipboard.writeText(active.snippet)
    copied = true
    setTimeout(() => (copied = false), 1500)
    emitToast(`Copied ${active.label} snippet`)
  } catch {
    /* no-op */
  }
}

async function copyInstall() {
  if (!active) return
  try {
    await navigator.clipboard.writeText(`npm i ${active.pkg}`)
    emitToast(`Copied npm i ${active.pkg}`)
  } catch {
    /* no-op */
  }
}

const tabBase =
  'flex shrink-0 cursor-pointer items-center gap-2.5 border-0 border-r border-line px-[22px] py-4 text-sm font-medium whitespace-nowrap transition'
const tabIdle = 'bg-transparent text-ink-3 hover:bg-paper-3 hover:text-ink-2'
const tabActive =
  'bg-[#131313] text-ink shadow-[inset_0_-2px_0_var(--color-ink)]'
const btnBase =
  'inline-flex cursor-pointer items-center gap-2 rounded-lg border border-line-2 bg-paper-3 px-4 py-2.5 text-sm font-medium whitespace-nowrap text-ink transition hover:border-line-strong hover:bg-paper-card active:translate-y-px'
</script>

<div class="overflow-hidden rounded-[14px] border border-line bg-[#0d0d0d]">
  <!-- Tabs row -->
  <div class="flex overflow-x-auto border-b border-line">
    {#each entries as entry (entry.id)}
      <button
        type="button"
        onclick={() => (activeId = entry.id)}
        class="{tabBase} {activeId === entry.id ? tabActive : tabIdle}"
      >
        {#if entry.logo}
          <img
            src={entry.logo.src}
            alt={entry.logo.alt}
            width="18"
            height="18"
            class={activeId === entry.id ? 'opacity-100' : 'opacity-70'}
          />
        {/if}
        {entry.label}
      </button>
    {/each}
  </div>

  <!-- Body -->
  {#if active}
    <div class="grid min-h-[320px] grid-cols-1 lg:grid-cols-[1fr_1.2fr]">
      <!-- Meta sidebar -->
      <div
        class="flex flex-col justify-center gap-[18px] border-b border-line p-8 lg:border-r lg:border-b-0"
      >
        <div
          class="font-display text-[32px] leading-tight tracking-[-0.02em]"
        >
          {active.tagline}
        </div>

        <div
          class="flex flex-col gap-2.5 font-code text-[11.5px] text-ink-3"
        >
          <div class="flex items-baseline gap-3.5">
            <span class="w-[60px] shrink-0 text-ink-4">package</span>
            <span class="min-w-0 truncate text-ink-2">{active.pkg}</span>
          </div>
          <div class="flex items-baseline gap-3.5">
            <span class="w-[60px] shrink-0 text-ink-4">size</span>
            <span class="text-ink-2">
              {active.size}
              <span class="text-ink-4">gzipped</span>
            </span>
          </div>
          <div class="flex items-baseline gap-3.5">
            <span class="w-[60px] shrink-0 text-ink-4">deps</span>
            <span class="text-ink-2">{active.deps}</span>
          </div>
          <div class="flex items-baseline gap-3.5">
            <span class="w-[60px] shrink-0 text-ink-4">since</span>
            <span class="text-ink-2">{active.since}</span>
          </div>
        </div>

        <div>
          <button type="button" class={btnBase} onclick={copyInstall}>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="m4 17 6-6-6-6" />
              <path d="M12 19h8" />
            </svg>
            <code class="font-code text-[12px]">npm i {active.pkg}</code>
          </button>
        </div>
      </div>

      <!-- Code panel -->
      <div class="bg-paper p-6">
        <div class="code-shell rounded-xl border border-line bg-[#0c0c0c]">
          <div
            class="flex items-center gap-3 border-b border-line px-3.5 py-2.5 text-ink-3"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="text-ink-3"
            >
              <path
                d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"
              />
              <path d="M14 3v5h5" />
            </svg>
            <span class="font-code text-[11.5px] text-ink-2">
              {active.filePath}
            </span>
            <button
              type="button"
              class="ml-auto cursor-pointer rounded-md border border-line-2 bg-transparent px-2.5 py-1 font-code text-[11px] text-ink-2 transition hover:border-line-strong hover:text-ink"
              onclick={copySnippet}
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <div>
            {@html active.highlightedSnippet}
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>

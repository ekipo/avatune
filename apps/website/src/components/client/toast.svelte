<script lang="ts">
import { onDestroy, onMount } from 'svelte'

type ToastItem = { id: number; message: string }

let items = $state<ToastItem[]>([])
let nextId = 0

function show(message: string) {
  const id = nextId++
  items = [...items, { id, message }]
  setTimeout(() => {
    items = items.filter((t) => t.id !== id)
  }, 2400)
}

function onToast(e: Event) {
  const detail = (e as CustomEvent<string>).detail
  if (typeof detail === 'string' && detail.length > 0) show(detail)
}

onMount(() => {
  window.addEventListener('avatune:toast', onToast as EventListener)
})

onDestroy(() => {
  window.removeEventListener('avatune:toast', onToast as EventListener)
})
</script>

<div
  class="pointer-events-none fixed right-5 bottom-5 z-[100] flex flex-col gap-2"
  aria-live="polite"
>
  {#each items as item (item.id)}
    <div
      class="pointer-events-auto flex items-center gap-2 rounded-lg border border-line-2 bg-[rgba(20,20,20,0.96)] px-4 py-2.5 font-code text-[12px] tracking-[0.04em] text-ink shadow-2xl backdrop-blur-md"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.4"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="text-emerald-mark"
      >
        <path d="M5 13l4 4L19 7" />
      </svg>
      <span>{item.message}</span>
    </div>
  {/each}
</div>

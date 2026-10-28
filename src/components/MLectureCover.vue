<script setup>
defineProps({ title: { type: String, required: true }, subtitle: { type: String, default: '' }, image: { type: String, default: '' } });
</script>

<template>
  <button class="lecture-cover" type="button" :aria-label="title">
    <img v-if="image" class="cover-image" :src="image" alt="" />
    <svg v-else class="cover-art" viewBox="0 0 210 297" aria-hidden="true">
      <rect width="210" height="297" class="cover-background" />
      <rect width="7" height="297" class="cover-spine" />
      <path d="M25 29h160 M25 263h160" class="cover-rule" />
      <text x="25" y="23" class="cover-brand">MAKI / MATH</text>
      <text x="185" y="23" text-anchor="end" class="cover-index">LECTURE NOTES</text>
      <g class="cover-grid">
        <path d="M38 65v152 M65 65v152 M92 65v152 M119 65v152 M146 65v152 M173 65v152" />
        <path d="M38 65h135 M38 92h135 M38 119h135 M38 146h135 M38 173h135 M38 200h135" />
      </g>
      <path d="M43 192 L69 171 L96 178 L122 129 L148 139 L173 91" class="cover-graph" />
      <circle cx="69" cy="171" r="3" class="cover-dot" />
      <circle cx="122" cy="129" r="3" class="cover-dot" />
      <circle cx="173" cy="91" r="3" class="cover-dot" />
      <text x="25" y="277" class="cover-footer">KNOWLEDGE / PRACTICE</text>
      <text x="185" y="277" text-anchor="end" class="cover-footer">∑</text>
    </svg>
    <span class="cover-caption">
      <span class="cover-title">{{ title }}</span>
      <span v-if="subtitle" class="cover-subtitle">{{ subtitle }}</span>
    </span>
  </button>
</template>

<style scoped>
.lecture-cover { position: relative; display: block; width: 100%; aspect-ratio: 210 / 297; padding: 0; overflow: hidden; border: 1px solid var(--border-subtle); border-radius: var(--radius-xs); background: var(--bg-surface); color: var(--text-primary); text-align: left; cursor: pointer; transition: border-color 180ms ease; }
.lecture-cover:hover, .lecture-cover:focus-visible { border-color: var(--accent-primary); }
.lecture-cover:focus-visible { outline: 2px solid var(--accent-primary); outline-offset: 2px; }
.cover-image { display: block; width: 100%; height: 100%; object-fit: cover; }
.cover-art { display: block; width: 100%; height: 100%; pointer-events: none; }
.cover-background { fill: var(--bg-surface); }
.cover-spine { fill: var(--accent-primary); }
.cover-rule { fill: none; stroke: var(--border-hover); stroke-width: 0.8; }
.cover-brand, .cover-index, .cover-footer { fill: var(--text-secondary); font-family: var(--font-mono, monospace); font-size: 9px; letter-spacing: 0.4px; }
.cover-brand { fill: var(--text-primary); font-weight: 600; }
.cover-grid { fill: none; stroke: var(--border-subtle); stroke-width: 0.65; }
.cover-graph { fill: none; stroke: var(--accent-primary); stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; }
.cover-dot { fill: var(--accent-primary); }
.cover-caption { position: absolute; inset: auto 0 0; display: flex; flex-direction: column; gap: 5px; max-height: 55%; padding: 16px; overflow: hidden; background: color-mix(in srgb, var(--bg-surface) 94%, transparent); border-top: 1px solid var(--border-subtle); opacity: 0; transform: translateY(8px); transition: opacity 200ms cubic-bezier(0.4, 0, 0.2, 1), transform 200ms cubic-bezier(0.4, 0, 0.2, 1); }
.lecture-cover:hover .cover-caption, .lecture-cover:focus-visible .cover-caption { opacity: 1; transform: translateY(0); }
.cover-title, .cover-subtitle { overflow-wrap: anywhere; }
.cover-title { font-size: var(--font-size); font-weight: var(--font-weight-semibold); line-height: 1.5; }
.cover-subtitle { color: var(--text-secondary); font-size: var(--font-size-smaller); line-height: 1.5; }
@media (prefers-reduced-motion: reduce) { .lecture-cover, .cover-caption { transition: none; } }
@media (hover: none) { .cover-caption { opacity: 1; transform: none; } }
</style>

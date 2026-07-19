<script setup lang="ts">
defineProps<{ kind: 'plate' | 'shell' | null; boundarySelected: boolean }>()
</script>

<template>
  <figure class="diagram" data-testid="buckling-diagram">
    <svg v-if="kind === 'plate'" viewBox="0 0 420 260" role="img" aria-label="四边简支矩形板单向压缩示意图">
      <defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0 0L8 4L0 8Z" fill="#9b3f31" /></marker></defs>
      <rect x="90" y="55" width="240" height="150" class="body" />
      <path d="M52 90H88M52 130H88M52 170H88M368 90H332M368 130H332M368 170H332" class="load" />
      <path d="M80 218H340M75 55V205M345 55V205" class="dim" />
      <text x="205" y="242">a · x（压缩方向）</text><text x="48" y="135">b · y</text>
      <text x="160" y="42">Nx &gt; 0 压缩</text><text x="135" y="132">m × n 半波</text>
    </svg>
    <svg v-else-if="kind === 'shell'" viewBox="0 0 420 260" role="img" aria-label="简支圆柱薄壳均匀轴压示意图">
      <defs><marker id="arrow2" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0 0L8 4L0 8Z" fill="#9b3f31" /></marker></defs>
      <ellipse cx="105" cy="130" rx="55" ry="78" class="body" /><ellipse cx="315" cy="130" rx="55" ry="78" class="body" />
      <path d="M105 52H315M105 208H315" class="body" /><path d="M40 75H82M40 110H82M40 150H82M40 185H82M380 75H338M380 110H338M380 150H338M380 185H338" class="load" />
      <path d="M105 225H315" class="dim" /><text x="202" y="247">L</text><text x="176" y="126">平均半径 r</text><text x="175" y="146">厚度 t</text>
    </svg>
    <p v-else>先选择“矩形板”或“圆柱壳”，再选择对应边界。</p>
    <figcaption>{{ boundarySelected ? '边界已显式选择；箭头指向构件，压缩量取正值。' : '边界尚未选择，当前不会计算。' }}</figcaption>
  </figure>
</template>

<style scoped>
.diagram{margin:0;padding:18px;border:1px solid var(--color-line);border-radius:var(--radius-large);background:#f8faf9;text-align:center}svg{width:100%;height:auto}.body{fill:#dcebe8;stroke:#235f58;stroke-width:3}.load{fill:none;stroke:#9b3f31;stroke-width:3;marker-end:url(#arrow)}svg:nth-child(1) .load{marker-end:url(#arrow)}svg:nth-child(2) .load{marker-end:url(#arrow2)}.dim{fill:none;stroke:#54666d;stroke-width:1.5}text{font-size:12px;fill:#26383d;text-anchor:middle}figcaption,p{margin:10px 0 0;font-size:11px;color:#52666d}
</style>

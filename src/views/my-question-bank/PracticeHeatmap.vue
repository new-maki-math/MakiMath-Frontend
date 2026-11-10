<script setup>
import { computed, ref } from 'vue';

const props = defineProps({
  days: {
    type: Array,
    required: true
  }
});

const selected = ref(null);
const weeks = computed(() => {
  const rows = [];
  for (let i = 0; i < props.days.length; i += 7) {
    rows.push(props.days.slice(i, i + 7));
  }
  return rows;
});
const total = computed(() => props.days.reduce((sum, day) => sum + day.count, 0));
const activeDays = computed(() => props.days.filter((day) => day.count > 0).length);
const monthLabels = computed(() => {
  let last = '';
  return weeks.value.map((week) => {
    const date = week[0]?.date || '';
    const month = date.slice(0, 7);
    if (!month || month === last) {
      return '';
    }
    last = month;
    return `${Number(month.slice(5))}月`;
  });
});
const level = (count) => (count === 0 ? 0 : count < 3 ? 1 : count < 6 ? 2 : count < 10 ? 3 : 4);
</script>

<template>
  <div class="heatmap">
    <div class="heatmap-top">
      <div>
        <span class="total">{{ total }}</span
        ><span class="unit"> 道练习</span>
        <p>近一年有 {{ activeDays }} 天完成练习</p>
      </div>
      <span class="sample">示例数据</span>
    </div>
    <div class="heatmap-scroll">
      <div
        class="heatmap-grid"
        :style="{
          '--week-count': weeks.length
        }"
      >
        <div
          class="month-row"
          aria-hidden="true"
        >
          <span class="weekday-spacer"></span>
          <div class="months">
            <span
              v-for="(month, index) in monthLabels"
              :key="index"
              >{{ month }}</span
            >
          </div>
        </div>
        <div class="grid-body">
          <div
            class="weekdays"
            aria-hidden="true"
          >
            <span>一</span><span></span><span>三</span><span></span><span>五</span><span></span
            ><span>日</span>
          </div>
          <div
            class="weeks"
            aria-label="每日练习热力图"
          >
            <div
              v-for="(week, index) in weeks"
              :key="index"
              class="week"
            >
              <button
                v-for="day in week"
                :key="day.date"
                type="button"
                class="cell"
                :class="[
                  `level-${level(day.count)}`,
                  {
                    'is-selected': selected?.date === day.date
                  }
                ]"
                :aria-label="`${day.date}，完成 ${day.count} 道题`"
                :title="`${day.date} · ${day.count} 道题`"
                @click="selected = day"
                @focus="selected = day"
              ></button>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="heatmap-bottom">
      <span
        class="selection"
        aria-live="polite"
        >{{
          selected ? `${selected.date} · ${selected.count} 道题` : '选择方块查看当天练习数量'
        }}</span
      >
      <div
        class="legend"
        aria-label="颜色越深表示练习题数越多"
      >
        <span>少</span
        ><i
          v-for="n in 5"
          :key="n"
          class="legend-cell"
          :class="`level-${n - 1}`"
        ></i
        ><span>多</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.heatmap {
  padding: 24px;
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius);
}
.heatmap-top,
.heatmap-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}
.total {
  color: var(--text-primary);
  font-size: 26px;
  font-weight: var(--font-weight-bold);
}
.unit {
  color: var(--text-primary);
  font-size: var(--font-size-smaller);
}
.heatmap-top p {
  margin: 5px 0 0;
  color: var(--text-muted);
  font-size: var(--font-size-smaller);
}
.sample {
  color: var(--text-muted);
  font-size: var(--font-size-smallest);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius);
  padding: 4px 8px;
  white-space: nowrap;
}
.heatmap-scroll {
  margin: 24px 0 18px;
}
.heatmap-grid {
  width: 100%;
}
.month-row,
.grid-body {
  display: flex;
  gap: 10px;
}
.weekday-spacer,
.weekdays {
  width: 18px;
  flex: none;
}
.months,
.weeks {
  display: grid;
  grid-template-columns: repeat(var(--week-count), minmax(0, 1fr));
  gap: 4px;
  flex: 1;
  min-width: 0;
}
.months {
  height: 22px;
  color: var(--text-muted);
  font-size: 11px;
}
.months span {
  white-space: nowrap;
}
.weekdays,
.week {
  display: grid;
  grid-template-rows: repeat(7, 1fr);
  gap: 4px;
}
.weekdays {
  color: var(--text-muted);
  font-size: 10px;
  align-items: center;
}
.cell,
.legend-cell {
  display: block;
  border-radius: var(--radius);
}
.cell {
  width: 100%;
  aspect-ratio: 1;
  padding: 0;
  border: 1px solid transparent;
  cursor: pointer;
}
.cell:hover,
.cell:focus-visible,
.cell.is-selected {
  outline: 2px solid var(--text-secondary);
  outline-offset: 1px;
}
.level-0 {
  background: var(--heat-0);
}
.level-1 {
  background: var(--heat-1);
}
.level-2 {
  background: var(--heat-2);
}
.level-3 {
  background: var(--heat-3);
}
.level-4 {
  background: var(--heat-4);
}
.heatmap-bottom {
  color: var(--text-muted);
  font-size: var(--font-size-smallest);
}
.legend {
  display: flex;
  align-items: center;
  gap: 5px;
  flex: none;
}
.legend-cell {
  width: 11px;
  height: 11px;
}
@media (max-width: 600px) {
  .heatmap {
    padding: 18px;
  }
  .months,
  .weeks,
  .weekdays,
  .week {
    gap: 2px;
  }
  .cell {
    border-radius: var(--radius);
  }
  .heatmap-bottom {
    align-items: flex-start;
    flex-wrap: wrap;
  }
}
</style>

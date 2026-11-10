<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';

import { getCachedFile, hashCacheValue, putCachedFile } from '../../utils/file-cache.js';
import { deleteSchedule, listSchedule, saveSchedule } from '../../utils/schedule.js';
import { EditPencil, NavArrowLeft, NavArrowRight, Plus, Trash } from '../icons/icons.js';

const props = defineProps({
  mode: { type: String, default: 'all' }
});
const today = ref(new Date());
const hitokoto = ref(null);
const displayedMonth = ref(new Date(today.value.getFullYear(), today.value.getMonth(), 1));
const selectedDay = ref(today.value.getDate());
const events = ref([]);
const editingId = ref(null);
const draft = ref('');
const error = ref('');
const showEditor = ref(false);
const dateKey = (year, month, day) => `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
const selectedDate = computed(() => dateKey(displayedMonth.value.getFullYear(), displayedMonth.value.getMonth(), selectedDay.value));
const selectedWeekday = computed(() =>
  `星期${'日一二三四五六'[new Date(displayedMonth.value.getFullYear(), displayedMonth.value.getMonth(), selectedDay.value).getDay()]}`
);
const selectedEvents = computed(() => events.value.filter((event) => event.date === selectedDate.value));
const eventDays = computed(() => new Set(events.value.map((event) => event.date)));

function changeMonth(delta) {
  const current = displayedMonth.value;
  displayedMonth.value = new Date(current.getFullYear(), current.getMonth() + delta, 1);
  selectedDay.value = 1;
  showEditor.value = false;
}

function changeYear(delta) {
  const current = displayedMonth.value;
  displayedMonth.value = new Date(current.getFullYear() + delta, current.getMonth(), 1);
  selectedDay.value = 1;
  showEditor.value = false;
}

function selectDay(day) {
  selectedDay.value = day;
  showEditor.value = false;
}

async function reloadEvents() {
  try {
    events.value = await listSchedule();
    error.value = '';
  } catch {
    error.value = '无法读取日程，请稍后重试。';
  }
}

function editEvent(event) {
  editingId.value = event?.id ?? null;
  draft.value = event?.title ?? '';
  showEditor.value = true;
}

async function submitEvent() {
  const title = draft.value.trim();
  if (!title) return;
  const existing = events.value.find((event) => event.id === editingId.value);
  try {
    await saveSchedule({ id: editingId.value || crypto.randomUUID(), date: selectedDate.value, title, completed: existing?.completed || false });
    window.dispatchEvent(new Event('maki-schedule-changed'));
    showEditor.value = false;
    await reloadEvents();
  } catch {
    error.value = '保存日程失败，请重试。';
  }
}

async function toggleEvent(event) {
  try {
    await saveSchedule({ ...event, completed: !event.completed });
    window.dispatchEvent(new Event('maki-schedule-changed'));
    await reloadEvents();
  } catch {
    error.value = '更新日程失败，请重试。';
  }
}

async function removeEvent(id) {
  try {
    await deleteSchedule(id);
    window.dispatchEvent(new Event('maki-schedule-changed'));
    if (editingId.value === id) showEditor.value = false;
    await reloadEvents();
  } catch {
    error.value = '删除日程失败，请重试。';
  }
}
const weekdays = ['一', '二', '三', '四', '五', '六', '日'];
const solarFestivals = {
  '1-1': '元旦',
  '3-8': '妇女节',
  '5-1': '劳动节',
  '5-4': '青年节',
  '6-1': '儿童节',
  '7-1': '建党节',
  '8-1': '建军节',
  '9-10': '教师节',
  '10-1': '国庆节'
};
const lunarFestivals = {
  '正月-1': '春节',
  '正月-15': '元宵节',
  '五月-5': '端午节',
  '七月-7': '七夕节',
  '八月-15': '中秋节',
  '九月-9': '重阳节',
  '腊月-8': '腊八节'
};
const lunarFormatter = new Intl.DateTimeFormat('zh-CN-u-ca-chinese', {
  month: 'long',
  day: 'numeric'
});
const solarTerms = [
  '小寒', '大寒', '立春', '雨水', '惊蛰', '春分', '清明', '谷雨',
  '立夏', '小满', '芒种', '夏至', '小暑', '大暑', '立秋', '处暑',
  '白露', '秋分', '寒露', '霜降', '立冬', '小雪', '大雪', '冬至'
];
const chinaDayFormatter = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  day: 'numeric'
});

function solarTermDay(year, month, index) {
  const target = (285 + (month * 2 + index) * 15) % 360;
  let time = Date.UTC(year, month, index === 0 ? 6 : 21, 12);
  for (let step = 0; step < 5; step++) {
    const t = (time / 86400000 + 2440587.5 - 2451545) / 36525;
    const meanLongitude = 280.46646 + t * (36000.76983 + t * 0.0003032);
    const anomaly = ((357.52911 + t * (35999.05029 - 0.0001537 * t)) * Math.PI) / 180;
    const center =
      (1.914602 - t * (0.004817 + 0.000014 * t)) * Math.sin(anomaly) +
      (0.019993 - 0.000101 * t) * Math.sin(2 * anomaly) +
      0.000289 * Math.sin(3 * anomaly);
    const omega = ((125.04 - 1934.136 * t) * Math.PI) / 180;
    const longitude = meanLongitude + center - 0.00569 - 0.00478 * Math.sin(omega);
    const difference = ((((longitude - target) % 360) + 540) % 360) - 180;
    time -= (difference / 0.98564736) * 86400000;
  }
  return Number(chinaDayFormatter.formatToParts(new Date(time)).find((part) => part.type === 'day')?.value);
}
const sayings = [
  '每一次理解，都是新的起点。',
  '把复杂的问题，交给耐心与思考。',
  '学过的知识，会在新的问题里相遇。',
  '慢慢走，每一步都算数。',
  '好奇心，是通往答案的第一步。',
  '留下思考，也为下一次出发铺路。',
  '知识因分享而生长。'
];
const monthLabel = computed(() => `${displayedMonth.value.getFullYear()} 年 ${displayedMonth.value.getMonth() + 1} 月`);
const days = computed(() => {
  const year = displayedMonth.value.getFullYear();
  const month = displayedMonth.value.getMonth();
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const count = new Date(year, month + 1, 0).getDate();
  return [...Array(offset).fill(null), ...Array.from({ length: count }, (_, index) => index + 1)];
});
const festivals = computed(() => {
  const year = displayedMonth.value.getFullYear();
  const month = displayedMonth.value.getMonth();
  const count = new Date(year, month + 1, 0).getDate();
  const result = {};
  const terms = [0, 1].map((index) => ({
    day: solarTermDay(year, month, index),
    name: solarTerms[month * 2 + index]
  }));
  for (let day = 1; day <= count; day++) {
    const date = new Date(year, month, day, 12);
    const parts = lunarFormatter.formatToParts(date);
    const lunarMonth = parts.find((part) => part.type === 'month')?.value;
    const lunarDay = parts.find((part) => part.type === 'day')?.value;
    const names = [
      solarFestivals[`${month + 1}-${day}`],
      lunarFestivals[`${lunarMonth}-${lunarDay}`],
      ...terms.filter((term) => term.day === day).map((term) => term.name)
    ].filter(Boolean);
    if (names.length) result[day] = names.join('、');
  }
  return result;
});
const saying = computed(() => hitokoto.value?.text || sayings[Math.floor(today.value.getTime() / 86400000) % sayings.length]);
const sayingUrl = computed(() =>
  /^[0-9a-f-]{36}$/i.test(hitokoto.value?.uuid || '')
    ? `https://hitokoto.cn/?uuid=${encodeURIComponent(hitokoto.value.uuid)}`
    : ''
);
let timer;
let quoteController;

async function loadSaying() {
  const day = dateKey(today.value.getFullYear(), today.value.getMonth(), today.value.getDate());
  const cached = await getCachedFile('hitokoto:literature-philosophy', { maxAge: 86400000 });
  if (cached?.value?.day === day && cached.value.text) {
    hitokoto.value = cached.value;
    return;
  }
  quoteController?.abort();
  const controller = new AbortController();
  quoteController = controller;
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch('https://v1.hitokoto.cn/?c=d&c=k&max_length=24', { signal: controller.signal });
    if (!response.ok) throw new Error('一言请求失败');
    const result = await response.json();
    if (typeof result.hitokoto !== 'string' || !result.hitokoto.trim()) throw new Error('一言内容为空');
    const value = {
      day,
      text: result.hitokoto.trim(),
      uuid: typeof result.uuid === 'string' ? result.uuid : '',
      author: typeof result.from_who === 'string' ? result.from_who : '',
      source: typeof result.from === 'string' ? result.from : ''
    };
    hitokoto.value = value;
    const hash = await hashCacheValue(value);
    await putCachedFile({ key: 'hitokoto:literature-philosophy', name: '一言.json', hash, value });
  } catch {
    hitokoto.value = null;
  } finally {
    clearTimeout(timeout);
  }
}

function scheduleNextDay() {
  today.value = new Date();
  if (props.mode !== 'calendar') loadSaying();
  const next = new Date(today.value.getFullYear(), today.value.getMonth(), today.value.getDate() + 1);
  timer = setTimeout(scheduleNextDay, next.getTime() - today.value.getTime() + 100);
}

onMounted(() => {
  scheduleNextDay();
  reloadEvents();
  window.addEventListener('maki-schedule-changed', reloadEvents);
});
onUnmounted(() => {
  clearTimeout(timer);
  quoteController?.abort();
  window.removeEventListener('maki-schedule-changed', reloadEvents);
});
</script>

<template>
  <aside class="shelf-companion" aria-label="日历和一言">
    <section v-if="mode !== 'saying'" class="companion-card calendar" :class="{ 'desk-calendar': mode === 'calendar' }" aria-label="本月日历">
      <div v-if="mode === 'calendar'" class="calendar-binding" aria-hidden="true"><span></span><span></span></div>
      <div v-if="mode === 'calendar'" class="desk-heading">
        <div class="date-switcher">
          <button class="icon-button" type="button" aria-label="上一年" @click="changeYear(-1)"><NavArrowLeft width="14" height="14" /></button>
          <span>{{ displayedMonth.getFullYear() }} 年</span>
          <button class="icon-button" type="button" aria-label="下一年" @click="changeYear(1)"><NavArrowRight width="14" height="14" /></button>
        </div>
        <div class="date-switcher">
          <button class="icon-button" type="button" aria-label="上个月" @click="changeMonth(-1)"><NavArrowLeft width="14" height="14" /></button>
          <span>{{ displayedMonth.getMonth() + 1 }} 月</span>
          <button class="icon-button" type="button" aria-label="下个月" @click="changeMonth(1)"><NavArrowRight width="14" height="14" /></button>
        </div>
        <div class="selected-date">
          <span class="selected-date-number">{{ selectedDay }}</span>
          <span class="selected-date-weekday">{{ selectedWeekday }}</span>
          <span v-if="festivals[selectedDay]" class="selected-date-festival">{{ festivals[selectedDay] }}</span>
        </div>
      </div>
      <div v-else class="card-heading">
        <h2>{{ monthLabel }}</h2>
        <div class="month-actions">
          <button class="icon-button" type="button" aria-label="上个月" @click="changeMonth(-1)"><NavArrowLeft width="16" height="16" /></button>
          <button class="icon-button" type="button" aria-label="下个月" @click="changeMonth(1)"><NavArrowRight width="16" height="16" /></button>
        </div>
      </div>
      <div class="calendar-grid">
        <span v-for="weekday in weekdays" :key="weekday" class="weekday">{{ weekday }}</span>
        <template v-for="(day, index) in days" :key="index">
        <button v-if="day"
          type="button"
          class="calendar-day"
          :class="{ 'is-today': dateKey(displayedMonth.getFullYear(), displayedMonth.getMonth(), day) === dateKey(today.getFullYear(), today.getMonth(), today.getDate()), 'is-selected': day === selectedDay, 'has-event': eventDays.has(dateKey(displayedMonth.getFullYear(), displayedMonth.getMonth(), day)) }"
          :aria-pressed="day === selectedDay"
          :title="festivals[day] || undefined"
          :aria-label="day ? `${day}日${festivals[day] ? `，${festivals[day]}` : ''}` : undefined"
          @click="selectDay(day)"
        >
          <span class="day-number">
            <svg v-if="dateKey(displayedMonth.getFullYear(), displayedMonth.getMonth(), day) === dateKey(today.getFullYear(), today.getMonth(), today.getDate())" class="today-mark" viewBox="0 0 28 28" aria-hidden="true">
              <path d="M19.7 5.5c-3.3-2-8.3-1.8-11.9.6C4.2 8.5 3 12.2 4 16.1c.7 3.3 3.4 6.7 7.9 7.6 4.6 1 8.8-.9 10.9-4.5 1.9-3.2 1.6-7.7-.8-10.9-2-2.6-5.7-4.4-10-3.3-2.2.5-4 1.4-5.4 2.7" />
              <path class="today-mark-accent" d="M6.9 6.3C4 8.7 3 12.6 4.1 16.4m1.3 2.3c2.8 4.7 8 6.1 12.7 4.6m.5-19.1c2.1.8 4.3 2.7 5.4 5.4" />
            </svg>
            {{ day }}
          </span>
        </button>
        <span v-else aria-hidden="true"></span>
        </template>
      </div>
    </section>
    <section v-if="mode === 'all'" class="schedule">
      <div class="schedule-heading">
        <h2>{{ displayedMonth.getMonth() + 1 }} 月 {{ selectedDay }} 日的日程</h2>
        <button class="icon-button" type="button" title="添加日程" aria-label="添加日程" @click="editEvent(null)"><Plus width="16" height="16" /></button>
      </div>
      <p v-if="error" class="schedule-error" role="alert">{{ error }}</p>
      <p v-if="!selectedEvents.length && !showEditor" class="schedule-empty">这一天还没有日程</p>
      <ul v-if="selectedEvents.length" class="schedule-list">
        <li v-for="event in selectedEvents" :key="event.id" class="schedule-item">
          <input type="checkbox" :checked="event.completed" :aria-label="`完成${event.title}`" @change="toggleEvent(event)" />
          <span :class="{ completed: event.completed }">{{ event.title }}</span>
          <button class="icon-button" type="button" :aria-label="`编辑${event.title}`" @click="editEvent(event)"><EditPencil width="15" height="15" /></button>
          <button class="icon-button" type="button" :aria-label="`删除${event.title}`" @click="removeEvent(event.id)"><Trash width="15" height="15" /></button>
        </li>
      </ul>
      <form v-if="showEditor" class="schedule-editor" @submit.prevent="submitEvent">
        <input v-model="draft" maxlength="120" aria-label="日程内容" placeholder="输入日程内容" required />
        <div class="editor-actions"><button type="button" @click="showEditor = false">取消</button><button type="submit">保存</button></div>
      </form>
    </section>
    <section v-if="mode !== 'calendar'" class="companion-card saying">
      <Transition name="saying-enter" mode="out-in" appear>
        <p :key="saying"><a v-if="sayingUrl" :href="sayingUrl" target="_blank" rel="noopener noreferrer">{{ saying }}</a><template v-else>{{ saying }}</template></p>
      </Transition>
      <span v-if="hitokoto?.author || hitokoto?.source" class="saying-source">{{ [hitokoto.author, hitokoto.source].filter(Boolean).join(' · ') }}</span>
      <span class="saying-mark" aria-hidden="true">✳</span>
    </section>
  </aside>
</template>

<style scoped>
.shelf-companion {
  display: grid;
  gap: 28px;
  box-sizing: border-box;
  min-width: 0;
  padding: 2px 0 0;
}
.companion-card {
  min-width: 0;
}
.desk-calendar {
  position: relative;
  display: grid;
  grid-template-columns: 96px minmax(0, 1fr);
  align-items: stretch;
  gap: 0;
  box-sizing: border-box;
  padding: 0;
  border: 1px solid color-mix(in srgb, var(--shelf-edge) 65%, var(--calendar-paper));
  border-radius: var(--radius);
  background: var(--calendar-paper);
  box-shadow:
    1px 0 3px var(--shadow-color-subtle),
    0 3px 8px var(--shadow-color-subtle);
}
.calendar-binding {
  position: absolute;
  top: -7px;
  right: 18%;
  left: 45%;
  display: flex;
  justify-content: space-between;
  pointer-events: none;
}
.calendar-binding span {
  width: 5px;
  height: 12px;
  border: 2px solid var(--shelf-edge);
  border-radius: var(--radius-full);
  background: var(--calendar-paper);
}
.desk-heading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: 4px;
  align-self: stretch;
  margin: 0;
  padding: 12px 4px;
  border-radius: var(--radius) 0 0 var(--radius);
  background: var(--calendar-band);
}
.date-switcher {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  color: var(--text-secondary);
  font-size: var(--font-size-smaller);
  font-weight: var(--font-weight-medium);
  white-space: nowrap;
}
.date-switcher span {
  min-width: 42px;
  font-size: var(--font-size-smaller);
  font-weight: var(--font-weight-medium);
  line-height: 1.4;
  text-align: center;
}
.desk-heading .icon-button {
  flex: 0 0 20px;
  width: 20px;
  height: 26px;
  color: var(--text-muted);
  opacity: 0;
  transition: opacity 160ms ease, color 160ms ease;
}
.date-switcher:hover .icon-button,
.date-switcher:focus-within .icon-button {
  opacity: 1;
}
@media (hover: none) {
  .desk-heading .icon-button {
    opacity: 1;
  }
}
.desk-heading .icon-button:hover {
  background: transparent;
  color: var(--accent-primary);
}
.selected-date {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  min-width: 0;
  padding: 0 2px 12px;
}
.selected-date-number {
  color: var(--accent-primary);
  font-size: 38px;
  font-weight: var(--font-weight-semibold);
  line-height: 1;
}
.selected-date-weekday,
.selected-date-festival {
  color: var(--text-secondary);
  font-size: var(--font-size-smallest);
  line-height: 1.4;
  text-align: center;
  overflow-wrap: anywhere;
}
.selected-date-festival {
  color: var(--accent-primary);
}
.desk-calendar .calendar-grid {
  padding: 12px 10px 8px;
  gap: 1px 0;
}
.desk-calendar .weekday {
  height: 24px;
  aspect-ratio: auto;
}
.desk-calendar .calendar-day {
  min-height: 29px;
  aspect-ratio: auto;
}
.desk-calendar .day-number {
  width: 21px;
  height: 21px;
}
.card-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 14px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-subtle);
}
.card-heading h2 {
  margin: 0;
  color: var(--text-primary);
  font-size: var(--font-size-larger);
  font-weight: var(--font-weight-semibold);
}
.card-heading span, .weekday {
  color: var(--text-muted);
  font-size: var(--font-size-smallest);
}
.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 4px 0;
  text-align: center;
}
.weekday, .calendar-day {
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 1;
}
.calendar-day {
  flex-direction: column;
  min-width: 0;
  min-height: 44px;
  padding: 0;
  border: 0;
  border-radius: var(--radius);
  background: transparent;
  color: var(--text-secondary);
  font-size: var(--font-size);
  cursor: pointer;
}
.calendar-day:hover, .calendar-day.is-selected {
  background: var(--bg-hover);
}
.desk-calendar .calendar-day:hover,
.desk-calendar .calendar-day.is-selected {
  background: transparent;
}
.desk-calendar .calendar-day:hover .day-number {
  border-radius: var(--radius-full);
  background: var(--bg-hover);
}
.desk-calendar .calendar-day.is-selected:not(.is-today) .day-number {
  border-radius: var(--radius-full);
  background: var(--accent-muted);
  color: var(--accent-primary);
  font-weight: var(--font-weight-semibold);
}
.desk-calendar .calendar-day.is-today:hover .day-number {
  background: var(--accent-muted);
}
.calendar-day.has-event .day-number {
  text-decoration: underline;
  text-decoration-color: var(--accent-primary);
  text-underline-offset: 3px;
}
.day-number {
  display: grid;
  width: 24px;
  height: 24px;
  place-items: center;
  line-height: 1;
}
.calendar-day.is-today {
  color: var(--text-primary);
  font-weight: var(--font-weight-semibold);
}
.calendar-day.is-today .day-number {
  position: relative;
  color: var(--text-secondary);
}
.today-mark {
  position: absolute;
  inset: -6px;
  width: calc(100% + 12px);
  height: calc(100% + 12px);
  fill: none;
  stroke: var(--accent-primary);
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2.7;
  pointer-events: none;
}
.today-mark-accent {
  opacity: 0.7;
  stroke-width: 1.9;
}
.month-actions, .schedule-heading, .schedule-item, .editor-actions {
  display: flex;
  align-items: center;
}
.schedule-heading {
  justify-content: space-between;
  margin-bottom: 10px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border-subtle);
}
.schedule-heading h2 {
  margin: 0;
  color: var(--text-primary);
  font-size: var(--font-size);
  font-weight: var(--font-weight-semibold);
}
.icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  padding: 0;
  border: 0;
  border-radius: var(--radius);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
}
.icon-button:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}
.schedule-empty, .schedule-error {
  margin: 0;
  color: var(--text-muted);
  font-size: var(--font-size-smaller);
}
.schedule-error { color: var(--tag-red); }
.schedule-list {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.schedule-item { gap: 6px; }
.schedule-item input { accent-color: var(--accent-primary); }
.schedule-item span {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
  color: var(--text-primary);
  font-size: var(--font-size-smaller);
}
.schedule-item span.completed {
  color: var(--text-muted);
  text-decoration: line-through;
}
.schedule-editor { margin-top: 12px; }
.schedule-editor input {
  box-sizing: border-box;
  width: 100%;
  padding: 8px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius);
  background: var(--bg-surface);
  color: var(--text-primary);
  font: inherit;
}
.editor-actions { justify-content: flex-end; gap: 8px; margin-top: 8px; }
.editor-actions button {
  padding: 5px 10px;
  border: 0;
  border-radius: var(--radius);
  background: var(--bg-hover);
  color: var(--text-primary);
  cursor: pointer;
}
.editor-actions button[type='submit'] {
  background: var(--accent-primary);
  color: var(--color-on-solid);
}
.saying {
  position: relative;
  overflow: hidden;
  padding: 0 0 0 14px;
  border-left: 2px solid var(--border-subtle);
}
.saying p {
  position: relative;
  margin: 8px 24px 0 0;
  color: var(--text-secondary);
  font-size: var(--font-size-larger);
  line-height: 1.7;
}
.saying p a {
  color: inherit;
  text-decoration: none;
}
.saying p a:hover {
  color: var(--accent-primary);
}
.saying-enter-enter-active,
.saying-enter-leave-active {
  transition: opacity 280ms ease, transform 280ms ease;
}
.saying-enter-enter-from,
.saying-enter-leave-to {
  opacity: 0;
  transform: translateY(4px);
}
@media (prefers-reduced-motion: reduce) {
  .saying-enter-enter-active,
  .saying-enter-leave-active {
    transition: none;
  }
}
.saying-source {
  display: block;
  margin-top: 8px;
  color: var(--text-muted);
  font-size: var(--font-size-smallest);
  line-height: 1.4;
  overflow-wrap: anywhere;
  text-align: right;
}
.saying-mark {
  position: absolute;
  right: 4px;
  bottom: 0;
  color: var(--accent-primary);
  font-size: 28px;
  opacity: 0.2;
}
</style>

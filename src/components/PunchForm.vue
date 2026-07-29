<script setup lang="ts">
import { ref } from 'vue'

import { PUNCH_LABELS } from '@/services/punchLabels'
import { toClock, toDateKey, toDateTime } from '@/services/time'
import { PUNCH_TYPES, type Punch, type PunchType } from '@/types/attendance'

/**
 * 打刻の追加と修正で共用するフォーム。
 *
 * 入力内容を親に渡すだけで、保存も検証結果の反映も行わない（events up、
 * CLAUDE.md 規約 2）。追加と修正で必要な入力項目が同じであるため、モードで
 * 分けずに 1 つのコンポーネントにしている。
 *
 * `punch` が `null` のときが追加、打刻が渡されたときが修正である。「対象が
 * 存在しない」ことを意図して表すため、ここは `undefined` ではなく `null` を使う
 * （docs/05 §4）。
 */
const props = defineProps<{
  /** 編集対象の打刻。追加のときは `null`。 */
  punch: Punch | null
  /** 対象の日付 "YYYY-MM-DD"。追加時の初期値になる。 */
  date: string
  /**
   * 日付も選ばせるかどうか。
   *
   * 日ごとのカードでは、どの日の打刻かがカード自体で決まっているため入力させない。
   * 月次集計から追加する場合は、記録が 1 件も無い日を選べる必要があるため入力させる。
   */
  editableDate: boolean
}>()

const emit = defineEmits<{
  (e: 'submit', type: PunchType, at: string): void
  (e: 'cancel'): void
}>()

// props から初期値を取るのは、このフォームが対象ごとに作り直される前提だから
// である。呼び出し側は `:key` に打刻の id を指定しており、対象が変われば
// コンポーネントごと再生成される。
const type = ref<PunchType>(props.punch?.type ?? 'clock-in')
const clock = ref(props.punch === null ? '' : toClock(props.punch.at))
const date = ref(props.punch === null ? props.date : toDateKey(props.punch.at))

/**
 * 入力内容を親へ渡す。
 *
 * 未入力のまま送信されることは `required` が防ぐため、ここでは形式の検証を
 * 行わない。実在しない日時でないかの最終的な確認はストアが行う。
 */
function submit(): void {
  emit('submit', type.value, toDateTime(date.value, clock.value))
}
</script>

<template>
  <form class="form" @submit.prevent="submit">
    <input v-if="editableDate" v-model="date" type="date" required aria-label="日付" class="date" />

    <select v-model="type" aria-label="打刻の種別">
      <option v-for="value in PUNCH_TYPES" :key="value" :value="value">
        {{ PUNCH_LABELS[value] }}
      </option>
    </select>

    <input v-model="clock" type="time" required aria-label="時刻" />

    <button type="submit" class="save">保存</button>
    <button type="button" class="cancel" @click="emit('cancel')">取消</button>
  </form>
</template>

<style scoped>
.form {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  padding: 0.5rem 0;
}
select,
input {
  padding: 0.35rem 0.5rem;
  border-radius: 0.4rem;
  border: 1px solid rgba(128, 128, 128, 0.4);
  font-size: 0.95rem;
  background: transparent;
  color: inherit;
}
button {
  padding: 0.35rem 0.75rem;
  border-radius: 0.4rem;
  border: 1px solid rgba(128, 128, 128, 0.4);
  background: transparent;
  color: inherit;
  cursor: pointer;
  font-size: 0.9rem;
}
button:hover,
button:focus-visible {
  background: rgba(128, 128, 128, 0.15);
}
.save {
  border-color: seagreen;
  color: seagreen;
}

/* 指で操作する端末ではタップ領域を広げる（PunchRow と同じ理由）。
   時刻の入力欄も同様に押しやすくしておく。 */
@media (pointer: coarse) {
  select,
  input,
  button {
    min-height: 44px;
    font-size: 1rem;
  }
  button {
    min-width: 44px;
    padding: 0.5rem 1rem;
  }
}
</style>

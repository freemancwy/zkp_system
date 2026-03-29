<template>
  <section class="panel">
    <div class="panel-header">
      <div>
        <p class="eyebrow">Activity Statistics</p>
        <h2>{{ stats.externalNullifier || "活动统计" }}</h2>
      </div>
      <span class="metric-chip">{{ stats.totalVoters ?? 0 }} 人参与</span>
    </div>

    <div class="stats-grid">
      <article class="stat-box">
        <span>总投票人数</span>
        <strong>{{ stats.totalVoters ?? 0 }}</strong>
      </article>
      <article class="stat-box support">
        <span>支持票</span>
        <strong>{{ stats.voteCounts?.support ?? 0 }}</strong>
      </article>
      <article class="stat-box against">
        <span>反对票</span>
        <strong>{{ stats.voteCounts?.against ?? 0 }}</strong>
      </article>
    </div>

    <div class="panel-subsection">
      <h3>最近投票记录</h3>
      <div v-if="stats.voters?.length" class="record-list">
        <article
          v-for="(voter, index) in stats.voters"
          :key="`${voter.nullifierHash}-${index}`"
          class="record-item"
        >
          <div>
            <p>{{ voter.vote === "1" ? "支持" : "反对" }}</p>
            <span>{{ formatDate(voter.votedAt) }}</span>
          </div>
          <code>{{ shorten(voter.nullifierHash) }}</code>
        </article>
      </div>
      <div v-else class="empty-state">该活动还没有投票记录。</div>
    </div>
  </section>
</template>

<script setup>
defineProps({
  stats: {
    type: Object,
    default: () => ({
      externalNullifier: "",
      totalVoters: 0,
      voteCounts: {
        support: 0,
        against: 0,
      },
      voters: [],
    }),
  },
})

function formatDate(value) {
  if (!value) {
    return "未知时间"
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString("zh-CN", { hour12: false })
}

function shorten(value = "") {
  if (value.length <= 16) {
    return value
  }

  return `${value.slice(0, 10)}...${value.slice(-8)}`
}
</script>

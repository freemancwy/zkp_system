<template>
  <section class="panel">
    <div class="panel-header">
      <div>
        <p class="eyebrow">活动详情</p>
        <h2>{{ stats.name || stats.externalNullifier || "活动统计" }}</h2>
      </div>
      <span class="metric-chip">{{ stats.totalVoters ?? 0 }} 人参与</span>
    </div>

    <p v-if="stats.externalNullifier" class="activity-meta">
      活动编号：<code>{{ stats.externalNullifier }}</code>
    </p>
    <p v-if="stats.descrption" class="panel-copy">{{ stats.descrption }}</p>

    <div class="stats-grid">
      <article class="stat-box">
        <span>总投票数</span>
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
      <p class="activity-meta">活动状态：{{ formatStatus(stats.status) }}</p>
      <p class="activity-meta">投票时间：{{ formatWindow(stats.startAt, stats.endAt) }}</p>
      <p class="activity-meta">人数上限：{{ stats.maxVoters ?? "不限制" }}</p>
      <p class="activity-meta">创建者/管理员：{{ stats.createdBy || "未填写" }}</p>
      <p class="activity-meta">发布时间：{{ formatDate(stats.createdAt) }}</p>
    </div>

    <div class="panel-subsection">
      <div class="panel-header compact">
        <div>
          <p class="eyebrow">投票记录</p>
          <h3>分页与筛选</h3>
        </div>
        <span class="activity-meta">
          第 {{ stats.pagination?.page ?? 1 }} / {{ stats.pagination?.totalPages ?? 1 }} 页
        </span>
      </div>

      <p class="activity-meta">
        当前筛选：
        {{ formatVoteFilter(stats.filters?.vote) }}
        ，共 {{ stats.pagination?.total ?? 0 }} 条记录
      </p>

      <div v-if="stats.voters?.length" class="record-list">
        <article
          v-for="(voter, index) in stats.voters"
          :key="`${voter.nullifierHash}-${index}`"
          class="record-item"
        >
          <div class="record-main">
            <p>{{ voter.vote === "1" ? "支持" : "反对" }}</p>
            <span>{{ formatDate(voter.votedAt) }}</span>
            <span v-if="voter.blockNumber">区块：#{{ voter.blockNumber }}</span>
          </div>

          <div class="record-side">
            <code>{{ shorten(voter.nullifierHash) }}</code>
            <a
              v-if="voter.txHash && voter.txUrl"
              :href="voter.txUrl"
              target="_blank"
              rel="noreferrer"
            >
              查看交易
            </a>
            <span v-else-if="voter.txHash">交易哈希：{{ shorten(voter.txHash) }}</span>
            <span v-else>未记录链上交易</span>
          </div>
        </article>
      </div>

      <div v-else class="empty-state">当前筛选条件下还没有投票记录。</div>
    </div>
  </section>
</template>

<script setup>
defineProps({
  stats: {
    type: Object,
    default: () => ({
      externalNullifier: "",
      name: "",
      descrption: "",
      totalVoters: 0,
      voteCounts: { support: 0, against: 0 },
      pagination: { page: 1, totalPages: 1, total: 0 },
      filters: { vote: "all" },
      voters: [],
    }),
  },
})

function formatDate(value) {
  if (!value) return "未知"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString("zh-CN", { hour12: false })
}

function formatWindow(startAt, endAt) {
  const start = startAt ? formatDate(startAt) : "未设置"
  const end = endAt ? formatDate(endAt) : "未设置"
  return `${start} 至 ${end}`
}

function formatStatus(status) {
  if (status === "upcoming") return "未开始"
  if (status === "closed") return "已结束"
  if (status === "active") return "进行中"
  return "未知"
}

function formatVoteFilter(value) {
  if (value === "1") return "仅支持票"
  if (value === "0") return "仅反对票"
  return "全部记录"
}

function shorten(value = "") {
  if (value.length <= 18) return value
  return `${value.slice(0, 10)}...${value.slice(-8)}`
}
</script>

<template>
  <section class="panel">
    <div class="panel-header">
      <div>
        <p class="eyebrow">{{ eyebrow }}</p>
        <h2>{{ title }}</h2>
      </div>
      <span class="metric-chip">{{ activities.length }} 个活动</span>
    </div>

    <p v-if="description" class="panel-copy">{{ description }}</p>

    <div v-if="activities.length" class="activity-list">
      <article
        v-for="activity in activities"
        :key="activity.externalNullifier"
        class="activity-card"
      >
        <div>
          <div class="title-row">
            <p class="activity-name">{{ activity.name || activity.externalNullifier }}</p>
            <span class="status-chip" :data-status="activity.status || deriveStatus(activity)">
              {{ formatStatus(activity.status || deriveStatus(activity)) }}
            </span>
          </div>

          <p class="activity-meta">
            活动编号：<code>{{ activity.externalNullifier }}</code>
          </p>
          <p v-if="activity.descrption" class="panel-copy">{{ activity.descrption }}</p>
          <p class="activity-meta">投票时间：{{ formatWindow(activity.startAt, activity.endAt) }}</p>
          <p class="activity-meta">
            人数限制：
            {{ activity.maxVoters ?? "不限制" }}
            <span v-if="activity.currentVoters !== undefined">
              ，当前 {{ activity.currentVoters }} 人
            </span>
            <span v-if="activity.remainingVoters != null">
              ，剩余 {{ activity.remainingVoters }} 人
            </span>
          </p>
          <p v-if="activity.createdBy" class="activity-meta">
            创建者/管理员：{{ activity.createdBy }}
          </p>
          <p v-if="showCreatedAt" class="activity-meta">
            发布时间：{{ formatDate(activity.createdAt) }}
          </p>
        </div>

        <div class="activity-actions">
          <router-link
            class="ghost-button"
            :to="`/activity/${encodeURIComponent(activity.externalNullifier)}`"
          >
            查看详情
          </router-link>
          <router-link
            class="primary-button subtle"
            :to="`/vote?activity=${encodeURIComponent(activity.externalNullifier)}`"
          >
            去投票
          </router-link>
        </div>
      </article>
    </div>

    <div v-else class="empty-state">{{ emptyText }}</div>
  </section>
</template>

<script setup>
defineProps({
  title: { type: String, default: "活动列表" },
  eyebrow: { type: String, default: "已发布活动" },
  description: { type: String, default: "" },
  activities: { type: Array, default: () => [] },
  emptyText: { type: String, default: "当前还没有已发布的活动。" },
  showCreatedAt: { type: Boolean, default: true },
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

function deriveStatus(activity) {
  const now = Date.now()
  const start = activity.startAt ? Date.parse(activity.startAt) : null
  const end = activity.endAt ? Date.parse(activity.endAt) : null

  if (start && now < start) return "upcoming"
  if (end && now > end) return "closed"
  return "active"
}

function formatStatus(status) {
  if (status === "upcoming") return "未开始"
  if (status === "closed") return "已结束"
  if (status === "active") return "进行中"
  return "未知"
}
</script>

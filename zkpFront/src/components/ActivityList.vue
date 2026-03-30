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
          <p class="activity-name">{{ activity.name || activity.externalNullifier }}</p>
          <p class="activity-meta">
            <code>{{ activity.externalNullifier }}</code>
          </p>
          <p v-if="activity.descrption" class="panel-copy">{{ activity.descrption }}</p>
          <p v-if="showCreatedAt" class="activity-meta">
            发布时间：{{ formatDate(activity.createdAt) }}
          </p>
        </div>

        <div class="activity-actions">
          <router-link
            class="ghost-button"
            :to="`/activity/${encodeURIComponent(activity.externalNullifier)}`"
          >
            查看统计
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

    <div v-else class="empty-state">
      {{ emptyText }}
    </div>
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
  if (!value) {
    return "未知"
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString("zh-CN", { hour12: false })
}
</script>

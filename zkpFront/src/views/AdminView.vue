<template>
  <div class="page-stack">
    <section class="section-heading">
      <div>
        <p class="eyebrow">Admin Flow</p>
        <h2>发布投票活动并查看系统中的所有活动</h2>
      </div>
      <p class="section-note">演示环境，无鉴权。请仅在本地开发链或本地服务环境中使用。</p>
    </section>

    <div class="two-column admin-layout">
      <PublishActivityForm
        :publish-status="voting.state.publishStatus"
        :message="voting.state.publishMessage"
        @publish="handlePublish"
      />

      <ActivityList
        title="活动管理"
        eyebrow="Activity Registry"
        description="发布后的活动会立刻出现在用户投票页，并可进入统计页面。"
        :activities="voting.state.activities"
        empty-text="当前还没有活动，请先发布一个。"
      />
    </div>
  </div>
</template>

<script setup>
import { onMounted } from "vue"
import ActivityList from "../components/ActivityList.vue"
import PublishActivityForm from "../components/PublishActivityForm.vue"
import { useVoting } from "../composables/useVoting"

const voting = useVoting()

onMounted(() => {
  voting.loadDashboard().catch(() => {})
})

function handlePublish(value) {
  if (!value) {
    voting.setPublishError("请输入活动标识后再发布。")
    return
  }

  voting.publishNewActivity(value).catch(() => {})
}
</script>

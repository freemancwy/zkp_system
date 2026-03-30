<template>
  <div class="page-stack">
    <section class="section-heading">
      <div>
        <p class="eyebrow">管理员流程</p>
        <h2>发布并管理投票活动</h2>
      </div>
      <p class="section-note">
        当前本地演示环境默认开放管理员页面，并以活动元数据文件作为展示来源。
      </p>
    </section>

    <div class="two-column admin-layout">
      <PublishActivityForm
        :publish-status="voting.state.publishStatus"
        :message="voting.state.publishMessage"
        @publish="handlePublish"
      />

      <ActivityList
        title="活动注册表"
        eyebrow="已发布活动"
        description="活动发布后会立即出现在投票页面中。"
        :activities="voting.state.activities"
        empty-text="当前还没有已发布的活动。"
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

function handlePublish(activity) {
  if (!activity?.externalNullifier) {
    voting.setPublishError("请先输入 externalNullifier 再发布活动。")
    return
  }

  voting.publishNewActivity(activity).catch(() => {})
}
</script>

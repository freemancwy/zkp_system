<template>
  <div class="page-stack">
    <section class="section-heading">
      <div>
        <p class="eyebrow">管理员流程</p>
        <h2>发布并管理投票活动</h2>
      </div>
      <p class="section-note">
        在这里可以维护活动元数据、投票时间、人数上限和创建者信息，并同步观察链上合约状态。
      </p>
    </section>

    <div class="two-column admin-layout">
      <PublishActivityForm
        :publish-status="voting.state.publishStatus"
        :message="voting.state.publishMessage"
        @publish="handlePublish"
      />

      <ChainStatusCard :chain="voting.state.chainInfo" />
    </div>

    <ActivityList
      title="活动注册表"
      eyebrow="已发布活动"
      description="活动发布后会立即出现在投票页中，并按照时间窗口显示状态和剩余名额。"
      :activities="voting.state.activities"
      empty-text="当前还没有已发布的活动。"
    />
  </div>
</template>

<script setup>
import { onMounted } from "vue"
import ActivityList from "../components/ActivityList.vue"
import ChainStatusCard from "../components/ChainStatusCard.vue"
import PublishActivityForm from "../components/PublishActivityForm.vue"
import { useVoting } from "../composables/useVoting"

const voting = useVoting()

onMounted(() => {
  voting.loadDashboard().catch(() => {})
})

function handlePublish(activity) {
  if (!activity?.externalNullifier) {
    voting.setPublishError("请先输入活动编号后再发布。")
    return
  }

  voting.publishNewActivity(activity).catch(() => {})
}
</script>

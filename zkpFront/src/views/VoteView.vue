<template>
  <div class="page-stack">
    <section class="section-heading">
      <div>
        <p class="eyebrow">用户流程</p>
        <h2>注册、恢复身份并参与匿名投票</h2>
      </div>
      <p class="section-note">
        当前浏览器中保存的匿名身份是本次演示的重要依据，请不要随意清除。
      </p>
    </section>

    <div class="two-column">
      <RegisterCard
        :identity="voting.state.localIdentity"
        :register-status="voting.state.registerStatus"
        :message="voting.state.registerMessage"
        @register="handleRegister"
        @restore="handleRestore"
        @clear-identity="voting.clearIdentity()"
      />

      <VoteForm
        :activities="voting.state.activities"
        :has-identity="voting.hasIdentity.value"
        :vote-status="voting.state.voteStatus"
        :message="voting.state.voteMessage"
        :result="voting.state.lastVoteResult"
        :initial-activity="initialActivity"
        @submit="handleVote"
      />
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted } from "vue"
import { useRoute } from "vue-router"
import RegisterCard from "../components/RegisterCard.vue"
import VoteForm from "../components/VoteForm.vue"
import { useVoting } from "../composables/useVoting"

const route = useRoute()
const voting = useVoting()

const initialActivity = computed(() =>
  typeof route.query.activity === "string" ? route.query.activity : ""
)

onMounted(() => {
  voting.loadDashboard().catch(() => {})
})

function handleRegister(phone) {
  if (!phone) {
    voting.setRegisterError("请输入手机号后再注册。")
    return
  }

  voting.registerWithPhone(phone).catch(() => {})
}

function handleRestore(phone) {
  voting.restoreIdentityFromStorage(phone)
}

function handleVote(payload) {
  voting.submitVote(payload).catch(() => {})
}
</script>

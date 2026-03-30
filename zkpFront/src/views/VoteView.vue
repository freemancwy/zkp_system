<template>
  <div class="page-stack">
    <section class="section-heading">
      <div>
        <p class="eyebrow">用户流程</p>
        <h2>注册、恢复身份并参与匿名投票</h2>
      </div>
      <p class="section-note">
        你可以选择由后端代发链上交易，也可以连接钱包后由前端直接向合约发起交易。
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
        :chain-info="voting.state.chainInfo"
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
import { useWallet } from "../composables/useWallet"

const route = useRoute()
const voting = useVoting()
const wallet = useWallet()

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

async function handleVote(payload) {
  if (payload.submitMode === "wallet") {
    try {
      if (!wallet.walletState.connected) {
        await wallet.connectWallet()
      }

      const prepared = await voting.prepareVoteWithClientWallet(payload)
      const onChain = await wallet.submitVoteWithWallet(prepared.contractArgs)
      await voting.confirmClientVote({ ...prepared, onChain })
    } catch (error) {
      voting.state.voteStatus = "error"
      voting.state.voteMessage = error.message || "钱包投票失败"
    }
    return
  }

  voting.submitVote(payload).catch(() => {})
}
</script>

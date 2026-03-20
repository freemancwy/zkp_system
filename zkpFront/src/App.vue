<template>
  <form @submit.prevent="handleSubmit">
    <h2>基于零知识证明的匿名投票</h2>

    <div>
      <label>身份私钥 (identityNullifier):</label>
      <input v-model="form.identityNullifier" />
    </div>

    <div>
      <label>投票活动ID (externalNullifier):</label>
      <input v-model="form.externalNullifier" />
    </div>

    <div>
      <label>投票选项:</label>
      <select v-model="form.vote">
        <option value="1">支持</option>
        <option value="0">反对</option>
      </select>
    </div>

    <button type="submit">提交投票</button>
  </form>
</template>

<script setup>
import { reactive, onMounted } from "vue"

// ================= 用户输入 =================
const form = reactive({
  identityNullifier: "",
  externalNullifier: "",
  vote: "1",
})

// ================= 后端返回的 root =================
let ROOT = ""

// ================= 电路输入 =================
const circuitInputs = reactive({
  identityNullifier: "",
  externalNullifier: "",
  vote: "",
  identityTrapdoor: "",
  root: "",
  treePathElements: [],
  treePathIndices: [],
})

// ================= 初始化 =================
onMounted(async () => {
  // 1️⃣ 获取 Merkle Root
  const rootRes = await fetch("http://localhost:3000/api/root")
  const rootData = await rootRes.json()
  ROOT = rootData.root

  console.log("✅ Root:", ROOT)
})

// ================= 提交 =================
const handleSubmit = async () => {
  try {
    // 1️⃣ 先获取 Merkle Proof（关键）
    const proofRes = await fetch("http://localhost:3000/api/merkle-proof", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        identityNullifier: form.identityNullifier
      })
    })

    const proofData = await proofRes.json()

    console.log("✅ Merkle Proof:", proofData)

    // 2️⃣ 构建电路输入
    circuitInputs.identityNullifier = form.identityNullifier
    circuitInputs.externalNullifier = form.externalNullifier
    circuitInputs.vote = form.vote

    //实际系统中需要进行安全的随机生成，这里为了演示从buildTree.js直接进行复制
    // circuitInputs.identityTrapdoor = Math.floor(
    //   Math.random() * 1e18
    // ).toString()
    circuitInputs.identityTrapdoor = "58315762554510183383427370759804617789238057472588115169775310276220776659880" // 固定值，实际使用时请替换为安全生成的随机数

    circuitInputs.root = ROOT

    circuitInputs.treePathElements = proofData.pathElements
    circuitInputs.treePathIndices = proofData.pathIndices
    
    console.log("✅ 电路输入:", circuitInputs)

    // 3️⃣ 提交投票（生成 ZKP）
    const voteRes = await fetch("http://localhost:3000/api/vote", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(circuitInputs)
    })

    const result = await voteRes.json()

    console.log("✅ 投票成功:", result)
    alert("投票成功！")

  } catch (err) {
    console.error("❌ 错误:", err)
    alert("投票失败")
  }
}
</script>

<style scoped>
form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 500px;
}

input, select {
  padding: 8px;
}
</style>
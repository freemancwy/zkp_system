const express = require("express")
const cors = require("cors")
const fs = require("fs")

const app = express()

app.use(cors())
app.use(express.json())

// ================== 加载数据 ==================
const ROOT = JSON.parse(fs.readFileSync("./merkle-root.json")).root
const TREE = JSON.parse(fs.readFileSync("./tree-layers.json"))
const userDatabase = JSON.parse(fs.readFileSync("./user-database.json"))

// ================== 工具函数 ==================

// 查找 leaf 在树中的位置
function findLeafIndex(commitment) {
  return TREE[0].indexOf(commitment)
}

// 构建 Merkle proof
function generateMerkleProof(leafIndex) {
  const pathElements = []
  const pathIndices = []

  let index = leafIndex

  for (let level = 0; level < TREE.length - 1; level++) {
    const layer = TREE[level]

    const isRight = index % 2
    const siblingIndex = isRight ? index - 1 : index + 1

    const sibling = layer[siblingIndex] || "0"

    pathElements.push(sibling)
    pathIndices.push(isRight)

    index = Math.floor(index / 2)
  }

  return {
    pathElements,
    pathIndices,
  }
}

// ================== 接口 ==================

// 1️⃣ 获取 root
app.get("/api/root", (req, res) => {
  res.json({ root: ROOT })
})

// 2️⃣ 获取 Merkle Proof
app.post("/api/merkle-proof", (req, res) => {
  const { identityNullifier } = req.body

  // 1️⃣ 从数据库查 commitment
  const user = userDatabase[identityNullifier]

  if (!user) {
    return res.status(400).json({
      error: "identity not registered",
    })
  }

  const commitment = user.identityCommitment

  // 2️⃣ 查 Merkle Tree
  const index = findLeafIndex(commitment)

  if (index === -1) {
    return res.status(400).json({
      error: "commitment not in merkle tree",
    })
  }

  // 3️⃣ 生成 proof
  const proof = generateMerkleProof(index)

  res.json(proof)
})

// 3️⃣ 投票接口（后续接 snarkjs）
app.post("/api/vote", (req, res) => {
  const input = req.body

  console.log("\n📩 收到投票请求：")
  console.log(input)

  // ================== 这里是占位逻辑 ==================
  // 后续你可以接 snarkjs.generateProof()

  res.json({
    success: true,
    message: "投票已接收（当前为mock，未上链验证）",
    publicSignals: [
      input.root,
      input.nullifierHash,
      input.vote,
    ],
  })
})

// ================== 启动服务器 ==================
const PORT = 3000

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`)
})
const express = require("express")
const cors = require("cors")
const fs = require("fs")
const path = require("path")
const snarkjs = require("snarkjs")
const { buildPoseidon } = require("circomlibjs")

const app = express()

app.use(cors())
app.use(express.json())

// ================== 加载数据 ==================
const DATA_DIR = path.join(__dirname, "data")
const VOTES_FILE = path.join(DATA_DIR, "votes.json")

const TreeMeta = JSON.parse(
  fs.readFileSync(path.join(DATA_DIR, "tree_meta.json"))
)

const LeavesData = JSON.parse(
  fs.readFileSync(path.join(DATA_DIR, "leaves.json"))
)

const LEAVES = LeavesData.leaves.map((x) => BigInt(x))

// Poseidon 初始化（全局复用）
let poseidon, F

;(async () => {
  poseidon = await buildPoseidon()
  F = poseidon.F
})()

// ================== 工具函数 ==================

// 查找 commitment index
function findLeafIndex(commitment) {
  return LEAVES.findIndex((x) => x.toString() === commitment)
}

// 动态构建 Merkle proof（与你脚本一致）
function generateMerkleProof(leafIndex) {
  const pathElements = []
  const pathIndices = []

  let current = [...LEAVES]
  let index = leafIndex

  while (current.length > 1) {
    const isRight = index % 2
    const pairIndex = isRight ? index - 1 : index + 1

    const sibling =
      pairIndex < current.length
        ? current[pairIndex]
        : current[index]

    pathElements.push(sibling.toString())
    pathIndices.push(isRight)

    // 构建下一层
    const next = []

    for (let i = 0; i < current.length; i += 2) {
      const left = current[i]
      const right = current[i + 1] ?? current[i]

      const h = poseidon([left, right])
      next.push(F.toObject(h))
    }

    current = next
    index = Math.floor(index / 2)
  }

  return {
    pathElements,
    pathIndices,
  }
}

function loadVotes() {
  if (!fs.existsSync(VOTES_FILE)) {
    return { votes: [] }
  }

  const raw = fs.readFileSync(VOTES_FILE, "utf8")

  if (!raw.trim()) {
    return { votes: [] }
  }

  const data = JSON.parse(raw)

  if (!Array.isArray(data.votes)) {
    return { votes: [] }
  }

  return data
}

function saveVotes(data) {
  fs.writeFileSync(
    VOTES_FILE,
    JSON.stringify(data, null, 2) + "\n",
    "utf8"
  )
}

let voteWriteQueue = Promise.resolve()

function persistVoteRecord(record) {
  voteWriteQueue = voteWriteQueue.then(() => {
    const votesData = loadVotes()
    const duplicate = votesData.votes.find(
      (item) =>
        item.externalNullifier === record.externalNullifier &&
        item.nullifierHash === record.nullifierHash
    )

    if (duplicate) {
      const error = new Error("该用户已在当前活动中投过票")
      error.code = "DUPLICATE_VOTE"
      throw error
    }

    votesData.votes.push(record)
    saveVotes(votesData)
  })

  return voteWriteQueue.catch((error) => {
    voteWriteQueue = Promise.resolve()
    throw error
  })
}

// ================== 接口 ==================

// 1️⃣ 获取 root
app.get("/api/root", (req, res) => {
  res.json({ root: TreeMeta.root })
})

// 2️⃣ 获取 Merkle Proof（不再依赖 userDatabase）
app.post("/api/merkle-proof", (req, res) => {
  const { identityCommitment } = req.body

  if (!identityCommitment) {
    return res.status(400).json({ error: "缺少 identityCommitment" })
  }

  const index = findLeafIndex(identityCommitment)

  if (index === -1) {
    return res.status(400).json({
      error: "commitment 不在 Merkle Tree 中",
    })
  }

  const proof = generateMerkleProof(index)

  res.json({
    index,
    ...proof,
  })
})

// 3️⃣ 投票（ZK Proof）
app.post("/api/vote", async (req, res) => {
  try {
    const input = req.body

    const requiredFields = [
      "identityNullifier",
      "identityTrapdoor",
      "treePathElements",
      "treePathIndices",
      "root",
      "externalNullifier",
      "vote",
    ]

    for (const key of requiredFields) {
      if (input[key] === undefined) {
        return res.status(400).json({
          success: false,
          error: `缺失字段: ${key}`,
        })
      }
    }

    // 校验深度
    if (input.treePathElements.length !== TreeMeta.depth) {
      return res.status(400).json({
        error: `pathElements 长度必须为 ${TreeMeta.depth}`,
      })
    }

    if (input.treePathIndices.length !== TreeMeta.depth) {
      return res.status(400).json({
        error: `pathIndices 长度必须为 ${TreeMeta.depth}`,
      })
    }

    const normalizedInput = {
      identityNullifier: String(input.identityNullifier),
      identityTrapdoor: String(input.identityTrapdoor),
      treePathElements: input.treePathElements.map(String),
      treePathIndices: input.treePathIndices.map(String),
      root: String(input.root),
      externalNullifier: String(input.externalNullifier),
      vote: String(input.vote),
    }

    const wasmPath = path.join(__dirname, "../build/circuit_js/circuit.wasm")
    const zkeyPath = path.join(__dirname, "../zkey/circuit_final.zkey")

    console.log("\n📩 生成 ZK proof...")

    const { proof, publicSignals } =
      await snarkjs.groth16.fullProve(
        normalizedInput,
        wasmPath,
        zkeyPath
      )

    const nullifierHash = publicSignals[0]
    const signalHash = publicSignals[1]
    const voteRecord = {
      externalNullifier: normalizedInput.externalNullifier,
      nullifierHash,
      signalHash,
      vote: normalizedInput.vote,
      root: normalizedInput.root,
      createdAt: new Date().toISOString(),
      proof,
      publicSignals,
    }

    await persistVoteRecord(voteRecord)

    res.json({
      success: true,
      proof,
      publicSignals,
      nullifierHash,
      signalHash,
      externalNullifier: normalizedInput.externalNullifier,
      alreadyVoted: false,
    })
  } catch (err) {
    if (err.code === "DUPLICATE_VOTE") {
      return res.status(409).json({
        success: false,
        error: err.message,
        alreadyVoted: true,
        externalNullifier: String(req.body.externalNullifier),
      })
    }

    console.error("❌ proof 生成失败:", err)

    res.status(500).json({
      success: false,
      error: err.message,
    })
  }
})

// ================== 启动 ==================
const PORT = 3000

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`)
})
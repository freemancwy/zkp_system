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

function ensureVotesFile() {
  if (!fs.existsSync(VOTES_FILE)) {
    fs.writeFileSync(
      VOTES_FILE,
      JSON.stringify({ votes: [] }, null, 2)
    )
  }
}

function readVotes() {
  ensureVotesFile()

  try {
    const data = JSON.parse(fs.readFileSync(VOTES_FILE, "utf8"))
    return Array.isArray(data.votes) ? data.votes : []
  } catch (err) {
    console.error("❌ 读取 votes.json 失败:", err)
    return []
  }
}

function appendVoteRecord(record) {
  ensureVotesFile()

  const payload = JSON.parse(fs.readFileSync(VOTES_FILE, "utf8"))
  const votes = Array.isArray(payload.votes) ? payload.votes : []
  votes.push(record)

  fs.writeFileSync(
    VOTES_FILE,
    JSON.stringify({ ...payload, votes }, null, 2)
  )
}

function buildVoteStats(externalNullifier, votes) {
  const scopedVotes = externalNullifier === undefined
    ? votes
    : votes.filter(
        (item) => String(item.externalNullifier) === String(externalNullifier)
      )

  const voteBreakdown = {}
  const nullifierSet = new Set()

  for (const record of scopedVotes) {
    if (record.nullifierHash !== undefined && record.nullifierHash !== null) {
      nullifierSet.add(String(record.nullifierHash))
    }

    const voteKey = String(record.vote)
    voteBreakdown[voteKey] = (voteBreakdown[voteKey] || 0) + 1
  }

  const latestVote = scopedVotes.reduce((latest, current) => {
    if (!latest) {
      return current
    }

    const latestTime = latest.createdAt || latest.lastVoteAt || ""
    const currentTime = current.createdAt || current.lastVoteAt || ""

    return currentTime >= latestTime ? current : latest
  }, null)

  return {
    externalNullifier: String(externalNullifier),
    totalVotes: scopedVotes.length,
    uniqueNullifierCount: nullifierSet.size,
    voteBreakdown,
    latestRoot: latestVote?.root || null,
    lastVoteAt:
      latestVote?.createdAt || latestVote?.lastVoteAt || null,
  }
}

function buildAllActivityStats(votes) {
  const grouped = votes.reduce((acc, record) => {
    const key = String(record.externalNullifier)
    if (!acc[key]) {
      acc[key] = []
    }
    acc[key].push(record)
    return acc
  }, {})

  return Object.entries(grouped)
    .map(([externalNullifier, records]) =>
      buildVoteStats(externalNullifier, records)
    )
    .sort((a, b) => {
      const aTime = a.lastVoteAt || ""
      const bTime = b.lastVoteAt || ""
      return bTime.localeCompare(aTime)
    })
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

app.get("/api/activity/:externalNullifier/stats", (req, res) => {
  const votes = readVotes()
  const stats = buildVoteStats(
    req.params.externalNullifier,
    votes
  )

  res.json(stats)
})

app.get("/api/activity-stats", (req, res) => {
  const votes = readVotes()
  res.json(buildAllActivityStats(votes))
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
    const createdAt = new Date().toISOString()

    appendVoteRecord({
      externalNullifier: normalizedInput.externalNullifier,
      vote: normalizedInput.vote,
      root: normalizedInput.root,
      nullifierHash,
      signalHash,
      createdAt,
    })

    res.json({
      success: true,
      proof,
      publicSignals: [
        normalizedInput.root,
        nullifierHash,
        signalHash,
      ],
      nullifierHash,
      signalHash,
      createdAt,
    })
  } catch (err) {
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

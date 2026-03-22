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

const TreeMeta = JSON.parse(
  fs.readFileSync(path.join(DATA_DIR, "tree_meta.json"))
)

const LeavesData = JSON.parse(
  fs.readFileSync(path.join(DATA_DIR, "leaves.json"))
)

const LEAVES = LeavesData.leaves.map((x) => BigInt(x))

// Poseidon 初始化（全局复用）
let poseidon, F

async function init() {
  poseidon = await buildPoseidon()
  F = poseidon.F

  app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`)
  })
}

// ================== 工具函数 ==================

// 查找 commitment index
function findLeafIndex(commitment) {
  return LEAVES.findIndex((x) => x.toString() === commitment)
}

// 动态构建 Merkle proof（与你脚本一致）
function generateMerkleProof(leafIndex) {
  if (!poseidon || !F) {
    throw new Error("Poseidon 尚未初始化完成")
  }

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

init().catch((err) => {
  console.error("❌ Poseidon 初始化失败:", err)
  process.exit(1)
})

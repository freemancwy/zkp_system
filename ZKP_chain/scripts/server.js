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

// Poseidon 初始化（全局复用）
let poseidon, F

;(async () => {
  poseidon = await buildPoseidon()
  F = poseidon.F
})()

// ================== 工具函数 ==================

function readJson(fileName) {
  return JSON.parse(
    fs.readFileSync(path.join(DATA_DIR, fileName), "utf8")
  )
}

function writeJson(fileName, data) {
  fs.writeFileSync(
    path.join(DATA_DIR, fileName),
    JSON.stringify(data, null, 2)
  )
}

function loadTreeMeta() {
  return readJson("tree_meta.json")
}

function loadLeaves() {
  const leavesData = readJson("leaves.json")

  return {
    ...leavesData,
    leaves: (leavesData.leaves || []).map((x) => String(x)),
  }
}

function buildMerkleTree(leaves, depth) {
  let current = leaves.map((leaf) => BigInt(leaf))
  const layers = [current]

  for (let level = 0; level < depth; level++) {
    const next = []

    for (let i = 0; i < current.length; i += 2) {
      const left = current[i]
      const right = current[i + 1] ?? current[i]
      const hashed = poseidon([left, right])

      next.push(BigInt(F.toString(hashed)))
    }

    current = next
    layers.push(current)
  }

  return layers
}

function calculateRoot(leaves, depth) {
  const layers = buildMerkleTree(leaves, depth)
  const rootLayer = layers[depth] || []
  const root = rootLayer[0]

  return root ? root.toString() : "0"
}

// 查找 commitment index
function findLeafIndex(leaves, commitment) {
  return leaves.findIndex((x) => x === commitment)
}

// 动态构建 Merkle proof（与你脚本一致）
function generateMerkleProof(leaves, depth, leafIndex) {
  const pathElements = []
  const pathIndices = []

  let current = leaves.map((x) => BigInt(x))
  let index = leafIndex

  for (let level = 0; level < depth; level++) {
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
  const treeMeta = loadTreeMeta()

  res.json({ root: treeMeta.root })
})

// 2️⃣ 获取 Merkle Proof（不再依赖 userDatabase）
app.post("/api/merkle-proof", (req, res) => {
  const { identityCommitment } = req.body

  if (!identityCommitment) {
    return res.status(400).json({ error: "缺少 identityCommitment" })
  }

  const normalizedCommitment = String(identityCommitment)
  const treeMeta = loadTreeMeta()
  const { leaves } = loadLeaves()
  const index = findLeafIndex(leaves, normalizedCommitment)

  if (index === -1) {
    return res.status(400).json({
      error: "commitment 不在 Merkle Tree 中",
    })
  }

  const proof = generateMerkleProof(leaves, treeMeta.depth, index)

  res.json({
    index,
    ...proof,
  })
})

let writeQueue = Promise.resolve()

function enqueueWrite(task) {
  const run = writeQueue.then(task)
  writeQueue = run.catch(() => {})
  return run
}

app.post("/api/register", async (req, res) => {
  try {
    if (!poseidon || !F) {
      return res.status(503).json({
        success: false,
        error: "Poseidon 初始化中，请稍后重试",
      })
    }

    const {
      identityCommitment,
      username,
      activityId,
    } = req.body || {}

    if (identityCommitment === undefined || identityCommitment === null) {
      return res.status(400).json({
        success: false,
        error: "缺少 identityCommitment",
      })
    }

    if (
      username !== undefined &&
      username !== null &&
      typeof username !== "string"
    ) {
      return res.status(400).json({
        success: false,
        error: "username 必须为字符串",
      })
    }

    if (
      activityId !== undefined &&
      activityId !== null &&
      typeof activityId !== "string" &&
      typeof activityId !== "number"
    ) {
      return res.status(400).json({
        success: false,
        error: "activityId 必须为字符串或数字",
      })
    }

    const normalizedCommitment = String(identityCommitment)

    const result = await enqueueWrite(async () => {
      const treeMeta = loadTreeMeta()
      const leavesData = loadLeaves()
      const leaves = [...leavesData.leaves]

      if (findLeafIndex(leaves, normalizedCommitment) !== -1) {
        const error = new Error("该 identityCommitment 已注册")
        error.status = 409
        throw error
      }

      leaves.push(normalizedCommitment)

      const nextRoot = calculateRoot(leaves, treeMeta.depth)
      const nextTreeMeta = {
        ...treeMeta,
        root: nextRoot,
        leafCount: leaves.length,
      }

      writeJson("leaves.json", {
        ...leavesData,
        leaves,
      })
      writeJson("tree_meta.json", nextTreeMeta)

      return {
        success: true,
        identityCommitment: normalizedCommitment,
        index: leaves.length - 1,
        leafCount: leaves.length,
        root: nextRoot,
      }
    })

    res.json(result)
  } catch (error) {
    const status = error.status || 500

    res.status(status).json({
      success: false,
      error: error.message,
    })
  }
})

// 3️⃣ 投票（ZK Proof）
app.post("/api/vote", async (req, res) => {
  try {
    const input = req.body
    const treeMeta = loadTreeMeta()

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
    if (input.treePathElements.length !== treeMeta.depth) {
      return res.status(400).json({
        error: `pathElements 长度必须为 ${treeMeta.depth}`,
      })
    }

    if (input.treePathIndices.length !== treeMeta.depth) {
      return res.status(400).json({
        error: `pathIndices 长度必须为 ${treeMeta.depth}`,
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

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`)
})

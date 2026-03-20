const fs = require("fs");
const crypto = require("crypto");

// ================== 工具函数 ==================

// 生成 256-bit 随机 BigInt
function random256BitBigInt() {
  const buf = crypto.randomBytes(32);
  let res = 0n;
  for (let i = 0; i < 32; i++) {
    res = (res << 8n) + BigInt(buf[i]);
  }
  return res;
}

// Poseidon 哈希（统一输出字符串）
function poseidonHash(poseidon, inputs) {
  const hash = poseidon(inputs);
  return poseidon.F.toString(hash); // ✅ 关键修复
}

// ================== 主逻辑 ==================

async function buildTree() {
  const circomlibjs = await import("circomlibjs");
  const poseidon = await circomlibjs.buildPoseidonOpt();

  // ================== 配置 ==================
  const TREE_DEPTH = 20;
  const MAX_LEAVES = 2 ** TREE_DEPTH;
  const USER_COUNT = 1000000;

  console.log("\n🚀 开始生成用户身份...\n");

  const leaves = [];
  const userDatabase = {};

  // ================== 生成叶子 ==================
  for (let i = 0; i < USER_COUNT; i++) {
    try {
      const identityNullifier = random256BitBigInt().toString();
      const identityTrapdoor = random256BitBigInt().toString();

      const commitment = poseidonHash(poseidon, [
        BigInt(identityNullifier),
        BigInt(identityTrapdoor),
      ]);

      leaves.push(commitment);

      userDatabase[identityNullifier] = {
        identityTrapdoor,
        identityCommitment: commitment,
      };

      if (i % 100000 === 0) {
        console.log(`已生成 ${i} 个用户...`);
      }
    } catch (e) {
      console.error("重试用户", i);
      i--;
    }
  }

  // ================== 补齐叶子 ==================
  while (leaves.length < MAX_LEAVES) {
    leaves.push("0");
  }

  // ================== 构建 Merkle Tree ==================
  console.log("\n🌳 构建 Merkle Tree...\n");

  let layers = [leaves];

  for (let level = 0; level < TREE_DEPTH; level++) {
    const curr = layers[level];
    const next = [];

    for (let i = 0; i < curr.length; i += 2) {
      const left = BigInt(curr[i]);
      const right = BigInt(curr[i + 1]);

      const hash = poseidonHash(poseidon, [left, right]);
      next.push(hash);
    }

    layers.push(next);
    console.log(`✅ 完成第 ${level + 1} 层`);
  }

  const root = layers[TREE_DEPTH][0];

  console.log("\n🎯 Merkle Root:\n", root);

  // ================== 保存文件 ==================
  console.log("\n💾 写入文件...");

  fs.writeFileSync(
    "merkle-root.json",
    JSON.stringify({ root }, null, 2)
  );

  fs.writeFileSync(
    "user-database.json",
    JSON.stringify(userDatabase, null, 2)
  );

  fs.writeFileSync(
    "tree-layers.json",
    JSON.stringify(layers, null, 2)
  );

  console.log("\n✅ 构建完成！");
}

buildTree().catch(console.error);
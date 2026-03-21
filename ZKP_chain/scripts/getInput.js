const fs = require("fs");
const crypto = require("crypto");
const circomlib = require("circomlibjs");

// ================= 参数 =================
const TREE_LEVELS = 20;
const LEAF_COUNT = 8; // 测试用，实际可以更大

// ================= 工具函数 =================
function randomBigInt() {
    return BigInt("0x" + crypto.randomBytes(31).toString("hex"));
}

// ================= 主逻辑 =================
(async () => {
    const poseidon = await circomlib.buildPoseidon();
    const F = poseidon.F;

    const hash = (inputs) => F.toString(poseidon(inputs));

    // ===== 1. 生成身份 =====
    const identityNullifier = randomBigInt();
    const identityTrapdoor = randomBigInt();

    const identityCommitment = hash([
        identityNullifier,
        identityTrapdoor
    ]);

    // ===== 2. 构造叶子节点 =====
    let leaves = [];

    // 插入真实用户（第0个）
    leaves.push(identityCommitment);

    // 填充其他叶子
    for (let i = 1; i < LEAF_COUNT; i++) {
        leaves.push(hash([randomBigInt(), randomBigInt()]));
    }

    // ===== 3. 构建 Merkle Tree =====
    let layers = [leaves];

    for (let level = 0; level < TREE_LEVELS; level++) {
        let current = layers[level];
        let next = [];

        for (let i = 0; i < current.length; i += 2) {
            let left = current[i];
            let right = current[i + 1] || current[i]; // 奇数补自己

            next.push(hash([left, right]));
        }

        layers.push(next);
    }

    const root = layers[TREE_LEVELS][0];

    // ===== 4. 生成路径 =====
    let index = 0; // 我们的叶子在第0位
    let pathElements = [];
    let pathIndices = [];

    for (let level = 0; level < TREE_LEVELS; level++) {
        let layer = layers[level];

        let isRight = index % 2;
        let pairIndex = isRight ? index - 1 : index + 1;

        let sibling = layer[pairIndex] || layer[index];

        pathElements.push(sibling);
        pathIndices.push(isRight);

        index = Math.floor(index / 2);
    }

    // ===== 5. 公共参数 =====
    const externalNullifier = randomBigInt();
    const vote = Math.floor(Math.random() * 2);

    // ===== 6. 输出 input.json =====
    const input = {
        identityNullifier: identityNullifier.toString(),
        identityTrapdoor: identityTrapdoor.toString(),
        treePathElements: pathElements.map(e => e.toString()),
        treePathIndices: pathIndices,
        root: root.toString(),
        externalNullifier: externalNullifier.toString(),
        vote: vote
    };

    fs.writeFileSync("input.json", JSON.stringify(input, null, 2));

    console.log("✅ 已生成可验证的 input.json");
})();
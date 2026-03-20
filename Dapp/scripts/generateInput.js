const circomlib = require("circomlibjs");
const { utils } = require("ffjavascript");
const fs = require("fs");

async function main() {
    const poseidon = await circomlib.buildPoseidon();
    const F = poseidon.F;

    // =========================
    // 1. 生成身份（Semaphore）
    // =========================
    const identityNullifier = BigInt(123456);
    const identityTrapdoor = BigInt(7891011);

    const commitment = F.toObject(
        poseidon([identityNullifier, identityTrapdoor])
    );

    console.log("commitment:", commitment.toString());

    // =========================
    // 2. 构建 Merkle Tree
    // =========================
    const TREE_DEPTH = 20;
    const ZERO = BigInt(0);

    // 初始化所有叶子
    let leaves = [];
    for (let i = 0; i < 1 << 4; i++) { // demo用16个叶子（不要用2^20）
        leaves.push(ZERO);
    }

    // 把我们的 commitment 插进去
    const leafIndex = 3;
    leaves[leafIndex] = commitment;

    // 构建树
    function hash(left, right) {
        return F.toObject(poseidon([left, right]));
    }

    let layers = [];
    layers.push(leaves);

    for (let level = 0; level < TREE_DEPTH; level++) {
        let prev = layers[level];
        let next = [];

        for (let i = 0; i < prev.length; i += 2) {
            next.push(hash(prev[i], prev[i + 1] || ZERO));
        }

        layers.push(next);
        if (next.length === 1) break;
    }

    const root = layers[layers.length - 1][0];

    console.log("root:", root.toString());

    // =========================
    // 3. 生成 Merkle Path
    // =========================
    let pathElements = [];
    let pathIndices = [];

    let index = leafIndex;

    for (let level = 0; level < layers.length - 1; level++) {
        let layer = layers[level];

        let isRightNode = index % 2;
        let siblingIndex = isRightNode ? index - 1 : index + 1;

        pathElements.push(layer[siblingIndex] || ZERO);
        pathIndices.push(isRightNode);

        index = Math.floor(index / 2);
    }

    // 补齐到 nLevels（20）
    while (pathElements.length < TREE_DEPTH) {
        pathElements.push(ZERO);
        pathIndices.push(0);
    }

    // =========================
    // 4. 业务参数
    // =========================
    const externalNullifier = BigInt(1); // 投票轮次
    const signal = BigInt(1); // 投票选项（比如投1）

    // =========================
    // 5. 生成 input.json
    // =========================
    const input = {
        identityNullifier: identityNullifier.toString(),
        identityTrapdoor: identityTrapdoor.toString(),
        treePathElements: pathElements.map(x => x.toString()),
        treePathIndices: pathIndices,
        root: root.toString(),
        externalNullifier: externalNullifier.toString(),
        signal: signal.toString()
    };

    fs.writeFileSync("input.json", JSON.stringify(input, null, 2));

    console.log("✅ input.json 已生成");
}

main();
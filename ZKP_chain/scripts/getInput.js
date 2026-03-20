const circomlibjs = require("circomlibjs");
const fs = require("fs");

async function main() {
    const poseidon = await circomlibjs.buildPoseidon();
    const F = poseidon.F;

    const nLevels = 20;

    // =========================
    // 1. identity
    // =========================
    const identityNullifier = 123n;
    const identityTrapdoor = 456n;

    const identityCommitment = F.toObject(
        poseidon([identityNullifier, identityTrapdoor])
    );

    // =========================
    // 2. 构造一个“极简树”
    // （只有一个 leaf，其余全 0）
    // =========================
    let cur = identityCommitment;

    const pathElements = [];
    const pathIndices = [];

    for (let i = 0; i < nLevels; i++) {
        const sibling = 0n;     // 全 0 树
        pathElements.push("0");
        pathIndices.push("0");  // 永远在左边

        cur = F.toObject(poseidon([cur, sibling]));
    }

    const root = cur;

    // =========================
    // 3. 其他输入
    // =========================
    const externalNullifier = 1n;
    const vote = 1n;

    // =========================
    // 4. 输出 input.json
    // =========================
    const input = {
        identityNullifier: identityNullifier.toString(),
        identityTrapdoor: identityTrapdoor.toString(),
        treePathElements: pathElements,
        treePathIndices: pathIndices,
        root: root.toString(),
        externalNullifier: externalNullifier.toString(),
        vote: vote.toString()
    };

    fs.writeFileSync("input.json", JSON.stringify(input, null, 2));
    console.log("✅ input.json generated");
}

main();
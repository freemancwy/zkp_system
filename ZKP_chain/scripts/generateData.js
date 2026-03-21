const fs = require("fs");
const crypto = require("crypto");
const { buildPoseidon } = require("circomlibjs");

// ===== 参数 =====
const LEAF_COUNT = 1000_000;
const DATA_DIR = "./data";

// ===== 生成随机 BigInt（贴近真实）=====
function randFieldElement() {
  return BigInt("0x" + crypto.randomBytes(31).toString("hex"));
}

async function main() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

  const poseidon = await buildPoseidon();
  const F = poseidon.F;

  console.log("1) 生成 identityCommitment（模拟真实身份生成）...");

  const leaves = [];

  for (let i = 0; i < LEAF_COUNT; i++) {

    //测试数据
    //nullifier 123256632991216389573798192954620886744742862956539081364056640792508665237
    //trapdoor 191018974374298698051182068565320464020008115731574895376882648177082535178
    //commitment 366557395129706756045098044579796233777210422743439366228039860215603146283

    // 模拟真实身份
    const identityNullifier = randFieldElement();
    const identityTrapdoor = randFieldElement();

    // commitment
    const commitment = poseidon([
      identityNullifier,
      identityTrapdoor,
    ]);

    leaves.push(F.toString(commitment));

    if(i===0){
      console.log("这是一个测试身份")
      console.log("nullifier",identityNullifier.toString())
      console.log("trapdoor",identityTrapdoor.toString())
      console.log("commitment",F.toString())
    }

    if (i % 1000 === 0) {
      console.log(`已生成 ${i}`);
    }
  }

  fs.writeFileSync(
    `${DATA_DIR}/leaves.json`,
    JSON.stringify({ leaves }, null, 2)
  );

  console.log("2) 构建 Merkle Root...");

  let current = leaves.map((x) => BigInt(x));
  let depth = 0;

  while (current.length > 1) {
    const next = [];

    for (let i = 0; i < current.length; i += 2) {
      const left = current[i];
      const right = current[i + 1] ?? current[i];

      const h = poseidon([left, right]);
      next.push(F.toObject(h));
    }

    current = next;
    depth++;
    console.log(`level ${depth} -> ${current.length}`);
  }

  const root = current[0].toString();

  fs.writeFileSync(
    `${DATA_DIR}/tree_meta.json`,
    JSON.stringify(
      {
        root,
        depth,
        leafCount: LEAF_COUNT,
      },
      null,
      2
    )
  );

  console.log("完成！");
  console.log("root =", root);
}

main();
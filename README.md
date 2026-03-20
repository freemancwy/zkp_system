# zkp_system

基于零知识证明与区块链的匿名投票演示系统，毕业设计

1.总体架构
1.1前端DApp
身份生成使用（Semaphore Identity）
读取链上状态（root/epoch）
本地生成 Plonk 证明
提交proof
1.2去中心化数据层
使用IPFS构建树
多源 proof provider
1.3区块链（以太坊）
Increment Merkle Tree
root
nullifierHashes
Verfier
投票逻辑
1.4ZKP（plonk 工具链）
Circom电路
Witness生成
Plonk prover

2.完整流程
2.1注册
用户：
生成 identity
commitment = H(identity)

      → 调用合约 insert(commitment)

      链上：
         更新 Merkle Tree
         更新 root

2.2获取路径
用户：
从任意数据源获取：
pathElements
pathIndices
2.3生成 PLONK 证明
输入：
identity
path
root
externalNullifier（epoch）

输出：
proof
nullifierHash  
 2.4投票
合约：vote(proof, root, nullifierHash, signal)
合约检查：1. root 是否有效2. nullifierHash 未使用verifyProof == true

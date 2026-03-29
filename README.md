# zkp_system

基于零知识证明与区块链的匿名投票演示系统。

当前后端接口语义如下：

1. `/api/root`
获取当前 Merkle Tree 根节点、深度和叶子数量。

2. `/api/external-nullifier/publish`
管理员发布一个投票活动，对应一个 `externalNullifier`。

3. `/api/external-nullifiers`
查询所有已发布活动。

4. `/api/register`
用户全局注册接口，只需提供手机号。注册成功后会生成一份固定匿名身份。

5. `/api/merkle-proof`
根据手机号获取该用户身份对应的 Merkle 路径信息。

6. `/api/vote`
投票接口。提交证明输入时需要携带活动的 `externalNullifier`，从而保证“同一用户在同一活动中只能投一次”。

7. `/api/activity-stats/:externalNullifier`
查询某个活动的投票统计信息。

说明：

- `register` 不再要求用户提供 `externalNullifier`。
- `externalNullifier` 只用于具体活动上下文，不再参与用户注册。
- 服务启动时会兼容旧版 `users.json` 结构，并自动整理为“一个手机号对应一个身份”的新结构。

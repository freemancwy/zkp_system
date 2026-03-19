#!/bin/bash

set -e  # 任意命令失败立即退出

echo "===== Phase 1: Powers of Tau ====="

snarkjs powersoftau new bn128 14 pot14_0000.ptau -v

snarkjs powersoftau contribute pot14_0000.ptau pot14_0001.ptau \
  --name="第一次贡献" -v -e="entropy1"

snarkjs powersoftau contribute pot14_0001.ptau pot14_0002.ptau \
  --name="第二次贡献" -v -e="不能反抗的萨科饭卡上"

snarkjs powersoftau export challenge pot14_0002.ptau challenge_0003

snarkjs powersoftau challenge contribute bn128 challenge_0003 response_0003 \
  -e="飞机萨菲拉封口令打算看了"

snarkjs powersoftau import response pot14_0002.ptau response_0003 pot14_0003.ptau \
  -n="第三次贡献"

snarkjs powersoftau verify pot14_0003.ptau

snarkjs powersoftau beacon pot14_0003.ptau pot14_beacon.ptau \
  0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f \
  10 -n="第一次信标"

snarkjs powersoftau prepare phase2 pot14_beacon.ptau pot14_final.ptau -v

snarkjs powersoftau verify pot14_final.ptau


echo "===== Phase 2: Compile Circuit ====="

circom circuit.circom --r1cs --wasm --c --sym --inspect

snarkjs r1cs info circuit.r1cs
snarkjs r1cs export json circuit.r1cs circuit.r1cs.json


echo "===== Phase 3: Witness ====="

snarkjs wtns calculate circuit_js/circuit.wasm input.json witness.wtns


echo "===== Phase 4: Groth16 Setup ====="

snarkjs groth16 setup circuit.r1cs pot14_final.ptau circuit_0000.zkey

snarkjs zkey contribute circuit_0000.zkey circuit_0001.zkey \
  --name="Contributor1" -v -e="entropy2"

snarkjs zkey contribute circuit_0001.zkey circuit_0002.zkey \
  --name="Contributor2" -v -e="Another random entropy"

snarkjs zkey export bellman circuit_0002.zkey challenge_phase2_0003

snarkjs zkey bellman contribute bn128 challenge_phase2_0003 response_phase2_0003 \
  -e="some random text"

snarkjs zkey import bellman circuit_0002.zkey response_phase2_0003 circuit_0003.zkey \
  -n="Third contribution name"

snarkjs zkey verify circuit.r1cs pot14_final.ptau circuit_0003.zkey

snarkjs zkey beacon circuit_0003.zkey circuit_final.zkey \
  0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f \
  10 -n="Final Beacon phase2"

snarkjs zkey verify circuit.r1cs pot14_final.ptau circuit_final.zkey


echo "===== Phase 5: Proof ====="

snarkjs zkey export verificationkey circuit_final.zkey verification_key.json

snarkjs groth16 prove circuit_final.zkey witness.wtns proof.json public.json

snarkjs groth16 fullprove input.json circuit_js/circuit.wasm circuit_final.zkey \
  proof.json public.json

snarkjs groth16 verify verification_key.json public.json proof.json


echo "===== Phase 6: Export Solidity Verifier ====="

snarkjs zkey export solidityverifier circuit_final.zkey verifier.sol


echo "===== DONE ====="
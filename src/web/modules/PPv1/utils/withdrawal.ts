import {
  type Hash,
  type AccountCommitment,
  type WithdrawalProofInput,
  type Secret,
  type WithdrawalProof,
  generateMerkleProof
} from '@0xbow/privacy-pools-core-sdk'

export const prepareWithdrawalProofInput = (
  commitment: AccountCommitment,
  amount: bigint,
  stateMerkleProof: Awaited<ReturnType<typeof generateMerkleProof>>,
  aspMerkleProof: Awaited<ReturnType<typeof generateMerkleProof>>,
  context: bigint,
  secret: Secret,
  nullifier: Secret
): WithdrawalProofInput => {
  const padArray = (arr: bigint[], length: number): bigint[] => {
    if (arr.length >= length) return arr
    return [...arr, ...Array(length - arr.length).fill(BigInt(0))]
  }

  return {
    withdrawalAmount: amount,
    stateMerkleProof: {
      root: stateMerkleProof.root as Hash,
      leaf: commitment.hash,
      index: stateMerkleProof.index,
      siblings: padArray(stateMerkleProof.siblings as bigint[], 32) // Pad to 32 length
    },
    aspMerkleProof: {
      root: aspMerkleProof.root as Hash,
      leaf: commitment.label,
      index: aspMerkleProof.index,
      siblings: padArray(aspMerkleProof.siblings as bigint[], 32) // Pad to 32 length
    },
    stateRoot: stateMerkleProof.root as Hash,
    aspRoot: aspMerkleProof.root as Hash,
    stateTreeDepth: BigInt(32), // Double check
    aspTreeDepth: BigInt(32), // Double check
    context,
    newSecret: secret,
    newNullifier: nullifier
  }
}

/**
 * Groth16 proof components are fixed-length tuples, but they are typed as plain arrays, so under
 * `noUncheckedIndexedAccess` every index reads as possibly undefined. Fail loudly instead of
 * coercing a missing component to 0, which would silently produce an invalid proof.
 */
const toProofBigInt = (component: string | undefined, path: string): bigint => {
  if (component === undefined) throw new Error(`Malformed proof: missing ${path}`)

  return BigInt(component)
}

export function transformProofForRelayerApi(proof: WithdrawalProof) {
  return {
    publicSignals: proof.publicSignals.map((signal) => BigInt(signal)) as [
      bigint,
      bigint,
      bigint,
      bigint,
      bigint,
      bigint,
      bigint,
      bigint
    ],
    proof: {
      pi_a: [
        toProofBigInt(proof.proof.pi_a[0], 'pi_a[0]'),
        toProofBigInt(proof.proof.pi_a[1], 'pi_a[1]')
      ] as [bigint, bigint],
      pi_b: [
        [
          toProofBigInt(proof.proof.pi_b[0]?.[0], 'pi_b[0][0]'),
          toProofBigInt(proof.proof.pi_b[0]?.[1], 'pi_b[0][1]')
        ],
        [
          toProofBigInt(proof.proof.pi_b[1]?.[0], 'pi_b[1][0]'),
          toProofBigInt(proof.proof.pi_b[1]?.[1], 'pi_b[1][1]')
        ]
      ] as [readonly [bigint, bigint], readonly [bigint, bigint]],
      pi_c: [
        toProofBigInt(proof.proof.pi_c[0], 'pi_c[0]'),
        toProofBigInt(proof.proof.pi_c[1], 'pi_c[1]')
      ] as [bigint, bigint]
    }
  }
}

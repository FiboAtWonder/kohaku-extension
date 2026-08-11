import type { CommitmentProof } from '@0xbow/privacy-pools-core-sdk'

/**
 * Groth16 proof components are fixed-length tuples, but they are typed as plain arrays, so under
 * `noUncheckedIndexedAccess` every index reads as possibly undefined. Fail loudly instead of
 * coercing a missing component to 0, which would silently produce an invalid proof.
 */
const toProofBigInt = (component: string | undefined, path: string): bigint => {
  if (component === undefined) throw new Error(`Malformed proof: missing ${path}`)

  return BigInt(component)
}

/**
 * Transforms ragequit proof for contract interaction
 */
export function transformRagequitProofForContract(proof: CommitmentProof) {
  return {
    pA: [
      toProofBigInt(proof.proof.pi_a[0], 'pi_a[0]'),
      toProofBigInt(proof.proof.pi_a[1], 'pi_a[1]')
    ] as [bigint, bigint],
    pB: [
      [
        toProofBigInt(proof.proof.pi_b[0]?.[1], 'pi_b[0][1]'),
        toProofBigInt(proof.proof.pi_b[0]?.[0], 'pi_b[0][0]')
      ],
      [
        toProofBigInt(proof.proof.pi_b[1]?.[1], 'pi_b[1][1]'),
        toProofBigInt(proof.proof.pi_b[1]?.[0], 'pi_b[1][0]')
      ]
    ] as [readonly [bigint, bigint], readonly [bigint, bigint]],
    pC: [
      toProofBigInt(proof.proof.pi_c[0], 'pi_c[0]'),
      toProofBigInt(proof.proof.pi_c[1], 'pi_c[1]')
    ] as [bigint, bigint],
    pubSignals: proof.publicSignals.map((signal) => BigInt(signal)) as [
      bigint,
      bigint,
      bigint,
      bigint
    ]
  }
}

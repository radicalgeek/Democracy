import { createHash, randomBytes } from "node:crypto";

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString("hex");
}

export type ProofStep = { hash: string; position: "left" | "right" };

function parentHash(left: string, right: string) {
  return sha256(`${left}|${right}`);
}

/** Merkle root over ordered leaf hashes; odd nodes are paired with themselves. */
export function merkleRoot(leaves: string[]): string {
  if (leaves.length === 0) return sha256("empty");
  let level = leaves;
  while (level.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      next.push(parentHash(level[i], level[i + 1] ?? level[i]));
    }
    level = next;
  }
  return level[0];
}

export function merkleProof(leaves: string[], index: number): ProofStep[] {
  const proof: ProofStep[] = [];
  let level = leaves;
  let cursor = index;
  while (level.length > 1) {
    const isRight = cursor % 2 === 1;
    const siblingIndex = isRight ? cursor - 1 : cursor + 1;
    const sibling = level[siblingIndex] ?? level[cursor];
    proof.push({ hash: sibling, position: isRight ? "left" : "right" });
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      next.push(parentHash(level[i], level[i + 1] ?? level[i]));
    }
    level = next;
    cursor = Math.floor(cursor / 2);
  }
  return proof;
}

export function verifyProof(leaf: string, proof: ProofStep[], root: string) {
  let hash = leaf;
  for (const step of proof) {
    hash = step.position === "left" ? parentHash(step.hash, hash) : parentHash(hash, step.hash);
  }
  return hash === root;
}

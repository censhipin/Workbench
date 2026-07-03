// ============================================================
// VerifierRegistry — Verifier 注册中心
// ============================================================

import { type Verifier } from './types';

export class VerifierRegistry {
  private verifiers = new Map<string, Verifier>();

  register(verifier: Verifier): void {
    this.verifiers.set(verifier.type, verifier);
  }

  get(type: string): Verifier | undefined {
    return this.verifiers.get(type);
  }

  has(type: string): boolean {
    return this.verifiers.has(type);
  }

  types(): string[] {
    return Array.from(this.verifiers.keys());
  }

  registerAll(...verifiers: Verifier[]): void {
    for (const v of verifiers) {
      this.register(v);
    }
  }
}

/** 全局单例 */
export const verifierRegistry = new VerifierRegistry();

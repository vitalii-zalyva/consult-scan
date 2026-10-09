// Spec: specs/001-consult-protocol/spec.md (CP-4xx), specs/008-extended-data/spec.md (XD-1xx, XD-2xx)

export const u16 = (b: readonly number[]) => ((b[0] ?? 0) << 8) | (b[1] ?? 0);
export const u8 = (b: readonly number[]) => b[0] ?? 0;

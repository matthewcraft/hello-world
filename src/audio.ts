export function muLawDecodeSample(u8: number): number {
  // ITU-T G.711 mu-law decode to 16-bit PCM
  let uVal = (~u8) & 0xff;
  const sign = uVal & 0x80;
  const exponent = (uVal >> 4) & 0x07;
  const mantissa = uVal & 0x0f;
  let sample = ((mantissa << 3) + 0x84) << exponent; // 0x84 = 132 bias
  sample -= 0x84;
  return sign ? -sample : sample;
}

export function muLawEncodeSample(sample: number): number {
  // Clamp to 16-bit
  let pcm = Math.max(-32768, Math.min(32767, sample));
  const sign = (pcm < 0) ? 0x80 : 0x00;
  if (pcm < 0) pcm = -pcm - 1; // Bias toward magnitude
  pcm += 0x84; // Add bias
  if (pcm > 0x7fff) pcm = 0x7fff;

  // Determine exponent
  let exponent = 7;
  for (let expMask = 0x4000; (pcm & expMask) === 0 && exponent > 0; exponent--, expMask >>= 1) {}
  const mantissa = (pcm >> (exponent + 3)) & 0x0f;
  const u8 = ~(sign | (exponent << 4) | mantissa) & 0xff;
  return u8;
}

export function muLawDecode(bufferMuLaw: Buffer): Int16Array {
  const out = new Int16Array(bufferMuLaw.length);
  for (let i = 0; i < bufferMuLaw.length; i++) {
    out[i] = muLawDecodeSample(bufferMuLaw[i]!);
  }
  return out;
}

export function muLawEncode(pcm16: Int16Array): Buffer {
  const out = Buffer.alloc(pcm16.length);
  for (let i = 0; i < pcm16.length; i++) {
    out[i] = muLawEncodeSample(pcm16[i]!);
  }
  return out;
}

export function upsample8kTo16kLinear(pcm8k: Int16Array): Int16Array {
  if (pcm8k.length === 0) return new Int16Array();
  const out = new Int16Array(pcm8k.length * 2);
  for (let i = 0; i < pcm8k.length - 1; i++) {
    const s0 = pcm8k[i]!;
    const s1 = pcm8k[i + 1]!;
    out[i * 2] = s0;
    out[i * 2 + 1] = (s0 + s1) >> 1;
  }
  // Last sample duplication
  const last = pcm8k[pcm8k.length - 1]!;
  out[out.length - 2] = last;
  out[out.length - 1] = last;
  return out;
}

export function downsample16kTo8kDecimate(pcm16k: Int16Array): Int16Array {
  const out = new Int16Array(Math.floor(pcm16k.length / 2));
  for (let i = 0, j = 0; j < out.length; i += 2, j++) {
    out[j] = pcm16k[i]!;
  }
  return out;
}

export function int16ToBase64(pcm: Int16Array): string {
  return Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength).toString('base64');
}

export function base64ToBuffer(b64: string): Buffer {
  return Buffer.from(b64, 'base64');
}
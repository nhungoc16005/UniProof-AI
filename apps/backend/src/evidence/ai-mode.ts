export type AiMode = 'OFF' | 'SHADOW' | 'ASSIST';

export function getAiMode(value = process.env.AI_MODE): AiMode {
  const normalized = (value || 'OFF').trim().toUpperCase();
  return normalized === 'SHADOW' || normalized === 'ASSIST' ? normalized : 'OFF';
}

export function shouldQueueAi(value = process.env.AI_MODE): boolean {
  return getAiMode(value) !== 'OFF';
}

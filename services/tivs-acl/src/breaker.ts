import CircuitBreaker from "opossum";

export function createTivsBreaker<TArgs extends unknown[], TResult>(
  action: (...args: TArgs) => Promise<TResult>,
): CircuitBreaker<TArgs, TResult> {
  return new CircuitBreaker(action, {
    timeout: Number(process.env.TIVS_TIMEOUT_MS ?? 5000),
    errorThresholdPercentage: 50,
    volumeThreshold: 5,
    resetTimeout: 15000,
  });
}

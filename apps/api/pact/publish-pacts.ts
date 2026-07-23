import { resolve } from 'node:path';
import { Publisher } from '@pact-foundation/pact';

export async function publishPacts() {
  const brokerUrl =
    process.env.PACT_BROKER_BASE_URL || 'http://localhost:9292';
  const pactFilesOrDir = [resolve(process.cwd(), 'pacts')];
  const consumerVersion = process.env.GIT_COMMIT || '1.0.0';

  const opts = {
    pactFilesOrDir,
    pactBroker: brokerUrl,
    consumerVersion,
  };

  try {
    const publisher = new Publisher(opts);
    await publisher.publishPacts();
    console.log(`Successfully published pacts to broker at ${brokerUrl}`);
  } catch (err) {
    console.warn(
      `Pact broker publish skipped or failed (broker may be offline): ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }
}

publishPacts();

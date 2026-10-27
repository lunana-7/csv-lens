/// <reference lib="webworker" />
import { parseCsv } from './data';

self.onmessage = (event: MessageEvent<string>) => {
  try {
    self.postMessage({ dataset: parseCsv(event.data) });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : 'Could not read this file.' });
  }
};

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DownloadProgressTracker, LOADING_STATES } from '../services/progressTracker';

describe('DownloadProgressTracker & Loading States Test Suite', () => {
  let tracker;
  let updates;

  beforeEach(() => {
    updates = [];
    tracker = new DownloadProgressTracker({
      modelName: 'Qwen2.5 1.5B',
      expectedTotalBytes: 850 * 1024 * 1024,
      onUpdate: (report) => updates.push(report),
    });
  });

  // Scenario 1: Fresh download with no cached files
  it('Scenario 1: Fresh download starts at 0%, increases correctly, and never exceeds 100%', () => {
    expect(tracker.percent).toBe(0);
    expect(tracker.state).toBe(LOADING_STATES.PREPARING);

    tracker.handleTransformersEvent({
      status: 'progress',
      file: 'qwen2.5-1.5b-weights.bin',
      progress: 5.6,
      loaded: 42.5 * 1024 * 1024,
      total: 850 * 1024 * 1024,
    });

    const report1 = updates[updates.length - 1];
    expect(report1.state).toBe(LOADING_STATES.DOWNLOADING);
    expect(report1.percent).toBeGreaterThanOrEqual(0);
    expect(report1.percent).toBeLessThanOrEqual(100);
    expect(report1.percent).toBe(5); // 42.5MB / 850MB = 5%
    expect(report1.progress).toBe(0.05);
    expect(report1.text).toContain('Downloading Qwen2.5 1.5B weights (5%)...');
    expect(report1.text).toContain(`(${report1.percent}%)`);
  });

  // Scenario 2: Partially cached model
  it('Scenario 2: Partially cached model accounts for completed files without duplicate counting', () => {
    tracker.handleTransformersEvent({
      status: 'progress',
      file: 'qwen2.5-shard1.bin',
      loaded: 250 * 1024 * 1024,
      total: 250 * 1024 * 1024,
    });
    tracker.handleTransformersEvent({
      status: 'done',
      file: 'qwen2.5-shard1.bin',
    });

    // 250 MB / 850 MB = 29%
    expect(tracker.percent).toBe(29);

    tracker.handleTransformersEvent({
      status: 'progress',
      file: 'qwen2.5-shard2.bin',
      loaded: 300 * 1024 * 1024,
      total: 600 * 1024 * 1024,
    });

    // Total = 250 + 300 = 550MB / 850MB = 65%
    expect(tracker.percent).toBe(65);
    expect(tracker.percent).toBeLessThanOrEqual(100);
  });

  // Scenario 3: Multiple model shards
  it('Scenario 3: Multiple model shards downloading reach 100% cleanly', () => {
    const shard1 = 'shard1.bin';
    const shard2 = 'shard2.bin';

    tracker.handleTransformersEvent({ status: 'progress', file: shard1, loaded: 400 * 1024 * 1024, total: 400 * 1024 * 1024 });
    tracker.handleTransformersEvent({ status: 'done', file: shard1 });
    tracker.handleTransformersEvent({ status: 'progress', file: shard2, loaded: 450 * 1024 * 1024, total: 450 * 1024 * 1024 });
    tracker.handleTransformersEvent({ status: 'done', file: shard2 });

    expect(tracker.percent).toBe(100);
    tracker.setDownloadComplete('Download complete.');
    expect(tracker.state).toBe(LOADING_STATES.DOWNLOAD_COMPLETE);
  });

  // Scenario 4: WebLLM initProgressCallback events
  it('Scenario 4: Correctly handles WebLLM text events and compiles shaders', () => {
    tracker.handleWebLLMEvent({
      progress: 0.25,
      text: 'Loading Qwen2.5 1.5B parameters (25%)...',
    });
    expect(tracker.percent).toBe(25);
    expect(tracker.state).toBe(LOADING_STATES.DOWNLOADING);

    tracker.handleWebLLMEvent({
      progress: 0.9,
      text: 'Compiling WebGPU shaders...',
    });
    expect(tracker.percent).toBe(90);
    expect(tracker.state).toBe(LOADING_STATES.INITIALIZING);

    tracker.setReady('Qwen2.5 1.5B is ready.');
    expect(tracker.percent).toBe(100);
    expect(tracker.state).toBe(LOADING_STATES.READY);
  });

  // Scenario 5: User Cancellation
  it('Scenario 5: Cancelling model download marks cancelled state', () => {
    tracker.handleTransformersEvent({
      status: 'progress',
      file: 'shard1.bin',
      loaded: 200 * 1024 * 1024,
      total: 850 * 1024 * 1024,
    });
    expect(tracker.state).toBe(LOADING_STATES.DOWNLOADING);

    tracker.abort('Download cancelled by user.');
    expect(tracker.state).toBe(LOADING_STATES.CANCELLED);
    expect(tracker.aborted).toBe(true);

    tracker.reset();
    expect(tracker.percent).toBe(0);
    expect(tracker.state).toBe(LOADING_STATES.PREPARING);
  });
});

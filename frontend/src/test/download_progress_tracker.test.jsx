import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DownloadProgressTracker, LOADING_STATES } from '../services/progressTracker';

describe('DownloadProgressTracker & Loading States Test Suite', () => {
  let tracker;
  let updates;

  beforeEach(() => {
    updates = [];
    tracker = new DownloadProgressTracker({
      modelName: 'Qwen2.5-VL 3B',
      expectedTotalBytes: 2200 * 1024 * 1024,
      onUpdate: (report) => updates.push(report),
    });
  });

  // Scenario 1: A fresh download with no cached files
  it('Scenario 1: Fresh download starts at 0%, increases correctly, and never exceeds 100%', () => {
    expect(tracker.percent).toBe(0);
    expect(tracker.state).toBe(LOADING_STATES.PREPARING);

    // Transformers.js sends progress with percent 5.6% (previous bug test: was 560%)
    tracker.handleTransformersEvent({
      status: 'progress',
      file: 'onnx/decoder_model_merged_q4.onnx',
      progress: 5.6,
      loaded: 110 * 1024 * 1024,
      total: 1600 * 1024 * 1024,
    });

    const report1 = updates[updates.length - 1];
    expect(report1.state).toBe(LOADING_STATES.DOWNLOADING);
    expect(report1.percent).toBeGreaterThanOrEqual(0);
    expect(report1.percent).toBeLessThanOrEqual(100);
    expect(report1.percent).toBe(5); // 110MB / 2200MB = 5%
    expect(report1.progress).toBe(0.05);
    expect(report1.text).toContain('Downloading Qwen2.5-VL 3B weights (5%)...');
    // Ensure the same percentage is in text, percent, and progress
    expect(report1.text).toContain(`(${report1.percent}%)`);
  });

  // Scenario 2: A partially cached model
  it('Scenario 2: Partially cached model accounts for completed files without duplicate counting', () => {
    // File 1 (vision encoder) is already cached / done
    tracker.handleTransformersEvent({
      status: 'progress',
      file: 'onnx/vision_encoder_q4.onnx',
      loaded: 400 * 1024 * 1024,
      total: 400 * 1024 * 1024,
    });
    tracker.handleTransformersEvent({
      status: 'done',
      file: 'onnx/vision_encoder_q4.onnx',
    });

    // 400 MB / 2200 MB = 18%
    expect(tracker.percent).toBe(18);

    // File 2 (decoder) downloads half (800MB)
    tracker.handleTransformersEvent({
      status: 'progress',
      file: 'onnx/decoder_model_merged_q4.onnx',
      loaded: 800 * 1024 * 1024,
      total: 1600 * 1024 * 1024,
    });

    // Total = 400 + 800 = 1200MB / 2200MB = 55%
    expect(tracker.percent).toBe(55);
    expect(tracker.percent).toBeLessThanOrEqual(100);
  });

  // Scenario 3: Multiple model shards
  it('Scenario 3: Multiple model shards downloading concurrently and sequentially reach 100% only when all complete', () => {
    const shard1 = 'onnx/shard1.onnx';
    const shard2 = 'onnx/shard2.onnx';
    const shard3 = 'onnx/shard3.onnx';

    tracker.handleTransformersEvent({ status: 'progress', file: shard1, loaded: 500 * 1024 * 1024, total: 1000 * 1024 * 1024 });
    tracker.handleTransformersEvent({ status: 'progress', file: shard2, loaded: 300 * 1024 * 1024, total: 1000 * 1024 * 1024 });
    tracker.handleTransformersEvent({ status: 'progress', file: shard3, loaded: 100 * 1024 * 1024, total: 200 * 1024 * 1024 });

    // Downloaded: 900 MB / 2200 MB = 41%
    expect(tracker.percent).toBe(41);
    expect(tracker.state).toBe(LOADING_STATES.DOWNLOADING);

    // Complete shard 1
    tracker.handleTransformersEvent({ status: 'progress', file: shard1, loaded: 1000 * 1024 * 1024, total: 1000 * 1024 * 1024 });
    tracker.handleTransformersEvent({ status: 'done', file: shard1 });
    expect(tracker.percent).toBe(64); // 1400 / 2200

    // Complete shard 3
    tracker.handleTransformersEvent({ status: 'progress', file: shard3, loaded: 200 * 1024 * 1024, total: 200 * 1024 * 1024 });
    tracker.handleTransformersEvent({ status: 'done', file: shard3 });
    expect(tracker.percent).toBe(68); // 1500 / 2200

    // Complete shard 2
    tracker.handleTransformersEvent({ status: 'progress', file: shard2, loaded: 1000 * 1024 * 1024, total: 1000 * 1024 * 1024 });
    tracker.handleTransformersEvent({ status: 'done', file: shard2 });

    // All shards complete -> 100%
    expect(tracker.percent).toBe(100);
  });

  // Scenario 4: A failed download followed by retry
  it('Scenario 4: Failed download followed by retry resets cleanly without double counting', () => {
    tracker.handleTransformersEvent({
      status: 'progress',
      file: 'onnx/decoder.onnx',
      loaded: 500 * 1024 * 1024,
      total: 2200 * 1024 * 1024,
    });
    expect(tracker.percent).toBe(23);

    // Failure occurs
    tracker.setDownloadFailed('Network connection lost');
    expect(tracker.state).toBe(LOADING_STATES.DOWNLOAD_FAILED);
    expect(tracker.error).toContain('Network connection lost');

    // User triggers retry
    tracker.reset();
    expect(tracker.percent).toBe(0);
    expect(tracker.progress).toBe(0);
    expect(tracker.state).toBe(LOADING_STATES.PREPARING);

    // Clean download restarts
    tracker.handleTransformersEvent({
      status: 'progress',
      file: 'onnx/decoder.onnx',
      loaded: 220 * 1024 * 1024,
      total: 2200 * 1024 * 1024,
    });
    expect(tracker.percent).toBe(10);
  });

  // Scenario 5: A cancelled download
  it('Scenario 5: Cancelled download aborts, ignores stale callbacks, and allows restart', () => {
    tracker.handleTransformersEvent({
      status: 'progress',
      file: 'onnx/decoder.onnx',
      loaded: 440 * 1024 * 1024,
      total: 2200 * 1024 * 1024,
    });
    expect(tracker.percent).toBe(20);

    // User clicks Cancel
    tracker.abort('Model loading cancelled by user.');
    expect(tracker.state).toBe(LOADING_STATES.CANCELLED);
    expect(tracker.aborted).toBe(true);

    const countBeforeStale = updates.length;

    // Stale callback arrives from in-flight worker
    tracker.handleTransformersEvent({
      status: 'progress',
      file: 'onnx/decoder.onnx',
      loaded: 880 * 1024 * 1024,
      total: 2200 * 1024 * 1024,
    });

    // Stale callback was ignored
    expect(updates.length).toBe(countBeforeStale);

    // User restarts
    tracker.reset();
    expect(tracker.aborted).toBe(false);
    expect(tracker.percent).toBe(0);
    expect(tracker.state).toBe(LOADING_STATES.PREPARING);
  });

  // Scenario 6: A complete cached model
  it('Scenario 6: Complete cached model transitions to ready only after initialization', () => {
    tracker.setPreparing('Verifying cached weights in browser cache...');
    expect(tracker.state).toBe(LOADING_STATES.PREPARING);

    tracker.setDownloadComplete('Cached weights verified.');
    expect(tracker.state).toBe(LOADING_STATES.DOWNLOAD_COMPLETE);
    expect(tracker.percent).toBe(100);

    // Initializing must happen before Ready
    tracker.setInitializing('Compiling WebGPU pipeline with cached weights...');
    expect(tracker.state).toBe(LOADING_STATES.INITIALIZING);

    tracker.setReady('Qwen2.5-VL 3B vision model is ready.');
    expect(tracker.state).toBe(LOADING_STATES.READY);
  });

  // Scenario 7: A slow network connection with incremental byte chunks
  it('Scenario 7: Slow network connection reports strictly monotonic progress without exceeding 100% or NaN', () => {
    let lastPercent = 0;
    const totalBytes = 2200 * 1024 * 1024;
    const chunkSize = 110 * 1024 * 1024; // 5% per chunk

    for (let bytes = chunkSize; bytes <= totalBytes; bytes += chunkSize) {
      tracker.handleTransformersEvent({
        status: 'progress',
        file: 'weights.onnx',
        loaded: bytes,
        total: totalBytes,
      });

      expect(Number.isFinite(tracker.percent)).toBe(true);
      expect(tracker.percent).toBeGreaterThanOrEqual(lastPercent);
      expect(tracker.percent).toBeLessThanOrEqual(100);
      lastPercent = tracker.percent;
    }

    expect(tracker.percent).toBe(100);
  });

  it('Never displays NaN, Infinity, negative, or above 100% under corrupted runtime events', () => {
    // Degenerate / corrupted values
    tracker.handleTransformersEvent({ status: 'progress', file: 'bad.onnx', loaded: -500, total: -1000 });
    expect(tracker.percent).toBe(0);

    tracker.handleTransformersEvent({ status: 'progress', file: 'bad2.onnx', loaded: Infinity, total: 1000 });
    expect(tracker.percent).toBe(0);

    tracker.handleTransformersEvent({ status: 'progress', file: 'bad3.onnx', loaded: NaN, total: NaN });
    expect(tracker.percent).toBe(0);

    tracker.handleTransformersEvent({ status: 'progress', file: 'bad4.onnx', loaded: 99999999999999, total: 1000 });
    expect(tracker.percent).toBe(100); // Clamped at 100%
  });
});


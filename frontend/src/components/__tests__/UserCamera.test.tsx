import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import UserCamera from '../UserCamera';

function mockMedia() {
  const videoTrack = { enabled: true, stop: vi.fn() };
  const audioTrack = { enabled: true, stop: vi.fn() };
  const stream = {
    getVideoTracks: () => [videoTrack],
    getAudioTracks: () => [audioTrack],
    getTracks: () => [videoTrack, audioTrack],
  };
  const getUserMedia = vi.fn().mockResolvedValue(stream);
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });

  const recorder = { start: vi.fn(), stop: vi.fn(), state: 'recording', ondataavailable: null as null | ((e: unknown) => void) };
  const MediaRecorderMock = vi.fn(() => recorder);
  vi.stubGlobal('MediaRecorder', MediaRecorderMock);
  return { videoTrack, audioTrack, getUserMedia, recorder };
}

describe('UserCamera', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('does not request the camera until a websocket is available', () => {
    const { getUserMedia } = mockMedia();
    render(<UserCamera cameraOn micOn sendData={false} websocket={null} />);
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it('starts the camera and recorder, applying the camera and mic state', async () => {
    const { getUserMedia, videoTrack, audioTrack, recorder } = mockMedia();
    const ws = { send: vi.fn() } as unknown as WebSocket;
    render(<UserCamera cameraOn={false} micOn sendData websocket={ws} />);
    await waitFor(() => expect(recorder.start).toHaveBeenCalledWith(100));
    expect(getUserMedia).toHaveBeenCalledWith({ video: true, audio: true });
    expect(videoTrack.enabled).toBe(false);
    expect(audioTrack.enabled).toBe(true);
  });

  it('streams recorded chunks over the websocket when sendData is on', async () => {
    const { recorder } = mockMedia();
    const ws = { send: vi.fn() } as unknown as WebSocket;
    render(<UserCamera cameraOn micOn sendData websocket={ws} />);
    await waitFor(() => expect(recorder.ondataavailable).not.toBeNull());
    const buffer = new ArrayBuffer(4);
    recorder.ondataavailable!({ data: { size: 4, arrayBuffer: () => Promise.resolve(buffer) } });
    await waitFor(() => expect(ws.send).toHaveBeenCalledWith(buffer));
  });

  it('stops the camera, mic and recorder on unmount', async () => {
    const { recorder, videoTrack, audioTrack } = mockMedia();
    const ws = { send: vi.fn() } as unknown as WebSocket;
    const { unmount } = render(<UserCamera cameraOn micOn sendData={false} websocket={ws} />);
    await waitFor(() => expect(recorder.start).toHaveBeenCalled());
    unmount();
    expect(recorder.stop).toHaveBeenCalled();
    // Regression: tracks were read from videoRef, which React clears before cleanup.
    expect(videoTrack.stop).toHaveBeenCalled();
    expect(audioTrack.stop).toHaveBeenCalled();
  });

  it('releases the camera if unmounted while permission is pending', async () => {
    const { getUserMedia, videoTrack, recorder } = mockMedia();
    let grant!: (s: unknown) => void;
    const stream = await getUserMedia.getMockImplementation()!();
    getUserMedia.mockImplementation(() => new Promise((resolve) => (grant = resolve)));
    const ws = { send: vi.fn() } as unknown as WebSocket;
    const { unmount } = render(<UserCamera cameraOn micOn sendData={false} websocket={ws} />);
    await waitFor(() => expect(getUserMedia).toHaveBeenCalled());
    unmount();
    grant(stream);
    await waitFor(() => expect(videoTrack.stop).toHaveBeenCalled());
    expect(recorder.start).not.toHaveBeenCalled();
  });
});

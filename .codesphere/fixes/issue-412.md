# Proposed Fix for Issue #412

### Root Cause & Approach
The opponent's video stream fails to display because WebRTC negotiation tightly couples video offers to the countdown sequence and role selection (`"for"`), causing race conditions where offers or ICE candidates arrive before the receiving peer's local media stream or remote connection description is fully initialized. To fix this, decouple WebRTC connection initiation from the countdown/role constraints and ensure signaling messages (offers, answers, and ICE candidates) are buffered or handled defensively once both peers are present in the room and have initialized their local media tracks.

### Proposed Code Fix
Adjust your frontend or signaling handler (typically inside your WebRTC hook or component, e.g., `useWebRTC.ts` or equivalent) to queue incoming ICE candidates and handle offers robustly when remote descriptions are not yet set:

```typescript
// Example frontend WebRTC signaling handler fix
const handleSignalingMessage = async (message: SignalingMessage) => {
  if (!peerConnection) return;

  if (message.type === 'offer') {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(message.offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    sendToServer({ type: 'answer', answer });
    
    // Flush any queued ICE candidates that arrived early
    while (iceCandidateQueue.length > 0) {
      const candidate = iceCandidateQueue.shift();
      if (candidate) await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    }
  } else if (message.type === 'answer') {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(message.answer));
  } else if (message.type === 'ice-candidate') {
    if (peerConnection.remoteDescription && peerConnection.remoteDescription.type) {
      await peerConnection.addIceCandidate(new RTCIceCandidate(message.candidate));
    } else {
      iceCandidateQueue.push(message.candidate);
    }
  }
};
```

### Verification
1. Open two separate browser profiles or devices and join the same online debate room.
2. Grant camera and microphone permissions immediately upon entry.
3. Verify via browser console and UI video elements that the WebRTC peer connection initializes and exchanges offers/answers/ICE candidates successfully *before* the countdown or role selection occurs.
4. Confirm both participants can see each other's live video streams seamlessly.

---
*Formulated by @SarthakSoni31 via CodeSphere AI*
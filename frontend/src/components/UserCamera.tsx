import React, { useEffect, useRef } from 'react'

interface UserCameraProps {
  cameraOn: boolean
  micOn: boolean
  sendData: boolean
  websocket: WebSocket | null
}

const UserCamera: React.FC<UserCameraProps> = ({
  cameraOn,
  micOn,
  sendData,
  websocket,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const videoTrackRef = useRef<MediaStreamTrack | null>(null)
  const audioTrackRef = useRef<MediaStreamTrack | null>(null)

  useEffect(() => {
    const startCamera = async () => {
      if (!websocket) return // Wait until WebSocket is available

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        })

        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }

        // Get video and audio tracks
        const videoTrack = stream.getVideoTracks()[0]
        const audioTrack = stream.getAudioTracks()[0]
        videoTrack.enabled = cameraOn
        audioTrack.enabled = micOn

        videoTrackRef.current = videoTrack
        audioTrackRef.current = audioTrack

        // Initialize MediaRecorder
        mediaRecorderRef.current = new MediaRecorder(stream, {
          mimeType: 'video/webm; codecs=vp8',
        })

        mediaRecorderRef.current.ondataavailable = (event) => {
          if (event.data.size > 0 && sendData && websocket) {
            event.data.arrayBuffer().then((buffer) => websocket.send(buffer))
          }
        }

        // Start recording in intervals of 400ms
        mediaRecorderRef.current.start(100)
      } catch (err) {
        console.error('Error accessing camera or microphone:', err)
      }
    }

    startCamera()

    return () => {
      // Cleanup
      if (videoRef.current?.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks()
        tracks.forEach((track) => track.stop())
      }
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== 'inactive'
      ) {
        mediaRecorderRef.current.stop()
      }
    }
  }, [cameraOn, micOn, sendData, websocket])

  // Update track enabled state when cameraOn or micOn changes
  useEffect(() => {
    if (videoTrackRef.current) {
      videoTrackRef.current.enabled = cameraOn
    }
    if (audioTrackRef.current) {
      audioTrackRef.current.enabled = micOn
    }
  }, [cameraOn, micOn])

  return (
    <>
      <video
        ref={videoRef}
        autoPlay
        muted
        className="w-full h-full object-cover"
      />
    </>
  )
}

export default UserCamera

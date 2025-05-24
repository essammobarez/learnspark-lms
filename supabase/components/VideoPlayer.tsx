
import React, { useEffect, useRef } from 'react';

interface VideoPlayerProps {
  stream: MediaStream | null;
  isMuted?: boolean;
  isLocal?: boolean; // To differentiate local user's video, e.g., for styling
  displayName?: string;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ stream, isMuted = false, isLocal = false, displayName = "Participant" }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className={`relative rounded-lg overflow-hidden shadow-lg ${isLocal ? 'border-2 border-blue-500' : 'border border-gray-700'} bg-black`}>
      <video
        ref={videoRef}
        autoPlay
        playsInline // Important for mobile browsers
        muted={isMuted || isLocal} // Local video is often muted by default to prevent echo
        className="w-full h-full object-cover"
      />
      <div className="absolute bottom-0 left-0 bg-black bg-opacity-50 text-white text-xs px-2 py-1">
        {displayName} {isLocal && "(You)"}
      </div>
    </div>
  );
};

export default VideoPlayer;
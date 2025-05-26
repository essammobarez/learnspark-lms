
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
// apiService is not used for direct session start/join anymore with Supabase basic setup
// import { apiService } from '../services/apiService'; 
import { Course } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import Button from '../components/Button';
import VideoPlayer from '../components/VideoPlayer';
import { ROUTES, APP_NAME } from '../constants';
import { PhoneXMarkIcon, VideoCameraIcon, VideoCameraSlashIcon, MicrophoneIcon, ArrowLeftOnRectangleIcon, UserCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
// FIX: Corrected import path for supabase
import { supabase } from '../services/apiService'; // For potential future Supabase Realtime integration


const LiveSessionPage: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  
  const [course, setCourse] = useState<Course | null>(null);
  const [initialLoading, setInitialLoading] = useState(true); 
  
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isCameraEffectivelyOff, setIsCameraEffectivelyOff] = useState(true); 
  
  const [desiredVideoStreamState, setDesiredVideoStreamState] = useState(false); 
  const [hasMadeInitialChoice, setHasMadeInitialChoice] = useState(false);
  const [isLoadingMedia, setIsLoadingMedia] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);

  const [mockParticipantStreams, setMockParticipantStreams] = useState<MediaStream[]>([]);

  const micMutedRef = useRef(isMicMuted);
  useEffect(() => { micMutedRef.current = isMicMuted; }, [isMicMuted]);

  const fetchCourseDetails = useCallback(async () => {
    if (!courseId || !isAuthenticated || !user) {
      setMediaError("Course or user information is missing.");
      setInitialLoading(false);
      return;
    }
    setInitialLoading(true);
    setMediaError(null);
    try {
      // Fetch course details directly using Supabase if needed, or assume they are passed via props/state
      // For this example, we'll assume course details are minimal or not strictly needed for media setup.
      // If you need to verify course access for the live session, a Supabase call would go here.
      // const { data: fetchedCourse, error } = await supabase.from('courses').select('title').eq('id', courseId).single();
      // if (error) throw error;
      // if (!fetchedCourse) setMediaError("Course not found.");
      // else setCourse(fetchedCourse as unknown as Course); // Adjust mapping as needed

      // For simplicity, setting a placeholder or assuming course info is secondary to media
      const { data: fetchedCourse, error } = await supabase.from('courses').select('title').eq('id', courseId).single();
      if (error) {
        console.error("Error fetching course title for live session:", error);
        setMediaError("Could not fetch course details for the session.");
      } else if (fetchedCourse) {
        setCourse({ title: fetchedCourse.title } as Course); // Minimal course object
      } else {
        setMediaError("Course not found for session.");
      }

    } catch (e) {
      setMediaError(e instanceof Error ? e.message : "Failed to load course details for session.");
      console.error(e);
    }
    setInitialLoading(false);
  }, [courseId, user, isAuthenticated]);

  useEffect(() => {
    fetchCourseDetails();
  }, [fetchCourseDetails]);

  useEffect(() => {
    if (!isAuthenticated || !user || !hasMadeInitialChoice) return;

    const manageStream = async () => {
      setIsLoadingMedia(true);
      setMediaError(null);

      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        setLocalStream(null);
      }

      try {
        const constraints: MediaStreamConstraints = { audio: true, video: desiredVideoStreamState };
        const newStream = await navigator.mediaDevices.getUserMedia(constraints);
        setLocalStream(newStream);

        const videoTracks = newStream.getVideoTracks();
        if (desiredVideoStreamState && videoTracks.length > 0) {
          videoTracks.forEach(track => track.enabled = true);
          setIsCameraEffectivelyOff(false);
        } else {
          videoTracks.forEach(track => track.enabled = false); // Ensure tracks are disabled if video is not desired or not found
          setIsCameraEffectivelyOff(true);
          if (desiredVideoStreamState && videoTracks.length === 0) {
            console.warn("Video stream desired, but no video tracks found.");
            // Optionally set a specific error or notification
          }
        }
        newStream.getAudioTracks().forEach(track => track.enabled = !micMutedRef.current);
        
      } catch (err) {
        console.error("Error accessing media devices.", err);
        let specificError = "Could not access media devices. Check permissions and ensure camera/microphone are available.";
        if (err instanceof Error) {
            if (err.name === "NotAllowedError") specificError = "Permission to use camera/microphone denied. Allow access in browser settings.";
            else if (err.name === "NotFoundError") specificError = "No camera/microphone found. Ensure they are connected.";
            else if (desiredVideoStreamState && (err.name === "ConstraintNotSatisfiedError" || err.name === "OverconstrainedError")) specificError = "Camera does not meet required constraints. Try audio-only.";
        }
        setMediaError(specificError);
        setLocalStream(null);
        setIsCameraEffectivelyOff(true);
      } finally {
        setIsLoadingMedia(false);
      }
    };

    manageStream();

    return () => {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isAuthenticated, user, hasMadeInitialChoice, desiredVideoStreamState]);

  const toggleMicrophone = () => {
    if (localStream) {
      const newMicMutedState = !isMicMuted;
      localStream.getAudioTracks().forEach(track => { track.enabled = !newMicMutedState; });
      setIsMicMuted(newMicMutedState);
    }
  };
  const toggleCamera = () => setDesiredVideoStreamState(prevState => !prevState);
  const handleLeaveSession = () => {
    if (localStream) localStream.getTracks().forEach(track => track.stop());
    setLocalStream(null); setHasMadeInitialChoice(false); 
    navigate(ROUTES.COURSE_DETAIL.replace(':courseId', courseId || ''));
  };

  if (initialLoading) {
    return <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center bg-gray-900 text-white transition-colors duration-300 ease-in-out"><LoadingSpinner /><p>Loading session details...</p></div>;
  }
  if (!isAuthenticated || !user) {
     return (
     <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center bg-gray-900 text-white p-4 transition-colors duration-300 ease-in-out">
       <UserCircleIcon className="w-16 h-16 text-yellow-400 mb-4"/>
       <h2 className="text-2xl font-semibold mb-4">Authentication Required</h2>
       <p className="mb-6 text-gray-300">Please log in to join the session.</p>
       <Button onClick={() => navigate(ROUTES.LOGIN)} variant="primary">Login</Button>
     </div> );
 }
  if (!hasMadeInitialChoice) { 
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-gray-800 text-white flex flex-col items-center justify-center p-4 transition-colors duration-300 ease-in-out">
        <h2 className="text-3xl font-bold mb-3">Joining: {course?.title || "Live Session"}</h2>
        <p className="text-lg text-gray-300 mb-8">How would you like to join?</p>
        {mediaError && !isLoadingMedia && <p className="text-red-400 mb-4 text-center bg-red-900/30 p-3 rounded-md">{mediaError}</p>}
        <div className="space-y-4 md:space-y-0 md:space-x-4 flex flex-col md:flex-row">
          <Button onClick={() => { setDesiredVideoStreamState(true); setHasMadeInitialChoice(true); setMediaError(null); }} variant="success" size="lg" className="flex items-center justify-center w-64"> <VideoCameraIcon className="w-6 h-6 mr-2" /> Join with Camera </Button>
          <Button onClick={() => { setDesiredVideoStreamState(false); setHasMadeInitialChoice(true); setMediaError(null);}} variant="primary" size="lg" className="flex items-center justify-center w-64"> <MicrophoneIcon className="w-6 h-6 mr-2" /> Join Audio Only </Button>
        </div>
        <Button variant="secondary" onClick={() => navigate(ROUTES.COURSE_DETAIL.replace(':courseId', courseId || ''))} className="mt-10"> Cancel and Go Back </Button>
      </div> );
  }
  if (isLoadingMedia) { 
    return <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center bg-gray-900 text-white transition-colors duration-300 ease-in-out"><LoadingSpinner /><p className="mt-3">Preparing your session...</p></div>;
  }
  if (mediaError && hasMadeInitialChoice && !localStream && !isLoadingMedia) { 
    return (
      <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center bg-gray-900 text-white p-4 transition-colors duration-300 ease-in-out">
        <ExclamationTriangleIcon className="w-16 h-16 text-red-500 mb-4"/>
        <h2 className="text-2xl font-semibold text-red-400 mb-4">Session Error</h2>
        <p className="mb-6 text-center text-gray-300">{mediaError}</p>
        <div className="space-x-4">
            <Button onClick={() => { setHasMadeInitialChoice(false); setMediaError(null); setDesiredVideoStreamState(false);}} variant="primary">Try Again</Button>
            <Button variant="secondary" onClick={() => navigate(ROUTES.COURSE_DETAIL.replace(':courseId', courseId || ''))}>Back to Course</Button>
        </div>
      </div> );
  }
  if (!course && !initialLoading && mediaError) { 
    return (
      <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center bg-gray-900 text-white p-4">
        <ExclamationTriangleIcon className="w-16 h-16 text-red-500 mb-4"/>
        <p className="text-red-400">{mediaError || "Failed to load course information for the session."}</p>
        <Button onClick={() => navigate(ROUTES.COURSE_LIST)} variant="secondary" className="mt-4">Browse Courses</Button>
      </div>
    );
  }


  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-800 text-white flex flex-col p-2 sm:p-4 transition-colors duration-300 ease-in-out">
      <header className="mb-4 px-2">
        <h1 className="text-xl sm:text-2xl font-bold truncate" title={course?.title}>Live Session: {course?.title || "Loading..."}</h1>
        <p className="text-sm text-gray-400">Joined as: {user?.username}</p>
        {mediaError && localStream && <p className="text-yellow-400 text-xs mt-1 bg-yellow-900/30 p-2 rounded">{mediaError}</p>}
      </header>

      <main className="flex-grow grid grid-cols-1 md:grid-cols-3 gap-2 sm:gap-4">
        <div className="md:col-span-2 h-[55vh] sm:h-[60vh] md:h-auto bg-gray-700 rounded-lg overflow-hidden">
          {localStream && !isCameraEffectivelyOff ? 
            <VideoPlayer stream={localStream} isLocal displayName={user?.username || "You"} /> : 
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <VideoCameraSlashIcon className="w-16 h-16 mb-2"/> 
              {isCameraEffectivelyOff && desiredVideoStreamState && localStream ? "Your camera is off or not sending video." : 
               isCameraEffectivelyOff && desiredVideoStreamState && !localStream ? "Attempting to start camera..." :
               isCameraEffectivelyOff && !desiredVideoStreamState ? "Camera is off by choice." :
               "Camera not active"}
            </div> }
        </div>
        <div className="grid grid-rows-3 gap-2 h-[30vh] sm:h-[35vh] md:h-auto md:flex md:flex-col">
          {[...Array(3)].map((_, index) => ( 
             <div key={`mock-participant-${index}`} className="bg-gray-700 rounded-lg overflow-hidden h-full">
              {(mockParticipantStreams[index] && mockParticipantStreams[index].getVideoTracks().some(t => t.enabled)) ? (
                 <VideoPlayer stream={mockParticipantStreams[index]} isMuted displayName={`Student ${index + 1}`} />
               ) : (
                 <div className="flex flex-col items-center justify-center h-full text-gray-500">
                   <VideoCameraSlashIcon className="w-8 h-8 mb-1"/> Student {index+1} (Cam Off)
                 </div>
               )}
            </div>
          ))}
        </div>
      </main>

      <footer className="mt-auto pt-4">
        <div className="flex justify-center items-center space-x-2 sm:space-x-3 p-3 bg-gray-700 backdrop-blur-sm rounded-xl shadow-lg max-w-xs sm:max-w-sm mx-auto">
          <Button onClick={toggleMicrophone} variant={isMicMuted ? "danger" : "secondary"} size="md" className="rounded-full p-2.5 sm:p-3" aria-label={isMicMuted ? "Unmute" : "Mute"} disabled={!localStream || isLoadingMedia}>
            <MicrophoneIcon className={`h-5 w-5 sm:h-6 sm:w-6 ${isMicMuted ? 'text-white': ''}`} /> 
          </Button>
          <Button onClick={toggleCamera} variant={isCameraEffectivelyOff && desiredVideoStreamState ? "secondary" : (isCameraEffectivelyOff ? "secondary" : "primary")} size="md" className="rounded-full p-2.5 sm:p-3" aria-label={isCameraEffectivelyOff ? "Turn On Cam" : "Turn Off Cam"} disabled={isLoadingMedia}>
            {isCameraEffectivelyOff ? <VideoCameraSlashIcon className="h-5 w-5 sm:h-6 sm:w-6" /> : <VideoCameraIcon className="h-5 w-5 sm:h-6 sm:w-6" />}
          </Button>
          <Button onClick={handleLeaveSession} variant="danger" size="md" className="rounded-full p-2.5 sm:p-3" aria-label="Leave Session" disabled={isLoadingMedia}>
            <ArrowLeftOnRectangleIcon className="h-5 w-5 sm:h-6 sm:w-6" />
          </Button>
        </div>
         <p className="text-center text-xs text-gray-500 mt-3">
            {APP_NAME} Live Session
        </p>
      </footer>
    </div>
  );
};

export default LiveSessionPage;
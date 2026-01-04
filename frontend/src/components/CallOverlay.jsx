import React, { useEffect, useRef, useState } from 'react';
import { Phone, Video, X, Mic, MicOff, Camera, CameraOff } from 'lucide-react';

const CallOverlay = ({ activeCall, onEndCall, socket, currentUser }) => {
    const [localStream, setLocalStream] = useState(null);
    const [remoteStream, setRemoteStream] = useState(null);
    const [isMuted, setIsMuted] = useState(false);
    const [isCameraOff, setIsCameraOff] = useState(false);
    const pcRef = useRef(null);
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);

    const iceServers = {
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    };

    useEffect(() => {
        const startCall = async () => {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: activeCall.type === 'video', 
                audio: true 
            });
            setLocalStream(stream);
            if (localVideoRef.current) localVideoRef.current.srcObject = stream;

            const pc = new RTCPeerConnection(iceServers);
            pcRef.current = pc;

            stream.getTracks().forEach(track => pc.addTrack(track, stream));

            pc.ontrack = (event) => {
                setRemoteStream(event.streams[0]);
                if (remoteVideoRef.current) remoteVideoRef.current.srcObject = event.streams[0];
            };

            pc.onicecandidate = (event) => {
                if (event.candidate) {
                    socket.send(JSON.stringify({
                        type: 'ice-candidate',
                        recipient_id: activeCall.partner_id,
                        data: event.candidate
                    }));
                }
            };

            if (activeCall.isInitiator) {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                socket.send(JSON.stringify({
                    type: 'call-offer',
                    recipient_id: activeCall.partner_id,
                    data: offer
                }));
            }
        };

        startCall();

        return () => {
            localStream?.getTracks().forEach(t => t.stop());
            pcRef.current?.close();
        };
    }, []);

    // Handle Incoming Signaling (simplified logic - in real app this would be triggered via props or event listener)
    useEffect(() => {
        const handleSignaling = async (msg) => {
            const pc = pcRef.current;
            if (!pc) return;

            if (msg.type === 'call-offer') {
                await pc.setRemoteDescription(new RTCSessionDescription(msg.data));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                socket.send(JSON.stringify({
                    type: 'call-answer',
                    recipient_id: msg.sender_id,
                    data: answer
                }));
            } else if (msg.type === 'call-answer') {
                await pc.setRemoteDescription(new RTCSessionDescription(msg.data));
            } else if (msg.type === 'ice-candidate') {
                await pc.addIceCandidate(new RTCIceCandidate(msg.data));
            }
        };

        // Note: For this to work well, we need to pass down signaling messages from the main socket listener
    }, []);

    return (
        <div className="fixed inset-0 z-50 bg-dark flex flex-col items-center justify-center text-white">
            <div className="relative w-full max-w-4xl h-full max-h-[80vh] bg-black rounded-xl overflow-hidden shadow-2xl">
                {/* Remote Video */}
                <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                
                {/* Local Video Preview */}
                <div className="absolute top-4 right-4 w-48 h-32 bg-gray-800 rounded-lg overflow-hidden border-2 border-primary shadow-lg">
                    <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                </div>

                {/* Info */}
                <div className="absolute top-8 left-8">
                    <h2 className="text-2xl font-bold">{activeCall.partner_name}</h2>
                    <p className="text-green-400">Ongoing {activeCall.type} call...</p>
                </div>

                {/* Controls */}
                <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center space-x-6">
                    <button 
                        onClick={() => setIsMuted(!isMuted)}
                        className={`p-4 rounded-full ${isMuted ? 'bg-red-500' : 'bg-gray-700/50 hover:bg-gray-600'} transition shadow-xl`}
                    >
                        {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
                    </button>
                    
                    <button 
                        onClick={onEndCall}
                        className="p-6 bg-red-600 rounded-full hover:bg-red-700 transition shadow-xl transform hover:scale-110"
                    >
                        <Phone className="rotate-[135deg]" size={32} />
                    </button>

                    <button 
                        onClick={() => setIsCameraOff(!isCameraOff)}
                        className={`p-4 rounded-full ${isCameraOff ? 'bg-red-500' : 'bg-gray-700/50 hover:bg-gray-600'} transition shadow-xl`}
                    >
                        {isCameraOff ? <CameraOff size={24} /> : <Camera size={24} />}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CallOverlay;

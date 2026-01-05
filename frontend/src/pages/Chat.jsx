import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, Send, MoreVertical, Phone, Video, Search, Plus, X, Paperclip, Image as ImageIcon, File as FileIcon, UserPlus, Users, Link as LinkIcon, Check, Settings, Shield, User as UserIcon, Trash2, LogOut as LeaveIcon, Camera, Edit2, Moon, Sun, Bell, BellOff, ArrowLeft, Smile, Mic, StopCircle, Play } from 'lucide-react';
import api from '../services/api';
import CallOverlay from '../components/CallOverlay';

const Chat = () => {
    const { user, logout } = useAuth();
    const [chats, setChats] = useState([]);
    const [activeChat, setActiveChat] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [showSearch, setShowSearch] = useState(false);
    const [usersList, setUsersList] = useState([]);
    const [activeCall, setActiveCall] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [isPartnerTyping, setIsPartnerTyping] = useState(false);
    const [onlineUsers, setOnlineUsers] = useState(new Set());
    const [notification, setNotification] = useState(null);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [showGroupModal, setShowGroupModal] = useState(false);
    const [showProfileSidebar, setShowProfileSidebar] = useState(false);
    const [showChatDetails, setShowChatDetails] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [groupName, setGroupName] = useState('');
    const [selectedMembers, setSelectedMembers] = useState([]);
    const [socialLoading, setSocialLoading] = useState(false);
    const [socialError, setSocialError] = useState('');
    const [socialSuccess, setSocialSuccess] = useState('');
    const [contacts, setContacts] = useState([]);
    const [showContacts, setShowContacts] = useState(false);
    const [profileForm, setProfileForm] = useState({ username: '', status_message: '', phone_number: '' });
    const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') === 'true');
    const [messageSearchTerm, setMessageSearchTerm] = useState('');
    const [showMessageSearch, setShowMessageSearch] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [notificationsEnabled, setNotificationsEnabled] = useState(true);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [showStickerPicker, setShowStickerPicker] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [audioBlob, setAudioBlob] = useState(null);
    const fileInputRef = useRef(null);
    const avatarInputRef = useRef(null);
    const socketRef = useRef(null);
    const messagesEndRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const recordingTimerRef = useRef(null);

    // Dark mode effect
    useEffect(() => {
        if (darkMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        localStorage.setItem('darkMode', darkMode);
    }, [darkMode]);

    // Initial data fetch
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [chatsRes, contactsRes] = await Promise.all([
                    api.get('/chat/'),
                    api.get('/social/list')
                ]);
                setChats(chatsRes.data);
                setContacts(contactsRes.data);
                if (user) {
                    setProfileForm({
                        username: user.username,
                        status_message: user.status_message || '',
                        phone_number: user.phone_number || ''
                    });
                }
            } catch (err) {
                console.error("Failed to fetch data", err);
            }
        };
        fetchData();
    }, [user]);

    // Fetch messages for active chat
    useEffect(() => {
        if (activeChat) {
            const fetchMessages = async () => {
                try {
                    const response = await api.get(`/chat/${activeChat.chat_id}/messages`);
                    setMessages(response.data);
                } catch (err) {
                    console.error("Failed to fetch messages", err);
                }
            };
            fetchMessages();
        }
    }, [activeChat]);

    // Mark as read when active chat changes
    useEffect(() => {
        if (activeChat && socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({ type: 'read', chat_id: activeChat.chat_id }));
        }
    }, [activeChat, messages.length]);

    // WebSocket Connection
    useEffect(() => {
        if (user?.user_id) {
            const wsUrl = `ws://localhost:8000/api/v1/chat/ws/${user.user_id}`;
            socketRef.current = new WebSocket(wsUrl);

            socketRef.current.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    
                    // Handle Signaling
                    if (['call-offer', 'call-answer', 'ice-candidate'].includes(data.type)) {
                        window.dispatchEvent(new CustomEvent('signaling', { detail: data }));
                        if (data.type === 'call-offer' && !activeCall) {
                            setActiveCall({
                                partner_id: data.sender_id,
                                partner_name: "Incoming Call...", // Should fetch name
                                type: 'video',
                                isInitiator: false
                            });
                        }
                    }

                    // Handle Messages
                    if (data.type === 'typing' && data.chat_id === activeChat?.chat_id) {
                        setIsPartnerTyping(data.is_typing);
                    }

                    if (data.type === 'status') {
                        setOnlineUsers((prev) => {
                            const next = new Set(prev);
                            if (data.status === 'online') next.add(data.user_id);
                            else next.delete(data.user_id);
                            return next;
                        });
                    }

                    if (data.type === 'read' && data.chat_id === activeChat?.chat_id) {
                        setMessages((prev) => prev.map(m => 
                            m.sender_id === user.user_id ? { ...m, status: 'read' } : m
                        ));
                    }

                    if (data.sender_id !== user.user_id && (data.type === 'text' || data.type === 'media')) {
                        if (data.chat_id === activeChat?.chat_id) {
                            setMessages((prev) => [...prev, data]);
                            setIsPartnerTyping(false);
                        } else {
                            // Show notification for other chats
                            const senderChat = chats.find(c => c.chat_id === data.chat_id);
                            setNotification({
                                chat_id: data.chat_id,
                                sender: senderChat?.name || "New Message",
                                content: data.content
                            });
                            setTimeout(() => setNotification(null), 3000);
                        }
                    }
                    
                    if (data.chat_id) {
                        setChats(prev => {
                            const newChats = [...prev];
                            const idx = newChats.findIndex(c => c.chat_id === data.chat_id);
                            if (idx !== -1) {
                                newChats[idx].preview = data.content;
                            }
                            return newChats;
                        });
                    }
                } catch (e) {
                    console.log("Not a JSON message or error:", event.data);
                }
            };

            return () => {
                socketRef.current.close();
            };
        }
    }, [user, activeChat, activeCall]);

    // Typing effect
    useEffect(() => {
        if (!socketRef.current || !activeChat || !newMessage) {
            if (activeChat && socketRef.current && !newMessage) {
                 socketRef.current.send(JSON.stringify({ type: 'typing', chat_id: activeChat.chat_id, is_typing: false }));
            }
            return;
        }

        const timer = setTimeout(() => {
            socketRef.current.send(JSON.stringify({ type: 'typing', chat_id: activeChat.chat_id, is_typing: true }));
        }, 300);

        return () => clearTimeout(timer);
    }, [newMessage, activeChat]);

    const sendMessage = (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !socketRef.current || !activeChat) return;

        const payload = {
            type: 'text',
            chat_id: activeChat.chat_id,
            content: newMessage
        };

        socketRef.current.send(JSON.stringify(payload));
        
        const optimisticMsg = {
            message_id: Date.now(),
            content: newMessage,
            sender_id: user.user_id,
            created_at: new Date().toISOString(),
            chat_id: activeChat.chat_id
        };
        setMessages((prev) => [...prev, optimisticMsg]);
        setNewMessage('');
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file || !activeChat) return;

        setIsUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await api.post('/media/upload', formData);
            const mediaUrl = response.data.url;
            
            const payload = {
                type: 'media',
                chat_id: activeChat.chat_id,
                content: `Sent a ${file.type.split('/')[0]}`,
                media_url: mediaUrl
            };

            socketRef.current.send(JSON.stringify(payload));

            setMessages((prev) => [...prev, {
                message_id: Date.now(),
                content: payload.content,
                media_url: mediaUrl,
                sender_id: user.user_id,
                created_at: new Date().toISOString(),
                chat_id: activeChat.chat_id
            }]);
        } catch (err) {
            console.error("Upload failed", err);
        } finally {
            setIsUploading(false);
        }
    };

    const startCall = async (type) => {
        try {
            // Fetch members for this chat to find the other person
            const response = await api.get(`/users/`); // Or a specific chat members endpoint
            const partner = response.data.find(u => u.user_id !== user.user_id); // Simple fallback
            
            setActiveCall({
                partner_id: partner?.user_id || (activeChat.created_by === user.user_id ? 2 : 1),
                partner_name: activeChat.name,
                type: type,
                isInitiator: true
            });
        } catch (err) {
            console.error("Failed to start call", err);
        }
    };

    const handleUpdateProfile = async (e) => {
        e.preventDefault();
        setSocialLoading(true);
        try {
            const response = await api.put('/users/me', profileForm);
            // In a real app, update global auth user context
            setSocialSuccess("Profile updated!");
            setTimeout(() => {
                setSocialSuccess('');
                setShowProfileSidebar(false);
            }, 1500);
        } catch (err) {
            setSocialError("Update failed");
        } finally {
            setSocialLoading(false);
        }
    };

    const handleCreateGroup = async (e) => {
        e.preventDefault();
        if (!groupName || selectedMembers.length === 0) return;
        setSocialLoading(true);
        try {
            const response = await api.post('/chat/create', {
                is_group: true,
                name: groupName,
                participant_ids: selectedMembers
            });
            setChats((prev) => [response.data, ...prev]);
            setActiveChat(response.data);
            setShowGroupModal(false);
            setGroupName('');
            setSelectedMembers([]);
        } catch (err) {
            setSocialError("Failed to create group");
        } finally {
            setSocialLoading(false);
        }
    };

    const toggleMemberSelection = (userId) => {
        setSelectedMembers(prev => 
            prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
        );
    };

    const handleAvatarUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const formData = new FormData();
        formData.append('file', file);
        
        try {
            const response = await api.post('/media/upload', formData);
            const avatarUrl = response.data.url;
            await api.put('/users/me', { avatar_url: avatarUrl });
            setProfileForm(prev => ({ ...prev, avatar_url: avatarUrl }));
            setSocialSuccess("Avatar updated!");
        } catch (err) {
            setSocialError("Failed to upload avatar");
        }
    };

    const filteredMessages = showMessageSearch && messageSearchTerm
        ? messages.filter(m => m.content?.toLowerCase().includes(messageSearchTerm.toLowerCase()))
        : messages;

    const requestNotificationPermission = async () => {
        if ('Notification' in window) {
            const permission = await Notification.requestPermission();
            setNotificationsEnabled(permission === 'granted');
        }
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            const chunks = [];

            mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
            mediaRecorder.onstop = () => {
                const blob = new Blob(chunks, { type: 'audio/webm' });
                setAudioBlob(blob);
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            setIsRecording(true);
            setRecordingTime(0);
            
            recordingTimerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        } catch (err) {
            alert('Microphone access denied or not available');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            clearInterval(recordingTimerRef.current);
        }
    };

    const sendVoiceNote = async () => {
        if (!audioBlob || !activeChat) return;
        
        const formData = new FormData();
        formData.append('file', audioBlob, 'voice-note.webm');
        
        try {
            const response = await api.post('/media/upload', formData);
            const audioUrl = response.data.url;
            
            await api.post('/chat/message', {
                chat_id: activeChat.chat_id,
                content: '🎤 Voice message',
                media_url: audioUrl
            });
            
            setAudioBlob(null);
            setRecordingTime(0);
        } catch (err) {
            alert('Failed to send voice note');
        }
    };

    const insertEmoji = (emoji) => {
        setNewMessage(prev => prev + emoji);
        setShowEmojiPicker(false);
    };

    const sendSticker = async (stickerUrl) => {
        if (!activeChat) return;
        
        try {
            await api.post('/chat/message', {
                chat_id: activeChat.chat_id,
                content: '🎨 Sticker',
                media_url: stickerUrl
            });
            setShowStickerPicker(false);
        } catch (err) {
            alert('Failed to send sticker');
        }
    };

    // Common emojis for quick access
    const quickEmojis = ['😀', '😂', '❤️', '👍', '🎉', '🔥', '✨', '👏', '💯', '🙌', '😍', '😊', '🤔', '😎', '🤩', '😢', '👋', '💪', '🎯', '⭐'];
    
    // Popular stickers (using emoji as simple stickers)
    const stickers = ['🎨', '🎭', '🎪', '🎬', '🎤', '🎧', '🎼', '🎹', '🥁', '🎺', '🎸', '🪕', '🎻', '🎲', '🎯', '🎳', '🎮'];


    const handleDeleteChat = async () => {
        if (!activeChat) return;
        if (!window.confirm("Are you sure you want to delete this chat?")) return;
        try {
            await api.delete(`/chat/${activeChat.chat_id}`);
            setChats(prev => prev.filter(c => c.chat_id !== activeChat.chat_id));
            setActiveChat(null);
            setShowChatDetails(false);
        } catch (err) {
            alert(err.response?.data?.detail || "Failed to delete chat");
        }
    };

    const handleLeaveChat = async () => {
        if (!activeChat) return;
        try {
            await api.post(`/chat/${activeChat.chat_id}/leave`);
            setChats(prev => prev.filter(c => c.chat_id !== activeChat.chat_id));
            setActiveChat(null);
            setShowChatDetails(false);
        } catch (err) {
            alert("Failed to leave chat");
        }
    };

    const handleSearchUsers = async () => {
        setShowSearch(true);
        setShowContacts(false);
        try {
            const response = await api.get('/users/');
            setUsersList(response.data);
        } catch (err) {
            console.error("Failed to fetch users", err);
        }
    };

    const handleInviteOrConnect = async (e) => {
        e.preventDefault();
        setSocialLoading(true);
        setSocialError('');
        setSocialSuccess('');
        try {
            const response = await api.post(`/social/add?friend_email=${inviteEmail}`);
            setSocialSuccess(response.data.message);
            // Refresh contacts
            const contactsRes = await api.get('/social/list');
            setContacts(contactsRes.data);
            setInviteEmail('');
        } catch (err) {
            setSocialError(err.response?.data?.detail || "User not found. Try inviting them!");
        } finally {
            setSocialLoading(false);
        }
    };

    const copyInviteLink = () => {
        const link = `${window.location.origin}/register?ref=${user.user_id}`;
        navigator.clipboard.writeText(link);
        setSocialSuccess("Link copied to clipboard!");
        setTimeout(() => setSocialSuccess(''), 2000);
    };

    const startNewChat = async (participant) => {
        try {
            const response = await api.post('/chat/create', {
                is_group: false,
                name: participant.username,
                participant_ids: [participant.user_id]
            });
            // Check if chat already exists in list
            setChats((prev) => {
                if (prev.find(c => c.chat_id === response.data.chat_id)) return prev;
                return [response.data, ...prev];
            });
            setActiveChat(response.data);
            setShowSearch(false);
            setShowContacts(false);
        } catch (err) {
            console.error("Failed to create chat", err);
        }
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    return (
        <div className={`flex h-screen overflow-hidden relative transition-colors ${darkMode ? 'dark bg-gray-900' : 'bg-gray-100'}`}>
            {notification && (
                <div 
                    onClick={() => {
                        const chat = chats.find(c => c.chat_id === notification.chat_id);
                        if (chat) setActiveChat(chat);
                        setNotification(null);
                    }}
                    className="absolute top-4 right-4 z-[60] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl rounded-lg p-4 flex items-center space-x-3 cursor-pointer animate-in fade-in slide-in-from-top-4"
                >
                    <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-bold">
                        {notification.sender.charAt(0)}
                    </div>
                    <div>
                        <h4 className="font-bold text-sm text-gray-800 dark:text-white">{notification.sender}</h4>
                        <p className="text-xs text-gray-600 dark:text-gray-400 truncate max-w-[200px]">{notification.content}</p>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); setNotification(null); }} className="text-gray-400 hover:text-gray-600 dark:hover:text-white">
                        <X size={16} />
                    </button>
                </div>
            )}
            
            {activeCall && (
                <CallOverlay 
                    activeCall={activeCall} 
                    onEndCall={() => setActiveCall(null)} 
                    socket={socketRef.current}
                    currentUser={user}
                />
            )}

            {/* Sidebar */}
            <div className="w-1/3 min-w-[350px] bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col relative">
                <div className="p-4 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                    <div className="flex items-center space-x-3">
                        <div 
                            onClick={() => setShowProfileSidebar(true)}
                            className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-bold cursor-pointer hover:ring-2 ring-primary ring-offset-2 transition-all shadow-md group"
                        >
                            <span className="group-hover:hidden">{user?.username?.charAt(0).toUpperCase()}</span>
                            <Edit2 size={16} className="hidden group-hover:block" />
                        </div>
                        <div>
                            <span className="font-semibold text-gray-800 block leading-tight">{user?.username}</span>
                            <span className="text-[10px] text-blue-600 font-bold uppercase tracking-wide">Online</span>
                        </div>
                    </div>
                    <div className="flex space-x-1">
                        <button onClick={() => setDarkMode(!darkMode)} className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition" title="Toggle Theme">
                            {darkMode ? <Sun size={20} /> : <Moon size={20} />}
                        </button>
                        <button onClick={() => setShowSettings(true)} className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition" title="Settings">
                            <Settings size={20} />
                        </button>
                        <button onClick={() => { setShowContacts(!showContacts); setShowSearch(false); }} className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition" title="Contacts"><Users size={20} className={showContacts ? 'text-primary' : ''} /></button>
                        <button onClick={() => setShowInviteModal(true)} className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition" title="Invite Friends"><UserPlus size={20} /></button>
                        <div className="relative group/new">
                            <button className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition" title="New Chat"><Plus size={20} /></button>
                            <div className="absolute top-10 right-0 w-40 bg-white dark:bg-gray-800 shadow-xl rounded-lg border border-gray-100 dark:border-gray-700 hidden group-hover/new:block z-50 py-1">
                                <button onClick={handleSearchUsers} className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm flex items-center text-gray-700 dark:text-gray-200"><UserIcon size={16} className="mr-2" /> Single Chat</button>
                                <button onClick={() => setShowGroupModal(true)} className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm flex items-center text-gray-700 dark:text-gray-200"><Users size={16} className="mr-2" /> New Group</button>
                            </div>
                        </div>
                        <button onClick={logout} title="Logout" className="p-2 text-gray-500 dark:text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition"><LogOut size={20} /></button>
                    </div>
                </div>

                {/* Settings Modal */}
                {showSettings && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] px-4">
                        <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95">
                            <div className="p-6 bg-primary text-white flex justify-between items-center">
                                <h3 className="text-xl font-bold">Settings</h3>
                                <button onClick={() => setShowSettings(false)}><X size={24} /></button>
                            </div>
                            
                            <div className="p-6 space-y-6">
                                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
                                    <div className="flex items-center space-x-3">
                                        {darkMode ? <Moon size={20} className="text-primary" /> : <Sun size={20} className="text-yellow-500" />}
                                        <span className="font-medium text-gray-700 dark:text-gray-200">Dark Mode</span>
                                    </div>
                                    <button 
                                        onClick={() => setDarkMode(!darkMode)}
                                        className={`w-12 h-6 rounded-full transition-colors ${darkMode ? 'bg-primary' : 'bg-gray-300'} relative`}
                                    >
                                        <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${darkMode ? 'translate-x-6' : 'translate-x-0.5'}`}></div>
                                    </button>
                                </div>

                                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
                                    <div className="flex items-center space-x-3">
                                        {notificationsEnabled ? <Bell size={20} className="text-primary" /> : <BellOff size={20} className="text-gray-400" />}
                                        <span className="font-medium text-gray-700 dark:text-gray-200">Notifications</span>
                                    </div>
                                    <button 
                                        onClick={requestNotificationPermission}
                                        className={`w-12 h-6 rounded-full transition-colors ${notificationsEnabled ? 'bg-primary' : 'bg-gray-300'} relative`}
                                    >
                                        <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${notificationsEnabled ? 'translate-x-6' : 'translate-x-0.5'}`}></div>
                                    </button>
                                </div>

                                <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
                                    <h4 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase mb-4">About</h4>
                                    <div className="text-center">
                                        <h5 className="text-2xl font-black text-gray-800 dark:text-white">CONVO</h5>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">Version 1.0.0</p>
                                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">Real-Time Conversations. Simplified.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Profile Sidebar */}
                {showProfileSidebar && (
                    <div className="absolute inset-0 bg-white dark:bg-gray-900 z-[80] flex flex-col animate-in slide-in-from-left">
                        <div className="p-4 bg-primary text-white flex items-center space-x-4">
                            <button onClick={() => setShowProfileSidebar(false)}><X size={24} /></button>
                            <h3 className="text-lg font-bold">Profile</h3>
                        </div>
                        <div className="p-8 flex flex-col items-center flex-1 overflow-y-auto">
                            <div className="relative mb-8">
                                {profileForm.avatar_url ? (
                                    <img 
                                        src={`http://localhost:8000${profileForm.avatar_url}`} 
                                        alt="Avatar" 
                                        className="w-40 h-40 rounded-full object-cover border-4 border-white shadow-xl"
                                    />
                                ) : (
                                    <div className="w-40 h-40 rounded-full bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center text-5xl font-bold text-white border-4 border-white shadow-xl">
                                        {profileForm.username?.charAt(0).toUpperCase() || '?'}
                                    </div>
                                )}
                                <input 
                                    type="file" 
                                    ref={avatarInputRef} 
                                    className="hidden" 
                                    accept="image/*"
                                    onChange={handleAvatarUpload} 
                                />
                                <button 
                                    onClick={() => avatarInputRef.current?.click()}
                                    className="absolute bottom-2 right-2 p-3 bg-primary text-white rounded-full shadow-lg hover:scale-110 transition"
                                >
                                    <Camera size={20} />
                                </button>
                            </div>

                            <form onSubmit={handleUpdateProfile} className="w-full space-y-6">
                                <div>
                                    <label className="block text-xs font-bold text-primary uppercase mb-2">Your Name</label>
                                    <input 
                                        type="text" 
                                        value={profileForm.username}
                                        onChange={(e) => setProfileForm({...profileForm, username: e.target.value})}
                                        className="w-full p-2 border-b-2 border-gray-100 dark:border-gray-700 dark:bg-transparent dark:text-white focus:border-primary outline-none transition font-medium"
                                    />
                                    <p className="text-[11px] text-gray-400 mt-2">This is not your username or PIN. This name will be visible to your CONVO contacts.</p>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-primary uppercase mb-2">About</label>
                                    <input 
                                        type="text" 
                                        value={profileForm.status_message}
                                        placeholder="Hey there! I am using CONVO."
                                        onChange={(e) => setProfileForm({...profileForm, status_message: e.target.value})}
                                        className="w-full p-2 border-b-2 border-gray-100 dark:border-gray-700 dark:bg-transparent dark:text-white focus:border-primary outline-none transition"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-primary uppercase mb-2">Phone Number</label>
                                    <input 
                                        type="text" 
                                        value={profileForm.phone_number}
                                        onChange={(e) => setProfileForm({...profileForm, phone_number: e.target.value})}
                                        className="w-full p-2 border-b-2 border-gray-100 dark:border-gray-700 dark:bg-transparent dark:text-white focus:border-primary outline-none transition"
                                    />
                                </div>

                                <button 
                                    type="submit"
                                    disabled={socialLoading}
                                    className="w-full py-3 bg-primary text-white rounded-xl font-bold shadow-lg hover:shadow-primary/20 transition disabled:opacity-50 mt-4"
                                >
                                    {socialLoading ? 'Updating...' : 'Save Changes'}
                                </button>
                                {socialSuccess && <p className="text-blue-600 text-center text-sm">{socialSuccess}</p>}
                                {socialError && <p className="text-red-500 text-center text-sm">{socialError}</p>}
                            </form>
                        </div>
                    </div>
                )}

                {/* New Group Modal */}
                {showGroupModal && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] px-4">
                        <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95">
                            <div className="p-6 bg-primary text-white flex justify-between items-center">
                                <h3 className="text-xl font-bold">New Group</h3>
                                <button onClick={() => setShowGroupModal(false)}><X size={24} /></button>
                            </div>
                            
                            <form onSubmit={handleCreateGroup} className="p-6">
                                <div className="mb-6">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Group Subject</label>
                                    <input 
                                        type="text" 
                                        value={groupName}
                                        onChange={(e) => setGroupName(e.target.value)}
                                        placeholder="Enter group name"
                                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary outline-none transition"
                                        required
                                    />
                                </div>

                                <div className="mb-6">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Add Members ({selectedMembers.length})</label>
                                    <div className="max-h-60 overflow-y-auto border border-gray-100 rounded-xl bg-gray-50">
                                        {contacts.map(c => (
                                            <div 
                                                key={c.user_id}
                                                onClick={() => toggleMemberSelection(c.user_id)}
                                                className={`flex items-center p-3 cursor-pointer hover:bg-white transition-colors border-b border-gray-100 last:border-0`}
                                            >
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 mr-3 transition-all ${selectedMembers.includes(c.user_id) ? 'bg-primary border-primary text-white' : 'bg-white border-gray-200 text-gray-400'}`}>
                                                    {selectedMembers.includes(c.user_id) ? <Check size={20} /> : c.username.charAt(0).toUpperCase()}
                                                </div>
                                                <span className="font-medium text-gray-700">{c.username}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <button 
                                    type="submit"
                                    disabled={socialLoading || !groupName || selectedMembers.length === 0}
                                    className="w-full py-4 bg-primary text-white rounded-xl font-bold shadow-lg hover:bg-blue-700 transition disabled:opacity-50"
                                >
                                    {socialLoading ? 'Creating...' : 'Create Group'}
                                </button>
                            </form>
                        </div>
                    </div>
                )}

                {/* Invite Modal */}
                {showInviteModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] px-4">
                        <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold text-gray-800">Invite Friends</h3>
                                <button onClick={() => { setShowInviteModal(false); setSocialError(''); setSocialSuccess(''); }} className="text-gray-400 hover:text-gray-600">
                                    <X size={24} />
                                </button>
                            </div>
                            
                            <p className="text-gray-600 text-sm mb-6">
                                Connect with your friends on CONVO by entering their email or sharing an invite link.
                            </p>

                            <form onSubmit={handleInviteOrConnect} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                                    <div className="relative">
                                        <input 
                                            type="email" 
                                            value={inviteEmail}
                                            onChange={(e) => setInviteEmail(e.target.value)}
                                            placeholder="friend@example.com"
                                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition"
                                            required
                                        />
                                        <button 
                                            type="submit"
                                            disabled={socialLoading}
                                            className="absolute right-2 top-1.5 bg-primary text-white px-4 py-1.5 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50"
                                        >
                                            {socialLoading ? '...' : 'Connect'}
                                        </button>
                                    </div>
                                </div>
                            </form>

                            {socialError && <p className="text-red-500 text-sm mt-2">{socialError}</p>}
                            {socialSuccess && <p className="text-blue-600 text-sm mt-2 flex items-center"><Check size={16} className="mr-1" /> {socialSuccess}</p>}

                            <div className="mt-8 pt-6 border-t border-gray-100 text-center">
                                <span className="text-xs text-gray-400 uppercase tracking-widest font-semibold block mb-4">Or Share Link</span>
                                <button 
                                    onClick={copyInviteLink}
                                    className="flex items-center justify-center space-x-2 w-full p-3 bg-gray-50 rounded-xl border border-dashed border-gray-300 hover:border-primary hover:bg-blue-50 transition group"
                                >
                                    <LinkIcon size={18} className="text-gray-400 group-hover:text-primary" />
                                    <span className="text-sm font-medium text-gray-700 group-hover:text-primary">Copy Personal Invite Link</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {showSearch ? (
                    <div className="flex flex-col flex-1">
                        <div className="p-3 bg-white border-bottom flex items-center justify-between">
                            <h3 className="font-bold text-gray-700">Explore Users</h3>
                            <button onClick={() => setShowSearch(false)}><X size={20} /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            {usersList.length > 0 ? usersList.map((u) => (
                                <div key={u.user_id} 
                                     onClick={() => startNewChat(u)}
                                     className="flex items-center p-4 hover:bg-gray-50 cursor-pointer border-b border-gray-100">
                                    <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center mr-3 text-white font-bold">
                                        {u.username.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1">
                                        <span className="font-medium block">{u.username}</span>
                                        <span className="text-xs text-gray-500">{u.email}</span>
                                    </div>
                                </div>
                            )) : (
                                <div className="p-10 text-center text-gray-400">
                                    <p>No users found yet.</p>
                                </div>
                            )}
                        </div>
                    </div>
                ) : showContacts ? (
                    <div className="flex flex-col flex-1 scale-in-center">
                        <div className="p-3 bg-white border-bottom flex items-center justify-between">
                            <h3 className="font-bold text-gray-700">My Contacts</h3>
                            <button onClick={() => setShowContacts(false)}><X size={20} /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            {contacts.length > 0 ? contacts.map((u) => (
                                <div key={u.user_id} 
                                     onClick={() => startNewChat(u)}
                                     className="flex items-center p-4 hover:bg-gray-50 cursor-pointer border-b border-gray-100">
                                    <div className="relative">
                                        <div className="w-11 h-11 rounded-full bg-blue-100 flex items-center justify-center mr-3 text-primary font-bold">
                                            {u.username.charAt(0).toUpperCase()}
                                        </div>
                                        {onlineUsers.has(u.user_id) && (
                                            <div className="absolute bottom-0 right-3 w-3 h-3 bg-blue-500 border-2 border-white rounded-full"></div>
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <span className="font-medium block">{u.username}</span>
                                        <span className="text-xs text-gray-500">{u.status_message || "Hey there! I am using CONVO."}</span>
                                    </div>
                                </div>
                            )) : (
                                <div className="p-10 text-center text-gray-400">
                                    <Users size={48} className="mx-auto mb-4 opacity-20" />
                                    <p>You haven't added any contacts yet.</p>
                                    <button 
                                        onClick={() => setShowInviteModal(true)}
                                        className="mt-4 text-primary font-bold hover:underline"
                                    >
                                        Invite Friends
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="p-3">
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                                <input 
                                    type="text" 
                                    placeholder="Search or start new chat" 
                                    className="w-full pl-10 pr-4 py-2 bg-gray-100 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary text-sm transition-all" 
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto">
                            {chats.filter(c => c.name?.toLowerCase().includes(searchTerm.toLowerCase())).length > 0 ? (
                                chats.filter(c => c.name?.toLowerCase().includes(searchTerm.toLowerCase())).map((chat) => (
                                    <div 
                                        key={chat.chat_id} 
                                        onClick={() => setActiveChat(chat)}
                                        className={`flex items-center p-4 cursor-pointer hover:bg-gray-50 border-b border-gray-100 transition-colors ${activeChat?.chat_id === chat.chat_id ? 'bg-gray-100' : ''}`}
                                    >
                                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center mr-3 text-lg font-bold text-white shadow-sm">
                                            {chat.name?.charAt(0).toUpperCase() || 'C'}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-baseline">
                                                <h3 className="font-semibold text-gray-800 truncate">{chat.name}</h3>
                                                <span className="text-[10px] text-gray-500 min-w-max ml-2">
                                                    {chat.last_message_time ? new Date(chat.last_message_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '12:00'}
                                                </span>
                                            </div>
                                            <p className="text-sm text-gray-600 truncate">{chat.preview || "No messages yet"}</p>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="p-10 text-center text-gray-400">
                                    <p>No recent chats.</p>
                                    <button onClick={handleSearchUsers} className="text-primary font-semibold mt-2">Find someone to talk to</button>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* Chat Area */}
            <div className="flex-1 flex flex-col bg-[#efeae2] dark:bg-gray-950 relative">
                {activeChat ? (
                    <>
                        {showMessageSearch ? (
                            <div className="p-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center space-x-3 shadow-sm z-10">
                                <button onClick={() => { setShowMessageSearch(false); setMessageSearchTerm(''); }} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white">
                                    <ArrowLeft size={20} />
                                </button>
                                <div className="flex-1 relative">
                                    <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                                    <input 
                                        type="text" 
                                        value={messageSearchTerm}
                                        onChange={(e) => setMessageSearchTerm(e.target.value)}
                                        placeholder="Search messages..." 
                                        autoFocus
                                        className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-700 dark:text-white rounded-xl focus:outline-none focus:ring-1 focus:ring-primary text-sm transition-all"
                                    />
                                </div>
                                {messageSearchTerm && (
                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                        {filteredMessages.length} found
                                    </span>
                                )}
                            </div>
                        ) : (
                            <div className="p-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center shadow-sm z-10">
                                 <div 
                                    onClick={() => setShowChatDetails(true)}
                                    className="flex items-center space-x-3 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 p-1 px-2 rounded-lg transition"
                                 >
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center font-bold text-white shadow-sm">
                                        {activeChat.name?.charAt(0).toUpperCase() || 'C'}
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="font-semibold text-gray-800 dark:text-white truncate max-w-[200px]">{activeChat.name}</h3>
                                        {isPartnerTyping ? (
                                            <span className="text-xs text-primary font-medium italic animate-pulse">typing...</span>
                                        ) : (
                                            <span className={`text-[11px] ${onlineUsers.has(activeChat.created_by === user.user_id ? 2 : 1) ? 'text-blue-600 font-bold' : 'text-gray-400'} uppercase tracking-tight`}>
                                                {onlineUsers.has(activeChat.created_by === user.user_id ? 2 : 1) ? 'Online' : 'Offline'}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex space-x-5 text-gray-500 dark:text-gray-400 px-4 items-center">
                                     <Search className="cursor-pointer hover:text-primary transition" size={20} onClick={() => setShowMessageSearch(true)} />
                                     <Phone className="cursor-pointer hover:text-primary transition" size={20} onClick={() => startCall('voice')} />
                                     <Video className="cursor-pointer hover:text-primary transition" size={20} onClick={() => startCall('video')} />
                                     <div className="w-[1px] h-6 bg-gray-200 dark:bg-gray-600 mx-1"></div>
                                     <button onClick={() => setShowChatDetails(true)} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition">
                                        <MoreVertical size={20} />
                                     </button>
                                </div>
                            </div>
                        )}

                        {/* Chat Details Sidebar */}
                        {showChatDetails && (
                            <div className="absolute top-0 right-0 w-80 h-full bg-white dark:bg-gray-900 z-[70] shadow-2xl border-l border-gray-200 dark:border-gray-700 flex flex-col animate-in slide-in-from-right overflow-hidden">
                                <div className="p-4 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center space-x-4">
                                    <button onClick={() => { setShowChatDetails(false); setShowMessageSearch(false); }} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white"><X size={24} /></button>
                                    <h3 className="font-bold text-gray-800 dark:text-white">Chat Info</h3>
                                </div>
                                <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center">
                                    <div className="w-32 h-32 rounded-full bg-primary/10 flex items-center justify-center text-4xl font-bold text-primary mb-4 shadow-inner">
                                        {activeChat.name?.charAt(0).toUpperCase()}
                                    </div>
                                    <h4 className="text-xl font-bold text-gray-800 dark:text-white mb-1">{activeChat.name}</h4>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">{activeChat.is_group ? "Group Chat" : "Private Chat"}</p>

                                    <div className="w-full space-y-4">
                                        <button 
                                            onClick={() => { setShowMessageSearch(!showMessageSearch); setShowChatDetails(false); }}
                                            className="flex items-center space-x-4 w-full p-4 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl transition text-gray-700 dark:text-gray-300 font-medium"
                                        >
                                            <Search size={20} className="text-gray-400" />
                                            <span>Search Messages</span>
                                        </button>
                                        <button className="flex items-center space-x-4 w-full p-4 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl transition text-gray-700 dark:text-gray-300 font-medium">
                                            <ImageIcon size={20} className="text-gray-400" />
                                            <span>Media, Links and Docs</span>
                                        </button>
                                        <button className="flex items-center space-x-4 w-full p-4 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl transition text-gray-700 dark:text-gray-300 font-medium">
                                            <Shield size={20} className="text-gray-400" />
                                            <span>Encryption</span>
                                        </button>
                                        
                                        <div className="pt-4 mt-4 border-t border-gray-100 dark:border-gray-700">
                                            {activeChat.is_group ? (
                                                <button 
                                                    onClick={handleLeaveChat}
                                                    className="flex items-center space-x-4 w-full p-4 hover:bg-red-50 rounded-xl transition text-red-500 font-bold"
                                                >
                                                    <LeaveIcon size={20} />
                                                    <span>Exit Group</span>
                                                </button>
                                            ) : (
                                                <button 
                                                    onClick={handleDeleteChat}
                                                    className="flex items-center space-x-4 w-full p-4 hover:bg-red-50 rounded-xl transition text-red-500 font-bold"
                                                >
                                                    <Trash2 size={20} />
                                                    <span>Delete Chat</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[#efeae2] dark:bg-gray-950 scrollbar-thin">
                            {filteredMessages.map((msg) => (
                                <div key={msg.message_id} className={`flex ${msg.sender_id === user.user_id ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[75%] md:max-w-md p-2.5 rounded-xl shadow-sm relative group/msg ${msg.sender_id === user.user_id ? 'bg-[#d9fdd3] dark:bg-[#005c4b] rounded-tr-none' : 'bg-white dark:bg-gray-800 rounded-tl-none'}`}>
                                        {activeChat.is_group && msg.sender_id !== user.user_id && (
                                            <span className="text-[11px] font-bold text-primary block mb-1">User #{msg.sender_id}</span>
                                        )}
                                        {msg.media_url ? (
                                            msg.media_url.match(/\.(jpg|jpeg|png|gif)$/i) ? (
                                                <div className="relative overflow-hidden rounded-lg mb-1 shadow-inner">
                                                    <img src={`http://localhost:8000${msg.media_url}`} alt="sent" className="w-full object-cover max-h-80" />
                                                </div>
                                            ) : (
                                                <div className="flex items-center space-x-3 p-3 bg-black/5 dark:bg-white/10 rounded-lg mb-2 border border-black/5 dark:border-white/10">
                                                    <div className="w-10 h-10 bg-white dark:bg-gray-700 rounded flex items-center justify-center shadow-sm">
                                                        <FileIcon size={20} className="text-primary" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-bold text-gray-700 dark:text-gray-200 truncate">Document</p>
                                                        <a href={`http://localhost:8000${msg.media_url}`} target="_blank" rel="noreferrer" className="text-primary text-[10px] uppercase font-bold hover:underline">Download</a>
                                                    </div>
                                                </div>
                                            )
                                        ) : null}
                                        <p className="text-[14px] leading-relaxed text-gray-800 dark:text-gray-100 break-words whitespace-pre-wrap">{msg.content}</p>
                                        <div className="flex items-center justify-end space-x-1.5 mt-0.5">
                                            <span className="text-[9px] text-gray-500 dark:text-gray-400 font-medium">
                                                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                            {msg.sender_id === user.user_id && (
                                                <span className={`text-[12px] ${msg.status === 'read' ? 'text-blue-500' : 'text-gray-400'}`}>
                                                    {msg.status === 'read' ? '✓✓' : '✓'}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>

                        <div className="p-3 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 relative">
                            {/* Emoji Picker */}
                            {showEmojiPicker && (
                                <div className="absolute bottom-20 left-4 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 p-4 z-50 w-80 animate-in slide-in-from-bottom-4">
                                    <div className="flex justify-between items-center mb-3">
                                        <h3 className="font-bold text-gray-800 dark:text-white">Emojis</h3>
                                        <button onClick={() => setShowEmojiPicker(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white">
                                            <X size={18} />
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-8 gap-2 max-h-64 overflow-y-auto">
                                        {quickEmojis.map((emoji, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => insertEmoji(emoji)}
                                                className="text-2xl hover:scale-125 transition p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                                            >
                                                {emoji}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Sticker Picker */}
                            {showStickerPicker && (
                                <div className="absolute bottom-20 left-4 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 p-4 z-50 w-64 animate-in slide-in-from-bottom-4">
                                    <div className="flex justify-between items-center mb-3">
                                        <h3 className="font-bold text-gray-800 dark:text-white">Stickers</h3>
                                        <button onClick={() => setShowStickerPicker(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white">
                                            <X size={18} />
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-5 gap-2 max-h-64 overflow-y-auto">
                                        {stickers.map((sticker, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => sendSticker(sticker)}
                                                className="text-3xl hover:scale-110 transition p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                                            >
                                                {sticker}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Voice Recording Preview */}
                            {audioBlob && (
                                <div className="mb-3 p-3 bg-primary/10 rounded-xl flex items-center justify-between">
                                    <div className="flex items-center space-x-3">
                                        <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                                            <Play size={20} className="text-white" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-gray-800 dark:text-white">Voice Note Ready</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">{recordingTime}s</p>
                                        </div>
                                    </div>
                                    <div className="flex space-x-2">
                                        <button onClick={sendVoiceNote} className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-bold">
                                            Send
                                        </button>
                                        <button onClick={() => setAudioBlob(null)} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-white rounded-lg text-sm font-bold">
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            )}

                            <form onSubmit={sendMessage} className="flex items-center space-x-3 px-2">
                                <div className="flex space-x-1">
                                    <button 
                                        type="button" 
                                        onClick={() => {setShowEmojiPicker(!showEmojiPicker); setShowStickerPicker(false);}}
                                        className={`p-2.5 ${showEmojiPicker ? 'text-primary bg-primary/10' : 'text-gray-500 dark:text-gray-400'} hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition`}
                                        title="Emojis"
                                    >
                                        <Smile size={24} />
                                    </button>
                                    <button 
                                        type="button" 
                                        onClick={() => fileInputRef.current?.click()}
                                        className="p-2.5 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition"
                                        title="Attach File"
                                    >
                                        <Paperclip size={24} />
                                    </button>
                                    <button 
                                        type="button" 
                                        onClick={() => {setShowStickerPicker(!showStickerPicker); setShowEmojiPicker(false);}}
                                        className={`p-2.5 ${showStickerPicker ? 'text-primary bg-primary/10' : 'text-gray-500 dark:text-gray-400'} hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition`}
                                        title="Stickers"
                                    >
                                        <ImageIcon size={24} />
                                    </button>
                                </div>
                                <input 
                                    type="file" 
                                    ref={fileInputRef} 
                                    className="hidden" 
                                    onChange={handleFileUpload} 
                                />
                                <div className="flex-1 relative">
                                    {isRecording ? (
                                        <div className="flex items-center space-x-3 px-5 py-3 bg-red-50 dark:bg-red-900/20 rounded-2xl">
                                            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                                            <span className="text-sm font-bold text-red-600 dark:text-red-400">Recording... {recordingTime}s</span>
                                        </div>
                                    ) : (
                                        <input 
                                            type="text" 
                                            value={newMessage}
                                            onChange={(e) => setNewMessage(e.target.value)}
                                            placeholder="Type a message..." 
                                            className="w-full p-3 px-5 bg-gray-50 dark:bg-gray-700 dark:text-white rounded-2xl focus:outline-none focus:ring-1 focus:ring-primary/20 text-sm transition-all"
                                        />
                                    )}
                                </div>
                                
                                {isRecording ? (
                                    <button 
                                        type="button"
                                        onClick={stopRecording}
                                        className="p-3 bg-red-500 text-white rounded-full hover:bg-red-600 transition shadow-lg"
                                    >
                                        <StopCircle size={20} fill="currentColor" />
                                    </button>
                                ) : newMessage.trim() ? (
                                    <button 
                                        type="submit" 
                                        className="p-3 bg-primary text-white rounded-full hover:bg-blue-700 transition shadow-lg"
                                    >
                                        <Send size={20} fill="currentColor" />
                                    </button>
                                ) : (
                                    <button 
                                        type="button"
                                        onClick={startRecording}
                                        className="p-3 bg-primary text-white rounded-full hover:bg-blue-700 transition shadow-lg"
                                        title="Record Voice Note"
                                    >
                                        <Mic size={20} />
                                    </button>
                                )}
                            </form>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400 bg-[#f8f9fa] dark:bg-gray-900 border-l border-gray-100 dark:border-gray-800">
                        <div className="w-40 h-40 bg-white dark:bg-gray-800 shadow-xl rounded-full flex items-center justify-center mb-8 animate-bounce transition-all">
                             <span className="text-7xl">💬</span>
                        </div>
                        <h2 className="text-4xl font-black text-gray-800 dark:text-white mb-3 tracking-tight">CONVO <span className="text-primary font-light">Web</span></h2>
                        <p className="text-center max-w-sm text-gray-500 dark:text-gray-400 font-medium">
                            End-to-end encrypted messaging for your desktop.
                            Start by selecting a chat or adding a new friend.
                        </p>
                        <div className="mt-12 flex space-x-4">
                            <button onClick={handleSearchUsers} className="px-6 py-2 bg-primary text-white rounded-full font-bold shadow-lg hover:scale-105 transition">Discover People</button>
                            <button onClick={() => setShowInviteModal(true)} className="px-6 py-2 bg-white dark:bg-gray-800 text-primary rounded-full font-bold shadow-lg hover:scale-105 transition border border-primary/20">Invite Friends</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Chat;

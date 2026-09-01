import { useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { chatAPI, callsAPI, reviewsAPI, paymentsAPI } from "../api";
import { Paperclip, Mic, MicOff, Video, VideoOff, PhoneOff, Send, Star } from "lucide-react";
import { initDB, saveCallLog, getMediaForConversation } from "../services/chatMediaStore";
import DocumentPicker from "../components/chat/DocumentPicker";
import { continueToPaymentGateway } from "../services/paymentGateway";

export default function Chat() {
  const { user, token } = useAuth();
  const [searchParams] = useSearchParams();
  const [conversations, setConversations] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [wsStatus, setWsStatus] = useState("connecting");
  const [manualPresenceOnline, setManualPresenceOnline] = useState(() => localStorage.getItem("rozgar_presence_online") !== "false");
  const wsRef = useRef(null);
  const messagesEndRef = useRef(null);
  
  // ==========================================
  // REAL-TIME CALLING STATE HOOKS & REFS
  // ==========================================
  const [callStatus, setCallStatus] = useState("idle"); // "idle" | "dialing" | "ringing" | "connected"
  const [isIncoming, setIsIncoming] = useState(false);
  const [activeCallSession, setActiveCallSession] = useState(null);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnection = useRef(null);
  const localStreamRef = useRef(null);
  const callStartRef = useRef(null);
  const recorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const voiceStreamRef = useRef(null);
  const recordStartedAtRef = useRef(null);
  const [recording, setRecording] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  
  // ==========================================
  // STAGED MEDIA STATE
  // ==========================================
  const [stagedFile, setStagedFile] = useState(null);
  const [stagedAudio, setStagedAudio] = useState(null);
  const recordIntervalRef = useRef(null);
  const [recordTimer, setRecordTimer] = useState(0);
  const [selectedDeleteMessageId, setSelectedDeleteMessageId] = useState(null);
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const longPressRef = useRef(null);

  // ==========================================
  // WORK COMPLETION + FIVE-STAR RATING STATE
  // ==========================================
  const [ratingOverlay, setRatingOverlay] = useState({ open: false, jobId: null, workerId: null, workerName: "" });
  const [ratingValue, setRatingValue] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [ratingToast, setRatingToast] = useState(null);
  const [completedJobs, setCompletedJobs] = useState([]); // track jobs marked completed in UI
  const [markingJobId, setMarkingJobId] = useState(null);
  const [paymentDrawer, setPaymentDrawer] = useState({ open: false, jobId: null, loading: false });

  // Convert File to Base64 String to transmit entirely through WebSocket safely.
const encodeFileToBase64 = (fileOrBlob) => {
  return new Promise((resolve, reject) => {
    // 5MB Limit rule
    if (fileOrBlob.size > 5 * 1024 * 1024) {
      reject(new Error("File size exceeds 5MB limit for real-time delivery."));
      return;
    }
    const reader = new FileReader();
    reader.readAsDataURL(fileOrBlob);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
  });
};

  // Initialize local IndexedDB and helpers for converting stored media into
  // message-like objects that can be merged with server-backed messages.
  const convertStoredItemToMessage = (item) => {
    if (!item) return null;
    // Voice messages from IndexedDB
    if (item.audio_blob) {
      return {
        id: item.id || `local-voice-${Date.now()}-${Math.random().toString(36).slice(2,9)}`,
        sender_id: item.sender_id,
        receiver_id: item.receiver_id,
        content: null,
        file_url: null,
        file_type: item.file_type || "audio/webm",
        metadata: { filename: item.file_name || null, duration_seconds: item.duration_seconds || null },
        local_blob: item.audio_blob,
        local: true,
        media_type: "voice",
        timestamp: item.timestamp || new Date().toISOString(),
        is_sent: item.is_sent ?? true,
      };
    }

    // Document messages from IndexedDB
    if (item.file_blob) {
      return {
        id: item.id || `local-doc-${Date.now()}-${Math.random().toString(36).slice(2,9)}`,
        sender_id: item.sender_id,
        receiver_id: item.receiver_id,
        content: null,
        file_url: null,
        file_type: item.file_type || null,
        metadata: { filename: item.file_name || null, file_size: item.file_size || null },
        local_blob: item.file_blob,
        local: true,
        media_type: "document",
        timestamp: item.timestamp || new Date().toISOString(),
        is_sent: item.is_sent ?? true,
      };
    }

    // Call logs
    if (item.call_type) {
      return {
        id: item.id || `call-${Date.now()}`,
        sender_id: item.caller_id,
        receiver_id: item.receiver_id,
        content: null,
        file_url: null,
        file_type: null,
        metadata: { call_type: item.call_type, status: item.status, duration_seconds: item.duration_seconds },
        local: true,
        media_type: "call_log",
        timestamp: item.timestamp || new Date().toISOString(),
      };
    }

    return null;
  };

  const canSend = newMsg.trim().length > 0 || stagedFile || stagedAudio;

  // Unified long-press (1s) handlers for mouse & touch
  const startPress = (e, msgId) => {
    // Prevent default context menus or scrolling artifacts on touch
    try {
      if (e && e.type && e.type.startsWith("touch")) e.preventDefault();
    } catch (err) { /* ignore */ }

    if (longPressRef.current) clearTimeout(longPressRef.current);
    longPressRef.current = setTimeout(() => {
      setDeleteTargetId(msgId);
      setSelectedDeleteMessageId(msgId);
    }, 1000); // Strict 1-second long-press threshold
  };

  const cancelPress = () => {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  };

  // Load conversations
  useEffect(() => {
    const loadConversations = async () => {
      try {
        const res = await chatAPI.getConversations(true);
        setConversations(res.data);

        const targetUserId = searchParams.get("userId");
        if (targetUserId) {
          const conv = res.data.find((c) => c.user_id === Number(targetUserId));
          if (conv) {
            setSelectedUser(conv);
            const historyRes = await chatAPI.getChatHistory(conv.user_id);
            const serverMessages = historyRes.data || [];
            let localMessages = [];
            try {
              await initDB();
              const mediaItems = await getMediaForConversation(conv.user_id);
              localMessages = (mediaItems || []).map(convertStoredItemToMessage).filter(Boolean);
            } catch (e) {
              localMessages = [];
            }

            // Merge server text messages with locally-stored media, sort by timestamp
            const merged = [...serverMessages, ...localMessages].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            setMessages(merged);
          }
        }
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    };
    loadConversations();
  }, [searchParams]);

  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setAudioEnabled(audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setVideoEnabled(videoTrack.enabled);
      }
    }
  };

  // Inject a centered system event message into the chat history
  const injectSystemMessage = useCallback((text) => {
    const sysMsg = {
      id: `sys-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
      is_system: true,
      content: text,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, sysMsg]);
  }, []);

  // Cleanup media tracks safely helper
  const endCallSession = useCallback((missed = false) => {
    const wasVideo = !!(localStreamRef.current && localStreamRef.current.getVideoTracks().length);
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }
    // Inject call-end system notification
    if (missed) {
      injectSystemMessage("❌ Missed video call");
    } else if (callStartRef.current) {
      const elapsed = Math.max(0, Math.round((Date.now() - callStartRef.current) / 1000));
      const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
      const ss = String(elapsed % 60).padStart(2, '0');
      injectSystemMessage(`📞 Video call ended — ${mm}:${ss}`);
      // Save call log to local IndexedDB (non-blocking)
      try {
        if (selectedUser) {
          const callLog = {
            id: (crypto && crypto.randomUUID) ? crypto.randomUUID() : `call-${Date.now()}-${Math.random().toString(36).slice(2,9)}`,
            conversation_id: selectedUser.user_id,
            caller_id: user.id,
            receiver_id: selectedUser.user_id,
            call_type: wasVideo ? 'video' : 'audio',
            status: 'completed',
            duration_seconds: elapsed,
            timestamp: new Date().toISOString(),
          };
          saveCallLog(callLog).catch((e) => console.error('Failed to save call log', e));
        }
      } catch (e) { /* ignore */ }
    }
    callStartRef.current = null;
    setCallStatus("idle");
    setIsIncoming(false);
    setActiveCallSession(null);
  }, [selectedUser, user, injectSystemMessage]);

  // WebRTC setup helper
  const setupPeerConnection = useCallback((targetUserId) => {
    peerConnection.current = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    // Send local ICE network candidates to opponent via WebSocket
    peerConnection.current.onicecandidate = (event) => {
      if (event.candidate && wsRef.current) {
        wsRef.current.send(
          JSON.stringify({
            type: "ice_candidate",
            receiver_id: targetUserId,
            data: event.candidate,
          })
        );
      }
    };

    // Attach remote track to UI element when received
    peerConnection.current.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    // Push local mic/cam tracks into peer container
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        peerConnection.current.addTrack(track, localStreamRef.current);
      });
    }
  }, []);

  // WebSocket connection & Signaling Dispatcher
  useEffect(() => {
    if (!token) return;
    const configuredWsUrl = import.meta.env.VITE_WS_URL;
    const target = configuredWsUrl || window.location.origin;
    const wsUrl = new URL(target, window.location.origin);
    wsUrl.protocol = wsUrl.protocol === "https:" || wsUrl.protocol === "wss:" ? "wss:" : "ws:";
    if (!configuredWsUrl || wsUrl.pathname === "/" || wsUrl.pathname === "") {
      wsUrl.pathname = "/ws/chat";
    }
    wsUrl.searchParams.set("token", token);
    setWsStatus("connecting");
    const ws = new WebSocket(wsUrl.toString());
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("✅ WebSocket connected successfully");
      setWsStatus("online");
      ws.send(JSON.stringify({
        type: "presence_set",
        is_online: localStorage.getItem("rozgar_presence_online") !== "false",
      }));
    };
    ws.onclose = () => {
      console.log("❌ WebSocket closed");
      setWsStatus("offline");
      endCallSession();
    };
    ws.onerror = (err) => {
      console.error("❌ WebSocket error:", err);
      setWsStatus("offline");
    };

    ws.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);

        // --- Media signals for client-side only media (voice/documents) ---
        if (data.type === "media_signal") {
          const sig = data;
          const otherId = sig.sender_id === user.id ? sig.receiver_id : sig.sender_id;

          const placeholder = {
            id: sig.message_id || `sig-${Date.now()}`,
            sender_id: sig.sender_id,
            receiver_id: sig.receiver_id || user.id,
            content: null,
            file_url: null,
            file_type: null,
            metadata: { filename: sig.file_name, file_size: sig.file_size, duration_seconds: sig.duration_seconds },
            media_signal: true,
            media_type: sig.media_type,
            timestamp: sig.timestamp || new Date().toISOString(),
          };

          setMessages((prev) => {
            if (selectedUser?.user_id === otherId || sig.sender_id === user.id) {
              return [...prev, placeholder];
            }
            return prev;
          });

          setConversations((prev) => {
            const existing = prev.find((c) => c.user_id === otherId);
            const preview = sig.media_type === "voice" ? "[Voice message]" : `[Document: ${sig.file_name || ''}]`;
            if (existing) {
              return prev.map((c) =>
                c.user_id === otherId
                  ? { ...c, last_message: preview, last_message_time: placeholder.timestamp, unread_count: sig.sender_id !== user.id && selectedUser?.user_id !== otherId ? c.unread_count + 1 : c.unread_count }
                  : c
              );
            }
            chatAPI.getConversations(true).then((res) => setConversations(res.data));
            return prev;
          });

          return;
        }
        
        // Handle message deletion
        if (data.type === "delete_message") {
          setMessages((prev) => 
            prev.map(msg => 
              msg.id === data.messageId ? { ...msg, content: "This message was deleted", file_url: null, media_signal: false, media_type: null, local_blob: null, is_deleted: true } : msg
            )
          );
          return;
        }

        if (data.type === "presence") {
          setConversations((prev) =>
            prev.map((conv) =>
              conv.user_id === data.user_id ? { ...conv, is_online: Boolean(data.is_online) } : conv
            )
          );
          setSelectedUser((prev) =>
            prev?.user_id === data.user_id ? { ...prev, is_online: Boolean(data.is_online) } : prev
          );
          return;
        }

        // --- Standard Chat Routing Logic (Preserved) ---
        if (data.type === "message" || data.type === "message_ack") {
          const msgData = data.data;
          const otherId =
            msgData.sender_id === user.id
              ? msgData.receiver_id
              : msgData.sender_id;

          // Hydrate received Base64 data chunks right into the object so local UX handles them normally.
          let enrichedMsgData = { ...msgData };
          if (enrichedMsgData.file_url && enrichedMsgData.file_url.startsWith("data:")) {
              if (enrichedMsgData.media_type === "voice" || (enrichedMsgData.file_type && enrichedMsgData.file_type.startsWith("audio"))) {
                  enrichedMsgData.local = true;
                  enrichedMsgData.media_type = "voice";
                  // To use the existing IndexedDB media player hook we mock a blob from the Data URI.
                  let fetchResult = await fetch(enrichedMsgData.file_url);
                  enrichedMsgData.local_blob = await fetchResult.blob();
              } else if (enrichedMsgData.media_type === "document" || enrichedMsgData.file_type) {
                  enrichedMsgData.local = true;
                  enrichedMsgData.media_type = "document";
                  let fetchResult = await fetch(enrichedMsgData.file_url);
                  enrichedMsgData.local_blob = await fetchResult.blob();
              }
          }

          setMessages((prev) => {
            if (selectedUser?.user_id === otherId || enrichedMsgData.sender_id === user.id) {
              return [...prev, enrichedMsgData];
            }
            return prev;
          });
          setConversations((prev) => {
            const existing = prev.find((c) => c.user_id === otherId);
            const safeContent = (enrichedMsgData.content && enrichedMsgData.content !== "None" && enrichedMsgData.content !== "null")
              ? enrichedMsgData.content
              : (enrichedMsgData.metadata?.filename || (enrichedMsgData.file_type ? `[${(enrichedMsgData.file_type||"").split("/")[0]}]` : ""));
            if (existing) {
              return prev.map((c) =>
                c.user_id === otherId
                  ? {
                      ...c,
                      last_message: safeContent,
                      last_message_time: enrichedMsgData.timestamp,
                      unread_count:
                        enrichedMsgData.sender_id !== user.id && selectedUser?.user_id !== otherId
                          ? c.unread_count + 1
                          : c.unread_count,
                    }
                  : c
              );
            }
            chatAPI.getConversations(true).then((res) => setConversations(res.data));
            return prev;
          });
        }
        if (data.type === "emergency_job") {
          alert(`🚨 ${data.message}`);
        }

        // --- 🧾 Work completion → premium card on the employer feed ---
        if (data.type === "work_completed") {
          const card = {
            id: `wc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            is_completion: true,
            job_id: data.job_id ?? null,
            worker_id: data.worker_id ?? data.sender_id,
            worker_name: data.worker_name || selectedUser?.name || "Worker",
            content: data.job_title
              ? `Completed work submitted for "${data.job_title}"`
              : "The worker submitted their completed work for review.",
            timestamp: data.timestamp || new Date().toISOString(),
          };
          setMessages((prev) => [...prev, card]);
          return;
        }

        // --- 💸 Verified payment released → unlock the rating overlay (employer) ---
        if (data.type === "payment_released") {
          injectSystemMessage(
            `✅ Payment released${data.job_title ? ` for "${data.job_title}"` : ""}${
              data.net != null ? ` — Rs. ${data.net}` : ""
            }`
          );
          if (user.role === "employer" && data.worker_id) {
            setRatingValue(0);
            setHoverRating(0);
            setRatingOverlay({
              open: true,
              jobId: data.job_id ?? null,
              workerId: data.worker_id,
              workerName: selectedUser?.name || "the worker",
            });
          }
          return;
        }

        // --- ⭐ Rating received → celebratory toast on the worker side ---
        if (data.type === "worker_rated") {
          setRatingToast(`🎉 Excellent! Your employer rated you ${data.rating}/5 stars for this job!`);
          setTimeout(() => setRatingToast(null), 6000);
          return;
        }

        // --- 📞 Real-Time Signaling Core Logic ---
        switch (data.type) {
          case "incoming_call":
            setIsIncoming(true);
            setCallStatus("ringing");
            setActiveCallSession({
              caller_id: data.sender_id,
              sender_name: data.sender_name || "Incoming Caller",
              channel_name: data.channel_name
            });
            break;

          case "call_accepted": {
            setCallStatus("connected");
            callStartRef.current = Date.now();
            setupPeerConnection(data.sender_id);
            const offer = await peerConnection.current.createOffer();
            await peerConnection.current.setLocalDescription(offer);
            ws.send(JSON.stringify({ type: "call_offer", receiver_id: data.sender_id, data: offer }));
            break;
          }

          case "call_rejected":
            endCallSession(true);
            break;

          case "call_offer": {
            if (!peerConnection.current) setupPeerConnection(data.sender_id);
            await peerConnection.current.setRemoteDescription(new RTCSessionDescription(data.data));
            const answer = await peerConnection.current.createAnswer();
            await peerConnection.current.setLocalDescription(answer);
            ws.send(JSON.stringify({ type: "call_answer", receiver_id: data.sender_id, data: answer }));
            setCallStatus("connected");
            callStartRef.current = Date.now();
            break;
          }

          case "call_answer":
            if (peerConnection.current) {
              await peerConnection.current.setRemoteDescription(new RTCSessionDescription(data.data));
            }
            break;

          case "ice_candidate":
            if (peerConnection.current && data.data) {
              try {
                await peerConnection.current.addIceCandidate(new RTCIceCandidate(data.data));
              } catch { /* stale candidates */ }
            }
            break;

          case "hangup":
            endCallSession(false);
            break;
        }
      } catch {
        /* ignore parse errors */
      }
    };

    return () => {
      ws.close();
    };
  }, [token, user, setupPeerConnection, endCallSession, selectedUser]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const toggleManualPresence = () => {
    const nextPresence = !manualPresenceOnline;
    setManualPresenceOnline(nextPresence);
    localStorage.setItem("rozgar_presence_online", nextPresence ? "true" : "false");
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "presence_set",
        is_online: nextPresence,
      }));
    }
  };

  // Load chat history when selecting a user
  const selectConversation = useCallback(async (conv) => {
    setSelectedUser(conv);
    try {
      const res = await chatAPI.getChatHistory(conv.user_id);
      const serverMessages = res.data || [];
      let localMessages = [];
      try {
        await initDB();
        const mediaItems = await getMediaForConversation(conv.user_id);
        localMessages = (mediaItems || []).map(convertStoredItemToMessage).filter(Boolean);
      } catch (e) {
        localMessages = [];
      }

      const merged = [...serverMessages, ...localMessages].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      setMessages(merged);
      setConversations((prev) =>
        prev.map((c) =>
          c.user_id === conv.user_id ? { ...c, unread_count: 0 } : c
        )
      );
    } catch {
      setMessages([]);
    }
  }, []);

  const sendMessage = async () => {
    if (!selectedUser) return;

    let messageContent = newMsg.trim();
    let fileUrl = null;
    let fileType = null;
    let metadata = null;
    const voiceFileName = `voice_${Date.now()}.webm`;

    try {
      if (stagedFile) {
        const formData = new FormData();
        formData.append("file", stagedFile);
        const uploadRes = await chatAPI.upload(formData);
        fileUrl = uploadRes.data.file_url;
        fileType = uploadRes.data.file_type || stagedFile.type || "application/octet-stream";
        metadata = { filename: stagedFile.name, file_size: stagedFile.size };
        messageContent = "";
      } else if (stagedAudio) {
        const formData = new FormData();
        formData.append("file", stagedAudio, voiceFileName);
        const uploadRes = await chatAPI.upload(formData);
        fileUrl = uploadRes.data.file_url;
        fileType = uploadRes.data.file_type || stagedAudio.type || "audio/webm";
        metadata = { filename: voiceFileName, file_size: stagedAudio.size, duration_seconds: recordTimer };
        messageContent = "";
      }
    } catch (err) {
      alert("Failed to upload media. Please try again.");
      console.error(err);
      return;
    }

    if (!messageContent && !fileUrl) return;

    const payload = {
      receiver_id: selectedUser.user_id,
      content: messageContent,
    };

    if (fileUrl) {
      payload.file_url = fileUrl.startsWith("http") ? fileUrl : `${window.location.origin}${fileUrl}`;
      payload.file_type = fileType;
      payload.metadata = metadata;
    }

    try {
      let deliveredBySocket = false;
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        try {
          const wsPayload = {
            type: "message",
            receiver_id: selectedUser.user_id,
            content: messageContent,
          };
          if (fileUrl) {
            wsPayload.file_url = payload.file_url;
            wsPayload.file_type = payload.file_type;
            wsPayload.metadata = payload.metadata;
          }
          wsRef.current.send(JSON.stringify(wsPayload));
          deliveredBySocket = true;
        } catch (wsErr) {
          console.warn("WebSocket message delivery failed, continuing with HTTP persistence", wsErr);
        }
      }

      if (deliveredBySocket) {
        setNewMsg("");
        setStagedFile(null);
        setStagedAudio(null);
        setRecordTimer(0);
        return;
      }

      const res = await chatAPI.sendMessage(payload);
      const msg = res.data;
      setMessages((prev) => [...prev, {
        id: msg.id,
        sender_id: msg.sender_id,
        receiver_id: msg.receiver_id,
        content: msg.content || "",
        file_url: msg.file_url,
        file_type: msg.file_type,
        metadata: msg.metadata,
        timestamp: msg.timestamp,
        is_read: msg.is_read,
      }]);
    } catch (err) {
      console.error("Failed to send chat message", err);
      alert("Your message could not be sent. Please try again.");
      return;
    }

    setNewMsg("");
    setStagedFile(null);
    setStagedAudio(null);
    setRecordTimer(0);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleDocumentSelect = async (file) => {
    if (!file || !selectedUser) return;
    setStagedFile(file);
    setStagedAudio(null); // Clear audio if file selected
    setNewMsg(""); // Clear text
  };

  const handleVoiceComplete = async ({ blob, duration_seconds }) => {
    if (!selectedUser || !blob) return;
    setStagedAudio(blob);
    setStagedFile(null); // Clear file if audio recorded
    setNewMsg(""); // Clear text
    setRecordTimer(duration_seconds || 0);
  };

  const getAttachmentName = (msg) => {
    if (msg?.metadata?.filename) return msg.metadata.filename;
    const src = msg?.file_url || msg?.content || "";
    try {
      const url = new URL(src, window.location.origin);
      const rawName = decodeURIComponent(url.pathname.split("/").pop() || "");
      return rawName.replace(/^[a-f0-9]{32}_/i, "") || "attachment";
    } catch {
      return "attachment";
    }
  };

  const formatFileSize = (size) => {
    if (!size || Number.isNaN(Number(size))) return "";
    const kb = Number(size) / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  const downloadAttachment = async (url, filename) => {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Download failed");
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filename || "attachment";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      console.error("Attachment download failed", err);
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  const extractCloudinaryPublicId = (url) => {
    // URL pattern: https://res.cloudinary.com/{cloud}/image|video|raw/upload/v{ver}/{public_id}.{ext}
    try {
      const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[a-z0-9]+)?$/);
      return match ? match[1] : null;
    } catch { return null; }
  };

  const handleDeleteMessage = async (messageId) => {
    if (!selectedUser || !wsRef.current) return;
    setSelectedDeleteMessageId(null);

    // Try to destroy Cloudinary asset if the message contains a hosted URL
    const msg = messages.find(m => m.id === messageId);
    if (msg?.content && msg.content.includes('res.cloudinary.com')) {
      const publicId = extractCloudinaryPublicId(msg.content);
      if (publicId) {
        // Determine resource type from URL
        const resourceType = msg.content.includes('/video/') ? 'video' : msg.content.includes('/raw/') ? 'raw' : 'image';
        // NOTE: Cloudinary destroy requires API secret — proxy through your backend endpoint in production.
        // Attempting unsigned delete via upload-preset invalidation:
        try {
          await fetch(`https://api.cloudinary.com/v1_1/bghopoqf/${resourceType}/destroy`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ public_id: publicId, upload_preset: 'yaleneij' }),
          });
        } catch (e) {
          console.warn('Cloudinary destroy failed (requires signed API call for full deletion):', e);
        }
      }
    }

    // Broadcast deletion over WebSocket
    wsRef.current.send(JSON.stringify({
      type: "delete_message",
      messageId: messageId,
      receiver_id: selectedUser.user_id,
    }));

    // Optimistic local update
    setMessages((prev) =>
      prev.map(m =>
        m.id === messageId
          ? { ...m, content: "This message was deleted", file_url: null, media_signal: false, media_type: null, local_blob: null, is_deleted: true }
          : m
      )
    );
  };

  

  const startRecording = async () => {
    if (!selectedUser) return;
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        alert("Voice recording is not supported in this browser.");
        return;
      }
      if (!window.MediaRecorder) {
        alert("Voice recording is not supported in this browser.");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : "";
      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = mediaRecorder;
      voiceStreamRef.current = stream;
      recordedChunksRef.current = [];
      recordStartedAtRef.current = Date.now();
      mediaRecorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) recordedChunksRef.current.push(ev.data);
      };
      mediaRecorder.onstop = async () => {
        const blob = new Blob(recordedChunksRef.current, { type: mimeType || "audio/webm" });
        const durationSeconds = recordStartedAtRef.current
          ? Math.max(1, Math.round((Date.now() - recordStartedAtRef.current) / 1000))
          : Math.max(1, recordTimer);
        
        // 5MB Limit restriction
        if (blob.size > 5 * 1024 * 1024) {
          alert("Voice message exceeds 5MB limit.");
          voiceStreamRef.current?.getTracks().forEach((t) => t.stop());
          voiceStreamRef.current = null;
          recordStartedAtRef.current = null;
          return;
        }

        handleVoiceComplete({ blob, duration_seconds: durationSeconds });
        voiceStreamRef.current?.getTracks().forEach((t) => t.stop());
        voiceStreamRef.current = null;
        recordStartedAtRef.current = null;
      };
      mediaRecorder.start();
      setRecording(true);
      setRecordTimer(0);
      recordIntervalRef.current = setInterval(() => setRecordTimer((s) => s + 1), 1000);
    } catch (err) {
      console.error("Could not start recording", err);
      if (err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError") {
        alert("Microphone permission was blocked. Please allow microphone access and try again.");
      } else if (err?.name === "NotFoundError") {
        alert("No microphone was found on this device.");
      } else {
        alert("Could not start voice recording. Please check your microphone and browser permissions.");
      }
      voiceStreamRef.current?.getTracks().forEach((t) => t.stop());
      voiceStreamRef.current = null;
      setRecording(false);
    }
  };

  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    clearInterval(recordIntervalRef.current);
    setRecording(false);
  };

  const toggleRecording = () => (recording ? stopRecording() : startRecording());

  // ==========================================
  // CALL LIFE-CYCLE HANDLERS
  // ==========================================
  const handleCall = async () => {
    if (!selectedUser || !wsRef.current) return;
    try {
      setCallStatus("dialing");
      setIsIncoming(false);

      const res = await callsAPI.initiate(selectedUser.user_id);
      setActiveCallSession(res.data);

      const localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = localStream;
      if (localVideoRef.current) localVideoRef.current.srcObject = localStream;

      injectSystemMessage("📞 Video call started");

      wsRef.current.send(
        JSON.stringify({
          type: "incoming_call",
          receiver_id: selectedUser.user_id,
          sender_name: user.name,
          channel_name: res.data.channel_name,
        })
      );
    } catch {
      alert("Failed to initiate call");
      endCallSession(true);
    }
  };

  const acceptCall = async () => {
    if (!activeCallSession || !wsRef.current) return;
    try {
      setCallStatus("connected");
      setIsIncoming(false);

      const localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = localStream;
      if (localVideoRef.current) localVideoRef.current.srcObject = localStream;

      wsRef.current.send(
        JSON.stringify({
          type: "call_accepted",
          receiver_id: activeCallSession.caller_id,
        })
      );
    } catch {
      alert("Could not access camera/microphone");
      rejectCall();
    }
  };

  const rejectCall = () => {
    if (activeCallSession && wsRef.current) {
      wsRef.current.send(
        JSON.stringify({
          type: "call_rejected",
          receiver_id: activeCallSession.caller_id,
        })
      );
    }
    endCallSession(true);
  };

  const triggerHangup = () => {
    const targetId = selectedUser?.user_id || activeCallSession?.caller_id;
    if (targetId && wsRef.current) {
      wsRef.current.send(
        JSON.stringify({
          type: "hangup",
          receiver_id: targetId,
        })
      );
    }
    endCallSession(false);
  };

  // Worker submits completed work — broadcasts a real-time work_completed event.
  const handleMarkComplete = async (jobId) => {
    if (!jobId) return;
    setMarkingJobId(jobId);
    try {
      await paymentsAPI.completeJob(jobId);
      setCompletedJobs((prev) => (prev.includes(jobId) ? prev : [...prev, jobId]));
      injectSystemMessage("✅ Job marked completed. Proceed to payment.");
    } catch (err) {
      alert(err?.response?.data?.detail || "Failed to complete job");
    } finally {
      setMarkingJobId(null);
    }
  };

  const openPaymentDrawer = (jobId) => setPaymentDrawer({ open: true, jobId, loading: false });
  const closePaymentDrawer = () => setPaymentDrawer({ open: false, jobId: null, loading: false });

  const initiateGateway = async (gateway) => {
    if (!paymentDrawer.jobId) return;
    setPaymentDrawer((p) => ({ ...p, loading: true }));
    try {
      const req = { job_id: parseInt(paymentDrawer.jobId), gateway };
      const res = gateway === "khalti" ? await paymentsAPI.initiateKhaltiPayment(req) : await paymentsAPI.initiatePayment(req);
      continueToPaymentGateway(res.data);
    } catch (err) {
      alert(err?.response?.data?.detail || err.message || "Failed to start payment");
    } finally {
      closePaymentDrawer();
    }
  };

  // Employer submits the five-star performance rating for the worker.
  const submitRating = async () => {
    if (!ratingOverlay.open || ratingValue < 1 || !ratingOverlay.workerId || !ratingOverlay.jobId) {
      alert("Please select a star rating first.");
      return;
    }
    setRatingSubmitting(true);
    try {
      await reviewsAPI.submitReview({
        job_id: ratingOverlay.jobId,
        reviewee_id: ratingOverlay.workerId,
        reviewer_role: "employer",
        overall_rating: ratingValue,
      });
      // Push the real-time rating event to the worker.
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: "worker_rated",
            receiver_id: ratingOverlay.workerId,
            rating: ratingValue,
          })
        );
      }
      injectSystemMessage(`⭐ You rated ${ratingOverlay.workerName} ${ratingValue}/5.`);
      setRatingOverlay({ open: false, jobId: null, workerId: null, workerName: "" });
      setRatingValue(0);
      setHoverRating(0);
    } catch (err) {
      alert(err?.response?.data?.detail || "Failed to submit rating");
    } finally {
      setRatingSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-5rem)] bg-slate-50 px-3 py-6 sm:px-4 lg:px-6">
        <div className="mx-auto flex min-h-[60vh] max-w-7xl items-center justify-center rounded-[28px] border border-slate-200 bg-white/80 px-8 py-16 shadow-sm backdrop-blur">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-500" />
            <p className="text-lg font-semibold text-slate-700">Loading chats...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.12),_transparent_45%),linear-gradient(135deg,#f8fafc_0%,#f1f5f9_100%)] px-3 py-4 sm:px-4 lg:px-6">
      <div className="mx-auto flex h-[calc(100vh-7rem)] max-w-7xl flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white/90 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur md:flex-row">
        {/* Conversations List */}
        <div className="flex w-full flex-col border-b border-slate-200 bg-slate-50/80 p-4 md:w-[320px] md:border-b-0 md:border-r md:p-3">
          <div className="mb-3 flex items-center justify-between rounded-2xl bg-white px-3 py-3 shadow-sm">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Messages</h2>
              <p className="text-sm text-slate-500">Start or continue conversations</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${wsStatus === "online" ? "bg-emerald-100 text-emerald-700" : wsStatus === "connecting" ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"}`}>
                {wsStatus === "online" ? "Realtime on" : wsStatus === "connecting" ? "Connecting" : "Realtime off"}
              </span>
              <button
                type="button"
                onClick={toggleManualPresence}
                disabled={wsStatus !== "online"}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  manualPresenceOnline
                    ? "bg-emerald-600 text-white hover:bg-emerald-700"
                    : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                } disabled:cursor-not-allowed disabled:opacity-50`}
                title={manualPresenceOnline ? "Others can see you online" : "Others will see you offline"}
              >
                {manualPresenceOnline ? "Appear online" : "Appear offline"}
              </button>
            </div>
          </div>

          {conversations.length === 0 ? (
            <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white/70 p-6 text-center text-sm text-slate-500">
              <p>No contacts available yet</p>
            </div>
          ) : (
            <div className="flex-1 space-y-2 overflow-y-auto pr-1">
              {conversations.map((conv) => (
                <div
                  key={conv.user_id}
                  className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-3 py-3 transition ${
                    selectedUser?.user_id === conv.user_id
                      ? "border-emerald-500 bg-emerald-50 shadow-sm"
                      : "border-transparent bg-white/70 hover:border-slate-200 hover:bg-slate-50"
                  }`}
                  onClick={() => selectConversation(conv)}
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 font-semibold text-white">
                    {conv.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-slate-800">
                        <span className={`h-2 w-2 shrink-0 rounded-full ${conv.is_online ? "bg-emerald-500" : "bg-slate-300"}`} />
                        <span className="truncate">{conv.name}</span>
                      </span>
                      <span className="text-[11px] font-medium text-slate-400">{conv.role}</span>
                    </div>
                    <p className="mt-1 truncate text-sm text-slate-500">
                      {conv.last_message
                        ? conv.last_message.substring(0, 40) + (conv.last_message.length > 40 ? "..." : "")
                        : "No messages"}
                    </p>
                  </div>
                  {conv.unread_count > 0 && (
                    <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-xs font-semibold text-white">
                      {conv.unread_count}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Chat Window */}
        <div className="flex min-h-0 flex-1 flex-col bg-white">
          {selectedUser ? (
            <>
              <div className="flex flex-col gap-3 border-b border-slate-200 bg-white/90 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4 lg:px-5">
                <div>
                  <h3 className="text-lg font-semibold text-slate-800">{selectedUser.name}</h3>
                  <span className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
                    <span>{selectedUser.role} · {selectedUser.email}</span>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${selectedUser.is_online ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${selectedUser.is_online ? "bg-emerald-500" : "bg-slate-400"}`} />
                      {selectedUser.is_online ? "Online" : "Offline"}
                    </span>
                  </span>
                </div>
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto bg-[linear-gradient(180deg,rgba(248,250,252,0.95),rgba(255,255,255,1))] px-3 py-3 sm:px-4 lg:px-5" onClick={() => { setSelectedDeleteMessageId(null); cancelPress(); }}>
                {messages.length === 0 && (
                  <div className="flex h-full items-center justify-center text-center">
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-white/75 px-6 py-5 shadow-sm">
                      <p className="text-sm font-semibold text-slate-700">No messages yet</p>
                      <p className="mt-1 text-sm text-slate-500">Send a message to start this conversation.</p>
                    </div>
                  </div>
                )}
                {messages.map((msg, idx) => {
                  // ─── Centered system event notifications (call start/end/missed) ───
                  if (msg.is_system) {
                    return (
                      <div key={msg.id || idx} className="text-xs text-neutral-400 text-center font-medium my-2">
                        {msg.content}
                      </div>
                    );
                  }

                  // ─── Premium frosted-glass work completion card ───
                  if (msg.is_completion) {
                    const jobIdForMsg = msg.job_id;
                    return (
                      <div
                        key={msg.id || idx}
                        className="bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md shadow-2xl border border-neutral-200 dark:border-neutral-800 p-4 rounded-2xl animate-fade-in"
                        style={{
                          alignSelf: 'center',
                          maxWidth: 380,
                          margin: '10px auto',
                          background: 'rgba(255,255,255,0.82)',
                          backdropFilter: 'blur(12px)',
                          WebkitBackdropFilter: 'blur(12px)',
                          boxShadow: '0 20px 40px rgba(16,24,40,0.18)',
                          border: '1px solid #e5e7eb',
                          padding: 16,
                          borderRadius: 16,
                          animation: 'chatFadeIn 0.35s ease-out',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>✅</div>
                          <div>
                            <div style={{ fontWeight: 700, color: '#111827', fontSize: 14 }}>Work Completed</div>
                            <div style={{ fontSize: 12, color: '#6b7280' }}>{msg.worker_name}</div>
                          </div>
                        </div>
                        <p style={{ margin: '10px 0 0', fontSize: 13, color: '#374151' }}>{msg.content}</p>
                        {user.role === 'employer' && (
                          <div style={{ marginTop: 10, display: 'flex', gap: 8, justifyContent: 'center' }}>
                            {!completedJobs.includes(jobIdForMsg) ? (
                              <button
                                onClick={() => {
                                  if (!jobIdForMsg) return alert('No job id available for this completion.');
                                  handleMarkComplete(jobIdForMsg);
                                }}
                                disabled={markingJobId === jobIdForMsg}
                                style={{ padding: '10px 18px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 12, cursor: 'pointer', fontWeight: 600 }}
                              >
                                {markingJobId === jobIdForMsg ? 'Processing...' : 'Mark Complete'}
                              </button>
                            ) : (
                              <button
                                onClick={() => openPaymentDrawer(jobIdForMsg)}
                                style={{ padding: '10px 18px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 12, cursor: 'pointer', fontWeight: 700 }}
                              >
                                Proceed to Secure Payment Gateway
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  }

                  const isSent = msg.sender_id === user.id;
                  const msgKey = msg.id || idx;

                  return (
                    <div
                      key={msgKey}
                      className={`message ${isSent ? 'sent' : 'received'}`}
                    >
                      {/* message wrapper: attach long-press handlers for deletion */}
                      <div
                        className="relative inline-block"
                        onMouseDown={(e) => startPress(e, msgKey)}
                        onTouchStart={(e) => startPress(e, msgKey)}
                        onMouseUp={cancelPress}
                        onMouseLeave={cancelPress}
                        onTouchEnd={cancelPress}
                        onTouchCancel={cancelPress}
                      >
                        <div className="message-bubble">
                          {msg.is_deleted ? (
                            <p style={{ fontStyle: 'italic', color: '#8a8d91', fontSize: '13px' }}>This message was deleted</p>
                          ) : msg.local && msg.media_type === 'call_log' ? (
                            <p>📞 {msg.metadata?.call_type === 'video' ? 'Video' : 'Audio'} call · {Math.floor((msg.metadata?.duration_seconds || 0) / 60)} min {(msg.metadata?.duration_seconds || 0) % 60} sec</p>
                          ) : msg.media_signal ? (
                            <div className="message-placeholder">
                              {msg.media_type === 'voice' ? '🎙 [Voice message]' : `📎 [Document: ${msg.metadata?.filename || 'file'}]`}
                            </div>
                          ) : (() => {
                            const contentSrc = msg.file_url || msg.content || "";
                            const mediaType = msg.file_type || "";
                            if (mediaType.startsWith("image/") || contentSrc.match(/\.(png|jpg|jpeg|gif|webp)$/i) || contentSrc.includes("image/upload")) {
                              return <img src={contentSrc} alt="uploaded media" style={{ maxWidth: '100%', borderRadius: 12 }} />;
                            } else if (mediaType.startsWith("audio/") || contentSrc.match(/\.(mp3|wav|ogg|webm)$/i) || contentSrc.includes("/raw/")) {
                              return <audio controls src={contentSrc} />;
                            } else if (mediaType.startsWith("video/") || contentSrc.match(/\.(mp4|webm|ogg)$/i) || contentSrc.includes("video/upload")) {
                              return <video controls src={contentSrc} style={{ maxWidth: '100%', borderRadius: 12 }} />;
                            } else if (msg.file_url || contentSrc.startsWith("http")) {
                              const attachmentName = getAttachmentName(msg);
                              const attachmentSize = formatFileSize(msg.metadata?.file_size);
                              return (
                                <div className="message-attachment">
                                  <div className="min-w-0">
                                    <div className="truncate font-semibold">{attachmentName}</div>
                                    {attachmentSize && <div className="text-xs opacity-75">{attachmentSize}</div>}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => downloadAttachment(contentSrc, attachmentName)}
                                  >
                                    Download
                                  </button>
                                </div>
                              );
                            } else {
                              return <p>{(msg.content && msg.content !== "None" && msg.content !== "null") ? msg.content : (msg.metadata?.filename || "")}</p>;
                            }
                          })()}
                          <span className="message-time">
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            {isSent && <span className="read-status">{msg.is_read ? " ✓✓" : " ✓"}</span>}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* STAGED MEDIA PREVIEWS */}
              {(stagedFile || stagedAudio) && (
                <div className="mx-4 p-2 bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 overflow-hidden">
                    {stagedFile && (
                       <span className="text-sm text-gray-700 truncate font-medium">📎 {stagedFile.name} ({(stagedFile.size / 1024).toFixed(1)} KB)</span>
                    )}
                    {stagedAudio && (
                       <audio src={URL.createObjectURL(stagedAudio)} controls className="h-8 w-48" />
                    )}
                  </div>
                  <button 
                    onClick={() => { setStagedFile(null); setStagedAudio(null); }}
                    className="text-gray-500 hover:text-red-500 font-bold px-2"
                  >
                    ×
                  </button>
                </div>
              )}

              <div className="flex flex-col gap-2 border-t border-slate-200 bg-white/90 p-3 sm:flex-row sm:items-center sm:gap-2 sm:p-4">
                {!recording && (
                  <DocumentPicker
                    onSelect={handleDocumentSelect}
                    label={<Paperclip size={20} />}
                    className="btn btn-icon"
                    accept="image/*,video/*,.pdf,.doc,.docx,.txt,.xlsx,.xls,.ppt,.pptx,.zip,.rar"
                  />
                )}
                
                <button
                  onClick={toggleRecording}
                  className={`btn btn-icon ${recording ? 'text-red-500' : ''}`}
                  title={recording ? 'Stop Recording' : 'Start Voice Note'}
                >
                  {recording ? '⏹' : <Mic size={20} />}
                </button>

                {recording ? (
                   <div className="flex-1 px-3 flex flex-row items-center gap-2 text-red-500 animate-pulse font-medium">
                     <div className="w-3 h-3 bg-red-500 rounded-full" />
                     Recording... {Math.floor(recordTimer / 60)}:{(recordTimer % 60).toString().padStart(2, '0')}
                   </div>
                ) : (
                  <input
                    type="text"
                    placeholder="Type a message..."
                    value={newMsg}
                    onChange={(e) => setNewMsg(e.target.value)}
                    onKeyDown={handleKeyDown}
                    style={{ flex: 1, padding: '10px 12px', borderRadius: 12, border: '1px solid #e5e7eb' }}
                  />
                )}
                
                <button
                  onClick={sendMessage}
                  disabled={!canSend}
                  aria-label="Send message"
                  style={{
                    backgroundColor: canSend ? '#4f46e5' : '#c7d2fe',
                    color: 'white',
                    border: 'none',
                    borderRadius: 999,
                    width: 44,
                    height: 44,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: canSend ? 'pointer' : 'not-allowed'
                  }}
                >
                  <Send size={18} color="white" />
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.12),_transparent_50%)] px-6 py-10 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl shadow-sm">💬</div>
              <h3 className="text-xl font-semibold text-slate-800">Select a conversation</h3>
              <p className="mt-2 max-w-sm text-sm text-slate-500">Choose a chat from the sidebar to start messaging with your worker or employer.</p>
            </div>
          )}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 📱 REAL-TIME FULLSCREEN CALLING OVERLAY */}
      {/* ===================================================================== */}
      {callStatus !== "idle" && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          backgroundColor: '#111b21', zIndex: 10000, display: 'flex', 
          flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white', fontFamily: 'sans-serif'
        }}>
          {/* DIALING SCREEN */}
          {callStatus === "dialing" && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: '100px', height: '100px', borderRadius: '50%', backgroundColor: '#202c33', margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px' }}>👤</div>
              <h2>Calling {selectedUser?.name}...</h2>
              <p style={{ color: '#8696a0' }}>Outgoing Ringing...</p>
              <button onClick={triggerHangup} style={{ marginTop: '50px', padding: '15px 30px', backgroundColor: '#ea0038', color: 'white', border: 'none', borderRadius: '30px', cursor: 'pointer', fontWeight: 'bold' }}>Cancel</button>
            </div>
          )}

          {/* INCOMING RINGING SCREEN */}
          {callStatus === "ringing" && isIncoming && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: '100px', height: '100px', borderRadius: '50%', backgroundColor: '#202c33', margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px' }}>📞</div>
              <h2>{activeCallSession?.sender_name || "Incoming Call"}</h2>
              <p style={{ color: '#8696a0' }}>Rozgar Video Call...</p>
              <div style={{ display: 'flex', gap: '40px', marginTop: '60px' }}>
                <button onClick={acceptCall} style={{ padding: '15px 40px', backgroundColor: '#1fa855', color: 'white', border: 'none', borderRadius: '30px', cursor: 'pointer', fontWeight: 'bold' }}>Accept</button>
                <button onClick={rejectCall} style={{ padding: '15px 40px', backgroundColor: '#ea0038', color: 'white', border: 'none', borderRadius: '30px', cursor: 'pointer', fontWeight: 'bold' }}>Decline</button>
              </div>
            </div>
          )}

          {/* LIVE CONNECTED VIDEO SCREEN */}
          {callStatus === "connected" && (
            <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <video ref={remoteVideoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <video ref={localVideoRef} autoPlay playsInline muted style={{
                position: 'absolute', top: '20px', right: '20px', width: '120px', height: '180px',
                borderRadius: '12px', border: '2px solid rgba(255,255,255,0.6)', objectFit: 'cover', transform: 'scaleX(-1)'
              }} />

              {/* Premium Messenger-style minimalist control pill */}
              <div style={{
                position: 'absolute', bottom: '40px',
                display: 'flex', gap: '12px', alignItems: 'center',
                padding: '12px 24px', borderRadius: '9999px',
                backgroundColor: 'rgba(23,23,23,0.8)',
                backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}>
                {/* Mute / Unmute */}
                <button
                  onClick={toggleAudio}
                  title={audioEnabled ? 'Mute' : 'Unmute'}
                  style={{
                    width: 48, height: 48, borderRadius: '50%', border: 'none', cursor: 'pointer',
                    backgroundColor: audioEnabled ? 'rgba(255,255,255,0.15)' : '#ea0038',
                    color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'background-color 0.15s',
                  }}
                >
                  {audioEnabled ? <Mic size={20} /> : <MicOff size={20} />}
                </button>

                {/* End Call */}
                <button
                  onClick={triggerHangup}
                  title="End Call"
                  style={{
                    width: 56, height: 56, borderRadius: '50%', border: 'none', cursor: 'pointer',
                    backgroundColor: '#ea0038', color: 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 2px 8px rgba(234,0,56,0.5)',
                  }}
                >
                  <PhoneOff size={22} />
                </button>

                {/* Camera on/off */}
                <button
                  onClick={toggleVideo}
                  title={videoEnabled ? 'Turn Camera Off' : 'Turn Camera On'}
                  style={{
                    width: 48, height: 48, borderRadius: '50%', border: 'none', cursor: 'pointer',
                    backgroundColor: videoEnabled ? 'rgba(255,255,255,0.15)' : '#ea0038',
                    color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'background-color 0.15s',
                  }}
                >
                  {videoEnabled ? <Video size={20} /> : <VideoOff size={20} />}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* ⭐ FIVE-STAR "RATE WORKER PERFORMANCE" OVERLAY (employer) */}
      {/* ===================================================================== */}
      {ratingOverlay.open && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 10001,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(17,24,39,0.55)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
          }}
        >
          <div
            className="bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md shadow-2xl border border-neutral-200 dark:border-neutral-800 p-4 rounded-2xl animate-fade-in"
            style={{
              width: 'min(92vw, 420px)', background: 'rgba(255,255,255,0.95)',
              borderRadius: 16, padding: 28, textAlign: 'center',
              boxShadow: '0 24px 60px rgba(0,0,0,0.3)', border: '1px solid #e5e7eb',
              animation: 'chatFadeIn 0.35s ease-out',
            }}
          >
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#111827' }}>Rate Worker Performance</h2>
            <p style={{ margin: '6px 0 20px', color: '#6b7280', fontSize: 14 }}>
              How was your experience with {ratingOverlay.workerName}?
            </p>

            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 22 }}>
              {[1, 2, 3, 4, 5].map((star) => {
                const active = (hoverRating || ratingValue) >= star;
                return (
                  <button
                    key={star}
                    type="button"
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => setRatingValue(star)}
                    className={active ? "text-amber-400 fill-amber-400" : "text-neutral-300 dark:text-neutral-600"}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, lineHeight: 0 }}
                    aria-label={`${star} star${star > 1 ? 's' : ''}`}
                  >
                    <Star
                      size={40}
                      color={active ? '#fbbf24' : '#d1d5db'}
                      fill={active ? '#fbbf24' : 'none'}
                    />
                  </button>
                );
              })}
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => { setRatingOverlay({ open: false, jobId: null, workerId: null, workerName: "" }); setRatingValue(0); setHoverRating(0); }}
                style={{ padding: '10px 20px', borderRadius: 12, border: '1px solid #e5e7eb', background: '#fff', color: '#374151', cursor: 'pointer', fontWeight: 600 }}
              >
                Later
              </button>
              <button
                type="button"
                disabled={ratingSubmitting || ratingValue < 1}
                onClick={submitRating}
                style={{
                  padding: '10px 24px', borderRadius: 12, border: 'none', color: '#fff', fontWeight: 700,
                  background: ratingValue >= 1 ? 'linear-gradient(135deg,#f59e0b,#f97316)' : '#fcd34d',
                  cursor: ratingValue >= 1 ? 'pointer' : 'not-allowed',
                }}
              >
                {ratingSubmitting ? 'Submitting…' : 'Submit Rating'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🎉 Worker celebratory rating toast */}
      {ratingToast && (
        <div
          className="animate-fade-in"
          style={{
            position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)', zIndex: 10002,
            background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: '#fff',
            padding: '14px 22px', borderRadius: 14, fontWeight: 600, fontSize: 15,
            boxShadow: '0 12px 30px rgba(79,70,229,0.4)', maxWidth: '90vw', textAlign: 'center',
            animation: 'chatFadeIn 0.35s ease-out',
          }}
        >
          {ratingToast}
        </div>
      )}

      {/* Payment gateway selector drawer */}
      {paymentDrawer.open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 10005 }} onClick={closePaymentDrawer}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 720, background: '#fff', borderTopLeftRadius: 12, borderTopRightRadius: 12, padding: 18, boxShadow: '0 -8px 30px rgba(0,0,0,0.12)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>Select Payment Gateway</div>
                <div style={{ fontSize: 13, color: '#6b7280' }}>Job #{paymentDrawer.jobId}</div>
              </div>
              <button onClick={closePaymentDrawer} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
              <button onClick={() => initiateGateway('esewa')} disabled={paymentDrawer.loading} style={{ flex: 1, padding: '12px 14px', borderRadius: 10, background: '#60bb46', color: '#fff', border: 'none', fontWeight: 700 }}>{paymentDrawer.loading ? 'Processing…' : 'eSewa Sandbox'}</button>
              <button onClick={() => initiateGateway('khalti')} disabled={paymentDrawer.loading} style={{ flex: 1, padding: '12px 14px', borderRadius: 10, background: '#5c2d91', color: '#fff', border: 'none', fontWeight: 700 }}>{paymentDrawer.loading ? 'Processing…' : 'Khalti Sandbox'}</button>
            </div>
            <div style={{ marginTop: 14, textAlign: 'center' }}>
              <button onClick={closePaymentDrawer} style={{ padding: '8px 12px', borderRadius: 8, background: 'transparent', border: '1px solid #e5e7eb' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes chatFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .message {
          display: flex;
          width: 100%;
          margin: 6px 0;
        }
        .message.sent {
          justify-content: flex-end;
        }
        .message.received {
          justify-content: flex-start;
        }
        .message-bubble {
          max-width: min(72vw, 520px);
          overflow-wrap: anywhere;
          border-radius: 18px;
          padding: 10px 12px;
          font-size: 14px;
          line-height: 1.45;
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
          animation: chatFadeIn 0.22s ease-out;
        }
        .message.sent .message-bubble {
          border-bottom-right-radius: 6px;
          background: #059669;
          color: white;
        }
        .message.received .message-bubble {
          border: 1px solid #e2e8f0;
          border-bottom-left-radius: 6px;
          background: white;
          color: #0f172a;
        }
        .message-bubble p {
          margin: 0;
        }
        .message-bubble img,
        .message-bubble video {
          display: block;
          max-width: min(68vw, 420px);
          border-radius: 12px;
        }
        .message-bubble audio {
          width: min(68vw, 320px);
          max-width: 100%;
        }
        .message-time {
          display: block;
          margin-top: 6px;
          text-align: right;
          font-size: 11px;
          font-weight: 500;
          opacity: 0.72;
        }
        .message.sent .message-time {
          color: rgba(255, 255, 255, 0.82);
        }
        .message.received .message-time {
          color: #64748b;
        }
        .read-status {
          margin-left: 3px;
        }
        .message-attachment {
          display: flex;
          min-width: min(68vw, 280px);
          max-width: min(68vw, 420px);
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .message-attachment button {
          flex: 0 0 auto;
          border: 0;
          border-radius: 999px;
          background: rgba(15, 23, 42, 0.1);
          color: inherit;
          cursor: pointer;
          font-size: 12px;
          font-weight: 700;
          padding: 6px 10px;
        }
        .message.sent .message-attachment button {
          background: rgba(255, 255, 255, 0.22);
        }
        .message-attachment button:hover {
          background: rgba(15, 23, 42, 0.16);
        }
        .message.sent .message-attachment button:hover {
          background: rgba(255, 255, 255, 0.3);
        }
        .message-placeholder {
          font-weight: 600;
        }
      `}</style>
    </div>
  );
}

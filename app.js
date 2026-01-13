// -----------------------------
// Helpers
// -----------------------------
function $(id){ return document.getElementById(id); }

const statusLine = $("statusLine");
function setStatus(text){ statusLine.textContent = text; }

// -----------------------------
// n8n webhook (linked to your production URL)
// -----------------------------
const N8N_SIGNUP_WEBHOOK_URL = "https://esh1991.app.n8n.cloud/webhook/ccd103a6-2ebb-4c03-9010-f9abcbd9a70d";

// -----------------------------
// Tabs (Right side)
// -----------------------------
const tabScriptBtn = $("tabScriptBtn");
const tabAnalysisBtn = $("tabAnalysisBtn");
const scriptPanel = $("scriptPanel");
const analysisPanel = $("analysisPanel");
const tabBadge = $("tabBadge");

function showRightTab(which){
  const isScript = which === "script";
  tabScriptBtn.classList.toggle("active", isScript);
  tabAnalysisBtn.classList.toggle("active", !isScript);
  scriptPanel.style.display = isScript ? "block" : "none";
  analysisPanel.style.display = isScript ? "none" : "block";
}
tabScriptBtn.addEventListener("click", () => showRightTab("script"));
tabAnalysisBtn.addEventListener("click", () => showRightTab("analysis"));

// -----------------------------
// Interviewer clips
// -----------------------------
const INTERVIEWER_CLIPS = [
  "./clips/interview1.mp4",
  "./clips/interview2.mp4",
  "./clips/interview3.mp4",
];
let currentClip = null;
const mainVideo = $("mainVideo");
const videoOverlay = $("videoOverlay");

function pickRandomClip(exclude){
  if (!INTERVIEWER_CLIPS.length) return null;
  let candidate = INTERVIEWER_CLIPS[Math.floor(Math.random() * INTERVIEWER_CLIPS.length)];
  if (INTERVIEWER_CLIPS.length > 1 && candidate === exclude) return pickRandomClip(exclude);
  return candidate;
}

function loadInterviewerClip(path){
  if (!path) return;
  currentClip = path;
  mainVideo.pause();
  mainVideo.src = path;
  mainVideo.load();
  videoOverlay.style.display = "flex";
  setStatus("Interviewer ready.");
}

async function playCurrentClip(){
  try{
    videoOverlay.style.display = "none";
    mainVideo.currentTime = 0;
    await mainVideo.play();
    setStatus("Speak after the prompt.");
  }catch(err){
    alert("Please click anywhere on the page first to enable video.");
  }
}

(function init(){ loadInterviewerClip(pickRandomClip(null)); })();

$("startInterviewBtn").addEventListener("click", () => playCurrentClip());
$("changeInterviewerBtn").addEventListener("click", () => {
  loadInterviewerClip(pickRandomClip(currentClip));
  playCurrentClip();
});

// -----------------------------
// Notes autosave
// -----------------------------
const notes = $("notes");
const LS_KEY = "pitchperfect_notes_v1";
const saved = localStorage.getItem(LS_KEY);
if (saved) notes.value = saved;

notes.addEventListener("input", () => {
  tabBadge.textContent = "SAVING…";
  localStorage.setItem(LS_KEY, notes.value);
  setTimeout(() => tabBadge.textContent = "SAVED", 500);
});

// -----------------------------
// Transcription Cleaning Logic
// -----------------------------
function cleanAndTightenTranscript(rawTranscript){
  let t = (rawTranscript || "").trim();
  if (!t) return "";

  // Remove filler sounds
  t = t.replace(/\b(um+|uh+|erm+|er+|ah+)\b/gi, "");
  // Remove common verbal crutches
  t = t.replace(/\b(basically|actually|literally|kind of|sort of|you know|i mean)\b/gi, "");
  // Remove duplicates (e.g., "I I think")
  t = t.replace(/\b(\w+)(\s+\1\b)+/gi, "$1");
  // Clean spacing
  t = t.replace(/\s+/g, " ").trim();
  
  if (!t) return "—";
  // Capitalize first letter and add period
  t = t.charAt(0).toUpperCase() + t.slice(1);
  if (!/[.!?]$/.test(t)) t += ".";
  return t;
}

// -----------------------------
// Audio & Speech Logic
// -----------------------------
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let finalTranscript = "";
let recognitionRunning = false;

if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = "en-US";
  recognition.onresult = (event) => {
    let interim = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const res = event.results[i];
      if (res.isFinal) finalTranscript += res[0].transcript + " ";
      else interim += res[0].transcript;
    }
    $("transcriptBox").textContent = (finalTranscript + interim).trim();
  };
}

let mediaRecorder = null;
let audioChunks = [];

async function startRecording(){
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];
    mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);
    mediaRecorder.onstop = () => {
      const blob = new Blob(audioChunks, { type: 'audio/webm' });
      $("audioPlayback").src = URL.createObjectURL(blob);
      $("audioPreview").style.display = "block";
      stream.getTracks().forEach(t => t.stop());
    };

    mediaRecorder.start();
    finalTranscript = "";
    if (recognition) { recognition.start(); recognitionRunning = true; }
    setRecUI(true);
    setStatus("Recording and listening...");
  } catch (err) {
    alert("Microphone access denied.");
  }
}

function stopRecording(){
  if (mediaRecorder) mediaRecorder.stop();
  if (recognition) recognition.stop();
  setRecUI(false);
  setStatus("Analysis complete.");

  // UX Improvement: Process and Auto-Switch Tab
  setTimeout(() => {
    const raw = $("transcriptBox").textContent;
    const { total, breakdownText } = countFillers(raw);
    $("fillerTotal").textContent = total;
    $("fillerBreakdown").textContent = breakdownText;
    $("recommendedScriptBox").textContent = cleanAndTightenTranscript(raw);
    $("analysisBadge").textContent = "READY";
    showRightTab("analysis"); // Automatically switch to show results
  }, 600);
}

function setRecUI(on){
  $("recDot").classList.toggle("on", on);
  $("recLabel").textContent = on ? "RECORDING" : "IDLE";
  $("recStartBtn").disabled = on;
  $("recStopBtn").disabled = !on;
}

$("recStartBtn").addEventListener("click", startRecording);
$("recStopBtn").addEventListener("click", stopRecording);

function countFillers(text){
  const t = text.toLowerCase();
  const patterns = [
    { label: "um/uh", re: /\b(um+|uh+)\b/g },
    { label: "like", re: /\blike\b/g },
    { label: "you know", re: /\byou know\b/g },
    { label: "actually/basically", re: /\b(actually|basically)\b/g }
  ];
  let total = 0;
  let breakdown = [];
  patterns.forEach(p => {
    const count = (t.match(p.re) || []).length;
    if (count > 0) { total += count; breakdown.push(`${p.label}: ${count}`); }
  });
  return { total, breakdownText: breakdown.join("\n") || "No fillers detected!" };
}

// -----------------------------
// Signup & Clipboard
// -----------------------------
$("signupForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = $("signupEmail").value;
  const btn = $("signupBtn");
  btn.disabled = true;
  btn.textContent = "Sending...";

  try {
    const res = await fetch(N8N_SIGNUP_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, source: "pitchperfect_web", date: new Date().toISOString() }),
    });
    if (res.ok) {
      $("signupNote").style.display = "block";
      $("signupEmail").value = "";
    } else { throw new Error(); }
  } catch {
    $("signupError").style.display = "block";
  } finally {
    btn.disabled = false;
    btn.textContent = "Notify me";
  }
});

$("copyScriptBtn").addEventListener("click", () => {
  const text = $("recommendedScriptBox").textContent;
  if (text === "—") return;
  navigator.clipboard.writeText(text);
  const prev = $("copyScriptBtn").textContent;
  $("copyScriptBtn").textContent = "Copied!";
  setTimeout(() => $("copyScriptBtn").textContent = prev, 2000);
});

$("resetBtn").addEventListener("click", () => {
  localStorage.removeItem(LS_KEY);
  location.reload();
});

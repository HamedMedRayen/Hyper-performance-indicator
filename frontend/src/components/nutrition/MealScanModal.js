import React, { useState, useRef, useEffect } from "react";
import { X, Camera, ShieldCheck, Video, VideoOff, Upload, Layers, Flame, Check, RefreshCw, Clock, Sunrise, Sun, Moon, Cookie, Sparkles } from "lucide-react";
import { api } from "../../utils/api";
import { useToast } from "../common/Toast";

const MEAL_CATEGORIES = [
  { id: "Breakfast", label: "Breakfast", icon: Sunrise },
  { id: "Lunch", label: "Lunch", icon: Sun },
  { id: "Dinner", label: "Dinner", icon: Moon },
  { id: "Snacks", label: "Snacks", icon: Cookie },
];

export default function MealScanModal({ onClose, onLog }) {
  const [selectedImage, setSelectedImage] = useState(null); // Data URL string
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState("Breakfast");
  const [logging, setLogging] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);

  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const videoRef = useRef(null);
  const toast = useToast();

  // Stop live camera stream on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Bind camera stream to video element when DOM mounts
  useEffect(() => {
    if (cameraActive && cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.play().catch(e => console.error("Video play error:", e));
    }
  }, [cameraActive, cameraStream]);

  const startCamera = async () => {
    try {
      setSelectedImage(null);
      setScanResult(null);
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }
        });
      } catch (e1) {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      }
      setCameraStream(stream);
      setCameraActive(true);
    } catch (err) {
      console.error("Camera access error:", err);
      if (toast?.error) toast.error("Could not access camera: " + (err.message || "Device unavailable"));
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setCameraActive(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    const MAX_SIZE = 800;
    let width = video.videoWidth || 640;
    let height = video.videoHeight || 480;

    if (width > height) {
      if (width > MAX_SIZE) {
        height = Math.round((height * MAX_SIZE) / width);
        width = MAX_SIZE;
      }
    } else {
      if (height > MAX_SIZE) {
        width = Math.round((width * MAX_SIZE) / height);
        height = MAX_SIZE;
      }
    }

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, width, height);

    const capturedDataUrl = canvas.toDataURL("image/jpeg", 0.85);
    stopCamera();
    setSelectedImage(capturedDataUrl);
    runVisionScan(capturedDataUrl);
  };

  const runVisionScan = async (imageToScan) => {
    const targetImage = imageToScan || selectedImage;
    if (!targetImage) return;
    setScanning(true);
    setScanResult(null);
    try {
      const res = await api.scanMealVision(targetImage, false);
      if (res && res.success) {
        setScanResult(res);
      } else {
        if (toast?.error) toast.error("Vision scan failed to parse meal");
      }
    } catch (err) {
      console.error("Meal Vision Scan Error:", err);
      if (toast?.error) toast.error(err.message || "Failed to scan meal with AI Vision");
    } finally {
      setScanning(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    processFile(file);
  };

  const processFile = (file) => {
    if (!file.type.startsWith("image/")) {
      if (toast?.error) toast.error("Please upload an image file (PNG, JPG, WEBP).");
      return;
    }

    stopCamera();
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_SIZE = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height = Math.round((height * MAX_SIZE) / width);
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width = Math.round((width * MAX_SIZE) / height);
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        const resizedDataUrl = canvas.toDataURL("image/jpeg", 0.85);
        setSelectedImage(resizedDataUrl);
        setScanResult(null);

        // Auto-trigger scan instantly on image selection
        runVisionScan(resizedDataUrl);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleLogMeal = async () => {
    if (!scanResult || !scanResult.totals) return;
    if (!selectedCategory) {
      if (toast?.error) toast.error("Please specify when you ate this meal (Breakfast, Lunch, Dinner, or Snacks)");
      return;
    }
    setLogging(true);
    try {
      await api.logNutrition({
        meal_name: scanResult.meal_name || "Vision Scanned Meal",
        meal_category: selectedCategory,
        amount: 1,
        unit: "serving",
        calories: scanResult.totals.calories || 0,
        protein_g: scanResult.totals.protein_g || 0,
        carbs_g: scanResult.totals.carbs_g || 0,
        fat_g: scanResult.totals.fat_g || 0,
        fiber_g: scanResult.totals.fiber_g || 0
      });
      if (toast?.success) toast.success(`Meal logged under ${selectedCategory}!`);
      if (onLog) onLog();
      onClose();
    } catch (err) {
      console.error("Failed to log meal:", err);
      if (toast?.error) toast.error("Failed to log meal");
    } finally {
      setLogging(false);
    }
  };

  const isResultView = !cameraActive && selectedImage && !scanning && scanResult;

  // Macro ratio calculations for visual bar
  const pG = scanResult?.totals?.protein_g || 0;
  const cG = scanResult?.totals?.carbs_g || 0;
  const fG = scanResult?.totals?.fat_g || 0;
  const totalMacroCal = (pG * 4) + (cG * 4) + (fG * 9) || 1;
  const pPct = Math.round(((pG * 4) / totalMacroCal) * 100) || 0;
  const cPct = Math.round(((cG * 4) / totalMacroCal) * 100) || 0;
  const fPct = Math.max(0, 100 - pPct - cPct);

  return (
    <div className="modal-overlay" style={{
      zIndex: 1000,
      position: "fixed",
      inset: 0,
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      background: "var(--overlay-bg, rgba(0, 0, 0, 0.82))",
      backdropFilter: "blur(16px)",
      WebkitBackdropFilter: "blur(16px)",
      padding: 16
    }}>
      <div className="card modal-content" style={{
        maxWidth: isResultView ? 920 : 480,
        width: "100%",
        maxHeight: "90vh",
        overflowY: "auto",
        borderRadius: 24,
        border: "1px solid var(--border-card, rgba(255,255,255,0.1))",
        background: "var(--bg-card, #0f172a)",
        padding: isResultView ? "20px 24px" : "20px",
        boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.85), 0 0 40px rgba(0, 242, 254, 0.08)",
        transition: "max-width 0.3s cubic-bezier(0.16, 1, 0.3, 1), padding 0.3s ease"
      }}>

        {/* Modal Top Header Bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 12,
              background: "linear-gradient(135deg, rgba(0, 242, 254, 0.2) 0%, rgba(186, 85, 211, 0.2) 100%)",
              border: "1px solid rgba(0, 242, 254, 0.4)",
              display: "flex", justifyContent: "center", alignItems: "center", color: "#00f2fe",
              boxShadow: "0 0 15px rgba(0, 242, 254, 0.2)"
            }}>
              <Camera size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0, color: "var(--color-text, #fff)", letterSpacing: "-0.3px" }}>
                AI Photo Meal Scanner
              </h2>
              <div style={{ fontSize: 11.5, color: "var(--color-text-3, #94a3b8)", marginTop: 2, display: "flex", alignItems: "center", gap: 5 }}>
                <ShieldCheck size={13} color="#00f2fe" /> AI Nutrition Vision Analysis
              </div>
            </div>
          </div>
          <button
            onClick={() => { stopCamera(); onClose(); }}
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 10,
              color: "var(--color-text-3, #94a3b8)",
              cursor: "pointer",
              padding: "6px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.2s ease"
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.12)"; e.currentTarget.style.color = "#fff"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = "var(--color-text-3, #94a3b8)"; }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Live Camera Viewfinder */}
        {cameraActive && (
          <div style={{ position: "relative", marginBottom: 16 }}>
            <div style={{
              position: "relative", borderRadius: 18, overflow: "hidden",
              border: "2px solid #00f2fe", maxHeight: 280, background: "#000",
              display: "flex", justifyContent: "center", alignItems: "center",
              boxShadow: "0 0 30px rgba(0, 242, 254, 0.25)"
            }}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{ width: "100%", height: "100%", objectFit: "cover", maxHeight: 280 }}
              />

              <div style={{
                position: "absolute", inset: 20, border: "2px dashed rgba(0, 242, 254, 0.7)",
                borderRadius: 14, pointerEvents: "none", display: "flex", justifyContent: "center", alignItems: "center"
              }}>
                <span style={{ fontSize: 11.5, color: "#00f2fe", background: "rgba(0,0,0,0.75)", padding: "5px 10px", borderRadius: 8, fontWeight: 700, backdropFilter: "blur(4px)" }}>
                  Center meal in camera viewfinder
                </span>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button
                onClick={stopCamera}
                style={{
                  flex: 1, padding: "12px", borderRadius: 12,
                  background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
                  color: "#fff", fontWeight: 700, fontSize: 12.5, cursor: "pointer",
                  display: "flex", justifyContent: "center", alignItems: "center", gap: 6,
                  transition: "all 0.2s"
                }}
              >
                <VideoOff size={15} /> Cancel Camera
              </button>
              <button
                onClick={capturePhoto}
                style={{
                  flex: 2, padding: "12px", borderRadius: 12,
                  background: "var(--aura-accent, #00f2fe)",
                  border: "none", color: "var(--color-on-accent, #000)", fontWeight: 800, fontSize: 13,
                  cursor: "pointer", display: "flex", justifyContent: "center", alignItems: "center", gap: 8,
                  boxShadow: "0 4px 20px color-mix(in srgb, var(--aura-accent, #00f2fe) 40%, transparent)"
                }}
              >
                <Camera size={18} /> Snap Photo & Run Scan
              </button>
            </div>
          </div>
        )}

        {/* Initial Selection & Upload Options */}
        {!cameraActive && !selectedImage && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 8 }}>
            <button
              onClick={startCamera}
              style={{
                width: "100%", padding: "24px 20px", borderRadius: 18,
                background: "linear-gradient(135deg, rgba(0, 242, 254, 0.12) 0%, rgba(186, 85, 211, 0.08) 100%)",
                border: "2px solid rgba(0, 242, 254, 0.4)", color: "var(--color-text, #fff)", cursor: "pointer",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
                transition: "all 0.25s ease",
                boxShadow: "0 8px 24px rgba(0, 242, 254, 0.1)"
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "#00f2fe"; e.currentTarget.style.transform = "translateY(-2px)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(0, 242, 254, 0.4)"; e.currentTarget.style.transform = "none"; }}
            >
              <div style={{
                width: 56, height: 56, borderRadius: "50%",
                background: "linear-gradient(135deg, #00f2fe 0%, #ba55d3 100%)",
                display: "flex", justifyContent: "center", alignItems: "center", color: "#000",
                boxShadow: "0 4px 20px rgba(0, 242, 254, 0.4)"
              }}>
                <Camera size={28} />
              </div>
              <span style={{ fontSize: 16, fontWeight: 800, color: "#fff", letterSpacing: "-0.2px" }}>
                Open Live Vision Camera
              </span>
              <span style={{ fontSize: 12.5, color: "#94a3b8", textAlign: "center", maxWidth: 300 }}>
                Point camera at meal & snap photo for instant AI food and calorie breakdown
              </span>
            </button>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <input
                type="file"
                ref={cameraInputRef}
                accept="image/*"
                capture="environment"
                style={{ display: "none" }}
                onChange={handleFileChange}
              />
              <button
                onClick={() => cameraInputRef.current && cameraInputRef.current.click()}
                style={{
                  padding: "14px", borderRadius: 14,
                  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
                  color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer",
                  display: "flex", justifyContent: "center", alignItems: "center", gap: 8,
                  transition: "all 0.2s ease"
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
              >
                <Video size={16} color="#00f2fe" /> Device Camera
              </button>

              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                style={{ display: "none" }}
                onChange={handleFileChange}
              />
              <button
                onClick={() => fileInputRef.current && fileInputRef.current.click()}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                style={{
                  padding: "14px", borderRadius: 14,
                  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
                  color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer",
                  display: "flex", justifyContent: "center", alignItems: "center", gap: 8,
                  transition: "all 0.2s ease"
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
              >
                <Upload size={16} color="#ba55d3" /> Upload Photo
              </button>
            </div>
          </div>
        )}

        {/* Selected Image & Scanning Loading State */}
        {!cameraActive && selectedImage && scanning && (
          <div style={{ position: "relative", margin: "10px 0 16px" }}>
            <div style={{
              position: "relative", borderRadius: 18, overflow: "hidden",
              border: "1px solid rgba(0, 242, 254, 0.4)", height: 230,
              background: "#000", display: "flex", justifyContent: "center", alignItems: "center",
              boxShadow: "0 0 30px rgba(0, 242, 254, 0.15)"
            }}>
              <img
                src={selectedImage}
                alt="Meal to scan"
                style={{ width: "100%", height: "100%", objectFit: "cover", filter: "brightness(0.4) blur(2px)" }}
              />

              <div style={{
                position: "absolute", inset: 0,
                background: "radial-gradient(ellipse at center, rgba(0,242,254,0.15) 0%, rgba(186,85,211,0.25) 100%)",
                display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 14
              }}>
                <div style={{
                  width: 48, height: 48, borderRadius: "50%",
                  border: "3px solid rgba(255,255,255,0.1)", borderTopColor: "#00f2fe", borderRightColor: "#ba55d3",
                  animation: "spin 1s linear infinite"
                }} />
                <div style={{ textAlign: "center" }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: "#fff", textShadow: "0 2px 8px rgba(0,0,0,0.9)", display: "block" }}>
                    Analyzing Meal Components with AI...
                  </span>
                  <span style={{ fontSize: 11.5, color: "#00f2fe", marginTop: 4, display: "block", fontWeight: 600 }}>
                    Detecting ingredients, portion sizes & macros
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* HORIZONTAL SCAN RESULTS VIEW (Side-by-Side on Desktop/Tablet, Responsive Stack on Mobile) */}
        {isResultView && (
          <div className="meal-scan-horizontal-grid">

            {/* ══════════ LEFT COLUMN: Visual Showcase & Nutritional Macros Summary ══════════ */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

              {/* Photo Showcase with Glassmorphism Overlays */}
              <div style={{
                position: "relative",
                borderRadius: 18,
                overflow: "hidden",
                height: 210,
                border: "1px solid rgba(255, 255, 255, 0.12)",
                boxShadow: "0 8px 24px rgba(0,0,0,0.4)"
              }}>
                <img
                  src={selectedImage}
                  alt={scanResult.meal_name || "Scanned meal"}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />

                {/* Change Image Button */}
                <button
                  onClick={() => { setSelectedImage(null); setScanResult(null); startCamera(); }}
                  style={{
                    position: "absolute", top: 12, right: 12,
                    background: "rgba(0, 0, 0, 0.7)",
                    backdropFilter: "blur(8px)",
                    border: "1px solid rgba(255, 255, 255, 0.25)",
                    color: "#fff", borderRadius: 8, padding: "6px 12px",
                    fontSize: 12, fontWeight: 700, cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 6,
                    boxShadow: "0 2px 10px rgba(0, 0, 0, 0.6)",
                    transition: "all 0.2s"
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,0,0,0.9)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(0,0,0,0.7)"; }}
                >
                  <RefreshCw size={13} /> Change Image
                </button>
              </div>

              {/* Detected Dish Title & Summary Card */}
              <div style={{
                background: "rgba(255, 255, 255, 0.03)",
                borderRadius: 16,
                padding: "14px 16px",
                border: "1px solid rgba(255, 255, 255, 0.08)"
              }}>
                <div style={{
                  fontSize: 10.5,
                  textTransform: "uppercase",
                  letterSpacing: "0.8px",
                  color: "#818cf8",
                  fontWeight: 800,
                  marginBottom: 4,
                  display: "flex",
                  alignItems: "center",
                  gap: 6
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#818cf8", display: "inline-block" }} />
                  DETECTED DISH
                </div>
                <h3 style={{ fontSize: 19, fontWeight: 800, color: "#fff", margin: "0 0 6px 0", letterSpacing: "-0.3px" }}>
                  {scanResult.meal_name}
                </h3>
                <p style={{ fontSize: 12.5, color: "rgba(255, 255, 255, 0.7)", margin: 0, lineHeight: "1.45" }}>
                  {scanResult.description}
                </p>
              </div>

              {/* Total Macros & Macro Ratio Segmented Bar */}
              {scanResult.totals && (
                <div style={{
                  background: "linear-gradient(135deg, rgba(0, 242, 254, 0.06) 0%, rgba(186, 85, 211, 0.06) 100%)",
                  borderRadius: 16,
                  padding: "14px 16px",
                  border: "1px solid rgba(0, 242, 254, 0.22)",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.2)"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: "#fff", textTransform: "uppercase", letterSpacing: "0.6px", display: "flex", alignItems: "center", gap: 6 }}>
                      <Flame size={15} color="#ff3366" /> TOTAL MACROS
                    </span>
                    <span style={{ fontSize: 20, fontWeight: 900, color: "#00f2fe", letterSpacing: "-0.5px" }}>
                      {Math.round(scanResult.totals.calories || 0)} <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.6)" }}>kcal</span>
                    </span>
                  </div>

                  {/* 4-Grid Horizontal Macro Values */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, textAlign: "center", marginBottom: 12 }}>
                    <div style={{ background: "rgba(0, 0, 0, 0.45)", borderRadius: 10, padding: "8px 4px", border: "1px solid rgba(0, 242, 254, 0.2)" }}>
                      <div style={{ fontSize: 10, color: "rgba(255, 255, 255, 0.5)", fontWeight: 700, marginBottom: 2 }}>PROTEIN</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: "#00f2fe" }}>
                        {Math.round(scanResult.totals.protein_g || 0)}g
                      </div>
                    </div>
                    <div style={{ background: "rgba(0, 0, 0, 0.45)", borderRadius: 10, padding: "8px 4px", border: "1px solid rgba(245, 158, 11, 0.2)" }}>
                      <div style={{ fontSize: 10, color: "rgba(255, 255, 255, 0.5)", fontWeight: 700, marginBottom: 2 }}>CARBS</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: "#fbbf24" }}>
                        {Math.round(scanResult.totals.carbs_g || 0)}g
                      </div>
                    </div>
                    <div style={{ background: "rgba(0, 0, 0, 0.45)", borderRadius: 10, padding: "8px 4px", border: "1px solid rgba(244, 63, 94, 0.2)" }}>
                      <div style={{ fontSize: 10, color: "rgba(255, 255, 255, 0.5)", fontWeight: 700, marginBottom: 2 }}>FAT</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: "#f43f5e" }}>
                        {Math.round(scanResult.totals.fat_g || 0)}g
                      </div>
                    </div>
                    <div style={{ background: "rgba(0, 0, 0, 0.45)", borderRadius: 10, padding: "8px 4px", border: "1px solid rgba(16, 185, 129, 0.2)" }}>
                      <div style={{ fontSize: 10, color: "rgba(255, 255, 255, 0.5)", fontWeight: 700, marginBottom: 2 }}>FIBER</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: "#10b981" }}>
                        {Math.round(scanResult.totals.fiber_g || 0)}g
                      </div>
                    </div>
                  </div>

                  {/* Macro Ratio Progress Bar */}
                  <div>
                    <div style={{ height: 6, width: "100%", borderRadius: 6, overflow: "hidden", display: "flex", background: "rgba(255,255,255,0.06)" }}>
                      <div style={{ width: `${pPct}%`, background: "#00f2fe", transition: "width 0.4s ease" }} title={`Protein ${pPct}%`} />
                      <div style={{ width: `${cPct}%`, background: "#fbbf24", transition: "width 0.4s ease" }} title={`Carbs ${cPct}%`} />
                      <div style={{ width: `${fPct}%`, background: "#f43f5e", transition: "width 0.4s ease" }} title={`Fat ${fPct}%`} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 10, color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>
                      <span style={{ color: "#00f2fe" }}>● {pPct}% P</span>
                      <span style={{ color: "#fbbf24" }}>● {cPct}% C</span>
                      <span style={{ color: "#f43f5e" }}>● {fPct}% F</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ══════════ RIGHT COLUMN: Component Breakdown & Logging Controls ══════════ */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

              {/* Individual Components Breakdown */}
              {scanResult.components && scanResult.components.length > 0 && (
                <div style={{
                  background: "rgba(255, 255, 255, 0.02)",
                  borderRadius: 16,
                  padding: "14px 16px",
                  border: "1px solid rgba(255, 255, 255, 0.07)"
                }}>
                  <div style={{ fontSize: 12.5, fontWeight: 800, color: "#fff", marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Layers size={16} color="#ba55d3" /> Component Breakdown
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#ba55d3", background: "rgba(186, 85, 211, 0.15)", padding: "2px 8px", borderRadius: 6 }}>
                      {scanResult.components.length} ingredients
                    </span>
                  </div>

                  {/* Scrollable list for components */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 220, overflowY: "auto", paddingRight: 4 }}>
                    {scanResult.components.map((comp, idx) => (
                      <div key={idx} style={{
                        background: "rgba(255, 255, 255, 0.03)",
                        borderRadius: 12,
                        padding: "10px 12px",
                        border: "1px solid rgba(255, 255, 255, 0.06)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        transition: "background 0.2s ease"
                      }}>
                        <div style={{ flex: 1, minWidth: 0, marginRight: 10 }}>
                          <div style={{ fontWeight: 800, fontSize: 13, color: "#fff", display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                            <span>{comp.name}</span>
                            {comp.portion && (
                              <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(255, 255, 255, 0.5)", background: "rgba(255,255,255,0.06)", padding: "1px 6px", borderRadius: 4 }}>
                                {comp.portion}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 11, color: "rgba(255, 255, 255, 0.5)", marginTop: 3 }}>
                            P: {Math.round(comp.protein_g || 0)}g • C: {Math.round(comp.carbs_g || 0)}g • F: {Math.round(comp.fat_g || 0)}g
                          </div>
                        </div>
                        <div style={{
                          fontWeight: 800,
                          fontSize: 13.5,
                          color: "#00f2fe",
                          background: "rgba(0, 242, 254, 0.08)",
                          border: "1px solid rgba(0, 242, 254, 0.2)",
                          padding: "4px 8px",
                          borderRadius: 8,
                          whiteSpace: "nowrap"
                        }}>
                          {Math.round(comp.calories || 0)} kcal
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Mandatory Meal Time Selection */}
              <div style={{
                background: "rgba(255, 255, 255, 0.03)",
                borderRadius: 16,
                padding: "14px 16px",
                border: "1px solid rgba(255, 255, 255, 0.08)"
              }}>
                <div style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: "#fff",
                  textTransform: "uppercase",
                  letterSpacing: "0.6px",
                  marginBottom: 10,
                  display: "flex",
                  alignItems: "center",
                  gap: 6
                }}>
                  <Clock size={14} color="#00f2fe" /> WHEN DID YOU EAT THIS MEAL? <span style={{ color: "#ff0055" }}>*</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
                  {MEAL_CATEGORIES.map((cat) => {
                    const isSelected = selectedCategory === cat.id;
                    const IconComponent = cat.icon;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setSelectedCategory(cat.id)}
                        style={{
                          padding: "10px 4px",
                          borderRadius: 12,
                          border: isSelected ? "2px solid #00f2fe" : "1px solid rgba(255, 255, 255, 0.1)",
                          background: isSelected
                            ? "linear-gradient(135deg, rgba(0, 242, 254, 0.25) 0%, rgba(186, 85, 211, 0.25) 100%)"
                            : "rgba(255, 255, 255, 0.03)",
                          color: isSelected ? "#00f2fe" : "rgba(255, 255, 255, 0.6)",
                          fontWeight: isSelected ? 800 : 600,
                          fontSize: 12,
                          cursor: "pointer",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: 6,
                          transition: "all 0.2s ease",
                          boxShadow: isSelected ? "0 2px 12px rgba(0, 242, 254, 0.25)" : "none"
                        }}
                      >
                        <IconComponent size={18} color={isSelected ? "#00f2fe" : "rgba(255, 255, 255, 0.5)"} />
                        <span style={{ color: isSelected ? "#fff" : "rgba(255, 255, 255, 0.7)" }}>{cat.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Bottom Action Buttons */}
              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button
                  onClick={() => { setSelectedImage(null); setScanResult(null); startCamera(); }}
                  style={{
                    flex: 1, padding: "13px", borderRadius: 12,
                    background: "rgba(255, 255, 255, 0.06)", border: "1px solid rgba(255, 255, 255, 0.12)",
                    color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer",
                    display: "flex", justifyContent: "center", alignItems: "center", gap: 6,
                    transition: "all 0.2s ease"
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(255, 255, 255, 0.06)"; }}
                >
                  <RefreshCw size={14} /> Scan Another
                </button>

                <button
                  onClick={handleLogMeal}
                  disabled={logging}
                  style={{
                    flex: 2, padding: "13px", borderRadius: 12,
                    background: "var(--aura-accent, #00f2fe)",
                    border: "none", color: "var(--color-on-accent, #000)", fontWeight: 800, fontSize: 13.5,
                    cursor: "pointer", display: "flex", justifyContent: "center", alignItems: "center", gap: 8,
                    boxShadow: "0 4px 20px color-mix(in srgb, var(--aura-accent, #00f2fe) 40%, transparent)",
                    transition: "all 0.2s ease",
                    opacity: logging ? 0.7 : 1
                  }}
                  onMouseEnter={e => { if (!logging) e.currentTarget.style.transform = "translateY(-1px)"; }}
                  onMouseLeave={e => { if (!logging) e.currentTarget.style.transform = "none"; }}
                >
                  <Check size={16} /> {logging ? "Logging..." : `Log to ${selectedCategory}`}
                </button>
              </div>

            </div>

          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .meal-scan-horizontal-grid {
          display: grid;
          grid-template-columns: 1fr 1.15fr;
          gap: 20px;
          align-items: start;
        }
        @media (max-width: 768px) {
          .meal-scan-horizontal-grid {
            grid-template-columns: 1fr;
            gap: 16px;
          }
        }
      `}</style>
    </div>
  );
}

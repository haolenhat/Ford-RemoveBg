import React, { useRef, useEffect, useState, useCallback } from 'react';
import { SelfieSegmentation } from '@mediapipe/selfie_segmentation';
import { Camera } from '@mediapipe/camera_utils';
import { backgroundConfigs } from '../assets/backgrounds';

interface BackgroundRemoverProps {
  selectedBackground: string;
  onBackgroundChange: (background: string) => void;
}

const BackgroundRemover: React.FC<BackgroundRemoverProps> = ({ 
  selectedBackground, 
  onBackgroundChange: _onBackgroundChange
}) => {
  // ===== CAMERA CONFIGURATION VARIABLES =====
  // Distance settings (in meters)
  const MIN_DISTANCE = 1.5;  // Minimum distance to allow capture
  const MAX_DISTANCE = 2.0;  // Maximum distance to allow capture
  
  // Canvas size settings - calculated to match background aspect ratio (2953×2362)
  // Background aspect ratio: 2953/2362 ≈ 1.25 (width/height)
  const CANVAS_WIDTH = 1280;  // Keep width
  const CANVAS_HEIGHT = 1024; // Adjusted height to match background ratio (1280/1.25 = 1024)
  
  // Stillness detection settings
  const STILLNESS_DURATION = 2000;  // Time to stand still (milliseconds)
  const MOTION_THRESHOLD = 0.02;     // Motion sensitivity (0.01 = very sensitive, 0.05 = less sensitive)
  
  // Camera viewport settings (position and size of camera window)
  // Position: center of left half of canvas
  const CAMERA_VIEWPORT = {
    x: CANVAS_WIDTH / 4 - 131,  // Center of left half (1280/4 - 262/2 = 320 - 131 = 189)
    y: CANVAS_HEIGHT / 2 - 184, // Center vertically (1024/2 - 368/2 = 512 - 184 = 328)
    width: 262,    // Width of camera window
    height: 368    // Height of camera window
  };
  
  // Camera quality settings - match canvas aspect ratio
  const CAMERA_WIDTH = 1280;
  const CAMERA_HEIGHT = 1024; // Match canvas height for proper aspect ratio
  const CAMERA_FPS = 30;

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isFlipped] = useState(false); // No flip: live view and photos match real orientation
  const [distance, setDistance] = useState<number>(0);
  const [isInRange, setIsInRange] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [readyToCapture, setReadyToCapture] = useState(false);
  const [stillnessProgress, setStillnessProgress] = useState<number>(0);
  const [isStill, setIsStill] = useState(false);
  const [backgroundHistory, setBackgroundHistory] = useState<string[]>([]);
  // Live refs to avoid stale state inside MediaPipe callback
  const countdownRef = useRef<number | null>(null);
  const isCapturingRef = useRef<boolean>(false);
  const readyToCaptureRef = useRef<boolean>(false);
  const cooldownActiveRef = useRef<boolean>(false);
  const cooldownTimeoutRef = useRef<number | null>(null);
  const isAutoCaptureRef = useRef<boolean>(false);
  const previousDistanceRef = useRef<number>(0);
  // Motion detection refs
  const previousFrameRef = useRef<ImageData | null>(null);
  const stillnessStartTimeRef = useRef<number>(0);
  const stillnessTimeoutRef = useRef<number | null>(null);
  const motionThreshold = MOTION_THRESHOLD; // Threshold for motion detection (2% of pixels)
  const selfieSegmentationRef = useRef<SelfieSegmentation | null>(null);
  const cameraRef = useRef<Camera | null>(null);
  const backgroundImageRef = useRef<HTMLImageElement | null>(null);
  const originalImageRef = useRef<HTMLCanvasElement | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);
  const capturePhotoRef = useRef<() => void>(() => {});

  // Sync state to refs
  useEffect(() => { countdownRef.current = countdown; }, [countdown]);
  useEffect(() => { isCapturingRef.current = isCapturing; }, [isCapturing]);
  useEffect(() => { readyToCaptureRef.current = readyToCapture; }, [readyToCapture]);

  // Motion detection function
  const detectMotion = useCallback((currentFrame: ImageData, previousFrame: ImageData | null) => {
    if (!previousFrame) return false;

    const currentData = currentFrame.data;
    const previousData = previousFrame.data;
    
    if (currentData.length !== previousData.length) return true;

    let differentPixels = 0;
    const totalPixels = currentData.length / 4;

    for (let i = 0; i < currentData.length; i += 4) {
      const rDiff = Math.abs(currentData[i] - previousData[i]);
      const gDiff = Math.abs(currentData[i + 1] - previousData[i + 1]);
      const bDiff = Math.abs(currentData[i + 2] - previousData[i + 2]);
      
      // If any color channel differs by more than 30, consider it motion
      if (rDiff > 30 || gDiff > 30 || bDiff > 30) {
        differentPixels++;
      }
    }

    const motionRatio = differentPixels / totalPixels;
    return motionRatio > motionThreshold;
  }, [motionThreshold]);

  // Handle stillness detection
  const handleStillnessDetection = useCallback((hasMotion: boolean) => {
    const now = Date.now();
    
    if (hasMotion) {
      // Motion detected, reset stillness
      if (stillnessTimeoutRef.current) {
        clearTimeout(stillnessTimeoutRef.current);
        stillnessTimeoutRef.current = null;
      }
      setIsStill(false);
      setStillnessProgress(0);
      stillnessStartTimeRef.current = 0;
    } else {
      // No motion detected
      if (stillnessStartTimeRef.current === 0) {
        stillnessStartTimeRef.current = now;
      }
      
      const stillnessDuration = now - stillnessStartTimeRef.current;
            const progress = Math.min(stillnessDuration / STILLNESS_DURATION, 1);
      
      setStillnessProgress(progress);
      
      if (progress >= 1 && !isStill && !isCapturingRef.current && !readyToCaptureRef.current && !cooldownActiveRef.current) {
        setIsStill(true);
        console.log('🎯 Person is still for 2 seconds! Starting countdown...');
        startCountdown(true);
      }
    }
  }, [isStill]);

  // Start countdown
  const startCountdown = useCallback((auto: boolean) => {
    if (isCapturingRef.current) {
      console.log('Countdown already in progress, skipping...');
      return; // Prevent multiple countdowns
    }
    
    console.log('🚀 Starting countdown!');
    setIsCapturing(true); isCapturingRef.current = true;
    setCountdown(3); countdownRef.current = 3;
    isAutoCaptureRef.current = auto;
    
    let currentCount = 3;
    countdownIntervalRef.current = setInterval(() => {
      currentCount--;
      console.log('Countdown tick:', currentCount);
      
      if (currentCount <= 0) {
        // Countdown finished, enable capture button
        console.log('Countdown finished!');
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
        setIsCapturing(false); isCapturingRef.current = false;
        setCountdown(null); countdownRef.current = null;
        if (isAutoCaptureRef.current) {
          // Auto capture: start cooldown immediately, then capture
          setReadyToCapture(false); readyToCaptureRef.current = false;
          console.log('🤖 Auto capturing after countdown');
          
          // Start cooldown immediately
          cooldownActiveRef.current = true;
          if (cooldownTimeoutRef.current) window.clearTimeout(cooldownTimeoutRef.current);
          cooldownTimeoutRef.current = window.setTimeout(() => {
            cooldownActiveRef.current = false;
            isAutoCaptureRef.current = false;
            console.log('🟢 Auto-capture cooldown ended');
          }, 3000);
          
          // Trigger the same capture flow as manual button
          // Delay a tick to ensure overlay clears
          setTimeout(() => {
            try { capturePhotoRef.current(); } catch (e) { console.error(e); }
          }, 0);
        } else {
          // Manual flow: just enable the button
          setReadyToCapture(true); readyToCaptureRef.current = true;
        }
      } else {
        setCountdown(currentCount); countdownRef.current = currentCount;
      }
    }, 1000);
  }, []);

  // Cleanup countdown interval on unmount
  useEffect(() => {
    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, []);

  // Estimate distance based on person size in frame
  const estimateDistance = useCallback((segmentationMask: any, imageWidth: number, imageHeight: number) => {
    try {
      // Create a temporary canvas to analyze the mask
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = imageWidth;
      tempCanvas.height = imageHeight;
      const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true } as any) as CanvasRenderingContext2D | null;
      
      if (!tempCtx) return 0;
      
      // Draw the segmentation mask
      tempCtx.drawImage(segmentationMask, 0, 0, imageWidth, imageHeight);
      
      // Get image data to count pixels (use alpha channel for reliability)
      const imageData = tempCtx.getImageData(0, 0, imageWidth, imageHeight);
      const data = imageData.data;
      
      // Count person pixels (simplified approach)
      let personPixels = 0;
      const totalPixels = imageWidth * imageHeight;
      
      for (let i = 3; i < data.length; i += 4) {
        const alpha = data[i];
        if (alpha > 200) { // Person pixel threshold
          personPixels++;
        }
      }
      
      if (personPixels === 0) return 2.5; // No person detected
      
      // Calculate person area ratio
      const personRatio = personPixels / totalPixels;
      
      // Estimate distance based on person size
      // Closer person = larger ratio = smaller distance
      // Further person = smaller ratio = larger distance
      let estimatedDistance = 0;
      
      if (personRatio > 0.25) {
        estimatedDistance = 0.5; // Very close
      } else if (personRatio > 0.15) {
        estimatedDistance = 0.8; // Close
      } else if (personRatio > 0.08) {
        estimatedDistance = 1.2; // Medium-close
      } else if (personRatio > 0.04) {
        estimatedDistance = 1.8; // Medium
      } else if (personRatio > 0.01) {
        estimatedDistance = 2.2; // Far
      } else {
        estimatedDistance = 2.5; // Very far
      }
      
      return estimatedDistance;
    } catch (error) {
      console.error('Error estimating distance:', error);
      return 0;
    }
  }, []);

  const initializeMediaPipe = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;

    try {
      // Initialize Selfie Segmentation
      const selfieSegmentation = new SelfieSegmentation({
        locateFile: (file) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`;
        }
      });

      selfieSegmentation.setOptions({
        modelSelection: 1, // 0 for general, 1 for landscape
        selfieMode: true,
      });

      // Store references
      selfieSegmentationRef.current = selfieSegmentation;
      
      console.log('🎯 MediaPipe initialized for motion detection');

      selfieSegmentation.onResults((results) => {
        if (!canvasRef.current || !videoRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Set canvas size using configuration variables
        const targetWidth = CANVAS_WIDTH;
        const targetHeight = CANVAS_HEIGHT;
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        
        // Calculate aspect ratio for proper scaling
        const canvasAspectRatio = targetWidth / targetHeight;

        // Define camera viewport area using configuration variables
        const cameraViewport = CAMERA_VIEWPORT;

        // Enable high quality rendering
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Base draw to avoid black screen even if later effects fail
        try {
          ctx.globalCompositeOperation = 'source-over';
          ctx.drawImage(results.image, 0, 0, targetWidth, targetHeight);
        } catch (e) {
          console.warn('Base draw failed:', e);
        }

        // No flip: draw as-is so live matches real-world orientation

        // Store original image for capture
        if (!originalImageRef.current) {
          originalImageRef.current = document.createElement('canvas');
          originalImageRef.current.width = targetWidth;
          originalImageRef.current.height = targetHeight;
        }
        const originalCtx = originalImageRef.current.getContext('2d');
        if (originalCtx) {
          originalCtx.clearRect(0, 0, targetWidth, targetHeight);
          
          // Store original image WITHOUT flip (for capture)
          originalCtx.drawImage(results.image, 0, 0, targetWidth, targetHeight);
          console.log('📸 Original image saved for capture');
        }

        // Estimate distance and check if in range
        const rawDistance = estimateDistance(results.segmentationMask, targetWidth, targetHeight);
        
        // Smooth the distance to avoid jittery readings
        const smoothingFactor = 0.3;
        const smoothedDistance = previousDistanceRef.current === 0 
          ? rawDistance 
          : previousDistanceRef.current * (1 - smoothingFactor) + rawDistance * smoothingFactor;
        
        previousDistanceRef.current = smoothedDistance;
        setDistance(smoothedDistance);

        // Check if person is within distance range using configuration variables
        const inRange = smoothedDistance <= MAX_DISTANCE && smoothedDistance >= MIN_DISTANCE;
        setIsInRange(inRange);

        // Motion detection for stillness
        if (inRange) {
          // Get current frame data for motion detection
          const currentFrameData = ctx.getImageData(0, 0, targetWidth, targetHeight);
          const hasMotion = detectMotion(currentFrameData, previousFrameRef.current);
          
          // Update previous frame
          previousFrameRef.current = currentFrameData;
          
          // Handle stillness detection
          handleStillnessDetection(hasMotion);
        } else {
          // Not in range, reset stillness detection
          setIsStill(false);
          setStillnessProgress(0);
          stillnessStartTimeRef.current = 0;
          previousFrameRef.current = null;
        }
        
        // Debug logging (disabled)
        // console.log(`Raw: ${rawDistance.toFixed(2)}m, Smoothed: ${smoothedDistance.toFixed(2)}m, In Range: ${inRange}, Background: ${selectedBackground}`);

        // Always draw background first (like Zoom virtual background)
        if (selectedBackground && selectedBackground !== 'none') {
          if (selectedBackground === 'blur') {
            // Blur background effect - draw original image with blur
            console.log('Drawing blur background');
            
            // Create a temporary canvas for the blurred background
            const blurCanvas = document.createElement('canvas');
            blurCanvas.width = targetWidth;
            blurCanvas.height = targetHeight;
            const blurCtx = blurCanvas.getContext('2d');
            
            if (blurCtx) {
              // Draw the original image
              blurCtx.drawImage(results.image, 0, 0, targetWidth, targetHeight);
              
              // Apply blur effect
              blurCtx.filter = 'blur(8px)';
              blurCtx.drawImage(results.image, 0, 0, targetWidth, targetHeight);
              
              // Draw the blurred background
              ctx.drawImage(blurCanvas, 0, 0, targetWidth, targetHeight);
            }
            
            // Create a temporary canvas for the person
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = targetWidth;
            tempCanvas.height = targetHeight;
            const tempCtx = tempCanvas.getContext('2d');
            
            if (tempCtx) {
              // Clear temp canvas first
              tempCtx.clearRect(0, 0, targetWidth, targetHeight);
              
              // Draw the person image on temp canvas
              tempCtx.drawImage(results.image, 0, 0, targetWidth, targetHeight);
              
              // Use destination-in to apply the mask (keeps only where mask is white)
              tempCtx.globalCompositeOperation = 'destination-in';
              tempCtx.drawImage(results.segmentationMask, 0, 0, targetWidth, targetHeight);
              
              // Reset composite operation for main canvas
              ctx.globalCompositeOperation = 'source-over';
              // Draw person scaled into the camera viewport (like Zoom app)
              ctx.drawImage(tempCanvas, 
                0, 0, targetWidth, targetHeight, // Source: entire tempCanvas
                cameraViewport.x, cameraViewport.y, 
                cameraViewport.width, cameraViewport.height // Destination: cameraViewport
              );
            }
          } else if (backgroundImageRef.current) {
            console.log('Drawing background:', selectedBackground);
            console.log('Background image loaded:', backgroundImageRef.current.complete);
            
            // Draw background maintaining aspect ratio (letterboxing if needed)
            const bgImage = backgroundImageRef.current;
            const bgAspectRatio = bgImage.naturalWidth / bgImage.naturalHeight;
            
            let drawWidth, drawHeight, drawX, drawY;
            
            // Reduce background size by 20% for both width and height
            const scaleFactor = 0.8; // 80% of original size (20% smaller)
            
            if (bgAspectRatio > canvasAspectRatio) {
              // Background is wider than canvas - fit to width with 20% reduction
              drawWidth = targetWidth * scaleFactor;
              drawHeight = drawWidth / bgAspectRatio;
              drawX = (targetWidth - drawWidth) / 2;
              drawY = (targetHeight - drawHeight) / 2;
            } else {
              // Background is taller than canvas - fit to height with 20% reduction
              drawHeight = targetHeight * scaleFactor;
              drawWidth = drawHeight * bgAspectRatio;
              drawX = (targetWidth - drawWidth) / 2;
              drawY = (targetHeight - drawHeight) / 2;
            }
            
            // Fill background with black first (for letterboxing)
            ctx.fillStyle = 'black';
            ctx.fillRect(0, 0, targetWidth, targetHeight);
            
            // Draw background with proper aspect ratio
            ctx.drawImage(bgImage, drawX, drawY, drawWidth, drawHeight);
          }
        }
        
        // Draw person only when in range (like Zoom virtual background)
        if (inRange) {
            // Create a temporary canvas for the person
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = targetWidth;
            tempCanvas.height = targetHeight;
            const tempCtx = tempCanvas.getContext('2d');
            
            if (tempCtx) {
              // Clear temp canvas first
              tempCtx.clearRect(0, 0, targetWidth, targetHeight);
              
              // Draw the person image on temp canvas
              tempCtx.drawImage(results.image, 0, 0, targetWidth, targetHeight);
              
              // Use destination-in to apply the mask (keeps only where mask is white)
              tempCtx.globalCompositeOperation = 'destination-in';
              tempCtx.drawImage(results.segmentationMask, 0, 0, targetWidth, targetHeight);
              
              // Reset composite operation for main canvas
              ctx.globalCompositeOperation = 'source-over';
            // Draw person scaled into the camera viewport (like Zoom app)
              ctx.drawImage(tempCanvas, 
                0, 0, targetWidth, targetHeight, // Source: entire tempCanvas
                cameraViewport.x, cameraViewport.y, 
                cameraViewport.width, cameraViewport.height // Destination: cameraViewport
              );
            }
        }

        // Draw countdown overlay if active (force on top)
        if (countdownRef.current !== null) {
          const displayCount = countdownRef.current;
          console.log('🎯 Drawing countdown on canvas:', displayCount);
          
          // Ensure normal paint mode
          ctx.globalCompositeOperation = 'source-over';
          
          // Dim background
          ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
          ctx.fillRect(0, 0, targetWidth, targetHeight);

          // Backdrop circle behind number to increase contrast
          const cx = targetWidth / 2;
          const cy = targetHeight / 2;
          const r = Math.min(targetWidth, targetHeight) * 0.18;
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
          ctx.fill();

          // Countdown text with strong outline and shadow
          ctx.font = `bold ${Math.floor(Math.min(targetWidth, targetHeight) * 0.18)}px Arial`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          
          ctx.lineJoin = 'round';
          ctx.miterLimit = 2;
          ctx.shadowColor = 'rgba(0,0,0,0.8)';
          ctx.shadowBlur = 12;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;
          
          ctx.strokeStyle = 'rgba(0,0,0,0.9)';
          ctx.lineWidth = 10;
          ctx.strokeText(displayCount!.toString(), cx, cy);
          
          ctx.fillStyle = '#ffffff';
          ctx.fillText(displayCount!.toString(), cx, cy);
          
          // Reset shadow for subsequent draws
          ctx.shadowBlur = 0;
        }

        // No flip restore needed
      });

      selfieSegmentationRef.current = selfieSegmentation;

      const camera = new Camera(videoRef.current, {
        onFrame: async () => {
          if (selfieSegmentationRef.current) {
            await selfieSegmentationRef.current.send({ image: videoRef.current! });
          }
        },
        width: 1280,
        height: 720
      });

      cameraRef.current = camera;
      setIsInitialized(true);
      } catch (error) {
        console.error('Error initializing MediaPipe:', error);
      }
    }, [selectedBackground, isFlipped]);

  const startCamera = useCallback(async () => {
    if (!isInitialized || !cameraRef.current) return;

    try {
      // Get user media with high quality constraints using configuration variables
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: CAMERA_WIDTH, min: 640 },
          height: { ideal: CAMERA_HEIGHT, min: 480 },
          frameRate: { ideal: CAMERA_FPS, min: 15 },
          facingMode: 'user'
        },
        audio: false
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      await cameraRef.current.start();
      setIsCameraOn(true);
    } catch (error) {
      console.error('Error starting camera:', error);
    }
  }, [isInitialized]);

  const stopCamera = useCallback(() => {
    if (cameraRef.current) {
      cameraRef.current.stop();
    }
    
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    
    setIsCameraOn(false);
  }, []);

  const capturePhoto = useCallback(() => {
    console.log('📸 Capture photo triggered!');
    
    if (!originalImageRef.current) {
      console.log('❌ No original image available for capture');
      return;
    }

    try {
      // Create a download link for the original image
      const link = document.createElement('a');
      link.download = `photo_${new Date().getTime()}.png`;
      link.href = originalImageRef.current.toDataURL('image/png');
      
      console.log('📸 Download link created:', link.href.substring(0, 50) + '...');
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Reset states after capture
      setReadyToCapture(false);
      
      console.log('✅ Photo captured and downloaded successfully!');
    } catch (error) {
      console.error('❌ Error capturing photo:', error);
    }
  }, []);

  // Keep a stable ref to the capture function to avoid TDZ in callbacks
  useEffect(() => {
    capturePhotoRef.current = capturePhoto;
  }, [capturePhoto]);

  const toggleFullscreen = useCallback(async () => {
    if (!canvasRef.current) return;

    try {
      if (!document.fullscreenElement) {
        // Enter fullscreen
        await canvasRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else {
        // Exit fullscreen
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (error) {
      console.error('Error toggling fullscreen:', error);
    }
  }, []);

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    initializeMediaPipe();
  }, [initializeMediaPipe]);

  // Load background image when selectedBackground changes
  useEffect(() => {
    console.log('Background changed to:', selectedBackground);
    if (selectedBackground && selectedBackground !== 'none' && selectedBackground !== 'blur') {
      // Find the background config to get the actual image path
      const bgConfig = backgroundConfigs.find(bg => bg.id === selectedBackground);
      if (bgConfig && bgConfig.fullSize) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          console.log('Background image loaded successfully:', img.src);
          console.log('Image dimensions:', img.width, 'x', img.height);
          backgroundImageRef.current = img;
        };
        img.onerror = () => {
          console.error('Failed to load background image:', selectedBackground);
          backgroundImageRef.current = null;
        };
        img.src = bgConfig.fullSize;
      } else {
        console.error('Background config not found:', selectedBackground);
        backgroundImageRef.current = null;
      }
    } else {
      console.log('No background selected or blur mode');
      backgroundImageRef.current = null;
    }
  }, [selectedBackground]);

  useEffect(() => {
    return () => {
      if (cameraRef.current) {
        cameraRef.current.stop();
      }
    };
  }, []);

  // Keyboard shortcuts for background switching and capture
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === 'm' || event.key === 'M') {
        // Next background
        const currentIndex = backgroundConfigs.findIndex(bg => bg.id === selectedBackground);
        const nextIndex = (currentIndex + 1) % backgroundConfigs.length;
        const nextBackground = backgroundConfigs[nextIndex].id;
        
        // Add to history
        setBackgroundHistory(prev => [...prev, selectedBackground]);
        _onBackgroundChange(nextBackground);
        
        console.log('🎯 Next background:', nextBackground);
      } else if (event.key === 'n' || event.key === 'N') {
        // Previous background
        if (backgroundHistory.length > 0) {
          const previousBackground = backgroundHistory[backgroundHistory.length - 1];
          setBackgroundHistory(prev => prev.slice(0, -1));
          _onBackgroundChange(previousBackground);
          
          console.log('🎯 Previous background:', previousBackground);
        }
      } else if (event.key === ' ') {
        // Space key - trigger auto capture (like standing still for 2 seconds)
        event.preventDefault(); // Prevent page scroll
        if (isInRange && !isCapturing && !readyToCapture && !cooldownActiveRef.current) {
          console.log('🎯 Space key pressed - triggering auto capture');
          setIsStill(true);
          startCountdown(true); // Auto capture (like standing still)
        } else if (!isInRange) {
          console.log('🎯 Space key pressed but not in range');
        } else if (isCapturing || readyToCapture) {
          console.log('🎯 Space key pressed but already capturing');
        } else if (cooldownActiveRef.current) {
          console.log('🎯 Space key pressed but cooldown active');
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [selectedBackground, backgroundHistory, _onBackgroundChange, isInRange, isCapturing, readyToCapture, startCountdown]);

  return (
    <div className="background-remover">
      <div className="video-container">
        <video
          ref={videoRef}
          className="video-input"
          style={{ display: 'none' }}
          playsInline
          muted
          autoPlay
        />
        <canvas
          ref={canvasRef}
          className="video-output"
          style={{
            width: '100%',
            height: '100%',
            border: '2px solid #333',
            borderRadius: '8px'
          }}
        />
        
        {/* Fullscreen Button */}
        <button
          onClick={toggleFullscreen}
          className="fullscreen-btn"
          disabled={!isCameraOn}
          title={isFullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'}
        >
          {isFullscreen ? '⤓' : '⤢'}
        </button>
      </div>
      
      <div className="controls">
        <button
          onClick={isCameraOn ? stopCamera : startCamera}
          className={`camera-btn ${isCameraOn ? 'stop' : 'start'}`}
          disabled={!isInitialized}
        >
          {isCameraOn ? 'Tắt Camera' : 'Bật Camera'}
        </button>
        
        <button
          onClick={capturePhoto}
          className={`capture-btn ${readyToCapture ? 'ready' : ''}`}
          disabled={!isCameraOn || isCapturing}
        >
          {readyToCapture ? '📸 CHỤP NGAY!' : '📸 Chụp Ảnh'}
        </button>
      </div>
      
      {/* Distance Indicator */}
      {isCameraOn && (
        <div className="distance-indicator">
          <div className="distance-status">
            <span className="distance-value">{distance.toFixed(1)}m</span>
            <span className={`distance-status-text ${isInRange ? 'in-range' : 'out-of-range'}`}>
              {isInRange ? '✅ Trong tầm' : '❌ Quá xa'}
            </span>
          </div>
          <div className="distance-hint">
            {selectedBackground && selectedBackground !== 'none' 
              ? (isInRange 
                  ? `✅ Background "${selectedBackground === 'blur' ? 'Xóa phông' : 'đã chọn'}" đang hoạt động` 
                  : '❌ Di chuyển gần hơn (≤1m) để kích hoạt background')
              : 'Chọn background để kích hoạt tính năng khoảng cách'
            }
          </div>
        </div>
      )}

      {/* Stillness Detection Indicator */}
      {isCameraOn && (
        <div className="stillness-indicator">
          <div className="stillness-status">
            <span className="stillness-value">{(stillnessProgress * 100).toFixed(0)}%</span>
            <span className={`stillness-status-text ${isStill ? 'still' : 'moving'}`}>
              {isCapturing 
                ? '📸 Đang đếm ngược...' 
                : readyToCapture
                  ? '✅ Sẵn sàng chụp!'
                  : isStill
                    ? '🎯 Đứng yên hoàn hảo!' 
                    : '📐 Đứng yên để chụp ảnh'
              }
            </span>
          </div>
          
          {countdown !== null && (
            <div className="countdown-display">
              <div className="countdown-number">{countdown}</div>
              <div className="countdown-text">Chuẩn bị chụp ảnh!</div>
            </div>
          )}
          
          {readyToCapture && (
            <div className="ready-to-capture">
              <div className="ready-text">🎯 Đứng yên hoàn hảo!</div>
              <div className="ready-subtext">Bấm nút chụp ảnh bên dưới</div>
            </div>
          )}
          
          {/* Progress bar for stillness */}
          <div className="stillness-progress">
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${stillnessProgress * 100}%` }}
              ></div>
            </div>
            <div className="progress-text">
            {isCapturing 
              ? 'Giữ nguyên tư thế!' 
              : readyToCapture
                  ? 'Đứng yên hoàn hảo! Bấm nút chụp ảnh'
                : isInRange
                    ? '📸 Sẽ tự động đếm ngược khi đứng yên 2 giây'
                  : '❌ Di chuyển gần hơn (≤1m) để kích hoạt auto chụp'
            }
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BackgroundRemover;
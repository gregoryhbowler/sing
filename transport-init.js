// transport-init.js - Initialize floating transport controls
// This script should be loaded after main.js initializes

(function() {
  // Wait for the app to be ready
  function initTransport() {
    const sidebar = document.getElementById('transportSidebar');
    const playBtn = document.getElementById('transportPlayBtn');
    const stopBtn = document.getElementById('transportStopBtn');
    const volumeSlider = document.getElementById('transportVolume');
    const volumeValue = document.getElementById('transportVolumeValue');
    const statusText = document.getElementById('transportStatus');
    const originalStartBtn = document.getElementById('startBtn');
    const originalVolumeSlider = document.getElementById('masterVolume');
    const originalVolumeValue = document.getElementById('masterVolumeValue');
    
    if (!sidebar || !playBtn || !stopBtn) {
      console.warn('Transport elements not found, retrying...');
      setTimeout(initTransport, 500);
      return;
    }
    
    // Enable play button when original is enabled
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'disabled') {
          playBtn.disabled = originalStartBtn.disabled;
        }
      });
    });
    
    if (originalStartBtn) {
      observer.observe(originalStartBtn, { attributes: true });
      playBtn.disabled = originalStartBtn.disabled;
    }
    
    // Update UI state
    function updateTransportUI(isRunning) {
      sidebar.classList.toggle('running', isRunning);
      sidebar.classList.toggle('stopped', !isRunning);
      
      if (isRunning) {
        playBtn.style.display = 'none';
        stopBtn.style.display = 'flex';
        statusText.textContent = 'Running';
      } else {
        playBtn.style.display = 'flex';
        stopBtn.style.display = 'none';
        statusText.textContent = 'Stopped';
      }
    }
    
    // Play button click
    playBtn.addEventListener('click', () => {
      if (originalStartBtn && !originalStartBtn.disabled) {
        originalStartBtn.click();
        updateTransportUI(true);
      }
    });
    
    // Stop button click
    stopBtn.addEventListener('click', () => {
      if (originalStartBtn) {
        originalStartBtn.click();
        updateTransportUI(false);
      }
    });
    
    // Watch for changes to the original button text to sync state
    const textObserver = new MutationObserver(() => {
      const isRunning = originalStartBtn.textContent.includes('Stop');
      updateTransportUI(isRunning);
    });
    
    if (originalStartBtn) {
      textObserver.observe(originalStartBtn, { childList: true, subtree: true });
    }
    
    // Volume slider
    volumeSlider.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      volumeValue.textContent = value.toFixed(2);
      
      // Sync with original volume slider
      if (originalVolumeSlider) {
        originalVolumeSlider.value = value;
        originalVolumeSlider.dispatchEvent(new Event('input', { bubbles: true }));
      }
      if (originalVolumeValue) {
        originalVolumeValue.textContent = value.toFixed(2);
      }
    });
    
    // Sync original volume changes to transport
    if (originalVolumeSlider) {
      originalVolumeSlider.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        volumeSlider.value = value;
        volumeValue.textContent = value.toFixed(2);
      });
    }
    
    // Initialize with current volume value
    if (originalVolumeSlider) {
      volumeSlider.value = originalVolumeSlider.value;
      volumeValue.textContent = parseFloat(originalVolumeSlider.value).toFixed(2);
    }
    
    console.log('✓ Floating transport initialized');
  }
  
  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(initTransport, 1000); // Wait for main app to init
    });
  } else {
    setTimeout(initTransport, 1000);
  }
})();

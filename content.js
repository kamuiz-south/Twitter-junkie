/**
 * Twitter Junkie - Content Script
 * Handlers for Auto-Scroll and Video Maximization
 */

(function () {
    'use strict';

    // --- Configuration & State ---
    const STORAGE_POSITION_KEY = 'tj_ui_position';
    const STORAGE_SPEED_KEY = 'tj_scroll_speed';
    const STORAGE_VIDEO_BTN_POS_KEY = 'tj_video_btn_position';
    const KEY_DRAG = 'tj_drag_enabled';
    const KEY_THEATER = 'tj_theater_hide';
    const KEY_SHORTCUTS = 'tj_shortcuts_enabled';
    const KEY_SPEED_STEP = 'tj_speed_step';
    const KEY_INTUITIVE_WHEEL = 'tj_intuitive_wheel';
    const KEY_REVERSE_WHEEL = 'tj_reverse_wheel';
    const KEY_STOP_BIND = 'tj_stop_bind';
    const KEY_START_UP = 'tj_start_up';
    const KEY_START_DOWN = 'tj_start_down';
    const KEY_SPEED_UP = 'tj_speed_up';
    const KEY_SPEED_DOWN = 'tj_speed_down';
    const KEY_HIDE_UI_ALWAYS = 'tj_hide_ui_always';
    const KEY_LANGUAGE = 'tj_language';
    
    // Feature Toggles (default to ON except drag)
    let globalDragEnabled = false; 
    let globalTheaterHideEnabled = true;
    let globalHideUIAlways = false;
    let globalLanguage = 'jp';
    let globalShortcutsEnabled = true;
    let globalSpeedStep = 0.2;
    let globalIntuitiveWheel = false;
    let globalReverseWheel = false;
    let globalStopBind = 'Space';
    let globalStartUpBind = 'None';
    let globalStartDownBind = 'None';
    let globalSpeedUpBind = 'None';
    let globalSpeedDownBind = 'None';

    const CONTENT_I18N = {
         en: { panelHeader: 'Auto Scroll', speedLabel: 'Speed' },
         jp: { panelHeader: '自動スクロール', speedLabel: '速度' }
    };

    function updateContentLanguage() {
         const dict = CONTENT_I18N[globalLanguage] || CONTENT_I18N['jp'];
         const panel = document.getElementById('tj-auto-scroll-panel');
         if (!panel) return;
         
         const header = panel.querySelector('.tj-panel-header');
         if (header) header.textContent = dict.panelHeader;
         
         const speedSpan = panel.querySelector('.tj-speed-label > span');
         if (speedSpan) speedSpan.textContent = dict.speedLabel;
    }
    
    // Auto-scroll State
    let scrollInterval = null;
    let autoScrollSpeed = 1.0; // default speed (pixels per frame)
    let autoScrollDirection = 0; // -1 for UP, 1 for DOWN, 0 for STOP
    let scrollAccumulator = 0; // for sub-pixel scrolling
    let isDragging = false;
    let dragOffset = { x: 0, y: 0 };
    
    // Shortcut State
    let isRightClickHeld = false;
    let isInitialRightClickStart = false;
    let shortcutActivated = false;

    // Icons (SVGs)
    const icons = {
        up: '<svg viewBox="0 0 24 24"><path d="M12 4l-8 8h6v8h4v-8h6z"/></svg>',
        down: '<svg viewBox="0 0 24 24"><path d="M12 20l8-8h-6V4h-4v8H4z"/></svg>',
        stop: '<svg viewBox="0 0 24 24"><path d="M6 6h12v12H6z"/></svg>',
        maximize: '<svg viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>',
        restore: '<svg viewBox="0 0 24 24"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>' // Using 'restore/minimize' icon for cycling states as needed
    };

    // --- 1. Auto-Scroll Feature ---

    function createAutoScrollUI() {
        if (document.getElementById('tj-auto-scroll-panel')) return; // Already exists

        const panel = document.createElement('div');
        panel.id = 'tj-auto-scroll-panel';
        
        // Inner HTML structure matching styles.css
        panel.innerHTML = `
            <div class="tj-panel-header">Auto Scroll</div>
            <div class="tj-controls">
                <button id="tj-btn-up" class="tj-btn" title="Scroll Up">${icons.up}</button>
                <button id="tj-btn-stop" class="tj-btn active" title="Stop">${icons.stop}</button>
                <button id="tj-btn-down" class="tj-btn" title="Scroll Down">${icons.down}</button>
            </div>
            <div class="tj-speed-control">
                <div class="tj-speed-label">
                    <span>Speed</span>
                    <div class="tj-speed-controls-row">
                        <button id="tj-speed-minus" class="tj-speed-adjust-btn">-</button>
                        <span id="tj-speed-value" style="width: 30px; text-align: center;">${autoScrollSpeed.toFixed(1)}</span>
                        <button id="tj-speed-minus-plus" class="tj-speed-adjust-btn">+</button>
                    </div>
                </div>
                <input type="range" id="tj-speed-slider" class="tj-slider" min="0.1" max="25" step="0.1" value="${autoScrollSpeed}">
            </div>
        `;
        document.body.appendChild(panel);

        // Apply initialized language
        updateContentLanguage();

        // Bind events
        bindAutoScrollEvents(panel);
        restoreUIPosition(panel);
        restoreSpeed();
    }

    function bindAutoScrollEvents(panel) {
        const btnUp = panel.querySelector('#tj-btn-up');
        const btnStop = panel.querySelector('#tj-btn-stop');
        const btnDown = panel.querySelector('#tj-btn-down');
        const speedSlider = panel.querySelector('#tj-speed-slider');
        const speedValDisp = panel.querySelector('#tj-speed-value');
        const btnMinus = panel.querySelector('#tj-speed-minus');
        const btnPlus = panel.querySelector('#tj-speed-minus-plus');

        // Button clicks
        btnUp.addEventListener('click', () => setScrollDirection(-1));
        btnStop.addEventListener('click', () => setScrollDirection(0));
        btnDown.addEventListener('click', () => setScrollDirection(1));

        function setSpeed(newSpeed) {
            autoScrollSpeed = Math.max(0.1, Math.min(25, newSpeed));
            speedValDisp.textContent = autoScrollSpeed.toFixed(1);
            speedSlider.value = autoScrollSpeed;
            chrome.storage.local.set({ [STORAGE_SPEED_KEY]: autoScrollSpeed });
        }

        btnMinus.addEventListener('click', () => setSpeed(autoScrollSpeed - 0.1));
        btnPlus.addEventListener('click', () => setSpeed(autoScrollSpeed + 0.1));

        // Speed change
        speedSlider.addEventListener('input', (e) => {
            setSpeed(parseFloat(e.target.value));
        });

        // --- Panel Dragging Logic ---
        panel.addEventListener('mousedown', (e) => {
            // Ignore if clicking on buttons or slider
            if (e.target.tagName.toLowerCase() === 'button' || e.target.closest('button') || e.target.tagName.toLowerCase() === 'input') {
                return;
            }
            
            isDragging = true;
            dragOffset.x = e.clientX - panel.getBoundingClientRect().left;
            dragOffset.y = e.clientY - panel.getBoundingClientRect().top;
            
            // Prevent text selection during drag
            document.body.style.userSelect = 'none';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            
            let newLeft = e.clientX - dragOffset.x;
            let newTop = e.clientY - dragOffset.y;
            
            // Keep within viewport bounds
            const maxX = window.innerWidth - panel.offsetWidth;
            const maxY = window.innerHeight - panel.offsetHeight;
            
            newLeft = Math.max(0, Math.min(newLeft, maxX));
            newTop = Math.max(0, Math.min(newTop, maxY));
            
            panel.style.left = `${newLeft}px`;
            panel.style.top = `${newTop}px`;
            panel.style.bottom = 'auto';
            panel.style.right = 'auto'; // Break from initial CSS positioning if set
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                document.body.style.userSelect = '';
                
                // Save position
                chrome.storage.local.set({
                    [STORAGE_POSITION_KEY]: {
                        left: panel.style.left,
                        top: panel.style.top
                    }
                });
            }
        });
    }

    function restoreUIPosition(panel) {
        chrome.storage.local.get([STORAGE_POSITION_KEY], (result) => {
            if (result[STORAGE_POSITION_KEY]) {
                panel.style.left = result[STORAGE_POSITION_KEY].left || '20px';
                panel.style.top = result[STORAGE_POSITION_KEY].top || '100px';
                panel.style.bottom = 'auto';
                panel.style.right = 'auto';
            } else {
                // Default position (bottom right)
                panel.style.bottom = '20px';
                panel.style.right = '20px';
            }
        });
    }

    function restoreSpeed() {
        chrome.storage.local.get([STORAGE_SPEED_KEY], (result) => {
            if (result[STORAGE_SPEED_KEY]) {
                autoScrollSpeed = parseFloat(result[STORAGE_SPEED_KEY]);
                const slider = document.getElementById('tj-speed-slider');
                const valDisp = document.getElementById('tj-speed-value');
                if(slider && valDisp) {
                    slider.value = autoScrollSpeed;
                    valDisp.textContent = autoScrollSpeed.toFixed(1);
                }
            }
        });
    }

    function setScrollDirection(dir) {
        autoScrollDirection = dir;
        updateUIState();

        if (scrollInterval) {
            cancelAnimationFrame(scrollInterval);
            scrollInterval = null;
        }

        if (autoScrollDirection !== 0) {
            startScrolling();
        }
    }

    function updateUIState() {
        const btnUp = document.getElementById('tj-btn-up');
        const btnStop = document.getElementById('tj-btn-stop');
        const btnDown = document.getElementById('tj-btn-down');

        if(btnUp) btnUp.classList.toggle('active', autoScrollDirection === -1);
        if(btnStop) btnStop.classList.toggle('active', autoScrollDirection === 0);
        if(btnDown) btnDown.classList.toggle('active', autoScrollDirection === 1);
    }

    function startScrolling() {
        scrollAccumulator = 0; // Reset accumulator on start
        function scrollStep() {
            if (autoScrollDirection === 0) return;

            // X.com scrolling targets window when on standard feed
            // To handle sub-pixel speeds cleanly, accumulate fractionals
            scrollAccumulator += autoScrollSpeed;
            if (scrollAccumulator >= 1) {
                const scrollPixels = Math.floor(scrollAccumulator);
                scrollAccumulator -= scrollPixels;
                window.scrollBy(0, autoScrollDirection * scrollPixels);
            }
            
            // Loop scroll requested animation frame
            scrollInterval = requestAnimationFrame(scrollStep);
        }
        scrollInterval = requestAnimationFrame(scrollStep);
    }
    
    // --- Advanced Shortcuts Feature ---
    function bindAdvancedShortcuts() {
        document.addEventListener('mousedown', (e) => {
            if (!globalShortcutsEnabled) return;
            
            // On Left-Click, stop scrolling if it is active. 
            // We ignore clicks on the control panel itself to avoid conflicts.
            if (e.button === 0 && autoScrollDirection !== 0) {
                const panel = document.getElementById('tj-auto-scroll-panel');
                if (panel && !panel.contains(e.target)) {
                     setScrollDirection(0);
                     e.stopPropagation(); // Stop click from triggering tweet opening
                }
            }
            
        // Right-click hold detection
        if (e.button === 2) {
             console.log('[Twitter Junkie] Right-Click Pressed (mousedown)');
             isRightClickHeld = true;
             shortcutActivated = false; // Reset flag on fresh press
             // Determine if this is a "fresh start" right-click, or if the user is 
             // pressing right-click *while already scrolling* to adjust speed.
             isInitialRightClickStart = (autoScrollDirection === 0);
        }
    });
    
    document.addEventListener('mouseup', (e) => {
        if (e.button === 2) {
             console.log('[Twitter Junkie] Right-Click Released (mouseup)');
             isRightClickHeld = false;
             isInitialRightClickStart = false; 
        }
    });

        // Prevent context menu ONLY if a shortcut action was triggered during the hold
        document.addEventListener('contextmenu', (e) => {
            // ALWAYS clear the flags when a context menu opens natively, 
            // to prevent the script from thinking Right-Click is stuck held down!
            if (isRightClickHeld) {
                console.log('[Twitter Junkie] Context menu opened natively - clearing right-click hold state.');
            }
            isRightClickHeld = false;
            isInitialRightClickStart = false;
            
            if (globalShortcutsEnabled && shortcutActivated) {
                console.log('[Twitter Junkie] Context menu prevented because a shortcut was used.');
                e.preventDefault();
                shortcutActivated = false;
            }
        });

        // If the user clicks out of the Chrome window while holding right-click, clear states
        window.addEventListener('blur', () => {
             console.log('[Twitter Junkie] Window blurred - clearing states.');
             isRightClickHeld = false;
             isInitialRightClickStart = false;
             shortcutActivated = false;
        });

        document.addEventListener('keydown', (e) => {
            if (!globalShortcutsEnabled) return;
            
            // If typing in an input/textarea, ignore keys (unless we are just stopping scroll)
            const tag = e.target.tagName ? e.target.tagName.toLowerCase() : '';
            const isInput = tag === 'input' || tag === 'textarea' || e.target.isContentEditable;
            
            // Format nice string to match the options page recording
            let keyStr = e.code;
            if (keyStr && keyStr.startsWith('Key')) keyStr = keyStr.replace('Key', '');
            if (keyStr && keyStr.startsWith('Digit')) keyStr = keyStr.replace('Digit', '');

            // Custom Advanced Keybinds
            if (keyStr === globalStopBind && autoScrollDirection !== 0 && globalStopBind !== 'None') {
                 // But don't stop if they are literally just typing a space in a tweet text box
                 if (isInput && keyStr === 'Space') return;
                 console.log('[Twitter Junkie] Stop shortcut triggered.');
                 setScrollDirection(0);
                 e.preventDefault(); // Stop page from natively acting (e.g. jumping down on Space)
            } else if (!isInput) {
                 if (keyStr === globalStartUpBind && globalStartUpBind !== 'None' && autoScrollDirection !== -1) {
                      e.preventDefault();
                      setScrollDirection(-1);
                 } else if (keyStr === globalStartDownBind && globalStartDownBind !== 'None' && autoScrollDirection !== 1) {
                      e.preventDefault();
                      setScrollDirection(1);
                 } else if (keyStr === globalSpeedUpBind && globalSpeedUpBind !== 'None' && autoScrollDirection !== 0) {
                      e.preventDefault();
                      adjustSpeed(true);
                 } else if (keyStr === globalSpeedDownBind && globalSpeedDownBind !== 'None' && autoScrollDirection !== 0) {
                      e.preventDefault();
                      adjustSpeed(false);
                 }
            }
        });

        document.addEventListener('wheel', (e) => {
            if (!globalShortcutsEnabled || !isRightClickHeld) return;
            
            // Active right-click + wheel chord
            console.log('[Twitter Junkie] Wheel event intercepted while Right-Click is held.');
            e.preventDefault();
            shortcutActivated = true;
            
            // Determine wheel direction: e.deltaY < 0 is UP, e.deltaY > 0 is DOWN
            const wheelIsUp = e.deltaY < 0;

            if (globalIntuitiveWheel) {
                // --- INTUITIVE VELOCITY MODE ---
                // Calculate current signed velocity: UP is positive (+), DOWN is negative (-)
                let currentVelocity = (autoScrollDirection === 0) ? 0 : (autoScrollDirection === -1 ? autoScrollSpeed : -autoScrollSpeed);
                
                // Wheel UP adds positive momentum, Wheel DOWN adds negative momentum
                if (wheelIsUp) {
                     currentVelocity += globalSpeedStep;
                } else {
                     currentVelocity -= globalSpeedStep;
                }
                
                // Enforce max bounds and precision limits
                currentVelocity = Math.max(-25, Math.min(25, currentVelocity));
                
                // Determine new state based on velocity counter
                if (Math.abs(currentVelocity) < 0.05) {
                     console.log('[Twitter Junkie] Intuitive Mode: Counter hit 0, stopping.');
                     setScrollDirection(0);
                     autoScrollSpeed = 0.2; // reset speed to minimum for UI looks
                     updateSpeedUI();
                } else if (currentVelocity > 0.05) {
                     console.log('[Twitter Junkie] Intuitive Mode: Scrolling UP at speed', currentVelocity);
                     autoScrollSpeed = parseFloat(currentVelocity.toFixed(1));
                     updateSpeedUI();
                     if (autoScrollDirection !== -1) setScrollDirection(-1);
                } else if (currentVelocity < -0.05) {
                     console.log('[Twitter Junkie] Intuitive Mode: Scrolling DOWN at speed', Math.abs(currentVelocity));
                     autoScrollSpeed = parseFloat(Math.abs(currentVelocity).toFixed(1));
                     updateSpeedUI();
                     if (autoScrollDirection !== 1) setScrollDirection(1);
                }
                
                return; // End intuitive mode processing
            }

            // --- CLASSIC MODE ---
            const intendedDirection = wheelIsUp ? -1 : 1;

            if (isInitialRightClickStart) {
                // If this is the button press that started the scroll...
                if (autoScrollDirection === 0) {
                     // 1. Kickstart the scroll in the wheel's direction
                     console.log('[Twitter Junkie] Starting auto-scroll from wheel direction:', intendedDirection);
                     setScrollDirection(intendedDirection);
                } else if (autoScrollDirection !== intendedDirection) {
                     // 2. We are already scrolling from THIS right-click hold, 
                     // but the user abruptly spun the wheel the other way. 
                     // INSTANT REVERSAL.
                     console.log('[Twitter Junkie] Reversing scroll direction:', intendedDirection);
                     setScrollDirection(intendedDirection);
                }
                // (If direction is the same, do nothing. No speed adjustments during start!)
            } else {
                // If the user was ALREADY scrolling, let go of right click, and held it again later...
                // This is purely a Speed Adjustment mode. No reversals allowed.
                let adjustedWheelIsUp = wheelIsUp;
                if (globalReverseWheel && autoScrollDirection === 1) {
                    adjustedWheelIsUp = !adjustedWheelIsUp; // Flip wheel logic if scrolling down
                }
                console.log('[Twitter Junkie] Adjusting scroll speed via wheel. Up?', adjustedWheelIsUp);
                adjustSpeed(adjustedWheelIsUp);
            }
            
        }, { passive: false }); // Needs false to prevent default zooming/scrolling on wheel
    }

    function updateSpeedUI() {
         const slider = document.getElementById('tj-speed-slider');
         const valDisp = document.getElementById('tj-speed-value');
         if (slider && valDisp) {
             slider.value = autoScrollSpeed;
             valDisp.textContent = autoScrollSpeed.toFixed(1);
         }
         chrome.storage.local.set({ [STORAGE_SPEED_KEY]: autoScrollSpeed });
    }

    function adjustSpeed(isUp) {
         // Up is faster (+), Down is slower (-)
         let newSpeed = autoScrollSpeed + (isUp ? globalSpeedStep : -globalSpeedStep);
         newSpeed = Math.max(0.1, Math.min(25, newSpeed));
         
         autoScrollSpeed = newSpeed;
         updateSpeedUI();
    }

    // Handle user manual scroll during auto-scroll (Optional UX refinement)
    // Sometimes users want to manually scroll to read something, automatically stopping might be nice, 
    // but the spec says "stop button", so we'll strictly follow the buttons for now.

    // --- 2. Video Maximization Feature ---
    
    // Create a global backdrop element
    let backdrop = null;
    let currentRestoreMaximized = null;

    // Define the default initial position
    const DEFAULT_BTN_POS = { right: '3px', top: '40px', transform: 'none' };

    function insertVideoMaximizeButton(videoContainer) {
        // Prevent adding multiple buttons to the same container
        if (videoContainer.hasAttribute('data-extension-maximize-applied')) return;
        
        // Sometimes the react components unmount/remount rapidly, so we ensure the target is stable
        videoContainer.setAttribute('data-extension-maximize-applied', 'true');
        
        // We find the direct wrapper to attach the button relatively.
        // X.com uses complex nested divs for video. The target we passed should be good.
        // It must have relatively positioning to anchor the absolute button.
        const originalPos = window.getComputedStyle(videoContainer).position;
        if (originalPos === 'static') {
            videoContainer.style.position = 'relative';
        }

        const btn = document.createElement('button');
        btn.className = 'tj-video-maximize-btn';
        btn.innerHTML = icons.maximize;
        btn.title = 'Maximize Video (Drag to move)';
        
        // Apply default initial position (always right-center for new videos)
        btn.style.right = DEFAULT_BTN_POS.right;
        btn.style.top = DEFAULT_BTN_POS.top;
        btn.style.transform = DEFAULT_BTN_POS.transform;

        // Set initial grab state styles
        if (globalDragEnabled) {
            btn.style.setProperty('cursor', 'grab', 'important');
        } else {
            btn.style.setProperty('cursor', 'pointer', 'important');
        }

        // --- Video Button Drag Logic ---
        let vDrag = false;
        let vDragPixels = 0; // Better drag threshold detection
        let vDragOffset = { x: 0, y: 0 };
        let startPos = { x: 0, y: 0 };

        btn.addEventListener('mouseenter', () => {
             if (globalDragEnabled) {
                  btn.style.setProperty('cursor', vDrag ? 'grabbing' : 'grab', 'important');
             } else {
                  btn.style.setProperty('cursor', 'pointer', 'important');
             }
        });

        btn.addEventListener('mousedown', (e) => {
            // Only start drag on left click, and only if D&D is enabled
            if (e.button !== 0 || !globalDragEnabled) return;
            vDrag = true;
            vDragPixels = 0;
            startPos = { x: e.clientX, y: e.clientY };
            
            vDragOffset.x = e.clientX - btn.getBoundingClientRect().left;
            vDragOffset.y = e.clientY - btn.getBoundingClientRect().top;
            
            if (globalDragEnabled) btn.style.setProperty('cursor', 'grabbing', 'important');
            
            e.preventDefault(); // prevent text select
        });

        // Use global listeners for smooth dragging outside the button bounds
        const onMouseMove = (e) => {
             if (!vDrag) return;
             
             // Calculate distance moved to distinguish drag from click
             const dx = e.clientX - startPos.x;
             const dy = e.clientY - startPos.y;
             vDragPixels = Math.sqrt(dx*dx + dy*dy);

             const containerBounds = videoContainer.getBoundingClientRect();
             
             // Calculate new top and left relative to container
             let newLeft = e.clientX - containerBounds.left - vDragOffset.x;
             let newTop = e.clientY - containerBounds.top - vDragOffset.y;
             
             // Keep inside the video container somewhat
             newLeft = Math.max(0, Math.min(newLeft, containerBounds.width - btn.offsetWidth));
             newTop = Math.max(0, Math.min(newTop, containerBounds.height - btn.offsetHeight));
             
             btn.style.left = `${newLeft}px`;
             btn.style.right = 'auto'; // override default right
             btn.style.top = `${newTop}px`;
             btn.style.transform = 'none'; // clear center transform
             
        };
        
        const onMouseUp = () => {
             if (vDrag) {
                 vDrag = false;
             }
        };

        // Attach to document to avoid losing cursor when moving fast
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);


        // State Machine for cycling: 0 = Normal, 1 = Maximized (Fit Screen)
        let viewState = 0;
        let maxWrapper = null;
        let placeholder = null;
        let originalParent = null;
        let escListener = null;
        let preMaxState = null;
        let scrollYPos = 0;
        let aliveCheckInterval = null;

        function restoreNormalMode(videoNode) {
            if (aliveCheckInterval) {
                clearInterval(aliveCheckInterval);
                aliveCheckInterval = null;
            }

            if (maxWrapper) {
                if (videoNode) videoNode.controls = false; // Disable native controls
                
                // Put video back in normal DOM safely
                if (videoNode && originalParent && placeholder && document.body.contains(originalParent)) {
                    // Try to restore playback state if it was a GIF
                    const wasPlaying = !videoNode.paused;
                    originalParent.insertBefore(videoNode, placeholder);
                    originalParent.removeChild(placeholder);
                    
                    if (wasPlaying) videoNode.play().catch(e => {});
                } else if (videoNode && originalParent && document.body.contains(originalParent)) {
                    originalParent.appendChild(videoNode);
                } else if (placeholder && placeholder.parentNode) {
                    placeholder.parentNode.removeChild(placeholder);
                }
                
                // Return button to container if container survived
                if (document.body.contains(videoContainer)) {
                    videoContainer.appendChild(btn);
                }
                
                if (maxWrapper.parentNode) {
                    document.body.removeChild(maxWrapper);
                }
                maxWrapper = null;
            }

            if (escListener) {
                document.removeEventListener('keydown', escListener);
                escListener = null;
            }

            // Restore scroll and body state
            document.documentElement.style.scrollBehavior = 'auto'; // Disable smooth scroll temporarily
            document.body.style.overflow = '';
            document.body.style.position = '';
            document.body.style.top = '';
            document.body.style.width = '';
            document.body.style.paddingRight = ''; // Remove scrollbar jump fix
            window.scrollTo(0, scrollYPos);
            document.documentElement.style.scrollBehavior = '';
            
            backdrop.classList.remove('active');
            
            btn.innerHTML = icons.maximize;
            btn.title = 'Maximize Video (Drag to move)';
            
            // On exit, restore to exactly where it was dragged, or default
            if (preMaxState) {
                btn.style.right = preMaxState.right;
                btn.style.left = preMaxState.left;
                btn.style.top = preMaxState.top;
                btn.style.transform = preMaxState.transform;
            }
            
            viewState = 0;
            
            // Restore Auto-Scroll UI according to settings
            const autoScrollPanel = document.getElementById('tj-auto-scroll-panel');
            if (autoScrollPanel) {
                if (globalHideUIAlways) {
                    autoScrollPanel.style.setProperty('display', 'none', 'important');
                } else {
                    autoScrollPanel.style.setProperty('display', 'flex', 'important');
                }
            }
            
            // Clear the active restorer if this was the one
            currentRestoreMaximized = null;
        }

        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation(); // prevent clicking through to the video (pause/play)
            
            // If we dragged more than 5 pixels, treat as drag and do not maximize
            if (vDragPixels > 5) return;
            
            const videoNode = videoContainer.querySelector('video') || (maxWrapper ? maxWrapper.querySelector('video') : null);
            if (!videoNode) return;
            
            if (!backdrop) {
                backdrop = document.createElement('div');
                backdrop.className = 'tj-video-backdrop';
                // Add click-to-close listener directly to the backdrop
                backdrop.addEventListener('click', () => {
                     // Always restore the currently active max video
                     if (currentRestoreMaximized) {
                          currentRestoreMaximized();
                     }
                });
                document.body.appendChild(backdrop);
            }

            viewState = viewState === 0 ? 1 : 0;
            
            // Pause auto-scroll and hide panel when maximizing
            const autoScrollPanel = document.getElementById('tj-auto-scroll-panel');
            
            if (viewState === 1) {
                // Register this instance as the currently active maximize for cleanup
                currentRestoreMaximized = () => {
                     const currentVideoNode = videoContainer.querySelector('video') || (maxWrapper ? maxWrapper.querySelector('video') : null);
                     restoreNormalMode(currentVideoNode);
                };
                
                // Save current position before overriding
                preMaxState = {
                    right: btn.style.right,
                    left: btn.style.left,
                    top: btn.style.top,
                    transform: btn.style.transform
                };
                
                const wasPlaying = !videoNode.paused;
                
                if (!maxWrapper) {
                    maxWrapper = document.createElement('div');
                    maxWrapper.className = 'tj-max-overlay-wrapper';
                    document.body.appendChild(maxWrapper);
                    
                    originalParent = videoNode.parentNode;
                    placeholder = document.createElement('div');
                    // Perfect placeholder replacement to stop Virtual DOM jumping/collapsing
                    const rect = videoNode.getBoundingClientRect();
                    placeholder.style.width = rect.width + 'px';
                    placeholder.style.height = rect.height + 'px';
                    // Mimic exact absolute positioning of X.com's video
                    const computed = window.getComputedStyle(videoNode);
                    placeholder.style.position = computed.position;
                    placeholder.style.top = computed.top;
                    placeholder.style.left = computed.left;
                    placeholder.style.right = computed.right;
                    placeholder.style.bottom = computed.bottom;
                    placeholder.style.margin = computed.margin;
                    placeholder.style.transform = computed.transform;
                    
                    originalParent.insertBefore(placeholder, videoNode);
                    
                    maxWrapper.appendChild(videoNode);
                    // Append button after video so it gets higher z-index DOM-wise too
                    maxWrapper.appendChild(btn); 
                    
                    // Prevent rogue clicks from bubbling to React router (which navigates away)
                    // But DON'T block clicks on our own button or the native video controls.
                    const preventReact = (ev) => {
                         if (ev.target === btn || btn.contains(ev.target)) return;
                         if (ev.target === videoNode) return; // allow video control clicks
                         
                         // The click on the empty space of maxWrapper is caught here, but maxWrapper
                         // is pointer-events: none, so clicks pass through IT to the backdrop anyway.
                         // But just in case any clicks DO hit maxWrapper, we can catch them here too.
                         if (ev.type === 'click' && ev.target === maxWrapper) {
                              restoreNormalMode(videoNode);
                         }
                         
                         ev.stopPropagation();
                    };
                    
                    maxWrapper.addEventListener('click', preventReact, true);
                    maxWrapper.addEventListener('mousedown', preventReact, true);
                    maxWrapper.addEventListener('mouseup', preventReact, true);
                    
                    if (!videoNode.hasAttribute('loop')) {
                        videoNode.controls = true; 
                    } else {
                         videoNode.controls = false;
                    }
                    if (wasPlaying) videoNode.play().catch(e => {});

                    // Lock scroll without jumping to top
                    // X.com jumps to top if overflow is hidden directly. We fix body to current scroll position instead.
                    scrollYPos = window.scrollY;
                    const sbw = window.innerWidth - document.documentElement.clientWidth;
                    
                    document.body.style.position = 'fixed';
                    document.body.style.top = `-${scrollYPos}px`;
                    document.body.style.width = '100%';
                    document.body.style.overflow = 'hidden';
                    if (sbw > 0) document.body.style.paddingRight = `${sbw}px`;

                    escListener = (evt) => {
                        if (evt.key === 'Escape') restoreNormalMode(videoNode);
                    };
                    document.addEventListener('keydown', escListener);
                    
                    // X.com uses an SPA router. If the user hits the browser back button, 
                    // the React tree updates, tearing out the video element without notice.
                    // This creates an automatic cleanup heartbeat to tear down the overlay if
                    // the original elements vanish from the DOM abruptly.
                    aliveCheckInterval = setInterval(() => {
                         if (!document.body.contains(videoContainer) && !document.body.contains(originalParent)) {
                              restoreNormalMode(null);
                         }
                    }, 500);
                }

                maxWrapper.className = 'tj-max-overlay-wrapper tj-mode-width'; // reset classes + add width/height fit
                btn.innerHTML = icons.restore;
                btn.title = 'Restore Normal';
                
                // Clear any inline positioning from dragging to ensure CSS centering works in fullscreen
                // Always spawn it cleanly at the top-right corner
                btn.style.top = '20px';
                btn.style.right = '20px';
                btn.style.left = 'auto';
                btn.style.bottom = 'auto';
                btn.style.transform = 'none';

                backdrop.classList.add('active');

                // Force hide auto-scroll panel (Feature 1)
                if (autoScrollDirection !== 0) setScrollDirection(0);
                if (autoScrollPanel) {
                     autoScrollPanel.style.setProperty('display', 'none', 'important');
                }

            } else {
                restoreNormalMode(videoNode);
            }
        });

        // Add the button
        videoContainer.appendChild(btn);
    }

    function observeReactVideos() {
        // Use MutationObserver for X.com's virtual DOM
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === 'childList') {
                    // X.com typically wraps videos in data-testid="videoPlayer"
                    const videoContainers = document.querySelectorAll('div[data-testid="videoPlayer"]');
                    videoContainers.forEach(container => {
                        insertVideoMaximizeButton(container);
                    });
                }
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        // Initial check in case they are already rendered
        const initialVideoContainers = document.querySelectorAll('div[data-testid="videoPlayer"]');
        initialVideoContainers.forEach(container => insertVideoMaximizeButton(container));
    }


    // --- Initialization ---
    
    function init() {
        // Wait for body to be available
        if (!document.body) {
            setTimeout(init, 100);
            return;
        }

        createAutoScrollUI();
        
        chrome.storage.local.get([
            KEY_DRAG, KEY_THEATER, KEY_HIDE_UI_ALWAYS, KEY_LANGUAGE, KEY_SHORTCUTS, KEY_SPEED_STEP, KEY_INTUITIVE_WHEEL, KEY_REVERSE_WHEEL,
            KEY_STOP_BIND, KEY_START_UP, KEY_START_DOWN, KEY_SPEED_UP, KEY_SPEED_DOWN
        ], (res) => {
             globalDragEnabled = res[KEY_DRAG] || false;
             globalTheaterHideEnabled = res[KEY_THEATER] !== undefined ? res[KEY_THEATER] : true;
             globalHideUIAlways = res[KEY_HIDE_UI_ALWAYS] || false;
             globalLanguage = res[KEY_LANGUAGE] || 'jp';
             globalShortcutsEnabled = res[KEY_SHORTCUTS] !== undefined ? res[KEY_SHORTCUTS] : true;
             globalSpeedStep = res[KEY_SPEED_STEP] !== undefined ? res[KEY_SPEED_STEP] : 0.2;
             globalIntuitiveWheel = res[KEY_INTUITIVE_WHEEL] || false;
             globalReverseWheel = res[KEY_REVERSE_WHEEL] || false;
             globalStopBind = res[KEY_STOP_BIND] || 'Space';
             globalStartUpBind = res[KEY_START_UP] || 'None';
             globalStartDownBind = res[KEY_START_DOWN] || 'None';
             globalSpeedUpBind = res[KEY_SPEED_UP] || 'None';
             globalSpeedDownBind = res[KEY_SPEED_DOWN] || 'None';
             
             updateContentLanguage();
        });
        
        // Listen for realtime changes from popup/options
        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace === 'local') {
                 if (changes[KEY_DRAG]) {
                     globalDragEnabled = changes[KEY_DRAG].newValue;
                     // Update cursor for all existing injected video buttons
                     document.querySelectorAll('.tj-video-maximize-btn').forEach(btn => {
                         if (globalDragEnabled) {
                              btn.style.setProperty('cursor', 'grab', 'important');
                         } else {
                              btn.style.setProperty('cursor', 'pointer', 'important');
                         }
                     });
                 }
                 if (changes[KEY_THEATER]) {
                     globalTheaterHideEnabled = changes[KEY_THEATER].newValue;
                     checkTheaterMode(); // re-eval immediate
                 }
                 if (changes[KEY_HIDE_UI_ALWAYS]) {
                     globalHideUIAlways = changes[KEY_HIDE_UI_ALWAYS].newValue;
                     checkTheaterMode();
                 }
                 if (changes[KEY_LANGUAGE]) {
                     globalLanguage = changes[KEY_LANGUAGE].newValue;
                     updateContentLanguage();
                 }
                 if (changes[KEY_SHORTCUTS]) globalShortcutsEnabled = changes[KEY_SHORTCUTS].newValue;
                 if (changes[KEY_SPEED_STEP]) globalSpeedStep = changes[KEY_SPEED_STEP].newValue;
                 if (changes[KEY_INTUITIVE_WHEEL]) globalIntuitiveWheel = changes[KEY_INTUITIVE_WHEEL].newValue;
                 if (changes[KEY_REVERSE_WHEEL]) globalReverseWheel = changes[KEY_REVERSE_WHEEL].newValue;
                 if (changes[KEY_STOP_BIND]) globalStopBind = changes[KEY_STOP_BIND].newValue;
                 if (changes[KEY_START_UP]) globalStartUpBind = changes[KEY_START_UP].newValue;
                 if (changes[KEY_START_DOWN]) globalStartDownBind = changes[KEY_START_DOWN].newValue;
                 if (changes[KEY_SPEED_UP]) globalSpeedUpBind = changes[KEY_SPEED_UP].newValue;
                 if (changes[KEY_SPEED_DOWN]) globalSpeedDownBind = changes[KEY_SPEED_DOWN].newValue;
            }
        });
        
        // Listen for reset positioning command from popup
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
             if (request.action === 'tj_reset_button_pos') {
                  const buttons = document.querySelectorAll('.tj-video-maximize-btn');
                  buttons.forEach(btn => {
                      btn.style.right = DEFAULT_BTN_POS.right;
                      btn.style.top = DEFAULT_BTN_POS.top;
                      btn.style.left = 'auto'; // clear trailing drag left
                      btn.style.bottom = 'auto'; // clear trailing drag bottom
                      btn.style.transform = DEFAULT_BTN_POS.transform;
                  });
                  sendResponse({ status: 'ok' });
             }
        });
        
        // --- Theater Mode Detection ---
        let lastTheaterState = null;
        function checkTheaterMode() {
            const panel = document.getElementById('tj-auto-scroll-panel');
            if (!panel) return;
            
            if (globalHideUIAlways) {
                 if (lastTheaterState !== 'hidden_always') {
                      panel.style.setProperty('display', 'none', 'important');
                      if (autoScrollDirection !== 0) setScrollDirection(0);
                      lastTheaterState = 'hidden_always';
                 }
                 return;
            }
            
            if (!globalTheaterHideEnabled) {
                if (lastTheaterState !== false) {
                    panel.style.setProperty('display', 'flex', 'important');
                    lastTheaterState = false;
                }
                return;
            }
            
            // Detect Theater mode robustly.
            const url = window.location.href;
            const isMediaUrl = url.includes('/photo/') || url.includes('/video/');
            const hasModal = document.querySelector('div[aria-modal="true"]') !== null;
            
            const shouldHide = isMediaUrl || hasModal;
            
            if (shouldHide && lastTheaterState !== true) {
                 console.log('[Twitter Junkie] Entering Theater Mode - Hiding Panel');
                 panel.style.setProperty('display', 'none', 'important');
                 if (autoScrollDirection !== 0) setScrollDirection(0); // Optional: stop scroll when hidden
                 lastTheaterState = true;
            } else if (!shouldHide && lastTheaterState !== false && lastTheaterState !== 'hidden_always') {
                 console.log('[Twitter Junkie] Exiting Theater Mode - Showing Panel');
                 panel.style.setProperty('display', 'flex', 'important');
                 lastTheaterState = false;
            } else if (lastTheaterState === 'hidden_always') {
                 // Force recover from force hide
                 panel.style.setProperty('display', shouldHide ? 'none' : 'flex', 'important');
                 lastTheaterState = shouldHide ? true : false;
            }
        }
        
        // robustly polling the URL handles X.com SPA navigation gracefully
        setInterval(checkTheaterMode, 500);
        
        // Initial checks
        checkTheaterMode();
        bindAdvancedShortcuts();
        observeReactVideos();
    }

    // Start
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();

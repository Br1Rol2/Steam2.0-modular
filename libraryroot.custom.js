/**
 * Steam Library Customization Script
 * 
 * This script provides enhanced functionality for the Steam library interface:
 * - Toggle to hide/show the friends list panel
 * - Manual game ordering system
 * - Enhanced color customization
 * 
 * @version 2.0
 * @author Custom Steam UI Modifications
 */

// ============================================================================
// FRIENDS LIST TOGGLE FUNCTIONALITY
// ============================================================================

/**
 * Storage key for friends list visibility state
 */
const FRIENDS_LIST_VISIBILITY_KEY = "steam_friends_list_visibility";

/**
 * Adds a toggle button to the friends list panel
 * @param {HTMLElement} panel - The friends list panel element
 */
function addFriendsListToggleButton(panel) {
  // Prevent adding multiple buttons
  if (panel.querySelector(".toggle-panel-button")) return;

  const toggleButton = document.createElement("button");
  toggleButton.innerText = "⮜"; // Arrow indicating panel can be collapsed
  toggleButton.classList.add("toggle-panel-button");
  
  // Position the button outside the panel
  toggleButton.style.cssText = `
    position: absolute;
    right: -35px;
    top: 1%;
    padding: 5px 10px;
    background: rgb(51 51 51 / 57%);
    color: white;
    border: none;
    cursor: pointer;
    z-index: 1000;
    border-radius: 5px;
    box-shadow: 0 0 5px rgba(0,0,0,0.5);
    transition: all 0.3s ease;
  `;

  // Load saved state
  const isVisible = loadFriendsListVisibility();
  let isOpen = isVisible;

  // Set initial state
  if (!isOpen) {
    panel.style.width = "0px";
    toggleButton.innerText = "⮞";
    toggleButton.style.right = "-33px";
  }

  toggleButton.addEventListener("click", () => {
    if (isOpen) {
      // Hide panel
      panel.style.width = "0px";
      toggleButton.innerText = "⮞";
      toggleButton.style.right = "-33px";
    } else {
      // Show panel
      panel.style.width = "272px";
      toggleButton.innerText = "⮜";
      toggleButton.style.right = "-33px";
    }
    
    isOpen = !isOpen;
    saveFriendsListVisibility(isOpen);
  });

  panel.appendChild(toggleButton);
}

/**
 * Loads the saved friends list visibility state
 * @returns {boolean} True if the friends list should be visible
 */
function loadFriendsListVisibility() {
  const saved = localStorage.getItem(FRIENDS_LIST_VISIBILITY_KEY);
  return saved !== "false"; // Default to visible if no saved state
}

/**
 * Saves the friends list visibility state
 * @param {boolean} isVisible - Whether the friends list should be visible
 */
function saveFriendsListVisibility(isVisible) {
  localStorage.setItem(FRIENDS_LIST_VISIBILITY_KEY, isVisible.toString());
}

/**
 * Observes the DOM for the friends list panel and adds toggle functionality
 */
function observeFriendsListPanel() {
  const observer = new MutationObserver(() => {
    const panel = document.querySelector("._9sPoVBFyE_vE87mnZJ5aB");
    if (panel) {
      addFriendsListToggleButton(panel);
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

// Initialize friends list toggle functionality
observeFriendsListPanel();

// ============================================================================
// MANUAL ORDER SCRIPT - REORGANIZED & OPTIMIZED VERSION
// ============================================================================
; (() => {
  // ============================================================================
  // CONSTANTS & CONFIGURATION
  // ============================================================================
  const GRID_CLASSES = ["_3vHkmRShhzwd67_MtEq8-n", "_3DJLGrqzoQ5vMDI_4VG502", "Panel"]
  const BOTTOM_PANEL_CLASS = "_3vCzSrrXZzZjVJFZNg9SGu"
  const GAME_SELECTOR = 'div[role="gridcell"]'
  const ROW_SELECTOR = 'div[role="row"]'
  const MANUAL_ORDER_KEY = "steam_game_manual_order_v3"
  const MANUAL_ORDER_ENABLED_KEY = "steam_manual_order_enabled"

  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================
  let isManualOrderEnabled = false
  let savedOrder = []
  let currentGrid = null
  let observer = null
  let modalOpen = false
  let isApplyingOrder = false
  let isDraggingGrid = false
  let gridDragInstalled = false

  // ── Hide Shelf / Hide News: injected <style> tags ──
  // CSS survives React re-renders and view changes (store → library, game page → library, ...),
  // and is applied as soon as this script loads, before any panel exists.
  const SHELF_CSS = "._3SkuN_ykQuWGF94fclHdhJ{display:none!important}"
  const NEWS_CSS  = "._17uEBe5Ri8TMsnfELvs8-N{display:none!important}"

  function setStyleTag(id, css) {
    let el = document.getElementById(id)
    if (!css) { if (el) el.textContent = ""; return }
    if (!el) {
      el = document.createElement("style")
      el.id = id
      ;(document.head || document.documentElement).appendChild(el)
    }
    if (el.textContent !== css) el.textContent = css
  }

  function syncHideStyles() {
    let shelfHidden = false, newsHidden = true
    try {
      shelfHidden = localStorage.getItem("steam_hide_shelf") === "true"
      const n = localStorage.getItem("steam_hide_news")
      newsHidden = n === null ? true : n === "true"
    } catch (_) {}
    setStyleTag("hide-shelf-style", shelfHidden ? SHELF_CSS : "")
    setStyleTag("hide-news-style", newsHidden ? NEWS_CSS : "")
  }
  syncHideStyles()
  document.addEventListener("DOMContentLoaded", syncHideStyles)
  // Safety net: if Steam ever drops the <style> (head rebuilt), put it back
  setInterval(syncHideStyles, 1500)
  let toggleContainer = null
  let visibilityObserver = null
  let gridRenderTimeout = null
  let originalGridHTML = null

  // Refresh detection state
  let refreshObserver = null
  let refreshDetectionActive = false
  let wasManualOrderEnabledBeforeRefresh = false
  let isRefreshInProgress = false
  let refreshCount = 0
  let refreshClickTimeout = null
  let reactivationTimeout = null

  // Create CSS styles for modal
  const style = document.createElement("style")
  style.textContent = `
        /* ── Main trigger button ── */
        #manual-toggle-container {
            display: none;
            align-items: center;
            margin: 0 6px;
            user-select: none;
            position: relative;
        }

        #panel-trigger-btn {
            background: rgba(40, 40, 40, 0.16);
            color: #ccc;
            border: 1px solid rgba(255,255,255,0.15);
            padding: 5px 10px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 12px;
            display: flex;
            align-items: center;
            gap: 6px;
            transition: background 0.2s, border-color 0.2s;
            white-space: nowrap;
        }
        #panel-trigger-btn:hover {
            background: rgba(60, 60, 60, 0.3);
            border-color: rgba(255,255,255,0.3);
            color: #fff;
        }
        #panel-trigger-btn.active {
            border-color: #2196F3;
            color: #fff;
        }
        #panel-trigger-btn .trigger-caret {
            font-size: 9px;
            opacity: 0.6;
            transition: transform 0.2s;
        }
        #panel-trigger-btn.active .trigger-caret {
            transform: rotate(180deg);
        }

        /* ── Dropdown panel (opens upward) ── */
        #panel-dropdown {
            display: none;
            position: absolute;
            bottom: calc(100% + 8px);
            left: 0;
            background: #1a1a1aee;
            border: 1px solid rgba(255,255,255,0.12);
            border-radius: 8px;
            padding: 6px 0;
            min-width: 190px;
            box-shadow: 0 -6px 24px rgba(0,0,0,0.6);
            z-index: 9999;
        }
        #panel-dropdown.open {
            display: block;
            animation: dropup 0.15s ease;
        }
        @keyframes dropup {
            from { opacity: 0; transform: translateY(6px); }
            to   { opacity: 1; transform: translateY(0);   }
        }

        /* ── Dropdown rows ── */
        .panel-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 7px 14px;
            gap: 12px;
            transition: background 0.15s;
        }
        .panel-row:hover {
            background: rgba(255,255,255,0.05);
        }
        .panel-row-label {
            font-size: 12px;
            color: #ccc;
            flex: 1;
            white-space: nowrap;
        }
        .panel-row-label.active-label {
            color: #fff;
        }

        /* ── Divider ── */
        .panel-divider {
            height: 1px;
            background: rgba(255,255,255,0.08);
            margin: 4px 0;
        }

        /* ── Reorder button (inside dropdown) ── */
        #export-order-btn, #import-order-btn {
            background: linear-gradient(135deg, #4CAF50, #45a049);
            color: white;
            border: none;
            padding: 5px 10px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 11px;
            font-weight: bold;
            transition: all 0.2s;
            white-space: nowrap;
        }
        #export-order-btn:hover, #import-order-btn:hover {
            background: linear-gradient(135deg, #45a049, #3d8b40);
        }

        .panel-hint { font-size: 11px; color: #8a8a8a; white-space: normal; max-width: 190px; line-height: 1.3; }
        #reorder-row .panel-btns { display: flex; gap: 6px; }
        body.grid-dragging, body.grid-dragging * { cursor: grabbing !important; user-select: none !important; }

        /* ── Colors button (inside dropdown) ── */
        #customize-colors-btn {
            background: linear-gradient(135deg, #9C27B0, #7B1FA2);
            color: white;
            border: none;
            padding: 5px 10px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 11px;
            font-weight: bold;
            transition: all 0.2s;
            white-space: nowrap;
        }
        #customize-colors-btn:hover {
            background: linear-gradient(135deg, #7B1FA2, #6A1B9A);
        }

        /* ── Switch ── */
        .switch {
            position: relative;
            display: inline-block;
            width: 34px;
            height: 19px;
            flex-shrink: 0;
        }
        .switch input { opacity: 0; width: 0; height: 0; }
        .slider {
            position: absolute;
            cursor: pointer;
            top: 0; left: 0; right: 0; bottom: 0;
            background-color: #444;
            border-radius: 19px;
            transition: .3s;
        }
        .slider:before {
            position: absolute;
            content: "";
            height: 15px;
            width: 15px;
            left: 2px;
            bottom: 2px;
            background-color: white;
            border-radius: 50%;
            transition: .3s;
        }
        input:checked + .slider { background-color: #2196F3; }
        input:checked + .slider:before { transform: translateX(15px); }

        /* Hidden file input */
        #import-file-input { display: none; }

        /* Modal overlay */
        #reorder-modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        /* Modal container */
        #reorder-modal {
            background: linear-gradient(145deg, #2a2a2a, #1a1a1a);
            border-radius: 12px;
            padding: 20px;
            max-width: 90vw;
            max-height: 90vh;
            width: 800px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.5);
            border: 1px solid #444;
            animation: slideInUp 0.3s ease;
        }

        /* Modal header */
        #reorder-modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 2px solid #444;
        }

        #reorder-modal-title {
            color: white;
            font-size: 20px;
            font-weight: bold;
            margin: 0;
        }

        #close-modal {
            background: #f44336;
            color: white;
            border: none;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            cursor: pointer;
            font-size: 18px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        #close-modal:hover {
            background: #d32f2f;
        }

        /* Games list container */
        #games-list-container {
            max-height: 60vh;
            overflow-y: auto;
            margin-bottom: 20px;
            padding-right: 10px;
        }

        /* Game items in modal */
        .modal-game-item {
            display: flex;
            align-items: center;
            background: linear-gradient(135deg, #3a3a3a, #2a2a2a);
            border: 1px solid #555;
            border-radius: 8px;
            padding: 12px;
            margin-bottom: 8px;
            cursor: grab;
            transition: all 0.2s ease;
            position: relative;
        }
        .modal-game-item:hover {
            background: linear-gradient(135deg, #4a4a4a, #3a3a3a);
            border-color: #2196F3;
            transform: translateY(-1px);
            box-shadow: 0 4px 8px rgba(33, 150, 243, 0.2);
        }
        .modal-game-item.dragging {
            opacity: 0.7;
            transform: rotate(2deg) scale(1.02);
            z-index: 1000;
            box-shadow: 0 8px 16px rgba(0,0,0,0.3);
        }
        .modal-game-item.drop-target {
            border: 2px solid #4CAF50 !important;
            background: linear-gradient(135deg, rgba(76, 175, 80, 0.2), rgba(76, 175, 80, 0.1)) !important;
        }

        .modal-game-drag-handle {
            color: #888;
            font-size: 16px;
            margin-right: 12px;
            cursor: grab;
        }
        .modal-game-drag-handle:active {
            cursor: grabbing;
        }

        .modal-game-image {
            width: 60px;
            height: 45px;
            border-radius: 4px;
            margin-right: 12px;
            object-fit: cover;
            border: 1px solid #555;
        }

        .modal-game-info {
            flex: 1;
            color: white;
        }

        .modal-game-title {
            font-weight: bold;
            margin-bottom: 4px;
            font-size: 14px;
        }

        .modal-game-id {
            font-size: 11px;
            color: #888;
        }

        .modal-game-position {
            background: #2196F3;
            color: white;
            border-radius: 50%;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: bold;
            margin-right: 8px;
        }

        /* Modal footer */
        #reorder-modal-footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding-top: 15px;
            border-top: 1px solid #444;
        }

        .modal-button {
            padding: 10px 20px;
            border: none;
            border-radius: 6px;
            font-weight: bold;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.2s ease;
            margin-left: 8px;
        }

        #apply-order {
            background: linear-gradient(135deg, #4CAF50, #45a049);
            color: white;
        }
        #apply-order:hover {
            background: linear-gradient(135deg, #45a049, #3d8b40);
            transform: translateY(-1px);
        }

        #export-order-modal {
            background: linear-gradient(135deg, #2196F3, #1976D2);
            color: white;
        }
        #export-order-modal:hover {
            background: linear-gradient(135deg, #1976D2, #1565C0);
            transform: translateY(-1px);
        }

        #import-order-modal {
            background: linear-gradient(135deg, #FF9800, #F57C00);
            color: white;
        }
        #import-order-modal:hover {
            background: linear-gradient(135deg, #F57C00, #E65100);
            transform: translateY(-1px);
        }

        #cancel-reorder {
            background: linear-gradient(135deg, #666, #555);
            color: white;
        }
        #cancel-reorder:hover {
            background: linear-gradient(135deg, #777, #666);
        }

        /* Custom scrollbar */
        #games-list-container::-webkit-scrollbar {
            width: 8px;
        }
        #games-list-container::-webkit-scrollbar-track {
            background: #2a2a2a;
            border-radius: 4px;
        }
        #games-list-container::-webkit-scrollbar-thumb {
            background: #555;
            border-radius: 4px;
        }
        #games-list-container::-webkit-scrollbar-thumb:hover {
            background: #666;
        }

        /* Animations */
        @keyframes slideInUp {
            from {
                transform: translateY(30px);
                opacity: 0;
            }
            to {
                transform: translateY(0);
                opacity: 1;
            }
        }

        @keyframes slideInRight {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }

        .DialogDropDown.disabled {
            pointer-events: none;
            opacity: 0.5;
            cursor: not-allowed;
        }

        /* Grid loading indicator */
        .manual-order-active.loading::before {
            content: "🔄 Applying custom order...";
            position: absolute;
            top: 10px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(33, 150, 243, 0.9);
            color: white;
            padding: 8px 16px;
            border-radius: 4px;
            font-size: 12px;
            z-index: 1000;
            animation: pulse 1s infinite;
        }

        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.7; }
        }
    `
  document.head.appendChild(style)

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================
  
  /**
   * Find element by multiple class names
   * @param {string[]} classes - Array of class names to match
   * @param {string} tag - HTML tag to search for
   * @returns {HTMLElement|null} - Found element or null
   */
  function findByClasses(classes, tag = "div") {
    const elements = Array.from(document.querySelectorAll(tag))
    return elements.find((el) => el && classes.every((cls) => el.classList.contains(cls)))
  }

  /**
   * Check if Ready to Play filter is currently active
   * @returns {boolean} - True if Ready to Play is active
   */
  function isReadyToPlayActive() {
    // Find Ready to Play button by SVG viewBox
    const svg = document.querySelector('svg[viewBox="-305.5 396.5 256 256"]')
    if (!svg) return false

    const readyToPlayButton = svg.closest('[role="button"]')
    if (!readyToPlayButton) return false

    // Reliable, mutually-exclusive checks only (no broad OR chains that
    // evaluate true almost unconditionally)
    if (readyToPlayButton.getAttribute("aria-pressed") === "true") return true
    if (readyToPlayButton.getAttribute("data-active") === "true") return true
    if (readyToPlayButton.classList.contains("active")) return true
    if (readyToPlayButton.classList.contains("selected")) return true

    return false
  }

  // ============================================================================
  // REFRESH DETECTION & HANDLING
  // ============================================================================
  
  /**
   * Simulate click on refresh button and handle manual order state
   * @param {HTMLElement} element - Refresh button element
   * @returns {boolean} - True if refresh was triggered
   */
  function simulateRefreshClick(element) {
    if (!element) return false;

    refreshCount++;

    try { 
      // Remember manual order state only if not already in refresh
      if (!isRefreshInProgress) {
        wasManualOrderEnabledBeforeRefresh = isManualOrderEnabled;
        isRefreshInProgress = true;
      }

      // Temporarily disable toggle if manual order was active
      if (wasManualOrderEnabledBeforeRefresh) {
        const toggleInput = document.getElementById("manual-order-toggle");
        if (toggleInput && toggleInput.checked) {
          toggleInput.checked = false;
          toggleInput.dispatchEvent(new Event("change"));
        }
      }

      // Ensure element is visible and click it
      element.scrollIntoView({ behavior: "instant", block: "center" });

      setTimeout(() => {
        try {
          element.click();
          
          // Synthetic click as backup
          const clickEvent = new MouseEvent('click', {
            view: window,
            bubbles: true,
            cancelable: true,
            clientX: element.getBoundingClientRect().left + element.offsetWidth / 2,
            clientY: element.getBoundingClientRect().top + element.offsetHeight / 2
          });
          element.dispatchEvent(clickEvent);

          // Schedule auto-reactivation if manual order was active
          if (wasManualOrderEnabledBeforeRefresh) {
            scheduleAutoReactivation();
          } else {
            setTimeout(() => {
              isRefreshInProgress = false;
            }, 3000);
          }

        } catch (err) {
          setTimeout(() => {
            isRefreshInProgress = false;
          }, 3000);
        }
      }, 100);

      return true;
    } catch (err) {
      setTimeout(() => {
        isRefreshInProgress = false;
      }, 3000);
      return false;
    }
  }

  /**
   * Schedule automatic reactivation of manual order after refresh
   */
  function scheduleAutoReactivation() {
    // Clear previous timeout if exists
    if (reactivationTimeout) {
      clearTimeout(reactivationTimeout);
    }

    // Try reactivation at multiple intervals
    const reactivationAttempts = [2000, 4000, 6000, 8000, 10000]; // 2s, 4s, 6s, 8s, 10s

    reactivationAttempts.forEach((delay, index) => {
      setTimeout(() => {
        attemptReactivation(index + 1, reactivationAttempts.length);
      }, delay);
    });
  }

  /**
   * Start enhanced refresh detection with MutationObserver
   */
  function startEnhancedRefreshDetection() {
    if (refreshDetectionActive) return;

    refreshDetectionActive = true;

    // Initial verification
    if (searchAndClickRefresh()) {
      return;
    }

    // Enhanced observer with better sensitivity
    if (refreshObserver) {
      refreshObserver.disconnect();
    }

    refreshObserver = new MutationObserver((mutations) => {
      let shouldCheck = false;

      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          const addedNodes = Array.from(mutation.addedNodes);

          // Check if added nodes might contain refresh
          const relevantNodes = addedNodes.filter(node => {
            if (node.nodeType !== 1) return false;

            const text = node.textContent?.toLowerCase() || '';
            return text.includes('refresh') ||
              node.querySelector && (
                node.querySelector('span[style*="underline"]') ||
                node.querySelector('a[style*="underline"]')
              );
          });

          if (relevantNodes.length > 0) {
            shouldCheck = true;
          }
        } else if (mutation.type === 'attributes') {
          const target = mutation.target;
          if (target.textContent?.toLowerCase().includes('refresh')) {
            shouldCheck = true;
          }
        }
      });

      if (shouldCheck) {
        // Debounce to avoid multiple checks
        if (refreshClickTimeout) {
          clearTimeout(refreshClickTimeout);
        }

        refreshClickTimeout = setTimeout(() => {
          searchAndClickRefresh();
        }, 100);
      }
    });

    refreshObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class'],
      characterData: true
    });
  }

  /**
   * Stop refresh detection and clean up observers
   */
  function stopRefreshDetection() {
    refreshDetectionActive = false;

    if (refreshObserver) {
      refreshObserver.disconnect();
      refreshObserver = null;
    }

    if (refreshClickTimeout) {
      clearTimeout(refreshClickTimeout);
      refreshClickTimeout = null;
    }
  }

  // Start detection automatically
  startEnhancedRefreshDetection();

  /**
   * Attempt to reactivate manual order after refresh
   * @param {number} attemptNumber - Current attempt number
   * @param {number} totalAttempts - Total number of attempts
   */
  function attemptReactivation(attemptNumber, totalAttempts) {
    // Only reactivate if manual order was enabled before refresh
    if (!wasManualOrderEnabledBeforeRefresh) {
      return;
    }

    const toggleInput = document.getElementById("manual-order-toggle");
    const grid = findByClasses(GRID_CLASSES);

    if (toggleInput && grid && !isManualOrderEnabled) {
      try {
        toggleInput.checked = true;
        toggleInput.dispatchEvent(new Event("change"));

        showNotification("🔄 Manual order reactivated automatically after refresh");

        // Reset flags after successful reactivation
        wasManualOrderEnabledBeforeRefresh = false;
        isRefreshInProgress = false;

      } catch (error) {
        // Reset flags on last attempt
        if (attemptNumber === totalAttempts) {
          wasManualOrderEnabledBeforeRefresh = false;
          isRefreshInProgress = false;
        }
      }
    } else {
      // Reset flags on last attempt
      if (attemptNumber === totalAttempts) {
        wasManualOrderEnabledBeforeRefresh = false;
        isRefreshInProgress = false;
      }
    }
  }


  /**
   * Search for and click refresh button
   * @returns {boolean} - True if refresh was found and clicked
   */
  function searchAndClickRefresh() {
    // Search for refresh elements with multiple selectors
    const selectors = [
      'span[style*="underline"]',
      'a[style*="underline"]',
      'span:contains("refresh")',
      'a:contains("refresh")',
      '*[role="button"]'
    ];

    let refreshFound = false;

    for (const selector of selectors) {
      try {
        const elements = document.querySelectorAll(selector.replace(':contains("refresh")', ''));

        for (const element of elements) {
          const text = element.textContent?.trim().toLowerCase();

          if (text === "refresh" || text.includes("refresh")) {
            if (simulateRefreshClick(element)) {
              refreshFound = true;
              break;
            }
          }
        }

        if (refreshFound) break;
      } catch (e) {
        // Silently handle selector errors
      }
    }

    return refreshFound;
  }

  // Check if refresh is already in DOM when script loads
  if (searchAndClickRefresh()) {
    // Refresh was found and clicked
  } else {
    // Set up observer for refresh detection
    const observer2 = new MutationObserver(() => {
      searchAndClickRefresh();
    });

    observer2.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // ============================================================================
  // GAME DATA EXTRACTION
  // ============================================================================
  
  /**
   * Extract unique game ID from game cell
   * @param {HTMLElement} gameCell - Game cell element
   * @returns {string} - Unique game identifier
   */
  function getGameId(gameCell) {
    // Try <a role="link"> first (old structure)
    const linkA = gameCell.querySelector('a[role="link"]')
    if (linkA) {
      const href = linkA.getAttribute("href") || ""
      const match = href.match(/app\/(\d+)/)
      if (match) return match[1]
    }

    // New structure: Steam uses div[role="link"] — no href, but image src contains app ID
    // e.g. /assets/271590/library_600x900.jpg  or  /customimages/730p.jpg
    const img = gameCell.querySelector("img")
    if (img && img.src) {
      // /assets/<appid>/...  pattern
      const assetMatch = img.src.match(/\/assets\/(\d+)\//)
      if (assetMatch) return assetMatch[1]
      // /customimages/<appid>p.  pattern
      const customMatch = img.src.match(/\/customimages\/(\d+)p\./)
      if (customMatch) return customMatch[1]
    }

    // Fallback: create a hash from the game title
    const gameTitle = getGameTitle(gameCell)

    // If we couldn't even get a title, this card is in a transient/incomplete
    // DOM state (e.g. mid tab-transition, image not loaded yet). Return null
    // instead of a colliding hash so callers can skip it safely.
    if (!gameTitle || gameTitle === "Unknown Game") {
      return null
    }

    // Create a simple hash from the title
    let hash = 0
    for (let i = 0; i < gameTitle.length; i++) {
      const char = gameTitle.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    
    // Convert to base36 and ensure it's always positive
    const hashStr = Math.abs(hash).toString(36)
    
    // Add a prefix to make it more unique and ensure minimum length
    return `game_${hashStr}`.substring(0, 16)
  }

  /**
   * Generate compatible game ID (for backward compatibility)
   * This function can generate both old and new format IDs
   * @param {string} gameTitle - Game title
   * @param {boolean} useOldFormat - Whether to use old btoa format
   * @returns {string} - Game ID
   */
  function generateCompatibleGameId(gameTitle, useOldFormat = false) {
    if (useOldFormat) {
      // Old format: btoa with truncation
      try {
        return btoa(gameTitle).replace(/[^a-zA-Z0-9]/g, "").substring(0, 16)
      } catch (error) {
        // Fallback to new format if btoa fails
        let hash = 0
        for (let i = 0; i < gameTitle.length; i++) {
          const char = gameTitle.charCodeAt(i)
          hash = ((hash << 5) - hash) + char
          hash = hash & hash
        }
        return `game_${Math.abs(hash).toString(36)}`.substring(0, 16)
      }
    } else {
      // New format: hash with prefix
      let hash = 0
      for (let i = 0; i < gameTitle.length; i++) {
        const char = gameTitle.charCodeAt(i)
        hash = ((hash << 5) - hash) + char
        hash = hash & hash
      }
      return `game_${Math.abs(hash).toString(36)}`.substring(0, 16)
    }
  }

  /**
   * Check if a game ID is in old format
   * @param {string} gameId - Game ID to check
   * @returns {boolean} - True if old format
   */
  function isOldFormatId(gameId) {
    // Numeric IDs (from image src) and "game_" hash IDs are both current formats
    // Old format IDs were base64-like strings (no prefix, not purely numeric)
    if (!gameId) return false
    if (/^\d+$/.test(gameId)) return false        // numeric → current format
    if (gameId.startsWith("game_")) return false   // hash → current format
    return true  // anything else → old btoa format
  }

  /**
   * Convert old format ID to new format
   * @param {string} oldId - Old format game ID
   * @param {string} gameTitle - Game title
   * @returns {string} - New format game ID
   */
  function convertOldIdToNew(oldId, gameTitle) {
    return generateCompatibleGameId(gameTitle, false)
  }

  /**
   * Extract game title from game cell
   * @param {HTMLElement} gameCell - Game cell element
   * @returns {string} - Game title
   */
  function getGameTitle(gameCell) {
    // New Steam structure: the title is in a hidden div whose id is referenced by aria-labelledby
    // The first id in aria-labelledby on the div[role="link"] holds the game title
    const linkDiv = gameCell.querySelector('[role="link"]')
    if (linkDiv) {
      const labelledBy = linkDiv.getAttribute("aria-labelledby") || ""
      const firstLabelId = labelledBy.trim().split(/\s+/)[0]
      if (firstLabelId) {
        const labelEl = document.getElementById(firstLabelId)
        if (labelEl && labelEl.textContent.trim()) return labelEl.textContent.trim()
      }
    }

    const img = gameCell.querySelector("img")
    if (img && img.alt) return img.alt

    const link = gameCell.querySelector('a[role="link"]')
    if (link && link.textContent.trim()) return link.textContent.trim()

    return "Unknown Game"
  }

  /**
   * Extract game image URL from game cell
   * @param {HTMLElement} gameCell - Game cell element
   * @returns {string} - Game image URL
   */
  function getGameImage(gameCell) {
    const img = gameCell.querySelector("img")
    return img ? img.src : ""
  }

  /**
   * Get all game cells from current grid
   * @returns {HTMLElement[]} - Array of game cell elements
   */
  function getAllGames() {
    if (!currentGrid) return []
    return Array.from(currentGrid.querySelectorAll(GAME_SELECTOR))
  }

  // ============================================================================
  // STORAGE MANAGEMENT
  // ============================================================================
  
  /**
   * Save current game order to localStorage
   * @param {Array} newOrder - Optional new order to save
   */
  function saveOrder(newOrder = null) {
    if (!currentGrid || !isManualOrderEnabled) return

    let gameOrder
    if (newOrder) {
      gameOrder = newOrder
    } else {
      gameOrder = getAllGames().map((cell) => ({
        id: getGameId(cell),
        title: getGameTitle(cell),
      }))
    }

    savedOrder = gameOrder
    localStorage.setItem(MANUAL_ORDER_KEY, JSON.stringify(gameOrder))
  }

  /**
   * Load saved game order from localStorage
   * @returns {Array} - Saved game order or empty array
   */
  function loadOrder() {
    const saved = localStorage.getItem(MANUAL_ORDER_KEY)
    if (saved) {
      try {
        savedOrder = JSON.parse(saved)
        return savedOrder
      } catch (e) {
        console.error("[ManualOrder] Error loading order:", e)
      }
    }
    return []
  }

  /**
   * Save manual order enabled state
   * @param {boolean} enabled - Whether manual order is enabled
   */
  function saveEnabledState(enabled) {
    localStorage.setItem(MANUAL_ORDER_ENABLED_KEY, enabled.toString())
  }

  /**
   * Load manual order enabled state
   * @returns {boolean} - Whether manual order was enabled
   */
  function loadEnabledState() {
    const saved = localStorage.getItem(MANUAL_ORDER_ENABLED_KEY)
    return saved === "true"
  }

  /**
   * Synchronize localStorage with current games in DOM
   * This function detects new games and missing games, and updates the saved order accordingly
   */
  function synchronizeGameOrder() {
    if (!currentGrid || !isManualOrderEnabled) return

    try {
      const currentGames = getAllGames()
      if (currentGames.length === 0) {
        console.log("[ManualOrder] ⚠️ No games found in grid, skipping synchronization")
        return false
      }

      // Safety guard: if the DOM suddenly shows far fewer games than what we
      // have saved (e.g. mid-transition between Store/Community and Library,
      // or images still loading), do NOT synchronize — this would wrongly
      // mark real games as "removed" and corrupt savedOrder permanently.
      // Allow sync only when counts are close, or when we have no saved order yet.
      if (savedOrder.length > 0) {
        const dropRatio = (savedOrder.length - currentGames.length) / savedOrder.length
        if (dropRatio > 0.3) {
          console.warn(
            `[ManualOrder] ⚠️ Skipping sync: suspicious game count drop (${currentGames.length} vs ${savedOrder.length} saved) — likely transient DOM state`,
          )
          return false
        }
      }

      console.log(`[ManualOrder] 🔄 Synchronizing order: ${currentGames.length} current games, ${savedOrder.length} saved games`)

      // Create a map of current games for quick lookup
      const currentGameMap = new Map()
      currentGames.forEach((cell, index) => {
        try {
          const id = getGameId(cell)
          const title = getGameTitle(cell)
          
          if (id && title) {
            currentGameMap.set(id, {
              id: id,
              title: title,
              element: cell
            })
          } else {
            console.warn(`[ManualOrder] ⚠️ Skipping game ${index}: invalid ID or title`)
          }
        } catch (error) {
          console.error(`[ManualOrder] ❌ Error processing game ${index}:`, error)
        }
      })

      // Create a map of saved games for quick lookup
      const savedGameMap = new Map()
      savedOrder.forEach(game => {
        if (game && game.id) {
          savedGameMap.set(game.id, game)
        }
      })

      let orderChanged = false
      const newOrder = []

      // Step 1: Keep existing games in their saved order
      savedOrder.forEach(savedGame => {
        if (savedGame && currentGameMap.has(savedGame.id)) {
          // Game still exists, keep it in the same position
          newOrder.push(savedGame)
          currentGameMap.delete(savedGame.id) // Remove from current map to track remaining
        } else if (savedGame) {
          // Game no longer exists, skip it
          console.log(`[ManualOrder] 🗑️ Removed missing game: ${savedGame.title} (${savedGame.id})`)
          orderChanged = true
        }
      })

      // Step 2: Add new games at the end
      currentGameMap.forEach((gameData, id) => {
        newOrder.push({
          id: id,
          title: gameData.title
        })
        console.log(`[ManualOrder] ➕ Added new game: ${gameData.title} (${id})`)
        orderChanged = true
      })

      // Update saved order if changes were detected
      if (orderChanged) {
        savedOrder = newOrder
        localStorage.setItem(MANUAL_ORDER_KEY, JSON.stringify(newOrder))
        console.log(`[ManualOrder] ✅ Order synchronized: ${newOrder.length} games`)
        
        // Show notification about changes
        const addedCount = currentGameMap.size
        const removedCount = savedOrder.length - newOrder.length + addedCount
        
        if (addedCount > 0 || removedCount > 0) {
          let message = "🔄 Order synchronized: "
          if (addedCount > 0) message += `+${addedCount} new games `
          if (removedCount > 0) message += `-${removedCount} removed games`
          showNotification(message)
        }
      } else {
        console.log(`[ManualOrder] ✅ Order already synchronized`)
      }

      return orderChanged
    } catch (error) {
      console.error("[ManualOrder] ❌ Error during synchronization:", error)
      return false
    }
  }

  /**
   * Enhanced apply order with automatic synchronization
   */
  function applyOrderWithSync() {
    if (!currentGrid || !isManualOrderEnabled || isApplyingOrder) {
      return
    }

    // First, synchronize the order
    const wasSynchronized = synchronizeGameOrder()

    // Then apply the order
    applyOrder()

    return wasSynchronized
  }

  /**
   * Check if significant changes occurred in game count
   * @returns {boolean} - True if significant changes detected
   */
  function detectSignificantChanges() {
    if (!currentGrid) return false

    const currentGames = getAllGames()
    const currentCount = currentGames.length
    const savedCount = savedOrder.length

    // Detect significant changes (more than 1 game difference)
    const difference = Math.abs(currentCount - savedCount)
    const isSignificant = difference > 1

    if (isSignificant) {
      console.log(`[ManualOrder] 🚨 Significant change detected: ${currentCount} current vs ${savedCount} saved (diff: ${difference})`)
    }

    return isSignificant
  }

  /**
   * Force synchronization when significant changes are detected
   */
  function forceSynchronizationIfNeeded() {
    if (!isManualOrderEnabled) return

    if (detectSignificantChanges()) {
      console.log("[ManualOrder] 🔄 Forcing synchronization due to significant changes")
      synchronizeGameOrder()
      applyOrder()
      showNotification("🔄 Order synchronized due to game changes")
    }
  }

  /**
   * Debug function to show synchronization status
   */
  function debugSynchronizationStatus() {
    if (!currentGrid) {
      console.log("[ManualOrder] ❌ No grid found")
      return
    }

    const currentGames = getAllGames()
    const currentCount = currentGames.length
    const savedCount = savedOrder.length

    console.log("=== Manual Order Synchronization Status ===")
    console.log(`Current games in DOM: ${currentCount}`)
    console.log(`Saved games in localStorage: ${savedCount}`)
    console.log(`Manual order enabled: ${isManualOrderEnabled}`)
    console.log(`Applying order: ${isApplyingOrder}`)
    
    if (currentCount > 0) {
      console.log("Current games:", currentGames.map(cell => getGameTitle(cell)).slice(0, 5))
    }
    
    if (savedCount > 0) {
      console.log("Saved games:", savedOrder.map(game => game.title).slice(0, 5))
    }

    const difference = Math.abs(currentCount - savedCount)
    if (difference > 0) {
      console.log(`⚠️ Difference detected: ${difference} games`)
      console.log("Recommendation: Run synchronizeGameOrder()")
    } else {
      console.log("✅ Order is synchronized")
    }
    console.log("==========================================")
  }

  /**
   * Debug function to test game ID generation
   */
  function debugGameIds() {
    if (!currentGrid) {
      console.log("[ManualOrder] ❌ No grid found")
      return
    }

    const games = getAllGames()
    console.log("=== Game ID Generation Test ===")
    console.log(`Testing ${games.length} games...`)
    
    games.slice(0, 10).forEach((cell, index) => {
      const title = getGameTitle(cell)
      const id = getGameId(cell)
      console.log(`${index + 1}. "${title}" -> ID: ${id}`)
    })
    
    console.log("================================")
  }

  /**
   * Debug function to test import synchronization
   */
  function debugImportSync() {
    if (!currentGrid) {
      console.log("[ManualOrder] ❌ No grid found")
      return
    }

    const currentGames = getAllGames()
    console.log("=== Import Synchronization Test ===")
    console.log(`Current games in DOM: ${currentGames.length}`)
    console.log(`Saved games in localStorage: ${savedOrder.length}`)
    
    // Create a mock imported order with some games that exist and some that don't
    const mockImportedOrder = [
      ...savedOrder.slice(0, 3), // Keep first 3 games
      { id: "fake_game_1", title: "Fake Game 1" }, // This won't exist
      { id: "fake_game_2", title: "Fake Game 2" }, // This won't exist
    ]
    
    console.log(`Mock imported order: ${mockImportedOrder.length} games`)
    console.log("Testing synchronization...")
    
    const synchronized = synchronizeImportedOrder(mockImportedOrder)
    console.log(`Synchronized result: ${synchronized.length} games`)
    console.log("================================")
  }

  /**
   * Debug function to test order preservation
   */
  function debugOrderPreservation() {
    if (!currentGrid) {
      console.log("[ManualOrder] ❌ No grid found")
      return
    }

    const currentGames = getAllGames()
    console.log("=== Order Preservation Test ===")
    console.log(`Current games in DOM: ${currentGames.length}`)
    
    if (savedOrder.length === 0) {
      console.log("❌ No saved order to test")
      return
    }
    
    // Create a partial import (less games than current)
    const partialImport = savedOrder.slice(0, Math.floor(savedOrder.length / 2))
    console.log(`Partial import: ${partialImport.length} games (${savedOrder.length} total available)`)
    
    console.log("Original order (first 5):", savedOrder.slice(0, 5).map(g => g.title))
    console.log("Partial import (first 5):", partialImport.slice(0, 5).map(g => g.title))
    
    const synchronized = synchronizeImportedOrder(partialImport)
    console.log("Synchronized result (first 5):", synchronized.slice(0, 5).map(g => g.title))
    
    // Check if order is preserved for imported games
    let orderPreserved = true
    for (let i = 0; i < partialImport.length; i++) {
      if (synchronized[i] && synchronized[i].id !== partialImport[i].id) {
        orderPreserved = false
        break
      }
    }
    
    console.log(`Order preserved: ${orderPreserved ? "✅ YES" : "❌ NO"}`)
    console.log("================================")
  }

  /**
   * Debug function to test backward compatibility
   */
  function debugBackwardCompatibility() {
    console.log("=== Backward Compatibility Test ===")
    
    const testTitles = [
      "Cuphead",
      "Katana ZERO", 
      "Counter-Strike 2",
      "FIFA 22"
    ]
    
    testTitles.forEach(title => {
      const oldId = generateCompatibleGameId(title, true)
      const newId = generateCompatibleGameId(title, false)
      const isOld = isOldFormatId(oldId)
      const convertedId = convertOldIdToNew(oldId, title)
      
      console.log(`"${title}":`)
      console.log(`  Old ID: ${oldId} (isOld: ${isOld})`)
      console.log(`  New ID: ${newId}`)
      console.log(`  Converted: ${convertedId}`)
      console.log(`  Match: ${newId === convertedId ? "✅" : "❌"}`)
    })
    
    console.log("================================")
  }

  // ============================================================================
  // IMPORT/EXPORT FUNCTIONALITY
  // ============================================================================
  
  /**
   * Export current game order to JSON file
   */
  function exportOrder() {
    const orderData = {
      version: "5.1",
      timestamp: new Date().toISOString(),
      gameCount: savedOrder.length,
      order: savedOrder,
    }

    const dataStr = JSON.stringify(orderData, null, 2)
    const dataBlob = new Blob([dataStr], { type: "application/json" })

    const link = document.createElement("a")
    link.href = URL.createObjectURL(dataBlob)
    link.download = `steam-game-order-${new Date().toISOString().split("T")[0]}.json`
    link.click()

    showNotification(`📁 Order exported (${savedOrder.length} games)`)
  }

  /**
   * Trigger file import dialog
   */
  function importOrder() {
    const input = document.getElementById("import-file-input")
    if (!input) return

    input.click()
  }

  /**
   * Handle imported order file with automatic synchronization
   * @param {Event} event - File input change event
   */
  function handleImportFile(event) {
    const file = event.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const importedData = JSON.parse(e.target.result)

        if (!importedData.order || !Array.isArray(importedData.order)) {
          throw new Error("Invalid file format")
        }

        console.log(`[ManualOrder] 📂 Importing order with ${importedData.order.length} games`)

        // Store the imported order temporarily
        const importedOrder = importedData.order

        // Synchronize the imported order with current games
        const synchronizedOrder = synchronizeImportedOrder(importedOrder)

        // Update saved order with synchronized version
        savedOrder = synchronizedOrder
        localStorage.setItem(MANUAL_ORDER_KEY, JSON.stringify(savedOrder))

        if (isManualOrderEnabled) {
          applyOrderWithSync()
        }

        showNotification(`📂 Order imported and synchronized (${savedOrder.length} games)`)

        // Close modal after import
        closeModal()
      } catch (error) {
        showNotification("❌ Error importing file")
        console.error("[ManualOrder] Import error:", error)
      }
    }
    reader.readAsText(file)

    // Reset input
    event.target.value = ""
  }

  /**
   * Synchronize imported order with current games in DOM
   * @param {Array} importedOrder - The imported order array
   * @returns {Array} - Synchronized order array
   */
  function synchronizeImportedOrder(importedOrder) {
    if (!currentGrid) {
      console.log("[ManualOrder] ⚠️ No grid found, returning imported order as-is")
      return importedOrder
    }

    try {
      const currentGames = getAllGames()
      if (currentGames.length === 0) {
        console.log("[ManualOrder] ⚠️ No games found in grid, returning imported order as-is")
        return importedOrder
      }

      console.log(`[ManualOrder] 🔄 Synchronizing imported order: ${currentGames.length} current games, ${importedOrder.length} imported games`)

      // Create a map of current games for quick lookup
      const currentGameMap = new Map()
      currentGames.forEach((cell, index) => {
        try {
          const id = getGameId(cell)
          const title = getGameTitle(cell)
          
          if (id && title) {
            currentGameMap.set(id, {
              id: id,
              title: title,
              element: cell
            })
          } else {
            console.warn(`[ManualOrder] ⚠️ Skipping game ${index}: invalid ID or title`)
          }
        } catch (error) {
          console.error(`[ManualOrder] ❌ Error processing game ${index}:`, error)
        }
      })

      // Create a map of imported games for quick lookup (with backward compatibility)
      const importedGameMap = new Map()
      const oldFormatGames = []
      
      importedOrder.forEach(game => {
        if (game && game.id) {
          // Check if this is an old format ID
          if (isOldFormatId(game.id)) {
            console.log(`[ManualOrder] 🔄 Converting old format ID: ${game.title} (${game.id})`)
            oldFormatGames.push(game)
          } else {
            importedGameMap.set(game.id, game)
          }
        }
      })

      // Convert old format games to new format and add to map
      oldFormatGames.forEach(oldGame => {
        const newId = convertOldIdToNew(oldGame.id, oldGame.title)
        const convertedGame = {
          id: newId,
          title: oldGame.title
        }
        importedGameMap.set(newId, convertedGame)
        console.log(`[ManualOrder] ✅ Converted: ${oldGame.title} (${oldGame.id} -> ${newId})`)
      })

      const synchronizedOrder = []
      let addedCount = 0
      let removedCount = 0
      let keptCount = 0

      // Step 1: Keep imported games that still exist in current DOM (preserving order)
      importedOrder.forEach(importedGame => {
        if (!importedGame) return
        
        // Get the correct ID (converted if necessary)
        let gameId = importedGame.id
        if (isOldFormatId(gameId)) {
          gameId = convertOldIdToNew(gameId, importedGame.title)
        }
        
        if (currentGameMap.has(gameId)) {
          // Game exists in both imported and current, keep it in the same position
          const gameToAdd = {
            id: gameId,
            title: importedGame.title
          }
          synchronizedOrder.push(gameToAdd)
          currentGameMap.delete(gameId) // Remove from current map to track remaining
          keptCount++
          console.log(`[ManualOrder] ✅ Kept imported game: ${importedGame.title} (${gameId})`)
        } else {
          // Game from import no longer exists in current DOM, skip it
          console.log(`[ManualOrder] 🗑️ Skipping imported game that no longer exists: ${importedGame.title} (${importedGame.id})`)
          removedCount++
        }
      })

      // Step 2: Add current games that weren't in the imported order (at the end)
      currentGameMap.forEach((gameData, id) => {
        synchronizedOrder.push({
          id: id,
          title: gameData.title
        })
        console.log(`[ManualOrder] ➕ Added current game not in import: ${gameData.title} (${id})`)
        addedCount++
      })

      // Step 3: Verify and fix order if needed
      if (synchronizedOrder.length !== currentGames.length) {
        console.warn(`[ManualOrder] ⚠️ Order count mismatch: ${synchronizedOrder.length} vs ${currentGames.length}`)
        
        // Re-sync to ensure all current games are included
        const finalOrder = []
        const usedIds = new Set()
        
        // First, add all synchronized games (preserving import order)
        synchronizedOrder.forEach(game => {
          if (game && game.id && !usedIds.has(game.id)) {
            finalOrder.push(game)
            usedIds.add(game.id)
          }
        })
        
        // Then, add any missing current games
        currentGames.forEach(cell => {
          const id = getGameId(cell)
          const title = getGameTitle(cell)
          
          if (id && title && !usedIds.has(id)) {
            finalOrder.push({
              id: id,
              title: title
            })
            console.log(`[ManualOrder] 🔧 Added missing game: ${title} (${id})`)
          }
        })
        
        return finalOrder
      }

      console.log(`[ManualOrder] ✅ Import synchronization complete:`)
      console.log(`   - Kept: ${keptCount} games (preserving import order)`)
      console.log(`   - Removed: ${removedCount} games (no longer exist)`)
      console.log(`   - Added: ${addedCount} games (new in current DOM)`)
      console.log(`   - Final count: ${synchronizedOrder.length} games`)

      // Final verification: ensure order is complete and correct
      if (synchronizedOrder.length === currentGames.length) {
        console.log(`[ManualOrder] ✅ Order verification passed`)
        return synchronizedOrder
      } else {
        console.warn(`[ManualOrder] ⚠️ Order verification failed, rebuilding...`)
        
        // Rebuild order completely
        const finalOrder = []
        const processedIds = new Set()
        
        // Step 1: Add imported games in their original order
        importedOrder.forEach(importedGame => {
          if (importedGame && importedGame.id && currentGameMap.has(importedGame.id) && !processedIds.has(importedGame.id)) {
            finalOrder.push(importedGame)
            processedIds.add(importedGame.id)
            currentGameMap.delete(importedGame.id)
          }
        })
        
        // Step 2: Add remaining current games
        currentGameMap.forEach((gameData, id) => {
          if (!processedIds.has(id)) {
            finalOrder.push({
              id: id,
              title: gameData.title
            })
            processedIds.add(id)
          }
        })
        
        console.log(`[ManualOrder] 🔧 Rebuilt order: ${finalOrder.length} games`)
        return finalOrder
      }

    } catch (error) {
      console.error("[ManualOrder] ❌ Error during import synchronization:", error)
      return importedOrder // Return original if synchronization fails
    }
  }

  // ============================================================================
  // ORDER APPLICATION
  // ============================================================================

  /**
   * Apply saved order using CSS `order` property — never moves DOM nodes.
   *
   * Steam's grid structure:
   *   grid[display:grid] > row[display:contents] > gridcell[display:contents] > card[display:block]
   *
   * Because row and gridcell both use display:contents, they generate no box —
   * the card divs are the actual grid items. CSS `order` must be set on the card.
   */
  function applyOrder() {
    if (!currentGrid || savedOrder.length === 0 || !isManualOrderEnabled || isApplyingOrder || isDraggingGrid) {
      return
    }

    isApplyingOrder = true

    try {
      const positionMap = new Map()
      savedOrder.forEach((game, index) => { positionMap.set(game.id, index) })

      const total = savedOrder.length
      const currentGames = getAllGames()

      currentGames.forEach((cell) => {
        const id = getGameId(cell)
        const pos = positionMap.has(id) ? positionMap.get(id) : total

        // Walk down through display:contents wrappers to find the first box-generating child
        let target = cell
        while (target && getComputedStyle(target).display === "contents") {
          target = target.firstElementChild
        }
        if (target) target.style.order = pos
      })
    } catch (error) {
      console.error("[ManualOrder] Error applying CSS order:", error)
    }

    setTimeout(() => { isApplyingOrder = false }, 500)
  }

  /**
   * Remove CSS order overrides (called when manual order is disabled)
   */
  function clearOrder() {
    if (!currentGrid) return
    try {
      getAllGames().forEach((cell) => {
        let target = cell
        while (target && getComputedStyle(target).display === "contents") {
          target = target.firstElementChild
        }
        if (target) target.style.order = ""
      })
    } catch (error) {
      console.error("[ManualOrder] Error clearing CSS order:", error)
    }
  }

  // ============================================================================
  // DRAG & DROP DIRECTLY IN THE GRID
  // ============================================================================
  // Uses mouse events + CSS `order` only (never moves DOM nodes). While manual
  // order is ON, Steam's native card drag (used for collections) is cancelled so
  // the drag is free for reordering.
  // ============================================================================

  function getBoxTarget(cell) {
    let target = cell
    while (target && getComputedStyle(target).display === "contents") {
      target = target.firstElementChild
    }
    return target
  }

  function getVisualList() {
    const list = []
    getAllGames().forEach((cell) => {
      const id = getGameId(cell)
      if (!id) return
      const target = getBoxTarget(cell)
      if (!target) return
      const o = parseInt(target.style.order, 10)
      list.push({ id, title: getGameTitle(cell), target, order: Number.isNaN(o) ? 1e9 : o })
    })
    list.sort((a, b) => a.order - b.order)
    return list
  }

  function getScrollParent(el) {
    let node = el
    while (node && node !== document.body) {
      const oy = getComputedStyle(node).overflowY
      if ((oy === "auto" || oy === "scroll") && node.scrollHeight > node.clientHeight) return node
      node = node.parentElement
    }
    return null
  }

  function setupGridDrag() {
    if (gridDragInstalled) return
    gridDragInstalled = true

    let st = null          // drag state
    let suppressClick = false

    // Cancel Steam's native drag of cards while manual order is on
    const cancelNative = (e) => {
      if (!isManualOrderEnabled || !currentGrid) return
      if (currentGrid.contains(e.target)) {
        e.preventDefault()
        e.stopImmediatePropagation()
      }
    }
    window.addEventListener("dragstart", cancelNative, true)

    // While dragging, hide Steam's hover info card: React never sees hover events from the grid
    const HOVER_EVENTS = ["mouseover", "mouseout", "mouseenter", "mouseleave", "pointerover", "pointerout", "pointerenter", "pointerleave"]
    const blockHover = (e) => {
      if (!isDraggingGrid || !currentGrid) return
      if (e.target instanceof Node && currentGrid.contains(e.target)) e.stopImmediatePropagation()
    }
    HOVER_EVENTS.forEach((ev) => window.addEventListener(ev, blockHover, true))

    // Swallow the click that follows a real drag (would open the game page)
    window.addEventListener("click", (e) => {
      if (suppressClick) {
        e.preventDefault()
        e.stopImmediatePropagation()
      }
    }, true)

    window.addEventListener("mousedown", (e) => {
      if (e.button !== 0 || !isManualOrderEnabled || !currentGrid || isDraggingGrid) return
      if (!currentGrid.contains(e.target)) return

      const list = getVisualList()
      const item = list.find((it) => it.target.contains(e.target))
      if (!item) return

      st = {
        id: item.id,
        target: item.target,
        list,
        startX: e.clientX,
        startY: e.clientY,
        x: e.clientX,
        y: e.clientY,
        active: false,
        ghost: null,
        offX: 0,
        offY: 0,
        scroller: getScrollParent(currentGrid),
        raf: null,
      }
    }, true)

    function startDrag() {
      const rect = st.target.getBoundingClientRect()
      st.offX = st.startX - rect.left
      st.offY = st.startY - rect.top

      const ghost = st.target.cloneNode(true)
      ghost.removeAttribute("id")
      ghost.style.cssText = `position:fixed;left:0;top:0;width:${rect.width}px;height:${rect.height}px;` +
        `margin:0;z-index:100000;pointer-events:none;opacity:0.9;transform:scale(1.06);` +
        `box-shadow:0 10px 28px rgba(0,0,0,0.55);border-radius:4px;order:0;`
      document.body.appendChild(ghost)
      st.ghost = ghost

      // Tell Steam the pointer left the card so any open hover preview closes (before hover events get blocked)
      const leave = { bubbles: true, cancelable: true, relatedTarget: document.body, view: window }
      st.target.dispatchEvent(new PointerEvent("pointerout", leave))
      st.target.dispatchEvent(new MouseEvent("mouseout", leave))

      st.target.style.opacity = "0"
      document.body.classList.add("grid-dragging")
      isDraggingGrid = true
      st.active = true
      loop()
    }

    function moveGhost() {
      st.ghost.style.left = `${st.x - st.offX}px`
      st.ghost.style.top = `${st.y - st.offY}px`
    }

    function loop() {
      if (!st || !st.active) return
      moveGhost()

      // Auto-scroll near the top/bottom edge of the scroll area
      if (st.scroller) {
        const r = st.scroller.getBoundingClientRect()
        const EDGE = 70
        if (st.y < r.top + EDGE) st.scroller.scrollTop -= Math.ceil((r.top + EDGE - st.y) / 4)
        else if (st.y > r.bottom - EDGE) st.scroller.scrollTop += Math.ceil((st.y - (r.bottom - EDGE)) / 4)
      }

      // Which card is under the pointer?
      const fromIdx = st.list.findIndex((it) => it.id === st.id)
      let toIdx = -1
      for (let i = 0; i < st.list.length; i++) {
        if (i === fromIdx) continue
        const r = st.list[i].target.getBoundingClientRect()
        if (st.x >= r.left && st.x <= r.right && st.y >= r.top && st.y <= r.bottom) { toIdx = i; break }
      }
      if (toIdx !== -1 && fromIdx !== -1 && toIdx !== fromIdx) {
        const [moved] = st.list.splice(fromIdx, 1)
        st.list.splice(toIdx, 0, moved)
        st.list.forEach((it, i) => { it.target.style.order = i })
      }

      st.raf = requestAnimationFrame(loop)
    }

    window.addEventListener("mousemove", (e) => {
      if (!st) return
      st.x = e.clientX
      st.y = e.clientY
      if (!st.active) {
        if (Math.hypot(st.x - st.startX, st.y - st.startY) < 6) return
        startDrag()
      }
    }, true)

    function endDrag(commit) {
      if (!st) return
      const s = st
      st = null
      if (!s.active) return

      cancelAnimationFrame(s.raf)
      s.ghost.remove()
      s.target.style.opacity = ""
      document.body.classList.remove("grid-dragging")
      suppressClick = true
      setTimeout(() => { suppressClick = false }, 80)

      if (commit) {
        // Refill the slots that visible games occupy in savedOrder, keeping hidden/filtered ones in place
        const newSeq = s.list
        const visibleIds = new Set(newSeq.map((it) => it.id))
        const merged = savedOrder.slice()
        const known = new Set(merged.map((g) => g.id))
        newSeq.forEach((it) => { if (!known.has(it.id)) merged.push({ id: it.id, title: it.title }) })
        const slots = []
        merged.forEach((g, i) => { if (visibleIds.has(g.id)) slots.push(i) })
        newSeq.forEach((it, k) => { merged[slots[k]] = { id: it.id, title: it.title } })

        saveOrder(merged)
        showNotification("✅ Order saved")
      }

      isDraggingGrid = false
      isApplyingOrder = false
      applyOrder()
    }

    window.addEventListener("mouseup", (e) => { if (e.button === 0) endDrag(true) }, true)
    window.addEventListener("blur", () => endDrag(false))
    window.addEventListener("keydown", (e) => { if (e.key === "Escape" && st && st.active) endDrag(false) }, true)
  }

  function closeModal() {
    const overlay = document.getElementById("reorder-modal-overlay")
    if (overlay) {
      overlay.remove()
      modalOpen = false
    }
  }

  function setupGridObserver() {
    // Cancel any previous observer/polling
    if (observer) {
      observer.disconnect()
      observer = null
    }
    if (gridRenderTimeout) {
      cancelAnimationFrame(gridRenderTimeout)
      gridRenderTimeout = null
    }

    if (!isManualOrderEnabled) return

    // ── RAF polling ───────────────────────────────────────────────────────────
    // Instead of watching React's DOM mutations (crash risk), we poll at ~500ms
    // to check if the grid was remounted or if CSS order was wiped by React.
    // Safe because we only read/write styles between frames, never mid-render.
    // ─────────────────────────────────────────────────────────────────────────

    let lastCheck = 0
    const INTERVAL = 500

    function poll(timestamp) {
      if (!isManualOrderEnabled) return

      if (!isDraggingGrid && timestamp - lastCheck >= INTERVAL) {
        lastCheck = timestamp

        // Re-acquire grid (may have been remounted)
        const freshGrid = findByClasses(GRID_CLASSES)

        if (!freshGrid) {
          // Grid gone — keep polling, it may come back
          gridRenderTimeout = requestAnimationFrame(poll)
          return
        }

        if (freshGrid !== currentGrid) {
          // Grid was remounted by React — reapply order WITHOUT touching
          // savedOrder. We never call synchronizeGameOrder() here because
          // during tab transitions (Store/Community) the grid can briefly
          // report 0 or malformed games, and synchronizing against that
          // would corrupt savedOrder in localStorage permanently.
          currentGrid = freshGrid
          console.log("[ManualOrder] 🔄 Grid remounted — reapplying order")
          applyOrder()
          gridRenderTimeout = requestAnimationFrame(poll)
          return
        }

        // Same grid — verify CSS order still matches savedOrder (not just "exists")
        const games = getAllGames()
        if (games.length > 0 && savedOrder.length > 0) {
          const positionMap = new Map()
          savedOrder.forEach((g, i) => positionMap.set(g.id, i))

          let mismatchFound = false
          for (const cell of games) {
            const id = getGameId(cell)
            if (!positionMap.has(id)) continue

            let target = cell
            while (target && getComputedStyle(target).display === "contents") {
              target = target.firstElementChild
            }
            if (!target) continue

            const expected = String(positionMap.get(id))
            const actual = target.style.order

            if (actual !== expected) {
              mismatchFound = true
              break
            }
          }

          if (mismatchFound) {
            console.log("[ManualOrder] 🔄 CSS order mismatch detected — reapplying")
            applyOrder()
          }
        }

      }

      gridRenderTimeout = requestAnimationFrame(poll)
    }

    gridRenderTimeout = requestAnimationFrame(poll)
    console.log("[ManualOrder] 👀 RAF polling observer started")
  }

  function showNotification(message) {
    const existing = document.getElementById("manual-order-notification")
    if (existing) existing.remove()

    const notification = document.createElement("div")
    notification.id = "manual-order-notification"
    notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #2196F3, #1976D2);
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            z-index: 10000;
            font-weight: bold;
            font-size: 14px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            animation: slideInRight 0.3s ease;
            max-width: 300px;
        `
    notification.textContent = message

    document.body.appendChild(notification)

    setTimeout(() => {
      if (notification && notification.parentNode) {
        notification.remove()
      }
    }, 3000)
  }

  function insertToggle() {
    const bottomPanel = findByClasses([BOTTOM_PANEL_CLASS])
    if (!bottomPanel || document.getElementById("manual-toggle-container")) {
      return
    }

    toggleContainer = document.createElement("div")
    toggleContainer.id = "manual-toggle-container"
    toggleContainer.innerHTML = `
        <button id="panel-trigger-btn">
            ⚙ Library <span class="trigger-caret">▲</span>
        </button>
        <div id="panel-dropdown">
            <div class="panel-row">
                <span class="panel-row-label" id="manual-order-label">Manual Order</span>
                <label class="switch">
                    <input type="checkbox" id="manual-order-toggle">
                    <span class="slider"></span>
                </label>
            </div>
            <div class="panel-row" id="reorder-row" style="display:none;">
                <span class="panel-row-label panel-hint">Drag the cards in the grid to reorder</span>
            </div>
            <div class="panel-row" id="backup-row" style="display:none;">
                <span class="panel-row-label">Order backup</span>
                <div class="panel-btns" style="display:flex;gap:6px;">
                    <button id="export-order-btn">📁 Export</button>
                    <button id="import-order-btn">📂 Import</button>
                </div>
                <input type="file" id="import-file-input" accept=".json" style="display:none;">
            </div>
            <div class="panel-divider"></div>
            <div class="panel-row">
                <span class="panel-row-label" id="hide-shelf-label">Hide Shelf</span>
                <label class="switch">
                    <input type="checkbox" id="hide-shelf-toggle">
                    <span class="slider"></span>
                </label>
            </div>
            <div class="panel-row">
                <span class="panel-row-label" id="hide-news-label">Hide News</span>
                <label class="switch">
                    <input type="checkbox" id="hide-news-toggle">
                    <span class="slider"></span>
                </label>
            </div>
            <div class="panel-divider"></div>
            <div class="panel-row">
                <span class="panel-row-label">Colors</span>
                <button id="customize-colors-btn">🎨 Colors</button>
            </div>
        </div>
    `

    bottomPanel.insertBefore(toggleContainer, bottomPanel.children[1] || null)

    const toggleInput    = document.getElementById("manual-order-toggle")
    const backupRow      = document.getElementById("backup-row")
    const reorderRow     = document.getElementById("reorder-row")
    const customizeColorsBtn = document.getElementById("customize-colors-btn")
    const triggerBtn     = document.getElementById("panel-trigger-btn")
    const dropdown       = document.getElementById("panel-dropdown")
    const hideShelfToggle = document.getElementById("hide-shelf-toggle")

    // ── Dropdown open/close ──
    triggerBtn.addEventListener("click", (e) => {
      e.stopPropagation()
      const isOpen = dropdown.classList.toggle("open")
      triggerBtn.classList.toggle("active", isOpen)
    })
    document.addEventListener("click", (e) => {
      if (!toggleContainer.contains(e.target)) {
        dropdown.classList.remove("open")
        triggerBtn.classList.remove("active")
      }
    })

    // ── Hide shelf toggle ──
    const HIDE_SHELF_KEY = "steam_hide_shelf"
    const shelfSelector  = "._3SkuN_ykQuWGF94fclHdhJ"

    function applyShelfVisibility(hidden) {
      // clear any inline display left by older versions, then let the <style> tag decide
      document.querySelectorAll(shelfSelector).forEach((el) => { el.style.display = "" })
      setStyleTag("hide-shelf-style", hidden ? SHELF_CSS : "")
    }

    const savedHideShelf = localStorage.getItem(HIDE_SHELF_KEY) === "true"
    if (savedHideShelf) {
      hideShelfToggle.checked = true
      applyShelfVisibility(true)
    }

    hideShelfToggle.addEventListener("change", (e) => {
      const hidden = e.target.checked
      localStorage.setItem(HIDE_SHELF_KEY, hidden)
      applyShelfVisibility(hidden)
    })

    // ── Hide news (What's New) toggle ──
    // Uses an injected <style> so React re-renders can't undo it. Hidden by default (theme's original look).
    const HIDE_NEWS_KEY = "steam_hide_news"
    const hideNewsToggle = document.getElementById("hide-news-toggle")
    function applyNewsVisibility(hidden) {
      setStyleTag("hide-news-style", hidden ? NEWS_CSS : "")
    }
    const storedNews = localStorage.getItem(HIDE_NEWS_KEY)
    const newsHidden = storedNews === null ? true : storedNews === "true"
    hideNewsToggle.checked = newsHidden
    applyNewsVisibility(newsHidden)
    hideNewsToggle.addEventListener("change", (e) => {
      localStorage.setItem(HIDE_NEWS_KEY, e.target.checked)
      applyNewsVisibility(e.target.checked)
    })

    // Load previous state
    const wasEnabled = loadEnabledState()
    if (wasEnabled) {
      toggleInput.checked = true
      // Activate in next tick so interface is ready
      setTimeout(() => {
        toggleInput.dispatchEvent(new Event("change"))
      }, 100)
    }

    // Customize colors button
    customizeColorsBtn.addEventListener("click", () => {
      createColorModal()
    })

    toggleInput.addEventListener("change", (e) => {
        const newState = e.target.checked;
  const previousState = isManualOrderEnabled;
  
  isManualOrderEnabled = newState;
  saveEnabledState(isManualOrderEnabled);
      console.log(`[ManualOrder] 🔄 Toggle: ${isManualOrderEnabled ? "ON" : "OFF"}`)

  // LÓGICA CRÍTICA: Solo resetear wasManualOrderEnabledBeforeRefresh si es una desactivación MANUAL (no por refresh)
  if (previousState && !newState && !isRefreshInProgress) {
    // El usuario desactivó manualmente el toggle
    wasManualOrderEnabledBeforeRefresh = false;
    console.log('👤 Usuario desactivó manualmente - wasManualOrderEnabledBeforeRefresh = false');
  }

      if (isManualOrderEnabled) {
        currentGrid = findByClasses(GRID_CLASSES)

        // Disable Steam's sort dropdown
        const sortBtn = document.querySelector(
          "div._1tBzypb5E2AwNuBuVns9Hl._30PVtUudUBJBzac0vEncl_ button.DialogDropDown",
        )
        if (sortBtn) {
          sortBtn.classList.add("disabled")
        }

        if (currentGrid) {
          const games = getAllGames()
          console.log(`[ManualOrder] ✅ Grid found: ${games.length} games`)
          currentGrid.classList.add("manual-order-active")
          loadOrder()

          // Aplicar orden con delay para asegurar que el grid esté listo
          setTimeout(() => {
            // Force initial synchronization when enabling manual mode
            if (savedOrder.length === 0) {
              console.log("[ManualOrder] 🆕 First time enabling, creating initial order")
              saveOrder() // Save current order as initial
            }
            applyOrderWithSync()
          }, 500)

          setupGridObserver()
          reorderRow.style.display = "flex"
          backupRow.style.display = "flex"
          showNotification("🎮 Manual mode enabled — drag the cards to reorder")
        } else {
          console.error("[ManualOrder] ❌ Grid not found")
          toggleInput.checked = false
          isManualOrderEnabled = false
          saveEnabledState(false)
        }
      } else {
        // Clear CSS order overrides (safe — doesn't touch DOM structure)
        clearOrder()

        if (currentGrid) {
          currentGrid.classList.remove("manual-order-active")
        }
        if (observer) {
          observer.disconnect()
          observer = null
        }
        if (gridRenderTimeout) {
          cancelAnimationFrame(gridRenderTimeout)
          gridRenderTimeout = null
        }

        // Re-enable Steam's sort dropdown
        const sortBtn = document.querySelector(
          "div._1tBzypb5E2AwNuBuVns9Hl._30PVtUudUBJBzac0vEncl_ button.DialogDropDown",
        )
        if (sortBtn) {
          sortBtn.classList.remove("disabled")
        }

        reorderRow.style.display = "none"
        backupRow.style.display = "none"
        showNotification("📋 Manual mode disabled")
      }
    })

    // ── Export / Import (backup of the order) ──
    document.getElementById("export-order-btn").addEventListener("click", () => {
      if (savedOrder.length === 0) { showNotification("⚠️ No order to export"); return }
      exportOrder()
    })
    document.getElementById("import-order-btn").addEventListener("click", () => {
      document.getElementById("import-file-input").click()
    })
    document.getElementById("import-file-input").addEventListener("change", (e) => {
      handleImportFile(e)
      e.target.value = ""
    })

    setupGridDrag()

    // Check initial visibility
    checkAndToggleVisibility()
  }

  function checkAndToggleVisibility() {
    if (!toggleContainer) return
    // Panel is always visible now — no longer gated behind "Ready to Play" filter.
    toggleContainer.style.display = "flex"
  }

  function setupVisibilityObserver() {
    // No-op: panel visibility no longer depends on DOM state (it's always shown).
    // Kept as a function for backward compatibility with existing call sites.
    checkAndToggleVisibility()
  }

  function initialize() {
    console.log("🔍 [ManualOrder] Initializing Fixed Final Version...")

    const grid = findByClasses(GRID_CLASSES)
    const bottomPanel = findByClasses([BOTTOM_PANEL_CLASS])

    if (grid && bottomPanel) {
      console.log("✅ [ManualOrder] Elements found, setting up interface...")
      const games = getAllGames()
      console.log(`[ManualOrder] 📊 Grid: ${games.length} games found`)
      insertToggle()
      setupVisibilityObserver()

      return true
    }

    console.log("❌ [ManualOrder] Elements not found yet...")
    return false
  }

  // Initialization
  let initAttempts = 0
  const maxAttempts = 20

  const initInterval = setInterval(() => {
    initAttempts++

    if (initialize()) {
      clearInterval(initInterval)
      console.log("🎉 [ManualOrder] Initialization successful!")
    } else if (initAttempts >= maxAttempts) {
      clearInterval(initInterval)
      console.error("[ManualOrder] ❌ Initialization failed after", maxAttempts, "attempts")
    }
  }, 1500)

})()
// === End Manual Order Script - Fixed Final Version ===


// ============================================================================
// ENHANCED COLOR CUSTOMIZATION SYSTEM
// ============================================================================

const COLOR_CONFIG_KEY = "steam_color_config_v1"
let colorModalOpen = false

// ============================================================================
// DEFAULT COLOR CONFIGURATIONS
// ============================================================================

// Default color configurations with RGBA support
const DEFAULT_COLORS = {
  gamelistBackground: {
    name: "Game List",
    colors: [
      { hex: "#15004b", alpha: 1 },
      { hex: "#012a46", alpha: 1 }
    ],
    angle: 270,
    animation: "none",
    speed: 4,
    selector: "._3x1HklzyDs4TEjACrRO2tB"
  },
  gamesBackground: {
    name: "Games Panel",
    colors: [
      { hex: "#5a0a37", alpha: 1 },
      { hex: "#19002e", alpha: 1 },
      { hex: "#09578d", alpha: 1 }
    ],
    angle: 225,
    animation: "none",
    speed: 4,
    selector: "div:has(> ._3Sb2o_mQ30IDRh0C72QUUu)"
  },
    FriendList: {
    name: "Friend List",
    colors: [
      { hex: "#5a0a37", alpha: 1 },
      { hex: "#19002e", alpha: 1 },
      { hex: "#09578d", alpha: 1 }
    ],
    angle: 225,
    animation: "none",
    speed: 4,
    selector: ".friendlist"
  },
  BigPicture: {
    name: "Big Picture",
    colors: [
      { hex: "#5a0a37", alpha: 0.35 },
      { hex: "#19002e", alpha: 0.35 },
      { hex: "#09578d", alpha: 0.35 }
    ],
    angle: 225,
    animation: "none",
    speed: 4,
    selector: "._3LYP1SIxyoky-yW9Ug_1fq.b084mAvY8rgVMr3H04g9g:is(#GamepadUI_Full_Root, #popup_target *)"
  },
  headerFooter: {
    name: "Header/Footer",
    colors: [
      { hex: "#000000", alpha: 1 },
      { hex: "#19002e", alpha: 1 },
      { hex: "#061f30", alpha: 1 }
    ],
    angle: 225,
    animation: "none",
    speed: 4,
    selector: "._3Z7VQ1IMk4E3HsHvrkLNgo, ._3vCzSrrXZzZjVJFZNg9SGu"
  },
  propertiesBackground: {
    name: "Properties",
    colors: [
      { hex: "#15004b", alpha: 1 },
      { hex: "#011d46", alpha: 1 }
    ],
    angle: 270,
    animation: "none",
    speed: 4,
    selector: "._30-E9De2BTSA_LQAluUDUI, ._2kwFFHckg8jvnwJfg9-la8, .xSTLmzylFJdIfak7ZdhuA, .DesktopUI .CFTLX2wIKOK3hNV-fS7_V, "
  },
  downloadsBackground: {
    name: "DownloadsStatics",
    colors: [
      { hex: "#4b002a", alpha: 1 },
      { hex: "#00245e", alpha: 1 }
    ],
    angle: 225,
    animation: "none",
    speed: 4,
    selector: "._1l0LmmqDUXH19SjfELddn7"
  },
  Dropdowns: { 
    name: "Selectables, downloadsBackground and buttons", 
    colors: [
      { hex: "#1c025a", alpha: 0.8 },
      { hex: "#056dad", alpha: 0.8 }
    ],
    angle: 114,
    animation: "none",
    speed: 4,
    selector: "button.DialogButton, ._1l0LmmqDUXH19SjfELddn7, .DesktopUI .title-area-icon:hover, .friendsui-container .title-area-icon:hover, .DesktopUI .PP7LM0Ow1K5qkR8WElLpt, ._3qIuY9S_vXm3IQS-uE9SRS .PP7LM0Ow1K5qkR8WElLpt, ._1ABCOz8DSrl-YJdh1xD-m0, ._1ABCOz8DSrl-YJdh1xD-m0._1dDpSuaJBGZzS41s0SPk4c, span._3nqxIgL0a0DbPZHRZRzWsp, .HijmccPB1BKyhOwhX1EVl._3-_jME_xsuvgT3Dvq4bw_q._3hmGW9wIxNIoPPu1aS7rFm, .HijmccPB1BKyhOwhX1EVl._3-_jME_xsuvgT3Dvq4bw_q._3hmGW9wIxNIoPPu1aS7rFm:hover, .HijmccPB1BKyhOwhX1EVl:not(._3-_jME_xsuvgT3Dvq4bw_q) + .HijmccPB1BKyhOwhX1EVl:not(._3-_jME_xsuvgT3Dvq4bw_q)::before, ._1-vlriAtKYDViAEunue4VO._2DpXjzK3WWsOtUWUrcuOG7, ._1Hye7o1wYIfc9TE9QKRW4T, ._3LLH_F43MTu6UtG4Z3kudv, .eKmEXJCm_lgme24Fp_HWt._2HFrmMgB38Ike5w4rVxzEX.gpfocus, .eKmEXJCm_lgme24Fp_HWt._2HFrmMgB38Ike5w4rVxzEX.gpfocuswithin, .eKmEXJCm_lgme24Fp_HWt._2HuzvKQ2QMUJ-JJOeApaF1:not(.aIeh3X5T2M074RLW1qn6_):hover, ._2mL2HfT5AkDXRi1YBnRWKa:focus, .FriendVoiceChat.gpfocus, .GroupVoiceChatFriend.gpfocus, .chatWindow .chatEntry.GamepadMode.gpfocuswithin > :not(.chatUploadContainer), .GamepadMode .chatWindow .chatEntry.gpfocuswithin > :not(.chatUploadContainer), .FriendsListAndChatsSteamDeck .FriendsDataOutofDate div, .GamepadMode .FriendPicker_Suggestions.gpfocus, .GamepadMode .DialogSpanningTable td.friendCell .friend.gpfocus, .lat0M-V5X4uYd6Mpm1DJ1 ._9Ig1o0jVRia2uf_FKR3rs, .lat0M-V5X4uYd6Mpm1DJ1 ._2Z68vjdOnUDA2ULQG41JVV, .lat0M-V5X4uYd6Mpm1DJ1 ._25eT23F0cV5lmT3tXAIA56, ._464mFQmvIW2e9TQypXX7W ._2ltn2BK4fnrPEGzNwxx6bx button.DialogButton:enabled:active.gpfocus, ._3qYm9oxf8MdyvQDJgbfCrF ._10OzYaCdn7cgVMec9ozEJG.GamepadMode, .GamepadMode ._3qYm9oxf8MdyvQDJgbfCrF ._10OzYaCdn7cgVMec9ozEJG, .FriendVoiceChat.gpfocus, .GroupVoiceChatFriend.gpfocus, .chatWindow .chatEntry.GamepadMode.gpfocuswithin > :not(.chatUploadContainer), .GamepadMode .chatWindow .chatEntry.gpfocuswithin > :not(.chatUploadContainer), .FriendsListAndChatsSteamDeck .FriendsDataOutofDate div, .GamepadMode .FriendPicker_Suggestions.gpfocus, .GamepadMode .DialogSpanningTable td.friendCell .friend.gpfocus, ._3RPaPwdCZoCW6eX8k9QyRj ._2Uf-0Z6C7U0MMzWK80PYzJ.gpfocus, .FriendVoiceChat.gpfocus, .GroupVoiceChatFriend.gpfocus, .chatWindow .chatEntry.GamepadMode.gpfocuswithin > :not(.chatUploadContainer), .GamepadMode .chatWindow .chatEntry.gpfocuswithin > :not(.chatUploadContainer), .FriendsListAndChatsSteamDeck .FriendsDataOutofDate div, .GamepadMode .FriendPicker_Suggestions.gpfocus, .GamepadMode .DialogSpanningTable td.friendCell .friend.gpfocus, ._2XZq-_f6npaQdAgeRzKIkz.Yd-DsWkYiFiYwpci--Yk_.GamepadMode.gpfocus, .GamepadMode ._2XZq-_f6npaQdAgeRzKIkz.Yd-DsWkYiFiYwpci--Yk_.gpfocus, .FriendVoiceChat.gpfocus, .GroupVoiceChatFriend.gpfocus, .chatWindow .chatEntry.GamepadMode.gpfocuswithin > :not(.chatUploadContainer), .GamepadMode .chatWindow .chatEntry.gpfocuswithin > :not(.chatUploadContainer), .FriendsListAndChatsSteamDeck .FriendsDataOutofDate div, .GamepadMode .FriendPicker_Suggestions.gpfocus, .GamepadMode .DialogSpanningTable td.friendCell .friend.gpfocus, .FriendVoiceChat.gpfocus, .GroupVoiceChatFriend.gpfocus, .chatWindow .chatEntry.GamepadMode.gpfocuswithin > :not(.chatUploadContainer), .GamepadMode .chatWindow .chatEntry.gpfocuswithin > :not(.chatUploadContainer), .FriendsListAndChatsSteamDeck .FriendsDataOutofDate div, .GamepadMode .FriendPicker_Suggestions.gpfocus, .GamepadMode .DialogSpanningTable td.friendCell .friend.gpfocus, .FriendVoiceChat.gpfocus, .GroupVoiceChatFriend.gpfocus, .chatWindow .chatEntry.GamepadMode.gpfocuswithin > :not(.chatUploadContainer), .GamepadMode .chatWindow .chatEntry.gpfocuswithin > :not(.chatUploadContainer), .FriendsListAndChatsSteamDeck .FriendsDataOutofDate div, .GamepadMode .FriendPicker_Suggestions.gpfocus, .GamepadMode .DialogSpanningTable td.friendCell .friend.gpfocus, .FriendVoiceChat.gpfocus, .GroupVoiceChatFriend.gpfocus, .chatWindow .chatEntry.GamepadMode.gpfocuswithin > :not(.chatUploadContainer), .GamepadMode .chatWindow .chatEntry.gpfocuswithin > :not(.chatUploadContainer), .FriendsListAndChatsSteamDeck .FriendsDataOutofDate div, .GamepadMode .FriendPicker_Suggestions.gpfocus, .GamepadMode .DialogSpanningTable td.friendCell .friend.gpfocus, .FriendVoiceChat.gpfocus, .GroupVoiceChatFriend.gpfocus, .chatWindow .chatEntry.GamepadMode.gpfocuswithin > :not(.chatUploadContainer), .GamepadMode .chatWindow .chatEntry.gpfocuswithin > :not(.chatUploadContainer), .FriendsListAndChatsSteamDeck .FriendsDataOutofDate div, .GamepadMode .FriendPicker_Suggestions.gpfocus, .GamepadMode .DialogSpanningTable td.friendCell .friend.gpfocus, .friendGroup .groupName.gpfocus, .FriendsListContent.gpfocus .friendlistListContainer, .friendsContainer.gpfocus, .msg div.ChatMessageOpenGraph.gpfocus, .msg div.SteamPublishedFile.gpfocus, .ChatMessageInvite.gpfocus, .inviteLinkContainer .DialogDropDown._DialogInputContainer:hover, .msg.gpfocus, .FriendPicker .FriendPickerFriendList.GamepadMode.gpfocus, .GamepadMode .FriendPicker .FriendPickerFriendList.gpfocus, .rolePriorityButton, .rolePriorityButton.Disabled:active, .rolePriorityButton.Disabled:hover, .rolePriorityButton.Disabled, ._3TvBVwaH8eIBabTdki35oe .QAVElkR0V7KPXLjPVsvl-:focus, ._3rsQRA6-lR_jrdiuv3ARnf .tNl7CupYn5jcZaRWX6PU0._1DMzCviYCYOj6lKga1y_vt, ._1xfC8oO6JVNnioU1NPTN9s, ._1LWDAthWNhS7CyjQqjbeoS.YgnZYhUBZBiUJwuMUvxYw.gpfocus, ._1LWDAthWNhS7CyjQqjbeoS.YgnZYhUBZBiUJwuMUvxYw.gpfocuswithin, ._1LWDAthWNhS7CyjQqjbeoS._15S9pg9Y-g9PGES94IuSQA:not(.hBJA7sc7szpcoeOdRRfsP):hover, ._17CvBVp1rwECBn2FRb4oMA:hover, ._17CvBVp1rwECBn2FRb4oMA._1Rmvuh4adSSWxOVlDHISQO, ._3glxw5rYlV6DTRgH3dHWPD:focus, ._17SQWViInfB-hmYYLoK4Yw:hover, ._17SQWViInfB-hmYYLoK4Yw:active, ._1TR3CCCdSmI-0MXucYBuP2 ._6Z2AOU-R-8aK7KZevey0W, .BasicUI ._170Npw5h84elypMSQ8zNDI ._1ennWu_xj2YF8FRYgJ2M2H ._1axoiZsC1RBp22JQmxiBIc.gpfocuswithin, ._1xPZwgYI7sXtyFt2n8ZjtP, ._1ZpBQtDqcKBbfIIv01Vs1R > div.DesktopUI, .DesktopUI ._1ZpBQtDqcKBbfIIv01Vs1R > div, ._1-nHjRywUoX7Mpyc6JOPaQ, ._2IEorvaTnkOBZw3PEDXZoB, ._12aBP1DmpEKuMxfFuCMbiN:focus, ._12aBP1DmpEKuMxfFuCMbiN:hover, ._3VQeLk37GAZSmurTc4HPP6, ._3Lz1Rs6a2Lc6Mx3J86VKKE, ._2n6FNLKyb6al_YPk13xS7S ._2qURXDJ4ZtfSVOesDk7A73 .DialogCheckbox, .BasicUI ._2n6FNLKyb6al_YPk13xS7S ._2RCSUgg2X_uF_C0e1lrcqc:focus, ._1WKUOT3FdB9-48MMP0Tz9l, ._1kyPoKPv8_QS8nK7zedHW ._3ggB6QN4NkLZyOYn8xj5N7._16L8gDKLHwbnMVEmoFCK9, ._28eIRmQ229ntDIyQXTn3Ub, ._28eIRmQ229ntDIyQXTn3Ub.QE3sHW9puNTAjiRDY71Xy, ._29AJUo6aKT93gX24N5WFj_, .xgdATZWePJFXYrEbin8y9 ._10hh85J75faHJ8ChhjlzLl, ._13LoHE22iGo7eWHNFp5f9L, ._3xXvCbPSIbZttSKUFZbFe-, ._1JVxK7k1dVGT-XnDTUFrIC, ._3WR6QIYfn7Vo3gVdKjjFuW, ._3WR6QIYfn7Vo3gVdKjjFuW ._2rMgXYkzAhJXWsyI9YRY11, ._35iX6Ylrzw0fN8AHhcIlGF, .y7Rs2hclga_Ij4MsMiMdx ._10RZezvQlWdLLbkgRIS9_4, ._6em9hiNtkrdaHE8eVfq0P ._365PZ8BVgd7sz6-xR9E9yb .rYp_PTAXV9D7Jc5c756Re, ._2YoYTMvXU6ZiyEtsi0W2Lo, ._1rhLTraGkRDOPJslCL3i9C:hover, ._1rhLTraGkRDOPJslCL3i9C._2_K-vDkSsSw6FxrfZL-ScT, .u04UCICvObTJ4FUr9RQen, ._1lcizT_Nbxsk484XzTtcFf, ._2JvQPEForHWVgljtxxAwRP, ._22fHb5-teK8S1sxdxVu9yz.gpfocus, ._3LzXZkJi8bsPoHzXEDbLER.gpfocus, .snegceTtDFk1Ok-EUE8fd.gpfocus, .HYloJyr41RFbSFoc8RY3w.gpfocus, ._3Rk61GMptJMR1oaiUCjLyL, ._5j8Im-8lAIRRboL2_jZbQ ._26uPMBCPxQYJ8EBcqiNu8P.gpfocus, ._2IWpfqj8UL5hUs7n-pxnUy ._3sqYFYR9Cl3T6Iy-0a3EJ2:hover, ._3jYltbvkgQtLaooGJYcjJY ._2CKq4dAZDTlb7svd2NHxi6:hover, ._1BwVZqfM73ZtBVsNs3ZcMD, .LclHwcOfHFpwObYMD1HLa ._3H2GezG50hog8gSDj-qbx1 ._3EWVuoln1WAvpEaPNfpift, .LclHwcOfHFpwObYMD1HLa ._3H2GezG50hog8gSDj-qbx1 ._1d8CbcBnA6t3lsxYdnMv1h, .q5OA-x6LcVkvtLCGp-8JC .DialogBody .DialogBodyText .isIfZv25e7VAf6QG7PMrF .YvsXGGpc_ep7jT-hmQxZe, ._2TAQYpbxatDYN3Ex76KX5u .DialogBody .DialogBodyText ._7jaC6UFFrvcKq2UlJr1Pb .Cw--cBWy7v1Ey1JF0VkBN, ._24O5i9aa5PKJmbP0tL_Jbf, .BasicUI button.DialogButton._3Cdin80d-hVsakHUZboheb._3nJyYxGQ3kdwwabPmxNnMe:not(.gpfocus), ._1GdR5LbENV7LOGROJBxohI._1GdR5LbENV7LOGROJBxohI.DialogButton:enabled, ._21P7c4MWmsU2QSZeL-uyZo.gpfocus:not(._74yh4KBx-CqtDEw0dDxpH) ._1VNuYHM6BPBOJspC6zPf5r.IbePLaw-vSvhG1GTenYFg, ._1VNuYHM6BPBOJspC6zPf5r:hover, ._1VNuYHM6BPBOJspC6zPf5r._3-SbBb63lDnu6LzKV-q3Cg, ._1VNuYHM6BPBOJspC6zPf5r ._3oavRVhIS9tC3vBsFT4Ggi, ._1VNuYHM6BPBOJspC6zPf5r ._3oavRVhIS9tC3vBsFT4Ggi:enabled, ._1VNuYHM6BPBOJspC6zPf5r ._3oavRVhIS9tC3vBsFT4Ggi:active, ._1VNuYHM6BPBOJspC6zPf5r ._3oavRVhIS9tC3vBsFT4Ggi:hover, ._1VNuYHM6BPBOJspC6zPf5r ._3oavRVhIS9tC3vBsFT4Ggi:enabled:active:hover, ._1VNuYHM6BPBOJspC6zPf5r ._3oavRVhIS9tC3vBsFT4Ggi.DialogButton:enabled, ._1SyggnJY6qbRSmbZpkK3-H ._1vMU1vG5ZtLihr3mfXUymR, ._3Tfp8-wTAttW3WVa_X9JVC._3Tfp8-wTAttW3WVa_X9JVC, ._3Tfp8-wTAttW3WVa_X9JVC._3Tfp8-wTAttW3WVa_X9JVC:enabled, ._3Tfp8-wTAttW3WVa_X9JVC._3Tfp8-wTAttW3WVa_X9JVC:active, ._3Tfp8-wTAttW3WVa_X9JVC._3Tfp8-wTAttW3WVa_X9JVC:hover, ._3Tfp8-wTAttW3WVa_X9JVC._3Tfp8-wTAttW3WVa_X9JVC:enabled:active:hover, ._3Tfp8-wTAttW3WVa_X9JVC._3Tfp8-wTAttW3WVa_X9JVC.DialogButton:enabled, ._3v2Gg_GCpLHpHQDLFQ7cvI ._3f3VJUtyLXUf_JDFE-BaQ6, ._17M8gvakqjyaw_cLo6ntdl input[type='search']::-webkit-search-cancel-button:hover, .mbFSnoK85dUXHz9VT-YNI._3KGi6ig3JCLHZP-dOsO-Wx, .BasicUI ._1hFrV3_0BponiGRcGE_jg3:hover, .BasicUI ._1hFrV3_0BponiGRcGE_jg3.gpfocus, ._5HZT7qE6px0VNOBQ7q6Nz.gpfocus, ._1X-O1ANz_xeB1j0CZRNFeA.gpfocus, .jD4XY_gqDiLlX0jZqK1MA._1X5wHQgKhsyFOBfnka56DP:hover, ._3mo3QwkH85jTeM4Heu7fjF, ._1-8YObrVay-md19IJJ5mDK, ._3Ak7cNRtzpDWtFgnn6n0-J._1X5wHQgKhsyFOBfnka56DP, .BasicUI ._2yhmcyeUOyM8lt__Skbk9O:hover, .BasicUI ._2yhmcyeUOyM8lt__Skbk9O.gpfocus, ._3-H47wPl1Ng3lh7xGZOPIg.gpfocus, ._3V6804k2yutEiF6IWg8axH.gpfocus, ._1GcAugE5c4nbBUwrA4_xwS._1YAQHDHv4hsPaauccvAFtn:hover, ._2Mo87NUHyjLkjvKcPQxPRu, .j9jQA6QaLJ23lyfuo9nY6, ._1xvIUtLkTrdEk2Ob1MqFcQ._1YAQHDHv4hsPaauccvAFtn, .BasicUI ._30fVm4Rsel-4nUKEiPJgz9:hover, .BasicUI ._30fVm4Rsel-4nUKEiPJgz9.gpfocus, ._2h6KD6p6y4vIgO2Toxx-_K.gpfocus, ._3oKFhPrh1lbp-WtA72Q2Yi.gpfocus, ._3B8wRA4H7e_oSksYNqpSPv._1B1XTNsfuwOaDPAkkr8M42:hover, ._25gii5r23MmAqXvLZj24tK, ._3k90ug209sE23xAMqcM74s, .QFW0BtI4l77AFmv1xLAkx._1B1XTNsfuwOaDPAkkr8M42, .BasicUI ._1lqXpJpRlYvyM2fBx6beHd:hover, .BasicUI ._1lqXpJpRlYvyM2fBx6beHd.gpfocus, ._1k275cE1gk-jpZE5r-37zl.gpfocus, ._4egmnB1wTrDll5Mc_eal8.gpfocus, ._2uW9K6fqc6jZX1XBjnLjw._2kLHZTRgRl0POZfXPcfxks:hover, ._3BvcYKoq-n7GgNwbfFgRAc, .alS2LW_qAwNkYk_GPUC_3, .d9RJTj9G8qU-U9-he2cQx._2kLHZTRgRl0POZfXPcfxks, ._34o03-8cUc3fQX1u650c0L:hover, ._34o03-8cUc3fQX1u650c0L._3fVa8M_7D9Vjz28uYnahhd, ._1X1hrBwjvWglwgv2oIo0zr.gpfocus, .BasicUI ._3x31AgESSlUqX3D4MTHv2m ._37e7DrDNmf1FmsMGA5y0A0 .bACIuqv-b_9TztCczFK19, .BasicUI ._3x31AgESSlUqX3D4MTHv2m ._37e7DrDNmf1FmsMGA5y0A0 ._2JSyABqFEh-v_dwaTnBydR, ._1FFkde8_JKdSiYljLbk0VB, .IIJeieZ-ZPRfIULY7uSDG ._3sfpA6uM8IJuAnrtDiJLZI, .IIJeieZ-ZPRfIULY7uSDG._1wl1mQLRXzpgY5WzEEtDm-, .BasicUI .DY4_wSF8h9T5o46hO5I9V, ._24vXJlAPvB3xAMn1D5WTgv ._1IQVrsAU8HHouq76rRhpXd ._3F9kiZx6X3Y2HCzhNVkjFa, .RoCqXTBUjVBZOysLAWHge, .tGJeFkznK3-BCMgr4GSHi, ._3BBZaNYxbeYSzoc8Wpat0J ._1FZA8-MmuWlfuoH3U91x8K, ._2es8aTNMKhUJ5MqFJJ5zf5, ._3Mp8R2wnoCl6ko0HAX8IHE.Yk-I2az42lZgbInNlu06r, ._3euSFGmYfTklNAvMisNvU6, .KTKZNhGr2va8c2tqKUcHH, ._1sc-BFvGe6huemAE5yVozQ ._2qrpvdd7QiVVxRK8LdZuvx, ._1sc-BFvGe6huemAE5yVozQ ._1gtKGJKNF7LePYMj1G0thY, ._1sc-BFvGe6huemAE5yVozQ ._322VIQXfS-i4Kb7g2Wvsuq, ._2OnwIagz5iEd5wOk6Z9FVJ ._2VCd-2F_zasXcshwdbxHXo, ._4EsG0NitcQDODEeBXMNS4 ._3EvK-5qJkdnPTL_z1RyA7L ._2HnZmed-mYPVaa9i4A47lH ._1horSsSDOLDUtXLkFoSENc, ._3m3_xgqnTKICMikWOA-NtG.F_Vy1zVQmtHYlKsWndE4-.gpfocus, ._3m3_xgqnTKICMikWOA-NtG.F_Vy1zVQmtHYlKsWndE4-.gpfocuswithin, ._3m3_xgqnTKICMikWOA-NtG._2Cj1ImCIbczkbVLC69rJjP:not(._6Dt9tb8Pk5r78_GplsFr6):hover, ._30Cfa_RtfCcvNNH7_LcUON:hover, ._30Cfa_RtfCcvNNH7_LcUON._3enyx9xVrxt-dv1UENf-XP, .KFjZFORv00KdmaEwjssuh:focus, .AuRiJ2ecnP5NI_lXJYN5J, ._2bOpQtX5QAuQxfGhEJ_iYg > span, ._2bOpQtX5QAuQxfGhEJ_iYg > img._1x3UOXJkizqKhkssRfFjSS, .DesktopUI .Oo5JPcEk_erKEYAzYp2nY, ._289eXlJMAn_UUlRH5kHaju, .N8aJrSpxQ6II4CY_aFdYI.QTJZotuAt67vK7Sa2Wjus, ._3AjoLnMNKxYmNTGTJCLfgs._1aml4h4CSJbtrNbX4brUYs, .fi6UDkxJq66MLo2z9wabQ ._2uM3ouyTdzAtXR3ffa7oRg ._2LJMRr1_5XUK4wlt7YMyPi .mh8m9p4PBg_Qrev1bfTzc:hover, ._3OzkVrQFFPv0aV41N4MrHV .fbu3l7kPiBeb3EKCjIb8n ._3ZLaTxSHxeGcoKlIy_-Z0L:hover, ._27m9Qbg4ShilOgwvYZWV8l ._1vG-vFfwpDeNStVbyo1Qy6 ._2wBK7MqJSrj6QCxf3357yL, ._27m9Qbg4ShilOgwvYZWV8l ._1vG-vFfwpDeNStVbyo1Qy6 ._2fYjCJSwdJxdjbi7ysISdL ._2NLwfYHr9KUJZ7LD9nkyva:hover, ._27m9Qbg4ShilOgwvYZWV8l ._1vG-vFfwpDeNStVbyo1Qy6 ._1zaACxBAyMqq2MspuISjix .nzZlhFJAzKTdsKCWil0F9:hover, ._2RAT2vf55Z8zHPpqSHkaW6 .pLUgQmqhYXuq7QbCIVo-5, ._3pofGqV0buiKAfMPEs3_82, ._7AlhCx3XGzBeIrQaCneUD.Eq8Px4ixn5sAFSR6_9wWQ, ._5wILZhsLODVwGfcJ0hKmJ:hover, .MCa4RMSvWJwwWjcZP2wTT ._1oERP7bVictkby2hP4BBva, .RtSv39ZoBOySnb8XQ5hJf._9YK5IY219Pm_F53DAxyYp:not(._1QQWjaXmb1eTHZpeIhQA_5):hover, .RtSv39ZoBOySnb8XQ5hJf._3qhGkQ5qLVNQQ-J2-uPoHt:not(._1QQWjaXmb1eTHZpeIhQA_5):hover, .Utdt7JrpIm5JlpQmqyj1v:hover, ._3lRfTo8Wo3phXfE1DvK6QW:hover, ._3LKQ3S_yqrebeNLF6aeiog:hover, ._13vrqU6oOqmmxrsZSW5O39:hover, ._3arz-hc3FJ0QKXLPRUSaah:hover, ._3zfQA8bEKpisPtsyT4SovP:hover, .zhaKeChn9HPNSMtk0ami_ ._3m0MnUo45wjLOfNLpZ-3KH, ._2rxrVvbku0AC8Qbequ4-z9 ._2SvsKGOQeIoV8laKj5Ql5s ._2YSm1vJtLeKb9BbihsLY1F ._2_4_nZy-T2C3pHa81tGH76 ._3mCrTKGesl-jD-k-buQ13_, ._2rxrVvbku0AC8Qbequ4-z9 ._2SvsKGOQeIoV8laKj5Ql5s ._2YSm1vJtLeKb9BbihsLY1F ._2_4_nZy-T2C3pHa81tGH76 ._1XAm7DWwrTa6XnYYJ5kxAK, ._2rxrVvbku0AC8Qbequ4-z9 ._2SvsKGOQeIoV8laKj5Ql5s ._2YSm1vJtLeKb9BbihsLY1F ._2_4_nZy-T2C3pHa81tGH76 ._2cIK-w-zexbpzoh8jWH-tn, ._20evaxvMeG8jMJ31t-5-L5, ._2a6rfV8TIW2Ngf6EKk-vd ._3ZJ6gL7WvTh8sUOWVhLqe1, .DesktopUI ._2Sj4-UDM-dHSxtxwQ_Pwwz._2Sj4-UDM-dHSxtxwQ_Pwwz ._DialogInputContainer, .aqvbkhC1ejt4s8QvWA-c5 .TSlxCkeUMGwzmg21_WU8-._1W4bbifjEN3KdqKEhpmies, ._2q7nbQP9JNdtqFAxP5RHNZ ._3Cdh-BVkfxPJQNz_etZjUd._181cYsjHaaMo4th6NXPkPR, ._28dkcmodlp5Ooe1EJDdzUs ._2b5Wr4EPgFV-0TlrAIea5- .XBOPCwP2Bo8up1QjGtUiI ._15gxV6Q8_KW_-utK740dEf:hover, ._10T2j3nynZSKnIKIRrTLr4 ._33DvvaAAsKaD30JrKzcL38 ._2xqwHms_kkW3jPhfsUTa8:hover, ._1xeg0ZFm1DNPKbA9uOjFlT ._2U0q8iFEUZp8KxE3zz1C26 ._1Q-eMJi4hHWapnM5jkXqg7, ._1xeg0ZFm1DNPKbA9uOjFlT ._2U0q8iFEUZp8KxE3zz1C26 ._3hpEn4H6tjIGLbf8GKA0vS ._2TsagsVi0bFDnNztolUHP4:hover, ._1xeg0ZFm1DNPKbA9uOjFlT ._2U0q8iFEUZp8KxE3zz1C26 ._1Hz4oAP9fiba9H98tjnior ._3a1Y1FB5NkaJJ0iV5-qUbJ:hover, ._2AtQdZFU-mOGE-_3SuQKkw, ._1J8umaxlHnD4poewN6r8wp, ._3QLt_cnTY9p8pNOj9jxTxR, .NoRFSLSfwRijJQt7R51OT, ._1llZalHthucWjyKqSkf7fR, ._3yP_pf4vx1Q4W0mt2DR32P, ._19SMSHLlXqSLnXM3NjDNBS, ._1Ze1RZ7I8e5cSlaWAl48bh, ._2MjBd1kKOEyVfqBN5OQOb1, ._2swvcAycL4d0UoHFDoe6-d, ._3i-XV362MvNEX3j_oWQDmQ, ._3s28A0XlOXUOAWRIuBKHuH, ._3U3h5KQ5DocAUo4lO8cL5l, ._1FyBL6obxHQ2Z2CsaV2Gbz .DialogBody ._3sXdOJ9DEh5zdS54_ptwgW ._1SKB0Xc7OpWlOlr-wSi8ho, ._1FyBL6obxHQ2Z2CsaV2Gbz .DialogBody ._3ZhiKhciPyiGGxDFuGOYpc .pht3SaejGcAJEjNG8d6nd ._2TJyz1F52D-aTOe8RdwFIK, ._1FyBL6obxHQ2Z2CsaV2Gbz .DialogBody ._3ZhiKhciPyiGGxDFuGOYpc .pht3SaejGcAJEjNG8d6nd .iWdskI4in7pZbS0ETm5QQ .hh4HHQrSWl4R_8NqlKs5m ._2AQozUFcCfBh1F-oJjSTzj"
  },
}

// ============================================================================
// STYLE MANAGEMENT
// ============================================================================

/**
 * Add enhanced color customization styles to document
 */
function addColorCustomizationStyles() { 
  const colorStyle = document.createElement("style")
  colorStyle.id = "color-customization-styles"
  colorStyle.textContent = `
    /* Enhanced Color Modal Styles */
    #color-modal-overlay {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    #color-modal {
      background: linear-gradient(145deg, #2a2a2a, #1a1a1a);
      border-radius: 12px;
      padding: 20px;
      padding-top: 0px;
      width: 800px;
      max-width: 95vw;
      max-height: 85vh;
      box-shadow: 0 20px 40px rgba(0,0,0,0.5);
      border: 1px solid #444;
      animation: slideInUp 0.3s ease;
      position: relative;
      cursor: move;
      overflow-y: auto;
      overflow-x: hidden;
    }

    @keyframes slideInUp {
      from { opacity: 0; transform: translateY(30px); }
      to { opacity: 1; transform: translateY(0); }
    }

    #color-modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      padding-bottom: 15px;
      border-bottom: 2px solid #444;
      cursor: move;
      position: sticky;
      top: 0;
      background: linear-gradient(145deg, #2a2a2a, #1a1a1a);
      z-index: 10;
      border-radius: 12px 12px 0 0;
      padding: 20px 20px 15px 20px;
      margin: -20px -20px 20px -20px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      backdrop-filter: blur(10px);
    }

    #color-modal-title {
      color: white;
      font-size: 18px;
      font-weight: bold;
      margin: 0;
    }

    #close-color-modal {
      background: #f44336;
      color: white;
      border: none;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      cursor: pointer;
      font-size: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    #close-color-modal:hover {
      background: #d32f2f;
    }

    .color-sections-grid { 
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
      gap: 15px;
      margin-bottom: 20px;
      margin-top: 40px;
    }

    .color-section {
      background: linear-gradient(135deg, #333, #222);
      border: 1px solid #555;
      border-radius: 8px;
      padding: 15px;
    }

    .color-section-title {
      color: white;
      font-weight: bold;
      font-size: 14px;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .color-preview {
      width: 40px;
      height: 20px;
      border-radius: 4px;
      border: 1px solid #666;
      flex-shrink: 0;
    }

    .color-controls {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .colors-container {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .color-row { 
      display: grid;
      grid-template-columns: 20px 60px 1fr 50px 30px;
      gap: 8px;
      align-items: center;
      padding: 6px;
      background: rgba(255,255,255,0.05);
      border-radius: 6px;
    }

    .color-index { 
      color: #aaa;
      font-size: 12px;
      font-weight: bold;
      text-align: center;
    }

    .color-input {
      width: 50px;
      height: 30px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      background: none;
    }

    .hex-input {
      background: #333;
      border: 1px solid #555;
      color: white;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      width: 90%;
    }

    .alpha-slider {
      width: 100%;
      height: 4px;
      background: linear-gradient(to right, transparent, #fff);
      border-radius: 2px;
      outline: none;
      -webkit-appearance: none;
    }

    .alpha-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 14px;
      height: 14px;
      background: #2196F3;
      border-radius: 50%;
      cursor: pointer;
    }

    .remove-color {
      background: #f44336;
      color: white;
      border: none;
      width: 24px;
      height: 24px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .remove-color:hover {
      background: #d32f2f;
    }

    .remove-color:disabled {
      background: #666;
      cursor: not-allowed;
    }

    .color-actions {
      display: flex;
      gap: 8px;
      align-items: center;
      margin-top: 8px;
    }

    .add-color {
      background: #4CAF50;
      color: white;
      border: none;
      padding: 6px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      font-weight: bold;
      flex: 1;
    }

    .add-color:hover {
      background: #45a049;
    }

    .add-color:disabled {
      background: #666;
      cursor: not-allowed;
    }

    .angle-control {
      display: grid;
      grid-template-columns: 50px 1fr 40px;
      gap: 8px;
      align-items: center;
    }

    .animation-control {
      display: grid;
      grid-template-columns: 50px 1fr;
      gap: 8px;
      align-items: center;
      margin-top: 6px;
    }

    .animation-control label {
      color: #ccc;
      font-size: 12px;
    }

    .animation-type-select {
      background: #2a2a2a;
      color: #ccc;
      border: 1px solid #555;
      border-radius: 4px;
      padding: 3px 6px;
      font-size: 12px;
      cursor: pointer;
    }

    .animation-type-select:focus {
      outline: none;
      border-color: #FF9500;
    }

    .speed-control {
      display: grid;
      grid-template-columns: 50px 1fr 45px;
      gap: 8px;
      align-items: center;
      margin-top: 6px;
    }

    .speed-control label {
      color: #ccc;
      font-size: 12px;
    }

    .speed-value {
      color: white;
      font-size: 12px;
      text-align: right;
    }

    .angle-control label {
      color: #ccc;
      font-size: 12px;
    }

    .angle-slider {
      height: 4px;
      background: #333;
      border-radius: 2px;
      outline: none;
      -webkit-appearance: none;
    }

    .angle-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 14px;
      height: 14px;
      background: #FF9500;
      border-radius: 50%;
      cursor: pointer;
    }

    .angle-value {
      color: white;
      font-size: 12px;
      text-align: right;
    }

    .gradient-preview {
      position: relative;
      isolation: isolate;
      overflow: hidden;
      height: 84px;
      border-radius: 6px;
      border: 1px solid #666;
      color: white;
      font-size: 10px;
      text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
      font-weight: bold;
    }
    .gradient-preview .pv-bg { position: absolute; inset: 0; z-index: 0; }
    .gradient-preview .pv-label { position: absolute; top: 4px; left: 8px; z-index: 2; opacity: 0.85; }
    .gradient-preview .pv-tiles {
      position: absolute; left: 8px; right: 8px; bottom: 8px; z-index: 1;
      display: flex; gap: 6px; align-items: flex-end;
    }
    .gradient-preview .pv-tiles i {
      flex: 1; height: 38px; border-radius: 3px;
      background: linear-gradient(160deg, #3b4a63, #1b2230);
      box-shadow: 0 2px 6px rgba(0,0,0,0.5);
    }
    .gradient-preview .pv-tiles i:nth-child(2) { background: linear-gradient(160deg, #7a3b3b, #2b1616); }
    .gradient-preview .pv-tiles i:nth-child(3) { background: linear-gradient(160deg, #3b7a5a, #14261d); }
    .gradient-preview .pv-tiles i:nth-child(4) { background: linear-gradient(160deg, #7a6a3b, #2b2514); }
    .gradient-preview .pv-tiles i:nth-child(5) { background: linear-gradient(160deg, #5a3b7a, #1d1429); }
    @keyframes pv-hue { 0% { filter: hue-rotate(0deg); } 100% { filter: hue-rotate(360deg); } }
    @keyframes pv-br  { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }

    .color-section-title .section-title-text { flex: 1; }
    .section-reset {
      background: rgba(255,255,255,0.08);
      color: #ddd;
      border: 1px solid #555;
      border-radius: 5px;
      padding: 3px 8px;
      font-size: 11px;
      cursor: pointer;
      white-space: nowrap;
    }
    .section-reset:hover { background: rgba(255,149,0,0.25); border-color: #FF9500; color: #fff; }
    .preset-select {
      background: #2a2a2a; color: #ccc; border: 1px solid #555; border-radius: 4px;
      padding: 3px 6px; font-size: 12px; cursor: pointer;
    }
    .preset-select:focus { outline: none; border-color: #FF9500; }

    #color-modal-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 15px;
      border-top: 1px solid #444;
    }

    .color-modal-button {
      padding: 8px 16px;
      border: none;
      border-radius: 6px;
      font-weight: bold;
      cursor: pointer;
      font-size: 12px;
      transition: all 0.2s ease;
      margin-left: 6px;
    }

    #apply-colors {
      background: linear-gradient(135deg, #4CAF50, #45a049);
      color: white;
    }

    #apply-colors:hover {
      background: linear-gradient(135deg, #45a049, #3d8b40);
      transform: translateY(-1px);
    }

    #reset-colors {
      background: linear-gradient(135deg, #FF9500, #E6850E);
      color: white;
    }

    #reset-colors:hover {
      background: linear-gradient(135deg, #E6850E, #CC7700);
      transform: translateY(-1px);
    }

    #export-colors {
      background: linear-gradient(135deg, #2196F3, #1976D2);
      color: white;
    }

    #export-colors:hover {
      background: linear-gradient(135deg, #1976D2, #1565C0);
      transform: translateY(-1px);
    }

    #import-colors {
      background: linear-gradient(135deg, #9C27B0, #7B1FA2);
      color: white;
    }

    #import-colors:hover {
      background: linear-gradient(135deg, #7B1FA2, #6A1B9A);
      transform: translateY(-1px);
    }

    .info-text {
      color: #888;
      font-size: 11px;
    }

    /* ============ Layout refresh ============ */
    #color-modal { width: 1040px; max-height: 88vh; }
    .color-sections-grid {
      grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
      gap: 16px;
      margin-top: 0;
      align-items: start;
    }
    .color-section {
      background: #262626;
      border: 1px solid #3d3d3d;
      border-radius: 10px;
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      transition: border-color 0.15s;
    }
    .color-section:hover { border-color: #666; }
    .color-section-title { margin: 0; gap: 10px; align-items: center; }
    .color-section-title .color-preview { display: none; }
    .section-title-block { flex: 1; display: flex; flex-direction: column; min-width: 0; }
    .section-title-text { font-size: 14px; font-weight: 700; color: #fff; line-height: 1.2; }
    .section-hint { font-size: 11px; color: #8b8b8b; margin-top: 2px; line-height: 1.25; }
    .gradient-preview { height: 96px; border-radius: 8px; border: 1px solid #4a4a4a; }
    .color-controls { gap: 10px; }
    .color-actions { margin-top: 0; justify-content: space-between; }
    .group-label { font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: #9a9a9a; }
    .add-color {
      flex: none;
      background: transparent;
      color: #7ddc82;
      border: 1px dashed #4b7a4e;
      padding: 4px 10px;
      font-size: 11px;
    }
    .add-color:hover { background: rgba(76,175,80,0.15); }
    .add-color:disabled { background: transparent; color: #666; border-color: #444; }
    .color-row { grid-template-columns: 18px 44px 1fr 90px 26px; padding: 5px 8px; gap: 8px; }
    .hex-input { width: 100%; box-sizing: border-box; }
    .control-group {
      display: flex; flex-direction: column; gap: 8px;
      padding-top: 10px; border-top: 1px solid #383838;
    }
    .control-group .angle-control,
    .control-group .animation-control,
    .control-group .speed-control { margin-top: 0; }
    .control-group .angle-control,
    .control-group .speed-control { grid-template-columns: 56px 1fr 44px; }
    .control-group .animation-control { grid-template-columns: 56px 1fr; }
    .control-group label { font-size: 12px; color: #aaa; }
    .animation-type-select, .preset-select { width: 100%; box-sizing: border-box; }

    /* Footer: sticky, one tidy row */
    #color-modal-footer {
      position: sticky;
      bottom: -20px;
      margin: 0 -20px -20px;
      padding: 12px 20px;
      background: linear-gradient(145deg, #2a2a2a, #1a1a1a);
      border-top: 1px solid #444;
      border-radius: 0 0 12px 12px;
      flex-wrap: wrap;
      gap: 10px;
      z-index: 10;
    }
    #color-modal-footer .footer-group { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    #color-modal-footer .color-modal-button {
      background: #333;
      color: #ddd;
      border: 1px solid #4a4a4a;
      padding: 7px 12px;
      font-size: 12px;
      transform: none;
    }
    #color-modal-footer .color-modal-button:hover { background: #3f3f3f; border-color: #777; transform: none; }
    #color-modal-footer #apply-colors {
      background: linear-gradient(135deg, #4CAF50, #45a049);
      color: #fff;
      border-color: transparent;
      font-weight: 700;
      padding: 8px 18px;
    }
    #color-modal-footer #apply-colors:hover { background: linear-gradient(135deg, #45a049, #3d8b40); }
  `
  document.head.appendChild(colorStyle)
}

// ============================================================================
// COLOR UTILITIES
// ============================================================================

/**
 * Convert hex color + alpha to RGBA string
 * @param {string} hex - Hex color code
 * @param {number} alpha - Alpha value (0-1)
 * @returns {string} - RGBA color string
 */
function hexAlphaToRGBA(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// Friendly names / hints shown in the Colors modal (config keys and saved data are unchanged)
const SECTION_LABELS = {
  gamelistBackground:   { label: "Game list",       hint: "Left sidebar behind your game list" },
  gamesBackground:      { label: "Games grid",      hint: "Main background of the library" },
  FriendList:           { label: "Friends & chat",  hint: "Friends list and chat window" },
  BigPicture:           { label: "Big Picture",     hint: "Applied through Save BP CSS" },
  headerFooter:         { label: "Header & footer", hint: "Top bar and bottom bar" },
  propertiesBackground: { label: "Game properties", hint: "Game properties window" },
  downloadsBackground:  { label: "Downloads",       hint: "Downloads page" },
  Dropdowns:            { label: "Buttons & menus", hint: "Buttons, dropdowns and highlights" },
}

// Ready-made gradients for the Colors modal (alpha is always 1)
const COLOR_PRESETS = [
  { name: "Sunset",   angle: 135, colors: ["#ff512f", "#dd2476", "#3a0ca3"] },
  { name: "Ocean",    angle: 225, colors: ["#0f2027", "#203a43", "#2c5364"] },
  { name: "Aurora",   angle: 200, colors: ["#0f0c29", "#302b63", "#24c6dc"] },
  { name: "Midnight", angle: 225, colors: ["#000000", "#19002e", "#061f30"] },
  { name: "Plum",     angle: 225, colors: ["#5a0a37", "#19002e", "#09578d"] },
  { name: "Forest",   angle: 160, colors: ["#0b1f14", "#134e3a", "#2c7a4b"] },
  { name: "Ember",    angle: 150, colors: ["#1a0000", "#6b0f1a", "#ff6b35"] },
  { name: "Graphite", angle: 180, colors: ["#0a0a0a", "#1c1c1c", "#2e2e2e"] },
]

/**
 * Generate CSS gradient string with percentages
 * @param {Array} colors - Array of color objects with hex and alpha
 * @param {number} angle - Gradient angle in degrees
 * @returns {string} - CSS gradient string
 */
function generateGradient(colors, angle) {
  if (colors.length < 2) return 'linear-gradient(0deg, #000 0%, #000 100%)'

  const step = 100 / (colors.length - 1)
  const colorStops = colors.map((color, index) => {
    const percentage = index === colors.length - 1 ? 100 : Math.round(index * step)
    const rgba = hexAlphaToRGBA(color.hex, color.alpha)
    return `${rgba} ${percentage}%`
  }).join(', ')

  return `linear-gradient(${angle}deg, ${colorStops})`
}

// ============================================================================
// CONFIGURATION MANAGEMENT
// ============================================================================

/**
 * Load saved color configuration from localStorage
 * @returns {Object} - Color configuration object
 */
function loadColorConfig() {
  const saved = localStorage.getItem(COLOR_CONFIG_KEY)
  if (saved) {
    try {
      const config = JSON.parse(saved)
      // Ensure compatibility with new format
      Object.keys(config).forEach(key => {
        if (config[key].colors && config[key].colors.length > 0) {
          // Check if colors are in old format (strings) and convert
          if (typeof config[key].colors[0] === 'string') {
            config[key].colors = config[key].colors.map(hex => ({ hex, alpha: 1 }))
          }
        }
        // Migrate missing animation/speed fields
        if (config[key].animation === undefined) config[key].animation = "none"
        if (config[key].speed    === undefined) config[key].speed    = 4
      })
      // Keep Big Picture's selector from the defaults so old saved configs pick up fixes
      if (config.BigPicture && DEFAULT_COLORS.BigPicture) config.BigPicture.selector = DEFAULT_COLORS.BigPicture.selector
      if (config.gamesBackground && DEFAULT_COLORS.gamesBackground) config.gamesBackground.selector = DEFAULT_COLORS.gamesBackground.selector
      return { ...DEFAULT_COLORS, ...config }
    } catch (e) {
      console.error("[ColorCustomizer] Error loading config:", e)
    }
  }
  return DEFAULT_COLORS
}

/**
 * Save color configuration to localStorage
 * @param {Object} config - Color configuration object
 */
function saveColorConfig(config) {
  localStorage.setItem(COLOR_CONFIG_KEY, JSON.stringify(config))
}

/**
 * Apply color configuration to page CSS
 * @param {Object} config - Color configuration object
 */
function applyColorConfig(config) {
  // Persist so the FriendList frame receives the "storage" event.
  // BigPicture has its own localStorage — use "Save BP CSS" button instead.
  localStorage.setItem(COLOR_CONFIG_KEY, JSON.stringify(config))

  let existingStyle = document.getElementById("custom-color-overrides")
  if (!existingStyle) {
    existingStyle = document.createElement("style")
    existingStyle.id = "custom-color-overrides"
    document.head.appendChild(existingStyle)
  }

  // Helper: rotate hue of a hex color by degrees
  function rotateHue(hex, deg) {
    const r = parseInt(hex.slice(1,3),16)/255
    const g = parseInt(hex.slice(3,5),16)/255
    const b = parseInt(hex.slice(5,7),16)/255
    const max = Math.max(r,g,b), min = Math.min(r,g,b), d = max - min
    let h = 0, s = max === 0 ? 0 : d/max, v = max
    if (d !== 0) {
      if (max === r) h = ((g-b)/d + (g<b?6:0))/6
      else if (max === g) h = ((b-r)/d + 2)/6
      else h = ((r-g)/d + 4)/6
    }
    h = ((h*360 + deg) % 360 + 360) % 360 / 360
    const i = Math.floor(h*6), f = h*6-i, p = v*(1-s), q = v*(1-f*s), t = v*(1-(1-f)*s)
    let nr,ng,nb
    switch(i%6){case 0:nr=v;ng=t;nb=p;break;case 1:nr=q;ng=v;nb=p;break;case 2:nr=p;ng=v;nb=t;break;case 3:nr=p;ng=q;nb=v;break;case 4:nr=t;ng=p;nb=v;break;default:nr=v;ng=p;nb=q;}
    return '#'+[nr,ng,nb].map(x=>Math.round(x*255).toString(16).padStart(2,'0')).join('')
  }

  function generateRadial(colors, stops = null) {
    const s = stops || colors.map((_,i) => i === colors.length-1 ? 100 : Math.round(i*100/(colors.length-1)))
    const colorStops = colors.map((c,i) => {
      const rgba = hexAlphaToRGBA(c.hex, c.alpha)
      return `${rgba} ${s[i]}%`
    }).join(', ')
    return `radial-gradient(circle at center, ${colorStops})`
  }

  // Keys handled by external frames — skip them here to avoid injecting
  // selectors (.friendlist, body) that don't exist in the library frame
  const EXTERNAL_KEYS = new Set(["FriendList", "BigPicture"])

  let css = ""

  Object.entries(config).forEach(([key, section]) => {
    if (EXTERNAL_KEYS.has(key)) return  // handled by friends/bigpicture frames
    if (!section.selector || !section.colors || section.angle === undefined) return

    const gradient = generateGradient(section.colors, section.angle)
    const animType = section.animation || "none"
    const speed    = section.speed ?? 4
    const sel      = section.selector

    if (animType === "none") {
      // Cancel any running JS radial loop for this key
      if (window._moRadialLoops?.[key]) {
        cancelAnimationFrame(window._moRadialLoops[key])
        delete window._moRadialLoops[key]
      }
      css += `${sel} { background-image: ${gradient} !important; }\n`

    } else if (animType === "rotate") {
      // Color Rotate left→right: animates hue-rotate filter on ::before
      // so children (game covers, text) are not affected
      css += `@keyframes mo-anim-${key} { 0% { filter: hue-rotate(0deg); } 100% { filter: hue-rotate(360deg); } }\n`
      css += `${sel} { position: relative !important; isolation: isolate !important; }\n`
      css += `${sel}::before { content: "" !important; position: absolute !important; inset: 0 !important; z-index: 0 !important; background-image: ${gradient} !important; animation: mo-anim-${key} ${speed}s linear infinite !important; pointer-events: none !important; }\n`
      css += `${sel} > * { position: relative !important; z-index: 1 !important; }\n`

    } else if (animType === "radial") {
      // Radial Rotate: colors cycle outward from center in expanding circles.
      // CSS can't interpolate background-image, so we drive this via a JS RAF
      // loop that updates a CSS custom property --mo-hue-${key} each frame,
      // and a conic+radial combo that shifts with it.
      // We inject the base radial and the custom property fallback here;
      // the JS loop is started by applyColorConfig after building the CSS.
      css += `${sel} { position: relative !important; isolation: isolate !important; --mo-hue-${key}: 0deg; }\n`
      css += `${sel}::before { content: "" !important; position: absolute !important; inset: 0 !important; z-index: 0 !important; background-image: ${generateRadial(section.colors)} !important; background-attachment: fixed !important; background-size: cover !important; background-position: center center !important; filter: hue-rotate(var(--mo-hue-${key})) !important; animation: none !important; pointer-events: none !important; }\n`
      css += `${sel} > * { position: relative !important; z-index: 1 !important; }\n`

      // Schedule JS-driven animation after CSS is applied
      const msPerCycle = speed * 1000
      ;(function startRadialLoop(selector, msPerCycle, configKey) {
        // Cancel any existing loop for this key
        if (window._moRadialLoops) {
          if (window._moRadialLoops[configKey]) {
            cancelAnimationFrame(window._moRadialLoops[configKey])
          }
        } else {
          window._moRadialLoops = {}
        }

        function tick(ts) {
          const hue = ((ts % msPerCycle) / msPerCycle) * 360
          document.querySelectorAll(selector).forEach(el => {
            el.style.setProperty(`--mo-hue-${configKey}`, `${hue.toFixed(1)}deg`)
          })
          window._moRadialLoops[configKey] = requestAnimationFrame(tick)
        }

        window._moRadialLoops[configKey] = requestAnimationFrame(tick)
      })(sel, msPerCycle, key)

    } else if (animType === "breathe") {
      // Opacity breathe via ::before so children are not affected
      css += `@keyframes mo-anim-${key} { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }\n`
      css += `${sel} { position: relative !important; isolation: isolate !important; }\n`
      css += `${sel}::before { content: "" !important; position: absolute !important; inset: 0 !important; z-index: 0 !important; background-image: ${gradient} !important; animation: mo-anim-${key} ${speed}s ease-in-out infinite !important; pointer-events: none !important; }\n`
      css += `${sel} > * { position: relative !important; z-index: 1 !important; }\n`
    }
  })

  existingStyle.textContent = css
}

// ============================================================================
// MODAL UI HELPERS
// ============================================================================

/**
 * Create HTML for a color row in the modal
 * @param {Object} color - Color object with hex and alpha
 * @param {number} index - Color index
 * @param {string} sectionKey - Section key
 * @param {boolean} canRemove - Whether color can be removed
 * @returns {string} - HTML string for color row
 */
function createColorRowHTML(color, index, sectionKey, canRemove) {
  const alpha = Math.round(color.alpha * 100)
  return `
    <div class="color-row" data-index="${index}">
      <div class="color-index">${index + 1}</div>
      <input type="color" class="color-input" value="${color.hex}">
      <input type="text" class="hex-input" value="${color.hex}" placeholder="#000000">
      <input type="range" class="alpha-slider" min="0" max="100" value="${alpha}" title="Opacity: ${alpha}%">
      <button class="remove-color" ${!canRemove ? 'disabled' : ''} title="Remove Color">×</button>
    </div>
  `
}

// ============================================================================
// MODAL CREATION
// ============================================================================

/**
 * Create enhanced color customization modal
 * @returns {HTMLElement} - Modal overlay element
 */
function createColorModal() {
  if (colorModalOpen) return

  // Create deep copy of config to avoid references
  let currentConfig = JSON.parse(JSON.stringify(loadColorConfig()))

  const overlay = document.createElement("div")
  overlay.id = "color-modal-overlay"

  const modal = document.createElement("div")
  modal.id = "color-modal"

  const header = document.createElement("div")
  header.id = "color-modal-header"
  header.innerHTML = `
    <h2 id="color-modal-title">🎨 Customize Colors</h2>
    <button id="close-color-modal">×</button>
  `

  const content = document.createElement("div")
  content.className = "color-sections-grid"

  // Create sections for each color configuration
  Object.entries(currentConfig).forEach(([key, section]) => {
    const sectionDiv = document.createElement("div")
    sectionDiv.className = "color-section"
    const meta = { label: section.name, hint: "" }
    sectionDiv.dataset.key = key
    sectionDiv.innerHTML = `
      <div class="color-section-title">
        <div class="color-preview" data-key="${key}"></div>
        <div class="section-title-block">
          <span class="section-title-text">${meta.label}</span>
          ${meta.hint ? `<span class="section-hint">${meta.hint}</span>` : ""}
        </div>
        <button class="section-reset" data-key="${key}" title="Reset only this section to its default">↺ Reset</button>
      </div>
      <div class="gradient-preview" data-key="${key}">
        <div class="pv-bg"></div>
        <span class="pv-label">Preview</span>
        <div class="pv-tiles"><i></i><i></i><i></i><i></i><i></i></div>
      </div>
      <div class="color-controls">
        <div class="color-actions">
          <span class="group-label">Colors</span>
          <button class="add-color" data-key="${key}" ${section.colors.length >= 6 ? 'disabled' : ''}>
            ➕ Add Color (${section.colors.length}/6)
          </button>
        </div>
        <div class="colors-container" data-key="${key}">
          ${section.colors.map((color, index) =>
      createColorRowHTML(color, index, key, section.colors.length > 2)
    ).join('')}
        </div>
        <div class="control-group">
          <div class="angle-control">
            <label>Angle:</label>
            <input type="range" class="angle-slider" min="0" max="360" value="${section.angle}" data-key="${key}">
            <span class="angle-value">${section.angle}°</span>
          </div>
          <div class="animation-control">
            <label>Anim:</label>
            <select class="animation-type-select" data-key="${key}">
              <option value="none"    ${(section.animation||'none')==='none'    ? 'selected':''}>None</option>
              <option value="rotate"  ${(section.animation||'none')==='rotate'  ? 'selected':''}>Color Rotate (L → R)</option>
              <option value="radial"  ${(section.animation||'none')==='radial'  ? 'selected':''}>Color Rotate (radial)</option>
              <option value="breathe" ${(section.animation||'none')==='breathe' ? 'selected':''}>Breathe</option>
            </select>
          </div>
          <div class="speed-control" data-key="${key}" ${(section.animation||'none')==='none' ? 'style="display:none"' : ''}>
            <label>Speed:</label>
            <input type="range" class="speed-slider" min="1" max="20" value="${section.speed ?? 4}" data-key="${key}">
            <span class="speed-value">${section.speed ?? 4}s</span>
          </div>
          <div class="animation-control">
            <label>Preset:</label>
            <select class="preset-select" data-key="${key}">
              <option value="">Choose a preset…</option>
              ${COLOR_PRESETS.map((pr, i) => `<option value="${i}">${pr.name}</option>`).join("")}
            </select>
          </div>
        </div>
      </div>
    `
    content.appendChild(sectionDiv)
  })

  const footer = document.createElement("div")
  footer.id = "color-modal-footer"
  footer.innerHTML = `
    <div class="footer-group">
      <button id="reset-colors" class="color-modal-button" title="Reset every section to defaults">🔄 Reset</button>
      <button id="export-colors" class="color-modal-button">📁 Export</button>
      <button id="import-colors" class="color-modal-button">📂 Import</button>
      <button id="save-bp-css" class="color-modal-button" >🖥️ Save BP CSS</button>
    </div>
    <div class="footer-group footer-right">
      <span class="info-text">💡 Real-time preview • 2-6 colors per gradient</span>
      <button id="apply-colors" class="color-modal-button">✅ Apply &amp; Save</button>
    </div>
    <input type="file" id="color-import-input" accept=".json" style="display: none;">
  `

  modal.appendChild(header)
  modal.appendChild(content)
  modal.appendChild(footer)
  overlay.appendChild(modal)

  setupEnhancedColorModalEvents(overlay, currentConfig)

  document.body.appendChild(overlay)
  colorModalOpen = true
  // Must run AFTER the overlay is in the document: updatePreview() uses document.querySelector
  updateAllPreviews(currentConfig)

  // Make modal draggable
  makeModalDraggable(modal, header)

  return overlay
}

/**
 * Update modal with new configuration
 * @param {HTMLElement} overlay - Modal overlay element
 * @param {Object} config - Color configuration object
 */
function updateModalWithNewConfig(overlay, config) {
  try {
    // Update each section
    Object.entries(config).forEach(([key, section]) => {
      const container = overlay.querySelector(`.colors-container[data-key="${key}"]`)
      const addBtn = overlay.querySelector(`.add-color[data-key="${key}"]`)
      const angleSlider = overlay.querySelector(`.angle-slider[data-key="${key}"]`)
      const angleValue = angleSlider?.nextElementSibling
      
      if (container && addBtn && angleSlider && angleValue) {
        // Update colors
        refreshSectionColors(key, section, container, addBtn, config)
        
        // Update angle
        angleSlider.value = section.angle
        angleValue.textContent = `${section.angle}°`
        
        // Update preview
        updatePreview(key, section)
      }
    })
  } catch (error) {
    console.error("[ColorCustomizer] Error updating modal:", error)
  }
}

/**
 * Handle color reset button click
 * @param {Object} config - Color configuration object
 * @param {HTMLElement} overlay - Modal overlay element
 */
function handleColorReset(config, overlay) {
  if (!config || !overlay) {
    console.error("[ColorCustomizer] Missing config or overlay for reset")
    return
  }
  
  // Create custom confirmation dialog
  createCustomConfirmDialog(
    "⚠️ Reset all colors to default?\n\nThis will restore all gradients to their original settings and cannot be undone.",
    
    // onConfirm - User confirmed reset
    () => {
      performColorReset(config, overlay)
    },
    
    // onCancel - User cancelled
    () => {
      // User cancelled, do nothing
    }
  )
}

/**
 * Perform color reset to default values
 * @param {Object} config - Color configuration object
 * @param {HTMLElement} overlay - Modal overlay element
 */
function performColorReset(config, overlay) {
  try {
    // Get fresh default configuration
    const freshDefaultConfig = JSON.parse(JSON.stringify(DEFAULT_COLORS))
    
    // Clear current config
    Object.keys(config).forEach(key => {
      delete config[key]
    })
    
    // Apply default config
    Object.keys(freshDefaultConfig).forEach(key => {
      config[key] = JSON.parse(JSON.stringify(freshDefaultConfig[key]))
    })
    
    // Apply to page
    applyColorConfig(config)
    
    // Update modal
    updateModalAfterReset(overlay, config)
    
    // Show success notification
    showNotification("🔄 Colors successfully reset to default!")
    
  } catch (error) {
    console.error("[ColorCustomizer] Reset failed:", error)
    showNotification("❌ Error resetting colors: " + error.message)
  }
}

/**
 * Create custom confirmation dialog
 * @param {string} message - Dialog message
 * @param {Function} onConfirm - Confirm callback
 * @param {Function} onCancel - Cancel callback
 */
function createCustomConfirmDialog(message, onConfirm, onCancel) {
  // Remove existing dialog if any
  const existingDialog = document.getElementById('custom-confirm-overlay')
  if (existingDialog) {
    existingDialog.remove()
  }

  const overlay = document.createElement('div')
  overlay.id = 'custom-confirm-overlay'
  overlay.style.cssText = `
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    z-index: 20000;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: fadeIn 0.2s ease;
  `

  const dialog = document.createElement('div')
  dialog.style.cssText = `
    background: linear-gradient(145deg, #2a2a2a, #1a1a1a);
    border-radius: 12px;
    padding: 25px;
    width: 400px;
    max-width: 90vw;
    box-shadow: 0 20px 40px rgba(0,0,0,0.5);
    border: 1px solid #444;
    animation: slideInUp 0.3s ease;
    text-align: center;
  `

  const messageEl = document.createElement('div')
  messageEl.style.cssText = `
    color: white;
    font-size: 16px;
    margin-bottom: 25px;
    line-height: 1.4;
  `
  messageEl.textContent = message

  const buttonsContainer = document.createElement('div')
  buttonsContainer.style.cssText = `
    display: flex;
    gap: 15px;
    justify-content: center;
  `

  const cancelBtn = document.createElement('button')
  cancelBtn.textContent = '❌ Cancel'
  cancelBtn.style.cssText = `
    background: linear-gradient(135deg, #666, #555);
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 6px;
    cursor: pointer;
    font-weight: bold;
    transition: all 0.2s ease;
  `

  const confirmBtn = document.createElement('button')
  confirmBtn.textContent = '🔄 Reset Colors'
  confirmBtn.style.cssText = `
    background: linear-gradient(135deg, #f44336, #d32f2f);
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 6px;
    cursor: pointer;
    font-weight: bold;
    transition: all 0.2s ease;
  `

  // Hover effects
  cancelBtn.addEventListener('mouseenter', () => {
    cancelBtn.style.background = 'linear-gradient(135deg, #777, #666)'
  })
  cancelBtn.addEventListener('mouseleave', () => {
    cancelBtn.style.background = 'linear-gradient(135deg, #666, #555)'
  })

  confirmBtn.addEventListener('mouseenter', () => {
    confirmBtn.style.background = 'linear-gradient(135deg, #d32f2f, #b71c1c)'
  })
  confirmBtn.addEventListener('mouseleave', () => {
    confirmBtn.style.background = 'linear-gradient(135deg, #f44336, #d32f2f)'
  })

  // Event listeners
  cancelBtn.addEventListener('click', () => {
    overlay.remove()
    if (onCancel) onCancel()
  })

  confirmBtn.addEventListener('click', () => {
    overlay.remove()
    if (onConfirm) onConfirm()
  })

  // Close on overlay click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.remove()
      if (onCancel) onCancel()
    }
  })

  // Keyboard support
  document.addEventListener('keydown', function handleKeyDown(e) {
    if (e.key === 'Escape') {
      overlay.remove()
      document.removeEventListener('keydown', handleKeyDown)
      if (onCancel) onCancel()
    } else if (e.key === 'Enter') {
      overlay.remove()
      document.removeEventListener('keydown', handleKeyDown)
      if (onConfirm) onConfirm()
    }
  })

  // Assemble elements
  buttonsContainer.appendChild(cancelBtn)
  buttonsContainer.appendChild(confirmBtn)
  dialog.appendChild(messageEl)
  dialog.appendChild(buttonsContainer)
  overlay.appendChild(dialog)

  // Add CSS animations if they don't exist
  if (!document.getElementById('custom-confirm-styles')) {
    const style = document.createElement('style')
    style.id = 'custom-confirm-styles'
    style.textContent = `
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes slideInUp {
        from { opacity: 0; transform: translateY(30px) scale(0.9); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
    `
    document.head.appendChild(style)
  }

  document.body.appendChild(overlay)
  
  // Focus on cancel button by default
  setTimeout(() => cancelBtn.focus(), 100)
}

// ============================================================================
// MODAL EVENT HANDLING
// ============================================================================

/**
 * Setup enhanced color modal event listeners
 * @param {HTMLElement} overlay - Modal overlay element
 * @param {Object} config - Color configuration object
 */
function setupEnhancedColorModalEvents(overlay, config) {
  // Close modal
  const closeBtn = overlay.querySelector("#close-color-modal")
  if (closeBtn) {
    closeBtn.addEventListener("click", closeColorModal)
  }
  
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeColorModal()
  })

  // Color section events
  Object.keys(config).forEach(key => {
    const section = overlay.querySelector(`.colors-container[data-key="${key}"]`)
    const addBtn = overlay.querySelector(`.add-color[data-key="${key}"]`)
    const angleSlider = overlay.querySelector(`.angle-slider[data-key="${key}"]`)
    const angleValue = angleSlider?.nextElementSibling

    if (addBtn) {
      addBtn.addEventListener("click", () => {
        if (config[key].colors.length < 6) {
          const newColor = { hex: "#ffffff", alpha: 1 }
          config[key].colors.push(newColor)
          refreshSectionColors(key, config[key], section, addBtn, config)
          updatePreview(key, config[key])
          applyColorConfig(config)
        }
      })
    } 

    if (section) {
      setupColorEvents(section, key, config, addBtn)
    }

    if (angleSlider && angleValue) {
      angleSlider.addEventListener("input", (e) => {
        const angle = parseInt(e.target.value)
        config[key].angle = angle
        angleValue.textContent = `${angle}°`
        updatePreview(key, config[key])
        applyColorConfig(config)
      })
    }

    // Push values into a section (config + controls + preview + live apply)
    const applySectionValues = (patch) => {
      Object.assign(config[key], patch)
      const container = overlay.querySelector(`.colors-container[data-key="${key}"]`)
      const addButton = overlay.querySelector(`.add-color[data-key="${key}"]`)
      refreshSectionColors(key, config[key], container, addButton, config)
      const aSlider = overlay.querySelector(`.angle-slider[data-key="${key}"]`)
      if (aSlider) { aSlider.value = config[key].angle; aSlider.nextElementSibling.textContent = `${config[key].angle}°` }
      const aSel = overlay.querySelector(`.animation-type-select[data-key="${key}"]`)
      if (aSel) aSel.value = config[key].animation || "none"
      const sCtl = overlay.querySelector(`.speed-control[data-key="${key}"]`)
      if (sCtl) sCtl.style.display = (config[key].animation || "none") === "none" ? "none" : "grid"
      const sSl = overlay.querySelector(`.speed-slider[data-key="${key}"]`)
      if (sSl) { sSl.value = config[key].speed ?? 4; sSl.nextElementSibling.textContent = `${config[key].speed ?? 4}s` }
      updatePreview(key, config[key])
      applyColorConfig(config)
    }

    const resetSectionBtn = overlay.querySelector(`.section-reset[data-key="${key}"]`)
    if (resetSectionBtn) {
      resetSectionBtn.addEventListener("click", () => {
        const def = DEFAULT_COLORS[key]
        if (!def) return
        const d = JSON.parse(JSON.stringify(def))
        applySectionValues({ colors: d.colors, angle: d.angle, animation: d.animation || "none", speed: d.speed ?? 4 })
        showNotification(`↺ ${config[key].name} reset`)
      })
    }

    const presetSelect = overlay.querySelector(`.preset-select[data-key="${key}"]`)
    if (presetSelect) {
      presetSelect.addEventListener("change", (e) => {
        const preset = COLOR_PRESETS[parseInt(e.target.value, 10)]
        if (!preset) return
        applySectionValues({ colors: preset.colors.map((hex) => ({ hex, alpha: 1 })), angle: preset.angle })
        e.target.value = ""
      })
    }

    // Animation type dropdown
    const animSelect = overlay.querySelector(`.animation-type-select[data-key="${key}"]`)
    const speedControl = overlay.querySelector(`.speed-control[data-key="${key}"]`)
    const speedSlider = overlay.querySelector(`.speed-slider[data-key="${key}"]`)
    const speedValue = speedSlider?.nextElementSibling

    if (animSelect) {
      animSelect.addEventListener("change", (e) => {
        config[key].animation = e.target.value
        // Show/hide speed control
        if (speedControl) speedControl.style.display = e.target.value === "none" ? "none" : "grid"
        updatePreview(key, config[key])
        applyColorConfig(config)
      })
    }

    if (speedSlider && speedValue) {
      speedSlider.addEventListener("input", (e) => {
        const speed = parseInt(e.target.value)
        config[key].speed = speed
        speedValue.textContent = `${speed}s`
        updatePreview(key, config[key])
        applyColorConfig(config)
      })
    }
  })

  // Apply button
  const applyBtn = overlay.querySelector("#apply-colors")
  if (applyBtn) {
    applyBtn.addEventListener("click", () => {
      saveColorConfig(config)
      applyColorConfig(config)
      showNotification("🎨 Colors saved and applied!")
      closeColorModal()
    })
  }

  // Reset button with custom dialog
  const resetBtn = overlay.querySelector("#reset-colors")
  if (resetBtn) {
    // Clear existing events
    const newResetBtn = resetBtn.cloneNode(true)
    resetBtn.parentNode.replaceChild(newResetBtn, resetBtn)
    
    // Main event
    newResetBtn.addEventListener("click", (e) => {
      e.preventDefault()
      e.stopPropagation()
      handleColorReset(config, overlay)
    })
  }

  // Export and Import buttons
  const exportBtn = overlay.querySelector("#export-colors")
  if (exportBtn) {
    exportBtn.addEventListener("click", () => exportColorConfig(config))
  }

  const saveBpBtn = overlay.querySelector("#save-bp-css")
  if (saveBpBtn) {
    saveBpBtn.addEventListener("click", () => saveBigPictureCSS(config))

    // Hover hint, pinned to the top of the modal: explains where the downloaded file has to go
    const modalEl = overlay.querySelector("#color-modal")
    const showBpHint = () => {
      let hint = document.getElementById("bp-save-hint")
      if (!hint) {
        hint = document.createElement("div")
        hint.id = "bp-save-hint"
        hint.innerHTML =
          "<b>Big Picture colors need one manual step</b><br>" +
          "1. Click <b>Save BP CSS</b> (the file goes to your Downloads folder).<br>" +
          "2. Move <code>bigpicture.custom.css</code> to<br>" +
          "<code>Steam\\millennium\\themes\\Steam2.0-modular</code> and replace the existing file.<br>" +
          "3. Restart Big Picture (or Steam) to see the change."
        hint.style.cssText =
          "position:fixed;z-index:100002;max-width:440px;padding:10px 14px;border-radius:8px;" +
          "background:#101820;color:#e6e6e6;border:1px solid #FF9500;font-size:12px;line-height:1.5;" +
          "box-shadow:0 8px 24px rgba(0,0,0,0.6);pointer-events:none;"
        document.body.appendChild(hint)
        hint.querySelectorAll("code").forEach((c) => {
          c.style.cssText = "background:#222;padding:1px 5px;border-radius:3px;color:#ffcc80;"
        })
      }
      const r = (modalEl || overlay).getBoundingClientRect()
      hint.style.top = `${Math.max(r.top + 10, 8)}px`
      hint.style.left = `${r.left + r.width / 2}px`
      hint.style.transform = "translateX(-50%)"
      hint.style.display = "block"
    }
    const hideBpHint = () => {
      const hint = document.getElementById("bp-save-hint")
      if (hint) hint.style.display = "none"
    }
    saveBpBtn.addEventListener("mouseenter", showBpHint)
    saveBpBtn.addEventListener("mouseleave", hideBpHint)
    saveBpBtn.addEventListener("click", hideBpHint)
  }

  const importBtn = overlay.querySelector("#import-colors")
  if (importBtn) {
    importBtn.addEventListener("click", () => {
      overlay.querySelector("#color-import-input").click()
    })
  }

  const importInput = overlay.querySelector("#color-import-input")
  if (importInput) {
    importInput.addEventListener("change", (e) => {
      importColorConfig(e, config, overlay)
    })
  }
}

function debugResetButton() {
  const overlay = document.querySelector("#color-modal-overlay")
  if (!overlay) {
    console.log("[DEBUG] No modal overlay found")
    return
  }
  
  const resetBtn = overlay.querySelector("#reset-colors")
  if (!resetBtn) {
    console.log("[DEBUG] No reset button found")
    return
  }
  
  console.log("[DEBUG] Reset button found:", resetBtn)
  console.log("[DEBUG] Reset button HTML:", resetBtn.outerHTML)
  console.log("[DEBUG] Reset button listeners:", getEventListeners(resetBtn))
  
  // Test click manually
  console.log("[DEBUG] Testing manual click...")
  resetBtn.click()
}

// Función para testear el reset manualmente
function testResetDirectly() {
  const overlay = document.querySelector("#color-modal-overlay")
  if (overlay) {
    const currentConfig = loadColorConfig()
    handleColorReset(currentConfig, overlay)
  } else {
    console.log("No modal found - open the color modal first")
  }
}

function updateModalAfterReset(overlay, config) {
  Object.entries(config).forEach(([key, section]) => {
    console.log(`[ColorCustomizer] Resetting section ${key}`)
    
    // Elementos del DOM
    const container = overlay.querySelector(`.colors-container[data-key="${key}"]`)
    const addBtn = overlay.querySelector(`.add-color[data-key="${key}"]`)
    const angleSlider = overlay.querySelector(`.angle-slider[data-key="${key}"]`)
    const angleValue = angleSlider?.nextElementSibling
    const preview = overlay.querySelector(`.color-preview[data-key="${key}"]`)
    const gradientPreview = overlay.querySelector(`.gradient-preview[data-key="${key}"]`)
    
    if (!container || !addBtn || !angleSlider || !angleValue) {
      console.error(`[ColorCustomizer] Missing DOM elements for ${key}`)
      return
    }
    
    // 1. Regenerar HTML de colores
    container.innerHTML = section.colors.map((color, index) =>
      createColorRowHTML(color, index, key, section.colors.length > 2)
    ).join('')
    
    // 2. Reconfigurar eventos
    setupColorEvents(container, key, config, addBtn)
    
    // 3. Actualizar botón add
    addBtn.disabled = section.colors.length >= 6
    addBtn.textContent = `➕ Add Color (${section.colors.length}/6)`
    
    // 4. Actualizar slider de ángulo
    angleSlider.value = section.angle
    angleValue.textContent = `${section.angle}°`
    
    // 5. Actualizar previews
    updatePreview(key, section)
    
    // 6. FORZAR ACTUALIZACIÓN DE INPUTS DE COLOR
    const colorInputs = container.querySelectorAll('.color-input')
    const hexInputs = container.querySelectorAll('.hex-input')
    const alphaSliders = container.querySelectorAll('.alpha-slider')
    
    section.colors.forEach((color, index) => {
      if (colorInputs[index]) {
        colorInputs[index].value = color.hex
        // Trigger change event para asegurar actualización
        colorInputs[index].dispatchEvent(new Event('input', { bubbles: true }))
      }
      if (hexInputs[index]) {
        hexInputs[index].value = color.hex
        hexInputs[index].dispatchEvent(new Event('input', { bubbles: true }))
      }
      if (alphaSliders[index]) {
        alphaSliders[index].value = Math.round(color.alpha * 100)
        alphaSliders[index].dispatchEvent(new Event('input', { bubbles: true }))
      }
    })
    
    console.log(`[ColorCustomizer] ✅ Section ${key} reset complete`)
  })
}

function forceUpdateModal(overlay, config) {
  console.log("[ColorCustomizer] Force updating modal...")
  
  Object.entries(config).forEach(([key, section]) => {
    console.log(`[ColorCustomizer] Updating section ${key}:`, section)
    
    // Elementos del DOM
    const container = overlay.querySelector(`.colors-container[data-key="${key}"]`)
    const addBtn = overlay.querySelector(`.add-color[data-key="${key}"]`)
    const angleSlider = overlay.querySelector(`.angle-slider[data-key="${key}"]`)
    const angleValue = angleSlider?.nextElementSibling
    const preview = overlay.querySelector(`.color-preview[data-key="${key}"]`)
    const gradientPreview = overlay.querySelector(`.gradient-preview[data-key="${key}"]`)
    
    if (!container || !addBtn || !angleSlider || !angleValue) {
      console.error(`[ColorCustomizer] Missing DOM elements for ${key}`)
      return
    }
    
    // 1. Actualizar colores HTML
    container.innerHTML = section.colors.map((color, index) =>
      createColorRowHTML(color, index, key, section.colors.length > 2)
    ).join('')
    
    // 2. Re-setup events para los nuevos elementos
    setupColorEvents(container, key, config, addBtn)
    
    // 3. Actualizar botón add
    addBtn.disabled = section.colors.length >= 6
    addBtn.textContent = `➕ Add Color (${section.colors.length}/6)`
    
    // 4. Actualizar slider de ángulo
    angleSlider.value = section.angle
    angleValue.textContent = `${section.angle}°`
    
    // 5. Actualizar previews
    updatePreview(key, section)
    
    // 6. FORZAR ACTUALIZACIÓN DE INPUTS DE COLOR
    const colorInputs = container.querySelectorAll('.color-input')
    const hexInputs = container.querySelectorAll('.hex-input')
    const alphaSliders = container.querySelectorAll('.alpha-slider')
    
    section.colors.forEach((color, index) => {
      if (colorInputs[index]) {
        colorInputs[index].value = color.hex
        // Trigger change event para asegurar actualización
        colorInputs[index].dispatchEvent(new Event('input', { bubbles: true }))
      }
      if (hexInputs[index]) {
        hexInputs[index].value = color.hex
        hexInputs[index].dispatchEvent(new Event('input', { bubbles: true }))
      }
      if (alphaSliders[index]) {
        alphaSliders[index].value = Math.round(color.alpha * 100)
        alphaSliders[index].dispatchEvent(new Event('input', { bubbles: true }))
      }
    })
    
    console.log(`[ColorCustomizer] ✅ Section ${key} updated successfully`)
  })
}

// 4. FUNCIÓN DEBUG PARA TESTING
function debugColorReset() {
  console.log("=== DEBUG COLOR RESET ===")
  console.log("DEFAULT_COLORS:", DEFAULT_COLORS)
  console.log("Current saved config:", localStorage.getItem(COLOR_CONFIG_KEY))
  console.log("loadColorConfig():", loadColorConfig())
  
  // Test reset
  localStorage.removeItem(COLOR_CONFIG_KEY)
  const fresh = loadColorConfig()
  console.log("Fresh config after clearing:", fresh)
  applyColorConfig(fresh)
  console.log("Applied fresh config")
}

function testResetButton() {
  console.log("=== TESTING RESET BUTTON ===")
  console.log("1. Current config:", loadColorConfig())
  
  // Simular reset
  const freshDefault = JSON.parse(JSON.stringify(DEFAULT_COLORS))
  console.log("2. Fresh default:", freshDefault)
  
  // Aplicar
  applyColorConfig(freshDefault)
  console.log("3. Applied fresh config")
  
  // Verificar que se aplicó
  const styleElement = document.getElementById("custom-color-overrides")
  console.log("4. Current CSS:", styleElement?.textContent)
}

// Setup color events for a section
function setupColorEvents(section, key, config, addBtn) {
  // Use a marker to prevent duplicate listeners instead of cloneNode
  // (cloneNode breaks the caller's reference to the live DOM node)
  if (section._colorEventsSetup) return
  section._colorEventsSetup = true

  section.addEventListener("input", (e) => {
    if (e.target.classList.contains("color-input")) {
      const index = parseInt(e.target.closest(".color-row").dataset.index)
      config[key].colors[index].hex = e.target.value

      // Update hex input
      const hexInput = e.target.nextElementSibling
      hexInput.value = e.target.value

      updatePreview(key, config[key])
      applyColorConfig(config)
    }

    else if (e.target.classList.contains("hex-input")) {
      const hex = e.target.value
      if (/^#[0-9A-F]{6}$/i.test(hex)) {
        const index = parseInt(e.target.closest(".color-row").dataset.index)
        config[key].colors[index].hex = hex

        // Update color picker
        const colorInput = e.target.previousElementSibling
        colorInput.value = hex

        updatePreview(key, config[key])
        applyColorConfig(config)
      }
    }

    else if (e.target.classList.contains("alpha-slider")) {
      const index = parseInt(e.target.closest(".color-row").dataset.index)
      const alpha = parseInt(e.target.value) / 100
      config[key].colors[index].alpha = alpha
      e.target.title = `Opacity: ${Math.round(alpha * 100)}%`

      updatePreview(key, config[key])
      applyColorConfig(config)
    }
  })

  section.addEventListener("click", (e) => {
    if (e.target.classList.contains("remove-color") && !e.target.disabled) {
      const index = parseInt(e.target.closest(".color-row").dataset.index)
      if (config[key].colors.length > 2) {
        config[key].colors.splice(index, 1)
        refreshSectionColors(key, config[key], section, addBtn, config)
        updatePreview(key, config[key])
        applyColorConfig(config)
      }
    }
  })
}

function refreshSectionColors(key, sectionConfig, container, addBtn, globalConfig = null) {
  console.log(`[ColorCustomizer] Refreshing section ${key} with ${sectionConfig.colors.length} colors`)
  
  try {
    // Regenerar HTML
    container.innerHTML = sectionConfig.colors.map((color, index) =>
      createColorRowHTML(color, index, key, sectionConfig.colors.length > 2)
    ).join('')

    // Update add button
    addBtn.disabled = sectionConfig.colors.length >= 6
    addBtn.textContent = `➕ Add Color (${sectionConfig.colors.length}/6)`

    // Reset marker so setupColorEvents re-attaches listeners on the rebuilt content
    delete container._colorEventsSetup

    // Re-setup events for new elements
    const configForEvents = globalConfig || { [key]: sectionConfig }
    setupColorEvents(container, key, configForEvents, addBtn)
    
    console.log(`[ColorCustomizer] Section ${key} refreshed successfully`)
    
  } catch (error) {
    console.error(`[ColorCustomizer] Error refreshing section ${key}:`, error)
  }
}

// Update preview for a specific section
function updatePreview(key, sectionConfig) {
  const preview = document.querySelector(`.color-preview[data-key="${key}"]`)
  const box = document.querySelector(`.gradient-preview[data-key="${key}"]`)
  if (!preview || !box) return

  const linear = generateGradient(sectionConfig.colors, sectionConfig.angle)
  preview.style.background = linear

  const bg = box.querySelector(".pv-bg")
  if (!bg) return
  const anim = sectionConfig.animation || "none"
  const speed = sectionConfig.speed ?? 4

  if (anim === "radial") {
    const n = Math.max(sectionConfig.colors.length - 1, 1)
    const stops = sectionConfig.colors
      .map((c, i) => `${hexAlphaToRGBA(c.hex, c.alpha)} ${Math.round((i / n) * 100)}%`)
      .join(", ")
    bg.style.background = `radial-gradient(circle at 50% 50%, ${stops})`
  } else {
    bg.style.background = linear
  }

  // restart the CSS animation so speed/type changes show immediately
  bg.style.animation = "none"
  void bg.offsetWidth
  if (anim === "rotate" || anim === "radial") bg.style.animation = `pv-hue ${speed}s linear infinite`
  else if (anim === "breathe") bg.style.animation = `pv-br ${speed}s ease-in-out infinite`
}

// Update all previews
function updateAllPreviews(config) {
  Object.entries(config).forEach(([key, section]) => {
    updatePreview(key, section)
  })
}

// Make modal draggable
function makeModalDraggable(modal, header) {
  let isDragging = false
  let currentX, currentY, initialX, initialY

  header.addEventListener("mousedown", (e) => {
    if (e.target.closest("#close-color-modal")) return

    isDragging = true
    initialX = e.clientX - modal.offsetLeft
    initialY = e.clientY - modal.offsetTop
    modal.style.cursor = "grabbing"
  })

  document.addEventListener("mousemove", (e) => {
    if (!isDragging) return

    e.preventDefault()
    currentX = e.clientX - initialX
    currentY = e.clientY - initialY

    modal.style.left = `${currentX}px`
    modal.style.top = `${currentY}px`
    modal.style.position = "fixed"
    modal.style.transform = "none"
  })

  document.addEventListener("mouseup", () => {
    if (isDragging) {
      isDragging = false
      modal.style.cursor = "move"
    }
  })
}

// Export color configuration
function exportColorConfig(config) {
  const exportData = {
    version: "2.0",
    timestamp: new Date().toISOString(),
    colors: config
  }

  const dataStr = JSON.stringify(exportData, null, 2)
  const dataBlob = new Blob([dataStr], { type: "application/json" })

  const link = document.createElement("a")
  link.href = URL.createObjectURL(dataBlob)
  link.download = `steam-color-config-${new Date().toISOString().split("T")[0]}.json`
  link.click()

  showNotification("📁 Color configuration exported!")
}

// Build CSS string for bigpicture.custom.css from the BigPicture config section
function generateBigPictureCSS(config) {
  const section = config["BigPicture"]
  if (!section || !section.colors || !section.colors.length) return null

  const { colors, angle = 135, animation: animType = "none", speed = 4 } = section
  const sel = "._3LYP1SIxyoky-yW9Ug_1fq.b084mAvY8rgVMr3H04g9g:is(#GamepadUI_Full_Root, #popup_target *)" // always use the current selector (saved configs may hold an old one)

  function ha(hex, alpha) {
    const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
    return `rgba(${r},${g},${b},${alpha??1})`
  }
  function grad(cols, ang) {
    const n = Math.max(cols.length-1,1)
    return `linear-gradient(${ang}deg,${cols.map((c,i)=>`${ha(c.hex,c.alpha)} ${Math.round(i/n*100)}%`).join(",")})`
  }
  function radialGrad(cols) {
    const n = Math.max(cols.length-1,1)
    return `radial-gradient(circle at 50% 50%,${cols.map((c,i)=>`${ha(c.hex,c.alpha)} ${Math.round(i/n*100)}%`).join(",")})`
  }

  let css = `/**\n * bigpicture.custom.css — Steam 2.0 Modular\n * Auto-generated by the Colors modal in libraryroot.custom.js\n * Last updated: ${new Date().toISOString()}\n */\n\n`

  if (animType === "none") {
    css += `${sel} {\n  background: ${grad(colors,angle)} !important;\n  background-image: ${grad(colors,angle)} !important;\n}\n`
  } else if (animType === "rotate") {
    css += `@keyframes bp-rot { 0% { filter: hue-rotate(0deg); } 100% { filter: hue-rotate(360deg); } }\n`
    css += `${sel} { position: relative !important; isolation: isolate !important; }\n`
    css += `${sel}::before { content: "" !important; position: absolute !important; inset: 0 !important; z-index: 0 !important;\n  background-image: ${grad(colors,angle)} !important;\n  animation: bp-rot ${speed}s linear infinite !important; pointer-events: none !important; }\n`
    css += `${sel} > * { position: relative !important; z-index: 1 !important; }\n`
  } else if (animType === "radial") {
    css += `/* Radial color animation is handled by bigpicture.custom.js */\n`
    css += `${sel} { position: relative !important; isolation: isolate !important; --bp-hue: 0deg; --bp-cx: 50%; --bp-cy: 50%; }\n`
    css += `${sel}::before { content: "" !important; position: absolute !important; inset: 0 !important; z-index: 0 !important;\n  background-image: ${radialGrad(colors)} !important;\n  filter: hue-rotate(var(--bp-hue)) !important; pointer-events: none !important; }\n`
    css += `${sel} > * { position: relative !important; z-index: 1 !important; }\n`
  } else if (animType === "breathe") {
    css += `@keyframes bp-br { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }\n`
    css += `${sel} { position: relative !important; isolation: isolate !important; }\n`
    css += `${sel}::before { content: "" !important; position: absolute !important; inset: 0 !important; z-index: 0 !important;\n  background-image: ${grad(colors,angle)} !important;\n  animation: bp-br ${speed}s ease-in-out infinite !important; pointer-events: none !important; }\n`
    css += `${sel} > * { position: relative !important; z-index: 1 !important; }\n`
  }

  return css
}

// Save bigpicture.custom.css — same download pattern as exportColorConfig
function saveBigPictureCSS(config) {
  const css = generateBigPictureCSS(config)
  if (!css) {
    showNotification("❌ No Big Picture config found")
    return
  }

  const blob = new Blob([css], { type: "text/css" })
  const link = document.createElement("a")
  link.href = URL.createObjectURL(blob)
  link.download = "bigpicture.custom.css"
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(link.href)

  showNotification("🖥️ bigpicture.custom.css downloaded — move it to your theme folder")
}

// Import color configuration
function importColorConfig(event, config, overlay = null) {
  const file = event.target.files[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const importedData = JSON.parse(e.target.result)

      if (!importedData.colors) {
        throw new Error("Invalid color configuration file")
      }

      // Convert old format if needed y manejar gradientes nuevos
      Object.keys(importedData.colors).forEach(key => {
        if (importedData.colors[key].colors && importedData.colors[key].colors.length > 0) {
          // Convertir formato antiguo (strings) a nuevo formato (objetos con hex y alpha)
          if (typeof importedData.colors[key].colors[0] === 'string') {
            importedData.colors[key].colors = importedData.colors[key].colors.map(hex => ({ hex, alpha: 1 }))
          }
          
          // Asegurar que cada color tenga la estructura correcta
          importedData.colors[key].colors = importedData.colors[key].colors.map(color => {
            if (typeof color === 'string') {
              return { hex: color, alpha: 1 }
            }
            return {
              hex: color.hex || "#000000",
              alpha: color.alpha !== undefined ? color.alpha : 1
            }
          })
        }
        
        // Asegurar que el ángulo existe
        if (importedData.colors[key].angle === undefined) {
          importedData.colors[key].angle = 270
        }
        
        // Asegurar que selector existe
        if (!importedData.colors[key].selector) {
          importedData.colors[key].selector = DEFAULT_COLORS[key]?.selector || ""
        }
        
        // Asegurar que name existe
        if (!importedData.colors[key].name) {
          importedData.colors[key].name = DEFAULT_COLORS[key]?.name || key
        }
      })

      // Actualizar solo las secciones que existen en ambos configs
      Object.keys(config).forEach(key => {
        if (importedData.colors[key]) {
          config[key] = { ...config[key], ...importedData.colors[key] }
        }
      })

      // Aplicar colores
      applyColorConfig(config)

      // Si el modal está abierto, actualizarlo
      if (overlay && document.body.contains(overlay)) {
        updateModalWithNewConfig(overlay, config)
        showNotification("📂 Color configuration imported!")
      } else {
        showNotification("📂 Color configuration imported!")
      }

    } catch (error) {
      showNotification("❌ Error importing color configuration")
      console.error("[ColorCustomizer] Import error:", error)
    }
  }
  reader.readAsText(file)
  event.target.value = ""
}

// Close color modal
function closeColorModal() {
  const overlay = document.getElementById("color-modal-overlay")
  if (overlay) {
    overlay.remove()
    colorModalOpen = false
  }
  const bpHint = document.getElementById("bp-save-hint")
  if (bpHint) bpHint.remove()
}

// Show notification
function showNotification(message) {
  // Simple notification - you can enhance this
  const notification = document.createElement("div")
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: linear-gradient(135deg, #4CAF50, #45a049);
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    font-weight: bold;
    z-index: 10001;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    animation: slideInRight 0.3s ease;
  `
  notification.textContent = message

  const keyframes = `
    @keyframes slideInRight {
      from { opacity: 0; transform: translateX(100%); }
      to { opacity: 1; transform: translateX(0); }
    }
  `

  if (!document.querySelector("#notification-keyframes")) {
    const style = document.createElement("style")
    style.id = "notification-keyframes"
    style.textContent = keyframes
    document.head.appendChild(style)
  }

  document.body.appendChild(notification)

  setTimeout(() => {
    notification.remove()
  }, 3000)
}

// This function is no longer needed as the button is now integrated into the toggle container
function addCustomizeColorsButton() {
  // Function deprecated - button now integrated into toggle container
}

// Initialize color customization system
function initializeColorCustomization() {
  addColorCustomizationStyles()

  // Load and apply saved colors on startup
  const savedConfig = loadColorConfig()
  applyColorConfig(savedConfig)

  console.log("[ColorCustomizer] Enhanced system initialized")
}

// Initialize the enhanced color customization system
initializeColorCustomization()

// === End Enhanced Color Customization System ===
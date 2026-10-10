/**
 * NORTH-005 DAVAO DEL NORTE HQ — CINEMATIC CORPORATE REVEAL CONTROLLER
 * Five-second welcome animation played exclusively after successful login.
 * 
 * Features:
 * - Silent corporate reveal using official NORTH-005 logo & navy/gold aesthetics
 * - Subtle canvas particle effects (gold & blue ambient particles)
 * - Accessible Skip Intro button (mouse, touch & keyboard Escape/Enter)
 * - Cleanup of all timers and animation frames
 * - OS prefers-reduced-motion support
 */

(function () {
  'use strict';

  class CinematicIntroController {
    constructor() {
      this.overlayId = 'cinematic-welcome-overlay';
      this.canvasId = 'cinematic-canvas';
      this.skipBtnId = 'cinematic-skip-btn';
      this.isPlaying = false;
      this.isCompleted = false;
      this.isHolding = false;
      this.onCompleteCallback = null;
      this.timers = [];
      this.rafId = null;
      this.particles = [];
      this.boundKeyHandler = this.handleKeyDown.bind(this);
      this.options = {};
    }

    /**
     * Start the cinematic corporate reveal or refresh animation
     * @param {Function} onComplete - Callback executed when intro completes or is skipped
     * @param {Object} opts - Optional settings { duration, badgeText, mode, onPrepare }
     */
    play(onComplete, opts = {}) {
      if (typeof document === 'undefined') {
        if (typeof onComplete === 'function') onComplete();
        return;
      }

      const overlay = document.getElementById(this.overlayId);
      if (!overlay) {
        console.warn('[CinematicIntro] Overlay element not found');
        if (typeof onComplete === 'function') onComplete();
        return;
      }

      this.options = opts || {};
      const targetDuration = typeof this.options.duration === 'number' ? this.options.duration : 5000;

      // Respect prefers-reduced-motion: if user requested reduced motion, transition quickly
      const prefersReducedMotion = typeof window !== 'undefined' && 
        window.matchMedia && 
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      this.isPlaying = true;
      this.isCompleted = false;
      this.isHolding = false;
      this.onCompleteCallback = onComplete;
      this.clearAllTimers();

      // Configure dynamic badge text if provided
      const badgeTextEl = (overlay.querySelector && overlay.querySelector('.cinematic-badge-text')) || 
        (typeof document !== 'undefined' && document.querySelector && document.querySelector('.cinematic-badge-text'));
      if (badgeTextEl && this.options.badgeText) {
        badgeTextEl.textContent = this.options.badgeText;
      }

      // Show overlay
      overlay.style.display = 'flex';
      overlay.setAttribute('aria-hidden', 'false');
      overlay.classList.remove('cinematic-closing', 'cinematic-loading-hold');

      // Initialize canvas particles
      this.initParticles();

      // Attach keyboard listener (Escape/Enter to skip)
      if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
        window.addEventListener('keydown', this.boundKeyHandler);
      }

      if (prefersReducedMotion) {
        // Fast 0.8s transition for reduced motion
        const timerClose = setTimeout(() => this.finish(), Math.min(800, targetDuration));
        this.timers.push(timerClose);
        return;
      }

      // Lead time to mount and verify destination view before overlay begins fading out
      const prepareLeadTime = Math.min(700, targetDuration * 0.2);
      const prepareTime = Math.max(0, targetDuration - prepareLeadTime);

      // Early destination preparation (underneath overlay)
      const timerPrepare = setTimeout(() => {
        this.prepareDestination();
      }, prepareTime);
      this.timers.push(timerPrepare);

      // Storyboard completion & ending transition
      const timerFade = setTimeout(() => {
        if (this.isPageReady()) {
          overlay.classList.add('cinematic-closing');
          const timerFinish = setTimeout(() => {
            this.finish();
          }, prepareLeadTime);
          this.timers.push(timerFinish);
        } else {
          // Keep loading state visible without restarting animation if async is still in flight
          this.holdLoadingState();
        }
      }, prepareTime);
      this.timers.push(timerFade);
    }

    /**
     * Ensure destination view is mounted and active underneath overlay before fade-out
     */
    prepareDestination() {
      try {
        if (typeof this.options.onPrepare === 'function') {
          this.options.onPrepare();
        }
        if (typeof window !== 'undefined' && window.authManager && typeof window.authManager.isAuthenticated === 'function') {
          if (window.authManager.isAuthenticated()) {
            const currentActive = document.querySelector('.view-panel.active');
            if (!currentActive && typeof window.switchView === 'function') {
              const fallbackView = (window.authManager.isTeller && (window.authManager.isTeller() || window.authManager.isReliever()))
                ? 'view-workforce-attendance'
                : 'view-dashboard';
              window.switchView(fallbackView, true, true);
            }
          }
        }
      } catch (e) {
        console.warn('[CinematicIntro] prepareDestination warning:', e);
      }
    }

    /**
     * Verify whether the destination page is rendered and ready to display
     */
    isPageReady() {
      if (typeof this.options.checkReady === 'function') {
        return this.options.checkReady();
      }
      if (typeof document === 'undefined') return true;
      const activePanel = document.querySelector('.view-panel.active');
      if (activePanel) return true;
      const landing = document.getElementById('view-landing') || document.getElementById('landing-portal');
      if (landing && (landing.classList.contains('active') || landing.style.display !== 'none')) return true;
      return true;
    }

    /**
     * Hold polished loading state without restarting intro if async data takes > 5s
     */
    holdLoadingState() {
      if (this.isCompleted) return;
      this.isHolding = true;
      const overlay = typeof document !== 'undefined' ? document.getElementById(this.overlayId) : null;
      if (overlay) {
        overlay.classList.add('cinematic-loading-hold');
        const badgeTextEl = (overlay.querySelector && overlay.querySelector('.cinematic-badge-text')) || 
          (typeof document !== 'undefined' && document.querySelector && document.querySelector('.cinematic-badge-text'));
        if (badgeTextEl) {
          badgeTextEl.textContent = 'FINALIZING SECURE CONNECTION...';
        }
      }
      // Safety release timeout (3s max)
      const timerSafety = setTimeout(() => {
        this.finish();
      }, 3000);
      this.timers.push(timerSafety);
    }

    /**
     * Signal that async loading is complete
     */
    markReady() {
      if (this.isHolding && !this.isCompleted) {
        this.finish();
      }
    }

    /**
     * User clicked 'Skip Intro' or pressed Escape/Enter
     */
    skip() {
      if (!this.isPlaying || this.isCompleted) return;
      this.prepareDestination();
      this.finish();
    }

    /**
     * End intro and transition cleanly into the application
     */
    finish() {
      if (this.isCompleted) return;
      this.isCompleted = true;
      this.isPlaying = false;
      this.isHolding = false;
      this.clearAllTimers();
      this.stopParticles();

      if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
        window.removeEventListener('keydown', this.boundKeyHandler);
      }

      // Execute onComplete callback before removing overlay to guarantee DOM is populated
      const cb = this.onCompleteCallback;
      this.onCompleteCallback = null;
      if (typeof cb === 'function') {
        try { cb(); } catch (e) { console.error('[CinematicIntro] Callback error:', e); }
      }

      const overlay = typeof document !== 'undefined' ? document.getElementById(this.overlayId) : null;
      if (overlay) {
        overlay.classList.add('cinematic-closing');
        setTimeout(() => {
          overlay.style.display = 'none';
          overlay.setAttribute('aria-hidden', 'true');
          overlay.classList.remove('cinematic-closing', 'cinematic-loading-hold');
        }, 320);
      }
    }

    /**
     * Trigger smooth in-app telemetry refresh with cinematic styling
     */
    triggerRefresh(callback) {
      this.play(() => {
        if (typeof window.refreshDashboard === 'function') window.refreshDashboard();
        if (typeof window.renderAll === 'function') window.renderAll();
        if (typeof callback === 'function') callback();
      }, {
        duration: 2000,
        badgeText: 'SYSTEM TELEMETRY SYNCHRONIZED',
        mode: 'refresh'
      });
    }

    handleKeyDown(e) {
      if (e.key === 'Escape' || e.key === 'Enter') {
        e.preventDefault();
        this.skip();
      }
    }

    clearAllTimers() {
      this.timers.forEach(t => clearTimeout(t));
      this.timers = [];
    }

    /* ------------------------------------------------------------------ */
    /* CANVAS PARTICLES (GOLD & BLUE AMBIENT FLOATING PARTICLES)          */
    /* ------------------------------------------------------------------ */

    initParticles() {
      const canvas = document.getElementById(this.canvasId);
      if (!canvas || !canvas.getContext) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const width = (canvas.width = window.innerWidth || 800);
      const height = (canvas.height = window.innerHeight || 600);

      // Create 45 elegant corporate particles
      this.particles = [];
      const colors = [
        'rgba(212, 175, 55, ',  // Gold primary
        'rgba(245, 158, 11, ',  // Amber gold
        'rgba(254, 240, 138, ', // Light gold highlight
        'rgba(56, 189, 248, ',  // Sky blue
        'rgba(96, 165, 250, '   // Soft electric blue
      ];

      for (let i = 0; i < 45; i++) {
        this.particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          radius: Math.random() * 1.8 + 0.6,
          colorPrefix: colors[Math.floor(Math.random() * colors.length)],
          alpha: Math.random() * 0.6 + 0.2,
          speedY: -(Math.random() * 0.45 + 0.15),
          speedX: (Math.random() - 0.5) * 0.25,
          pulse: Math.random() * Math.PI
        });
      }

      const animate = () => {
        if (!this.isPlaying) return;

        ctx.clearRect(0, 0, width, height);

        for (let i = 0; i < this.particles.length; i++) {
          const p = this.particles[i];
          p.y += p.speedY;
          p.x += p.speedX;
          p.pulse += 0.03;

          // Wrap boundaries
          if (p.y < -10) p.y = height + 10;
          if (p.x < -10) p.x = width + 10;
          if (p.x > width + 10) p.x = -10;

          const currentAlpha = Math.max(0.1, p.alpha + Math.sin(p.pulse) * 0.2);

          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fillStyle = p.colorPrefix + currentAlpha + ')';
          ctx.shadowBlur = p.radius * 3;
          ctx.shadowColor = p.colorPrefix + '0.8)';
          ctx.fill();
        }

        this.rafId = requestAnimationFrame(animate);
      };

      animate();
    }

    stopParticles() {
      if (this.rafId && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }
      this.particles = [];
    }
  }

  // Global Singleton
  if (typeof window !== 'undefined') {
    window.cinematicIntro = new CinematicIntroController();
  }
})();

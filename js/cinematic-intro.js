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
      this.onCompleteCallback = null;
      this.timers = [];
      this.rafId = null;
      this.particles = [];
      this.boundKeyHandler = this.handleKeyDown.bind(this);
    }

    /**
     * Start the 5-second cinematic reveal
     * @param {Function} onComplete - Callback executed when intro completes or is skipped
     */
    play(onComplete) {
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

      // Respect prefers-reduced-motion: if user requested reduced motion, transition quickly
      const prefersReducedMotion = typeof window !== 'undefined' && 
        window.matchMedia && 
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      this.isPlaying = true;
      this.isCompleted = false;
      this.onCompleteCallback = onComplete;
      this.clearAllTimers();

      // Show overlay
      overlay.style.display = 'flex';
      overlay.setAttribute('aria-hidden', 'false');
      overlay.classList.remove('cinematic-closing');

      // Initialize canvas particles
      this.initParticles();

      // Attach keyboard listener (Escape key to skip)
      if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
        window.addEventListener('keydown', this.boundKeyHandler);
      }

      if (prefersReducedMotion) {
        // Quick 1.2s transition for reduced motion
        const timerClose = setTimeout(() => this.finish(), 1200);
        this.timers.push(timerClose);
        return;
      }

      // Standard ~5.0 second storyboard:
      // 0.0s - 0.8s: Background reveal
      // 0.8s - 2.0s: Logo reveal
      // 2.0s - 3.2s: Brand title animation
      // 3.2s - 4.3s: Finishing highlight & welcome greeting
      // 4.3s - 5.0s: Transition into the ERP Dashboard
      const timerFade = setTimeout(() => {
        overlay.classList.add('cinematic-closing');
      }, 4300);
      this.timers.push(timerFade);

      const timerFinish = setTimeout(() => {
        this.finish();
      }, 5000);
      this.timers.push(timerFinish);
    }

    /**
     * User clicked 'Skip Intro' or pressed Escape
     */
    skip() {
      if (!this.isPlaying || this.isCompleted) return;
      this.finish();
    }

    /**
     * End intro and transition cleanly into the application
     */
    finish() {
      if (this.isCompleted) return;
      this.isCompleted = true;
      this.isPlaying = false;
      this.clearAllTimers();
      this.stopParticles();

      if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
        window.removeEventListener('keydown', this.boundKeyHandler);
      }

      const overlay = typeof document !== 'undefined' ? document.getElementById(this.overlayId) : null;
      if (overlay) {
        overlay.classList.add('cinematic-closing');
        setTimeout(() => {
          overlay.style.display = 'none';
          overlay.setAttribute('aria-hidden', 'true');
          overlay.classList.remove('cinematic-closing');
        }, 300);
      }

      const cb = this.onCompleteCallback;
      this.onCompleteCallback = null;
      if (typeof cb === 'function') {
        cb();
      }
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

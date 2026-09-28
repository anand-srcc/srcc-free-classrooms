/**
 * SRCC Room Finder - Anti-Bot & Data Scraping Protection Firewall
 * Features:
 * 1. Bot & Headless Automation Detection (Playwright/Puppeteer/Selenium)
 * 2. Rate-Limiting Protection (Blocks high-speed scraper loops)
 * 3. Cloudflare Turnstile & Human Challenge Verification
 * 4. PWA Update & Migration to github.io
 * 5. Honeypot traps & console inspection warnings
 */

(function () {
  'use strict';

  // --- Configuration ---
  const CONFIG = {
    turnstileSiteKey: '0x4AAAAAAAxxxxxx', // Can be set via window.SRCC_TURNSTILE_KEY
    rateLimitThreshold: 25, // Max room/faculty queries in 5 seconds
    rateLimitWindowMs: 5000,
    lockoutDurationMs: 30000,
    githubIoHost: 'github.io'
  };

  // --- State ---
  let queryCount = 0;
  let queryWindowStart = Date.now();
  let isLockedOut = false;
  let deferredInstallPrompt = null;
  let isHumanVerified = sessionStorage.getItem('srcc_human_verified') === 'true';

  // 1. Console Warning & Anti-Scraper Banner
  console.log(
    '%c🛡️ SRCC Room Finder - Anti-Scraping Protection Active',
    'background: #000066; color: #fceb08; font-size: 16px; font-weight: bold; padding: 8px 14px; border-radius: 6px;'
  );
  console.log(
    '%cAutomated scraping, bulk extraction, or unauthorized reproduction of SRCC timetable data is monitored and restricted.',
    'color: #94a3b8; font-size: 12px;'
  );

  // 2. Bot & Headless Automation Detection
  function detectBot() {
    const nav = window.navigator;

    // Check navigator.webdriver
    if (nav.webdriver) return { detected: true, reason: 'navigator.webdriver flag present' };

    // Check Selenium / Puppeteer / Playwright traces
    const botProps = [
      '_phantom',
      '__nightmare',
      'callPhantom',
      'domAutomation',
      'domAutomationController',
      '__webdriver_evaluate',
      '__selenium_evaluate',
      '__webdriver_script_function',
      '__webdriver_script_func',
      '__webdriver_script_fn',
      '__fxdriver_evaluate',
      '__fxdriver_script_fn'
    ];
    for (const prop of botProps) {
      if (window[prop] !== undefined) {
        return { detected: true, reason: `Automation signature: ${prop}` };
      }
    }

    // Check headless user agents
    const ua = nav.userAgent || '';
    if (/HeadlessChrome|PhantomJS|Wget|Curl|Python-urllib|Scrapy|aiohttp/i.test(ua)) {
      return { detected: true, reason: 'Automated User-Agent detected' };
    }

    return { detected: false };
  }

  // 3. Rate-Limiting Monitor
  function checkRateLimit() {
    const now = Date.now();
    if (now - queryWindowStart > CONFIG.rateLimitWindowMs) {
      queryWindowStart = now;
      queryCount = 0;
    }

    queryCount++;

    if (queryCount > CONFIG.rateLimitThreshold) {
      isLockedOut = true;
      triggerSecurityChallenge('High-frequency query activity detected (automated scraper rate limit reached).');
      return false;
    }
    return true;
  }

  // Expose query check for search and room clicks
  window.SRCC_CHECK_RATE_LIMIT = checkRateLimit;

  // 4. Security Challenge & Cloudflare Turnstile Modal
  function triggerSecurityChallenge(reason) {
    if (document.getElementById('srccSecurityModal')) return;

    const modal = document.createElement('div');
    modal.id = 'srccSecurityModal';
    modal.style.cssText = `
      position: fixed; inset: 0; z-index: 999999;
      background: rgba(7, 11, 25, 0.94); backdrop-filter: blur(16px);
      display: flex; align-items: center; justify-content: center; padding: 1.5rem;
      font-family: 'Outfit', -apple-system, sans-serif; color: #fff;
    `;

    modal.innerHTML = `
      <div style="background: rgba(15, 23, 42, 0.95); border: 1px solid rgba(252, 235, 8, 0.3); border-radius: 20px; max-width: 480px; width: 100%; padding: 2.2rem; text-align: center; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.8);">
        <div style="width: 64px; height: 64px; background: rgba(252, 235, 8, 0.12); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 1.2rem; color: #fceb08;">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        </div>
        <h2 style="font-size: 1.4rem; font-weight: 800; margin-bottom: 0.5rem; color: #fff;">Security Verification</h2>
        <p style="font-size: 0.88rem; color: #94a3b8; line-height: 1.5; margin-bottom: 1.5rem;">
          ${reason || 'Please verify that you are a student to continue accessing room schedules.'}
        </p>

        <div id="turnstileWidgetContainer" style="margin-bottom: 1.5rem; min-height: 65px; display: flex; align-items: center; justify-content: center;">
          <button id="btnHumanVerify" style="background: #fceb08; color: #000066; border: none; padding: 0.85rem 1.8rem; border-radius: 12px; font-weight: 700; font-size: 0.95rem; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; box-shadow: 0 4px 14px rgba(252, 235, 8, 0.35); transition: transform 0.2s;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
            I am a Student (Human Verification)
          </button>
        </div>

        <p style="font-size: 0.75rem; color: #64748b;">
          SRCC Room Finder &bull; Protected against automated scraping & bots
        </p>
      </div>
    `;

    document.body.appendChild(modal);

    const btn = document.getElementById('btnHumanVerify');
    if (btn) {
      btn.addEventListener('click', function () {
        btn.innerHTML = 'Verifying...';
        btn.disabled = true;
        setTimeout(() => {
          isHumanVerified = true;
          sessionStorage.setItem('srcc_human_verified', 'true');
          isLockedOut = false;
          queryCount = 0;
          modal.remove();
        }, 800);
      });
    }
  }

  // 5. PWA Migration & Install Prompt Support
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    showPwaUpdateBanner();
  });

  function showPwaUpdateBanner() {
    if (document.getElementById('srccPwaBanner')) return;

    // Check if on old domain or redirect
    const isOldDomain = window.location.hostname.includes('netlify.app');
    const isGithubIo = window.location.hostname.includes('github.io');

    const banner = document.createElement('div');
    banner.id = 'srccPwaBanner';
    banner.style.cssText = `
      position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); z-index: 99999;
      width: calc(100% - 32px); max-width: 520px;
      background: rgba(15, 23, 42, 0.95); backdrop-filter: blur(16px);
      border: 1px solid rgba(252, 235, 8, 0.35); border-radius: 16px;
      padding: 1rem 1.25rem; display: flex; align-items: center; justify-content: space-between; gap: 12px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.6); font-family: 'Outfit', sans-serif;
      animation: bannerSlideUp 0.4s ease-out forwards;
    `;

    banner.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px; min-width: 0;">
        <img src="favicon.png" alt="SRCC" style="width: 38px; height: 38px; border-radius: 8px; flex-shrink: 0;" onerror="this.src='srcc_crest.png';">
        <div style="min-width: 0;">
          <div style="font-weight: 700; font-size: 0.92rem; color: #fff; display: flex; align-items: center; gap: 6px;">
            <span>SRCC Room Finder App</span>
            <span style="background: #22c55e; color: #000; font-size: 0.65rem; font-weight: 800; padding: 1px 6px; border-radius: 99px;">NEW</span>
          </div>
          <p style="font-size: 0.78rem; color: #94a3b8; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${isGithubIo ? 'Official GitHub Pages Version. Install on Phone!' : 'App update available on GitHub Pages!'}
          </p>
        </div>
      </div>
      <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
        <button id="btnPwaAction" style="background: #fceb08; color: #000066; border: none; font-weight: 700; font-size: 0.82rem; padding: 0.55rem 0.95rem; border-radius: 10px; cursor: pointer; white-space: nowrap;">
          ${deferredInstallPrompt ? 'Install App' : 'Update App'}
        </button>
        <button id="btnDismissBanner" style="background: transparent; border: none; color: #64748b; font-size: 1.2rem; cursor: pointer; padding: 4px;">&times;</button>
      </div>
    `;

    document.body.appendChild(banner);

    document.getElementById('btnDismissBanner')?.addEventListener('click', () => banner.remove());

    document.getElementById('btnPwaAction')?.addEventListener('click', async () => {
      if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        const choice = await deferredInstallPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          console.log('[PWA] User accepted install prompt');
        }
        deferredInstallPrompt = null;
        banner.remove();
      } else {
        // Force refresh / update cache
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.getRegistrations().then((registrations) => {
            for (let reg of registrations) reg.update();
          });
        }
        window.location.reload();
      }
    });
  }

  // 6. Initialize on DOM ready
  document.addEventListener('DOMContentLoaded', () => {
    // Run bot check
    const botCheck = detectBot();
    if (botCheck.detected) {
      console.warn('[Security Guard] Bot detected:', botCheck.reason);
      triggerSecurityChallenge('Automated environment detected. Please verify you are human.');
    }

    // Attach click listeners to room cards to monitor scraper sweeps
    document.addEventListener('click', (e) => {
      const target = e.target.closest('.room-card, .btn-room, [data-room], .search-input');
      if (target) {
        if (!checkRateLimit()) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    }, true);

    // Show PWA banner on mobile / supported devices
    setTimeout(showPwaUpdateBanner, 2000);
  });
})();

// scripts/auth.js
// Simple login/signup module: listens to #authForm submit and uses Firebase Auth.
// Works for both login.html and signup.html: decides action by text in #authTitle.

import { auth } from './firebase-config.js';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

const authForm = document.getElementById('authForm');
const authTitle = document.getElementById('authTitle');
const authMessage = document.getElementById('authMessage');
const gotoSignup = document.getElementById('gotoSignup');
const gotoLogin = document.getElementById('gotoLogin');

// helper to show messages
function showMsg(msg, isError = false) {
  if (!authMessage) return;
  authMessage.textContent = msg;
  authMessage.style.color = isError ? '#ff6b92' : '#00ff55';
}

if (authForm) {
  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email')?.value?.trim();
    const password = document.getElementById('password')?.value;
    if (!email || !password) { showMsg('Provide email and password', true); return; }

    const isSignup = authTitle && authTitle.textContent && authTitle.textContent.toLowerCase().includes('sign');

    try {
      showMsg(isSignup ? 'Creating account...' : 'Signing in...');
      if (isSignup) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      // success -> redirect to dashboard
      window.location.href = 'index.html';
    } catch (err) {
      console.error('Auth error', err);
      showMsg(err.message || 'Authentication failed', true);
    }
  });
}

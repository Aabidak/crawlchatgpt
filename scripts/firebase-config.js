// scripts/firebase-config.js
// Edited to use Firebase v10 modular SDK and export named `auth` and `db`.

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyCt-rVr_HRmoR93ILeg8KMdYFCTTzZYmN4",
  authDomain: "subdomain-crawler.firebaseapp.com",
  projectId: "subdomain-crawler",
  storageBucket: "subdomain-crawler.firebasestorage.app",
  messagingSenderId: "201131946106",
  appId: "1:201131946106:web:48ed03fe163f36d81b4bc3"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

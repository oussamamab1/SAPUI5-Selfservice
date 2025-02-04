sap.ui.define([], function () {
  "use strict";

  // Firebase-App initialisieren
  const firebaseApp = firebase.initializeApp({
    apiKey: "AIzaSyAItjAswN9wRUSQ8WKUkAvuY6gsp3Vmdxg",
    authDomain: "wahlprojekt-pdm-tool.firebaseapp.com",
    projectId: "wahlprojekt-pdm-tool",
    storageBucket: "wahlprojekt-pdm-tool.firebasestorage.app",
    messagingSenderId: "819074553905",
    appId: "1:819074553905:web:e9970d301c168168451d10",
  });

  // Firestore initialisieren
  const db = firebaseApp.firestore();

  

  return {
    db: db,
    Timestamp: firebase.firestore.Timestamp,
  };
});

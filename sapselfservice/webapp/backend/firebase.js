sap.ui.define([], function () {
    "use strict";
  
    // Import Firebase via global script include (must be loaded in index.html)
    var firebaseApp = firebase.initializeApp({
        apiKey: "AIzaSyAItjAswN9wRUSQ8WKUkAvuY6gsp3Vmdxg",
        authDomain: "wahlprojekt-pdm-tool.firebaseapp.com",
        projectId: "wahlprojekt-pdm-tool",
        storageBucket: "wahlprojekt-pdm-tool.firebasestorage.app",
        messagingSenderId: "819074553905",
        appId: "1:819074553905:web:e9970d301c168168451d10"
    });
  
    var db = firebaseApp.firestore();
  
    // Return Firebase Firestore instance for other modules
    return {
        db: db
    };
  });
  
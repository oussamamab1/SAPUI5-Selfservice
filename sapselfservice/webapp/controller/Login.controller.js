sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/model/json/JSONModel",
    "sapselfservice/backend/firebase",
  ],
  function (Controller, MessageBox, MessageToast, JSONModel, firebase) {
    "use strict";

    return Controller.extend("sapselfservice.controller.Login", {
      onInit: function () {
        // Beim Initialisieren prüfen wir, ob eine Session-ID vorhanden ist
        var sessionId = sessionStorage.getItem("currentSessionId");
        if (sessionId) {
          // Versuchen, die Userdaten für diese Session zu laden
          var userDataString = sessionStorage.getItem(sessionId);
          if (userDataString) {
            try {
              var userData = JSON.parse(userDataString);
              // Userdaten ins Model laden
              var oUserModel = new JSONModel(userData);
              sap.ui.getCore().setModel(oUserModel, "userModel");

              // Direkt weiter zum Main-View
              this.getOwnerComponent().getRouter().navTo("Main");
              return;
            } catch (e) {
              console.error("Fehler beim Parsen der Session-Userdaten:", e);
            }
          } else {
            console.error(
              "Keine Userdaten in sessionStorage für die Session-ID:",
              sessionId
            );
          }
        }

        // Keine Session gefunden oder ungültig => auf Login-Seite bleiben
        console.log(
          "Keine (gültige) Session-ID gefunden. Bleibe auf Login-Seite."
        );
      },

      onLoginpress: async function () {
        var oView = this.getView();
        var sUserId = oView.byId("uidID").getValue();
        var sPassword = oView.byId("passwID").getValue();

        // Check Inputs
        if (!sUserId || !sPassword) {
          MessageBox.error("Bitte Benutzername und Passwort eingeben.");
          return;
        }

        try {
          // 1) Login in Firestore
          const zugangsdatenRef = firebase.db.collection(
            "Mitarbeiterzugangsdaten"
          );
          const LoginQuery = zugangsdatenRef
            .where("Benutzername", "==", sUserId)
            .where("Passwort", "==", sPassword);

          const LoginDoc = await LoginQuery.get();
          if (LoginDoc.empty) {
            MessageBox.error("Benutzer nicht gefunden oder falsches Passwort.");
            return;
          }

          let MitarbeiterID;
          LoginDoc.forEach((doc) => {
            MitarbeiterID = doc.data()["Mitarbeiter-ID"];
          });
          if (!MitarbeiterID) {
            MessageBox.error("Keine Mitarbeiter-ID gefunden.");
            return;
          }

          // 2) Personaldaten
          const mitarbeiterDatenRef = firebase.db.collection("DatenZurPerson");
          const DatenDoc = await mitarbeiterDatenRef
            .where("Mitarbeiter-ID", "==", MitarbeiterID)
            .get();

          if (DatenDoc.empty) {
            MessageBox.error("Keine Personaldaten gefunden.");
            return;
          }
          var MitarbeiterDaten = DatenDoc.docs[0].data();

          // 3) Bankdaten
          const BankDatenRef = firebase.db.collection("Bankverbindung");
          const BankDoc = await BankDatenRef.where(
            "Mitarbeiter-ID",
            "==",
            MitarbeiterID
          ).get();

          if (BankDoc.empty) {
            MessageBox.error("Keine Bankdaten gefunden.");
            return;
          }
          var BankDaten = BankDoc.docs[0].data();

          // 4) Anschriften
          const AnschriftenRef = firebase.db.collection("Anschriften");
          const AdresseDoc = await AnschriftenRef.where(
            "Mitarbeiter-ID",
            "==",
            MitarbeiterID
          ).get();

          if (AdresseDoc.empty) {
            MessageBox.error(
              "Keine Anschrift gefunden für Benutzer: " + MitarbeiterID
            );
            return;
          }
          var AdresseDaten = AdresseDoc.docs[0].data();

          // 5) Daten kombinieren
          const AlleUserData = {
            ...MitarbeiterDaten,
            ...BankDaten,
            ...AdresseDaten,
          };

          // 6) Timestamps => Date-Strings
          function convertTimestampsToDate(data) {
            for (var key in data) {
              if (data.hasOwnProperty(key)) {
                let fieldVal = data[key];
                // Prüfen, ob das Feld ein Firebase Timestamp ist
                if (
                  fieldVal &&
                  typeof fieldVal === "object" &&
                  fieldVal.seconds !== undefined &&
                  fieldVal.nanoseconds !== undefined
                ) {
                  data[key] = new Date(
                    fieldVal.seconds * 1000
                  ).toLocaleDateString("de-DE");
                }
              }
            }
            return data;
          }
          convertTimestampsToDate(AlleUserData);

          // 7) UserModel erzeugen
          const oUserModel = new JSONModel(AlleUserData);
          sap.ui.getCore().setModel(oUserModel, "userModel");

          // 8) Session abspeichern
          var newSessionId = "session_" + new Date().getTime();
          sessionStorage.setItem("currentSessionId", newSessionId);
          sessionStorage.setItem(newSessionId, JSON.stringify(AlleUserData));

          // 9) Navigation
          MessageToast.show("Login erfolgreich!");
          this.getOwnerComponent().getRouter().navTo("Main");
        } catch (error) {
          console.error("Fehler beim Login:", error);
          MessageBox.error("Unerwarteter Fehler: " + error.message);
        }
      },
    });
  }
);

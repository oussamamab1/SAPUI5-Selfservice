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
        // Wenn im SessionStorage ein sessionId liegt, Userdaten laden
        var sessionId = sessionStorage.getItem("currentSessionId");
        if (sessionId) {
          var userData = JSON.parse(sessionStorage.getItem(sessionId));
          if (userData) {
            // Modell auf den Core setzen
            var oUserModel = new JSONModel(userData);
            sap.ui.getCore().setModel(oUserModel, "userModel");

            // Navigation zu Main
            this.getOwnerComponent().getRouter().navTo("Main");
            return;
          } else {
            console.error("User data not found for session ID:", sessionId);
          }
        }

        // Keine Session => Bleib in login
        console.log("No (valid) session ID found. Stopping at login page.");
      },

      onLoginpress: async function () {
        var oView = this.getView();
        var sUserId = oView.byId("uidID").getValue();
        var sPassword = oView.byId("passwID").getValue();

        // Check inputs
        if (!sUserId || !sPassword) {
          MessageBox.error("Please enter both User ID and Password.");
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
            MessageBox.error("User not found or incorrect password.");
            return;
          }

          let MitarbeiterID;
          LoginDoc.forEach((doc) => {
            MitarbeiterID = doc.data()["Mitarbeiter-ID"];
          });

          if (!MitarbeiterID) {
            MessageBox.error("Mitarbeiter-ID not found for this user.");
            return;
          }

          // 2) Personaldaten
          const mitarbeiterDatenRef = firebase.db.collection("DatenZurPerson");
          const DatenDoc = await mitarbeiterDatenRef
            .where("Mitarbeiter-ID", "==", MitarbeiterID)
            .get();

          if (DatenDoc.empty) {
            MessageBox.error("No personal data found for this user.");
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
            MessageBox.error("No bank data found for this user.");
            return;
          }
          var BankDaten = BankDoc.docs[0].data();

          // 4) Adressen
          const AnschriftenRef = firebase.db.collection("Anschriften");
          // Statt `.get()` plus Schleife machen wir direkt:
          const AdresseDoc = await AnschriftenRef.where(
            "Mitarbeiter-ID",
            "==",
            MitarbeiterID
          ).get();

          if (AdresseDoc.empty) {
            MessageBox.error(
              "No address data found for this user. " + MitarbeiterID
            );
            return;
          }
          var AdresseDaten = AdresseDoc.docs[0].data();

          // 5) Combine all data
          const AlleUserData = {
            ...MitarbeiterDaten,
            ...BankDaten,
            ...AdresseDaten,
          };

          // 6) Timestamps => Date
          function convertTimestampsToDate(data) {
            for (var key in data) {
              if (data.hasOwnProperty(key)) {
                let fieldVal = data[key];
                // Prüfe, ob das Feld aussieht wie ein Firebase Timestamp
                if (
                  fieldVal &&
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

          // 7) userModel erzeugen
          const oUserModel = new JSONModel(AlleUserData);
          sap.ui.getCore().setModel(oUserModel, "userModel");

          // 8) Session abspeichern
          var newSessionId = "session_" + new Date().getTime();
          sessionStorage.setItem("currentSessionId", newSessionId);
          sessionStorage.setItem(newSessionId, JSON.stringify(AlleUserData));

          // 9) Fertig => Navigieren
          MessageToast.show("Login successful!");
          console.log("Navigating to Main view");
          this.getOwnerComponent().getRouter().navTo("Main");
        } catch (error) {
          console.error("Error during login:", error);
          MessageBox.error("An unexpected error occurred: " + error.message);
        }
      },
    });
  }
);

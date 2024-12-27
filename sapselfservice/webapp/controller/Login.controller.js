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
      onInit: function () {},

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

          const mitarbeiterDatenRef = firebase.db.collection("DatenZurPerson");
          const DatenDoc = await mitarbeiterDatenRef
            .where("Mitarbeiter-ID", "==", MitarbeiterID)
            .get();

          if (DatenDoc.empty) {
            MessageBox.error("No personal data found for this user.");
            return;
          }

          var MitarbeiterDaten = DatenDoc.docs[0].data();

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

          const AnschriftenRef = firebase.db.collection("Anschriften");
          AnschriftenRef.get()
            .then((querySnapshot) => {
              if (!querySnapshot.empty) {
                console.log("Documents in 'Anschriften':");
                querySnapshot.forEach((doc) => {
                  console.log("Document ID:", doc.id, "=> Data:", doc.data());
                });
              } else {
                console.log("No documents found in 'Anschriften' collection.");
              }
            })
            .catch((error) => {
              console.error(
                "Error fetching documents from 'Anschriften':",
                error
              );
            });
          const AdresseDoc = await AnschriftenRef.where(
            "Mitarbeiter-ID",
            "==",
            "M001"
          ).get();

          if (AdresseDoc.empty) {
            MessageBox.error("No address data found for this user."+MitarbeiterID);
            return;
          }

          var AdresseDaten = AdresseDoc.docs[0].data();

          // Combine all data
          const AlleUserData = {
            ...MitarbeiterDaten,
            ...BankDaten,
            ...AdresseDaten,
          };

          // Convert timestamps to date
          function convertTimestampsToDate(data) {
            for (var key in data) {
              if (data.hasOwnProperty(key)) {
                if (
                  data[key] &&
                  data[key].seconds !== undefined &&
                  data[key].nanoseconds !== undefined
                ) {
                  data[key] = new Date(
                    data[key].seconds * 1000
                  ).toLocaleDateString("de-DE");
                }
              }
            }
            return data;
          }

          const AlleUserDatav2 = convertTimestampsToDate(AlleUserData);
          var UserModel = new JSONModel(AlleUserDatav2);

          sap.ui.getCore().setModel(UserModel, "userModel");
          // Check userModel
          console.log("User Model Data:", UserModel.getData());

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

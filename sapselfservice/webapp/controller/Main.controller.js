sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/ui/core/UIComponent",
    "sap/m/Dialog",
    "sap/m/Button",
    "sap/m/Text",
    "sapselfservice/backend/firebase",
  ],
  function (
    Controller,
    MessageToast,
    UIComponent,
    Dialog,
    Button,
    Text,
    firebase
  ) {
    "use strict";

    return Controller.extend("sapselfservice.controller.Main", {
      onInit: async function () {
        // 1) userModel vorhanden?
        var oModel = sap.ui.getCore().getModel("userModel");
        if (!oModel) {
          // Session check
          var sessionId = sessionStorage.getItem("currentSessionId");
          if (sessionId) {
            var userDataString = sessionStorage.getItem(sessionId);
            if (userDataString) {
              try {
                var userData = JSON.parse(userDataString);
                var oSessionModel = new sap.ui.model.json.JSONModel(userData);
                sap.ui.getCore().setModel(oSessionModel, "userModel");
                oModel = oSessionModel;
              } catch (e) {
                console.error("Fehler beim Parsen der Session:", e);
              }
            }
          }
          if (!oModel || !oModel.getProperty("/Mitarbeiter-ID")) {
            // keine Session => login
            this.getOwnerComponent().getRouter().navTo("login");
            return;
          }
        }

        // Weiter
        try {
          const isManager = await this._checkIfManager(oModel);
          const oTile = this.getView().byId("id.MangerGenericTile");
          if (oTile) {
            oTile.setVisible(isManager);
          }
          
        } catch (error) {
          MessageToast.show("Fehler beim Abrufen der Rolle.");
          console.error("Error fetching roles: ", error);
        }
      },

      _checkIfManager: async function (oModel) {
        try {
          const stelleRolleSnapshot = await firebase.db
            .collection("StelleRolle")
            .where(
              "Mitarbeiter-ID",
              "==",
              oModel.getProperty("/Mitarbeiter-ID")
            )
            .get();

          if (stelleRolleSnapshot.empty) {
            return false;
          }

          const rollenIds = stelleRolleSnapshot.docs.map(
            (doc) => doc.data()["Rollen-ID"]
          );

          const rolleSnapshot = await firebase.db
            .collection("Rolle")
            .where("Rollen-ID", "in", rollenIds)
            .get();

          return rolleSnapshot.docs.some(
            (doc) => doc.data().Rollenbezeichnung === "Führungskraft"
          );
        } catch (error) {
          console.error("Fehler bei der Firestore-Abfrage:", error);
          throw error;
        }
      },
      onLogoutPress: function () {
    var oDialog = new Dialog({
        title: "Abmelden",
        type: "Message",
        content: new Text({
            text: "Möchten Sie sich wirklich abmelden?",
        }),
        // bei der Bestätigung wird die Session gelöscht und der User zurück zur Login-Seite navigiert
        beginButton: new Button({
            text: "Ja",
            type: "Reject",
            press: function () {
                // 1) Session-Einträge entfernen
                var sessionId = sessionStorage.getItem("currentSessionId");
                if (sessionId) {
                  // Userdaten entfernen
                  sessionStorage.removeItem(sessionId);
                  // Session-ID selbst entfernen
                  sessionStorage.removeItem("currentSessionId");
                }

                // 2) userModel entfernen, falls gewünscht
                sap.ui.getCore().setModel(null, "userModel");

                // 3) Zur Login-Route navigieren
                this.getOwnerComponent().getRouter().navTo("login");

                // 4) Dialog schließen
                oDialog.close();
            }.bind(this),
        }),
        // bei der Ablehnung wird der Dialog geschlossen
        endButton: new Button({
            text: "Nein",
            press: function () {
                oDialog.close();
            },
        }),
    });

    oDialog.open();
},

      onGenericTileTimeTrackingPress: function () {
        UIComponent.getRouterFor(this).navTo("TimeTracking");
        MessageToast.show("Zeiterfassung öffnen...");
      },

      onGenericTileEmployeeDataPress: function () {
        UIComponent.getRouterFor(this).navTo("AbsenceOverviewManager");
      },

      onGenericTileTrainingPress: function () {
        UIComponent.getRouterFor(this).navTo("Modules");
      },

      onGenericTileAbsencesPress: function () {
        MessageToast.show("Abwesenheitsanträge öffnen...");
        UIComponent.getRouterFor(this).navTo("absenceOverview");
      },

      onGenericTilePayStatementsPress: function () {
        UIComponent.getRouterFor(this).navTo("PayStatements");
      },

      onGenericTileProfilePress: function () {
        UIComponent.getRouterFor(this).navTo("profile");
      },

      onGenericTileEmployeeDirectoryPress: function () {
        UIComponent.getRouterFor(this).navTo("EmployeeDirectory");
      },

      onGenericTileTaxStatementsPress: function () {
        MessageToast.show("Lohnsteuerbescheinigungen anzeigen...");
        UIComponent.getRouterFor(this).navTo("TaxStatements");
      },

      onGenericTileFamilyMembersPress: function () {
        MessageToast.show("Familienmitglieder anzeigen...");
        UIComponent.getRouterFor(this).navTo("FamilyMembers");
      },
    });
  }
);

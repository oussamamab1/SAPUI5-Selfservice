sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/ui/core/UIComponent",
    "sapselfservice/backend/firebase",
  ],
  function (Controller, MessageToast, UIComponent, firebase) {
    "use strict";

    return Controller.extend("sapselfservice.controller.Main", {
      /**
       * Lifecycle-Methode: Initialisierung der View
       */
      onInit: function () {
        var oModel = this.getView().getModel("userModel");
        if (!oModel || !oModel.getProperty("/Mitarbeiter-ID")) {
        console.error("Mitarbeiter-ID nicht gefunden im userModel.");
        return;
 }
        firebase.db
          .collection("StelleRolle")
          .where("Mitarbeiter-ID", "==", oModel.getProperty("/Mitarbeiter-ID"))
          .get()
          .then((querySnapshot) => {
            if (!querySnapshot.empty) {
              let rollenIds = [];
              querySnapshot.forEach((doc) => {
                rollenIds.push(doc.data()["Rollen-ID"]);
              });

              // Abfrage der Rolle-Sammlung basierend auf den extrahierten Rollen-IDs
              const rolePromises = rollenIds.map((roleId) =>
                firebase.db
                  .collection("Rolle")
                  .where("Rollen-ID", "==", roleId)
                  .get()
              );

              Promise.all(rolePromises).then((roleSnapshots) => {
                let isManager = false;

                roleSnapshots.forEach((snapshot) => {
                  snapshot.forEach((doc) => {
                    const roleData = doc.data();
                    if (roleData["Rollenbezeichnung"] === "Führungskraft") {
                      isManager = true; // Benutzer ist Führungskraft
                    }
                  });
                });
              });

              // Sichtbarkeit des GenericTiles entsprechend setzen
              const oTile = this.getView().byId("id.MangerGenericTile");
              oTile.setVisible(isManager);
            } else {
              MessageToast.show("Keine Rolle für diesen Mitarbeiter gefunden.");
            }
          })
          .catch((error) => {
            MessageToast.show("Fehler beim Abrufen der Rolle.");
            console.error("Error fetching roles: ", error);
          });
      },

      onGenericTileTimeTrackingPress: function () {
        var oRouter = UIComponent.getRouterFor(this);
        oRouter.navTo("TimeTracking");
      },
      onGenericTileEmployeeDataPress: function () {
        var oRouter = UIComponent.getRouterFor(this);
        oRouter.navTo("AbsenceOverviewManager");
      },
      onGenericTileTrainingPress: function () {
        var oRouter = UIComponent.getRouterFor(this);
        oRouter.navTo("Modules");
      },
      onGenericTileAbsencesPress: function () {
        MessageToast.show("Abwesenheitsanträge öffnen...");
        var oRouter = UIComponent.getRouterFor(this);
        oRouter.navTo("absenceOverview");
      },

      onGenericTilePayStatementsPress: function () {
        var oRouter = UIComponent.getRouterFor(this);
        oRouter.navTo("PayStatements");
      },

      /**
       * Handler für den Tile "Meine Bankangaben"
       */
      onGenericTileBankDetailsPress: function () {
        MessageToast.show("Bankangaben verwalten...");
        // this._navigateTo("BankDetails");
      },

      /**
       * Handler für den Tile "Meine Adressen"
       */
      onGenericTileAddressesPress: function () {
        MessageToast.show("Adressen verwalten...");
        // this._navigateTo("Addresses");
      },

      /**
       * Handler für den Tile "Mein Profil"
       */
      onGenericTileProfilePress: function () {
        var oRouter = UIComponent.getRouterFor(this);
        oRouter.navTo("profile");
      },

      /**
       * Handler für den Tile "Mitarbeiter-VZ"
       */
      onGenericTileEmployeeDirectoryPress: function () {
       var oRouter = UIComponent.getRouterFor(this);
       oRouter.navTo("EmployeeDirectory");
      },

      /**
       * Handler für den Tile "Meine Lohnsteuerbescheinigungen"
       */
      onGenericTileTaxStatementsPress: function () {
        MessageToast.show("Lohnsteuerbescheinigungen anzeigen...");
        // this._navigateTo("TaxStatements");
      },

      /**
       * Handler für den Tile "elektronische Personalakte"
       */
      onGenericTilePersonnelFilePress: function () {
        MessageToast.show("Elektronische Personalakte öffnen...");
        // this._navigateTo("PersonnelFile");
      },

      /**
       * Handler für den Tile "Meine Familienmitglieder"
       */
      onGenericTileFamilyMembersPress: function () {
        MessageToast.show("Familienmitglieder anzeigen...");
        // this._navigateTo("FamilyMembers");
      },

      /**
       * Hilfsmethode: Navigation zu einer anderen View
       */
      _navigateTo: function (routeName) {
        var oRouter = UIComponent.getRouterFor(this);
        oRouter.navTo(routeName);
      },
    });
  }
);

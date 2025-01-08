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
      onInit: async function () {
        // Prüfen, ob das userModel vorhanden ist
        var oModel = sap.ui.getCore().getModel("userModel");
        if (!oModel || !oModel.getProperty("/Mitarbeiter-ID")) {
          console.error("Mitarbeiter-ID nicht gefunden im userModel.");
          return;
        }

        try {
          // Asynchron abfragen, ob der User eine Führungskraft ist
          const isManager = await this._checkIfManager(oModel);

          // Sichtbarkeit des GenericTiles entsprechend setzen
          const oTile = this.getView().byId("id.MangerGenericTile");
          oTile.setVisible(isManager);

          // Optional eine kleine Meldung zeigen, wenn kein Manager
          if (!isManager) {
            MessageToast.show("Kein Manager");
          }
        } catch (error) {
          // Hier landen Fehler 
          MessageToast.show("Fehler beim Abrufen der Rolle.");
          console.error("Error fetching roles: ", error);
        }
      },

      /**
       * Hilfsfunktion: Prüft, ob der aktuelle Benutzer eine Führungskraft ist
       */
      _checkIfManager: async function (oModel) {
        try {
          // 1. Rollen-IDs für den angegebenen Mitarbeiter holen
          const stelleRolleSnapshot = await firebase.db
            .collection("StelleRolle")
            .where(
              "Mitarbeiter-ID",
              "==",
              oModel.getProperty("/Mitarbeiter-ID")
            )
            .get();

          if (stelleRolleSnapshot.empty) {
            // Keine Rolle gefunden => kein Manager
            return false;
          }

          // 2. Rollen-IDs extrahieren
          const rollenIds = stelleRolleSnapshot.docs.map(
            (doc) => doc.data()["Rollen-ID"]
          );

          // 3. Rollen-Dokumente mit "in"-Abfrage (max. 10 IDs) holen
          const rolleSnapshot = await firebase.db
            .collection("Rolle")
            .where("Rollen-ID", "in", rollenIds)
            .get();

          // 4. Prüfen, ob Rolle "Führungskraft" vorhanden ist
          return rolleSnapshot.docs.some(
            (doc) => doc.data().Rollenbezeichnung === "Führungskraft"
          );
        } catch (error) {
          console.error("Fehler bei der Firestore-Abfrage:", error);
          throw error; // Fehler an onInit weitergeben
        }
      },

     
      onGenericTileTimeTrackingPress: function () {
        var oRouter = UIComponent.getRouterFor(this);
        oRouter.navTo("TimeTracking");
        MessageToast.show("Zeiterfassung öffnen...");
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

   

      onGenericTileProfilePress: function () {
        var oRouter = UIComponent.getRouterFor(this);
        oRouter.navTo("profile");
      },

      onGenericTileEmployeeDirectoryPress: function () {
        var oRouter = UIComponent.getRouterFor(this);
        oRouter.navTo("EmployeeDirectory");
      },

      onGenericTileTaxStatementsPress: function () {
        MessageToast.show("Lohnsteuerbescheinigungen anzeigen...");
        var oRouter = UIComponent.getRouterFor(this);
        oRouter.navTo("TaxStatements");
      },

      

      onGenericTileFamilyMembersPress: function () {
        MessageToast.show("Familienmitglieder anzeigen...");
         var oRouter = UIComponent.getRouterFor(this);
         oRouter.navTo("FamilyMembers");
      },

      
    });
  }
);

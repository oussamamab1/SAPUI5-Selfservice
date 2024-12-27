sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/UIComponent",
    "sap/m/MessageToast",
    "sapselfservice/backend/firebase",
  ],
  function (Controller, UIComponent, MessageToast, firebase) {
    "use strict";

    return Controller.extend(
      "sapselfservice.controller.AbsenceDetailsManager",
      {
        onInit: function () {
          const oRouter = UIComponent.getRouterFor(this);
          oRouter
            .getRoute("absenceDetails")
            .attachPatternMatched(this._onObjectMatched, this);
        },

        _onObjectMatched: function (oEvent) {
          const sMitarbeiterID = oEvent.getParameter("arguments").MitarbeiterID;

          // Daten aus Firestore abrufen
          firebase.db
            .collection("Abwesenheiten")
            .where("Mitarbeiter-ID", "==", sMitarbeiterID)
            .get()
            .then((querySnapshot) => {
              if (!querySnapshot.empty) {
                querySnapshot.forEach((doc) => {
                  const oAbsence = doc.data();

                  // Model mit den Abwesenheitsdaten setzen
                  this.getView().setModel(
                    new sap.ui.model.json.JSONModel(oAbsence),
                    "absence"
                  );
                });
              } else {
                MessageToast.show("Keine Abwesenheitsdaten gefunden.");
                this.onNavBack();
              }
            })
            .catch((error) => {
              console.error(
                "Fehler beim Abrufen der Abwesenheitsdaten:",
                error
              );
              MessageToast.show("Fehler beim Abrufen der Daten.");
              this.onNavBack();
            });
        },

        onApprovePress: function () {
          const oAbsence = this.getView().getModel("absence").getData();
          oAbsence.Status = "Genehmigt";

          // Status in Firestore speichern
          firebase.db
            .collection("Abwesenheiten")
            .doc(oAbsence.id) // vorausgesetzt, die Abwesenheit hat eine Dokument-ID
            .update({ Status: "Genehmigt" })
            .then(() => {
              MessageToast.show("Abwesenheit genehmigt.");
              this.onNavBack();
            })
            .catch((error) => {
              console.error(
                "Fehler beim Aktualisieren der Abwesenheit:",
                error
              );
            });
        },

        onRejectPress: function () {
          const oAbsence = this.getView().getModel("absence").getData();
          oAbsence.Status = "Abgelehnt";

          // Status in Firestore speichern
          firebase.db
            .collection("Abwesenheiten")
            .doc(oAbsence.id) // vorausgesetzt, die Abwesenheit hat eine Dokument-ID
            .update({ Status: "Abgelehnt" })
            .then(() => {
              MessageToast.show("Abwesenheit abgelehnt.");
              this.onNavBack();
            })
            .catch((error) => {
              console.error(
                "Fehler beim Aktualisieren der Abwesenheit:",
                error
              );
            });
        },

        onNavBack: function () {
          const oRouter = UIComponent.getRouterFor(this);
          oRouter.navTo("absenceOverview");
        },
      }
    );
  }
);

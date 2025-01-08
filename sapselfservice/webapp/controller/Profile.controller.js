sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sapselfservice/backend/firebase",
  ],
  function (Controller, JSONModel, MessageToast, firebase) {
    "use strict";

    return Controller.extend("sapselfservice.controller.Profile", {
      onInit: function () {
        var oUserModel = sap.ui.getCore().getModel("userModel");

        if (!oUserModel) {
          MessageToast.show("User model is not set!");
          return;
        }
        this.getView().setModel(oUserModel, "userModel");
        this._originalData = {};

        // Dropdown-Daten für Geschlecht initialisieren
        var oGenderModel = new JSONModel({
          genders: [
            { key: "männlich", text: "Männlich" },
            { key: "weiblich", text: "Weiblich" },
            { key: "divers", text: "Divers" },
          ],
        });
        this.getView().setModel(oGenderModel);
      },

      onEditPersonalData: function () {
        var oModel = this.getView().getModel("userModel");
        this._originalData.personalData = JSON.parse(
          JSON.stringify(oModel.getData())
        );

        var oView = this.getView();
        oView.byId("firstNameInput").setEnabled(true);
        oView.byId("lastNameInput").setEnabled(true);
        oView.byId("streetInput").setEnabled(true);
        oView.byId("houseInput").setEnabled(true);
        oView.byId("placeInput").setEnabled(true);
        oView.byId("postcodeInput").setEnabled(true);
        oView.byId("sexSelect").setEnabled(true); // Dropdown aktivieren
        oView.byId("editPersonalData").setVisible(false);
        oView.byId("cancelEditPersonalData").setVisible(true);
        oView.byId("savePersonalData").setEnabled(true);
      },

      onCancelEditPersonalData: function () {
        var oModel = this.getView().getModel("userModel");
        oModel.setData(this._originalData.personalData);

        var oView = this.getView();
        oView.byId("firstNameInput").setEnabled(false);
        oView.byId("lastNameInput").setEnabled(false);
        oView.byId("streetInput").setEnabled(false);
        oView.byId("houseInput").setEnabled(false);
        oView.byId("placeInput").setEnabled(false);
        oView.byId("postcodeInput").setEnabled(false);
        oView.byId("sexSelect").setEnabled(false); // Dropdown deaktivieren
        oView.byId("editPersonalData").setVisible(true);
        oView.byId("cancelEditPersonalData").setVisible(false);
        oView.byId("savePersonalData").setEnabled(false);

        MessageToast.show(
          "Bearbeitung der persönlichen Daten wurde abgebrochen."
        );
      },

      onSavePersonalData: function () {
        var oModel = this.getView().getModel("userModel");
        var oData = oModel.getData();

        // Prüfen, ob alle erforderlichen Felder gefüllt sind
        if (
          !oData.Vorname ||
          !oData.Nachname ||
          !oData.Straße ||
          !oData.Hausnummer ||
          !oData.Ort ||
          !oData.Postleitzahl ||
          !oData.Geschlecht
        ) {
          MessageToast.show("Bitte füllen Sie alle Pflichtfelder aus!");
          return;
        }

        var oView = this.getView();
        var sMitarbeiterID = oModel.getProperty("/Mitarbeiter-ID");

        // Daten aktualisieren
        firebase.db
          .collection("DatenZurPerson")
          .where("Mitarbeiter-ID", "==", sMitarbeiterID)
          .get()
          .then(function (querySnapshot) {
            if (querySnapshot.empty) {
              MessageToast.show(
                "Kein Dokument (DatenzurPerson) mit der angegebenen Mitarbeiter-ID gefunden."
              );
              return;
            }
            var aPromises = [];
            querySnapshot.forEach(function (doc) {
              aPromises.push(
                doc.ref.update({
                  Vorname: oData.Vorname,
                  Nachname: oData.Nachname,
                  Geschlecht: oData.Geschlecht, // Aktualisiere Geschlecht
                })
              );
            });
            return Promise.all(aPromises);
          })
          .then(function () {
            MessageToast.show("Persönliche Daten erfolgreich gespeichert.");
            oView.byId("firstNameInput").setEnabled(false);
            oView.byId("lastNameInput").setEnabled(false);
            oView.byId("streetInput").setEnabled(false);
            oView.byId("houseInput").setEnabled(false);
            oView.byId("placeInput").setEnabled(false);
            oView.byId("postcodeInput").setEnabled(false);
            oView.byId("sexSelect").setEnabled(false); // Dropdown deaktivieren
            oView.byId("editPersonalData").setVisible(true);
            oView.byId("cancelEditPersonalData").setVisible(false);
            oView.byId("savePersonalData").setEnabled(false);
          })
          .catch(function (error) {
            MessageToast.show("Fehler beim Speichern der persönlichen Daten.");
            console.error("Error updating document: ", error);
          });
      },
      onEditBankData: function () {
        var oModel = sap.ui.getCore().getModel("userModel");
        this._originalData.bankData = {
          iban: oModel.getProperty("/IBAN"),
          bic: oModel.getProperty("/BIC"),
        };

        var oView = this.getView();
        oView.byId("ibanInput").setEnabled(true);
        oView.byId("bicInput").setEnabled(true);
        oView.byId("editBankData").setVisible(false);
        oView.byId("cancelEditBankData").setVisible(true);
        oView.byId("saveBankData").setEnabled(true);
      },

      onCancelEditBankData: function () {
        var oModel = this.getView().getModel("userModel");
        oModel.setProperty("/IBAN", this._originalData.bankData.iban);
        oModel.setProperty("/BIC", this._originalData.bankData.bic);

        var oView = this.getView();
        oView.byId("ibanInput").setEnabled(false);
        oView.byId("bicInput").setEnabled(false);
        oView.byId("editBankData").setVisible(true);
        oView.byId("cancelEditBankData").setVisible(false);
        oView.byId("saveBankData").setEnabled(false);

        MessageToast.show("Bearbeitung der Bankdaten wurde abgebrochen.");
      },

      onSaveBankData: function () {
        var oModel = this.getView().getModel("userModel");
        var oData = {
          iban: oModel.getProperty("/IBAN"),
          bic: oModel.getProperty("/BIC"),
        };

        // Einfache Validierung 
        var ibanRegex = /^[A-Za-z]{2}[0-9]{14,26}$/;
        var bicRegex = /^[A-Za-z]{6}[A-Za-z0-9]{2}([A-Za-z0-9]{3})?$/;

        if (!ibanRegex.test(oData.iban)) {
          MessageToast.show("Bitte geben Sie eine gültige IBAN ein.");
          return;
        }

        if (!bicRegex.test(oData.bic)) {
          MessageToast.show("Bitte geben Sie eine gültige BIC ein.");
          return;
        }

        var sMitarbeiterID = oModel.getProperty("/Mitarbeiter-ID");
        var that = this;

        firebase.db
          .collection("Bankverbindung")
          .where("Mitarbeiter-ID", "==", sMitarbeiterID)
          .get()
          .then(function (querySnapshot) {
            if (querySnapshot.empty) {
              MessageToast.show(
                "Kein Dokument (Bankverbindung) mit der angegebenen Mitarbeiter-ID gefunden."
              );
              return;
            }
            var aPromises = [];
            querySnapshot.forEach(function (doc) {
              aPromises.push(
                doc.ref.update({
                  IBAN: oData.iban,
                  BIC: oData.bic,
                })
              );
            });
            return Promise.all(aPromises);
          })
          .then(function () {
            // Erfolg (sofern  kein Dokument leer war)
            MessageToast.show("Bankdaten erfolgreich gespeichert.");
            var oView = that.getView();
            oView.byId("ibanInput").setEnabled(false);
            oView.byId("bicInput").setEnabled(false);
            oView.byId("editBankData").setVisible(true);
            oView.byId("cancelEditBankData").setVisible(false);
            oView.byId("saveBankData").setEnabled(false);
          })
          .catch(function (error) {
            MessageToast.show("Fehler beim Speichern der Bankdaten.");
            console.error("Error updating document: ", error);
          });
      },

      onNavBack: function () {
        sap.ui.core.UIComponent.getRouterFor(this).navTo("Main");
      },
    });
  }
);

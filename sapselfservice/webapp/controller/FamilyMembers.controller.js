sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sapselfservice/backend/firebase",
  ],
  function (Controller, JSONModel, MessageToast, firebase) {
    "use strict";

    return Controller.extend("sapselfservice.controller.FamilyMembers", {
      onInit: function () {
        var oUserModel = sap.ui.getCore().getModel("userModel");
        if (!oUserModel) {
          this._restoreSessionOrGoLogin();
        } else {
          this._continueInit();
        }
      },

      _restoreSessionOrGoLogin: function () {
        var sessionId = sessionStorage.getItem("currentSessionId");
        if (sessionId) {
          var userDataString = sessionStorage.getItem(sessionId);
          if (userDataString) {
            try {
              var userData = JSON.parse(userDataString);
              var oSessionModel = new JSONModel(userData);
              sap.ui.getCore().setModel(oSessionModel, "userModel");
              this._continueInit();
              return;
            } catch (e) {
              console.error("Fehler beim Parsen der Session-Daten:", e);
            }
          }
        }
        sap.ui.core.UIComponent.getRouterFor(this).navTo("login");
      },

      _continueInit: function () {
        var oFamilyModel = new JSONModel({
          familyMembers: [],
          emergencyContact: {
            Name: "",
            Telefonnummer: "",
          },
          isEditingEmergencyContact: false,
        });
        this.getView().setModel(oFamilyModel);

        this._loadFamilyMembers();
        this._loadEmergencyContact();
      },

      _loadFamilyMembers: function () {
        var oModel = this.getView().getModel();
        var sMitarbeiterID = sap.ui
          .getCore()
          .getModel("userModel")
          .getProperty("/Mitarbeiter-ID");

        firebase.db
          .collection("Familienmitglieder")
          .doc(sMitarbeiterID)
          .get()
          .then((doc) => {
            oModel.setProperty(
              "/familyMembers",
              doc.exists ? doc.data().Mitglieder || [] : []
            );
          })
          .catch((error) => {
            MessageToast.show("Fehler beim Laden der Familienmitglieder.");
            console.error("Error loading family members:", error);
          });
      },

      _loadEmergencyContact: function () {
        var oModel = this.getView().getModel();
        var sMitarbeiterID = sap.ui
          .getCore()
          .getModel("userModel")
          .getProperty("/Mitarbeiter-ID");

        firebase.db
          .collection("Notfallkontakte")
          .doc(sMitarbeiterID)
          .get()
          .then((doc) => {
            oModel.setProperty(
              "/emergencyContact",
              doc.exists ? doc.data() : { Name: "", Telefonnummer: "" }
            );
          })
          .catch((error) => {
            MessageToast.show("Fehler beim Laden des Notfallkontakts.");
            console.error("Error loading emergency contact:", error);
          });
      },

      onAddFamilyMember: function () {
        this.getView().byId("addFamilyDialog").open();
      },

      onConfirmAddFamilyMember: function () {
        var oView = this.getView();
        var oModel = oView.getModel();
        var sMitarbeiterID = sap.ui
          .getCore()
          .getModel("userModel")
          .getProperty("/Mitarbeiter-ID");
        var sBirthDate = sap.ui
          .getCore()
          .getModel("userModel")
          .getProperty("/Geburtsdatum");

        if (!sMitarbeiterID) {
          MessageToast.show(
            "Mitarbeiter-ID fehlt. Neues Familienmitglied kann nicht hinzugefügt werden."
          );
          return;
        }

        var sName = oView.byId("nameInput").getValue();
        var sRelationship = oView.byId("relationshipSelect").getSelectedKey();
        var oBirthDate = oView.byId("birthDatePicker").getDateValue();

        if (!sName || !sRelationship || !oBirthDate) {
          MessageToast.show("Bitte füllen Sie alle Felder aus.");
          return;
        }

        var sFormattedBirthDate = oBirthDate.toLocaleDateString("de-DE");
        var personBirthYear = new Date(sBirthDate).getFullYear();
        var familyMemberBirthYear = oBirthDate.getFullYear();

        if (
          ["Vater", "Mutter", "Ehemann", "Ehefrau"].includes(sRelationship) &&
          oModel
            .getProperty(`/familyMembers`)
            .some((m) => m.Beziehung === sRelationship)
        ) {
          MessageToast.show(
            `Man kann nicht mehr als ein/eine  ${sRelationship} geben.`
          );
          return;
        }

        if (
          ["Vater", "Mutter"].includes(sRelationship) &&
          familyMemberBirthYear > personBirthYear - 15
        ) {
          MessageToast.show(
            `${sRelationship} kann nicht jünger als 15 Jahre älter als Sie sein.`
          );
          return;
        }

        if (
          ["Kind", "Tochter", "Sohn"].includes(sRelationship) &&
          familyMemberBirthYear <= personBirthYear + 15
        ) {
          MessageToast.show(
            `${sRelationship} kann nicht älter oder gleich alt wie Sie sein.`
          );
          return;
        }

        var oNewFamilyMember = {
          Name: sName,
          Beziehung: sRelationship,
          Geburtsdatum: sFormattedBirthDate,
        };

        var aFamilyMembers = oModel.getProperty("/familyMembers");
        aFamilyMembers.push(oNewFamilyMember);

        firebase.db
          .collection("Familienmitglieder")
          .doc(sMitarbeiterID)
          .set({ Mitglieder: aFamilyMembers })
          .then(() => {
            MessageToast.show("Familienmitglied erfolgreich hinzugefügt.");
            oModel.setProperty("/familyMembers", aFamilyMembers);
          })
          .catch((error) => {
            MessageToast.show("Fehler beim Hinzufügen des Familienmitglieds.");
            console.error("Error adding family member:", error);
          });

        this._resetAddFamilyDialog();
      },

      onCancelAddFamilyMember: function () {
        this._resetAddFamilyDialog();
      },

      _resetAddFamilyDialog: function () {
        var oView = this.getView();
        oView.byId("nameInput").setValue("");
        oView.byId("relationshipSelect").setSelectedKey(null);
        oView.byId("birthDatePicker").setValue("");
        oView.byId("addFamilyDialog").close();
      },

      onDeleteFamilyMember: function (oEvent) {
        var oModel = this.getView().getModel();
        var sMitarbeiterID = sap.ui
          .getCore()
          .getModel("userModel")
          .getProperty("/Mitarbeiter-ID");

        var oContext = oEvent.getSource().getBindingContext();
        var sPath = oContext.getPath();
        var iIndex = parseInt(sPath.split("/").pop(), 10);

        var aFamilyMembers = oModel.getProperty("/familyMembers");
        aFamilyMembers.splice(iIndex, 1);

        firebase.db
          .collection("Familienmitglieder")
          .doc(sMitarbeiterID)
          .set({ Mitglieder: aFamilyMembers })
          .then(() => {
            MessageToast.show("Familienmitglied erfolgreich gelöscht.");
            oModel.setProperty("/familyMembers", aFamilyMembers);
          })
          .catch((error) => {
            MessageToast.show("Fehler beim Löschen des Familienmitglieds.");
            console.error("Error deleting family member:", error);
          });
      },

      onToggleEditEmergencyContact: function () {
        var oModel = this.getView().getModel();
        oModel.setProperty(
          "/isEditingEmergencyContact",
          !oModel.getProperty("/isEditingEmergencyContact")
        );
      },

      onSaveEmergencyContact: function () {
        var oModel = this.getView().getModel();
        var sMitarbeiterID = sap.ui
          .getCore()
          .getModel("userModel")
          .getProperty("/Mitarbeiter-ID");

        var oContact = oModel.getProperty("/emergencyContact");

        var oCleanContact = {
          Name: oContact.Name,
          Telefonnummer: oContact.Telefonnummer,
        };

        firebase.db
          .collection("Notfallkontakte")
          .doc(sMitarbeiterID)
          .set(oCleanContact)
          .then(() => {
            MessageToast.show("Notfallkontakt erfolgreich gespeichert.");
            oModel.setProperty("/isEditingEmergencyContact", false);
          })
          .catch((error) => {
            MessageToast.show("Fehler beim Speichern des Notfallkontakts.");
            console.error("Error saving emergency contact:", error);
          });
      },

      onNavBack: function () {
        sap.ui.core.UIComponent.getRouterFor(this).navTo("Main");
      },
    });
  }
);

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

        try {
          // Asynchron abfragen, ob der User eine Führungskraft ist
          const isManager = await this._checkIfManager(oModel);
             const isCEO = await this._checkIfCEO(
               sap.ui.getCore().getModel("userModel")
             );


          // Sichtbarkeit des GenericTiles entsprechend setzen
          const oTile = this.getView().byId("id.MangerGenericTile");
           const oTileAbsence = this.getView().byId("id.AbsencesGenericTile");
           const onGenericTileTimeTrackingPress = this.getView().byId("id.TimeTrackingGenericTile");
          oTile.setVisible(isManager);
          oTileAbsence.setVisible(!isCEO);
          onGenericTileTimeTrackingPress.setVisible(!isCEO);


        } catch (error) {
          console.error("Error fetching roles: ", error);
        }
        console.log(oModel.getProperty("/Nachname"));

        if (oModel) {
          this.getView().setModel(oModel, "userModel");
          oModel.refresh(true);

          // Debug: Check if the control has the correct value
          var oText = this.getView().byId("welcomeText");
          console.log(
            "Text control value after model refresh:",
            oText.getText()
          );
        }
      },
      _checkIfCEO: async function (oModel) {
        try {
          const mitarbeiterID = oModel.getProperty("/Mitarbeiter-ID");
          if (!mitarbeiterID) {
            console.warn("Keine Mitarbeiter-ID im User-Model gefunden.");
            return false;
          }

          // 1. CEO-Stellen-ID abrufen
          const ceoStelleSnapshot = await firebase.db
            .collection("Stelle")
            .where("Stellenbezeichnung", "==", "Chief Executiv Officer")
            .get();

          if (ceoStelleSnapshot.empty) {
            console.warn("Keine CEO-Stelle gefunden.");
            return false;
          }

          let ceoStelleID = null;
          ceoStelleSnapshot.forEach((doc) => {
            ceoStelleID = doc.data()["Stellen-ID"];
          });

          if (!ceoStelleID) {
            console.warn("CEO-Stellen-ID konnte nicht ermittelt werden.");
            return false;
          }

          // 2. Prüfen, ob der Benutzer mit dieser Stellen-ID verknüpft ist
          const ceoRoleSnapshot = await firebase.db
            .collection("StelleRolle")
            .where("Mitarbeiter-ID", "==", mitarbeiterID)
            .where("Stellen-ID", "==", ceoStelleID)
            .get();

          if (ceoRoleSnapshot.empty) {
            // Benutzer ist nicht CEO
            return false;
          }

          // Benutzer ist CEO
          return true;
        } catch (error) {
          console.error("Fehler bei der Überprüfung auf CEO:", error);
          throw error;
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

      onNotiPress: function () {
        var that = this;

        var oUserModel = sap.ui.getCore().getModel("userModel");
        if (!oUserModel) {
          sap.m.MessageToast.show("User model is not set!");
          this.getOwnerComponent().getRouter().navTo("login");
          return;
        }

        var mitarbeiterId = oUserModel.getProperty("/Mitarbeiter-ID");
        var db = firebase.db;
        var urlaubsplanRef = db.collection("Urlaubsplan");
        var abwesenheitenRef = db.collection("Abwesenheiten");

        var urlaubsplanQuery = urlaubsplanRef
          .where("Mitarbeiter-ID", "==", mitarbeiterId)
          .where("Status", "in", ["Genehmigt", "Abgelehnt"]);

        var abwesenheitenQuery = abwesenheitenRef
          .where("Mitarbeiter-ID", "==", mitarbeiterId)
          .where("Status", "in", ["Genehmigt", "Abgelehnt"]);

        Promise.all([urlaubsplanQuery.get(), abwesenheitenQuery.get()])
          .then(function (querySnapshots) {
            var notifications = [];

            querySnapshots.forEach(function (querySnapshot) {
              querySnapshot.forEach(function (doc) {
                var data = doc.data();

                if (data.Antragsdatum && data.Antragsdatum.seconds) {
                  const date = new Date(data.Antragsdatum.seconds * 1000);
                  data.Antragsdatum = date.toLocaleDateString("en-GB", {
                    weekday: "short",
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  });
                }

                notifications.push(data);
              });
            });

            notifications.sort(function (a, b) {
              return new Date(b.Antragsdatum) - new Date(a.Antragsdatum);
            });

            var notificationPromises = notifications.map(function (
              notification
            ) {
              var icon =
                notification.Status === "Genehmigt"
                  ? "sap-icon://accept"
                  : "sap-icon://decline";
              var iconColor =
                notification.Status === "Genehmigt" ? "Success" : "Error";

              return firebase.db
                .collection("Abwesenheitsart")
                .where("Abwesenheit-ID", "==", notification["Abwesenheit-ID"])
                .get()
                .then((querySnapshot) => {
                  var abwesenheitsart = "Unbekannt";
                  if (!querySnapshot.empty) {
                    abwesenheitsart = querySnapshot.docs[0].data().Beschreibung;
                  }

                  return new sap.m.StandardListItem({
                    title: notification.Antragsdatum,
                    description: `Abwesenheitsart: ${abwesenheitsart}`,
                    info: notification.Status,
                    icon: icon,
                    infoState: iconColor,
                    type: "Active",
                    press: function () {
                      UIComponent.getRouterFor(that).navTo("absenceOverview");
                    },
                  });
                })
                .catch((error) => {
                  console.error("Error fetching Abwesenheitsart: ", error);
                  return null;
                });
            });

            Promise.all(notificationPromises).then(function (
              notificationItems
            ) {
              notificationItems = notificationItems.filter(
                (item) => item !== null
              );

              // Create dialog only once
              if (!that.oNotificationDialog) {
                that.oNotificationDialog = new sap.m.Dialog({
                  title: "Benachrichtigungen",
                  contentWidth: "400px",
                  contentHeight: "300px",
                  resizable: true,
                  draggable: true,
                  content: new sap.m.List(),
                  beginButton: new sap.m.Button({
                    text: "Schließen",
                    press: function () {
                      that.oNotificationDialog.close();
                    },
                  }),
                });
              }

              var oList = that.oNotificationDialog.getContent()[0];
              oList.removeAllItems();

              notificationItems.forEach(function (item) {
                oList.addItem(item);
              });

              that.oNotificationDialog.open();
            });
          })
          .catch(function (error) {
            console.error("Error fetching notifications: ", error);
            sap.m.MessageToast.show(
              "Fehler beim Abrufen der Benachrichtigungen."
            );
          });
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
              // Session löschen
              var sessionId = sessionStorage.getItem("currentSessionId");
              if (sessionId) {
                // Userdaten entfernen
                sessionStorage.removeItem(sessionId);
                // Session-ID selbst entfernen
                sessionStorage.removeItem("currentSessionId");
              }
              sap.ui.getCore().setModel(null, "userModel");

              this.getOwnerComponent().getRouter().navTo("login");

              oDialog.close();
              // damit können wir sichersstellen, dass keine Daten mehr von dem alten User vorhanden sind
              window.location.reload();
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
      onHomePress: function () {
        UIComponent.getRouterFor(this).navTo("Main");
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

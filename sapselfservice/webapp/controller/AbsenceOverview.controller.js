sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/ui/model/json/JSONModel",
    "sapselfservice/backend/firebase",
  ],
  function (Controller, MessageToast, JSONModel, firebase) {
    "use strict";

    return Controller.extend("sapselfservice.controller.AbsenceOverview", {
      onInit: function () {
        // 1) Check userModel
        var oUserModel = sap.ui.getCore().getModel("userModel");
        if (!oUserModel) {
          // 2) Keine userModel => Session checken
          this._restoreSessionOrGoLogin();
        } else {
          // userModel ist da => weiter
          this._continueInit();
        }
      },

      // Versucht, Session aus sessionStorage wiederherzustellen
      _restoreSessionOrGoLogin: function () {
        var sessionId = sessionStorage.getItem("currentSessionId");
        if (sessionId) {
          var userDataString = sessionStorage.getItem(sessionId);
          if (userDataString) {
            try {
              var userData = JSON.parse(userDataString);
              var oUserModel = new JSONModel(userData);
              sap.ui.getCore().setModel(oUserModel, "userModel");
              this._continueInit();
              return;
            } catch (e) {
              console.error("Fehler beim Parsen der Session-Daten:", e);
            }
          }
        }
        // Immer noch kein userModel => zur Login-Seite
        sap.m.MessageToast.show("Bitte erst einloggen.");
        this.getOwnerComponent().getRouter().navTo("login");
      },

      _continueInit: function () {
        
        var oUserModel = sap.ui.getCore().getModel("userModel");
        if (!oUserModel) {
          sap.m.MessageToast.show("Das Benutzer-Modell ist nicht gesetzt!");
          this.getOwnerComponent().getRouter().navTo("login");
          return;
        }

        var mitarbeiterId = oUserModel.getProperty("/Mitarbeiter-ID");

        
        const abwesenheitenPromise = this.fetchAbwesenheiten(mitarbeiterId);
        const urlaubsplanPromise = this.fetchUrlaubsplan(mitarbeiterId);

        Promise.all([abwesenheitenPromise, urlaubsplanPromise])
          .then((results) => {
            const combinedEntries = [].concat(...results);

            function fetchAbwesenheitsart(abwesenheitId) {
              return firebase.db
                .collection("Abwesenheitsart")
                .where("Abwesenheit-ID", "==", abwesenheitId)
                .get()
                .then((querySnapshot) => {
                  if (querySnapshot.empty) {
                    return "Unbekannt";
                  }
                  const description = querySnapshot.docs[0].data().Beschreibung;
                  return description;
                })
                .catch((error) => {
                  return "Unbekannt";
                });
            }

            const updatedEntries = combinedEntries.map((entry) => {
              const abwesenheitId = entry["Abwesenheit-ID"];
              return fetchAbwesenheitsart(abwesenheitId)
                .then((beschreibung) => {
                  entry.AbwesenheitsartBeschreibung = beschreibung;
                  return entry;
                })
                .catch((error) => {
                  entry.AbwesenheitsartBeschreibung = "Unbekannt";
                  return entry;
                });
            });

            Promise.all(updatedEntries)
              .then((processedEntries) => {
                processedEntries.forEach((entry) => {
                  if (entry.Antragsdatum && entry.Antragsdatum.seconds) {
                    const date = new Date(entry.Antragsdatum.seconds * 1000);
                    entry.Antragsdatum = date.toLocaleDateString("en-GB", {
                      weekday: "short",
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    });
                  }
                });

                processedEntries.sort((a, b) => {
                  return b.Antragsdatum - a.Antragsdatum;
                });

                const oModel = new sap.ui.model.json.JSONModel();
                oModel.setData({ entries: processedEntries });
                this.getView().setModel(oModel, "AbwesenceModel");
              })
              .catch((error) => {
                console.error("Error processing updated entries:", error);
              });
          })
          .catch((error) => {
            console.error("Error combining data:", error);
          });
      },

      //fetch Abwesenheiten data
      fetchAbwesenheiten: function (mitarbeiterId) {
        return firebase.db
          .collection("Abwesenheiten")
          .where("Mitarbeiter-ID", "==", mitarbeiterId)
          .get()
          .then((querySnapshot) => {
            const abwesenheiten = [];
            querySnapshot.forEach((doc) => {
              abwesenheiten.push(doc.data());
            });
            return abwesenheiten;
          })
          .catch((error) => {
            console.error("Error fetching Abwesenheiten documents:", error);
            return [];
          });
      },

      //fetch Urlaubsplan data
      fetchUrlaubsplan: function (mitarbeiterId) {
        return firebase.db
          .collection("Urlaubsplan")
          .where("Mitarbeiter-ID", "==", mitarbeiterId)
          .get()
          .then((querySnapshot) => {
            const urlaubsplan = [];
            querySnapshot.forEach((doc) => {
              urlaubsplan.push(doc.data());
            });
            return urlaubsplan;
          })
          .catch((error) => {
            console.error("Error fetching Urlaubsplan documents:", error);
            return [];
          });
      },

      onNewAbsenceRequest: function () {
        var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
        if (!oRouter) {
          console.error("Router konnte nicht geladen werden!");
        } else {
          oRouter.navTo("newAbsenceRequest");
        }
      },

      onNavBack: function () {
        sap.ui.core.UIComponent.getRouterFor(this).navTo("Main");
      },
    });
  }
);

sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sapselfservice/backend/firebase",
  ],
  function (Controller, JSONModel, MessageToast, firebase) {
    "use strict";

    return Controller.extend("sapselfservice.controller.EmployeeDirectory", {
      onInit: function () {
        // Check if userModel exists
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
        this._loadEmployeeData();
      },

      _loadEmployeeData: function () {
        var that = this;
        var db = firebase.db;

        db.collection("DatenZurPerson")
          .get()
          .then(function (querySnapshot) {
            var aEmployees = [];
            querySnapshot.forEach(function (doc) {
              var oEmp = doc.data();
              oEmp.emergencyContactName = null;
              oEmp.emergencyContactPhone = null;
              aEmployees.push(oEmp);
            });

            var aPromises = aEmployees.map(function (oEmp) {
              return Promise.all([
                db
                  .collection("StelleRolle")
                  .where("Mitarbeiter-ID", "==", oEmp["Mitarbeiter-ID"])
                  .get()
                  .then(function (stelleRolleSnap) {
                    if (!stelleRolleSnap.empty) {
                      var oStelleRolleData = stelleRolleSnap.docs[0].data();
                      var sStellenId = oStelleRolleData["Stellen-ID"];

                      return db
                        .collection("Stelle")
                        .where("Stellen-ID", "==", sStellenId)
                        .get()
                        .then(function (stelleSnap) {
                          if (!stelleSnap.empty) {
                            var oStelleData = stelleSnap.docs[0].data();
                            oEmp.role = oStelleData["Stellenbezeichnung"];
                          } else {
                            oEmp.role = "";
                          }
                        });
                    } else {
                      oEmp.role = "";
                    }
                  }),

                db
                  .collection("Notfallkontakte")
                  .doc(oEmp["Mitarbeiter-ID"])
                  .get()
                  .then(function (notfallSnap) {
                    if (notfallSnap.exists) {
                      var oNotfallData = notfallSnap.data();
                      oEmp.emergencyContactName = oNotfallData.Name || null;
                      oEmp.emergencyContactPhone =
                        oNotfallData.Telefonnummer || null;
                    }
                  }),
              ]).then(() => oEmp);
            });

            return Promise.all(aPromises);
          })
          .then(function (aEmployeesWithRolesAndContacts) {
            var oModel = new JSONModel(aEmployeesWithRolesAndContacts);
            that.getView().setModel(oModel, "employees");
          })
          .catch(function (error) {
            MessageToast.show("Fehler beim Laden der Mitarbeiterdaten.");
            console.error("Error fetching data: ", error);
          });
      },

      onSearchChanged: function (oEvent) {
        var sQuery = oEvent.getParameter("newValue") || "";
        if (!sQuery.trim()) {
          this.onResetSearch();
        } else {
          this.onSearchEmployee(oEvent);
        }
      },

      onSearchEmployee: function (oEvent) {
        var sQuery =
          oEvent.getParameter("query") || oEvent.getParameter("newValue") || "";
        sQuery = sQuery.toLowerCase();

        var oModel = this.getView().getModel("employees");
        if (!oModel) {
          MessageToast.show("Keine Mitarbeiterdaten vorhanden.");
          return;
        }

        var aAllEmployees = oModel.getData();
        if (!Array.isArray(aAllEmployees)) {
          return;
        }

        var aFiltered = aAllEmployees.filter(function (oEmp) {
          var sName = (
            (oEmp.Vorname || "") +
            " " +
            (oEmp.Nachname || "")
          ).toLowerCase();
          var sRole = (oEmp.role || "").toLowerCase();
          return sName.indexOf(sQuery) !== -1 || sRole.indexOf(sQuery) !== -1;
        });

        oModel.setData(aFiltered);
      },

      onResetSearch: function () {
        this._loadEmployeeData();
      },

      formatEmergencyContact: function (sName, sPhone) {
        if (!sName && !sPhone) {
          return "Kein Notfallkontakt hinterlegt.";
        }
        return `${sName || "Unbekannt"} (${sPhone || "Keine Nummer"})`;
      },

      onNavBack: function () {
        sap.ui.core.UIComponent.getRouterFor(this).navTo("Main");
      },
    });
  }
);
